# How to test MCP-E2E — one ClaimGuide conversation through final PDF

Branch: `putt/mcp`. Comparison base: `origin/putt/prefile-harness` because this repository has no `origin/main`. PRD: `server/.context/prd-01.md`.

**What we are proving:** An MCP host exposes ClaimGuide as one conversational surface. The host passes each user utterance to `talk_to_claim_guide`; the durable Flue agent owns the interview and internal case tools, preserves one case across turns, and returns the final reviewed PDF.

**What changed:** The public 22-tool MCP workflow was replaced by one conversational tool plus the existing PDF resource. The case ID is returned in both text and structured output. Explicit category, fact, contradiction, warning, and final-review decisions remain separate internal agent operations that may only record choices the user actually makes.

**Already checked:** backend typecheck, lint, 31 automated tests, production build, one-tool discovery over streamable HTTP, an idempotent first turn against the configured OpenRouter agent, a real second turn on the same case, and smoke-case cleanup passed. **Not yet checked:** the complete interview through PDF in ChatGPT, ChatGPT attachment rendering, user-uploaded file transfer through this one-tool contract, OAuth, or per-user case isolation.

Work through the parts in order. Part 3 is the actual acceptance test.

---

## Part 1 — Setup

- [ ] **1.1** Verify prerequisites:

    ```sh
    node --version
    pnpm --version
    typst --version
    pdfinfo -v
    ```

    → Node is at least 22.19 and every executable is available.

- [ ] **1.2** Confirm the file is named exactly `server/.env`, with no trailing space. It should contain provider credentials plus:

    ```dotenv
    HOST=127.0.0.1
    PORT=3000
    MCP_ENABLED=true
    VITE_ALLOWED_HOSTS=smallclaims.putt.dev
    ```

    → Do not print or paste provider keys into a report. If `MCP_ACCESS_TOKEN` is configured, prepare the matching bearer header in the client.

- [ ] **1.3** Start the backend from `server/`:

    ```sh
    pnpm dev
    ```

    → Vite reports `http://127.0.0.1:3000/`. An address-in-use error is setup failure.

- [ ] **1.4** Check the local origin in a browser at `http://127.0.0.1:3000/health`.

    → The page displays `{"status":"ok"}`.

- [ ] **1.5** For local inspection, launch MCP Inspector:

    ```sh
    npx --yes @modelcontextprotocol/inspector
    ```

    → Open the exact authenticated loopback URL it prints.

- [ ] **1.6** In Inspector, click **Add Servers** → **Add manually**, select `streamable-http`, and enter `http://127.0.0.1:3000/mcp`. Add an Authorization header only when the server has `MCP_ACCESS_TOKEN` configured.

    → The server connects as `claim-guide`.

- [ ] **1.7** For the named Cloudflare route, run the `smallclaims` connector separately and verify `https://smallclaims.putt.dev/health` before configuring ChatGPT.

    → A local pass plus remote failure is a tunnel/DNS problem. A local failure is an application setup problem.

## Part 2 — Fixtures

- [ ] **2.1** Use a fresh chat and this first claimant message:

    > I want to make a small claim for a faulty laptop.

- [ ] **2.2** If the client exposes raw tool inputs, use `live-manual-turn-0001` as the first `idempotencyKey`. Leave `caseId` absent.

- [ ] **2.3** Record the returned case ID only for testing continuity. Do not ask the claimant to manage it.

- [ ] **2.4** Use this second message when ClaimGuide asks for the account:

    > I paid S$2,500 last week. The seller said it was new, but it would not turn on when I got home.

- [ ] **2.5** Continue answering with fictional particulars. Use a transaction date within the last two years, a Singapore respondent, a specific requested remedy, and no real NRIC, address, phone number, or evidence.

## Part 3 — The test

- [ ] **3.1** Open **Tools** in Inspector or refresh the ChatGPT connector metadata.

    → Exactly one callable tool is advertised: `talk_to_claim_guide`. The removed granular tools and `start_new_case` prompt are absent.

