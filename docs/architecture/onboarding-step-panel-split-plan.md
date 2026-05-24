# Tenant Onboarding Step Panel — Split Plan

> **This is an analysis document, not a change order.** No code is being
> split as part of this slice. The goal is to give the next engineer
> who picks up the split a clear runway: what's truly shared, what's
> safe to extract first, where the traps are, and which tooling
> investments are warranted.

## Current state

| Property             | Value                                                                |
| -------------------- | -------------------------------------------------------------------- |
| File                 | `apps/tenant/src/components/tenant/onboarding/TenantOnboardingStepPanel.tsx` |
| Lines                | ~1517                                                                |
| Public surface       | One default export, `<TenantOnboardingStepPanel activeStep={…} … />` |
| State hooks inside   | 10 `useState`, 1 `useMemo`, 2 `useEffect`                            |
| Branch dispatch      | `if (activeStep === '<slug>') return (…)` chain, falling through to final review |
| Branches today       | `welcome`, `phone-verification`, `business-intro`, `location`, `business-details`, `bank-details`, `plan-selection`, `verification`, (fallthrough) `review` |
| Forms used           | Native `<form>` + controlled `useState` objects + manual `fieldErrors` map |
| Validation           | Per-branch manual checks before `onSaveDraft` is called              |

The file is not bad-bad — it works, it's typed, and every branch
follows the same shape (`<StepHeader />` + body + `<StepFooter />`). It
is, however, the largest file in the tenant app and the friction it
adds shows up in every onboarding-touching code review.

## Why we haven't split it yet

Three reasons, in order of how much they bite:

1. **Shared form state hydration.** A single `useEffect`
   (`TenantOnboardingStepPanel.tsx:362–418`) hydrates *four* form
   `useState` slots — `businessForm`, `legalForm`, `ownerForm`,
   `operationsForm` — from `workspace.steps`. Any naive split that
   moves a single form into a child component now needs four lift-ups
   or four duplicate hydration effects.
2. **Shared validation surface.** `fieldErrors: Record<string, string>`
   is shared by every branch. The schema is implicit — keys happen to be
   unique because the field names happen not to collide. A split must
   either keep one shared errors map (passed down + handler functions)
   or convert to a per-panel errors map (and risk regressions in any
   place that read across panels).
3. **One branch reads two backend records.** The `business-details` URL
   step (`activeStep === 'business-details'`, lines 1047+) writes to
   *both* `legal_tax_info` and `owner_contact_info` backend steps via
   two separate PATCH calls on submit. This is the only branch that
   isn't 1:1 with a backend step and the split plan has to handle it
   explicitly.

## What is actually shared vs. isolated

| State / derived value                    | Shared?              | Notes                                                          |
| ---------------------------------------- | -------------------- | -------------------------------------------------------------- |
| `businessForm`                           | Used only by `location`                          | Could be extracted with its own hydration effect              |
| `legalForm`                              | Used by `business-details`                       | Same as above                                                  |
| `ownerForm`                              | Used by `business-details`                       | Same as above                                                  |
| `operationsForm`                         | Used only by `plan-selection`                    | Same as above                                                  |
| `documentForm` + `selectedDocumentFile`  | Used only by `verification`                      | Trivially panel-local                                          |
| `phoneNumber` + `phoneCode` + `phoneChallenge` + `phoneVerificationError` + `phoneVerificationLoading` | Used only by `phone-verification` | Trivially panel-local; also seeded from `workspace.phoneVerification` |
| `fieldErrors`                            | Shared by all editable panels (`location`, `business-details`, `plan-selection`, `verification`) | Cleared on `activeStep` change via separate effect |
| `activeEntry` (useMemo)                  | All branches                                     | Cheap to recompute per-panel                                   |
| `documents` (derived)                    | Only `verification`, `review`                    | Move with `verification`                                       |
| `locked`, `saving`                       | All branches                                     | Trivially derivable per-panel from props                       |
| `*Seeded` booleans (`businessIdentitySeeded`, etc.) | `review`               | Move with `review`                                             |

**Verdict:** the *forms* are isolated — they look shared because they
all sit in one component, but each one is only read by exactly one
branch. The genuinely shared thing is `fieldErrors`, and the
hydration `useEffect`. Both have clean fixes (see below).

## Phase 0 — what to do right before splitting

These are zero-risk preparations that make the actual split a 30-minute
job.

1. **Move form hydration adjacent to each form's read site.** Instead of
   one `useEffect` that sets four form slots, write four small hooks:
   `useHydratedBusinessForm(workspace)`, `useHydratedLegalForm(workspace)`,
   `useHydratedOwnerForm(workspace)`, `useHydratedOperationsForm(workspace)`.
   Each returns `[form, setForm]`. The behaviour is identical; the
   coupling is gone.
