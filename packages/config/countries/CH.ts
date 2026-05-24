/**
 * Switzerland — code-driven country configuration (MVP).
 *
 * To add a country later: create a sibling file (e.g. `DE.ts`) and register
 * it in `./index.ts`. There is intentionally no database-driven country
 * engine and no runtime localization orchestration.
 */
export const CH_CONFIG = {
  country: 'CH',
  locale: 'de-CH',
  currency: 'CHF',
  timezone: 'Europe/Zurich',
};
