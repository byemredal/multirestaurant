import { randomBytes, createHmac } from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PasswordService } from '../../common/security/password.service';
import { EmailService } from '../notification/email.service';
import { SetupStore } from '../setup/setup.store';
import { TenantAccountsStore } from '../tenants/tenants.store';
import {
  PasswordSetupDeliveryStatus,
  PasswordSetupTokenRow,
  TenantPasswordSetupStore,
} from './tenant-password-setup.store';

/**
 * Result of issuing a token. The RAW token is returned ONLY to the issuing
 * call (so it can build the magic link). The persisted record never stores
 * the raw value — only the SHA-256 hash.
 */
export interface IssuedPasswordSetupToken {
  token: PasswordSetupTokenRow;
  deliveryStatus: PasswordSetupDeliveryStatus;
  deliveryErrorCode: string | null;
  /**
   * Set only in non-production environments. Lets the admin smoke screen
   * surface the link when no real SMTP provider is wired. Production MUST
   * NOT see this field — the redact happens in the controller layer.
   */
  debugLink: string | null;
}

@Injectable()
export class TenantPasswordSetupService {
  private readonly logger = new Logger(TenantPasswordSetupService.name);
  private readonly tokenTtlMs = 24 * 60 * 60 * 1000;

  /**
   * Minimum gap between two issues for the same tenant. Defends against an
   * admin double-clicking "resend" (or a script hammering the endpoint),
   * which would otherwise rotate the token on every call and invalidate the
   * link still sitting in the partner's inbox before they had a chance to
   * click it. Env-tunable for ops; clamped so a misconfigured 0 cannot
   * silently disable the guard, and a multi-hour value cannot lock partners
   * out for the entire support window.
   */
  private readonly resendCooldownMs = this.resolveResendCooldownMs();

  private resolveResendCooldownMs(): number {
    const raw = process.env.PASSWORD_SETUP_RESEND_COOLDOWN_MS?.trim();
    const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
    const fallback = 60_000;
    const candidate = Number.isFinite(parsed) ? parsed : fallback;
    const min = 10_000;
    const max = 10 * 60 * 1000;
    return Math.min(max, Math.max(min, candidate));
  }

  /**
   * Resolve the HMAC secret used to derive token hashes. In production the
   * caller must have wired PASSWORD_SETUP_TOKEN_SECRET (or fallback JWT_SECRET);
   * a missing value is fail-closed — we refuse to issue or redeem tokens and
   * surface `password_setup_unavailable` so the admin/UX layer can show a
   * config error instead of silently using a guessable dev fallback.
   *
   * Non-production retains the dev fallback so local installs without env
   * configuration keep working end-to-end.
   */
  private resolveSecret(): string {
    const configured =
      process.env.PASSWORD_SETUP_TOKEN_SECRET?.trim() ||
      process.env.JWT_SECRET?.trim();
    if (configured) {
      return configured;
    }
    if (process.env.NODE_ENV === 'production') {
      throw new ServiceUnavailableException({
        message:
          'Şifre belirleme bağlantısı şu anda üretilemiyor. Operatör yapılandırmasını kontrol edin.',
        code: 'password_setup_unavailable',
      });
    }
    return 'lieferzonen-dev-password-setup';
  }

  constructor(
    private readonly store: TenantPasswordSetupStore,
    private readonly tenantAccountsStore: TenantAccountsStore,
    private readonly passwordService: PasswordService,
    private readonly emailService: EmailService,
    private readonly setupStore: SetupStore,
  ) {}