2. **Replace `fieldErrors: Record<string, string>` with a tiny
   per-panel hook** `useFieldErrors()` that exposes `{ errors,
   setError, clearAll }`. Each panel instantiates its own. The current
   reset-on-step-change effect becomes unnecessary because the hook
   instance dies with the panel.
3. **Extract `<StepHeader />` and `<StepFooter />` to a small shared
   `./panels/_chrome.tsx` module.** They're already separate functions
   inside the file; just move them.

After phase 0 the parent file shrinks from 1517 to ~1000 LOC without
splitting any branch.

## Phase 1 — the proposed split

```
apps/tenant/src/components/tenant/onboarding/
├── TenantOnboardingStepPanel.tsx        # router: branches to a panel
├── panels/
│   ├── _chrome.tsx                       # StepHeader + StepFooter + ValidationBanner
│   ├── _hydration.ts                     # useHydrated*Form hooks
│   ├── _field-errors.ts                  # useFieldErrors hook
│   ├── WelcomePanel.tsx                  # no backend step, informational
│   ├── PhoneVerificationPanel.tsx        # owns phone-* useState; calls send/verify clients
│   ├── BusinessIntroPanel.tsx            # informational
│   ├── LocationPanel.tsx                 # PATCHes business_info
│   ├── BusinessDetailsPanel.tsx          # PATCHes legal_tax_info AND owner_contact_info
│   ├── BankDetailsPanel.tsx              # UI-only (no backend step yet)
│   ├── PlanSelectionPanel.tsx            # PATCHes operations_info
│   ├── VerificationPanel.tsx             # uploads documents
│   ├── ReviewPanel.tsx                   # final review + submit
│   └── WaitingPanel.tsx                  # rendered from waiting/page.tsx, not from the router
└── (existing siblings: TenantOnboardingWorkspace.tsx, etc.)
```

Each panel takes a small, type-checked prop set instead of the full
`StepPanelProps`. Suggested base prop shape:

```ts
type PanelProps = {
  workspace: TenantOnboardingWorkspace;
  savingStep: TenantOnboardingStepKey | null;
  onBack: () => void;
  onContinue: () => void;
};
```

…and the few panels that need to mutate state declare their extra
callbacks explicitly:

| Panel                    | Extra callback prop(s)                                     |
| ------------------------ | ---------------------------------------------------------- |
| `LocationPanel`          | `onSaveDraft('business_info', payload)`                    |
| `BusinessDetailsPanel`   | `onSaveDraft('legal_tax_info', payload)`, `onSaveDraft('owner_contact_info', payload)` |
| `PlanSelectionPanel`     | `onSaveDraft('operations_info', payload)`, `onComplete('operations_info')` |
| `VerificationPanel`      | `onUploadDocument(file, input)`, `onComplete('documents')` |
| `PhoneVerificationPanel` | `onPhoneVerified(workspace)`                               |
| `ReviewPanel`            | `onComplete('final_review')`, `onSubmit()`                 |
| `WelcomePanel`, `BusinessIntroPanel`, `BankDetailsPanel` | none beyond base   |

The router stays small:

```tsx
export function TenantOnboardingStepPanel(props: StepPanelProps) {
  switch (props.activeStep) {
    case 'welcome':            return <WelcomePanel            {...basePanelProps(props)} />;
    case 'phone-verification': return <PhoneVerificationPanel  {...basePanelProps(props)} onPhoneVerified={props.onPhoneVerified} />;
    case 'business-intro':     return <BusinessIntroPanel      {...basePanelProps(props)} />;
    case 'location':           return <LocationPanel           {...basePanelProps(props)} onSaveDraft={props.onSaveDraft} />;
    case 'business-details':   return <BusinessDetailsPanel    {...basePanelProps(props)} onSaveDraft={props.onSaveDraft} />;
    case 'bank-details':       return <BankDetailsPanel        {...basePanelProps(props)} />;
    case 'plan-selection':     return <PlanSelectionPanel      {...basePanelProps(props)} onSaveDraft={props.onSaveDraft} onComplete={props.onComplete} />;
    case 'verification':       return <VerificationPanel       {...basePanelProps(props)} onUploadDocument={props.onUploadDocument} onComplete={props.onComplete} />;
    case 'review':             return <ReviewPanel             {...basePanelProps(props)} onComplete={props.onComplete} onSubmit={props.onSubmit} />;
  }
}
```

The router file ends up at ~80 LOC, each panel at 150–250 LOC. Total
across all panels ≈ same as today, but each file is independently
reviewable.

