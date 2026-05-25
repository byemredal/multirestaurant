import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PasswordService } from '../../common/security/password.service';
import { SecurityLoggerService } from '../../common/security/security-logger.service';
import { SessionTokenService } from '../../common/security/session-token.service';
import { LoginStaffDto } from './dto/login-staff.dto';
import {
  StaffAccount,
  StaffSessionView,
} from './entities/staff-account.entity';
import { StaffAuthStore } from './staff-auth.store';
import { StaffInviteTokenStore } from './staff-invite-token.store';

/** Input for accept-invite — kept inline because StaffAuth owns the flow. */
export interface AcceptStaffInviteInput {
  token: string;
  password: string;
}

/**
 * Staff authentication service. Mirrors `TenantsService` / `AdminAuthService`
 * conventions: passwordHash via PasswordService, JWT issuance via
 * SessionTokenService, no per-service crypto.
 *
 * The staff JWT carries a `storeScope` claim — the list of `storeId`s the
 * staff currently has an active StaffMembership for. The scope is derived
 * server-side from the DB on every issuance / refresh / validate so that
 * revoking a membership takes effect on the next access-token rotation
 * (and immediately on the next validateStaff call from the guard).
 */
@Injectable()
export class StaffAuthService {
  constructor(
    private readonly staffAuthStore: StaffAuthStore,
    private readonly staffInviteTokenStore: StaffInviteTokenStore,
    private readonly passwordService: PasswordService,
    private readonly sessionTokenService: SessionTokenService,
    private readonly securityLogger: SecurityLoggerService,
  ) {}

  /**
   * Single-use invite acceptance.
   *
   * Validates that `token` matches an unused, unexpired StaffInviteToken,
   * sets the staff's password hash via PasswordService, marks the token as
   * used in the same transaction, and immediately issues a normal staff
   * session so the new hire is logged in.
   *
   * Failure modes (each fails closed with UnauthorizedException):
   *   • Token does not match any stored hash.
   *   • Token has been used already (replay attempt).
   *   • Token has expired.
   *   • Staff is no longer active or has no active membership.
   *
   * Password rule: minimum length is enforced by the controller DTO; this
   * service additionally rejects empty / whitespace-only passwords as a
   * defensive belt.
   */
  async acceptInvite(
    input: AcceptStaffInviteInput,
    context: Record<string, unknown> = {},
  ) {
    if (!input.password || input.password.trim().length === 0) {
      throw new BadRequestException('Password is required.');
    }

    const token = await this.staffInviteTokenStore.findByRawToken(input.token);
    if (!token) {
      this.securityLogger.logLoginFailure('staff', {
        reason: 'invite_token_unknown',
        ...context,
      });
      throw new UnauthorizedException('Invite token is invalid or expired.');
    }

    if (token.usedAt) {
      this.securityLogger.logLoginFailure('staff', {
        reason: 'invite_token_replayed',
        staffAccountId: token.staffAccountId,
        ...context,
      });
      throw new UnauthorizedException('Invite token has already been used.');
    }

    if (token.expiresAt.getTime() <= Date.now()) {
      this.securityLogger.logLoginFailure('staff', {
        reason: 'invite_token_expired',
        staffAccountId: token.staffAccountId,
        ...context,
      });
      throw new UnauthorizedException('Invite token has expired.');
    }

    const account = await this.staffAuthStore.findById(token.staffAccountId);
    if (!account || !account.isActive) {
      this.securityLogger.logLoginFailure('staff', {
        reason: 'invite_target_inactive',
        staffAccountId: token.staffAccountId,
        ...context,
      });
      throw new UnauthorizedException('Invite cannot be accepted.');
    }

    // Mark the token used FIRST. The UPDATE includes `usedAt IS NULL` in its
    // WHERE clause, so a concurrent accept attempt that lost the race will
    // see `false` here and bail out without setting a second password.
    const marked = await this.staffInviteTokenStore.markUsed(token.id);
    if (!marked) {
      this.securityLogger.logLoginFailure('staff', {
        reason: 'invite_token_race',
        staffAccountId: token.staffAccountId,
        ...context,
      });
      throw new UnauthorizedException('Invite token has already been used.');
    }

    const passwordHash = await this.passwordService.hash(input.password);
    await this.staffAuthStore.setPasswordHash(account.id, passwordHash);

    // Re-read the now-active account + scope for the session response.
    const refreshed = await this.staffAuthStore.findById(account.id);
    if (!refreshed) {
      throw new NotFoundException('Staff account could not be found after accept.');
    }
    const storeScope = await this.requireActiveStoreScope(refreshed, context);

    const tokens = await this.sessionTokenService.issueSession({
      id: refreshed.id,
      email: refreshed.email,
      type: 'staff',
      claims: {
        tenantId: refreshed.tenantId,
        storeScope: [...storeScope],
      },
    });
    this.securityLogger.logLoginSuccess('staff', refreshed.id, {
      email: refreshed.email,
      reason: 'invite_accepted',
      ...context,
    });
    await this.staffAuthStore.touchLastLogin(refreshed.id);

    return {
      ...tokens,
      staff: this.toPublicAccount(refreshed, storeScope),
    };
  }

