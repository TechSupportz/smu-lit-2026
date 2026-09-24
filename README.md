# Andrea

**Small claims. Clearer next steps.**

Andrea is an AI harness that helps self-represented persons (SRPs) prepare claims for Singapore's Small Claims Tribunals (SCT). It does not answer "Do I have a case?" from a few assumed facts. It walks the user through a structured process instead: what happened, whether the claim is eligible, which facts matter, what evidence supports them, and what the other side might say.

Built by Team Freedom for SMU LIT Hackathon 2026 · [Devpost](https://devpost.com/software/project-andrea) · [Pitch deck](slides/slides.md)

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

## Prerequisites

- Node.js 22.19 or newer (an even-numbered LTS release is recommended)
- pnpm
- Typst and Poppler's `pdfinfo` for backend PDF generation
- Backend provider keys only if live agent turns or evidence extraction are required

## Run locally

Copy the backend environment sample and populate the provider keys you intend to use:

```sh
cp server/.env.sample server/.env
```

Install and start the backend:

```sh
cd server
pnpm install --frozen-lockfile
pnpm dev
```

In a second terminal, install and start the frontend:

```sh
cd frontend
pnpm install
pnpm dev
```

Open `http://127.0.0.1:5173`. Vite proxies `/api` to `http://127.0.0.1:3000`, so local development needs no additional frontend configuration.

### Prefilled haircut walkthrough

Prefilled mode seeds a fictional salon-package case while retaining the configured live Flue agent. Start the backend with:

```sh
cd server
pnpm dev:prefilled
```

Start the frontend with the matching opt-in and choose **Load prefilled haircut case** in the eligibility card:

```sh
cd frontend
pnpm dev:prefilled
```

1. Review the pre-filled eligibility and case details, and select **Prepare filing summary**.
2. On the filing checklist, tick the three external-demo steps and continue.
3. Select **Prepare my case pack** to generate the cue card and combined evidence stack.

In a prefilled frontend, the browser console can perform the same backend-first seed and localStorage projection from any screen:

```js
await window.__andreaPrefilled.loadHaircutPackage()
```

The resolved object includes the backend case ID and revision. Both PDF actions are then sent through the connected Flue harness. The harness creates a revision-bound snapshot and invokes the real PDF compiler tools; the frontend does not substitute a bundled or premade PDF.

The scenario uses fictional parties, addresses, and two visibly synthetic evidence images committed under `server/src/prefilled-scenarios/assets/`. The prefilled route returns 404 unless `PREFILLED=true`; normal `pnpm dev` exposes no prefilled-case loader.

To seed the same backend state without opening the frontend:

```sh
cd server
pnpm prefilled:seed
```

The command writes only a state manifest to the ignored `demo/output/` directory. It deliberately does not generate PDFs. Generate the filing summary, cue card and tribunal pack from the frontend so the requests run through Flue. Generated PDFs and QA output remain ignored under `demo/`.

For deterministic UI/harness testing without a live model, `pnpm dev:demo` remains available on both sides. This separately enables `MOCK_DATA_MODE=true`; it is not the normal prefilled walkthrough.

For a separately deployed backend, set `VITE_API_BASE_URL` when building the frontend. Set the backend's `CORS_ORIGINS` to the frontend origin.

When a Cloudflare Quick Tunnel points at either development server, add that tunnel's exact generated hostname to `VITE_ALLOWED_HOSTS` and restart the affected server. For example:

```sh
VITE_ALLOWED_HOSTS=computational-grill-freeze-aka.trycloudflare.com pnpm dev
```

Set this in `server/.env` for a backend/MCP tunnel or `frontend/.env` for a frontend tunnel. Do not include `https://` or a path. Quick Tunnel hostnames change when a new tunnel is created, so update the value rather than hard-coding a generated hostname.

The backend also includes an opt-in streamable-HTTP MCP endpoint for ordinary LLM clients. It exposes one conversational `talk_to_claim_guide` tool backed by the same Flue agent harness as the frontend; ClaimGuide owns the structured workflow and returns the verified final PDF as an MCP resource. See [server/README.md](server/README.md#mcp-integration) for the session contract, private bearer-token mode, and the additional OAuth/user-isolation work required before publishing it as a public ChatGPT plugin.

## Verify

```sh
cd server
pnpm check

cd ../frontend
pnpm build
pnpm test
```

## Data and safety boundary

The backend is unauthenticated and has no user isolation. Bind it to localhost or a trusted internal network only. Eligibility and generated summaries support preparation; they are not legal advice, official court forms, court acceptance, or evidence that anything was filed.

Backend case/conversation data lives under `server/data/`. The frontend keeps navigation state and local downloadable file copies in browser storage. Clearing a connected case deletes the backend case and those local copies.
