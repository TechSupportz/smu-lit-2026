# Andrea

Andrea is an internal Small Claims Tribunals pre-filing preparation demo. The integration branch combines the React frontend with the Hono/Flue backend.

The connected pre-filing journey now uses the backend for:

- authoritative eligibility checks and revisioned case state;
- durable agent conversation history;
- structured respondent, factual-summary, and remedy updates;
- immutable evidence uploads;
- JSON snapshots and Typst-generated preparation-summary PDFs; and
- full case deletion from the browser's “Clear my case” action.

The later post-filing case-preparation/legal-memo stage remains a clearly marked local preview. It is outside the current backend's deliberate pre-filing scope.

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
