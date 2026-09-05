# PRD 01 — SCT pre-filing agent harness

Status: Consolidated PRD, awaiting final shared-understanding confirmation. Product decisions reflect interview rounds 1–3; implementation defaults below are proposed for final review. Backend implementation has not started.

## Authority and purpose

`project-context.md` is the product source of truth. The user's explicit additional constraints apply alongside it. `cjts-normal-user-flow.md` and `cjts-small-claim-form-checklist.md` are historical workflow references only, not authority for scope or current procedural rules.

Build a backend agent harness that helps a self-represented person collect, inspect, reconcile, and confirm the information and evidence needed for SCT pre-filing. Deliver persistent structured state for a separate frontend. Completion does not establish legal correctness, prove allegations, predict success, or mean CJTS accepted a claim.

## Fixed requirements

- Deliver a backend for the team’s frontend. Use Node.js, TypeScript with linting, SQLite, and Valibot. Use Hono where needed for the HTTP interface.
- Use Flue with its Pi runtime and one main `SCTPreFilingAgent`. Configure file-backed runtime persistence through Flue’s source-root `db.ts` and built-in `sqlite()` adapter. Use `data/flue.db` for Flue runtime persistence and `data/cases.db` for application case tables, alongside local immutable evidence storage.
- Use Muse Spark 1.3 Contributor (`muse-spark-1.3-contributor`) through OpenCode Go for the main agent, using the Responses protocol. Use Gemini 3.8 Flash (`google/gemini-3.8-flash`) through OpenRouter for evidence extraction. The user will supply `server/.env`, variable `OPENCODE_GO_KEY`, as the credential source. Never copy its value into documentation, source, logs, or examples.
- Include a Typst skill and PDF compilation capability available to the application agent. Compile a reviewed case snapshot into a Typst PDF containing parties, claim/remedy, factual summary, timeline, evidence index, and prominent unresolved warnings. Keep original evidence files separate.
- Persist case state across turns, including parties, facts, immutable evidence originals, extractions, provenance links, questions, contradictions, procedural checks, remedies, and audit events.
- Support non-linear investigation and revisiting previous conclusions when evidence changes.
- Keep user assertions, document support, AI inference, user confirmation, and uncertainty distinguishable. Never silently promote an AI inference to a confirmed material fact.
- Inspect evidence, cite source locations, challenge unsupported statements, and expose contradictions rather than silently selecting one account.
- Let users confirm, edit, reject, or mark uncertain material disputed facts.
- Obtain procedural claims from authoritative allowlisted sources; keep rules configurable/versioned. Historical CJTS thresholds and field constraints are not current verified requirements.
- Flag potentially unnecessary sensitive evidence without automatically modifying originals.
- Evaluate completeness explicitly and save a final structured pre-filing state after the required review.
- Preserve the frontend boundary: the frontend owns screens, forms, uploads UI, confirmation UI, navigation, citation display, and CJTS handoff.

## Exclusions

No frontend implementation, autonomous CJTS submission, payment, actual service of documents, Declaration of Service, consultation or hearing preparation, litigation strategy, argument coaching, witness preparation, outcome prediction, or post-filing monitoring.

## Design tree and open decisions

### Decisions resolved in round 1

- Backend for the team’s frontend, using Flue’s SQLite `db.ts` integration.
- Six launch case models, with Consumer Protection (Fair Trading) Act (CPFTA) coverage a client priority.
- Only failed filing eligibility may hard-block progression. Missing evidence, unresolved factual conflicts, unknown particulars, and unsupported allegations trigger warnings and further questions, not indefinite refusal to proceed.
- Before proceeding with a material evidence gap, give a prominent warning, request relevant alternative evidence, and explicitly prompt the user again. Record the warning and their decision. Do not repeat the same prompt indefinitely after acknowledgment unless material information changes.
- For an unsupported cash payment, ask about ATM withdrawal records, bank withdrawal statements, contemporaneous messages, acknowledgment, or available CCTV. A withdrawal alone does not prove payment to the respondent. Say the assertion may be challenged; do not predict that a challenge will definitely occur.
- Official CJTS assessment is tracked but is not a prerequisite for finishing preparation.
- Include an output PDF compiler using Typst.
- Launch inputs: text PDFs, scanned PDFs, screenshots, and text, initially in English. Extraction uses a model with vision and/or PDF parsing capabilities; actual provider modality support must be verified.
- Credential configuration moves to `server/.env`.

