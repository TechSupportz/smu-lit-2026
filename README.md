# ClaimGuide

A frontend preview for preparing Small Claims Tribunals claims. Built with Vite, React, TypeScript, shadcn UI, Zustand and TanStack AI.

## Run

```sh
cd frontend
pnpm install
pnpm dev
```

```sh
pnpm build
pnpm test
```

## Preview journey

Choose a claim category, use example eligibility details or enter your own, then complete the structured claim details. Chat streams scripted responses. Generate a sample filing pack, confirm the three external-action checklist items, and continue to case preparation and a sample memo PDF.

Progress and chat are saved in localStorage; files are stored in IndexedDB on the same browser. Clear my case removes saved case data. No court submission, server upload, live AI or real document generation is implemented.

## Backend integration

Replace the demo connection in `frontend/src/components/Chat.tsx` with `createBackendConnection` from `frontend/src/lib/chat-transport.ts`. Eligibility assessment and PDF generation currently use `frontend/src/lib/demo.ts`. Wire backend results into the Zustand actions and persist returned PDF blobs using `frontend/src/lib/storage.ts`. See `docs/backend-contract.md` for the proposed events; those custom event handlers are not implemented yet.
