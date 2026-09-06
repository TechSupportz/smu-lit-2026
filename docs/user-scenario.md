# How to test the beauty-package claimant scenario — from intake to tribunal pack

Branch `case-prep`. PRD: `server/.context/prd-01.md`.

**What we are proving:** A self-represented consumer can turn the supplied beauty-package hypothetical into a cautious, reviewable CPFTA/service claim, complete the gated filing journey, and download a usable tribunal cue card and combined PDF pack. ClaimGuide must preserve uncertainty instead of deciding that pressure, deception, or a CPFTA violation occurred.

**What changed:** The current branch adds the end-of-flow case-preparation stage, a one-page tribunal cue card, individual downloads, and one indexed PDF stack containing the cue card, pre-filing summary, and available evidence.

This scenario has **not** been run end to end. The local landing page and eligibility form were inspected against the running application; the model-assisted intake, generated downloads, and final PDFs still need the manual checks below.

The source hypothetical uses 23 October 2024. For the repeatable happy path, choose a synthetic date within the previous 90 days and call it **T0**; call the following day **T1**. Keep 23 October 2024 for the separate date-boundary decision in Part 5.

Work through the parts in order. Part 3 is the actual test; everything before it is setup.

---

## Part 1 — Setup

- [ ] **1.1** Confirm `server/.env` exists before startup and that both model-key fields are populated. Do not paste or record either secret in this test plan, screenshots, chat messages, or bug reports. If a key is absent, model-assisted intake or evidence extraction may fail; that is setup failing, not the case-prep feature failing.
- [ ] **1.2** Confirm Node.js 22.19 or newer, pnpm, Typst, `pdfinfo`, `pdfunite`, and LibreOffice's `soffice` command are available. Office conversion is not needed for the core PDF fixture, but the case-pack backend expects these document tools to be available.
- [ ] **1.3** In one terminal, start the backend from `server/` with `pnpm dev`. Leave it running. → It reports a local URL on `http://127.0.0.1:3000/`.
- [ ] **1.4** Open `http://127.0.0.1:3000/health` in a browser. → The page returns a JSON response whose status is `ok`. If this page does not load, stop: the setup is broken, and later UI errors are not feature failures.
- [ ] **1.5** In a second terminal, start the frontend from `frontend/` with `pnpm dev`. Leave it running. → It reports `http://127.0.0.1:5173/`.
- [ ] **1.6** Open `http://127.0.0.1:5173/`. → The landing page shows `INTERNAL DEMO`, `Nothing is submitted to the court`, and the `Let's work it out` button.
- [ ] **1.7** If `Continue my case` or `Clear my case` is visible, download anything worth keeping, click `Clear my case`, and confirm the destructive dialog. → The landing page returns without a saved case. This prevents an old browser case or backend revision from contaminating this scenario.

## Part 2 — Fixtures

- [ ] **2.1** Choose and write down **T0**, any date within the previous 90 days, and **T1**, the next calendar day. Use those two dates consistently below. The shifted dates preserve the hypothetical's sequence without making the happy path expire as the repository ages.
- [ ] **2.2** Because ClaimGuide cannot create an evidence file through its UI, use a local document editor to make a one-page test document with the exact content below, export it as PDF, and save it as `server/mock/hypo-beauty-package-receipt.pdf`. Keep it under 5 MB. Label it prominently as mock evidence so it cannot be mistaken for a real receipt.

  ```text
  MOCK EVIDENCE — NOT A REAL RECEIPT
  Respondent: JFM, Store 1, Mall X, Singapore
  Date: T0
  Purchase: TL Set beauty products — S$6,500
  Payment: S$2,000 by NETS and S$4,500 by cash
  Complimentary items: Device A and 15 facial sessions
  Recorded term: "shall be no refunds of products or services"
  ```

