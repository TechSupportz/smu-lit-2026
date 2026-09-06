# Visible, accessible AI thinking presence

Status: DONE

Implemented in `Chat.tsx` and `index.css`: pending work renders in the assistant
lane with the same avatar and a reserved footprint, labelled
`ClaimGuide is thinking` until the response's first text arrives (derived from
the raw message list so a hidden control prompt still counts as a pending turn).
Dots animate opacity and `translateY` only over 800ms `var(--ease-in-out)` with
80ms stagger, are `aria-hidden`, and the conversation is a polite
`role="log"`. Reduced motion swaps the dots to an opacity-only pulse.
Audit base: `975d505`

Cycle 2 revisions: the pending state is derived by `lib/chat-view.ts`
`isThinking`, which always shows pending work for `submitted` and only hides it
during `streaming` once this turn's assistant text exists — the previous
last-message check could suppress the indicator while the previous turn's reply
was still the last message. `role="log"`/`aria-live` moved from `.conversation`
onto an inner `.message-stream`, so the eligibility form and the questionnaire
are no longer inside the live region. Covered by `lib/chat-view.test.ts`.

## Problem

The current streaming indicator is a small line of static dots, so waiting looks indistinguishable from a stalled interface. Streamed assistant content is also not announced as conversational updates.

## Scope

- `frontend/src/components/Chat.tsx`
- `frontend/src/index.css`

## Implementation

1. Present pending work in the assistant-message lane, with the same avatar and bubble alignment as a response.
2. Use the label `ClaimGuide is thinking` while waiting for the first response content. Replace/remove it as soon as the response bubble appears.
3. Animate three dot elements with opacity and `translateY` only. Use `800ms` cycles, `var(--ease-in-out)`, and `80ms` staggered delays; never animate layout properties.
4. Mark the conversation `role="log"`, `aria-live="polite"`, and `aria-relevant="additions text"`. Give the visual dots `aria-hidden="true"` and expose one concise status label.
5. Do not animate streamed Markdown tokens or auto-scroll with an unconditional smooth behavior.
6. Preserve the pending bubble’s footprint so first-token arrival does not shift surrounding content abruptly.

## Reduced motion

Inside `prefers-reduced-motion: reduce`, stop dot translation and retain a low-amplitude opacity pulse, or leave the dots static with the visible text label. The status must remain understandable without motion.

## Acceptance criteria

- Pending work is visible in the main transcript within one render after submit.
- First response content replaces the pending treatment without duplicate assistant rows.
- The loop is calm and continuous with no scale bounce or layout movement.
- Screen readers receive a useful pending/update announcement without repeated dot announcements.
- Reduced-motion users retain a clear textual state.

## Verification

- Use `[mock:long]`, `[mock:questionnaire]`, and `[mock:error]`.
- Record at least one complete wait-to-stream transition and inspect for layout shift.
- Verify keyboard and VoiceOver semantics.
- Verify reduced-motion mode.
