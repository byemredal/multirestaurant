# Onboarding V2 Compliance Catalog Administration

## Scope

Slice 10.4 adds a small platform-admin management surface for the compliance
catalog introduced in Slice 10.3. It does not introduce final legal content,
replace document uploads, or alter the tenant application approval lifecycle.

## Tenant Production Build Investigation

The tenant production build appeared to hang while an old `next start -p 3065`
process was holding and recreating `apps/tenant/.next`. After pausing only that
verified local tenant runtime and cleaning the generated output, a bounded build
revealed the real failures:

- Production webpack did not resolve the workspace aliases `@`, `@locales`, and
  `@shared`, although editor/type-check configuration recognized them.
- `apps/tenant` did not declare its own `typescript` and `@types/node` build
  dependencies, causing Next to attempt an unsuitable automatic install during
  production build.
- A sandboxed verification run later reached type checking but failed with
  worker/cache `EPERM`; running the same bounded build outside that restriction
  completed successfully.

The minimal fix is:

- Explicit webpack alias configuration in `apps/tenant/next.config.mjs`.
- Explicit tenant development dependencies for `typescript` and `@types/node`.

The completed build still reports a pre-existing Tailwind warning for a broad
`packages/ui/**/*.js` content glob. It is a performance follow-up, not a build
failure.

## Admin API

The admin catalog API is protected by the existing admin authentication and
role guard:

- `GET /admin/compliance-catalog/document-requirements`
- `POST /admin/compliance-catalog/document-requirements`
- `PATCH /admin/compliance-catalog/document-requirements/:id`
- `GET /admin/compliance-catalog/consent-definitions`
- `POST /admin/compliance-catalog/consent-definitions`
- `PATCH /admin/compliance-catalog/consent-definitions/:id`

Review and operations admins may view records. Only super admins may create or
change compliance definitions.

No delete endpoint is exposed. Definitions that should no longer apply are
deactivated with `active=false`.

## Catalog Management Behavior

The admin page at `/system/compliance-catalog` provides two focused sections:

- Document requirements, including country, language, accepted formats,
  guidance-only state, required state, ordering, and active state.
- Consent definitions, including country, language, consent key, label,
  description, document code/version, optional real URL, required state,
  ordering, and active state.

The UI explicitly warns that placeholder definitions require legal and product
review before production use.

Document definitions continue to support the existing safe guidance-only
foundation. Existing document submit validation is not weakened.

## Versioning And Re-Consent

Consent definition identity fields and `documentVersion` cannot be overwritten
through the update endpoint. A new legal-source version must be created as a
new definition, then activated.

When an active consent definition is enabled, other active definitions for the
same `country`, `language`, and `consentKey` are deactivated. Historical
`TenantOnboardingConsentSnapshot` records are never deleted or changed.

Onboarding submission remains valid only when an accepted snapshot exists for
the active required `consentKey + documentVersion`. Therefore activating a new
version automatically requires re-consent.

## Audit Trail

The management endpoints reuse `AdminAuditLogService`. Create and update
operations write audit records with the admin actor, catalog record identity,
and relevant active/version metadata. Snapshot records are separate historical
evidence and are not modified by catalog administration.

## Revision And Resubmission

The existing backend path already distinguishes first submission from
resubmission. For an application in `revision_required`, `resubmit()` invokes
the same `assertReadyForSubmission()` gate, including current required document
checks and active consent-version checks.

The bounded onboarding smoke covers the critical re-consent behavior by making
an older accepted version insufficient, accepting the active version, and then
submitting successfully without request loops. A full authenticated admin
browser sequence that requests revision and returns the tenant to editing is
still a follow-up test scenario; no submit guard has been relaxed in lieu of
that test.

## Remaining Tasks

- Replace seeded placeholder definitions with legally reviewed country/language
  content before production.
- Align country-pack document definitions with strict per-document backend
  enforcement once approved requirements are available.
- Add an authenticated admin-to-tenant revision/resubmission browser test.
- Narrow the tenant Tailwind shared-package content glob to remove its build
  performance warning.
- Consider transactional activation for simultaneous compliance catalog edits
  in a later hardening pass.