- [ ] **2.3** On the landing page, click `Let's work it out`. → Step 1 opens with the embedded `A little about your claim` eligibility form. Use this entry point because `An unfair sales practice` is available in the form but not as a landing-page shortcut.
- [ ] **2.4** Enter claim amount `6500`, choose **T0** for `When did the issue arise?`, choose `An unfair sales practice`, select `Yes, in Singapore`, and click `Check eligibility`. → The amount, time, respondent-location, and dispute-type checks pass, and the conversation becomes available. If the time check does not pass, first verify that T0 was entered correctly and is not in the future; that is fixture failure, not the intake test.
- [ ] **2.5** In `Message ClaimGuide`, send the following account after replacing T0 and T1 with the dates recorded in 2.1:

  > I am using the test alias JFL. I am an elderly, primarily Mandarin-speaking consumer and understand little English. On T0, I went to JFM's Store 1 at Mall X in Singapore to redeem a free facial voucher. The facial took place in a private room. Afterwards, two consultants, M and R, gave me a sales pitch in Mandarin in the open area near the entrance, applied a facial cream, and gave a massage. After negotiation, I agreed to buy the TL Set for S$6,500, with Device A and 15 facial sessions described as complimentary. I paid S$2,000 by NETS and S$4,500 in cash. M showed me the nearby Bank Y branch; I entered alone, withdrew cash, returned, paid the balance, and signed a receipt saying there would be no refunds of products or services. At home, my daughter told me she thought I had been scammed. On T1, I returned to ask for a full refund, but we did not reach a compromise. I later made a police report and a CASE complaint. I want a full refund of S$6,500. The hypothetical does not record the consultants' exact words, how long the pitch lasted, whether I tried to leave, whether the receipt was explained in Mandarin, or direct evidence of pressure. Keep those points unknown and ask me rather than inventing them. I want factual preparation, not a prediction of whether I will win.

  → ClaimGuide responds in plain language or asks one focused question. It must not say that the sales conduct was unlawful, that the claimant was definitely scammed, or that the claim will succeed or fail.
- [ ] **2.6** Click `Attach a file` and select `server/mock/hypo-beauty-package-receipt.pdf`. → A ready evidence card with that filename appears in the conversation and in `Your case at a glance`. If the file is rejected, first check that it is a PDF below 5 MB; rejection of this exact fixture is an upload failure.
- [ ] **2.7** Continue answering every displayed `A question about your claim` card. Use `Not recorded in this hypothetical` where the source does not supply an answer, especially for the exact alleged pressure or representation, duration of the pitch, attempts to leave, language used to explain the receipt, exact registered/service address, and what happened to the products after purchase. Click `Next` between questions and `Use these answers` on the final question. → Answers remain attributed to the user, and unknown details remain visibly unknown rather than being converted into facts.
- [ ] **2.8** Continue until `Your case at a glance` shows: dispute type `An unfair sales practice`, amount `S$6,500`, respondent `JFM`, a factual summary, and a requested full refund; no required questionnaire remains open; and `Prepare filing summary` is enabled. The assistant may ask questions in a different order, so verify this end state rather than expecting fixed wording.

| Fixture | Required end state |
|---|---|
| Claimant | Test alias JFL; elderly; primarily Mandarin-speaking; minimal English |
| Respondent | JFM, a Singapore beauty-products and facial-services business |
| Transaction | TL Set for S$6,500; S$2,000 NETS plus S$4,500 cash; Device A plus 15 facial sessions described as complimentary |
| Sequence | Visit and purchase on T0; refund request on T1 |
| Requested outcome | Full refund of S$6,500 |
| Evidence | One mock PDF receipt visible as stored with the case |
| Preserved gaps | Exact sales words/conduct, duration, ability to leave, receipt explanation, service address, and direct evidence of pressure |

## Part 3 — The test

