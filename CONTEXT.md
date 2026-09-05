# Small Claims Preparation

A service that helps individuals prepare a small claim. The current backend covers pre-filing preparation; post-filing case preparation remains a separate product stage.

## Shared language

**Claimant**:
The individual using the service to bring a small claim.

**Case**:
The claimant's pre-filing account, parties, requested remedies, evidence, and unresolved issues being prepared together.

**Filing preparation**:
The first guided conversation, during which the claimant supplies information needed to prepare their claim.

**Eligibility check**:
An assessment of whether the claimant's case meets the conditions to proceed with a small claim. An unresolved assessment or a disqualifying result prevents onward filing progression.

**Progress panel**:
A compact view of eligibility-check statuses and the preparation status of generated documents.

**Material fact**:
A statement relevant to the claim's parties, events, amounts, obligations, or requested remedy whose origin and review status must be identifiable.

**Evidence original**:
An uploaded supporting file preserved without alteration. Its contents may support or contradict an account without establishing that every statement in it is true.

**Candidate fact**:
A proposed statement that has not been confirmed, including a statement inferred by the agent.

**User confirmation**:
The claimant's explicit endorsement of a statement. It does not independently establish documentary support or legal correctness.

**Contradiction**:
A recorded conflict between statements or evidence that requires review rather than silent selection of one version.

**Pre-filing completion**:
The point at which information has been collected, checked, and organized sufficiently for the frontend handoff. It is not a finding of legal merit or acceptance by CJTS.
_Avoid_: Case won, claim approved

**Official pre-filing assessment**:
CJTS's own assessment, distinct from the harness's preparation and completeness review.

**Filing eligibility**:
Whether the claim satisfies the applicable conditions for SCT filing, distinct from how well its allegations are supported.

**Evidence warning**:
An explicit notice that a material statement lacks support or conflicts with available material. Acknowledging it records a decision to proceed with that uncertainty, not resolution of the underlying issue.

**CPFTA unfair practice**:
Alleged supplier conduct assessed against the Consumer Protection (Fair Trading) Act. An allegation of unfairness alone does not establish a statutory unfair practice.

## Frontend-only post-filing language

**Filing checkpoint**:
The saved milestone after filing preparation that lists actions the claimant must complete outside ClaimGuide before proceeding to case preparation. The claimant may return to it in a later sitting.
_Avoid_: Save state

**Case preparation**:
The second guided conversation that assists the claimant after filing. It is not currently backed by the SCT pre-filing agent.

**Legal memo**:
The PDF document proposed for the end of case preparation. It is not currently produced by the SCT pre-filing backend.

**Final guidance**:
The non-blocking next steps presented alongside the legal memo after case preparation.
