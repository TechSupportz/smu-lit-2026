import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import type { EvidenceService } from "../services/evidence.js"
import { refreshAssessment } from "../services/assessment.js"
import type { CaseState, CaseStore } from "../storage/case-store.js"

const CASE_TITLE = "Prefilled: disputed salon package"

const FACTS = [
    {
        statement:
            "On 23 October 2025, Madam Lim visited Harmony Hair Studio in Toa Payoh intending to obtain a simple haircut after seeing a sign advertising a women's haircut for SGD 30.",
        structuredValue: { date: "2025-10-23", precision: "EXACT" },
    },
    {
        statement:
            "Madam Lim says the salon staff initially represented that a basic haircut would cost SGD 20.",
        structuredValue: { amountCents: 2000 },
    },
    {
        statement:
            "After the service, the salon charged Madam Lim SGD 100 for a package comprising a haircut, hair wash and hair treatment.",
        structuredValue: { date: "2025-10-23", amountCents: 10000, precision: "EXACT" },
    },
    {
        statement:
            "Madam Lim primarily speaks Mandarin, understands very little English, and says she felt pressured, frightened and afraid during the sales process.",
        structuredValue: null,
    },
    {
        statement:
            "On 24 October 2025, Madam Lim returned to the salon and requested a refund; when no agreement was reached, she later made a police report, complained to CASE, and filed an SCT claim.",
        structuredValue: { date: "2025-10-24", precision: "EXACT" },
    },
] as const

type PrefilledSeedOptions = {
    store: CaseStore
    evidenceService: EvidenceService
    idempotencyKey?: string
    evidenceDirectory?: string
}

function currentRevision(store: CaseStore, caseId: string): number {
    return store.getCase(caseId).revision
}

async function uploadPng(
    store: CaseStore,
    evidenceService: EvidenceService,
    caseId: string,
    path: string,
    name: string,
    documentType: string,
    description: string,
) {
    const bytes = await readFile(path)
    return evidenceService.upload(
        caseId,
        {
            name,
            type: "image/png",
            arrayBuffer: () =>
                Promise.resolve(
                    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
                ),
        },
        {
            expectedRevision: currentRevision(store, caseId),
            documentType,
            description,
            relevantPages: [],
        },
    )
}

/**
 * Create a deterministic, fictional case for the opt-in prefilled walkthrough.
 * This function deliberately records the facts as user-confirmed because the
 * route that calls it is available only when PREFILLED=true.
 */
