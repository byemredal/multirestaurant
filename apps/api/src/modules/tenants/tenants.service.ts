import {
  ConflictException,
  Injectable,
  MessageEvent,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Observable, concat, defer, from } from 'rxjs';
import { map } from 'rxjs/operators';
import { PasswordService } from '../../common/security/password.service';
import { SecurityLoggerService } from '../../common/security/security-logger.service';
import { SessionTokenService } from '../../common/security/session-token.service';
import { LoginTenantDto } from './dto/login-tenant.dto';
import { RegisterTenantDto } from './dto/register-tenant.dto';
import { StartOnboardingDto } from './dto/start-onboarding.dto';
import { TenantAccount } from './entities/tenant-account.entity';
import { TenantAccountsStore } from './tenants.store';
import { toTenantStatus } from './tenant-status';
import { TenantStatusEventsService } from './tenant-status-events.service';

@Injectable()
export class TenantsService {
  constructor(
    private readonly tenantAccountsStore: TenantAccountsStore,
    private readonly passwordService: PasswordService,
    private readonly sessionTokenService: SessionTokenService,
    private readonly securityLogger: SecurityLoggerService,
    private readonly statusEvents: TenantStatusEventsService,
  ) {}

  async register(dto: RegisterTenantDto) {
    const existing = await this.tenantAccountsStore.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('Tenant account already exists for this email.');
    }

    const account = await this.tenantAccountsStore.create({
      email: dto.email.trim().toLowerCase(),
      passwordHash: await this.passwordService.hash(dto.password),
      firstName: dto.firstName,
      lastName: dto.lastName,
      phoneNumber: dto.phoneNumber,
      companyName: dto.companyName,
      companyAddress: dto.companyAddress,
      tenantType: dto.tenantType,
      deliveryModel: dto.deliveryModel,
      verificationStatus: 'pending',
      onboardingStatus: 'draft',
      isActive: true,
      isVerified: false,
      lastLoginAt: null,
    });

    const tokens = await this.sessionTokenService.issueSession({
      id: account.id,
      email: account.email,
      type: 'tenant',
      claims: {
        tenantType: account.tenantType,
        onboardingStatus: account.onboardingStatus,
        verificationStatus: account.verificationStatus,
      },
    });

