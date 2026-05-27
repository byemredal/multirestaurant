# Notification Transport

Operator-facing reference for how the Lieferzonen API delivers transactional
e-mail (phone verification OTP, post-approval password setup magic link).

## TL;DR

- `EMAIL_TRANSPORT=log` — local development only. No e-mail is sent; payload
  is logged to stdout. Production callers treat this as a stub (refuse for
  phone OTP, record `deliveryStatus=unavailable` for password setup).
- `EMAIL_TRANSPORT=smtp` — real delivery via nodemailer + SMTP. Requires the
  SMTP env block below.
- `sendgrid` / `mailgun` / `ses` are NOT implemented. Selecting them falls
  back to the log path with an error log.

## Env block

```env
# 'log' or 'smtp'
EMAIL_TRANSPORT=log
EMAIL_FROM_ADDRESS=
EMAIL_FROM_NAME=
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
SMTP_SECURE=false

# Per-tenant resend cooldown (ms). Default 60000. Clamped to [10000, 600000].
PASSWORD_SETUP_RESEND_COOLDOWN_MS=60000

# HMAC secret for password setup tokens. Required in production; falls back
# to JWT_SECRET, then a dev-only literal in non-production.
PASSWORD_SETUP_TOKEN_SECRET=
```

`SMTP_SECURE` rules:

- `true` → TLS on connect (port 465).
- `false` → STARTTLS upgrade (port 587).
- Unset → inferred from port: 465 → true, anything else → false.

## Behavior matrix

| `EMAIL_TRANSPORT` | SMTP env complete? | `NODE_ENV=production` | Behavior |
|---|---|---|---|
| `log` | n/a | no | Payload logged to stdout. `isStubTransport()`=true. |
| `log` | n/a | yes | Error log `email_transport_log_in_production`; payload not sent. Phone OTP returns 503 `otp_provider_unavailable`. Password setup records `deliveryStatus=unavailable`. |
| `smtp` | yes | any | Real SMTP send via nodemailer. `isStubTransport()`=false. `accepted` SMTP response → `deliveryStatus=sent`; otherwise `queued`. |
| `smtp` | no | any | `email_smtp_config_missing` on boot; `isStubTransport()`=true; per-send `email_smtp_unavailable_fallback_log`. Phone OTP and password setup behave as the `log`/production row. |

## Failure semantics

- **Phone OTP (tenant onboarding)** is fail-loud: with a stub transport in
  production, `sendPhoneVerificationCode` throws 503
  `otp_provider_unavailable`. The UI surfaces a retry/contact-support
  message — never a hidden "code is on its way" lie.
- **Password setup magic link (post-approval)** is fail-honest: the token is
  still issued and persisted, but the delivery summary in the response and
  on the tenant approved screen reflects the actual outcome
  (`sent` / `queued` / `failed` / `unavailable`). Admins resend through the
  `Şifre bağlantısını yeniden gönder` button when delivery did not succeed.

## Resend cooldown

`POST /admin/tenant-applications/:id/password-setup/resend` enforces a
per-tenant cooldown based on the latest token's `createdAt` (regardless of
delivery outcome). Within the window, the endpoint returns `400` with
`code=resend_cooldown_active` and `retryAfterSeconds` so the admin UI can
show a wait-time banner.

Cooldown is tunable via `PASSWORD_SETUP_RESEND_COOLDOWN_MS`; the value is
clamped server-side to `[10s, 10min]` so a misconfigured `0` cannot disable
the guard and a multi-hour value cannot lock partners out for an entire
support window.

## Logs to monitor

| Event | Severity | When |
|---|---|---|
| `email_transport_ready` | info | SMTP transporter built at boot. |
| `email_transport_init_failed` | error | nodemailer threw during `createTransport`. |
| `email_smtp_config_missing` | error | `EMAIL_TRANSPORT=smtp` but required env vars are blank. |
| `email_smtp_dispatched` | info | A message was handed to the SMTP server. Check `delivered`. |
| `email_smtp_unavailable_fallback_log` | error | A send fell through to log because SMTP isn't initialized. |
| `email_transport_log_in_production` | error | A send used `log` while `NODE_ENV=production`. |
| `password_setup_link_issued` | audit | Admin approved → token issued. |
| `password_setup_link_resent` | audit | Admin clicked resend. |
| `password_setup_delivery_failed` | error | SMTP send threw. |
| `password_setup_delivery_unavailable` | warn | Token issued but transport was stub. |

## Out of scope (today)

- SMS delivery (e.g. for phone OTP without the e-mail fallback) — no SMS
  provider is wired; phone codes are delivered by e-mail.
- SendGrid / Mailgun / SES adapters.
- Queue-backed (BullMQ/Kafka) async delivery — sends are inline.
- Password reset (only initial password setup).
