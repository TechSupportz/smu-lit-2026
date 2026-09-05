# ClaimGuide

ClaimGuide is an internal Small Claims Tribunals pre-filing preparation demo. The integration branch combines the React frontend with the Hono/Flue backend.

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
