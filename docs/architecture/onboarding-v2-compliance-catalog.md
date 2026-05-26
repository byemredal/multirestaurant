# Onboarding V2 Compliance Catalog

## Scope

Slice 10.3 keeps the existing state-token session contract, document lifecycle,
consent snapshot lifecycle, and submit/admin review lifecycle intact. It adds a
replaceable source for onboarding document guidance and consent definitions.
Content seeded in this slice is placeholder content and requires product/legal
review before production use.

## Catalog Source Strategy

The active onboarding compliance catalog is now read from:

- `ComplianceDocumentRequirement`
- `ComplianceConsentDefinition`

Both records are scoped by `country` and `language`, carry `active` and
`sortOrder` fields, and can later be managed by setup/admin tooling without
changing the onboarding page components. `ComplianceConsentDefinition` also
stores the versioned legal-source metadata (`documentCode`, `documentVersion`,
optional `documentUrl`).

Migration `0014_onboarding_compliance_catalog.sql` seeds safe placeholder
`CH` / `de-CH` definitions. No final Swiss document or legal requirement is
asserted by these records.

## Fallback Behavior

`TenantOnboardingService.resolveComplianceCatalog()` reads active database
records first. When no active document or consent records exist for the
application country/language, that collection falls back to the existing
code-backed placeholder catalog. This preserves onboarding for unconfigured
countries while making the managed catalog the preferred source.

Document validation remains intentionally unchanged: submission still requires
at least one current required uploaded document. The catalog document list is
guidance until product/legal rules define enforceable per-type requirements.

## Versioned Consents And Re-Consent

Consent snapshots remain append-friendly records in
`TenantOnboardingConsentSnapshot`. A current required consent is satisfied only
when an accepted snapshot matches both:

- the active `consentKey`
- the active `documentVersion`

If an older accepted snapshot exists for the same key, the active consent is
reported as `reacceptanceRequired` and remains missing until the user accepts
the new active version. Historical accepted snapshots are not removed or
silently overwritten.

The review screen displays the active document code and version and displays a
source link only if `documentUrl` is configured. It does not invent legal
links.

## Admin Visibility

The existing admin application detail response now includes:

- all stored onboarding consent snapshots
- active consent status resolved from the current catalog
- missing active required consent keys

The admin application modal and tenant workspace show active version,
language, accepted timestamp, and re-consent status. Document files and the
existing approve/reject/revision actions are unchanged.

## Revision And Resubmission

The existing `revision_required` application lifecycle remains in control.
Editable revision states continue to use the same session resolve and submit
validation; therefore a later active consent version naturally blocks
resubmission until accepted.

## Remaining Work

- Add setup/admin CRUD screens and audit logging for compliance catalog records.
- Replace placeholder seeds with reviewed country/language-specific content.
- Define and enforce per-document-type submission requirements when approved.
- Add a dedicated automated version-change/resubmission fixture when the test
  database lifecycle supports temporary catalog mutations cleanly.
