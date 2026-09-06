import { readFile, stat, writeFile } from "node:fs/promises"
import { describe, expect, it, vi } from "vitest"
import { ProcessingError } from "../src/errors.js"
import { EvidenceService, type UploadSource } from "../src/services/evidence.js"
import { createCase, makeStoreSync, testConfig } from "./helpers.js"

function upload(name: string, type: string, value: string): UploadSource {
    const bytes = new TextEncoder().encode(value)
    return {
        name,
        type,
        arrayBuffer: () => Promise.resolve(bytes.slice().buffer),
    }
}

describe("immutable evidence uploads", () => {
    it("stores a sanitized original filename, SHA-256, and read-only original", async () => {
        const { store, dir } = makeStoreSync("evidence-upload")
        try {
            const service = new EvidenceService(store, testConfig(dir))
            const created = createCase(store)
            const record = await service.upload(
                created.id,
                upload("../receipt.txt", "text/plain", "Paid SGD 500 on 2026-01-02."),
                {
                    expectedRevision: created.revision,
                    documentType: "RECEIPT",
                    description: "Payment receipt",
                    relevantPages: [],
                },
            )
            expect(record.originalFilename).toBe("receipt.txt")
            expect(record.storageKey).toMatch(new RegExp(`^${created.id}/.+\\.txt$`))
            expect(record.sha256).toMatch(/^[0-9a-f]{64}$/)
            expect(record.sizeBytes).toBeGreaterThan(0)
            expect(record.processingStatus).toBe("PENDING")

            const path = service.resolveEvidencePath(record)
            expect(await readFile(path, "utf8")).toBe("Paid SGD 500 on 2026-01-02.")
            expect((await stat(path)).mode & 0o777).toBe(0o400)
            await expect(writeFile(path, "replacement", { flag: "wx" })).rejects.toMatchObject({
                code: "EEXIST",
            })
            expect(await readFile(path, "utf8")).toBe("Paid SGD 500 on 2026-01-02.")
        } finally {
            store.close()
        }
    })

    it("rejects unsupported types and oversized uploads before touching storage", async () => {
        const { store, dir } = makeStoreSync("evidence-limits")
        try {
            const created = createCase(store)
            const service = new EvidenceService(store, testConfig(dir, { maxUploadBytes: 8 }))
            await expect(
                service.upload(
                    created.id,
                    upload("malware.exe", "application/octet-stream", "hello"),
                    {
                        expectedRevision: created.revision,
                        documentType: null,
                        description: null,
                        relevantPages: [],
                    },
                ),
            ).rejects.toThrow(ProcessingError)
            await expect(
                service.upload(created.id, upload("too-large.txt", "text/plain", "0123456789"), {
                    expectedRevision: created.revision,
                    documentType: null,
                    description: null,
                    relevantPages: [],
                }),
            ).rejects.toThrow(/upload limit/)
            expect(store.getCaseState(created.id).evidence).toEqual([])
        } finally {
            store.close()
        }
    })

    it("requires an extraction provider key and leaves the original pending when extraction is unavailable", async () => {
        const { store, dir } = makeStoreSync("evidence-extraction")
        try {
            const service = new EvidenceService(store, testConfig(dir))
            const created = createCase(store)
            const record = await service.upload(
                created.id,
                upload("notes.txt", "text/plain", "Source notes."),
                {
                    expectedRevision: created.revision,
                    documentType: "NOTES",
                    description: null,
                    relevantPages: [],
                },
            )
            await expect(
                service.extract(created.id, record.id, store.getCase(created.id).revision),
            ).rejects.toThrow(/OPENROUTER_API_KEY/)
            expect(store.getEvidence(created.id, record.id).processingStatus).toBe("PENDING")
        } finally {
            store.close()
        }
    })

    it("accepts a Word upload by extension when the browser supplies a generic MIME type", async () => {
        const { store, dir } = makeStoreSync("evidence-word-mime")
        try {
            const service = new EvidenceService(
                store,
                testConfig(dir, { openRouterApiKey: "test-key" }),
            )
            const created = createCase(store)
            const record = await service.upload(
                created.id,
                upload("supporting-letter.docx", "application/octet-stream", "mock-docx-bytes"),
                {
                    expectedRevision: created.revision,
                    documentType: "LETTER",
                    description: null,
                    relevantPages: [],
                },
            )
            expect(record.mimeType).toBe(
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            )
            expect(record.storageKey).toMatch(/\.docx$/)
            await expect(
                service.extract(created.id, record.id, store.getCase(created.id).revision),
            ).rejects.toThrow(/can be included in the tribunal PDF stack/)
            expect(store.getEvidence(created.id, record.id).processingStatus).toBe("PENDING")
        } finally {
            store.close()
        }
    })

    it("omits unsupported sampling parameters from vision extraction requests", async () => {
        const { store, dir } = makeStoreSync("evidence-vision-request")
        try {
            const fetchMock = vi.fn((_input: string | URL | Request, init?: RequestInit) => {
                if (typeof init?.body !== "string") throw new Error("Expected a JSON request body")
                const parsed: unknown = JSON.parse(init.body)
                const body = parsed as {
                    temperature?: number
                    messages: Array<{ content: Array<Record<string, unknown>> }>
                    provider: { require_parameters: boolean }
                    response_format: {
                        json_schema: {
                            schema: {
                                properties: {
                                    items: {
                                        items: {
                                            required: string[]
                                            properties: Record<string, { type?: unknown }>
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                expect(body).not.toHaveProperty("temperature")
                expect(body.provider.require_parameters).toBe(true)
                const itemSchema =
                    body.response_format.json_schema.schema.properties.items.items
                expect(itemSchema.required).toEqual([
                    "type",
                    "value",
                    "page",
                    "quote",
                    "location",
                    "confidence",
                ])
                expect(itemSchema.properties.page?.type).toEqual(["integer", "null"])
                const imagePart = body.messages[0]?.content.find(
                    part => part.type === "image_url",
                )
                if (!imagePart || typeof imagePart.image_url !== "object") {
                    throw new Error("Expected an image URL content part")
                }
                const imageUrl = (imagePart.image_url as { url?: unknown }).url
                expect(imageUrl).toEqual(expect.stringMatching(/^data:image\/png;base64,/))
                return new Response(
                    JSON.stringify({
                        choices: [
                            {
                                message: {
                                    content: JSON.stringify({
                                        documentTitle: "Receipt",
                                        summary: "A readable receipt.",
                                        items: [
                                            {
                                                type: "AMOUNT",
                                                value: "SGD 399",
                                                page: null,
                                                quote: null,
                                                location: null,
                                                confidence: null,
                                            },
                                        ],
                                        pagesInspected: [],
                                        unreadablePages: [],
                                        possibleSensitiveContent: [],
                                        promptLikeInstructionsObserved: [],
                                        inspectionComplete: true,
                                    }),
                                },
                            },
                        ],
                    }),
                    { status: 200 },
                )
            })
            vi.stubGlobal("fetch", fetchMock)

            const service = new EvidenceService(
                store,
                testConfig(dir, { openRouterApiKey: "test-key" }),
            )
            const created = createCase(store)
            const record = await service.upload(
                created.id,
                upload("receipt.png", "image/png", "synthetic image bytes"),
                {
                    expectedRevision: created.revision,
                    documentType: "RECEIPT",
                    description: null,
                    relevantPages: [],
                },
            )

            await service.extract(created.id, record.id, store.getCase(created.id).revision)

            expect(fetchMock).toHaveBeenCalledOnce()
            expect(store.getEvidence(created.id, record.id).processingStatus).toBe("PROCESSED")
            expect(store.getCaseState(created.id).extractions[0]).toMatchObject({
                type: "AMOUNT",
                value: "SGD 399",
            })
        } finally {
            vi.unstubAllGlobals()
            store.close()
        }
    })

    it("records the bounded provider message when extraction is rejected", async () => {
        const { store, dir } = makeStoreSync("evidence-provider-error")
        try {
            vi.stubGlobal(
                "fetch",
                vi.fn(() =>
                    Promise.resolve(
                        new Response(
                            JSON.stringify({
                                error: {
                                    message:
                                        "No endpoints found that can handle the requested parameters.",
                                },
                            }),
                            { status: 404 },
                        ),
                    ),
                ),
            )
            const service = new EvidenceService(
                store,
                testConfig(dir, { openRouterApiKey: "test-key" }),
            )
            const created = createCase(store)
            const record = await service.upload(
                created.id,
                upload("receipt.png", "image/png", "synthetic image bytes"),
                {
                    expectedRevision: created.revision,
                    documentType: "RECEIPT",
                    description: null,
                    relevantPages: [],
                },
            )

            await expect(
                service.extract(created.id, record.id, store.getCase(created.id).revision),
            ).rejects.toThrow("OpenRouter extraction request failed")

            expect(store.getEvidence(created.id, record.id).processingError).toContain(
                "No endpoints found that can handle the requested parameters.",
            )
        } finally {
            vi.unstubAllGlobals()
            store.close()
        }
    })
})
