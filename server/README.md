# SCT pre-filing agent server

Internal, unauthenticated backend for collecting and reviewing Small Claims Tribunals pre-filing information. It stores structured case state separately from Flue's durable conversation state, preserves uploaded originals, and can produce immutable JSON snapshots and Typst PDF preparation summaries.

This server does not file a claim, serve documents, provide legal advice, or establish that an allegation is true or eligible.

## Run locally

Requires Node.js 22.19 or newer, Typst, and Poppler's `pdfinfo` for PDF verification.

```sh
cp .env.sample .env
pnpm install --frozen-lockfile
pnpm dev
```

The default server is `http://127.0.0.1:3000`. `OPENCODE_GO_KEY` enables the main agent through OpenRouter, and `OPENROUTER_API_KEY` enables evidence extraction. The rest of the case API, local persistence, snapshots, and PDF compilation work without provider credentials.

```sh
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

## Storage and data handling

- `data/cases.db` is authoritative for application case state.
- `data/flue.db` stores Flue conversations, submissions, and streaming history.
- `data/evidence/` stores immutable originals under backend-generated names. Uploaded filenames are metadata only.
- `data/snapshots/` stores immutable JSON/PDF pairs. A new snapshot supersedes, but never overwrites, the previous snapshot.
- Case deletion first requests an abort for active agent work, deletes all application rows, and then removes case-owned evidence and generated artifacts.
- This release deliberately has no authentication or user isolation. Any caller that can reach the server can see or mutate the shared case list. Bind it to localhost or a trusted internal network only.
- The configured OpenRouter routes may have provider-specific data-handling terms. Local deletion cannot delete data retained by a model provider. Do not use this demo for unnecessary sensitive data.

## HTTP integration

All JSON errors use `{ "error": { "code", "message", "details" } }`. Mutations accept an `expectedRevision`; stale edits return `409 REVISION_CONFLICT`. Values ending in `Cents` are integer Singapore cents.

| Method                   | Route                                              | Purpose                                            |
| ------------------------ | -------------------------------------------------- | -------------------------------------------------- |
| `GET`                    | `/health`                                          | Liveness                                           |
| `GET`, `POST`            | `/cases`                                           | Shared list; create a case                         |
| `GET`, `PATCH`, `DELETE` | `/cases/:caseId`                                   | Full state; edit; delete with `?expectedRevision=` |
| `POST`                   | `/cases/:caseId/parties`                           | Add/update claimant or respondent                  |
| `POST`                   | `/cases/:caseId/facts`                             | Add a provenance-labelled fact candidate           |
| `PATCH`                  | `/cases/:caseId/facts/:factId/review`              | Confirm, edit, reject, or mark uncertain           |
| `POST`                   | `/cases/:caseId/remedies`                          | Add/update requested remedy                        |
| `POST`                   | `/cases/:caseId/evidence`                          | Multipart immutable upload                         |
| `GET`                    | `/cases/:caseId/evidence/:evidenceId/content`      | Integrity-checked original download                |
| `POST`                   | `/cases/:caseId/evidence/:evidenceId/extract`      | Bounded OpenRouter extraction                      |
| `POST`, `PATCH`          | `/cases/:caseId/questions[/:questionId]`           | Add or resolve a follow-up                         |
| `POST`, `PATCH`          | `/cases/:caseId/contradictions[/:contradictionId]` | Add or review a conflict                           |
| `POST`                   | `/cases/:caseId/warnings/:warningId/acknowledge`   | Explicit fingerprint-bound user acknowledgment     |
| `POST`                   | `/cases/:caseId/guidance`                          | Retrieve and persist allowlisted official guidance |
| `POST`                   | `/cases/:caseId/turns`                             | Idempotently admit an agent turn                   |
| `POST`                   | `/cases/:caseId/snapshots`                         | Create a revision-bound JSON snapshot              |
| `GET`                    | `/cases/:caseId/snapshots/:snapshotId[/json]`      | Metadata or integrity-checked JSON                 |
| `POST`, `GET`            | `/cases/:caseId/snapshots/:snapshotId/pdf`         | Compile or download PDF                            |

Evidence upload is `multipart/form-data` with fields `file`, `expectedRevision`, optional `documentType`, optional `description`, and optional `relevantPages` as a JSON array of 1-based pages.

### Frontend turn and stream example

```ts
const admitted = await fetch(`${baseUrl}/cases/${caseId}/turns`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
        idempotencyKey: crypto.randomUUID(),
        message: "I paid S$2,000 in cash on 5 September.",
    }),
}).then(response => response.json())

