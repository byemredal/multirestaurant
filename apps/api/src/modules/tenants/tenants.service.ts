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
import { TenantAccountView, TenantAccountsStore } from './tenants.store';
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

    const view = await this.tenantAccountsStore.create({
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

    const tokens = await this.issueViewSession(view);
    return {
      ...tokens,
      tenant: this.toPublicAccount(view),
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
        existing.account.passwordHash === '' &&
        ['draft', 'revision_required'].includes(existing.business.onboardingStatus);
      if (!resumable) {
        throw new ConflictException('Tenant account already exists for this email.');
      }
      return this.issueOnboardingSession(existing);
    }

    const view = await this.tenantAccountsStore.create({
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

    return this.issueOnboardingSession(view);
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

    const view = await this.tenantAccountsStore.findById(payload.sub);
    if (!view || !view.account.isActive) {
      throw new UnauthorizedException('Onboarding continuation link is no longer valid.');
    }

    return this.issueOnboardingSession(view);
  }

  /**
   * Sets (or replaces) the password for the authenticated tenant. Used after
   * approval so a partner created through passwordless onboarding can sign in
   * with email + password from then on.
   */
  async setPassword(tenantId: string, password: string) {
    const view = await this.tenantAccountsStore.findById(tenantId);
    if (!view) {
      throw new NotFoundException('Tenant account could not be found.');
    }

    const passwordHash = await this.passwordService.hash(password);
    const updated = await this.tenantAccountsStore.updatePasswordHash(view.account.id, passwordHash);
    return this.toPublicAccount(updated);
  }

  private async issueOnboardingSession(view: TenantAccountView) {
    const tokens = await this.issueViewSession(view);
    const continuationToken = await this.sessionTokenService.issueOnboardingToken(
      view.account.id,
    );

    return {
      ...tokens,
      continuationToken,
      tenant: this.toPublicAccount(view),
    };
  }

  private async issueViewSession(view: TenantAccountView) {
    return this.sessionTokenService.issueSession({
      id: view.account.id,
      email: view.account.email,
      type: 'tenant',
      claims: {
        tenantType: view.business.tenantType,
        onboardingStatus: view.business.onboardingStatus,
        verificationStatus: view.business.verificationStatus,
      },
    });
  }

  async login(dto: LoginTenantDto, context: Record<string, unknown> = {}) {
    const view = await this.tenantAccountsStore.findByEmail(dto.email);
    if (!view || !view.account.isActive) {
      this.securityLogger.logLoginFailure('tenant', {
        email: dto.email.trim().toLowerCase(),
        ...context,
      });
      throw new UnauthorizedException('Invalid tenant credentials.');
    }

    // Accounts created through passwordless onboarding have no password yet —
    // they must set one (post-approval) before email + password sign-in works.
    const passwordMatches =
      view.account.passwordHash !== '' &&
      (await this.passwordService.matches(dto.password, view.account.passwordHash));

    if (!passwordMatches) {
      this.securityLogger.logLoginFailure('tenant', {
        email: view.account.email,
        accountId: view.account.id,
        reason: 'invalid_password',
        ...context,
      });
      throw new UnauthorizedException('Invalid tenant credentials.');
    }

    const updated = await this.tenantAccountsStore.touchLastLogin(view.account.id);
    const tokens = await this.issueViewSession(updated);
    this.securityLogger.logLoginSuccess('tenant', updated.account.id, {
      email: updated.account.email,
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
    const view = await this.tenantAccountsStore.findById(payload.sub);

    if (!view || !view.account.isActive) {
      this.securityLogger.logRefreshFailure('tenant', {
        subjectId: payload.sub,
        reason: 'inactive_or_missing_account',
        ...context,
      });
      throw new UnauthorizedException('Tenant refresh session is no longer valid.');
    }

    const tokens = await this.sessionTokenService.rotateRefreshToken(refreshToken, {
      id: view.account.id,
      email: view.account.email,
      type: 'tenant',
      claims: {
        tenantType: view.business.tenantType,
        onboardingStatus: view.business.onboardingStatus,
        verificationStatus: view.business.verificationStatus,
      },
    });
    this.securityLogger.logRefreshSuccess('tenant', view.account.id, {
      email: view.account.email,
      ...context,
    });

    return {
      ...tokens,
      tenant: this.toPublicAccount(view),
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
    const view = await this.tenantAccountsStore.findById(tenantId);
    if (!view) {
      throw new NotFoundException('Tenant account could not be found.');
    }

    return this.toPublicAccount(view);
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

  /**
   * Returns the identity-only TenantAccount used by the AccessTokenGuard.
   * Kept thin: guards do not need business profile data.
   */
  async validateTenant(tenantId: string): Promise<TenantAccount | null> {
    const view = await this.tenantAccountsStore.findById(tenantId);
    if (!view || !view.account.isActive) {
      return null;
    }
    return view.account;
  }

  /** Returns the joined view for callers that need the business profile. */
  async findView(tenantId: string): Promise<TenantAccountView | null> {
    return this.tenantAccountsStore.findById(tenantId);
  }

  private toPublicAccount(view: TenantAccountView) {
    const { account, business } = view;
    return {
      id: account.id,
      email: account.email,
      firstName: account.firstName,
      lastName: account.lastName,
      phoneNumber: account.phoneNumber,
      companyName: business.companyName,
      companyAddress: business.companyAddress,
      tenantType: business.tenantType,
      deliveryModel: business.deliveryModel,
      status: toTenantStatus(business.onboardingStatus),
      onboardingStatus: business.onboardingStatus,
      verificationStatus: business.verificationStatus,
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
