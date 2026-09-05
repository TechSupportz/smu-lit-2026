# Backend contract (proposed)

This is the proposed contract between the frontend chat transport and a future
backend. The demo transport is local and deterministic; it does not implement
these backend responsibilities.

## Transport

The frontend calls the configured endpoint with TanStack AI's
`fetchServerSentEvents` adapter. The backend accepts the AG-UI `RunAgentInput`
payload (including the conversation messages, thread ID, and run ID) and
returns an AG-UI SSE stream. The stream should include the normal run and text
message lifecycle events, plus the custom events below as the workflow
progresses. The backend owns validation, persistence, and all authoritative
workflow decisions.

## Proposed custom events

The event `name` values and payloads below are proposed and may be versioned
before implementation:

| Event name | Payload | Backend responsibility |
| --- | --- | --- |
| `case.eligibility` | `{ status: "eligible" | "ineligible" | "needs_review"; reasons: string[] }` | Perform and explain the authoritative legal eligibility assessment. |
| `case.checklist` | `{ items: Array<{ id: string; label: string; status: "missing" | "complete" | "needs_review"; detail?: string }> }` | Return the current required-document checklist and its state. |
| `case.summary` | `{ title: string; fields: Record<string, unknown>; updatedAt: string }` | Return the canonical structured case summary used by the UI. |
| `file.progress` | `{ fileId: string; label: string; status: "queued" | "processing" | "ready" | "error"; progress?: number; error?: string }` | Report actual file preparation or filing progress. |
| `file.ready` | `{ fileId: string; label: string; url?: string; blob?: string; contentType: "application/pdf" }` | Return a usable PDF URL or blob for a completed file. The backend must generate the PDF and own its availability. |

Eligibility results, checklist state, case summary, and file progress must come
from the backend. The frontend must not infer legal eligibility from chat text
or claim that a filing occurred because a stream completed.

## Completion and errors

Successful runs end with the standard AG-UI `RUN_FINISHED` event. Failed runs
end with `RUN_ERROR` containing a user-safe message and a stable error code
when available. A cancelled request should honor the request abort signal and
stop work promptly. A PDF action is complete only after `file.ready` supplies
an actual PDF URL or blob; a client-side placeholder or status message is not
evidence of generation or filing.
