# Frontend/backend contract

This document records the implemented integration. The backend remains authoritative for structured case state, eligibility, evidence metadata, snapshots, and generated pre-filing PDFs.

## Configuration

The frontend uses `VITE_API_BASE_URL`, defaulting to `/api`. Its Vite development server proxies `/api` to `http://127.0.0.1:3000` and removes the prefix.

## Case lifecycle

1. The eligibility form creates a case with an idempotency key and stores the returned case ID in browser state.
2. Eligibility answers are mapped to a revision-checked `PATCH /cases/:caseId`. The UI renders the returned `eligibilityChecks`; it does not infer eligibility from chat text.
3. The structured filing form updates the case summary, respondent, and requested remedy with the backend's current revision.
4. Attachments are uploaded to `POST /cases/:caseId/evidence` before a local downloadable copy is stored.
5. The filing-summary action completes the explicit review, creates an immutable snapshot, compiles its PDF, downloads the actual backend response, and saves a browser copy.
6. “Clear my case” resolves the current revision, deletes the backend case, and then clears the browser copies and UI state.

All JSON errors use `{ "error": { "code", "message", "details" } }`. The frontend surfaces the backend's safe message and refreshes the case before each multi-step mutation to avoid relying on a stale browser revision.

## Conversation transport

The frontend uses `@flue/react` and `@flue/sdk` against:

```text
/agents/sct-prefiling/:caseId
```

Flue reconstructs the durable transcript, follows its updates stream, reconciles optimistic messages, and exposes terminal failures. The old proposed AG-UI adapter is not used because it does not match the implemented Flue route.

## Scope boundary

The current backend is deliberately limited to pre-filing preparation. It does not file, pay, serve documents, prepare hearing arguments, or generate the frontend's proposed post-filing legal memo. The frontend keeps that later stage visibly local until a separately scoped backend exists.
