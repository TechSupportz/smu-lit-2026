# Andrea

**Small claims. Clearer next steps.**

Andrea is an AI harness that helps self-represented persons (SRPs) prepare claims for Singapore's Small Claims Tribunals (SCT). It does not answer "Do I have a case?" from a few assumed facts. It walks the user through a structured process instead: what happened, whether the claim is eligible, which facts matter, what evidence supports them, and what the other side might say.

Built by Team Freedom for SMU LIT Hackathon 2026 · [Devpost](https://devpost.com/software/project-andrea) · [Pitch deck (PDF)](docs/Andrea-SCT-pitch.pdf)

![Andrea landing page](slides/screenshots/file-d7b3c4469448a5f6ffb6a5ac0b38b15b.png)

## The problem

SRPs increasingly use GenAI to prepare SCT claims. General-purpose models can hallucinate, or simply agree with a user's framing instead of spotting missing information or testing their account. For someone already facing an unfamiliar and stressful process without a lawyer, that can mean a poorly prepared claim and more uncertainty.

Take Mdm Tan, an elderly Mandarin-speaking claimant. She walked into a salon expecting a $30 haircut and says she was pressured into a $100 package. Her story is simple: "I was badgered. I had no choice." Andrea's job is to turn that story into a properly prepared claim.

## How it works

Andrea guides the user through one flow, from first story to hearing day:

**Understand → Clarify → Identify → Test → Evidence → Organise**

1. **Prepare your claim.** A plain-language conversation gathers the story, checks eligibility and reads uploaded evidence (receipts, chat screenshots, bank slips).
2. **File and return.** A pre-filing summary PDF and a checklist for filing, serving the respondent and the Declaration of Service.
3. **Prepare your case.** A court-day pack: printable cue cards covering the timeline, key points and the outcome sought, plus one PDF stack with every piece of evidence.

![Andrea conversation](docs/images/conversation.png)

### Guarding principles: G · P · T

- **Grounded.** Relies on authoritative sources (Singapore Statutes Online, eLitigation) and the user's own evidence.
- **Proportionate.** Tests every argument with three questions: what supports it, what's missing, and what might the other side say?
- **Transparent.** Separates *facts* (what the user says), *evidence* (what a document shows) and *possibilities* (what still needs checking). When the system doesn't know, it doesn't guess.

### From conclusions to facts

When a user says "I was pressured into buying this", Andrea neither agrees nor hands down a legal conclusion. It asks what they originally went there for, what price they expected, what they were told, and what exactly made them feel pressured. It then tests the other side: if the respondent says the user agreed voluntarily, which details close that gap? Where the evidence contradicts the account (a mismatched amount, an expired voucher), Andrea records it as unresolved instead of glossing over it.

The shift is from *"Tell AI my problem"* to *"Help me identify my relevant facts."*

![Court-day pack](docs/images/court-day-pack.webp)

Andrea doesn't decide who is right, guarantee an outcome or replace the SCT. It helps the user present their case clearly, objectively and confidently.

### Beyond the website

Not everyone will use Andrea's site, so the agent harness runs on its own. An opt-in MCP endpoint exposes it to ChatGPT and other LLM clients, which get the same guided workflow and verified PDFs. We also propose that SG Courts publish an `llms.txt`, so any assistant can find the official SCT guidance without being pointed at it.

## Running it

Setup, the prefilled demo walkthrough and the MCP endpoint are covered in [docs/setup.md](docs/setup.md).

## Repository layout

| Path | Contents |
| --- | --- |
| `frontend/` | React + Vite web app |
| `server/` | Hono/Flue backend, agent harness, MCP endpoint and Typst PDF generation |
| `slides/` | Slidev pitch deck |
| `docs/` | Backend contract, cue-card template, design decisions, user scenario |
| `demo/` | Demo evidence and (ignored) generated output |

## Backend scope

The backend handles:

- authoritative eligibility checks and revisioned case state;
- durable agent conversation history;
- structured respondent, factual-summary and remedy updates;
- immutable evidence uploads;
- JSON snapshots and Typst-generated PDFs; and
- full case deletion from the browser's "Clear my case" action.

> Andrea is a hackathon prototype. It supports preparation only and is not legal advice or an official court service.
