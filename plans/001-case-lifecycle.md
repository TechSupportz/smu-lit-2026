# Explicit saved-case lifecycle

Status: DONE

Implemented in `App.tsx`, `Landing.tsx`, `lib/lifecycle.ts` and `index.css`:
teardown is centralised in `teardownCase` (backend delete, then blobs, returning
partial-failure messages), a saved case shows `Continue my case` /
`Start a new case` above category selection, every destructive path (chips,
start button, header, footer, 404 recovery) routes through the one confirmation
dialog, header-level `Clear case` was added, the duplicate header Continue was
removed, Court resources is shown to everyone, a backend 404 renders a
persistent recovery banner, and focus moves to the back link or landing start
button through `onCloseAutoFocus`. Covered by `lib/lifecycle.test.ts` and the
new store reset test.
Audit base: `975d505`

Cycle 2 revisions: `teardownCase` now takes `fileIds` and returns
`{ problems, remaining }`, so a partial failure stays visible in a persistent,
non-assertive banner with a working `Try removing again` retry instead of a
dismissable toast; a clean teardown no longer clears unrelated errors; the
backend-404 banner is `role="status"` rather than `role="alert"`; and `App`
passes `caseMissing` to `Landing`, which drops the contradictory
`Continue my case` action for a case the backend no longer has.

## Problem

A returning user sees multiple competing continuation affordances but no safe “start new case” fork. Selecting a claim chip partially resets local state while retaining the old backend case and files. Clearing is only available at the bottom of a potentially long page.

## Scope

- `frontend/src/App.tsx`
- `frontend/src/components/Landing.tsx`
- `frontend/src/lib/store.ts`
- `frontend/src/index.css`

## Implementation

1. Centralize destructive teardown in one App-level async action that deletes the backend case when present, removes generated blobs, resets persisted state, and reports partial cleanup failures.
2. On the landing page, when a saved case exists, show two explicit choices: primary `Continue my case` and secondary `Start a new case`.
3. Route `Start a new case` through the existing confirmation dialog, then run teardown before setting the selected category and entering the filing stage.
4. Do not let claim chips call the partial `start(id)` path against a saved case. Reveal category selection only after the user chooses a new case, or pass chip clicks through the confirmed teardown.
5. Keep Court resources available for both new and returning users, and remove the duplicate header-level Continue action.
6. Add a header-level `Clear case` action while retaining the same confirmation dialog as the single destructive path.
7. If reconciliation of a saved backend case returns not-found, render a persistent recovery action to start fresh instead of leaving stale local state behind a transient toast.

## Motion

- Do not animate stage changes or hero artwork.
- Use existing dialog motion unchanged.
- New buttons receive only the shared 120ms press feedback from plan 004; no entrance animation.

## Acceptance criteria

- A saved case always presents `Continue my case` and `Start a new case` before category selection.
- Starting new cannot leave the old backend id, files, details, checks, or checklist attached.
- Clear case is reachable without scrolling to the footer.
- A backend 404 offers an obvious fresh-start recovery.
- Keyboard focus returns to a sensible control after confirmation or cancellation.
- No unrelated footer or hero-art layout changes.

## Verification

- Unit-test the store/app lifecycle paths with and without a backend id.
- Reload with seeded local storage; verify Continue preserves state.
- Repeat and choose Start new; verify backend/local state is cleared before the new category is stored.
- Simulate backend not-found and verify the recovery UI.
- Test narrow and wide layouts.
