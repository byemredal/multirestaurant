# ADR — Country Pack / Platform Schema System

- Status: Proposed
- Date: 2026-05-25
- Sprint: MR-ARCH-03
- Related: `ADR-architecture-reset-track.md`, `packages/config/`, migrations 0010, 0013, 0015, 0016

## 1. Context

Today's country handling is split across three layers:

- **Code-driven config** at `packages/config/countries/` — only `CH` exists.
  Each country is a tiny `{ country, locale, currency, timezone }` object.
  Comments explicitly say "there is intentionally no database-driven country
  engine."
- **`PlatformSetup` (0013/0015)** — single-row DB table; pinned via
  `CHECK("id" = 'platform')`. Records `primaryCountry`, `defaultLanguage`,
  `defaultCurrency`, `defaultTimezone`.
- **Legal documents (0010, 0016)** — three systems coexist: an immutable
  versioned `PlatformLegalDocument` pipeline (with `audience`, `locale`),
  a deprecated `StoreLegalDocument`, and a minimal `LegalDocument` seeded at
  setup with `countryCode CHAR(2)`.

What's missing:

- A single answer to "what is *the* country pack for this deployment?"
- Country-aware defaults for: tax/VAT, IBAN/bank validation, phone/OTP
  policy, onboarding required documents, address fields, billing/invoice
  fields.
- A clean place for terminology (handled in `ADR-terminology-mapping.md`).

We deliberately want to avoid building a no-code schema engine.

## 2. Decision

Define a small, **bounded** country pack with two layers:

### 2.1 Code-driven pack (compile-time)

`packages/config/countries/<CODE>.ts` exports a `CountryPack` object. The
shape is fixed by TypeScript — no JSON schema engine, no dynamic field
builder.

```ts
export interface CountryPack {
  country: 'CH' | 'TR' | 'DE';   // ISO-3166 alpha-2; literal union, not string
  locale: string;                 // BCP47, e.g. 'de-CH', 'tr-TR'
  currency: string;               // ISO-4217, e.g. 'CHF', 'TRY'
  timezone: string;               // IANA, e.g. 'Europe/Zurich'
  phone: {
    e164Country: string;          // '+41'
    otpProvider: 'twilio' | 'mock';
    otpLength: 4 | 6;
  };
  tax: {
    label: 'VAT' | 'KDV';
    defaultRate: number;          // 7.7 for CH, 10 for TR (sample)
    rateChoices: number[];
    pricesIncludeTaxByDefault: boolean;
  };
  bank: {
    accountKind: 'IBAN' | 'IBAN_OR_ACCOUNT';
    ibanCountryCode: string;      // 'CH', 'TR'
    requireSwift: boolean;
  };
  address: {
    requirePostalCode: boolean;
    postalCodeRegex: string;      // serializable
    stateOrCanton: 'state' | 'canton' | 'province' | 'none';
  };
  invoicing: {
    legalNameField: 'companyName' | 'merchantName';
    requireTaxId: boolean;
    taxIdLabel: 'UID' | 'VKN' | 'VAT-ID';
  };
  onboarding: {
    requiredDocuments: string[];  // codes resolved from LegalDocumentType
  };
  terminology: TerminologyOverrides; // see ADR-terminology-mapping
}
```

The registry stays in `packages/config/countries/index.ts`. Adding a country
is **a new file + one registry line**.

### 2.2 DB-persisted installation profile (runtime)

A single-row table `InstallationProfile` captures *which* pack this deployment
runs and the values that were active when setup happened.

```sql
CREATE TABLE "InstallationProfile" (
  "id" TEXT PRIMARY KEY DEFAULT 'install' CHECK ("id" = 'install'),
  "countryCode" CHAR(2) NOT NULL,
  "locale" VARCHAR(16) NOT NULL,
  "currencyCode" VARCHAR(8) NOT NULL,
  "timezone" VARCHAR(64) NOT NULL,
  "packVersion" VARCHAR(32) NOT NULL,    -- e.g. 'CH-1', for future migrations
  "initializedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "initializedByAdminId" UUID REFERENCES "AdminAccount"("id") ON DELETE SET NULL
);
```

Rules:

- Set exactly once during `apps/setup` flow.
- Read-only at runtime via a cached service. Anything that needs a country
  default reads from here, **not** by re-resolving `packages/config` on every
  request.
- Replaces / consolidates `PlatformSetup` + `SystemSetting` for country values.

