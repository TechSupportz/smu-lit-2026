import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js"
import { Hono } from "hono"
import { describe, expect, it } from "vitest"
import { loadConfig } from "../src/config.js"
import { handleMcpRequest, isMcpAuthorized } from "../src/mcp/http.js"
import {
    createClaimGuideMcpServer,
    type ClaimGuideMcpDependencies,
} from "../src/mcp/server.js"
import { PdfService } from "../src/services/pdf.js"
import { SnapshotService } from "../src/services/snapshot.js"
import type { CaseStore } from "../src/storage/case-store.js"
import { makeStoreSync, testConfig } from "./helpers.js"

type AgentTurn = Parameters<ClaimGuideMcpDependencies["runAgentTurn"]>[0]

function dependencies(
    store: CaseStore,
    dir: string,
    turns: AgentTurn[] = [],
): ClaimGuideMcpDependencies {
    const config = testConfig(dir)
    return {
        store,
        pdfService: new PdfService(store, config),
        runAgentTurn: input => {
            turns.push(input)
            return Promise.resolve({
                text:
                    turns.length === 1
                        ? "Please tell me what happened, in your own words."
                        : "Thank you. What happened next?",
                data: {},
                metadata: { caseId: input.caseId },
                submissionId: `submission-${turns.length}`,
                uid: `agent-${input.caseId}`,
            })
        },
    }
}

async function connectedClient() {
    const { store, dir } = makeStoreSync("mcp")
    const turns: AgentTurn[] = []
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
    const server = createClaimGuideMcpServer(dependencies(store, dir, turns))
    const client = new Client({ name: "claim-guide-test", version: "1.0.0" })
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)])
    return { client, server, store, dir, turns }
}

describe("ClaimGuide conversational MCP server", () => {
    it("advertises one conversational tool", async () => {
        const { client, server, store } = await connectedClient()
        try {
            const tools = await client.listTools()
            expect(tools.tools.map(tool => tool.name)).toEqual(["talk_to_claim_guide"])
            expect(tools.tools[0]?.annotations).toMatchObject({
                readOnlyHint: false,
                destructiveHint: false,
                openWorldHint: true,
            })
        } finally {
            await client.close()
            await server.close()
            store.close()
        }
    })

    it("starts a case, returns its ID in text, and continues the same agent conversation", async () => {
        const { client, server, store, turns } = await connectedClient()
        try {
            const first = await client.callTool({
                name: "talk_to_claim_guide",
                arguments: {
                    message: "I want to make a small claim for a faulty laptop.",
                    idempotencyKey: "chat-turn-0001",
                },
            })
            expect(first.isError).not.toBe(true)
            const firstData = first.structuredContent as {
                caseId: string
                startedCase: boolean
                reply: string
            }
            expect(firstData.caseId).toMatch(/^case_/)
            expect(firstData.startedCase).toBe(true)
            expect(firstData.reply).toContain("what happened")
            const textContent = (
                first.content as Array<{ type: string; text?: string }>
            ).find(item => item.type === "text")
            expect(textContent?.text).toContain(`ClaimGuide case ID: ${firstData.caseId}`)

            const second = await client.callTool({
                name: "talk_to_claim_guide",
                arguments: {
                    caseId: firstData.caseId,
                    message: "I bought it last week for S$2,500.",
                    idempotencyKey: "chat-turn-0002",
                },
            })
            expect(second.isError).not.toBe(true)
            expect(second.structuredContent).toMatchObject({
                caseId: firstData.caseId,
                startedCase: false,
                reply: "Thank you. What happened next?",
            })
            expect(turns).toEqual([
                {
                    caseId: firstData.caseId,
                    message: "I want to make a small claim for a faulty laptop.",
                    idempotencyKey: "mcp-turn:chat-turn-0001",
                },
                {
                    caseId: firstData.caseId,
                    message: "I bought it last week for S$2,500.",
                    idempotencyKey: "mcp-turn:chat-turn-0002",
                },
            ])
        } finally {
            await client.close()
            await server.close()
            store.close()
        }
    })

    it("reuses the same new case when the first turn is retried idempotently", async () => {
        const { client, server, store } = await connectedClient()
        const request = {
            name: "talk_to_claim_guide",
            arguments: {
                message: "I need help with a small claim.",
                idempotencyKey: "stable-first-turn",
            },
        }
        try {
            const first = await client.callTool(request)
            const retried = await client.callTool(request)
            expect((retried.structuredContent as { caseId: string }).caseId).toBe(
                (first.structuredContent as { caseId: string }).caseId,
            )
            expect(store.listCases()).toHaveLength(1)
        } finally {
            await client.close()
            await server.close()
            store.close()
        }
    })

    it("returns a verified PDF resource when the agent has completed one", async () => {
        const { store, dir } = makeStoreSync("mcp-pdf")
        const config = testConfig(dir)
        const pdfService = new PdfService(store, config)
        const snapshotService = new SnapshotService(store, config)
        const created = store.createCase({
            title: "Reviewed claim",
            claimantName: null,
            category: null,
        })
        const reviewed = store.updateCase(created.id, {
            expectedRevision: created.revision,
            patch: { userReviewed: true },
        })
        const snapshot = await snapshotService.create(created.id, reviewed.revision)
        await pdfService.compile(created.id, snapshot.record.id)

        const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
        const server = createClaimGuideMcpServer({
            ...dependencies(store, dir),
            pdfService,
        })
        const client = new Client({ name: "claim-guide-test", version: "1.0.0" })
        await Promise.all([server.connect(serverTransport), client.connect(clientTransport)])
        try {
            const response = await client.callTool({
                name: "talk_to_claim_guide",
                arguments: { caseId: created.id, message: "Please give me the final PDF." },
            })
            const contentItems = response.content as Array<{
                type: string
                uri?: string
                mimeType?: string
            }>
            const link = contentItems.find(item => item.type === "resource_link")
            expect(link).toMatchObject({ mimeType: "application/pdf" })
            if (!link?.uri) throw new Error("PDF link missing")
            const resource = await client.readResource({ uri: link.uri })
            const content = resource.contents[0]
            if (!content || !("blob" in content)) throw new Error("PDF resource blob missing")
            expect(Buffer.from(content.blob, "base64").subarray(0, 5).toString()).toBe("%PDF-")
        } finally {
            await client.close()
            await server.close()
            store.close()
        }
    })
})

