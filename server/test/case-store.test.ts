import { describe, expect, it } from "vitest"
import { IdempotencyConflictError, RevisionConflictError } from "../src/errors.js"
import type { refreshAssessment } from "../src/services/assessment.js"
import { CaseStore } from "../src/storage/case-store.js"
import { createCase, makeStoreSync } from "./helpers.js"

describe("CaseStore persistence and mutation safety", () => {
    it("persists a case and its revision across a database restart", () => {
        const { store, dir } = makeStoreSync("restart")
        const created = createCase(store, { idempotencyKey: "restart-case-1" })
        const updated = store.updateCase(created.id, {
            expectedRevision: created.revision,
            patch: { factualSummary: "A saved summary", claimAmountCents: 2_000_000 },
        })
        store.close()

        const reopened = new CaseStore(`${dir}/cases.db`)
        try {
            expect(reopened.getCase(created.id)).toMatchObject({
                id: created.id,
                revision: updated.revision,
                factualSummary: "A saved summary",
                claimAmountCents: 2_000_000,
            })
            expect(reopened.listCases()).toHaveLength(1)
        } finally {
            reopened.close()
        }
    })

    it("rejects stale revisions instead of silently overwriting newer data", () => {
        const { store } = makeStoreSync("stale-revision")
        try {
            const created = createCase(store)
            const next = store.updateCase(created.id, {
                expectedRevision: created.revision,
                patch: { title: "First writer" },
            })
            expect(() =>
                store.updateCase(created.id, {
                    expectedRevision: created.revision,
                    patch: { title: "Stale writer" },
                }),
            ).toThrow(RevisionConflictError)
            expect(store.getCase(created.id)).toMatchObject({
                revision: next.revision,
                title: "First writer",
            })
        } finally {
            store.close()
        }
    })

    it("replays an idempotent create and rejects a reused key with a different request", () => {
        const { store } = makeStoreSync("idempotency")
        try {
            const first = createCase(store, { idempotencyKey: "create-key-1" })
            const replay = createCase(store, { idempotencyKey: "create-key-1" })
            expect(replay).toEqual(first)
            expect(store.listCases()).toHaveLength(1)
            expect(() =>
                createCase(store, { idempotencyKey: "create-key-1", title: "Different case" }),
            ).toThrow(IdempotencyConflictError)

            const turn = store.beginTurn(first.id, {
                idempotencyKey: "turn-key-1",
                requestHash: "hash-a",
            })
            expect(turn.duplicate).toBe(false)
            store.finishTurnAdmission(turn.id, {
                submissionId: "submission-1",
                uid: "agent-1",
                acceptedAt: "2026-09-05T00:00:00.000Z",
            })
            const turnReplay = store.beginTurn(first.id, {
                idempotencyKey: "turn-key-1",
                requestHash: "hash-a",
            })
            expect(turnReplay).toMatchObject({
                duplicate: true,
                status: "ACCEPTED",
                submissionId: "submission-1",
                agentUid: "agent-1",
            })
            expect(() =>
                store.beginTurn(first.id, { idempotencyKey: "turn-key-1", requestHash: "hash-b" }),
            ).toThrow(IdempotencyConflictError)
        } finally {
            store.close()
        }
    })

    it("acknowledges the exact warning fingerprint and makes a changed warning stale", () => {
        const { store } = makeStoreSync("warning-fingerprint")
        try {
            const record = createCase(store)
            const firstFingerprint = "fingerprint-v1"
            const first = refreshWithWarning(
                store,
                record.id,
                firstFingerprint,
                "Review the amount",
            )
            const warning = store
                .getCaseState(record.id)
                .warnings.find(item => item.code === "TEST_WARNING")
            expect(warning).toBeDefined()
            const acknowledged = store.acknowledgeWarning(record.id, warning!.id, {
                expectedRevision: store.getCase(record.id).revision,
                fingerprint: firstFingerprint,
            })
            expect(acknowledged.status).toBe("ACKNOWLEDGED")
            expect(acknowledged.fingerprint).toBe(firstFingerprint)

            const changedRevision = store.getCase(record.id).revision
            refreshWithWarning(
                store,
                record.id,
                "fingerprint-v2",
                "Review the changed amount",
                changedRevision,
            )
            const activeWarnings = store.getCaseState(record.id).warnings
            expect(activeWarnings).toHaveLength(1)
            expect(activeWarnings[0]).toMatchObject({
                fingerprint: "fingerprint-v2",
                status: "OPEN",
            })
            expect(() =>
                store.acknowledgeWarning(record.id, warning!.id, {
                    expectedRevision: store.getCase(record.id).revision,
                    fingerprint: firstFingerprint,
                }),
            ).toThrow(RevisionConflictError)
            expect(first).toBeDefined()
        } finally {
            store.close()
        }
    })

    it("cascades app-managed records when a case is deleted", () => {
        const { store } = makeStoreSync("delete-cascade")
        try {
            const created = createCase(store)
            const fact = store.proposeFact(created.id, {
                expectedRevision: created.revision,
                statement: "The claimant paid SGD 500.",
                structuredValue: null,
                sourceMessageId: null,
                sourceType: "USER_ASSERTION",
                material: true,
            })
            const result = store.addQuestion(created.id, {
                expectedRevision: store.getCase(created.id).revision,
                question: "What date did this happen?",
                reason: "The date is material.",
                relatedFactIds: [fact.id],
                priority: "REQUIRED",
                suggestedAnswer: "It happened on the date shown on my receipt.",
            })
            expect(result.caseId).toBe(created.id)
            expect(result.suggestedAnswer).toBe("It happened on the date shown on my receipt.")
            const paths = store.deleteCaseRecords(created.id)
            expect(paths.evidencePaths).toEqual([])
            expect(store.listCases()).toEqual([])
            expect(() => store.getCaseState(created.id)).toThrow()
        } finally {
            store.close()
        }
    })
})

function refreshWithWarning(
    store: Parameters<typeof refreshAssessment>[0],
    caseId: string,
    fingerprint: string,
    message: string,
    expectedRevision?: number,
) {
    const state = store.getCaseState(caseId)
    expect(expectedRevision ?? state.case.revision).toBe(state.case.revision)
    store.applyAssessment(caseId, {
        assessedRevision: state.case.revision,
        eligibilityStatus: "UNVERIFIED",
        preparationStatus: "NOT_READY",
        canProceed: false,
        checks: [],
        warnings: [{ code: "TEST_WARNING", message, prominent: true, fingerprint }],
    })
    return store.getCaseState(caseId).warnings.find(item => item.code === "TEST_WARNING")
}