export async function seedPrefilledHaircutPackage({
    store,
    evidenceService,
    idempotencyKey,
    evidenceDirectory = resolve(process.cwd(), "src/prefilled-scenarios/assets"),
}: PrefilledSeedOptions): Promise<CaseState> {
    const created = store.createCase({
        title: CASE_TITLE,
        claimantName: "Madam Lim (fictional demo claimant)",
        category: "CPFTA_UNFAIR_PRACTICE",
        ...(idempotencyKey ? { idempotencyKey } : {}),
    })
    const existing = store.getCaseState(created.id)
    if (existing.case.revision > 1) return existing

    store.updateCase(created.id, {
        expectedRevision: currentRevision(store, created.id),
        patch: {
            stage: "FINAL_REVIEW",
            category: "CPFTA_UNFAIR_PRACTICE",
            categoryConfidence: 1,
            categoryUserConfirmed: true,
            subtype: "Alleged pressure sale and price discrepancy",
            factualSummary:
                "Madam Lim, an elderly Mandarin-speaking consumer with limited English, visited a fictional Toa Payoh salon on 23 October 2025 for a simple haircut. She says staff first quoted SGD 20, but after the service charged SGD 100 for a package including a haircut, wash and treatment. She says she felt pressured and afraid. She returned on 24 October 2025 to request a full refund, but the parties did not reach agreement.",
            causeOfActionDate: "2025-10-23",
            causeOfActionDateOriginal: "23 October 2025",
            causeOfActionDatePrecision: "EXACT",
            claimAmountCents: 10000,
            consentStatus: "NO",
            respondentLocationStatus: "SINGAPORE",
        },
    })

    const claimant = store
        .getCaseState(created.id)
        .parties.find(party => party.role === "CLAIMANT")
    store.upsertParty(created.id, {
        expectedRevision: currentRevision(store, created.id),
        ...(claimant ? { partyId: claimant.id } : {}),
        role: "CLAIMANT",
        kind: "INDIVIDUAL",
        name: "Madam Lim (fictional demo claimant)",
        identificationType: null,
        identificationNumber: null,
        phone: null,
        email: null,
        address: "Blk 123 Toa Payoh Lorong 1, #05-101, Singapore 310123",
        country: "Singapore",
        isPrimary: true,
    })
    store.upsertParty(created.id, {
        expectedRevision: currentRevision(store, created.id),
        role: "RESPONDENT",
        kind: "ENTITY",
        name: "Harmony Hair Studio (fictional demo respondent)",
        identificationType: null,
        identificationNumber: null,
        phone: null,
        email: null,
        address: "Blk 190 Lorong 6 Toa Payoh, #01-500, Singapore 310190",
        country: "Singapore",
        isPrimary: true,
    })

    const sign = await uploadPng(
        store,
        evidenceService,
        created.id,
        resolve(evidenceDirectory, "harmony-price-sign-demo.png"),
        "01-salon-price-sign-demo.png",
        "ADVERTISEMENT_PHOTO",
        "Synthetic demo photograph of the fictional salon sign advertising a women's haircut for SGD 30.",
    )
    const receipt = await uploadPng(
        store,
        evidenceService,
        created.id,
        resolve(evidenceDirectory, "harmony-receipt-demo.png"),
        "02-salon-receipt-demo.png",
        "RECEIPT_PHOTO",
        "Synthetic demo receipt dated 23 October 2025 showing a total payment of SGD 100 and the haircut, wash and treatment line items.",
    )

    store.updateCase(created.id, {
        expectedRevision: currentRevision(store, created.id),
        patch: {
            modelData: {
                model: "CPFTA_UNFAIR_PRACTICE",
                consumerSupplierRelationship:
                    "Madam Lim attended the respondent's salon as an individual consumer purchasing hair services.",
                relationshipEstablished: true,
                underlyingTransaction:
                    "A simple haircut requested at a fictional neighbourhood salon in Toa Payoh.",
                exactConduct:
                    "The claimant says staff first quoted SGD 20, then charged SGD 100 after providing a package that included a wash and treatment, while she felt pressured and afraid.",
                occurredAt: "Harmony Hair Studio, Toa Payoh (fictional demo outlet)",
                allegedLossCents: 10000,
                remedyNotes: "Full refund of the SGD 100 paid.",
                evidenceIds: [sign.id, receipt.id],
            },
        },
    })

    const seededFactIds: string[] = []
    for (const fact of FACTS) {
        const proposed = store.proposeFact(
            created.id,
            {
                expectedRevision: currentRevision(store, created.id),
                statement: fact.statement,
                structuredValue: fact.structuredValue,
                sourceType: "USER_ASSERTION",
                sourceMessageId: null,
                material: true,
            },
            "USER",
        )
        store.reviewFact(created.id, proposed.id, {
            expectedRevision: currentRevision(store, created.id),
            action: "CONFIRM",
        })
        seededFactIds.push(proposed.id)
    }

    store.linkFactToEvidence(created.id, {
        expectedRevision: currentRevision(store, created.id),
        factId: seededFactIds[0]!,
        evidenceId: sign.id,
        relationship: "SUPPORTS",
    })
    store.linkFactToEvidence(created.id, {
        expectedRevision: currentRevision(store, created.id),
        factId: seededFactIds[2]!,
        evidenceId: receipt.id,
        relationship: "SUPPORTS",
    })
    store.upsertRemedy(created.id, {
        expectedRevision: currentRevision(store, created.id),
        type: "MONEY",
        description: "Order the respondent to refund the SGD 100 paid.",
        amountCents: 10000,
        basis:
            "The claimant says she requested only a simple haircut, was charged for an upgraded package after the service, and promptly sought a refund.",
    })

    refreshAssessment(store, created.id)
    for (const warning of store
        .getCaseState(created.id)
        .warnings.filter(item => item.status === "OPEN")) {
        store.acknowledgeWarning(created.id, warning.id, {
            expectedRevision: currentRevision(store, created.id),
            fingerprint: warning.fingerprint,
        })
    }
    store.updateCase(created.id, {
        expectedRevision: currentRevision(store, created.id),
        patch: { userReviewed: true },
    })
    refreshAssessment(store, created.id)
    return store.getCaseState(created.id)
}
