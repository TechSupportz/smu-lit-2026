import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js"
import * as z from "zod/v4"
import { ProcessingError } from "../errors.js"
import { refreshAssessment } from "../services/assessment.js"
import type { PdfService } from "../services/pdf.js"
import { reconcileCase } from "../services/reconciliation.js"
import type { CaseStore } from "../storage/case-store.js"

const CaseId = z.string().trim().min(8).max(128)
const IdempotencyKey = z.string().trim().min(8).max(180)

export interface ClaimGuideAgentTurnResult {
    text: string
    data: Record<string, unknown[]>
    metadata?: Record<string, unknown>
    submissionId: string
    uid?: string
}

export interface ClaimGuideMcpDependencies {
    store: CaseStore
    pdfService: Pick<PdfService, "readCompiled">
    runAgentTurn: (input: {
        caseId: string
        message: string
        idempotencyKey?: string
    }) => Promise<ClaimGuideAgentTurnResult>
}

function pdfResourceUri(caseId: string, snapshotId: string): string {
    return `claim-guide://cases/${encodeURIComponent(caseId)}/snapshots/${encodeURIComponent(snapshotId)}/pdf`
}

function variable(value: string | string[] | undefined, name: string): string {
    if (typeof value !== "string") throw new ProcessingError(`Invalid ${name} in resource URI.`)
    return value
}

export function createClaimGuideMcpServer({
    store,
    pdfService,
    runAgentTurn,
}: ClaimGuideMcpDependencies): McpServer {
    const server = new McpServer(
        { name: "claim-guide", version: "0.3.0" },
        {
            instructions:
                "ClaimGuide is a conversational Singapore Small Claims Tribunals preparation agent. Use talk_to_claim_guide as the only tool for every user turn. On the first turn omit caseId; retain the returned caseId and pass it unchanged on every later turn. Present ClaimGuide's reply to the user instead of conducting a separate interview. ClaimGuide prepares but does not file claims or give legal advice.",
        },
    )

    server.registerResource(
        "case_snapshot_pdf",
        new ResourceTemplate("claim-guide://cases/{caseId}/snapshots/{snapshotId}/pdf", {
            list: undefined,
        }),
        {
            title: "Generated ClaimGuide case-summary PDF",
            description:
                "An integrity-checked PDF generated from an immutable, explicitly reviewed case snapshot.",
            mimeType: "application/pdf",
        },
        async (uri, variables) => {
            const caseId = variable(variables.caseId, "caseId")
            const snapshotId = variable(variables.snapshotId, "snapshotId")
            const { bytes } = await pdfService.readCompiled(caseId, snapshotId)
            return {
                contents: [
                    {
                        uri: uri.href,
                        mimeType: "application/pdf",
                        blob: bytes.toString("base64"),
                    },
                ],
            }
        },
    )

    server.registerTool(
        "talk_to_claim_guide",
        {
            title: "Talk to ClaimGuide",
            description:
                "The only conversational entry point for ClaimGuide. Send the user's message here verbatim. Omit caseId to start a new case, then retain the returned caseId and include it on every later call in this chat. ClaimGuide itself handles the interview, structured case updates, explicit reviews, eligibility checks, snapshot, and final PDF. Return its reply to the user; do not call separate case tools or conduct a parallel interview.",
            inputSchema: {
                message: z
                    .string()
                    .trim()
                    .min(1)
                    .max(50_000)
                    .describe("The user's current message, passed to ClaimGuide verbatim"),
                caseId: CaseId.optional().describe(
                    "The case ID returned by the previous call; omit only on the first turn",
                ),
                idempotencyKey: IdempotencyKey.optional().describe(
                    "A stable unique key for this user turn; reuse only when retrying the identical turn",
                ),
            },
            annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
        },
        async ({ message, caseId, idempotencyKey }) => {
            let activeCaseId = caseId
            const startedCase = activeCaseId === undefined
            if (activeCaseId) {
                store.getCase(activeCaseId)
            } else {
                const created = store.createCase({
                    title: null,
                    claimantName: null,
                    category: null,
                    ...(idempotencyKey
                        ? { idempotencyKey: `mcp-case:${idempotencyKey}` }
                        : {}),
                })
                activeCaseId = created.id
            }

            const reply = await runAgentTurn({
                caseId: activeCaseId,
                message,
                ...(idempotencyKey ? { idempotencyKey: `mcp-turn:${idempotencyKey}` } : {}),
            })

            reconcileCase(store, activeCaseId)
            const assessment = refreshAssessment(store, activeCaseId)
            const state = store.getCaseState(activeCaseId)
            const compiledSnapshot = [...state.snapshots]
                .reverse()
                .find(snapshot => snapshot.pdfPath && snapshot.pdfSha256)

            const structuredContent = {
                caseId: activeCaseId,
                startedCase,
                reply: reply.text,
                submissionId: reply.submissionId,
                caseRevision: state.case.revision,
                stage: state.case.stage,
                eligibilityStatus: assessment.eligibilityStatus,
                preparationStatus: assessment.preparationStatus,
                ...(compiledSnapshot
                    ? {
                          pdf: {
                              uri: pdfResourceUri(activeCaseId, compiledSnapshot.id),
                              name: `${compiledSnapshot.basename}.pdf`,
                              mimeType: "application/pdf",
                          },
                      }
                    : {}),
            }
            const content: Array<
                | { type: "text"; text: string }
                | {
                      type: "resource_link"
                      uri: string
                      name: string
                      title: string
                      description: string
                      mimeType: string
                      size: number
                  }
            > = [
                {
                    type: "text",
                    text: `ClaimGuide case ID: ${activeCaseId}\nKeep this ID for the next turn.\n\n${reply.text}`,
                },
            ]

            if (compiledSnapshot) {
                const { bytes } = await pdfService.readCompiled(activeCaseId, compiledSnapshot.id)
                content.push({
                    type: "resource_link",
                    uri: pdfResourceUri(activeCaseId, compiledSnapshot.id),
                    name: `${compiledSnapshot.basename}.pdf`,
                    title: `ClaimGuide PDF: ${compiledSnapshot.displayName}`,
                    description:
                        "Integrity-checked preparation summary generated from the immutable reviewed case snapshot.",
                    mimeType: "application/pdf",
                    size: bytes.byteLength,
                })
            }

            return { structuredContent, content }
        },
    )

    return server
}
