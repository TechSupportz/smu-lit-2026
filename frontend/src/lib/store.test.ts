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

    it("detaches every part of a saved case before a new one starts", () => {
        useCase.getState().setChecks(passedChecks())
        useCase.getState().setBackendCase("case_12345678", 3)
        useCase.getState().setDetails({ respondent: "Example Pte Ltd", summary: "What happened." })
        useCase.getState().toggleItem("filed")
        useCase.getState().addFile({
            id: "local-summary",
            name: "pre-filing-summary.pdf",
            size: 512,
            kind: "generated",
            status: "ready",
        })
        const previousKey = useCase.getState().backendCreateKey

        useCase.getState().reset()

        expect(useCase.getState()).toMatchObject({
            stage: "landing",
            started: false,
            backendCaseId: null,
            backendRevision: null,
            files: [],
            checklist: [],
            details: { respondent: "", summary: "", outcome: "" },
            answers: { category: "", amount: "" },
        })
        expect(useCase.getState().checks.every(check => check.status === "pending")).toBe(true)
        expect(useCase.getState().backendCreateKey).not.toBe(previousKey)

        useCase.getState().start("tenancy")

        expect(useCase.getState()).toMatchObject({
            stage: "filing",
            started: true,
            backendCaseId: null,
            answers: { category: "tenancy" },
        })
    })

    it("records questionnaire answers once, in order, anchored to the visible message", () => {
        useCase.getState().recordAnsweredQuestions([
            { questionId: "q1", question: "When was it due?", answer: "1 September", afterMessageId: "m2" },
            { questionId: "q2", question: "What did you pay?", answer: "S$220", afterMessageId: "m2" },
        ])

        expect(useCase.getState().transcriptEntries).toMatchObject([
            { questionId: "q1", question: "When was it due?", answer: "1 September", afterMessageId: "m2" },
            { questionId: "q2", question: "What did you pay?", answer: "S$220", afterMessageId: "m2" },
        ])
        for (const entry of useCase.getState().transcriptEntries)
            expect(Number.isNaN(Date.parse(entry.at))).toBe(false)

        // A re-submission of the same question must not duplicate the pair.
        useCase.getState().recordAnsweredQuestions([
            { questionId: "q1", question: "When was it due?", answer: "Corrected", afterMessageId: "m5" },
            { questionId: "q3", question: "Did they reply?", answer: "No", afterMessageId: "m5" },
        ])

        expect(useCase.getState().transcriptEntries.map(entry => entry.questionId)).toEqual([
            "q1",
            "q2",
            "q3",
        ])
        expect(useCase.getState().transcriptEntries[0]).toMatchObject({
            answer: "1 September",
            afterMessageId: "m2",
        })
    })

    it("drops duplicates inside a single submission and leaves state alone when nothing is new", () => {
        useCase.getState().recordAnsweredQuestions([
            { questionId: "q1", question: "Asked once", answer: "first", afterMessageId: null },
            { questionId: "q1", question: "Asked once", answer: "second", afterMessageId: null },
        ])

        expect(useCase.getState().transcriptEntries).toHaveLength(1)
        expect(useCase.getState().transcriptEntries[0]).toMatchObject({ answer: "first" })

        const before = useCase.getState().transcriptEntries
        useCase.getState().recordAnsweredQuestions([
            { questionId: "q1", question: "Asked once", answer: "third", afterMessageId: null },
        ])
        expect(useCase.getState().transcriptEntries).toBe(before)
    })

    it("persists the transcript across a reload and clears it on reset", () => {
        useCase.getState().setBackendCase("case_12345678", 3)
        useCase.getState().recordAnsweredQuestions([
            { questionId: "q1", question: "When was it due?", answer: "1 September", afterMessageId: "m2" },
        ])

        const saved = JSON.parse(storage.get("claimguide-case")!) as {
            state: { transcriptEntries: Array<Record<string, unknown>> }
        }
        expect(saved.state.transcriptEntries).toHaveLength(1)
        expect(saved.state.transcriptEntries[0]).toMatchObject({
            questionId: "q1",
            question: "When was it due?",
            answer: "1 September",
            afterMessageId: "m2",
        })

        useCase.persist.rehydrate()
        expect(useCase.getState().transcriptEntries).toMatchObject([{ questionId: "q1" }])

        useCase.getState().reset()
        expect(useCase.getState().transcriptEntries).toEqual([])
    })

    it("survives a persisted payload written before the transcript existed", () => {
        storage.set(
            "claimguide-case",
            JSON.stringify({ state: { started: true, backendCaseId: "case_12345678" }, version: 2 }),
        )

        useCase.persist.rehydrate()

        expect(useCase.getState().transcriptEntries).toEqual([])
        expect(useCase.getState().started).toBe(true)
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
