# Low-jank shared motion system

Status: DONE

Implemented in `index.css`: `--ease-out`, `--ease-in-out`, `--duration-press`
and `--duration-ui` tokens, hover treatments gated on
`(hover: hover) and (pointer: fine)`, `scale(0.98)` press feedback over 120ms on
buttons, claim chips, questionnaire actions, the panel heading and the
suggestion surface, questionnaire progress driven by
`transform: scaleX(var(--progress))` instead of width, and a targeted
reduced-motion block that drops spatial and looping motion while keeping colour,
opacity and loading feedback. Radix dialog motion is unchanged.
Audit base: `975d505`

Cycle 2 revisions: `Edit this suggested answer` was missing from both the press
feedback group and the reduced-motion override, and is now in both. Panel
open/close remains immediate.

## Problem

Motion values are ad hoc, buttons lack tactile press feedback, progress animates `width`, and the global reduced-motion rule removes even useful non-spatial feedback.

## Scope

- `frontend/src/index.css`
- Existing interactive controls in `frontend/src/components/`

## Implementation

1. Add shared tokens:
   - `--ease-out: cubic-bezier(0.23, 1, 0.32, 1)`
   - `--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1)`
   - `--duration-press: 120ms`
   - `--duration-ui: 180ms`
2. Gate hover treatments with `@media (hover: hover) and (pointer: fine)`.
3. Add `:active:not(:disabled)` press feedback to primary, secondary, compact icon, and questionnaire option controls using `transform: scale(0.98)` over `120ms var(--ease-out)`. Preserve keyboard focus rings and do not move surrounding layout.
4. Change progress fill from animated `width` to full-width fill with `transform: scaleX(var(--progress))`, `transform-origin:left`, and `180ms var(--ease-out)`.
5. Keep ProgressPanel mount/open behavior immediate; do not animate variable-height panel content.
6. Replace the global “all transitions to 0.01ms” reduced-motion rule with targeted removal of spatial transforms and long/looping motion while retaining short color/opacity state feedback.
7. Leave existing Radix dialog fade/zoom unchanged.

## Acceptance criteria

- Progress changes produce no layout recalculation from width animation.
- Buttons feel responsive but never bounce, overshoot, or delay navigation.
- Coarse pointer/touch devices do not receive sticky hover states.
- Reduced-motion mode removes spatial/looping motion while keeping clear hover, focus, selection, and loading state changes.
- No `transition: all`, spring/bounce easing, or typewriter animation is introduced.

## Verification

- Inspect Chrome Performance while updating progress and sending messages.
- Test mouse, touch emulation, keyboard, and reduced-motion media emulation.
- Run frontend tests and production build.
- Confirm dialogs and stage changes behave as before.
