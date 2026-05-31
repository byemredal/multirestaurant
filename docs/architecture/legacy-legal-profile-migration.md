# Legacy Legal / Profile Migration — Decisions

- Status: Accepted (Slice 7B); 7C–7E planned
- Date: 2026-05-31
- Sprint: MR-DB-HARDENING-01 (Slice 7)
- Related: `0005_legal_documents.sql`,
  `docs/architecture/admin-role-source-of-truth.md`,
  `apps/api/src/modules/legal-consent/*`

## 1. Context

Five legacy tables predate the canonical legal pipeline:

- `LegalDocument` (setup-seeded baseline)
- `StoreLegalDocument` (+ `StoreLegalDocumentTranslation`)
- `StoreProfileNote` (+ `StoreProfileNoteTranslation`)

The Slice 7A audit established how each is actually used and how it maps to the
canonical model (`LegalDocumentType`, `PlatformLegalDocument`,
`PlatformLegalDocumentVersion`, `StoreTermsAddendum`, `ConsentEvent`,
`OrderLegalAcceptance`). This note records the migration decisions so the
remaining sub-slices stay consistent.

## 2. Decisions

### 2.1 `LegalDocument` is a dead setup write (DONE — Slice 7B)

- `LegalDocument` was written only by `setup.store.ts` during platform
  initialization and had **no runtime reader** anywhere in the codebase.
- **Setup must not seed `LegalDocument` anymore.** Slice 7B removed the
  `INSERT INTO "LegalDocument"` loop and the dead support code
  (`InitializeLegalDocument`, `SeedLegalDocument`, `DEFAULT_LEGAL_DOCUMENTS`,
  the `legalDocuments` initialize field).
- The CountryPack `legalDocuments` **config** (not the DB table) is preserved —
  it still powers the production placeholder-content guard in `setup.service.ts`
  and onboarding/UI default text. It is independent of the removed DB write.
- Canonical platform legal documents are created/managed via the admin
  legal-document API (`AdminLegalDocumentsController` →
  `PlatformLegalDocument` + `PlatformLegalDocumentVersion`). Whether setup should
  *auto-seed* canonical platform docs from the CountryPack is a separate product
  decision deferred to Slice 7E (not required to retire the legacy table).

### 2.2 `StoreProfileNote` is content, not legal (Slice 7C)

- `StoreProfileNote` (`profile` / `story` / `operational`) holds marketing /
  profile copy, **not** legal terms. It must migrate to the **content/profile
  settings** model (e.g. `StoreContentSetting`), **not** to any legal canonical
  table. Do not route it through `ConsentEvent` / `OrderLegalAcceptance`.
- Only consumer today: the admin tenant-review surface
  (`admin-tenant-reviews.service` overview read + admin edit). Response shape
  (`profileNotes`) should be preserved while the source moves to content.

### 2.3 `StoreLegalDocument` → `StoreTermsAddendum` (Slice 7D)

- `StoreLegalDocument` (`terms_and_conditions` / `privacy_notice` /
  `distance_sales`) is store-scoped legal text → canonical target is
  `StoreTermsAddendum`.
- **Constraint:** `StoreTermsAddendum.parentDocumentVersionId` is a required FK
  to a `PlatformLegalDocumentVersion`. So each legacy store document type must
  map to a **published** platform document version. If the matching platform
  doc/version does not exist, the mapping cannot be created — 7D must resolve
  this (publish/seed the platform parents first, or block with a clear error).
- Only consumer today: admin tenant-review (overview read + admin edit). Keep
  the `legalDocuments` response shape; change the source to addenda.

### 2.4 No legacy DROP yet (Slice 7E)

- Do **not** drop any legacy table (`LegalDocument`, `StoreLegalDocument`,
  `StoreLegalDocumentTranslation`, `StoreProfileNote`,
  `StoreProfileNoteTranslation`) until **all** consumers are migrated and
  verified. DROP + any optional canonical setup-seed is a separate final slice
  (7E), forward-only and after a read-only production data check.

## 3. Must-not-change (all of Slice 7)

- Checkout legal readiness (`getCheckoutLegalReadiness` +
  `REQUIRED_CHECKOUT_DOCUMENT_CODES`).
- `OrderLegalAcceptance`, `ConsentEvent`, `MarketingConsent` semantics.
- Current-version resolution (`supersededAt IS NULL`) and its partial index.
- `FileAsset` visibility (Slice 3), public storefront (Slice 1/1B),
  staff/store/tenant invariant (Slice 2), payment/order logic (Slice 5).

## 4. Test expectations

- Slice 7B: setup initialization no longer writes `INSERT INTO "LegalDocument"`
  and still completes normally; CountryPack placeholder guard still fires.
- Slice 7C/7D: admin review read/write goes through content / `StoreTermsAddendum`
  while preserving response shapes; checkout readiness unchanged.
- Slice 7E: static migration test for any backfill/DROP; no data mutation beyond
  the documented forward backfill.

## 5. Sequencing

1. **7B (done)** — remove dead `LegalDocument` setup write (code-only, no migration).
2. **7C** — `StoreProfileNote` → content/profile settings.
3. **7D** — `StoreLegalDocument` → `StoreTermsAddendum` (needs platform parent
   versions).
4. **7E** — verified legacy DROP (+ optional canonical setup-seed).
