import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { createTransport, type Transporter } from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

// Implemented transports. Earlier releases enumerated 'sendgrid' / 'mailgun' /
// 'ses' but the send path was a stub for those, which produced silent fake
// successes in production. Until those adapters are real we keep the enum
// limited to what actually works.
export type EmailTransport = 'log' | 'smtp';

export type EmailSendResult = {
  delivered: boolean;
  transport: EmailTransport;
  stub: boolean;
};

interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  secure: boolean;
  fromAddress: string;
  fromName: string | null;
}

@Injectable()
export class EmailService implements OnModuleInit {
  private readonly logger = new Logger(EmailService.name);
  private smtpTransporter: Transporter<SMTPTransport.SentMessageInfo> | null = null;
  private smtpConfig: SmtpConfig | null = null;
  private smtpInitError: string | null = null;

  onModuleInit() {
    // Build the transporter once at boot. A misconfiguration is a config
    // event, not a per-request runtime concern — we record it and fall
    // through to stub behavior so downstream code can ask `isStubTransport()`
    // and decide whether to refuse (phone OTP) or record `unavailable`
    // (password setup) without re-validating env on every send.
    if (this.resolveTransportFromEnv() === 'smtp') {
      const cfg = this.readSmtpConfigFromEnv();
      if (!cfg) {
        return;
      }
      try {
        this.smtpTransporter = createTransport({
          host: cfg.host,
          port: cfg.port,
          secure: cfg.secure,
          auth: { user: cfg.user, pass: cfg.password },
        });
        this.smtpConfig = cfg;
        this.logger.log(
          JSON.stringify({
            event: 'email_transport_ready',
            transport: 'smtp',
            host: cfg.host,
            port: cfg.port,
            secure: cfg.secure,
          }),
        );
      } catch (error) {
        this.smtpInitError = error instanceof Error ? error.message : String(error);
        this.logger.error(
          JSON.stringify({
            event: 'email_transport_init_failed',
            transport: 'smtp',
            error: this.smtpInitError,
          }),
        );
      }
    }
  }

  /**
   * Public selector: what does the operator INTEND to use? Useful for
   * banners that want to distinguish "ops chose log" (dev mode) from
   * "ops chose smtp but config is broken" (production misconfig).
   */
  resolveTransport(): EmailTransport {
    return this.resolveTransportFromEnv();
  }

  private resolveTransportFromEnv(): EmailTransport {
    const raw = (process.env.EMAIL_TRANSPORT ?? 'log').toLowerCase();
    return raw === 'smtp' ? 'smtp' : 'log';
  }

  /**
   * True when no real delivery channel is wired — either operator chose
   * 'log', or 'smtp' was selected but config is missing/broken so we
   * degraded to the log path. Callers MUST treat this as "the partner did
   * NOT receive an e-mail" and decide their own UX (refuse vs. record
   * `unavailable`).
   */
  isStubTransport(): boolean {
    if (this.resolveTransportFromEnv() === 'log') {
      return true;
    }
    return this.smtpTransporter === null;
  }

  /**
   * Operator-facing summary. Returned ONLY in server logs and admin debug
   * paths — never to the public/tenant frontend.
   */
  describeTransport(): {
    requested: EmailTransport;
    effective: EmailTransport;
    initError: string | null;
    fromAddress: string | null;
  } {
    const requested = this.resolveTransportFromEnv();
    const effective: EmailTransport =
      requested === 'smtp' && this.smtpTransporter ? 'smtp' : 'log';
    return {
      requested,
      effective,
      initError: this.smtpInitError,
      fromAddress: this.smtpConfig?.fromAddress ?? null,
    };
  }

