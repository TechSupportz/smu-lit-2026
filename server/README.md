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

The default server is `http://127.0.0.1:3000`. `OPENCODE_GO_KEY` enables agent turns and `OPENROUTER_API_KEY` enables evidence extraction. The rest of the case API, local persistence, snapshots, and PDF compilation work without provider credentials.

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
- Muse Spark's Contributor offering may permit provider training. Local deletion cannot delete data retained by a model provider. Do not use this demo for unnecessary sensitive data.

## HTTP integration

All JSON errors use `{ "error": { "code", "message", "details" } }`. Mutations accept an `expectedRevision`; stale edits return `409 REVISION_CONFLICT`. Values ending in `Cents` are integer Singapore cents.

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Liveness |
| `GET`, `POST` | `/cases` | Shared list; create a case |
| `GET`, `PATCH`, `DELETE` | `/cases/:caseId` | Full state; edit; delete with `?expectedRevision=` |
| `POST` | `/cases/:caseId/parties` | Add/update claimant or respondent |
| `POST` | `/cases/:caseId/facts` | Add a provenance-labelled fact candidate |
| `PATCH` | `/cases/:caseId/facts/:factId/review` | Confirm, edit, reject, or mark uncertain |
| `POST` | `/cases/:caseId/remedies` | Add/update requested remedy |
| `POST` | `/cases/:caseId/evidence` | Multipart immutable upload |
| `GET` | `/cases/:caseId/evidence/:evidenceId/content` | Integrity-checked original download |
| `POST` | `/cases/:caseId/evidence/:evidenceId/extract` | Bounded OpenRouter extraction |
| `POST`, `PATCH` | `/cases/:caseId/questions[/:questionId]` | Add or resolve a follow-up |
| `POST`, `PATCH` | `/cases/:caseId/contradictions[/:contradictionId]` | Add or review a conflict |
| `POST` | `/cases/:caseId/warnings/:warningId/acknowledge` | Explicit fingerprint-bound user acknowledgment |
| `POST` | `/cases/:caseId/guidance` | Retrieve and persist allowlisted official guidance |
| `POST` | `/cases/:caseId/turns` | Idempotently admit an agent turn |
| `POST` | `/cases/:caseId/snapshots` | Create a revision-bound JSON snapshot |
| `GET` | `/cases/:caseId/snapshots/:snapshotId[/json]` | Metadata or integrity-checked JSON |
| `POST`, `GET` | `/cases/:caseId/snapshots/:snapshotId/pdf` | Compile or download PDF |

Evidence upload is `multipart/form-data` with fields `file`, `expectedRevision`, optional `documentType`, optional `description`, and optional `relevantPages` as a JSON array of 1-based pages.

### Frontend turn and stream example

```ts
const admitted = await fetch(`${baseUrl}/cases/${caseId}/turns`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    idempotencyKey: crypto.randomUUID(),
    message: 'I paid S$2,000 in cash on 5 September.',
  }),
}).then((response) => response.json());

let offset = '-1'; // first read returns a complete conversation reset
const streamUrl = `${baseUrl}${admitted.streamUrl}?view=updates&offset=${encodeURIComponent(offset)}&live=sse`;
const events = new EventSource(streamUrl);
events.addEventListener('control', (event) => {
  const control = JSON.parse(event.data);
  offset = control.streamNextOffset;
});
```

Flue supplies durable stream offsets, message deltas, tool input/output, processing logs, and submission settlement. Assistant response metadata includes `caseId`, `caseRevision`, and `eventContractVersion`. Mutation tool outputs also include the refreshed case revision and readiness assessment. On reconnect, reuse the last control-event offset. Retrying `/turns` with the same key and identical message converges on the original submission; reusing it with another message returns a conflict.

The frontend must keep these distinctions visible:

- source provenance (`USER_ASSERTION`, `DOCUMENT`, `AI_INFERENCE`);
- user review status versus documentary support;
- `FAIL` versus `UNVERIFIED` eligibility;
- unresolved versus acknowledged warning fingerprints;
- current versus superseded snapshots.