### Six selected launch case models

These are product templates, not an exhaustive statement of SCT jurisdiction:

1. Sale of goods: item, agreement, delivery, alleged defect/non-delivery, payments, and requested remedy.
2. Provision of services: scope, quoted versus promised terms, performance, alleged failure, payments, and remedy.
3. Residential tenancy: agreement period, premises, parties, deposit/rent, disputed obligation, and remedy.
4. Property damage: incident, ownership, alleged actor, causation account, damage evidence, and loss calculation; investigate applicable exclusions.
5. CPFTA unfair practice: consumer/supplier relationship, underlying transaction, exact representation or conduct, when and where it occurred, supporting evidence, and claimed loss/remedy. Allow overlap with goods/services without duplicating claims or assuming illegality.
6. Motor vehicle deposit refund: dealer, proposed transaction, deposit, relevant agreement/cancellation/refund facts, and evidence. Keep distinct from motor-vehicle damage.

### Eligibility versus evidence quality

Represent eligibility separately from preparation quality. Eligibility outcomes: `PASS`, `FAIL`, `UNVERIFIED`. A missing fact or unavailable official source must not automatically become `FAIL`. A supported failure prevents a ready-for-filing handoff while preserving the saved case and ability to correct inputs. Unknown eligibility permits finishing and export with an explicit eligibility-unverified warning. A failed case remains saved and editable, but cannot produce a filing-ready handoff.

Readiness must preserve gaps honestly: a warning acknowledgment does not resolve a contradiction, support an allegation, or establish eligibility. Existing source completion criteria must be reconciled with the user’s explicit nonblocking instruction rather than retaining contradictory hard gates.

### Decisions resolved in round 2

- Unknown eligibility is nonblocking and must remain visible as unverified.
- Block a claim that exceeds the applicable monetary limit. The ordinary limit is SGD 20,000; the SGD 30,000 limit applies only with a Memorandum of Consent from both parties. Do not automatically reduce claims or implement an excess-abandonment workflow in this release. Unknown consent status must be distinguished from confirmed absence.
- No authentication in this release. The frontend connects directly to this backend. Do not claim user ownership isolation; this is an internal demo with a shared case list, not per-user isolation.
- Produce a Typst PDF. Round 3 confirms the proposed case-summary contents with original evidence kept separate.
- Model-based extraction handles scanned PDFs and screenshots as well as text PDFs/text. English is the initial language scope.
- After targeted requests for alternative evidence, show one final prominent warning before proceeding and record explicit acknowledgment. Do not repeatedly grill the same acknowledged gap without new material information.
- Use separate `flue.db` and `cases.db` SQLite files in one data directory.

### Decisions resolved in round 3