- [ ] **3.2 The load-bearing check:** call `talk_to_claim_guide` with the first fixture message and no `caseId`.

    → The response is a real ClaimGuide interview reply, not a bare acknowledgement. `structuredContent.caseId` begins with `case_`, and the text content also contains `ClaimGuide case ID: case_...`. This is the regression check for clients that ignore structured output.

- [ ] **3.3 The load-bearing check:** send the second fixture message through the same tool with the returned `caseId`.

    → The same case ID returns, `startedCase` is false, the case revision advances as ClaimGuide records facts, and the reply asks the next focused question instead of restarting the interview.

- [ ] **3.4** Continue the conversation normally. Confirm a proposed category or fact only after ClaimGuide presents it. When something is uncertain, say so instead of accepting a guessed value.

    → ClaimGuide performs its own internal reads and mutations. The MCP host never asks to call `update_case_details`, `propose_fact`, or another internal tool.

- [ ] **3.5 The load-bearing check:** after completing all required answers, ask ClaimGuide to show the full case for final review. Explicitly confirm only after checking the parties, chronology, amount, remedy, unresolved items, contradictions, eligibility result, and warnings.

    → ClaimGuide records final review, creates an immutable snapshot, compiles the PDF, and the same `talk_to_claim_guide` response includes an `application/pdf` resource link.

- [ ] **3.6** Open or read that resource.

    → The resource URI uses the exact case and snapshot IDs, its MIME type is `application/pdf`, it opens as a valid PDF, and its content matches the reviewed case. The artifact remains labelled a ClaimGuide preparation summary, not an official court form or proof of filing.

## Part 4 — Boundary cases

- [ ] **4.1 Idempotent retry.** Repeat the first call with the identical message and identical first-turn key.

    → It returns the same case ID and does not create a second case or duplicate agent turn.

- [ ] **4.2 Conflicting retry.** Reuse that key with different message text.

    → The call fails with an idempotency conflict rather than applying different content to the old turn.

- [ ] **4.3 Missing continuation identity.** In a disposable test chat, omit `caseId` on a later call.

    → A new case is created. This confirms why the host must retain the ID; delete the disposable case afterwards.

- [ ] **4.4 Invalid identity.** Pass `case_not_real` as `caseId`.

    → The call returns not found and never falls back to another case.

- [ ] **4.5 Process restart.** Stop and restart the backend, then continue a known test case with its case ID.

    → SQLite and Flue restore the same structured state and conversation rather than beginning again.

- [ ] **4.6 Bearer protection.** Configure a temporary 32-plus-character MCP token, reconnect with the correct Authorization header, then remove or corrupt it.

    → Correct authorization connects; missing or wrong authorization returns 401.

- [ ] **4.7 Wrong PDF identity.** Read a fabricated snapshot URI for a real case.

    → The resource read fails and never returns another case's file.

## Part 5 — Decisions to make

- [ ] **5.1 ChatGPT invocation model.** Observe whether addressing `@smallclaims` reliably causes ChatGPT to call `talk_to_claim_guide` on every turn. MCP is still a tool protocol; the host performs one hidden call even though the claimant sees a normal conversation.

- [ ] **5.2 Tool approval UX.** Decide whether ChatGPT's approval settings make a mutating conversational tool smooth enough for the intended audience. Do not falsely mark it read-only merely to suppress a safety prompt.

- [ ] **5.3 File intake.** The one-tool contract does not yet define portable binary attachment transfer from ChatGPT. Decide whether v1 requires claimant uploads inside ChatGPT or whether evidence upload remains in ClaimGuide's web frontend. If ChatGPT upload is required, specify the host-supported file-reference mechanism before adding base64 fields.

- [ ] **5.4 Artifact UX.** Record whether ChatGPT renders the PDF resource as a one-click attachment. If not, add an authenticated short-lived download surface rather than publishing an unauthenticated case URL.

