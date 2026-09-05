# SCT Pre-Filing Agent Harness — Build Specification

## 1. Goal

Build a **Flue-based agent harness** that helps a self-represented person prepare the information and evidence needed before filing a claim with Singapore's Small Claims Tribunals (SCT).

The harness is **not the frontend** and should not try to reproduce the full CJTS interface.

Its primary job is to:

1. maintain structured case state;
2. inspect uploaded evidence;
3. cross-check user statements against evidence;
4. identify inconsistencies, missing information and unsupported claims;
5. challenge the user's assumptions instead of simply agreeing;
6. reference supporting files and specific evidence;
7. optionally verify procedural information against authoritative SCT sources;
8. determine when the pre-filing information is sufficiently complete;
9. save a clean final state for the frontend to use.

The frontend will handle the actual user experience, forms, navigation and presentation.

---

# 2. Scope

## In scope

The harness should support:

* conversational fact collection;
* case-state persistence;
* evidence/document verification;
* receipts;
* invoices;
* quotations;
* contracts;
* WhatsApp/chat messages;
* emails;
* screenshots;
* photographs;
* other uploaded supporting documents;
* extracting dates, amounts, parties and statements;
* cross-checking user statements against files;
* identifying contradictions between:

  * user statements;
  * different documents;
  * dates;
  * monetary amounts;
  * parties;
* tracking fact provenance;
* identifying missing evidence;
* asking follow-up questions;
* challenging unsupported assumptions;
* preliminary SCT/pre-filing checks;
* checking that required claimant/respondent information is available;
* checking that remedy information is available;
* checking special document requirements;
* generating a final structured pre-filing state;
* retrieving/reference official SCT procedural guidance when necessary.

---

# 3. Explicitly out of scope

Do NOT build:

* hearing preparation;
* consultation preparation;
* cue cards;
* scripts for what the claimant should say;
* litigation strategy;
* argument coaching;
* witness preparation;
* post-filing case preparation;
* prediction of whether the user will win;
* autonomous submission to CJTS;
* payment;
* service of documents;
* Declaration of Service filing;
* post-filing case monitoring.

The harness ends when the user has:

> a verified, internally consistent, sufficiently complete pre-filing case state that the frontend can use to guide the user through the official CJTS filing process.

---

# 4. High-level architecture

```text
User input + uploaded evidence
            │
            ▼
      Flue Agent Harness
            │
      ┌─────┴─────┐
      │           │
      ▼           ▼
 Case State    Evidence Store
  SQLite        Uploaded Files
      │           │
      └─────┬─────┘
            ▼
       Agent Tools
            │
  ┌─────────┼───────────┐
  │         │           │
  ▼         ▼           ▼
Extract   Verify      Retrieve
facts     evidence    official info
  │         │           │
  └─────────┼───────────┘
            ▼
     Cross-check state
            │
      inconsistencies?
       /           \
     yes            no
      │              │
      ▼              ▼
 Ask/grill user   Continue flow
      │              │
      └──────┬───────┘
             ▼
        Update SQLite
             │
             ▼
     Pre-filing complete?
         /        \
       no          yes
       │            │
       └── repeat   ▼
              Final verified
               case state
```

---

# 5. Core principle

The LLM is allowed to reason.

The LLM is **not allowed to freely decide what is true**.

Use this mental model:

```text
LLM
= conversation + reasoning + investigation

SQLite
= official state of the case

Uploaded documents
= evidence

User confirmation
= authority for uncertain/user-supplied facts

Official Judiciary sources
= authority for procedural rules
```

---

# 6. Flue runtime

Use:

```text
Flue
└── Pi runtime
    └── configured LLM
```

Use one main agent:

```text
SCTPreFilingAgent
```

Do not build a multi-agent swarm unless there is a clear later need.

The agent should be able to:

* move backwards and forwards through the pre-filing process;
* inspect the current case state;
* inspect previously uploaded evidence;
* ask additional questions;
* revisit previously entered facts;
* detect when new evidence contradicts earlier information;
* update unresolved issues;
* determine whether required information remains missing.

