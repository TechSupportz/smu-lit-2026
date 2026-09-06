# Implementation architecture

## Boundaries

`src/app.ts` is the Hono route map and explicitly mounts Flue's native agent router. `src/db.ts` provides Flue's file-backed SQLite adapter. `src/storage/case-store.ts` owns application persistence and optimistic case revisions; `src/services/*` own deterministic assessment, reconciliation, evidence extraction, allowlisted guidance retrieval, snapshots, PDF compilation, and tribunal-pack assembly.

The application database and Flue database are intentionally separate. The case database is authoritative for user-visible structured state. The conversation only invokes bounded application tools and cannot confirm a fact or acknowledge a warning on the user's behalf.

## Consistency model

Mutations are serialized per case in-process and checked against `expectedRevision` in SQLite. HTTP turn admission has an application idempotency record and passes a stable derived key to Flue. Flue's native route exposes durable offsets for replay/reconnection. This provides restart recovery from the two SQLite files, although horizontal multi-process mutation serialization is out of scope for this local internal demo.

Warnings use fingerprints derived from their material inputs. Reassessment preserves an acknowledgment only while the same warning fingerprint remains active; changed material inputs produce a new open warning. Immutable snapshots are bound to a case revision and record supersession in both directions.

## Evidence and provider trust

Evidence originals are byte-hashed and stored using generated paths. Extracted claims retain file/run/page-or-location provenance and do not mutate originals. Document content is always treated as untrusted source material, including text that resembles model instructions.

The main agent and evidence extractor use separately configurable OpenRouter-compatible routes; the current defaults are `openai/gpt-5.6-luna`. The provider adapter maps the repository's `OPENCODE_GO_KEY`, identifies the application, and supplies a per-conversation session header. Evidence extraction uses documented chat-completions PDF/image transport and strict JSON-schema output. Calls have size, page, timeout, and retry bounds; failures remain retryable processing state rather than eligibility failures.

No authenticated provider smoke call has been assumed successful. It must be run with the deployment account and non-sensitive fixtures before provider compatibility, account availability, regional availability, and retention behavior can be considered verified.

## Artifact safety

Snapshots serialize case text as JSON data. Typst receives only saved paths through `sys.inputs`; case text is never interpolated into Typst source. Compilation is confined to the repository workspace, time-bounded, and checked against snapshot hashes, PDF headers, and Poppler page counts. A compilation error leaves the JSON snapshot intact.

Case preparation is bound to the latest user-reviewed snapshot at the current revision. The pack service verifies that snapshot and its pre-filing PDF, converts each immutable evidence original in upload order, generates a fact-only cue card and an indexed cover, and merges every part with `pdfunite`. LibreOffice conversions use an isolated temporary profile. Temporary normalized copies are deleted after assembly; originals are never changed. Any unsupported or failed conversion aborts the whole pack, and stored cue, manifest, and stack hashes are rechecked before reuse or download.