  async send(message: EmailMessage): Promise<EmailSendResult> {
    const requested = this.resolveTransportFromEnv();

    if (requested === 'smtp' && this.smtpTransporter && this.smtpConfig) {
      const from = this.smtpConfig.fromName
        ? `${this.smtpConfig.fromName} <${this.smtpConfig.fromAddress}>`
        : this.smtpConfig.fromAddress;
      const info = await this.smtpTransporter.sendMail({
        from,
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html,
      });
      // nodemailer surfaces SMTP-level acceptance via the accepted/rejected
      // arrays. We treat "to was accepted" as delivered=true; anything else
      // (e.g. greylist deferral that returned no accepted entry) is
      // delivered=false so downstream callers (phone OTP / password setup)
      // can apply their own provider-deferred handling.
      const accepted = Array.isArray(info.accepted)
        ? (info.accepted as Array<string | { address?: string }>)
            .map((value) =>
              typeof value === 'string'
                ? value.toLowerCase()
                : value?.address?.toLowerCase() ?? '',
            )
            .filter((value): value is string => value.length > 0)
        : [];
      const delivered = accepted.includes(message.to.toLowerCase());
      this.logger.log(
        JSON.stringify({
          event: 'email_smtp_dispatched',
          to: message.to,
          subject: message.subject,
          messageId: info.messageId ?? null,
          accepted: accepted.length,
          rejected: Array.isArray(info.rejected) ? info.rejected.length : 0,
          delivered,
        }),
      );
      return { delivered, transport: 'smtp', stub: false };
    }

    if (requested === 'smtp' && !this.smtpTransporter) {
      // Operator INTENDED SMTP but config is missing/broken. Log loudly so a
      // dashboard alert can fire; return the stub envelope so callers know
      // delivery did not happen.
      this.logger.error(
        JSON.stringify({
          event: 'email_smtp_unavailable_fallback_log',
          to: message.to,
          subject: message.subject,
          initError: this.smtpInitError,
        }),
      );
      return { delivered: false, transport: 'log', stub: true };
    }

    // requested === 'log'. In production this is the wrong setting — log an
    // error so an alert pipeline can pick it up — but we don't throw; the
    // bootstrap and the caller's own fail-closed checks (phone OTP refuses,
    // password setup records `unavailable`) are the real safeguards.
    if (process.env.NODE_ENV === 'production') {
      this.logger.error(
        JSON.stringify({
          event: 'email_transport_log_in_production',
          to: message.to,
          subject: message.subject,
        }),
      );
    } else {
      this.logger.log(
        JSON.stringify({
          event: 'email_queued',
          transport: 'log',
          to: message.to,
          subject: message.subject,
          text: message.text,
        }),
      );
    }

    return { delivered: false, transport: 'log', stub: true };
  }

  private readSmtpConfigFromEnv(): SmtpConfig | null {
    const host = process.env.SMTP_HOST?.trim();
    const portRaw = process.env.SMTP_PORT?.trim();
    const user = process.env.SMTP_USER?.trim();
    const password = process.env.SMTP_PASSWORD;
    const fromAddress = process.env.EMAIL_FROM_ADDRESS?.trim();
    const fromName = process.env.EMAIL_FROM_NAME?.trim() || null;
    const secureRaw = process.env.SMTP_SECURE?.trim().toLowerCase();

    const port = portRaw ? Number.parseInt(portRaw, 10) : Number.NaN;
    const missing: string[] = [];
    if (!host) missing.push('SMTP_HOST');
    if (!Number.isFinite(port) || port <= 0) missing.push('SMTP_PORT');
    if (!user) missing.push('SMTP_USER');
    if (!password) missing.push('SMTP_PASSWORD');
    if (!fromAddress) missing.push('EMAIL_FROM_ADDRESS');

    if (missing.length > 0) {
      this.smtpInitError = `missing_env:${missing.join(',')}`;
      this.logger.error(
        JSON.stringify({
          event: 'email_smtp_config_missing',
          missing,
        }),
      );
      return null;
    }

    const secure =
      secureRaw === 'true' ? true : secureRaw === 'false' ? false : port === 465;

    return {
      host: host!,
      port,
      user: user!,
      password: password!,
      secure,
      fromAddress: fromAddress!,
      fromName,
    };
  }
}