- Main agent: Muse Spark 1.3 Contributor through OpenCode Go. Evidence extraction: Gemini 3.8 Flash through OpenRouter. Configure separate keys and models in `server/.env`; provide `server/.env.sample` with empty key values.
- Internal unauthenticated demo, shared case list, frontend directly connected to backend. Persist until explicit deletion; deletion covers case records, runtime conversation, evidence, extractions, and generated artifacts. This concerns application-managed data, not provider retention.
- PDF contents: parties, claim/remedy, factual summary, timeline, evidence index, and unresolved warnings. Significant warnings and unverified eligibility appear near the beginning. Cite source locations and retain original evidence separately.
- Use `../../cjts-small-claim-preparation.typ` as an adaptable visual/layout reference, not a procedural authority. Replace blank worksheet boxes with populated case sections; remove payment, service, consultation/hearing sections and unverified historical constraints. Do not present the document as an official court form.
- Frontend accepts both structured responses and streaming. Provide explicit fact-confirmation and warning-acknowledgment actions.
- If official retrieval fails, mark affected checks `UNVERIFIED` and tell the user that the relevant guidance could not be fully checked/scanned. Saved rules may be shown as historical context, but must not silently stand in for a successful check. A failed page fetch is not a completed scan.
- Preserve snapshots and PDFs. Material changes supersede earlier versions and require review of affected facts/warnings. Never overwrite or silently relabel an old PDF as current.
- Name generated snapshots and PDFs using `nanoid-timestamp-case/user name`. Filesystem-safe interpretation: `<nanoid>-<UTC timestamp>-<case-or-user-name-slug>`, with `.json` or `.pdf` as appropriate. Here `/` denotes the choice of case or user name, not an embedded path separator. Prefer case title, then claimant name, then `untitled-case`; store the original display name separately. Example: `V1StGXR8_Z5jdHi6B-myT-20260905T123456789Z-tan-renovation.pdf`. Related JSON/PDF share the snapshot basename; newly generated snapshots get new IDs.
- CPFTA has substantive source-linked checks, exact alleged conduct, transaction context, and evidence. Do not declare a violation merely because conduct sounds unfair. Generic intake remains available for cases outside the six templates; lack of a template is not ineligibility.

## Implementation defaults for final review

- Hono endpoints for case creation/list/read/edit, evidence upload/list, conversation turns, fact confirmation, warning acknowledgment, final snapshot creation, PDF generation/download, and case deletion. Stream agent output and processing events; publish Valibot-derived shared contracts where supported.
- One main agent per case conversation, with serialized mutations per case and idempotent retry handling. Model extraction is a tool capability, not a swarm.
- Track assertion origin, user review, and evidence assessment separately so user confirmation cannot erase documentary disagreement.
- Store SGD amounts in integer cents; preserve date precision and original wording. Do not invent dates or reinterpret approximate amounts as exact.
- Completion means the user has finished preparation/review; warning-based completion does not set every individual check to passed. Keep eligibility, preparation status, review status, and handoff permission separate in the output.
- File or model failures are processing errors, not legal ineligibility. Preserve partial state and support retry or continuation with explicit unreviewed-evidence warnings.
- Bound upload sizes, page processing, model calls, retries, and PDF compilation with configurable limits. Oversized or unreadable inputs do not become eligibility failures.

## Verified reference notes