- [ ] **5.5 User identity.** Before sharing beyond a controlled single-user demo, define OAuth subject-to-case ownership and prevent one authenticated user from supplying another user's case ID.

## Part 6 — Build and automated tests

- [ ] **6.1** Run the complete backend check:

    ```sh
    cd server
    pnpm check
    ```

    → TypeScript, ESLint, 31 tests, and the production SSR build pass. MCP coverage includes one-tool discovery, text-and-structured case ID return, same-case continuation, idempotent initial retry, PDF resource retrieval, bearer protection, and streamable-HTTP initialization.

- [ ] **6.2** Run frontend regressions:

    ```sh
    cd frontend
    pnpm build
    pnpm test
    ```

    → The production build and all frontend tests pass.

- [ ] **6.3** Record the manual-only gaps: actual model behavior is nondeterministic; automated tests do not prove a complete real interview, live guidance retrieval, ChatGPT invocation/approval behavior, file attachment transfer, OAuth, or per-user authorization.

## Part 7 — Deploy and environment

- [ ] **7.1** Restart the backend after deployment or local source changes. MCP clients may keep old tool metadata until reconnected.

- [ ] **7.2** Run the named `smallclaims` Cloudflare tunnel with its route targeting `http://127.0.0.1:3000`. Check both local and public `/health` before testing `/mcp`.

- [ ] **7.3** Disconnect and reconnect the ChatGPT developer-mode connector at `https://smallclaims.putt.dev/mcp` so it refreshes the tool catalog.

    → The connector sees only `talk_to_claim_guide`; seeing `create_case` means an old server process or cached metadata is still active.

- [ ] **7.4** Keep the backend bound to loopback. Expose only `/mcp` and optionally `/health` at the tunnel boundary; the existing REST case routes are not protected by `MCP_ACCESS_TOKEN`.

- [ ] **7.5** Treat the bearer-token tunnel as private single-tenant testing only. Public or team use requires OAuth discovery/token validation, per-subject case ownership, privacy/support information, and negative cross-user tests.

## Part 8 — Known-broken on purpose

- [ ] **8.1** Direct file upload from a ChatGPT message into ClaimGuide evidence is not part of the current one-tool MCP schema. Use the frontend for evidence files until Part 5.3 is decided and implemented.

- [ ] **8.2** The existing REST and direct Flue routes remain mounted for the frontend. They are intentionally not advertised as MCP tools, but a plain hostname-wide Cloudflare tunnel still makes those HTTP paths reachable unless the tunnel or Access policy restricts them.

- [ ] **8.3** The generated PDF is deliberately a preparation summary. Filling or submitting an official CJTS form remains outside scope.

## If something goes wrong

| Symptom | Likely cause | What to inspect |
|---|---|---|
| `create_case` still appears | Old process or cached connector catalog | Restart backend; disconnect/reconnect connector; verify Tools has one entry |
| Bare acknowledgement without ID | Old MCP implementation is still serving | Inspect server version/tool list; new text begins `ClaimGuide case ID:` |
| First turn works, second starts over | Host omitted or changed `caseId` | Compare structured/text case ID with next call input |
| Agent reply fails | Provider key, provider reachability, or Flue settlement error | Server log and `OPENCODE_GO_KEY` presence; never print the key |
| Local `/health` fails | Backend setup | Vite process, port 3000, correctly named `.env` |
| Local passes, public fails | Tunnel/DNS/origin route | Active `smallclaims` connector and route to `127.0.0.1:3000` |
| Public host blocked by Vite | Missing exact allowlist | `VITE_ALLOWED_HOSTS=smallclaims.putt.dev`, then restart |
| MCP returns 401 | Token mismatch | Connector Authorization header versus `MCP_ACCESS_TOKEN` |
| Snapshot refused | Review gate still open | Pending material facts, required questions, contradictions, warnings, or final review |
| PDF link absent at completion | Agent did not compile, or review gate prevented it | Latest state/snapshot and agent tool events |
