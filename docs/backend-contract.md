# Frontend/backend contract

This document records the implemented integration. The backend remains authoritative for structured case state, eligibility, evidence metadata, snapshots, and generated pre-filing PDFs.

## Configuration

The frontend uses `VITE_API_BASE_URL`, defaulting to `/api`. Its Vite development server proxies `/api` to `http://127.0.0.1:3000` and removes the prefix.

## Case lifecycle

1. The eligibility form creates a case with an idempotency key and stores the returned case ID in browser state.
2. Eligibility answers are mapped to a revision-checked `PATCH /cases/:caseId`. The UI renders the returned `eligibilityChecks`; it does not infer eligibility from chat text.
3. After eligibility, the AI chooses plain chat for open-ended accounts and quick clarifications, or a structured questionnaire when a persistent question helps the user review and answer. Questionnaire answers are stored through the question endpoint; the agent uses answers from either format to update the structured case. On load and after every completed agent or API mutation, the frontend reconciles category, amount, eligibility checks, respondent, summary, remedy, question progress, evidence and compiled snapshots from the authoritative backend state. There is no separate fixed intake form.
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

Grill Me follow-ups use plain chat or a persisted structured open question according to the response-format guidelines in the agent harness. A question record may include a grounded, first-person `suggestedAnswer`; omit it when facts are missing, and never use fill-in-the-blank placeholders. The frontend renders an available suggestion as an editable questionnaire choice and resolves the selected or freeform answer through the revision-checked question endpoint. When the user answers an existing open question in chat, the agent resolves it through the case tools while preserving their wording.

## Scope boundary

The current backend is deliberately limited to pre-filing preparation. It does not file, pay, serve documents, prepare hearing arguments, or generate the frontend's proposed post-filing legal memo. The frontend keeps that later stage visibly local until a separately scoped backend exists.