---

# 7. SQLite state

SQLite should persist the case across turns.

Suggested core tables:

```text
cases
parties
facts
evidence_documents
evidence_extractions
fact_evidence_links
questions
contradictions
eligibility_checks
remedies
procedural_requirements
audit_events
```

---

# 8. Case stage

Maintain a rough internal stage.

```ts
type PreFilingStage =
  | "intake"
  | "eligibility"
  | "parties"
  | "claim_details"
  | "evidence"
  | "remedy"
  | "verification"
  | "final_review"
  | "complete";
```

The agent may revisit previous stages whenever new information changes the case.

Example:

```text
evidence
   ↓

receipt conflicts with user's claimed amount
   ↓

claim_details
   ↓

ask user to resolve discrepancy
   ↓

evidence
```

The flow is intentionally non-linear.

---

# 9. Fact model

Every material statement should have provenance.

```ts
interface Fact {
  id: string;
  caseId: string;

  statement: string;

  sourceType:
    | "user"
    | "document"
    | "ai_inference";

  status:
    | "asserted"
    | "candidate"
    | "confirmed"
    | "supported"
    | "contradicted"
    | "uncertain"
    | "rejected";

  sourceMessageId?: string;

  evidenceIds: string[];

  createdAt: string;
  updatedAt: string;
}
```

Never store:

```text
"Contractor promised completion on 14 June"
```

without also knowing:

```text
Where did this come from?
Who asserted it?
What evidence supports it?
Has the user confirmed it?
Does any document contradict it?
```

---

# 10. Important invariant

```text
AI inference ≠ case fact
```

If the AI infers:

> "It sounds like 14 June may have been the completion deadline."

store it as:

```text
sourceType = ai_inference
status = candidate
```

It must not silently become a confirmed fact.

---

# 11. Evidence model

For every uploaded file, store:

```ts
interface EvidenceDocument {
  id: string;
  caseId: string;

  filename: string;
  mimeType: string;

  storageKey: string;

  originalHash: string;

  uploadedAt: string;
}
```

The original file should remain immutable.

---

# 12. Evidence extraction

Extract useful structured information such as:

```text
dates
amounts
names
companies
addresses
contract terms
messages
payment references
claimed obligations
document titles
```

Store provenance:

```ts
interface EvidenceExtraction {
  id: string;
  evidenceId: string;

  type:
    | "date"
    | "amount"
    | "party"
    | "statement"
    | "contract_term"
    | "address";

  value: string;

  page?: number;
  quote?: string;

  confidence?: number;
}
```

For messages/screenshots, preserve enough source location information to show the user where the information came from.

---

# 13. Fact ↔ evidence relationships

Maintain explicit mappings.

```ts
interface FactEvidenceLink {
  factId: string;
  evidenceId: string;

  extractionId?: string;

  relationship:
    | "supports"
    | "contradicts"
    | "context"
    | "unclear";

  status:
    | "agent_proposed"
    | "user_confirmed"
    | "rejected";
}
```

Example:

```text
Fact:
"User paid $8,000"

receipt.pdf
→ supports

bank_statement.pdf
→ supports


Fact:
"Completion deadline was 14 June"

quotation.pdf
→ unclear

because document says:
"Estimated completion: 14 June"
```

---

# 14. Agent's main job: grill the case

The agent should continuously ask:

```text
Does this statement have evidence?

Does the evidence actually say what the user claims it says?

Do dates match?

Do amounts match?

Are the same parties named across documents?

Is this a fact or an interpretation?

Is there conflicting evidence?

Is something important missing?

Could the user be assuming something that the documents do not establish?
```

Example:

User:

> "They promised to finish on 14 June."

Document:

> "Estimated completion: 14 June."

Agent:

> The quotation describes 14 June as an "estimated completion" date rather than clearly stating it as a firm deadline. Was a firm deadline agreed elsewhere, such as through WhatsApp or email?