let offset = "-1" // first read returns a complete conversation reset
const streamUrl = `${baseUrl}${admitted.streamUrl}?view=updates&offset=${encodeURIComponent(offset)}&live=sse`
const events = new EventSource(streamUrl)
events.addEventListener("control", event => {
    const control = JSON.parse(event.data)
    offset = control.streamNextOffset
})
```

Flue supplies durable stream offsets, message deltas, tool input/output, processing logs, and submission settlement. Assistant response metadata includes `caseId`, `caseRevision`, and `eventContractVersion`. Mutation tool outputs also include the refreshed case revision and readiness assessment. On reconnect, reuse the last control-event offset. Retrying `/turns` with the same key and identical message converges on the original submission; reusing it with another message returns a conflict.

## MCP integration

The same backend can expose a streamable-HTTP MCP endpoint at `/mcp`. It is disabled by default. The endpoint advertises one tool, `talk_to_claim_guide`, which forwards each user turn to the same durable Flue agent harness used by the frontend. The host model does not conduct its own parallel interview or manipulate low-level case records. SQLite remains authoritative for revisions, provenance, eligibility, and preparation status.

For a local MCP client or a private ChatGPT developer-mode tunnel, keep the server on loopback and enable the endpoint:

```sh
MCP_ENABLED=true pnpm dev
```

Vite also validates the incoming HTTP `Host` header. For a Cloudflare tunnel, allow its exact hostname in `server/.env`, then restart the server:

```dotenv
MCP_ENABLED=true
VITE_ALLOWED_HOSTS=smallclaims.putt.dev
```

Use only the hostname, without `https://` or `/mcp`. Keep the allowlist exact; do not set Vite's `allowedHosts` to `true`.

For another private MCP client, configure a long random token (at least 32 characters) and send it as `Authorization: Bearer <token>`:

```sh
MCP_ENABLED=true MCP_ACCESS_TOKEN="replace-with-a-long-random-secret" pnpm start
```

Keep the app server on loopback or a trusted private network. If a reverse proxy or tunnel provides remote access, publish only `/mcp` (and optionally `/health`) and keep the existing REST and Flue routes private. `MCP_ACCESS_TOKEN` protects `/mcp`; it does not add authentication to the rest of this deliberately internal backend.

On the first user turn, the host calls `talk_to_claim_guide` with `message` and no `caseId`. The tool creates the case, starts the Flue conversation, waits for ClaimGuide's reply, and returns the case ID in both text and structured output. This text fallback is deliberate because some MCP hosts do not preserve `structuredContent` reliably. On every later user turn, the host calls the same tool with the returned `caseId` and the new message. A stable per-turn `idempotencyKey` makes identical retries converge.

ClaimGuide's internal agent tools—not the MCP client—read and update structured case state, inspect evidence already uploaded through the application, retrieve official guidance, record only explicit user confirmations, create the immutable snapshot, and compile the PDF. When a compiled PDF exists, `talk_to_claim_guide` returns its `application/pdf` resource link automatically. The same URI can be read through MCP `resources/read`; the server rechecks the stored SHA-256 and PDF header before returning base64-encoded binary content.

The PDF is a ClaimGuide preparation summary generated from the reviewed snapshot. It is not an official court form, proof of filing, or court acceptance. A failed eligibility assessment remains visible in the snapshot and is never converted into a filing-ready result merely because a PDF was generated.

For example, a server-side application using the OpenAI Responses API can attach the deployed endpoint as a remote MCP tool. Keep approvals enabled because this server includes write tools:

```ts
const response = await openai.responses.create({
    model: process.env.OPENAI_MODEL!,
    tools: [
        {
            type: "mcp",
            server_label: "claim_guide",
            server_description: "Prepare and assess a Singapore SCT pre-filing case.",
            server_url: process.env.CLAIM_GUIDE_MCP_URL!,
            authorization: process.env.CLAIM_GUIDE_MCP_TOKEN!,
            require_approval: "always",
        },
    ],
    input: "Help me organise the facts for a possible small claim.",
})
```

Omit `authorization` only for a loopback/private-tunnel connection where `MCP_ACCESS_TOKEN` is empty. Never put either the backend token or an OpenAI API key in browser code.

MCP is still a tool protocol: ChatGPT or another host makes one hidden `talk_to_claim_guide` tool call for each addressed user turn. The difference is that the host never sees or orchestrates ClaimGuide's internal case tools. Case deletion, evidence upload, and the direct Flue conversation stream remain available through the existing frontend/HTTP API.

This bearer-token mode is a private, single-tenant integration boundary, not sufficient for a public ChatGPT plugin. Before public deployment, add OAuth 2.1 discovery/token validation, bind every case to the authenticated subject, remove the shared `GET /cases` behavior, and publish privacy/support information. ChatGPT developer-mode testing also requires the endpoint to be reachable through public HTTPS or a private MCP tunnel.

The frontend must keep these distinctions visible:

- source provenance (`USER_ASSERTION`, `DOCUMENT`, `AI_INFERENCE`);
- user review status versus documentary support;
- `FAIL` versus `UNVERIFIED` eligibility;
- unresolved versus acknowledged warning fingerprints;
- current versus superseded snapshots.
