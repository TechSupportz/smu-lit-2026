# PRD 01 implementation progress

Last updated: 2026-09-06 (Asia/Singapore)

Status legend: `[ ]` pending, `[-]` in progress, `[x]` verified, `[!]` blocked or externally unverified.

## 1. Discovery and architecture

- [x] Read `prd-01.md`, `handoff.md`, `project-context.md`, root domain glossary, and `.env.sample`.
- [x] Verify current Flue/Pi/OpenRouter package and protocol APIs against primary sources.
- [x] Record the implementation architecture and explicit provider-test limitations in the server documentation.

## 2. Runtime and persistence

- [x] Bootstrap Node.js + TypeScript with lint, typecheck, test, and development scripts.
- [x] Add validated environment loading without reading or logging secrets.
- [x] Configure Flue file-backed runtime persistence at `data/flue.db` through source-root `db.ts`.
- [x] Add application SQLite migrations for cases, parties, facts, evidence, extractions, links, questions, contradictions, eligibility checks, remedies, procedural requirements, warnings, snapshots, turns/idempotency, and audit events.
- [x] Ensure restart recovery and serialized, revision-checked case mutations.

## 3. Domain behavior and API

- [x] Implement Valibot schemas for configuration, persistence, API inputs, agent tools, extraction results, and final snapshots.
- [x] Implement case create/list/read/edit/delete endpoints and shared internal-demo access.
- [x] Implement immutable evidence upload/list/read metadata with safe paths, hashes, size/page bounds, and case deletion cleanup.
- [x] Implement conversational turns with idempotency and stable Flue streaming routes.
- [x] Implement fact review, warning acknowledgment, questions, deterministic discrepancy records, readiness, and audit behavior.
- [x] Implement six launch templates plus generic intake without treating missing templates as ineligibility.
- [x] Implement amount/consent eligibility boundaries and conservative `UNVERIFIED` checks for unresolved legal/procedural inputs.

## 4. Agent and provider integrations

- [x] Implement one `SCTPreFilingAgent` with bounded case/evidence/procedural tools; no autonomous fact confirmation.
- [x] Configure the main agent through the bundled OpenRouter provider using the `OPENCODE_GO_*` environment contract.
- [x] Implement bounded OpenRouter evidence extraction using the separate `OPENROUTER_*` environment contract with provenance and partial-inspection records.
- [x] Surface provider/rate/modality failures as retryable processing errors, never eligibility failures.

## 5. Snapshots and PDFs

- [x] Create revision-bound immutable JSON snapshots with filesystem-safe nanoid/timestamp/display-name basenames and supersession metadata.
- [x] Create `skills/typst/SKILL.md`, validate it, and pass Flue's production packaging rules.
- [x] Adapt a safe Typst case-summary template containing parties, claim/remedy, factual summary, timeline, evidence index, and prominent unresolved warnings.
- [x] Implement bounded Typst compilation with JSON-only case data, stored PDF references, and snapshot/PDF integrity checks.
- [x] Render and inspect clean and warning-heavy representative PDFs; extract text and verify no clipping or missing warnings.

## 6. Verification and handoff

- [x] Add focused domain, persistence, API, retry/restart, stale-revision, deletion, snapshot, extraction-safety, and case-pack tests.
- [x] Keep all test fixture/mock data under `server/mock/`.
- [x] Run typecheck, lint, test suite, production build, `git diff --check`, and inspect the final working tree. (26 backend tests and 17 frontend tests pass; both production builds pass.)
- [!] Provider smoke tests remain externally unverified; no credentialed model call was required for local artifact and domain verification.
- [x] Write concise setup, security/data-handling, route, streaming-event, and frontend integration documentation.

## 7. Tribunal case-prep extension (added 2026-09-06)

- [x] Inspect `docs/cue-cards.md`, the current frontend flow, and existing frontend/backend contracts.
- [x] Extend the reviewed snapshot with an evidence-stack manifest and cue-card preparation state.
- [x] Add a provenance-safe, single-A4-page cue-card Typst template and bounded compiler exposed to the application agent.
- [x] Normalize supported evidence inputs (PDF, screenshots/images, text, and Word/Office documents) into PDF pages without altering originals.
- [x] Merge cue card, pre-filing summary, and normalized evidence into one indexed tribunal PDF stack with integrity metadata.
- [x] Add backend routes for generating, viewing, and downloading cue cards, pre-filing forms, individual originals, and the combined stack.
- [x] Add the end-of-flow frontend case-prep UI with rendered preview and all requested downloads. (17 frontend tests, TypeScript, and production build pass.)
- [x] Add mock-only fixtures and focused backend/frontend tests; enforce one-page cue-card output and render/inspect the refreshed 12-page Word-inclusive final PDF stack.
- [x] Replace the cramped split-column cue card with a 10pt, single-column A4 layout; omit internal warning records from the tribunal-facing card, recompile clean and warning-bearing fixtures, and visually inspect the refreshed 12-page full stack.

## 8. Hypothetical claimant click-through scenario

- [x] Turn the supplied beauty-package/CPFTA hypothetical into a durable eight-part browser test plan in `docs/user-scenario.md`, grounded in the current UI, environment, validation gates, and case-prep downloads.