This is the desired behaviour.

---

# 15. Contradiction detection

Create explicit contradiction records.

```ts
interface Contradiction {
  id: string;

  caseId: string;

  description: string;

  factIds: string[];
  evidenceIds: string[];

  severity:
    | "low"
    | "medium"
    | "high";

  status:
    | "open"
    | "resolved"
    | "accepted_uncertainty";
}
```

Examples:

```text
User says payment = $8,000
Receipt says payment = $6,000

User says agreement signed 2 June
PDF signed date = 5 June

User says ABC Renovations Pte Ltd
Invoice issued by ABC Renovation LLP
```

The agent should raise these rather than silently selecting one value.

---

# 16. Open questions

Track unresolved issues.

```ts
interface OpenQuestion {
  id: string;
  caseId: string;

  question: string;
  reason: string;

  relatedFactIds: string[];

  priority:
    | "required"
    | "important"
    | "optional";

  status:
    | "open"
    | "answered"
    | "unresolved";
}
```

Examples:

```text
Was 14 June a firm deadline?

How was the $3,500 loss calculated?

Is ABC Renovation LLP the actual contracting party?

Do you have proof that the second payment was made?
```

---

# 17. Preliminary filing information the harness must track

The official CJTS flow starts with a pre-filing assessment before opening the Claim Form. The historical guide requires users to identify the nature of dispute, date of cause of action, claim amount and respond to adaptive questions regarding the parties and service.

Track at least:

```text
nature of dispute
dispute subtype
date/cause of action
claim amount
claimant type
respondent type
basic party relationship
respondent location
whether respondent can potentially be served
```

---

# 18. Dispute classification

The harness should collect the user's dispute description and help classify it into the appropriate SCT category.

Do not make classification irreversible.

Store:

```ts
{
  category: "...",
  subtype: "...",
  confidence: 0.88,
  userConfirmed: true
}
```

If there is ambiguity, ask.

The historical guide also notes that claims against the same party spanning different main dispute categories may need to be filed separately.

---

# 19. Official CJTS pre-filing assessment

The harness does not replace CJTS's own assessment.

Track:

```text
official_prefiling_assessment_completed
prefiling_reference_id
prefiling_reference_created_at
```

The supplied historical CJTS guide says the Pre-filing Reference ID is required to begin the Claim Form and was valid for seven days.

Because this source is from 2022, treat expiry durations as configurable procedural information rather than permanent hard-coded rules.

---

# 20. Claimant information

Track:

```text
full name
identification type
identification number
primary contact
secondary contact if relevant
email
service/registered address
additional claimants
additional service addresses
```

These reflect the fields described in the supplied CJTS guide.

The frontend is responsible for presenting/editing these.

The harness's responsibility is checking completeness and consistency.

---

# 21. Respondent information

Track:

```text
exact person/company name
identification type if known
NRIC / FIN / passport / UEN where applicable
phone number if known
email if known
registered/service address
additional respondents
additional service addresses
```

The historical CJTS guide includes these respondent particulars and indicates that mandatory fields depend on the live form.

A particularly important harness check is:

```text
Are we sure this is the correct respondent?
```

Compare:

```text
invoice name
contracting party
payment recipient
quotation issuer
ACRA information if supplied
WhatsApp identity/context
```

---

# 22. Service readiness

Before declaring the case pre-filing-ready, determine whether the user has enough information to identify and locate the respondent.

Track:

```text
respondent_identity_complete
respondent_address_available
respondent_in_singapore
service_readiness
```

The pre-filing questions in the historical CJTS guide include whether the opposing party can be located and served in Singapore.

Do NOT implement actual service.

This is only a readiness check.

---

# 23. Claim details

The harness should capture structured facts specific to the dispute.

Common fields:

```text
goods/services involved
agreement date
transaction date
amount paid
amount outstanding
event giving rise to dispute
relevant dates
what the respondent allegedly failed to do
what remains unresolved
```

The exact fields differ depending on the dispute type; the supplied CJTS guide explicitly does not provide one universal schema.