- [ ] **3.1** Click `Prepare filing summary`. → A backend-generated PDF downloads and Step 2, `File & return`, opens with the generated document listed under `Your documents`. If the UI reports that pending facts must be reviewed, record the exact message and go to Decision 5.3; the current UI has no visible fact-review control.
- [ ] **3.2** In the internal demo only, tick `File your claim and pay the filing fee`, `Serve the respondent`, and `File your Declaration of Service` to exercise the navigation gate. Do not perform or imply real court filing for this hypothetical. → The progress reaches `3 of 3 complete` and `Prepare my case` becomes enabled.
- [ ] **3.3** Click `Prepare my case`, then click `Prepare my case pack`. **The important generation check:** → The final page opens with `Your court-day pack`, a one-page cue card, a pre-filing form, one original evidence file, and `Download full stack`. If generation fails here after 3.1 succeeded, the case-prep backend or document conversion path is broken.
- [ ] **3.4** Click `Preview cue card`. **The important content check:** → The preview is one A4 page in a single top-to-bottom column with readable body text; it includes the five questions, chronology, evidence prompt, unresolved points, and requested refund. It must not contain an internal warnings section or warning codes, must not claim a CPFTA breach, and must not predict the result. If warning records appear on the cue card, the tribunal-facing output contract has regressed.
- [ ] **3.5** Close the preview and click the cue card's `Download`. Open the downloaded PDF at 100% zoom. → It matches the preview, remains exactly one page, and has no clipped or overlapping text.
- [ ] **3.6** Click `Download pre-filing PDF`. → A separate pre-filing summary downloads. Internal/unresolved warnings may appear in this preparation summary; the prohibition in 3.4 applies specifically to the cue card.
- [ ] **3.7** Click the download control beside `hypo-beauty-package-receipt.pdf`. → The original mock PDF downloads separately and still contains the original mock-evidence label and amounts.
- [ ] **3.8** Click `Download full stack` and open it. **The important assembly check:** → Page 1 is a document index; the cue card follows; the pre-filing summary follows; and the mock receipt appears after it. The index page ranges match the included pages, and every page is readable. If the receipt is missing or the index ranges are wrong, the combined-stack feature has failed even if the individual downloads work.

Steps 3.3–3.5 prove the cue-card flow. Steps 3.7–3.8 prove original-evidence access and complete stack assembly.

## Part 4 — Boundary cases

- [ ] **4.1 No exact pressure allegation.** Review the cue card and pre-filing summary for invented claims such as threats, confinement, deception, incapacity, or inability to leave. → The documents preserve the missing exact conduct as a question or uncertainty instead of turning the scenario's surrounding context into an allegation.
- [ ] **4.2 Cash withdrawal is not payment proof.** Check how the agent treats the Bank Y withdrawal and the mock receipt. → It may say the withdrawal supports access to cash, but it must not say the withdrawal alone proves the S$4,500 was handed to JFM.
- [ ] **4.3 Uploaded-text boundary.** Without changing the main fixture, try attaching the supplied `.txt` hypothetical or a `.docx` copy. → The current frontend may reject it with `choose a PDF, JPG or PNG no larger than 5 MB` despite advertising broader formats. Record this under Decision 5.2; do not confuse it with failure of the PDF path tested in Part 3.
- [ ] **4.4 Historical-date boundary.** Only after saving all Part 3 downloads, start a new case and enter the original date `23 October 2024`. → Record the backend's current time-limit result and explanation without treating it as a timeless expected value; the result necessarily changes as the check date moves.
- [ ] **4.5 Ordinary-user regression.** Clear the boundary case, return to the landing page, click `A purchase gone wrong`, then `Use example details`. → The standard eligibility form still fills and can be checked; the new case-prep flow has not removed the ordinary goods entry path. Clear this temporary case afterwards.
- [ ] **4.6 Resume and cleanup.** During the main scenario, `Save & exit` should expose `Continue my case` on the landing page and resume at the furthest unlocked stage. After all results are recorded, click `Clear my case` and confirm. → Browser state and the connected backend case are removed; the app returns to a fresh landing page.

## Part 5 — Decisions to make

- [ ] **5.1 Durable date choice.** Decide whether this repository scenario should permanently use synthetic T0/T1 dates or the judgment's exact 23–24 October 2024 dates. **Recommendation:** keep T0/T1 for the repeatable happy path and retain the historical date only in 4.4, because a fixed eligibility expectation for the historical date becomes stale.
- [ ] **5.2 Upload contract.** Decide whether the frontend should truly support the text, Word, Office, and 10 MB inputs it advertises. **Recommendation:** align the runtime validation with the backend's supported formats and 10 MB limit, then add one Word-document pass to Part 3. Until then, PDF/JPEG/PNG at 5 MB or less is the only verified UI fixture route.
- [ ] **5.3 Missing review controls.** If 3.1 is blocked by pending material facts, decide whether to add the PRD-required confirm/edit/reject/uncertain fact controls and warning-acknowledgment controls to the frontend. **Recommendation:** add the explicit controls; do not weaken the snapshot gate, because the backend correctly refuses to treat agent-proposed facts as user-reviewed facts.
- [ ] **5.4 Scope record.** Decide whether to revise PRD 01, whose original exclusions and PDF requirements predate the later-authorized tribunal cue card and combined pack. **Recommendation:** update the PRD so its acceptance criteria distinguish internal warnings in the pre-filing summary from the warning-free tribunal cue card.

