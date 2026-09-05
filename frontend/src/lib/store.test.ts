import { beforeEach, describe, expect, it, vi } from "vitest"
import type { EligibilityCheck } from "./types"
import type { BackendCaseState } from "./backend"

const storage = new Map<string, string>()

vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
    clear: () => storage.clear(),
})

describe("useCase navigation gates", async () => {
    const { useCase } = await import("./store")

    beforeEach(() => {
        storage.clear()
        useCase.getState().reset()
    })

    const passedChecks = (): EligibilityCheck[] =>
        useCase.getState().checks.map(check => ({ ...check, status: "passed" }))

    it("opens the conversation before eligibility but keeps later stages gated", () => {
        useCase.getState().go("filing")
        expect(useCase.getState().stage).toBe("filing")

        useCase.getState().go("checkpoint")
        expect(useCase.getState().stage).toBe("filing")

        useCase.getState().setChecks(passedChecks())
        useCase.getState().go("checkpoint")
        expect(useCase.getState().stage).toBe("checkpoint")

        useCase.getState().go("preparation")
        expect(useCase.getState().stage).toBe("checkpoint")

        for (const id of ["filed", "served", "declaration"]) useCase.getState().toggleItem(id)
        useCase.getState().go("preparation")
        expect(useCase.getState().stage).toBe("preparation")
    })

    it("requires all three checklist ids before completion", () => {
        useCase.getState().setChecks(passedChecks())
        useCase.getState().go("complete")
        expect(useCase.getState().stage).toBe("checkpoint")

        useCase.getState().toggleItem("filed")
        useCase.getState().toggleItem("served")
        useCase.getState().go("complete")
        expect(useCase.getState().stage).toBe("checkpoint")

        useCase.getState().toggleItem("declaration")
        useCase.getState().go("complete")
        expect(useCase.getState().stage).toBe("complete")
    })

    it("resumes filing before a PDF exists and invalidates a changed landing category", () => {
        useCase.getState().setChecks(passedChecks())
        useCase.getState().resume()
        expect(useCase.getState().stage).toBe("filing")
        useCase.getState().start("employment")
        expect(useCase.getState().checks.every(check => check.status === "pending")).toBe(true)
        expect(useCase.getState().stage).toBe("filing")
        useCase.getState().go("checkpoint")
        expect(useCase.getState().stage).toBe("filing")
    })

    it("invalidates checks and checklist when answers change", () => {
        useCase.getState().setChecks(passedChecks())
        for (const id of ["filed", "served", "declaration"]) useCase.getState().toggleItem(id)

        useCase.getState().setAnswers({ amount: "2500" })

        expect(useCase.getState().checks.every(check => check.status === "pending")).toBe(true)
        expect(useCase.getState().checklist).toEqual([])
    })

    it("tracks Grill Me completion and resets it when the claim changes", () => {
        useCase.getState().setGrillProgress(true, true)
        expect(useCase.getState()).toMatchObject({ grillStarted: true, grillComplete: true })

        useCase.getState().setDetails({ summary: "A corrected account of what happened." })

        expect(useCase.getState()).toMatchObject({ grillStarted: false, grillComplete: false })
    })

    it("atomically reconciles agent-updated sidebar data and backend documents", () => {
        useCase.getState().toggleItem("filed")
        useCase.getState().addFile({
            id: "local-summary",
            name: "case-summary.pdf",
            size: 2048,
            kind: "generated",
            status: "ready",
            backendStored: true,
        })
        useCase.getState().addFile({
            id: "local-memo",
            name: "sample-legal-memo.pdf",
            size: 1024,
            kind: "generated",
            status: "ready",
        })
        const backendState: BackendCaseState = {
            case: {
                id: "case_12345678",
                revision: 7,
                eligibilityStatus: "PASS",
                preparationStatus: "NEEDS_USER_INPUT",
                userReviewed: false,
                category: "PROVISION_OF_SERVICES",
                subtype: null,
                modelData: { model: "PROVISION_OF_SERVICES" },
                claimAmountCents: 2200,
                factualSummary: "The paid service was not delivered.",
            },
            parties: [{ id: "party_12345678", role: "RESPONDENT", name: "Example Pte Ltd" }],
            remedies: [{ id: "remedy_12345678", description: "Refund the S$22 payment." }],
            facts: [],
            questions: [
                {
                    id: "question_12345678",
                    question: "When was delivery due?",
                    reason: "This establishes the chronology.",
                    priority: "REQUIRED",
                    status: "OPEN",
                    answer: null,
                    suggestedAnswer: null,
                },
            ],
            eligibilityChecks: [
                { code: "AMOUNT_LIMIT", result: "PASS", explanation: "Amount passes." },
                { code: "TIME_LIMIT", result: "PASS", explanation: "Date passes." },
                { code: "RESPONDENT_LOCATION", result: "PASS", explanation: "Location passes." },
                { code: "DISPUTE_CATEGORY", result: "PASS", explanation: "Category passes." },
            ],
            evidence: [
                {
                    id: "evidence_12345678",
                    originalFilename: "receipt.pdf",
                    sizeBytes: 4096,
                    processingStatus: "PROCESSED",
                },
            ],
            warnings: [],
            snapshots: [
                { id: "snapshot_12345678", basename: "case-summary", pdfSha256: "abc" },
                { id: "snapshot_uncompiled", basename: "not-ready", pdfSha256: null },
            ],
        }

        useCase.getState().syncBackendCase(backendState)

        expect(useCase.getState()).toMatchObject({
            answers: { category: "services", amount: "22" },
            details: {
                respondent: "Example Pte Ltd",
                summary: "The paid service was not delivered.",
                outcome: "Refund the S$22 payment.",
            },
            backendCaseId: "case_12345678",
            backendRevision: 7,
            grillStarted: true,
            grillComplete: false,
            checklist: ["filed"],
        })
        expect(useCase.getState().checks.every(check => check.status === "passed")).toBe(true)
        expect(useCase.getState().files).toHaveLength(3)
        expect(useCase.getState().files.find(file => file.name === "receipt.pdf")).toMatchObject({
            backendStored: true,
            backendSource: { type: "evidence", recordId: "evidence_12345678" },
        })
        expect(useCase.getState().files.find(file => file.name === "case-summary.pdf")).toMatchObject({
            id: "local-summary",
            size: 2048,
            backendSource: { type: "snapshot", recordId: "snapshot_12345678" },
        })
        expect(useCase.getState().files.some(file => file.name === "not-ready.pdf")).toBe(false)

        useCase.getState().syncBackendCase({
            ...backendState,
            case: { ...backendState.case, revision: 8 },
            evidence: [],
            questions: backendState.questions.map(question => ({
                ...question,
                status: "ANSWERED" as const,
                answer: "1 September 2026",
            })),
        })

        expect(useCase.getState()).toMatchObject({ grillStarted: true, grillComplete: true })
        expect(useCase.getState().files.some(file => file.name === "receipt.pdf")).toBe(false)
        expect(useCase.getState().files.some(file => file.id === "local-memo")).toBe(true)

        useCase.getState().syncBackendCase({
            ...backendState,
            case: {
                ...backendState.case,
                revision: 7,
                factualSummary: "This stale response must not win.",
            },
        })
        expect(useCase.getState().details.summary).toBe("The paid service was not delivered.")
        expect(useCase.getState().backendRevision).toBe(8)
    })
})