Therefore:

```text
do NOT hard-code the rental example as the universal schema.
```

Support dispute-specific schemas.

---

# 24. Brief summary information

The historical Claim Form contains a short Brief Summary of Claim with a 500-character limit.

The harness should maintain enough structured information for the frontend to construct this later:

```text
what was agreed
what happened
when it happened
what remains unresolved
what remedy is sought
```

The harness does not need to own the final UX or submission text.

---

# 25. Evidence requirements

Before completion, the harness should determine whether the user has provided relevant supporting material.

Potential evidence:

```text
contract
quotation
receipt
invoice
bank transfer
payment confirmation
WhatsApp export
email
photographs
inspection report
loss calculation
business records
```

The historical CJTS guide requires supporting documents to be categorised and accompanied by a description and relevant page reference.

Store:

```text
document type
description
relevant pages
facts supported
facts contradicted
```

---

# 26. Evidence upload preparation

The frontend may ultimately handle file conversion and upload rules, but the harness can expose readiness metadata.

The supplied 2022 guide states:

```text
PDF only
maximum 5 MB per document
restricted filename characters
document type
document description
relevant page
```

Because these are from an older guide, keep them configuration-driven rather than assuming they can never change.

---

# 27. Evidence privacy check

Flag potentially unnecessary sensitive material.

The supplied CJTS guide warns that entered information and uploaded documents are generally visible to the respondent, apart from identification numbers.

Useful harness output:

```text
privacy_review_required = true

possible_sensitive_content:
- unrelated bank transactions
- unrelated phone numbers
- unrelated personal conversation
```

Do not automatically alter evidence.

Just flag it.

---

# 28. Special documents

Track whether additional documents appear necessary.

Potential examples from the supplied filing guidance include:

```text
ACRA Business Profile
Memorandum of Consent
Letter of Authorisation
translations
dispute-specific documentation
```

The attached guide specifically notes an ACRA Business Profile where a claimant or respondent is not an individual.

Treat the exact current procedural requirements as configurable and verify them against current official materials.

---

# 29. Remedy

The user must know what they are asking the Tribunal for.

Track:

```text
money order
money amount
work order
work requested
alternative monetary value
costs if applicable
disbursements if applicable
other dispute-specific remedy
```

The historical CJTS guide allows more than one remedy type and lists money orders, work orders, costs and disbursements.

The harness should verify consistency.

Example:

```text
claim amount = $8,000

user says:
"I want $10,000 back"

→ discrepancy requiring clarification
```

---

# 30. Verification phase

Before setting:

```text
prefiling_complete = true
```

run a full verification pass.

Check:

## Parties

```text
claimant known
respondent known
respondent identity consistent across evidence
required addresses present
```

## Dates

```text
cause-of-action date available
important dates do not conflict
timeline internally coherent
```

## Money

```text
claim amount available
payment amounts verified where possible
claimed losses have an explanation
remedy amount matches claimed amount
```

## Facts

```text
material facts identified
important AI assumptions not promoted to facts
contradictions surfaced
unsupported assertions flagged
```

## Evidence

```text
documents indexed
important documents inspected
fact/evidence links created
unresolved document ambiguities flagged
```

## Filing information

```text
dispute category selected
claimant details complete
respondent details complete
service readiness checked
claim details complete
remedy selected
special documents considered
```

---

# 31. Human confirmation

The agent can propose.

The user confirms.

For important disputed/uncertain facts, expose:

```text
Confirm
Edit
Reject
Not sure
```

The agent should never have unrestricted authority to change:

```text
candidate
→ confirmed
```

for materially important facts.

---

# 32. Official procedural references

Provide a tool such as:

```text
retrieve_official_guidance(query)
```

Search only an allowlisted corpus, for example:

```text
Singapore Judiciary SCT pages
CJTS guidance
Courts' GenAI guidance
relevant official forms/guides
```

Use it for procedural questions.

Do not rely on the LLM's memory for:

```text
filing limits
time limits
document requirements
current form requirements
procedural rules
```

---

# 33. Core agent tools

Minimum tool set:

```text
get_case_state()

update_case_details()

propose_fact()

list_uploaded_files()

inspect_file()

extract_from_file()

find_in_files()

verify_fact_against_files()

link_fact_to_evidence()

find_contradictions()

list_open_questions()

add_open_question()

resolve_open_question()

retrieve_official_guidance()

check_prefiling_completeness()

save_final_prefiling_state()
```

---

# 34. Useful tool: verify_fact_against_files

Input:

```ts
{
  factId: string
}
```

Output:

```ts
{
  result:
    | "supported"
    | "partially_supported"
    | "contradicted"
    | "not_found"
    | "ambiguous",

  evidence: [
    {
      fileId: string,
      filename: string,
      page?: number,
      excerpt?: string,
      relationship: string
    }
  ]
}
```

This should be one of the central harness capabilities.

---

# 35. Useful tool: find_contradictions

Look across:

```text
user facts
document extractions
existing evidence links
```

Examples:

```text
amount mismatch

date mismatch

party-name mismatch

agreement wording mismatch

different versions of events
```

Output structured contradiction objects.

---

# 36. Final pre-filing state

When complete, produce something like:

```ts
interface FinalPreFilingState {
  caseId: string;

  complete: boolean;

  dispute: {
    category: string;
    subtype?: string;
    causeOfActionDate: string;
  };

  claimant: Party;
  respondents: Party[];

  claim: {
    amount: number;
    requestedRemedies: Remedy[];
  };

  facts: VerifiedFact[];

  timeline: TimelineEvent[];

  evidence: EvidenceSummary[];

  unresolvedIssues: Issue[];

  contradictions: Contradiction[];

  procedural: {
    prefilingAssessmentCompleted: boolean;
    prefilingReferenceId?: string;
    specialDocumentsRequired: Requirement[];
    serviceReadiness: string;
  };

  verification: {
    materialFactsReviewed: boolean;
    evidenceReviewed: boolean;
    contradictionsReviewed: boolean;
    userConfirmed: boolean;
  };
}
```

---

# 37. Completion status

Have explicit statuses:

```text
NOT_READY
NEEDS_USER_INPUT
NEEDS_EVIDENCE
NEEDS_CONFLICT_RESOLUTION
READY_WITH_WARNINGS
READY
```

This is better than a fake:

```text
82% ready
```

unless the frontend specifically wants a progress indicator.

---

# 38. Pre-filing completion definition

`prefiling_complete = true` only when:

```text
✓ dispute category established

✓ core eligibility/pre-filing inputs collected

✓ claimant details sufficiently complete

✓ respondent details sufficiently complete

✓ respondent/service readiness considered

✓ claim details collected

✓ claim amount established

✓ remedy selected

✓ material facts reviewed

✓ uploaded evidence indexed/reviewed

✓ material contradictions resolved or explicitly acknowledged

✓ important unsupported claims flagged

✓ required special-document checks performed

✓ mandatory open questions resolved or explicitly marked uncertain

✓ user has reviewed material factual information
```

Completion does NOT mean:

```text
the claim is legally correct

the claim will succeed

all allegations are proven

CJTS has accepted the claim
```

It means:

> The information required for pre-filing has been collected, checked and organised sufficiently for the frontend to proceed.

---

# 39. Final SQLite status example

```ts
{
  "stage": "complete",

  "checks": {
    "disputeClassification": "complete",
    "eligibilityInputs": "complete",
    "officialPrefiling": "complete",

    "claimantDetails": "complete",
    "respondentDetails": "complete",
    "serviceReadiness": "complete",

    "claimDetails": "complete",
    "remedy": "complete",

    "evidenceCollection": "complete",
    "evidenceVerification": "complete",

    "contradictions": "complete",
    "openQuestions": "complete",

    "specialDocuments": "complete",

    "userReview": "complete"
  },

  "prefilingComplete": true
}
```

---

