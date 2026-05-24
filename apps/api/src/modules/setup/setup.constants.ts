/**
 * Countries the bootstrap wizard can target. The platform launches with
 * Switzerland only; the list is intentionally a simple array so additional
 * countries can be appended later without a schema or engine change.
 */
export const SUPPORTED_SETUP_COUNTRIES = ['CH'] as const;

export type SupportedSetupCountry = (typeof SUPPORTED_SETUP_COUNTRIES)[number];

/** Platform bootstrap lifecycle states. */
export enum SystemState {
  UNINITIALIZED = 'UNINITIALIZED',
  INITIALIZING = 'INITIALIZING',
  READY = 'READY',
}

/**
 * How long an INITIALIZING claim is trusted before it is treated as stale.
 * This is the safety net that stops a crashed init from locking setup
 * forever — no distributed locking, just a timestamp check.
 */
export const INITIALIZING_STALE_MS = 2 * 60 * 1000;

/** Header carrying the bootstrap key on protected setup requests. */
export const BOOTSTRAP_KEY_HEADER = 'x-bootstrap-key';

/** Shape of a legal document seeded during initialization. */
export interface SeedLegalDocument {
  type: string;
  version: string;
  content: string;
}

/**
 * Baseline legal documents created when the platform is initialized. These
 * are intentionally minimal placeholders — replace the content before going
 * live. The `countryCode` is applied at seed time from the primary country.
 */
export const DEFAULT_LEGAL_DOCUMENTS: SeedLegalDocument[] = [
  {
    type: 'terms_of_service',
    version: '1.0',
    content:
      'Terms of Service (placeholder). This baseline document was created ' +
      'during platform setup and must be reviewed and replaced with the ' +
      'final legal text before the platform goes live.',
  },
  {
    type: 'privacy_policy',
    version: '1.0',
    content:
      'Privacy Policy (placeholder). This baseline document was created ' +
      'during platform setup and must be reviewed and replaced with the ' +
      'final legal text before the platform goes live.',
  },
];