- [Flue database documentation](https://flueframework.com/docs/guide/database/) documents `db.ts` and `sqlite()` for durable runtime storage, and distinguishes it from application business data. Do not assume this adapter exposes the case tables.
- [Judiciary eligibility guidance](https://www.judiciary.gov.sg/civil/cases-eligible-small-claim/1000) supports the six selected categories and explains that its list is non-exhaustive. It also permits abandoning excess above the applicable claim limit and prohibits splitting solely to evade that limit. The product decision is to block over-limit claims and omit an excess-abandonment workflow. Do not describe that product boundary as an assertion that lawful abandonment is impossible.
- The user’s pasted criteria supplement the interview. Their payment, service, consultation, and hearing descriptions do not expand the pre-filing scope.
- Eligibility rules must remain versioned and source-linked. Additional statutory conditions and exceptions need verification before implementing an exhaustive checker.

## Acceptance criteria to preserve through refinement

- A restarted harness can resume the same saved case and retrieve its previously uploaded evidence.
- An inferred material fact stays a candidate until an authorized user action confirms it.
- Conflicting user and document amounts produce a cited discrepancy and a follow-up question.
- An estimated completion date is not silently treated as a firm promise.
- New contradictory evidence triggers re-evaluation of affected facts and readiness.
- Every evidential assertion can be traced to its uploaded source and available location.
- Unsupported or uncertain statements remain identifiable in the final state.
- Procedural statements are traceable to official sources rather than model memory or historical reference assumptions.
- The harness produces structured readiness reasons and a saved frontend-consumable state, without crossing the stated pre-filing boundary.

- Missing evidence prompts alternative-evidence requests and a prominent acknowledgment, then permits proceeding with preserved warnings.
- Failed filing eligibility alone may produce a product-level hard stop; unknown eligibility must not be silently treated as failure or success.

- SGD 20,000 with no consent passes the amount check; SGD 20,000.01 with confirmed no consent fails; SGD 30,000 with consent from both parties passes; SGD 30,000.01 fails even with consent. These tests concern the amount check only.
- An unknown cause-of-action date permits export with eligibility unverified; it never silently yields eligibility passed.
- An acknowledged evidence conflict stays in the state and PDF warnings.
- Restart preserves both runtime conversation and structured application case data.

## State and API contract

Use Valibot to validate configuration, HTTP inputs, tools, extraction outputs, persisted domain records, and final snapshots. Reject malformed operations without interpreting validation errors as filing ineligibility.

Persist cases, parties (including multiple claimants/respondents), material facts, original file metadata/hashes, extraction results, fact-evidence relationships, questions, contradictions, eligibility checks, remedies, procedural requirements, warning acknowledgments, snapshots, and audit events. Evidence originals remain immutable during the case lifetime; explicit case deletion removes them.

Each fact records source type/message, user review status, evidence assessment, supporting/contradicting references, and revision. Confirmation changes review status only. Extractions are model outputs, not automatically true or user-confirmed facts. Preserve document/page references, quoted text, and image/message locations where available. Missing or unreadable pages must be recorded; never claim the whole file was inspected when only part was processed.

The final snapshot includes a schema version, case revision, snapshot ID/name, creation time, dispute classification, parties, claims/remedies, facts, timeline, evidence index, unresolved questions, contradictions, procedural checks with citations/retrieval status, review/acknowledgment records, and readiness reasons.

Keep `eligibilityStatus` (`PASS | FAIL | UNVERIFIED`), `preparationStatus`, `userReviewed`, and `canProceed` distinct. `FAIL` disables ready handoff; `UNVERIFIED` is nonblocking with prominent disclosure. Required missing facts and acknowledged conflicts remain visible even after preparation ends. `READY_WITH_WARNINGS` must not imply every check passed. Preserve source readiness labels as diagnostic reasons where useful, not additional hard gates. A final warning acknowledgment is a deliberate user action, not an indefinite agent refusal.

Proposed API resources: `/cases`, `/cases/:caseId`, `/cases/:caseId/evidence`, `/cases/:caseId/turns`, `/cases/:caseId/facts/:factId/review`, `/cases/:caseId/warnings/:warningId/acknowledge`, `/cases/:caseId/snapshots`, and snapshot-specific PDF generation/download. Resolve exact routes with Flue’s native transport to avoid duplicating its conversation machinery. Streaming must carry stable event IDs, case revision, text deltas, processing status, state updates, and recoverable errors. Reconnection or retry must not duplicate a user turn or mutation. Publish a concise integration example for the frontend.

Serialize mutations per case; use revision checks for stale edits and confirmations. Cancel/wait for active work during deletion so late model responses cannot recreate a deleted case. Case revisions bind evidence review, acknowledgments, and PDF generation. Filesystem paths are generated by the backend, never trusted from uploaded filenames.

## Agent and extraction implementation

Implement the source tool set: get/update case state, propose fact, list/inspect/extract/find files, verify fact against evidence, link evidence, detect contradictions, track/resolve questions, retrieve official guidance, check preparation, and save final state. Do not offer an unrestricted tool that marks a material candidate user-confirmed.

Use one main Flue agent with Pi provider integration. Gemini extraction is a bounded tool call, not a second autonomous conversational agent. Use native PDF input where supported by the selected OpenRouter route; otherwise render pages for Gemini vision while preserving page numbers. Verify modality and structured-output compatibility with representative fixtures. No silent provider/model substitution. Expose rate limits and provider failures as retryable processing failures, preserving state.

Mount a repository-local Typst skill on the application agent. Implementation deliverables include `server/skills/typst/SKILL.md`, a reusable case-summary template adapted from the supplied worksheet, and a bounded compilation tool. The skill must explain how to populate the template from snapshot data, preserve citations/uncertainty, avoid unsupported prose, and inspect compilation output. Treat case text as data, not executable Typst. Restrict compilation to the artifact workspace with time/resource limits; return a stored PDF reference, not arbitrary shell execution. Compilation failure does not corrupt the snapshot.

## Procedural checks

Cover monetary limit and consent, relevant date/time limit, respondent location/service inputs, category eligibility and exclusions, applicable statutory conditions, required party particulars, and special-document requirements. Record rule source, version, checked date, result, and inputs. Resolve legal ambiguities as `UNVERIFIED` rather than inventing a definitive failure. Use authoritative Judiciary/CJTS and Singapore Statutes Online sources. Retrieve through a bounded allowlist, including redirect validation.

Only known failures against applicable verified eligibility rules hard-block. Do not use model confidence alone as a jurisdictional decision. Preserve the distinction between an excluded dispute and an unsupported allegation. The source rule examples are a starting point, not an exhaustive legal engine.

## Delivery sequence

1. Bootstrap Node/TypeScript, lint/typecheck scripts, Valibot configuration, Flue/Pi, file-backed `db.ts`, application SQLite migrations, and environment sample.
2. Implement case/evidence persistence and frontend API/stream contract, with shared demo access and explicit deletion.
3. Integrate Muse conversation/tools and Gemini PDF/image extraction; verify provenance and durable recovery.
4. Implement six case schemas, CPFTA checks, generic intake, official retrieval, eligibility evaluation, and the one-final-warning flow.
5. Implement revision-bound review, snapshots, Typst skill/template/compiler, PDF download, and superseded-version presentation metadata.
6. Run acceptance fixtures and provide setup and frontend-integration documentation.

## Verification and definition of done

Required checks: TypeScript typecheck, lint, focused domain/API tests, restart/retry tests, and representative provider integration smoke tests once credentials are available. Provider integration remains untested until those calls succeed.

Acceptance scenarios include all amount boundaries above; unverified date/official retrieval; missing evidence followed by one final acknowledgment; estimated versus firm deadline; company-name mismatch; goods/services plus CPFTA overlap; motor-deposit versus vehicle-damage distinction; generic intake outside the six templates; partial PDF extraction; prompt-like instructions in uploaded evidence treated only as evidence content; state recovery after interruption; stale confirmation rejection; snapshot supersession; and complete case deletion during processing.

Compile representative clean and warning-heavy PDFs, extract their text, and inspect rendered pages for clipping, missing warnings, broken citations, long names, and multi-page tables. Verify each exported PDF matches its saved snapshot. Successful preparation must be possible with acknowledged gaps and unverified eligibility, and impossible to mislabel as filing-ready after a known eligibility failure.

## Configuration and verified provider references

`server/.env.sample` is the proposed configuration contract; backend loading/validation is an implementation deliverable. Empty API keys are intentional. Do not commit real `.env` files or database/evidence artifacts.

- [OpenCode Go](https://opencode.ai/docs/go/) lists `muse-spark-1.3-contributor` at `/zen/go/v1/responses`. Include a specific application identity and per-conversation `x-opencode-session` header as documented. Availability depends on account/region and must be tested. Its Contributor offering permits training on prompts/completions and is not zero-data-retention; local case deletion does not remove provider-held data.
- [OpenRouter Gemini 3.8 Flash](https://openrouter.ai/google/gemini-3.8-flash) documents `google/gemini-3.8-flash`. Use the separate OpenRouter key. Verify actual PDF/image transport through this route rather than assuming all provider protocols are interchangeable.

## Final review

All interview product questions are answered. Final confirmation covers the consolidated PRD and the explicit implementation defaults (including filesystem-safe snapshot naming). No runtime implementation, model calls with case data, or deployment has been performed.