describe("MCP bearer authentication", () => {
    it("allows local no-token mode and validates configured bearer tokens", () => {
        const token = "a-secure-test-token-at-least-32-characters"
        expect(isMcpAuthorized(undefined, "")).toBe(true)
        expect(isMcpAuthorized(undefined, token)).toBe(false)
        expect(isMcpAuthorized(`Basic ${token}`, token)).toBe(false)
        expect(isMcpAuthorized("Bearer wrong-token", token)).toBe(false)
        expect(isMcpAuthorized(`Bearer ${token}`, token)).toBe(true)
    })

    it("refuses an unauthenticated MCP endpoint on a non-loopback host", () => {
        expect(() =>
            loadConfig({ HOST: "0.0.0.0", MCP_ENABLED: "true", MCP_ACCESS_TOKEN: "" }),
        ).toThrow(/MCP_ACCESS_TOKEN is required/)
        expect(
            loadConfig({
                HOST: "0.0.0.0",
                MCP_ENABLED: "true",
                MCP_ACCESS_TOKEN: "a-secure-test-token-at-least-32-characters",
            }).mcpEnabled,
        ).toBe(true)
        expect(loadConfig({ HOST: "127.0.0.1", MCP_ENABLED: "true" }).mcpEnabled).toBe(true)
    })

    it("protects the HTTP endpoint and serves streamable MCP", async () => {
        const { store, dir } = makeStoreSync("mcp-http")
        const token = "a-secure-test-token-at-least-32-characters"
        const app = new Hono()
        app.all("/mcp", context =>
            handleMcpRequest(context, dependencies(store, dir), {
                mcpEnabled: true,
                mcpAccessToken: token,
            }),
        )
        try {
            expect((await app.request("/mcp", { method: "POST" })).status).toBe(401)

            const response = await app.request("/mcp", {
                method: "POST",
                headers: {
                    Accept: "application/json, text/event-stream",
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    jsonrpc: "2.0",
                    id: 1,
                    method: "initialize",
                    params: {
                        protocolVersion: "2025-06-18",
                        capabilities: {},
                        clientInfo: { name: "http-test", version: "1.0.0" },
                    },
                }),
            })
            expect(response.status).toBe(200)
            expect(response.headers.get("content-type")).toContain("text/event-stream")
            expect(await response.text()).toContain('"name":"claim-guide"')
        } finally {
            store.close()
        }
    })
})
