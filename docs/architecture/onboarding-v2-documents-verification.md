# Onboarding V2 Documents Verification

## Behavior

`/onboarding/:stateToken/verification` now renders the custom `DocumentsVerificationStep`. It is the visible document completion step before final submission.

- The page displays the current required-document state and current uploaded documents.
- The page uploads PDF/image files using the existing multipart endpoint.
- A current required document with a non-rejected, non-expired state satisfies the onboarding document completion requirement used before submit.
- Upload status is displayed as pending review, approved, rejected, needs replacement, or expired.

## Reused persistence and endpoints

No database migration or alternate document lifecycle was introduced.

- Persistence remains `TenantDocument`.
- Upload remains `POST /v2/tenant/onboarding/:stateToken/documents/upload`.
- Session/workspace resolution already returns the current document data used by the page; no additional read endpoint is required.
- Existing submission continues through `POST /v2/tenant/onboarding/:stateToken/submit`.

## Return To Review

Review routes the documents edit action to:

`/onboarding/:stateToken/verification?returnTo=review`

When a document upload succeeds on this URL, the UI applies the successful backend workspace response and routes back to `/review`. A direct verification visit without `returnTo=review` stays on the page after upload so the uploaded/current-document state is visible and offers a Return to review action.

The workspace redirect guard resets once the pathname changes, so revisiting the same query-bearing edit target later in the review cycle is not incorrectly suppressed as a duplicate redirect.

## Validation and access

- Backend session resolution permits verification only after the existing membership-plan gate.
- Review remains open after plan selection so missing documents remain visible.
- Submit validation is unchanged: required steps and at least one current required document are still required.
- `/submitted` remains inaccessible until submit succeeds.

## Consents and country packs

Slice 10.2 adds application-scoped consent snapshot persistence and review checkboxes. Document category and consent wording remain placeholder copy ready for later country/language pack expansion, including reviewed Switzerland-specific requirements.

## Bounded smoke procedure

Run the bounded smoke script from the repository root:

`powershell -ExecutionPolicy Bypass -File .\scripts\smoke-onboarding-v2-documents.ps1`

The script uses isolated API/tenant ports (`4001`/`3061` by default), with browser automation profiles stored under the operating-system temporary directory:

1. Prepare an editable application through `plan-selection` and `operations`.
2. Open `/review`, assert Required documents is missing, and follow its edit action to `/verification?returnTo=review`.
3. Upload one temporary required document on the custom verification page and assert that `returnTo=review` navigates only after upload succeeds.
4. Assert review no longer reports documents missing and submit succeeds only after the upload.
5. Assert `/submitted` renders after submit and `/waiting` redirects to the same-token `/submitted` URL.
6. Re-open the Required documents edit target after returning to review to cover query-aware duplicate-navigation guards.
7. Count requests during settled screens: `/session`, document upload, and `/review` must remain finite; `/workspace` must not loop.

Any temporary browser profiles and test upload files must be removed after the bounded smoke run.

Latest bounded run result: the complete review -> verification -> upload -> review -> repeated edit -> required acknowledgement save -> submit -> submitted -> waiting alias sequence passed with `lateRequests: 0`.

## Remaining cleanup

- Define required document sets per country pack rather than the current minimum-one-document policy.
- Add real consent persistence only after product and legal requirements are defined.
