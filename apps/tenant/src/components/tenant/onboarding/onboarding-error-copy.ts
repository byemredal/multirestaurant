import { TenantOnboardingSessionError } from '@/lib/tenant-onboarding-client';

/**
 * Pure mapping from an onboarding load/resolve failure to user-facing Turkish
 * copy. Kept dependency-free so it is trivially unit-testable and reusable by
 * the workspace error card and the resolve hook.
 *
 * The golden rule: a raw technical string (`tenant_onboarding_session_failed_403`,
 * `Invalid state token.`, `Forbidden`, an HTTP status, …) must NEVER reach the
 * partner. Anything we do not explicitly recognise as a friendly human message
 * collapses to the generic "link no longer valid" copy.
 */
export type OnboardingErrorKind = 'invalid' | 'approved' | 'revision' | 'generic';

export type OnboardingErrorCopy = {
  kind: OnboardingErrorKind;
  message: string;
};

const INVALID_LINK_MESSAGE =
  'Bu başvuru bağlantısı artık geçerli değil. Yeni başvuru başlatabilir veya destek ekibiyle iletişime geçebilirsiniz.';
const APPROVED_MESSAGE =
  'Başvurunuz onaylandı. Giriş bilgilerinizi kontrol edin veya giriş ekranına geçin.';
const REVISION_MESSAGE =
  'Başvurunuz için revizyon istendi. Lütfen istenen belgeleri güncelleyin.';
const GENERIC_MESSAGE = 'Başvuru bilgileri yüklenemedi. Lütfen sayfayı yenileyip tekrar deneyin.';

// Statuses where the link is structurally dead for further work.
const INVALID_LINK_STATUSES = new Set([403, 404, 410, 423]);

// Any string that still looks like an internal error code / English technical
// phrase. These must be swallowed rather than rendered verbatim.
const RAW_TECHNICAL_PATTERN =
  /^(tenant_onboarding_|onboarding_session_|forbidden$|invalid state token|unauthorized$|not found$)/i;

function isRawTechnicalString(value: string | null | undefined): boolean {
  if (!value) {
    return true;
  }
  return RAW_TECHNICAL_PATTERN.test(value.trim());
}

/**
 * Resolve the best user-facing copy for an onboarding error. Accepts the raw
 * thrown value (Error / TenantOnboardingSessionError / unknown).
 */
export function mapOnboardingErrorCopy(error: unknown): OnboardingErrorCopy {
  const code =
    error instanceof TenantOnboardingSessionError ? error.code : null;
  const status =
    error instanceof TenantOnboardingSessionError ? error.status : null;
  const rawMessage = error instanceof Error ? error.message : null;

  if (code === 'onboarding_application_approved' || code === 'onboarding_application_active') {
    return { kind: 'approved', message: APPROVED_MESSAGE };
  }

  if (code === 'onboarding_revision_required') {
    return { kind: 'revision', message: REVISION_MESSAGE };
  }

  if (
    code === 'onboarding_session_invalid' ||
    code === 'onboarding_session_expired' ||
    code === 'onboarding_session_terminal' ||
    (status != null && INVALID_LINK_STATUSES.has(status)) ||
    (rawMessage != null && /tenant_onboarding_(session|workspace)_failed/.test(rawMessage))
  ) {
    return { kind: 'invalid', message: INVALID_LINK_MESSAGE };
  }

  // Fall back to the backend message ONLY when it is already a human sentence;
  // otherwise never surface a raw code/technical phrase.
  if (rawMessage && !isRawTechnicalString(rawMessage)) {
    return { kind: 'generic', message: rawMessage };
  }

  return { kind: 'generic', message: GENERIC_MESSAGE };
}

/** Convenience: just the message string. */
export function mapOnboardingErrorMessage(error: unknown): string {
  return mapOnboardingErrorCopy(error).message;
}
