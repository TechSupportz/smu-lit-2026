# PRD 01 implementation progress

Last updated: 2026-09-05 (Asia/Singapore)

Status legend: `[ ]` pending, `[-]` in progress, `[x]` verified, `[!]` blocked or externally unverified.

## 1. Discovery and architecture

- [x] Read `prd-01.md`, `handoff.md`, `project-context.md`, root domain glossary, and `.env.sample`.
- [x] Verify current Flue/Pi/OpenCode/OpenRouter package and protocol APIs against primary sources.
- [ ] Record the implementation architecture and explicit provider-test limitations in the server documentation.

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
- [x] Configure Muse Spark 1.3 Contributor via OpenCode Go Responses protocol and per-conversation session headers.
- [x] Implement bounded Gemini 3.8 Flash evidence extraction via OpenRouter with provenance and partial-inspection records.
- [x] Surface provider/rate/modality failures as retryable processing errors, never eligibility failures.

## 5. Snapshots and PDFs

- [x] Create revision-bound immutable JSON snapshots with filesystem-safe nanoid/timestamp/display-name basenames and supersession metadata.
- [x] Create `skills/typst/SKILL.md`, validate it, and pass Flue's production packaging rules.
- [x] Adapt a safe Typst case-summary template containing parties, claim/remedy, factual summary, timeline, evidence index, and prominent unresolved warnings.
- [x] Implement bounded Typst compilation with JSON-only case data, stored PDF references, and snapshot/PDF integrity checks.
- [ ] Render and inspect clean and warning-heavy representative PDFs; extract text and verify no clipping or missing warnings.

## 6. Verification and handoff

- [ ] Add focused domain, persistence, API, retry/restart, stale-revision, deletion, snapshot, and extraction-safety tests.
- [ ] Keep all test fixture/mock data under `server/mock/`.
- [-] Run typecheck, lint, test suite, production build, `git diff --check`, and inspect the final working tree. (Typecheck, lint, and build currently pass.)
- [ ] Run provider smoke tests only if credentials and account availability permit; otherwise mark them explicitly unverified.
- [ ] Write concise setup, security/data-handling, route, streaming-event, and frontend integration documentation.
