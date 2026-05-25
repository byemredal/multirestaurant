# Onboarding V2 Documents And Consent Foundation

## Scope

Slice 10.2 extends the custom verification and review pages without changing state-token resolution or the application review lifecycle.

- Document upload still persists `TenantDocument`.
- Consent acceptance is now persisted as an application-scoped snapshot.
- Review remains the submit surface; no separate consent route is introduced.

## Country-Pack Document Guidance

`tenant-onboarding-compliance-catalog.ts` provides country/language-aware placeholder document definitions. The verification page reads these definitions through:

`GET /v2/tenant/onboarding/:stateToken/consents`

Document entries are guidance-only in this slice. Their labels and descriptions may later be replaced by reviewed requirements from platform setup/country packs.

The backend submission rule is deliberately unchanged:

- at least one current required `TenantDocument` must exist before submission.

The UI displays this rule separately from the placeholder catalog and does not claim that every displayed placeholder category is enforced.

## Consent Snapshots

Required review acknowledgements are returned by the same compliance endpoint and accepted through:

`POST /v2/tenant/onboarding/:stateToken/consents`

Accepted values are stored in `TenantOnboardingConsentSnapshot` with:

- application and consent key
- label snapshot
- placeholder document code and version
- language
- accepted timestamp
- nullable IP address and user agent fields reserved for a reviewed capture policy

The table key includes the consent document version so later legal-copy versions do not silently replace a historical acceptance.
Once a consent version is accepted, submitting the same key/version again leaves the original acceptance timestamp intact.

## Review And Submit

`ReviewStep` renders the required acknowledgements as checkboxes. Selecting boxes alone is local draft state; the user must save them before submit is allowed.

Backend submit validation now requires:

- the previously required onboarding progress and current required document
- an accepted snapshot for each current required onboarding consent definition

This strengthens the existing submit gate; it does not bypass document validation or introduce a second submission lifecycle.

## Legal Placeholder Warning

The current acknowledgement copy and document definitions are scaffolding copy only. They are not reviewed Swiss legal terms or final production requirements. Country setup must later provide reviewed texts, links, versioned document sources, and any necessary capture metadata policy.

## Validation

The bounded browser smoke flow covers:

1. Review reports missing documents.
2. Custom verification renders country-pack guidance.
3. Upload returns to review only after backend success.
4. Submit stays disabled while required acknowledgements are unsaved.
5. Saved acknowledgement snapshots enable backend-authoritative submit.
6. Submitted and waiting compatibility pages settle without request loops.

The smoke script starts isolated child runtimes on API port `4001` and tenant port `3061`, adding CORS only for that child API process. This avoids stopping or modifying normal Docker-published local services on `4000` and `3060`.

Latest validation required clearing stale generated `apps/tenant/.next` output after Next reported a React Client Manifest mismatch. After cleanup, the bounded flow passed with consent save verified and `lateRequests: 0`.

## Remaining Work

- Replace placeholder consent/document definitions with reviewed setup-managed catalog records.
- Decide whether IP/user-agent capture is required and permissible.
- Extend admin review surfaces to display accepted consent snapshots where needed.
- Cover revision-requested and changed-consent-version re-acceptance paths.