  /**
   * Issue a fresh single-use token, invalidate any prior active tokens for
   * the same tenant, and ATTEMPT to deliver the magic link by e-mail.
   * The DB row records exactly what delivery did — `sent` / `failed` /
   * `unavailable` — so admin UI never lies about the outcome.
   */
  async issueForTenant(input: {
    tenantAccountId: string;
    createdByAdminId: string | null;
    purpose?: 'initial_password_setup' | 'password_reset';
  }): Promise<IssuedPasswordSetupToken> {
    const tenant = await this.tenantAccountsStore.findById(input.tenantAccountId);
    if (!tenant) {
      throw new NotFoundException('Tenant account not found for password setup token.');
    }

    const now = new Date();
    await this.store.invalidateActiveForTenant(input.tenantAccountId, now);

    const rawToken = this.generateRawToken();
    const tokenHash = this.hashToken(rawToken);
    const tokenRecord = await this.store.create({
      tenantAccountId: input.tenantAccountId,
      tokenHash,
      purpose: input.purpose ?? 'initial_password_setup',
      expiresAt: new Date(now.getTime() + this.tokenTtlMs),
      createdByAdminId: input.createdByAdminId,
      sentToEmail: tenant.account.email,
      sentToPhone: tenant.account.phoneNumber,
    });

    const link = await this.buildSetupLink(rawToken);
    const platformName = await this.resolvePlatformName();

    let deliveryStatus: PasswordSetupDeliveryStatus = 'queued';
    let deliveryErrorCode: string | null = null;

    if (this.emailService.isStubTransport()) {
      // No real SMTP wired. In production this is a hard fail — we record
      // `unavailable` so admin sees "delivery not configured" and can chase
      // the operator instead of assuming the partner got an e-mail.
      deliveryStatus = 'unavailable';
      deliveryErrorCode = 'email_transport_stub';
      this.logger.warn(
        JSON.stringify({
          event: 'password_setup_delivery_unavailable',
          tenantAccountId: input.tenantAccountId,
          tokenId: tokenRecord.id,
        }),
      );
    } else {
      try {
        const result = await this.emailService.send({
          to: tenant.account.email,
          subject: `${platformName} hesabınız için şifre belirleyin`,
          text:
            `Merhaba ${tenant.account.firstName || ''},\n\n` +
            `${platformName} başvurunuz onaylandı. Hesabınıza erişmek için ` +
            `aşağıdaki bağlantı ile şifrenizi belirleyin (link 24 saat geçerlidir):\n\n${link}\n\n` +
            'Bu bağlantıyı siz talep etmediyseniz lütfen yok sayın.',
          html:
            `<p>Merhaba ${tenant.account.firstName || ''},</p>` +
            `<p><strong>${platformName}</strong> başvurunuz onaylandı.</p>` +
            `<p><a href="${link}">Şifre belirle</a> (link 24 saat geçerlidir).</p>` +
            '<p>Bu bağlantıyı siz talep etmediyseniz lütfen yok sayın.</p>',
        });
        deliveryStatus = result.delivered ? 'sent' : 'queued';
      } catch (error) {
        deliveryStatus = 'failed';
        deliveryErrorCode = 'email_send_threw';
        this.logger.error(
          JSON.stringify({
            event: 'password_setup_delivery_failed',
            tenantAccountId: input.tenantAccountId,
            tokenId: tokenRecord.id,
            error: error instanceof Error ? error.message : String(error),
          }),
        );
      }
    }

    await this.store.setDeliveryStatus(tokenRecord.id, deliveryStatus, deliveryErrorCode);

    return {
      token: { ...tokenRecord, deliveryStatus, deliveryErrorCode },
      deliveryStatus,
      deliveryErrorCode,
      debugLink: process.env.NODE_ENV !== 'production' ? link : null,
    };
  }

  /**
   * Admin-triggered resend. Validates the tenant still needs a password and
   * delegates to `issueForTenant`, which invalidates the prior active token
   * for the same tenant — so any link still sitting in the partner's inbox
   * (or already phished from there) becomes useless after this call.
   *
   * The application-status gate ('approved'/'active') is enforced at the
   * AdminTenantReviewsService layer; here we only re-check the password
   * envelope so a direct unit-test caller cannot bypass the "password not
   * set yet" check.
   */
  async resendForTenant(input: {
    tenantAccountId: string;
    adminId: string;
  }): Promise<IssuedPasswordSetupToken> {
    const tenant = await this.tenantAccountsStore.findById(input.tenantAccountId);
    if (!tenant) {
      throw new NotFoundException('Tenant account not found for password setup token.');
    }
    if (tenant.account.passwordHash && tenant.account.passwordHash.length > 0) {
      throw new BadRequestException({
        message: 'Bu tenant zaten bir şifre belirlemiş; yeniden gönderim gerekmez.',
        code: 'password_already_set',
      });
    }

    // Per-tenant cooldown — see resendCooldownMs comment. The check runs on
    // the latest token's `createdAt`, not on `deliveryStatus`, so a delivery
    // that failed still costs a cooldown window (otherwise a transport
    // glitch becomes a free retry-spam channel against the partner's inbox).
    const latest = await this.store.findLatestForTenant(input.tenantAccountId);
    if (latest) {
      const elapsedMs = Date.now() - latest.createdAt.getTime();
      if (elapsedMs < this.resendCooldownMs) {
        const retryAfterSeconds = Math.ceil((this.resendCooldownMs - elapsedMs) / 1000);
        throw new BadRequestException({
          message: `Yeniden gönderim için lütfen ${retryAfterSeconds} saniye bekleyin.`,
          code: 'resend_cooldown_active',
          retryAfterSeconds,
        });
      }
    }

    return this.issueForTenant({
      tenantAccountId: input.tenantAccountId,
      createdByAdminId: input.adminId,
      purpose: 'initial_password_setup',
    });
  }

