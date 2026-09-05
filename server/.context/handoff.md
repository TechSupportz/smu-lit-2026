# Handoff — SCT pre-filing backend

## Session state

The user requested a grilling interview and a PRD for the backend. Three interview rounds are complete. The consolidated PRD and environment sample have been written; no backend implementation, provider smoke test, PDF generation, commit, or deployment has occurred.

The last assistant message asked whether the consolidated PRD captured the shared understanding, including the filesystem-safe snapshot naming interpretation. The user then requested this handoff; they have not explicitly answered that final confirmation. Do not claim the PRD has received final sign-off. If the next instruction explicitly requests implementation, treat that as direction to proceed within the documented scope rather than repeating an unnecessary approval loop.

## Read these artifacts

- Source of truth: `server/.context/project-context.md`.
- Consolidated decisions, implementation defaults, delivery sequence, acceptance scenarios, and references: `server/.context/prd-01.md`. User decisions in this conversation refine the source; the PRD records them.
- Domain glossary: `CONTEXT.md` at repository root.
- Proposed configuration contract: `server/.env.sample`. Keys are intentionally empty. The user will populate `server/.env`; do not expose its values.
- Adaptable layout reference: `cjts-small-claim-preparation.typ` at repository root. It has been read but not edited. The PRD explains which historical/post-filing portions must be removed or adapted.
- Historical reference only: `server/.context/cjts-normal-user-flow.md` and `server/.context/cjts-small-claim-form-checklist.md`. Neither establishes current procedural rules or expands scope.
- `.gitignore` was created to ignore actual environment files, local data, dependencies, and macOS metadata while permitting `.env.sample`.

Do not repeat the interview or substitute either CJTS reference file or the Typst worksheet for the authoritative project context and recorded user decisions.

## Remaining work and interpretation

1. Resolve final shared understanding when appropriate to the next user instruction. The only naming interpretation introduced in the final review is that `case/user name` means a choice of case title or user name, slugged into a filename, not a literal slash. The precise convention and fallback are recorded in the PRD.
2. Follow the PRD delivery sequence if implementation is requested. The environment sample is a proposed contract, not an already functioning configuration loader.
3. Create the application agent's Typst skill, adapted populated template, and compiler during implementation. They are specified but have not been built.
4. Verify selected provider integration and document/image transport with non-sensitive fixtures once credentials are available. Model IDs were checked against official provider documentation; successful inference, regional availability, and runtime compatibility were not tested.
5. Verify current authoritative procedural rules before implementing an exhaustive eligibility checker. Retrieval failures must remain visibly unverified as specified in the PRD.

The no-auth shared internal-demo boundary is intentional. Model/provider data handling is documented in the PRD, including the chosen Contributor model's training terms. Do not silently substitute a provider or broaden the product to hearing preparation, filing, payment, or service.

## Agent coordination and working tree

The user explicitly requested **GPT-5.6 Luna with high reasoning for any needed development subagents**. This preference is separate from the application model configuration. One earlier read-only fact-finding subagent completed before that preference was supplied; no subagent work remains pending.

At handoff, Git reports the root `.gitignore`, `CONTEXT.md`, the user-supplied Typst template, and `server/` as untracked. Do not assume all untracked content was authored by this session. No commits were requested. `git diff --check` reported no errors; because artifacts are untracked, this is not comprehensive artifact validation. Git ignore behavior was checked: `server/.env` is ignored and `server/.env.sample` is not.

## Suggested skills

Call the Skill tool for these where available, or read their `SKILL.md` directly:

- `grilling` and `domain-modeling` if substantive design decisions reopen. Existing interview answers are in the PRD; do not restart from scratch.
- `skill-creator` and `writing-for-agents` when building the repository-local Typst skill for the application agent.
- `pdf:pdf` for compilation, PDF text extraction, and rendered-layout verification.

Use other skills only if the next requested work calls for them. No Cloudflare deployment or frontend build is currently in scope.

## Handoff location

The user explicitly requested this handoff inside `.context`; it is placed beside the PRD at `server/.context/handoff.md`, overriding the handoff skill's default temporary-directory location.
