# Onboarding V2 Render Stability

## OTP Progress Failure

The custom V2 pages previously applied a mutation response workspace through the
general workspace setter. That setter remembered the newly issued response token
before navigation completed. While the URL still requested `otp`, the hook resolved
`otp` again against a database state where phone verification was already complete.
That locked-step redirect could race the intended `welcome` navigation.

V2 mutation workspaces now update displayed data without changing the current route
token dependency. The requested next URL changes first, and the backend-authoritative
session resolver then confirms the new requested step.

## Flash And Layout Remounts

Mutation responses may contain a fresh valid state token. State token payload progress
is informational; database progress remains authoritative. Writing each fresh token
into the next onboarding URL changed the dynamic `[stateToken]` layout key and
remounted the entire shell, making its mount transition appear as a flash.

Editable V2 page navigation now retains the already validated URL token across step
transitions. The same token remains valid while the application is editable, and each
new route is still authorized through `GET /session?step=...`.

When a prior step has already been resolved, changing to another requested step keeps
the confirmed page mounted until the new session response arrives. Initial direct
entry still shows the protected loading state before any requested content renders.

## Duplicate Actions

All explicit V2 mutation actions use a shared synchronous ref-based single-flight
guard. Loading states remain visible UX feedback, while the ref prevents multiple
backend writes before React has committed the disabled button state.

In browser verification, OTP request traffic included one CORS `OPTIONS` request and
one real `POST /phone/verify-code`; it was not a duplicate mutation.

## Memoization Boundaries

- Workspace navigation functions are memoized with `useCallback`.
- Mutation workspace application is a stable callback separate from legacy token
  persistence behavior.
- Plan catalog loading uses a request sequence guard so stale responses cannot apply.
- Country-pack derived field/copy configurations remain memoized at custom-page level.

The explicit review/submitted pages are not implemented yet; their legacy navigation
behavior should be reassessed during Slice 9.
