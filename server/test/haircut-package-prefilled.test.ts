import { describe, expect, it } from "vitest"
import { seedPrefilledHaircutPackage } from "../src/prefilled-scenarios/haircut-package.js"
import { EvidenceService } from "../src/services/evidence.js"
import { makeStore, testConfig } from "./helpers.js"

describe("prefilled haircut package seed", () => {
    it("creates a reviewed, eligible case with useful PDF content and synthetic evidence", async () => {
        const { store, dir } = await makeStore("haircut-prefilled")
        const state = await seedPrefilledHaircutPackage({
            store,
            evidenceService: new EvidenceService(store, testConfig(dir)),
            idempotencyKey: "haircut-prefilled-test",
        })

        expect(state.case).toMatchObject({
            category: "CPFTA_UNFAIR_PRACTICE",
            categoryUserConfirmed: true,
            claimAmountCents: 10000,
            causeOfActionDate: "2025-10-23",
            eligibilityStatus: "PASS",
            preparationStatus: "READY_WITH_WARNINGS",
            userReviewed: true,
            canProceed: true,
        })
        expect(state.parties).toHaveLength(2)
        expect(state.facts).toHaveLength(5)
        expect(state.facts.every(fact => fact.reviewStatus === "CONFIRMED")).toBe(true)
        expect(state.evidence.map(item => item.originalFilename)).toEqual([
            "01-salon-price-sign-demo.png",
            "02-salon-receipt-demo.png",
        ])
        expect(state.remedies[0]).toMatchObject({ type: "MONEY", amountCents: 10000 })
        expect(state.warnings.every(warning => warning.status === "ACKNOWLEDGED")).toBe(true)
    })
})