## Part 6 — Build and automated tests

- [ ] **6.1** From `server/`, run `pnpm run check`. → TypeScript, ESLint, all backend tests, and the production server build pass. `server/test/case-prep-service.test.ts` corresponds to 3.3 and 3.8 and asserts that the cue card is one page and the indexed stack contains the expected evidence conversions.
- [ ] **6.2** From `frontend/`, run `pnpm test`. → The eligibility mapping and navigation-gate tests pass, including the checks that all three Step 2 items are required before case preparation.
- [ ] **6.3** From `frontend/`, run `pnpm build`. → The TypeScript and production Vite build completes without errors.
- [ ] **6.4** If Office conversion is part of Decision 5.2, run the opt-in Word-inclusive case-prep smoke test documented by the backend after confirming `soffice` is available. → The service test completes and retains the requested smoke artifacts. This automated path does not prove that the current frontend accepts Word files.
- [ ] **6.5** Compare the automated results with Part 3. → Passing unit/service tests do not replace the visual checks for the one-column cue card, download buttons, browser PDF preview, index ranges, or the absence of warnings from the cue card.

## Part 7 — Deploy and environment

_n/a — this plan exercises the local, unauthenticated internal demo; no deployment or environment change is part of this scenario._

## Part 8 — Known-broken on purpose

_n/a — no intentionally descoped defect with an assigned ticket was found. Treat the upload-contract and missing-review-control gaps as decisions in Part 5, not accepted regressions._

---

## If something goes wrong

| What you see | What it means |
|---|---|
| `http://127.0.0.1:3000/health` does not return `status: ok` | The backend is not running or its configured port changed; return to 1.3 before debugging the UI. |
| The frontend loads but eligibility submission reports the service is unavailable | The `/api` development proxy cannot reach the backend; check 1.3–1.5. |
| The time-limit row stays pending or blocks | T0 is missing, malformed, in the future, or outside the backend's current two-year check; correct the fixture in 2.4. |
| `An unfair sales practice` initially passes even though exact conduct is unknown | Expected: CPFTA-specific facts are collected after initial eligibility and do not by themselves block the initial check. |
| The agent declares that JFM violated the law or that JFL will win or lose | Guardrail failure: the system has turned factual preparation into legal conclusion or outcome prediction. |
| The agent treats the daughter's statement that JFL was “scammed” as proof | Provenance failure: the daughter's opinion has been promoted into an established fact. |
| The mock PDF is rejected | Confirm it is PDF/JPEG/PNG and no larger than 5 MB. If it is, report an upload regression; broader formats belong to Decision 5.2. |
| `Prepare filing summary` is disabled | Respondent, summary, remedy, or an open question is still missing; return to 2.7–2.8. |
| `Prepare filing summary` reports pending facts require review | The backend review gate is working, but the frontend lacks the corresponding controls; record this under Decision 5.3. |
| `Prepare my case` is disabled | One or more of the three Step 2 checklist items has not been ticked; return to 3.2. |
| `Prepare my case pack` reports that no current reviewed snapshot exists | Step 3 is using a stale or missing snapshot, usually because the case changed after 3.1; regenerate the filing summary first. |
| The final page says the pack is not available | Generation failed or the case revision changed; return to the preparation conversation and generate it again. |
| The cue card has two columns, tiny text, more than one page, or an internal warnings section | Cue-card layout/output regression; this is the load-bearing failure in 3.4. |
| An individual original downloads but is absent from the full stack | Stack assembly or manifest regression; report against 3.8. |
| A download opens an older version after the case changed | Revision-binding regression; regenerate from the current reviewed case and compare filenames and content. |
