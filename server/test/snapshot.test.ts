import { readFile, stat } from "node:fs/promises"
import { describe, expect, it } from "vitest"
import { ProcessingError } from "../src/errors.js"
import { SnapshotService } from "../src/services/snapshot.js"
import { createCase, makeStoreSync, testConfig } from "./helpers.js"

describe("final snapshot invariants", () => {
    it("requires explicit case review and resolved material fact review", async () => {
        const { store, dir } = makeStoreSync("snapshot-review")
        try {
            const service = new SnapshotService(store, testConfig(dir))
            const created = createCase(store)
            await expect(service.create(created.id, created.revision)).rejects.toThrow(
                ProcessingError,
            )

            const fact = store.proposeFact(created.id, {
                expectedRevision: created.revision,
                statement: "The claimant paid SGD 500.",
                structuredValue: null,
                sourceMessageId: null,
                sourceType: "USER_ASSERTION",
                material: true,
            })
            const reviewedCase = store.updateCase(created.id, {
                expectedRevision: store.getCase(created.id).revision,
                patch: { userReviewed: true, factualSummary: "A concise reviewed summary." },
            })
            await expect(service.create(created.id, reviewedCase.revision)).rejects.toThrow(
                /material fact/,
            )

            const reviewedFact = store.reviewFact(created.id, fact.id, {
                expectedRevision: store.getCase(created.id).revision,
                action: "MARK_UNCERTAIN",
            })
            expect(reviewedFact.reviewStatus).toBe("UNCERTAIN")
            expect(store.getCase(created.id).userReviewed).toBe(false)
            store.updateCase(created.id, {
                expectedRevision: store.getCase(created.id).revision,
                patch: { userReviewed: true },
            })
            const final = await service.create(created.id, store.getCase(created.id).revision)
            expect(final.snapshot.status.userReviewed).toBe(true)
            expect(final.snapshot.facts).toHaveLength(1)
            expect(final.snapshot.facts[0]!.reviewStatus).toBe("UNCERTAIN")
        } finally {
            store.close()
        }
    })

    it("writes immutable, hashed JSON and links subsequent snapshots by supersession", async () => {
        const { store, dir } = makeStoreSync("snapshot-supersession")
        try {
            const service = new SnapshotService(store, testConfig(dir))
            const created = createCase(store)
            const reviewed = store.updateCase(created.id, {
                expectedRevision: created.revision,
                patch: { userReviewed: true, factualSummary: "Reviewed facts for export." },
            })
            const first = await service.create(created.id, reviewed.revision)
            const firstText = await readFile(first.record.jsonPath, "utf8")
            expect(first.record.jsonSha256).toMatch(/^[0-9a-f]{64}$/)
            expect((await stat(first.record.jsonPath)).mode & 0o777).toBe(0o400)
            expect(JSON.parse(firstText)).toMatchObject({
                schemaVersion: "1.0.0",
                snapshot: {
                    id: first.record.id,
                    caseId: created.id,
                    caseRevision: reviewed.revision,
                },
            })

            const second = await service.create(created.id, reviewed.revision)
            expect(second.record.supersedesSnapshotId).toBe(first.record.id)
            expect(store.getSnapshot(created.id, first.record.id).supersededBySnapshotId).toBe(
                second.record.id,
            )
            expect(store.getCaseState(created.id).snapshots[0]!.id).toBe(second.record.id)
            expect(await readFile(first.record.jsonPath, "utf8")).toBe(firstText)
        } finally {
            store.close()
        }
    })

    it("preserves eligibility failures in the snapshot and marks handoff blocked", async () => {
        const { store, dir } = makeStoreSync("snapshot-blocked")
        try {
            const service = new SnapshotService(store, testConfig(dir))
            const created = createCase(store)
            const reviewed = store.updateCase(created.id, {
                expectedRevision: created.revision,
                patch: {
                    userReviewed: true,
                    claimAmountCents: 3_000_001,
                    causeOfActionDate: "2025-01-01",
                    causeOfActionDatePrecision: "EXACT",
                    respondentLocationStatus: "SINGAPORE",
                },
            })
            const result = await service.create(created.id, reviewed.revision)
            expect(result.snapshot.status.eligibilityStatus).toBe("FAIL")
            expect(result.snapshot.status.handoffPermission).toBe("BLOCKED_ELIGIBILITY")
            expect(result.snapshot.status.canProceed).toBe(false)
            expect(
                result.snapshot.proceduralChecks.some(
                    check => check.code === "AMOUNT_LIMIT" && check.result === "FAIL",
                ),
            ).toBe(true)
        } finally {
            store.close()
        }
    })
})
