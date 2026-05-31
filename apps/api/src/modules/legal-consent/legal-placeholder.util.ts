/**
 * Centralized placeholder/draft/test-content detection for the CANONICAL
 * platform legal pipeline (PlatformLegalDocumentVersion).
 *
 * Shared by:
 *   - getCheckoutLegalReadiness() — refuse to mark checkout ready while a
 *     required document still carries placeholder text.
 *   - publishVersion() — refuse to publish placeholder content in production.
 *
 * This mirrors the env semantics already used by the setup wizard
 * (SetupService) and partner onboarding (assertProductionConsentContent):
 * the guard is enforced in production and bypassable with the existing
 * ALLOW_PLACEHOLDER_LEGAL_CONTENT flag for local production bootstrap.
 */

/**
 * Patterns that signal a legal document is unreviewed placeholder / draft /
 * test content rather than production-ready legal text. The single ambiguous
 * words (draft/example/sample/dummy/todo/fixme) are word-boundary anchored to
 * limit false positives; the multi-word phrases are the strong signals.
 */
export const PLACEHOLDER_LEGAL_CONTENT_PATTERN =
  /placeholder|lorem ipsum|taslak|\bdraft\b|test document|\bexample\b|örnek metin|üretime geçmeden önce|hukuk ekibi tarafından doğrulanmal|\bTODO\b|\bFIXME\b|\bdummy\b|\bsample\b|non-production|production de/i;

/**
 * True when ANY of the supplied content fields (title / body / versionLabel /
 * summary) looks like placeholder content. Null/empty fields are ignored.
 */
export function containsPlaceholderLegalContent(
  ...values: Array<string | null | undefined>
): boolean {
  const haystack = values
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
    .join('  ');
  if (!haystack) return false;
  return PLACEHOLDER_LEGAL_CONTENT_PATTERN.test(haystack);
}

/**
 * Whether placeholder legal content must be BLOCKED in the current runtime.
 *   - bypassed entirely when ALLOW_PLACEHOLDER_LEGAL_CONTENT=true
 *   - otherwise enforced only in production
 *   - never enforced in dev/test, so fixtures keep placeholder text usable
 */
export function placeholderLegalGuardEnforced(): boolean {
  if (process.env.ALLOW_PLACEHOLDER_LEGAL_CONTENT === 'true') {
    return false;
  }
  return process.env.NODE_ENV === 'production';
}