    return {
      ...tokens,
      tenant: this.toPublicAccount(account),
    };
  }

  /**
   * Passwordless onboarding start. Creates the tenant account with an empty
   * password hash, issues a normal session for the current browser, and also
   * returns a long-lived onboarding continuation token so the partner can
   * resume a half-finished application later (e.g. on another device). A
   * password is set separately, after approval, via `setPassword`.
   */
  async startOnboarding(dto: StartOnboardingDto) {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.tenantAccountsStore.findByEmail(email);

    if (existing) {
      // A passwordless account still mid-onboarding is allowed to re-enter the
      // flow (idempotent restart). Everything else is a genuine conflict.
      const resumable =
        existing.passwordHash === '' &&
        ['draft', 'revision_required'].includes(existing.onboardingStatus);
      if (!resumable) {
        throw new ConflictException('Tenant account already exists for this email.');
      }
      return this.issueOnboardingSession(existing);
    }

    const account = await this.tenantAccountsStore.create({
      email,
      passwordHash: '',
      firstName: dto.firstName,
      lastName: dto.lastName,
      phoneNumber: dto.phoneNumber,
      companyName: dto.companyName,
      companyAddress: dto.companyAddress,
      tenantType: dto.tenantType,
      deliveryModel: dto.deliveryModel,
      verificationStatus: 'pending',
      onboardingStatus: 'draft',
      isActive: true,
      isVerified: false,
      lastLoginAt: null,
    });

    return this.issueOnboardingSession(account);
  }

  /**
   * Exchanges an onboarding continuation token for an active session. This is
   * the "magic-link"-style resume path: it never reveals or bypasses a
   * password — the token itself is a single-purpose, signed, expiring credential.
   */
  async resumeOnboarding(token: string) {
    let payload: { sub: string };
    try {
      payload = await this.sessionTokenService.verifyOnboardingToken(token);
    } catch {
      throw new UnauthorizedException('Onboarding continuation link is invalid or expired.');
    }

    const account = await this.tenantAccountsStore.findById(payload.sub);
    if (!account || !account.isActive) {
      throw new UnauthorizedException('Onboarding continuation link is no longer valid.');
    }

    return this.issueOnboardingSession(account);
  }

  /**
   * Sets (or replaces) the password for the authenticated tenant. Used after
   * approval so a partner created through passwordless onboarding can sign in
   * with email + password from then on.
   */
  async setPassword(tenantId: string, password: string) {
    const account = await this.tenantAccountsStore.findById(tenantId);
    if (!account) {
      throw new NotFoundException('Tenant account could not be found.');
    }

    const passwordHash = await this.passwordService.hash(password);
    const updated = await this.tenantAccountsStore.updatePasswordHash(account.id, passwordHash);
    return this.toPublicAccount(updated);
  }

  private async issueOnboardingSession(account: TenantAccount) {
    const tokens = await this.sessionTokenService.issueSession({
      id: account.id,
      email: account.email,
      type: 'tenant',
      claims: {
        tenantType: account.tenantType,
        onboardingStatus: account.onboardingStatus,
        verificationStatus: account.verificationStatus,
      },
    });
    const continuationToken = await this.sessionTokenService.issueOnboardingToken(
      account.id,
    );

    return {
      ...tokens,
      continuationToken,
      tenant: this.toPublicAccount(account),
    };
  }

  async login(dto: LoginTenantDto, context: Record<string, unknown> = {}) {
    const account = await this.tenantAccountsStore.findByEmail(dto.email);
    if (!account || !account.isActive) {
      this.securityLogger.logLoginFailure('tenant', {
        email: dto.email.trim().toLowerCase(),
        ...context,
      });
      throw new UnauthorizedException('Invalid tenant credentials.');
    }

    // Accounts created through passwordless onboarding have no password yet —
    // they must set one (post-approval) before email + password sign-in works.
    const passwordMatches =
      account.passwordHash !== '' &&
      (await this.passwordService.matches(dto.password, account.passwordHash));

    if (!passwordMatches) {
      this.securityLogger.logLoginFailure('tenant', {
        email: account.email,
        accountId: account.id,
        reason: 'invalid_password',
        ...context,
      });
      throw new UnauthorizedException('Invalid tenant credentials.');
    }

    const updated = await this.tenantAccountsStore.touchLastLogin(account.id);
    const tokens = await this.sessionTokenService.issueSession({
      id: updated.id,
      email: updated.email,
      type: 'tenant',
      claims: {
        tenantType: updated.tenantType,
        onboardingStatus: updated.onboardingStatus,
        verificationStatus: updated.verificationStatus,
      },
    });
    this.securityLogger.logLoginSuccess('tenant', updated.id, {
      email: updated.email,
      ...context,
    });

    return {
      ...tokens,
      tenant: this.toPublicAccount(updated),
    };
  }

  async refresh(refreshToken: string, context: Record<string, unknown> = {}) {
    const payload = await this.sessionTokenService.verifyRefreshToken(
      refreshToken,
      'tenant',
    );
    const account = await this.tenantAccountsStore.findById(payload.sub);

    if (!account || !account.isActive) {
      this.securityLogger.logRefreshFailure('tenant', {
        subjectId: payload.sub,
        reason: 'inactive_or_missing_account',
        ...context,
      });
      throw new UnauthorizedException('Tenant refresh session is no longer valid.');
    }

    const tokens = await this.sessionTokenService.rotateRefreshToken(refreshToken, {
      id: account.id,
      email: account.email,
      type: 'tenant',
      claims: {
        tenantType: account.tenantType,
        onboardingStatus: account.onboardingStatus,
        verificationStatus: account.verificationStatus,
      },
    });
    this.securityLogger.logRefreshSuccess('tenant', account.id, {
      email: account.email,
      ...context,
    });

    return {
      ...tokens,
      tenant: this.toPublicAccount(account),
    };
  }

  async logout(refreshToken: string, subjectId: string, context: Record<string, unknown> = {}) {
    const success = await this.sessionTokenService.revokeRefreshToken(refreshToken, 'tenant');
    this.securityLogger.logLogout('tenant', subjectId, {
      refreshRevoked: success,
      ...context,
    });

    return {
      success,
    };
  }

  async getProfile(tenantId: string) {
    const account = await this.tenantAccountsStore.findById(tenantId);
    if (!account) {
      throw new NotFoundException('Tenant account could not be found.');
    }

    return this.toPublicAccount(account);
  }

  /**
   * Server-Sent Events stream of the tenant lifecycle status. Emits an
   * immediate snapshot on connect, then one event per subsequent transition.
   */
  streamStatus(tenantId: string): Observable<MessageEvent> {
    const snapshot$ = defer(() =>
      from(this.getProfile(tenantId)).pipe(
        map((account) => ({
          status: account.status,
          onboardingStatus: account.onboardingStatus,
        })),
      ),
    );

    const updates$ = this.statusEvents.stream(tenantId).pipe(
      map((change) => ({
        status: change.status,
        onboardingStatus: change.onboardingStatus,
      })),
    );

    // No custom `type` — keep it a standard message event so the browser
    // EventSource `onmessage` handler fires.
    return concat(snapshot$, updates$).pipe(
      map((data) => ({ data }) as MessageEvent),
    );
  }

  async validateTenant(tenantId: string): Promise<TenantAccount | null> {
    const account = await this.tenantAccountsStore.findById(tenantId);
    if (!account || !account.isActive) {
      return null;
    }

    return account;
  }

  private toPublicAccount(account: TenantAccount) {
    return {
      id: account.id,
      email: account.email,
      firstName: account.firstName,
      lastName: account.lastName,
      phoneNumber: account.phoneNumber,
      companyName: account.companyName,
      companyAddress: account.companyAddress,
      tenantType: account.tenantType,
      deliveryModel: account.deliveryModel,
      status: toTenantStatus(account.onboardingStatus),
      onboardingStatus: account.onboardingStatus,
      verificationStatus: account.verificationStatus,
      isActive: account.isActive,
      isVerified: account.isVerified,
      /** False for accounts still in the passwordless onboarding flow. */
      hasPassword: account.passwordHash !== '',
      lastLoginAt: account.lastLoginAt,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
    };
  }
}