### 2.3 Legal documents (consolidated)

- Keep `LegalDocumentType` (system taxonomy) and
  `PlatformLegalDocument` + `PlatformLegalDocumentVersion` from 0010 — that
  pipeline already supports `audience` ('customer'/'tenant'/'all') and
  `locale`. Add `countryCode CHAR(2)` to `PlatformLegalDocumentVersion`.
- **Drop** the parallel `LegalDocument` (0016) and `StoreLegalDocument`
  (0007) in the rebase. Setup seeds versions of `PlatformLegalDocument`
  directly with `countryCode` + `locale` + `versionLabel`.
- Store-specific add-ons stay in `StoreTermsAddendum` (already in 0010).

The result: one legal-doc system, country/locale/version aware, immutable.

### 2.4 Tax / VAT

`StoreTaxSetting` (already in 0007) gains a `taxLabel VARCHAR(8)` and is
seeded from the country pack's `tax.label`. The default rate is the pack's
`tax.defaultRate`. Per-store overrides remain possible.

### 2.5 Address & bank validation

The country pack's regexes/labels feed both DTO validation (server) and form
hints (client). The client reads them from a public `GET /v1/platform/pack`
endpoint that returns a **subset** of the pack safe for clients (no
secrets / provider keys). The server enforces validation using the same pack.

### 2.6 Phone / OTP

Provider is selected by `pack.phone.otpProvider`. `'mock'` is required for
non-prod and lets us test Switzerland behavior from Turkey (see §6).

## 3. What we explicitly do not build

- A "country builder" admin UI.
- A JSON-schema engine for dynamic forms.
- A runtime country-switch toggle (multi-country single deployment).
- Plug-in/extension SDK for third-party country packs.

If a future country needs anything outside the `CountryPack` interface, the
interface grows in TypeScript — no schema engine.

## 4. Migration plan (lands in MR-ARCH-01)

- New file: `0010_country_and_legal.sql`
  - `InstallationProfile` (replaces `PlatformSetup`).
  - `LegalDocumentType`, `PlatformLegalDocument`,
    `PlatformLegalDocumentVersion` (add `countryCode`).
  - `ConsentEvent`, `MarketingConsent`, `OrderLegalAcceptance`,
    `StoreTermsAddendum`.
  - Drop intermediate `LegalDocument` and `StoreLegalDocument`.

## 5. API surface (added to `api-groups.ts` in MR-ARCH-03)

- `GET /v1/platform/pack` — public; returns client-safe pack snapshot.
- `GET /v1/platform/legal/:typeCode` — current published version for the
  install's country + locale.
- Setup endpoints unchanged in surface, but body now persists into
  `InstallationProfile` instead of `PlatformSetup`.

## 6. Testing Switzerland from Turkey (MVP requirement)

- Local env loads `CH` pack by default.
- `pack.phone.otpProvider = 'mock'` returns a deterministic OTP (e.g.
  `000000`) and logs to console.
- Seed script `pnpm setup:seed -- --country=CH` initializes
  `InstallationProfile` + legal doc versions + currency seed.
- Equivalent seed for `--country=TR`.
- Stripe stays in sandbox; payments service uses test keys.

## 7. Deployment model

**One deployment per country.** Each country gets:

- A separate database with its own `InstallationProfile` row.
- The same codebase, different env (e.g. `INSTALL_COUNTRY=CH`).
- Its own legal docs (seeded by setup), currency, locale.

Trade-off considered (rejected for MVP): **shared multi-country deployment**
with `countryCode` on every row. Rejected because:

- It forces every query to be country-scoped — leak risk at every endpoint.
- Bank/payment provider integrations differ per country and don't multiplex
  well.
- Legal/tax compliance is per-country; a regulator audit is easier per-DB.

Future option (not built now): if we ever need multi-country *single*
deployment, the path is to add `countryCode` to tenant/store rows and gate
queries — but the install table already proves we currently assume one.

## 8. Risks

- **Pack drift between code and DB.** Mitigation: `packVersion` column;
  startup logs a warning when code pack version > DB pack version, and
  blocks startup if code is older than DB.
- **Legal doc consolidation breaks existing seeds.** Mitigation: rebase ships
  fresh seeds; we are pre-production.
- **Hidden assumption "CH only" in code.** Mitigation: MR-ARCH-03 includes a
  grep audit for hard-coded `'CHF'` / `'de-CH'` / `'+41'` outside the pack.