  /**
   * Public-safe summary for the tenant's approved/active screen. Never
   * exposes the token, hash, link, or admin-only metadata — only the
   * delivery outcome (so the partner knows whether to expect an e-mail) and
   * a masked recipient address that lets them confirm we are sending to the
   * right inbox.
   */
  async getPublicSafeSummaryForTenant(tenantAccountId: string): Promise<{
    deliveryStatus: PasswordSetupDeliveryStatus | null;
    sentToEmailMasked: string | null;
    expiresAt: string | null;
    tokenIssued: boolean;
  } | null> {
    const latest = await this.store.findLatestForTenant(tenantAccountId);
    if (!latest) {
      return null;
    }
    return {
      deliveryStatus: latest.deliveryStatus,
      sentToEmailMasked: this.maskEmailForPublic(latest.sentToEmail),
      expiresAt: latest.expiresAt.toISOString(),
      tokenIssued: true,
    };
  }

  /**
   * "alice@example.com" → "a***@e***.com". Keeps enough signal for the
   * partner to recognize their own address without rendering a full PII
   * payload on a public-facing screen.
   */
  private maskEmailForPublic(email: string | null): string | null {
    if (!email) return null;
    const [local, domain] = email.split('@');
    if (!local || !domain) return null;
    const maskedLocal = local.length <= 1 ? `${local}***` : `${local[0]}***`;
    const domainParts = domain.split('.');
    const head = domainParts.shift() ?? '';
    const maskedHead = head.length <= 1 ? `${head}***` : `${head[0]}***`;
    const tail = domainParts.length > 0 ? `.${domainParts.join('.')}` : '';
    return `${maskedLocal}@${maskedHead}${tail}`;
  }

  /**
   * Status check used by the public set-password page so a stale or
   * consumed link shows a meaningful error before the user types anything.
   * Returns NULL when the token cannot be redeemed; the caller maps that
   * to a generic "link geçersiz veya süresi dolmuş" UI without leaking
   * which specific check failed.
   */
  async describeRedeemable(
    rawToken: string,
  ): Promise<{ tenantEmail: string; expiresAt: Date } | null> {
    const tokenHash = this.hashToken(rawToken);
    const record = await this.store.findByTokenHash(tokenHash);
    if (!record || record.consumedAt || record.expiresAt < new Date()) {
      return null;
    }
    const tenant = await this.tenantAccountsStore.findById(record.tenantAccountId);
    if (!tenant) {
      return null;
    }
    return {
      tenantEmail: tenant.account.email,
      expiresAt: record.expiresAt,
    };
  }

  /**
   * Atomically validate the token, set the new password, and mark the token
   * consumed. Any failure path (expired/consumed/missing) collapses into a
   * single 400 with `invalid_or_expired_token` so an attacker cannot
   * distinguish "never existed" from "already used".
   */
  async redeem(rawToken: string, newPassword: string): Promise<{ tenantAccountId: string }> {
    if (typeof newPassword !== 'string' || newPassword.length < 8 || newPassword.length > 100) {
      throw new BadRequestException({
        message: 'Şifre 8-100 karakter olmalıdır.',
        code: 'password_invalid_shape',
      });
    }

    const tokenHash = this.hashToken(rawToken);
    const record = await this.store.findByTokenHash(tokenHash);
    if (!record || record.consumedAt || record.expiresAt < new Date()) {
      throw new BadRequestException({
        message: 'Bu şifre belirleme bağlantısı geçersiz veya süresi dolmuş.',
        code: 'invalid_or_expired_token',
      });
    }

    const tenant = await this.tenantAccountsStore.findById(record.tenantAccountId);
    if (!tenant) {
      throw new BadRequestException({
        message: 'Bu şifre belirleme bağlantısı geçersiz veya süresi dolmuş.',
        code: 'invalid_or_expired_token',
      });
    }

    const hash = await this.passwordService.hash(newPassword);
    await this.tenantAccountsStore.updatePasswordHash(record.tenantAccountId, hash);
    await this.store.markConsumed(record.id, new Date());

    this.logger.log(
      JSON.stringify({
        event: 'password_setup_redeemed',
        tenantAccountId: record.tenantAccountId,
        tokenId: record.id,
        purpose: record.purpose,
      }),
    );

    return { tenantAccountId: record.tenantAccountId };
  }

  private generateRawToken(): string {
    return randomBytes(32).toString('base64url');
  }

  /**
   * HMAC-SHA256 keyed by the configured secret. Previous releases used a
   * concatenated SHA-256 (`secret:raw`); upgrading to HMAC also rotates the
   * keyspace, so any in-flight pre-fix tokens become invalid and the partner
   * must request a fresh link. That is acceptable because 01E has not shipped
   * to production yet.
   */
  private hashToken(rawToken: string): string {
    const secret = this.resolveSecret();
    return createHmac('sha256', secret).update(rawToken).digest('hex');
  }

  private async buildSetupLink(rawToken: string): Promise<string> {
    const baseUrl =
      process.env.TENANT_APP_URL?.trim().replace(/\/$/, '') ||
      'http://localhost:3060';
    return `${baseUrl}/onboarding/set-password/${encodeURIComponent(rawToken)}`;
  }

  private async resolvePlatformName(): Promise<string> {
    const setup = await this.setupStore.getPlatformSetup();
    return setup?.platformName?.trim() || 'Platform';
  }
}