  async login(dto: LoginStaffDto, context: Record<string, unknown> = {}) {
    const account = await this.staffAuthStore.findByEmail(dto.email);
    this.assertLoginEligible(account, dto.email, context);
    // assertLoginEligible throws when account is unusable, so account is
    // non-null and has a non-empty passwordHash from here on.
    const safeAccount = account as StaffAccount & { passwordHash: string };

    const matches = await this.passwordService.matches(
      dto.password,
      safeAccount.passwordHash,
    );
    if (!matches) {
      this.securityLogger.logLoginFailure('staff', {
        email: safeAccount.email,
        accountId: safeAccount.id,
        reason: 'invalid_password',
        ...context,
      });
      throw new UnauthorizedException('Invalid staff credentials.');
    }

    const storeScope = await this.requireActiveStoreScope(safeAccount, context);
    await this.staffAuthStore.touchLastLogin(safeAccount.id);

    const tokens = await this.sessionTokenService.issueSession({
      id: safeAccount.id,
      email: safeAccount.email,
      type: 'staff',
      claims: {
        tenantId: safeAccount.tenantId,
        storeScope: [...storeScope],
      },
    });
    this.securityLogger.logLoginSuccess('staff', safeAccount.id, {
      email: safeAccount.email,
      ...context,
    });

    return {
      ...tokens,
      staff: this.toPublicAccount(safeAccount, storeScope),
    };
  }

  async refresh(refreshToken: string, context: Record<string, unknown> = {}) {
    const payload = await this.sessionTokenService.verifyRefreshToken(
      refreshToken,
      'staff',
    );
    const account = await this.staffAuthStore.findById(payload.sub);

    if (!account || !account.isActive) {
      this.securityLogger.logRefreshFailure('staff', {
        subjectId: payload.sub,
        reason: 'inactive_or_missing_account',
        ...context,
      });
      throw new UnauthorizedException('Staff refresh session is no longer valid.');
    }

    const storeScope = await this.requireActiveStoreScope(account, context);

    const tokens = await this.sessionTokenService.rotateRefreshToken(refreshToken, {
      id: account.id,
      email: account.email,
      type: 'staff',
      claims: {
        tenantId: account.tenantId,
        storeScope: [...storeScope],
      },
    });
    this.securityLogger.logRefreshSuccess('staff', account.id, {
      email: account.email,
      ...context,
    });

    return {
      ...tokens,
      staff: this.toPublicAccount(account, storeScope),
    };
  }

  async logout(refreshToken: string, subjectId: string, context: Record<string, unknown> = {}) {
    const success = await this.sessionTokenService.revokeRefreshToken(refreshToken, 'staff');
    this.securityLogger.logLogout('staff', subjectId, {
      refreshRevoked: success,
      ...context,
    });
    return { success };
  }

  async getProfile(staffId: string) {
    const account = await this.staffAuthStore.findById(staffId);
    if (!account) {
      throw new NotFoundException('Staff account could not be found.');
    }
    const storeScope = await this.staffAuthStore.listActiveStoreScope(account.id);
    return this.toPublicAccount(account, storeScope);
  }

  /**
   * AccessTokenGuard contract: returns the live session view (identity +
   * store scope) or `null` when the staff cannot transact today. The guard
   * uses this on every request, which is why suspended memberships and
   * inactive accounts deny immediately, not on the next token rotation.
   */
  async validateStaff(staffId: string): Promise<StaffSessionView | null> {
    const account = await this.staffAuthStore.findById(staffId);
    if (!account || !account.isActive) {
      return null;
    }
    const storeScope = await this.staffAuthStore.listActiveStoreScope(account.id);
    if (storeScope.length === 0) {
      // No active membership means staff cannot act on any store. Treat
      // this as "session denied" until at least one membership is reinstated.
      return null;
    }
    return { account, storeScope };
  }

  private assertLoginEligible(
    account: StaffAccount | null,
    email: string,
    context: Record<string, unknown>,
  ): void {
    const baseEvent = {
      email: email.trim().toLowerCase(),
      ...context,
    };

    if (!account) {
      this.securityLogger.logLoginFailure('staff', baseEvent);
      throw new UnauthorizedException('Invalid staff credentials.');
    }

    if (!account.isActive) {
      this.securityLogger.logLoginFailure('staff', {
        ...baseEvent,
        accountId: account.id,
        reason: 'inactive_account',
      });
      throw new UnauthorizedException('Invalid staff credentials.');
    }

    if (account.employmentStatus !== 'active') {
      this.securityLogger.logLoginFailure('staff', {
        ...baseEvent,
        accountId: account.id,
        reason: `employment_${account.employmentStatus}`,
      });
      throw new UnauthorizedException('Invalid staff credentials.');
    }

    if (!account.passwordHash || account.passwordHash === '') {
      this.securityLogger.logLoginFailure('staff', {
        ...baseEvent,
        accountId: account.id,
        reason: 'password_not_set',
      });
      throw new UnauthorizedException(
        'Staff account has not finished invite — set a password before logging in.',
      );
    }
  }

  private async requireActiveStoreScope(
    account: StaffAccount,
    context: Record<string, unknown>,
  ): Promise<readonly string[]> {
    const scope = await this.staffAuthStore.listActiveStoreScope(account.id);
    if (scope.length === 0) {
      this.securityLogger.logLoginFailure('staff', {
        accountId: account.id,
        email: account.email,
        reason: 'no_active_membership',
        ...context,
      });
      throw new UnauthorizedException(
        'Staff has no active store assignment — contact your tenant owner.',
      );
    }
    return scope;
  }

  /** Public-safe staff projection — never includes passwordHash. */
  private toPublicAccount(account: StaffAccount, storeScope: readonly string[]) {
    return {
      id: account.id,
      email: account.email,
      fullName: account.fullName,
      phoneNumber: account.phoneNumber,
      tenantId: account.tenantId,
      defaultStoreId: account.defaultStoreId,
      staffType: account.staffType,
      employmentStatus: account.employmentStatus,
      isActive: account.isActive,
      isVerified: account.isVerified,
      lastLoginAt: account.lastLoginAt,
      storeScope: [...storeScope],
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
    };
  }
}