# 40. Behaviour requirements

The agent MUST:

```text
ask instead of assume

challenge inconsistencies

reference files when making evidential claims

distinguish fact from inference

preserve uncertainty

return to earlier issues when new evidence changes them

track unresolved questions

use official sources for procedural claims

save structured state after meaningful updates
```

The agent MUST NOT:

```text
invent missing facts

fill gaps because something "probably happened"

modify evidence

create fake evidence

turn unsupported assertions into confirmed facts

tell users they will win

ignore contradictory documents

silently pick one value when evidence conflicts

give procedural requirements from memory when they can be verified
```

---

# 41. Example harness interaction

User:

> I paid the contractor $8,000 and they promised the kitchen would be finished by 14 June.

Harness stores:

```text
Fact A:
Payment = $8,000
source = user
status = asserted

Fact B:
Completion deadline = 14 June
source = user
status = asserted
```

User uploads:

```text
quotation.pdf
receipt.pdf
whatsapp.pdf
```

Harness inspects receipt:

```text
receipt.pdf
Payment = $8,000

Fact A → supported
```

Harness inspects quotation:

```text
"Estimated completion: 14 June"
```

Harness updates:

```text
Fact B → ambiguous
```

Agent asks:

> Your quotation says "estimated completion: 14 June", which may be different from a firm deadline. Was a firm completion date agreed elsewhere?

Harness searches WhatsApp.

Finds:

```text
Contractor:
"Yes, we'll definitely hand it over by 14 June."
```

Harness links:

```text
whatsapp.pdf → Fact B

Fact B → supported
```

The agent can now continue.

---

# 42. Frontend boundary

The frontend owns:

```text
screens
forms
progress bars
file upload UI
fact-confirmation UI
editing
navigation
CJTS handoff
displaying citations
```

The harness owns:

```text
state
reasoning
verification
cross-checking
document inspection
questions
contradictions
provenance
completeness
```

Keep this separation clean.

---

# 43. Where the harness should stop

The historical CJTS filing flow continues after the Claim Form with review/declaration, payment, consultation selection, saving copies and serving the respondent.

Those stages are outside the current harness scope.

Therefore the cutoff is:

```text
verified pre-filing state
        ↓
prefiling_complete = true
        ↓
return state to frontend
        ↓
HARNESS ENDS
```

Do not implement:

```text
payment
consultation booking
service
Declaration of Service
post-filing case management
hearing preparation
```

---

# 44. Source caveat

The supplied CJTS normal-user flow and checklist are based on an April 2022 guide and explicitly warn that the live CJTS interface, fees, limits and procedural requirements may have changed.

The checklist similarly states that its historical screenshots should not be treated as confirmation of the current interface or legal requirements.

Therefore:

```text
Use the files to understand workflow structure.

Do not permanently hard-code historical thresholds,
time limits or interface-specific requirements.

Keep procedural rules configurable/versioned.

Verify current procedural facts against authoritative
Singapore Judiciary sources.
```

---

# 45. MVP priorities

If implementation time is limited, build these first:

### 1. SQLite case state

Persistent:

```text
facts
files
questions
contradictions
status
```

### 2. File inspection

Agent can retrieve and inspect evidence already uploaded.

### 3. Fact verification

```text
fact
→ search files
→ evidence
→ supported / contradicted / ambiguous
```

### 4. Grilling loop

```text
find inconsistency
→ ask user
→ update state
→ verify again
```

### 5. Provenance

Every important fact knows where it came from.

### 6. Pre-filing completeness checker

Determine:

```text
what's done?
what's missing?
what's contradictory?
what requires user confirmation?
```

### 7. Final save

Produce a clean:

```text
FinalPreFilingState
```

for the frontend.

---

# 46. One-sentence architecture

> A Flue agent backed by SQLite that maintains the user's pre-filing case state, interrogates their account, verifies it against uploaded evidence and official references, tracks contradictions and provenance, and only marks the pre-filing flow complete once the required information has been checked and saved in structured form.
