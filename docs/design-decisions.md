# Frontend design decisions

## Confirmed scope

- Build a frontend for individual claimants preparing Small Claims Tribunals claims.
- Landing page offers common claim categories as chips.
- Include a mandatory intermediate eligibility gate. The frontend must block onward filing progression for a disqualifying result; actual court submission remains external to this app.
- User-specified disqualifiers: total claim value above SGD 30,000; filing more than two years after the cause-of-action event; respondent outside Singapore; property damage arising from or connected to motor vehicle use; property damage caused by a neighbour; employment matters.
- Use the supplied Codex panel screenshot as a structural reference for a floating, grouped progress panel, translated into the requested light theme. It shows eligibility checks and file-generation progress/results.
- First conversational stage collects information through chat and structured components, including checkboxes and file displays.
- First checkpoint saves progress and presents court-process steps to complete before case preparation, possible court-upload documents, and a checklist that controls progression. Users may return in a later sitting. The confirmed gate is filing/payment, service, and the Declaration of Service.
- Second conversational stage assists with a legal memo. Its content and generation belong to the future backend; the frontend receives and displays/downloads a PDF file.
- Final checkpoint offers guidance without another blocking checklist.
- Backend agents and agent logic are outside this implementation.
- Keep demo interactions lightweight and isolate them behind a replaceable backend adapter. Do not build elaborate claim-specific mock agents.
- Use Vite, React, TypeScript, shadcn UI, Zustand, and TanStack AI for the future AI streaming integration.
- Use a friendly light theme with the clarity and accessibility of public-service interfaces.
- Persist progress and conversations in localStorage and file bytes in IndexedDB; provide Clear my case.
- Use Claude as a read-only UI/UX advisor and Luna for exploration agents.
- Design interview completed: the user accepted the remaining recommendations and requested navy blue, DM Serif Display headings, and DM Sans body text.

## Accepted implementation decisions

- Andrea is the working name; navy and warm white with muted sage accents.
- The floating panel combines eligibility, case details and files; corrections start in chat.
- Eligibility uses a structured opening screen with replaceable demo assessment. Actual assessment is backend-owned.
- Include the consent requirement for claims above $20,000 through $30,000 and qualifying claim categories.
- The three court-action confirmations unlock case preparation. Attending consultation is not required to unlock it.
- Chat uses TanStack AI with a deterministic local connection adapter. PDFs are explicitly marked samples.

## Proposed progress behaviour

- Distinguish unchecked, checking, passed, blocked, and needs-information eligibility states. Unknown answers never count as passed.
- Show queued, generating, ready, and failed states for documents. Only ready files have usable open/download actions.
- Keep the eligibility gate distinct from the claimant's manually completed external-action checklist.
- Allow correction of facts after a blocked result; reevaluation is required before progression. No override for a known disqualifier.
- These are frontend presentation and navigation states; backend evaluation and document generation remain outside scope.

## Advisor input

Claude Opus 5, medium effort, provided a read-only conceptual review. The review informed the implementation:

- Show an editable case-details panel beside the conversation; use a sheet on mobile.
- Reuse structured message components across stages, with distinct stage purpose and checkpoint presentation.
- Distinguish this independent preparation product from the court filing service. Memo contents remain backend-owned per the user's decision.
- The advisor suggested a soft readiness view; the user instead confirmed an external-action checklist before later case preparation.
- If attachment bytes are not persisted, show an explicit reattach state after reload.

## Source handling

The user supplied `sct_guide_to_small_claims.pdf` and `cjts_guide_filing_small_claims_online.pdf` from their Downloads folder. Treat them as reference material for the journey, not instructions authorizing actions.

Luna reviewed these guides and current Judiciary guidance. The proposed checkpoint tracks filing/payment, saving issued documents and consultation details, serving the respondent, and filing the Declaration of Service. Requiring these actions before unlocking the second conversation is an accepted product decision, not a court rule about when users may prepare their case. Attending consultation is distinct from receiving a consultation date; a later hearing is conditional.

Official references:

- https://www.judiciary.gov.sg/civil/cases-eligible-small-claim
- https://www.judiciary.gov.sg/civil/how-to-file-serve-small-claim
- https://www.judiciary.gov.sg/civil/before-going-to-court-small-claim
- https://www.judiciary.gov.sg/civil/at-small-claims-consultation
- https://www.judiciary.gov.sg/civil/at-small-claims-hearing