## Prop drilling — is a context worth it?

Short answer: **no, not yet**.

The reason the original component does not use a context is that nothing
needs to be shared *between* panels — only between the panel and the
parent (`useTenantOnboardingWorkspace`-driven callbacks). The parent
already holds those callbacks. Forwarding three to five props per panel
is fine.

A context would only earn its keep when:

- A sibling component outside the router (e.g. a sticky save bar) needs
  to read the live form state of the active panel.
- We want to support multi-step wizards that share a draft across more
  than one URL segment.

Neither is on the roadmap today.

## Form engine — `react-hook-form` + `zod`?

The current setup is hand-rolled: controlled `useState` objects, manual
`fieldErrors` map, manual `validateXyz()` helpers before save. It works
because each panel has 4–8 fields and the validation is essentially
"is this string non-empty".

A move to `react-hook-form` + `zod` would buy us:

- A single source of validation truth per panel (one `zod` schema), with
  TypeScript types derived directly from it.
- Automatic dirty / touched tracking → enables a saner "are you sure you
  want to leave this page?" guard.
- Less boilerplate per field (one `register('businessName')` instead of
  four lines).

Cost:

- Two new runtime deps in `apps/tenant`.
- Migration touches every panel form.
- Slightly different mental model from the rest of the app (which is
  also hand-rolled today).

**Recommendation:** *defer until phase 2*. Phase 1 is a structural
split with no behavior change; phase 2 (which can land as a separate
slice per panel) introduces `zod` schemas alongside the split. Doing
both at once is the change that most realistically breaks something.

## What's risky

| Risk                                                                 | Mitigation                                                         |
| -------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Hidden cross-panel state read (e.g. one panel reading another's form)| Search `businessForm`, `legalForm`, `ownerForm`, `operationsForm`, `documents` references inside the file before splitting. The current grep shows each name is read in exactly one branch except for the seed booleans used by `review`. Those compute from workspace, not from form state, so they're safe to recompute per-panel. |
| `business-details` writes two backend records                        | The new `BusinessDetailsPanel` keeps both `legalForm` + `ownerForm` and issues two `onSaveDraft` calls (in order) on submit, mirroring today. Document that this panel is special. |
| Phone state's `verifiedPhoneApplications` Map is server-side in-memory | Splitting doesn't touch backend state — but flag it so the next person doesn't think the verified marker survives a server restart. |
| Locale strings (the labels are in Turkish, inline)                   | Either move to `useWebLanguage()` keys in phase 1 or keep them inline and migrate in phase 2. Don't half-do it. |
| Tab-key order across split panels                                    | Each new panel must keep an `<input autoFocus />` semantics check — the current panel sets focus on the first invalid field after save; replicate per panel. |
| `lastCheckedAt` / `loading` / `error` from the hook                  | Stay on the parent (`TenantOnboardingWorkspace.tsx`). Do not push them into individual panels. |

## What is NOT in scope of the split

- Changing any HTTP endpoint, DTO, or response shape.
- Replacing `useTenantOnboardingWorkspace` with a state-management
  library (Redux, Zustand, Jotai, etc.). The hook stays.
- Removing `@deprecated` session/`me` helpers — that's a separate
  ticket (see [onboarding-v2-flow.md](./onboarding-v2-flow.md) → Open
  items).
- Adding new onboarding steps. The schema is frozen for this split.

## Suggested ticket structure when this finally happens

1. *(prep, 1 PR)* Phase-0 cleanups: extract `_chrome.tsx`, the four
   `useHydrated*Form` hooks, and `useFieldErrors`. No file rename, no
   visual change.
2. *(split, ~7 PRs, one per panel)* Extract each branch into its own
   panel file. Each PR removes one branch from the giant if-chain. The
   router shrinks gradually.
3. *(cleanup, 1 PR)* Delete the now-empty if-chain and replace with
   the `switch` router shown above.
4. *(optional, separate)* Phase 2: introduce `zod` + `react-hook-form`
   per panel, one panel at a time.

Each PR is mechanically reviewable and individually revertible. No PR
in this sequence should touch the backend.

## Acceptance criteria

A split is "done" when:

- [ ] `TenantOnboardingStepPanel.tsx` is under 150 LOC.
- [ ] Every panel file is under ~300 LOC.
- [ ] No two panels import each other.
- [ ] No new context, no new global store, no new runtime dep (phase 1).
- [ ] `apps/tenant` `tsc --noEmit` passes.
- [ ] A manual click-through of the full onboarding flow (start → step
  saves → document upload → submit → admin approve → activate → dashboard)
  shows identical UI vs. main.

The last bullet is the only one that needs human eyes. Everything
above is mechanically verifiable.
