import { SUPPORTED_COUNTRY_CODES } from '@lieferzonen/config';

/**
 * Countries the bootstrap wizard can target. Sourced from the typed
 * CountryPack registry so the setup DTO and the code-driven packs cannot
 * drift — adding a country file in `packages/config/countries` automatically
 * widens the wizard.
 */
export const SUPPORTED_SETUP_COUNTRIES = SUPPORTED_COUNTRY_CODES;

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

// NOTE (MR-DB-HARDENING-01 Slice 7B): the legacy SeedLegalDocument type and
// DEFAULT_LEGAL_DOCUMENTS constant were removed — they fed the now-deleted
// dead write into the legacy "LegalDocument" table. Canonical platform legal
// docs are managed via the admin legal-document API. See
// docs/architecture/legacy-legal-profile-migration.md.
