# Questionnaire continuity and transcript history

Status: DONE

Implemented in `CaseQuestionnaire.tsx`, `Chat.tsx`, `lib/autogrow.ts` and
`index.css`: the freeform answer is a controlled auto-growing textarea capped at
192px (composer reuses the helper at 200px), submitted values come from
`selected`/`drafts` instead of FormData, `Edit this suggested answer` copies the
suggestion into the draft and focuses the caret at the end, the form is no
longer remounted on background refreshes (ids are reconciled instead), answered
question/answer pairs are replayed in the transcript from durable backend state,
every mutating control is disabled while a submission is pending, and headings,
counters and the submit label are plural-safe.
Audit base: `975d505`

Cycle 2 revisions: answered pairs no longer come from backend state alone. Each
submission writes a persisted `transcriptEntries` record (question, answer and
the last visible message id) through `recordAnsweredQuestions`, and
`buildTranscript` interleaves it at that anchor so the reply to the hidden
control prompt reads as a response to the answers. Duplicates are dropped and
backend-answered questions without a record are still appended as a fallback.
Selecting the suggestion now keeps a custom draft instead of erasing it (with an
inline note about which answer is sent), `GrillQuestionnaire` memoises the mapped
questions on their content so a background refresh cannot reset step state, and
the rendered textarea receives both the local and the library ref — without the
library's ref the answer never registers and a freeform-only required question
cannot be submitted. The conflicting `aria-label` was replaced by a real
`label`/`htmlFor` pair. Covered by `lib/chat-view.test.ts` and the store tests;
component-level tests remain impossible without a DOM test environment.

## Problem

Freeform answers are trapped in a fixed single-line field, editing a suggestion gives weak feedback, background refreshes can remount the form, and submitted questions and answers disappear from the transcript.

## Scope

- `frontend/src/components/CaseQuestionnaire.tsx`
- `frontend/src/components/Chat.tsx`
- `frontend/src/index.css`

## Implementation

1. Replace the freeform single-line input with a controlled textarea that starts at two rows and grows from `scrollHeight`, capped at `192px` with internal overflow after the cap. Keep `field-sizing: content` only as progressive enhancement.
2. Reuse the same auto-grow helper for the chat composer, capped at `200px`.
3. Read submitted values from controlled `selected` and `drafts` state rather than DOM/FormData ordering.
4. Put an inline `Edit` action on the suggestion surface. When invoked, copy the suggestion into the draft, focus the textarea, and place the caret at the end.
5. Keep questionnaire state stable across background case refreshes. Reconcile question ids into current draft state instead of remounting the whole form when the open set changes.
6. On successful submit, render each answered question as an assistant-side questionnaire bubble followed by the user’s answer bubble. Derive from durable answered question state so reloads retain the history; do not expose the hidden agent-control prompt.
7. Disable Previous, Next, option changes, edit, and submit consistently while a submission is pending.
8. Use plural-safe heading and counter copy.

## Motion

- Textarea growth is immediate so typing never lags behind input.
- Use `150ms var(--ease-out)` for selection border/background and answer-bubble opacity only.
- Do not animate height, step changes, or the insertion of every keystroke.

## Acceptance criteria

- Multi-line answers remain visible while typing and while editing a suggestion.
- Submission uses exactly the visible selected/drafted answer.
- A refresh cannot erase an in-progress draft or reset the user to question one.
- Submitted question and answer pairs remain visible after reload.
- Loading disables every control that could mutate the active questionnaire.

## Verification

- Exercise suggestion, custom answer, mixed multi-question, long answer, refresh-during-edit, and submit-failure cases.
- Verify keyboard focus and tab order after Edit.
- Verify textarea caps on mobile and desktop.
- Confirm hidden control prompts remain absent from the transcript.
