# UI refinement plans

Audit base: `975d505`

Recommended execution order:

1. `001-case-lifecycle.md` — make resume, start-new, and clear-case behavior explicit and safe.
2. `002-thinking-presence.md` — make pending AI work visible without animating streamed text.
3. `003-questionnaire-continuity.md` — preserve answers, show them in the transcript, and make editing reliable.
4. `004-low-jank-motion-system.md` — add shared motion tokens, press feedback, and transform-based progress.

All plans are `DONE` as of the `ui-refinement` pass. Each one records what
landed, including a "Cycle 2 revisions" note where the second review pass
changed the original implementation; verify independently before building on
top of them.
