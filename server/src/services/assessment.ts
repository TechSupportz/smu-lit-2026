import { createHash } from "node:crypto"
import type { CaseRecord } from "../domain/schemas.js"
import type {
    CaseState,
    CaseStore,
    EligibilityCheckInput,
    WarningInput,
} from "../storage/case-store.js"

export const ELIGIBILITY_SOURCE_URL =
    "https://www.judiciary.gov.sg/civil/cases-eligible-small-claim"
export const FILING_SOURCE_URL = "https://www.judiciary.gov.sg/civil/how-to-file-serve-small-claim"
export const RULESET_VERSION = "judiciary-sct-2026-09-05"

export interface ReadinessReason {
    code: string
    message: string
    kind:
        "ELIGIBILITY" | "MISSING_INFORMATION" | "EVIDENCE" | "CONTRADICTION" | "REVIEW" | "PRIVACY"
    acknowledged: boolean
    hardBlock: boolean
}

export interface AssessmentResult {
    eligibilityStatus: "PASS" | "FAIL" | "UNVERIFIED"
    preparationStatus: CaseRecord["preparationStatus"]
    canProceed: boolean
    checks: EligibilityCheckInput[]
    warnings: WarningInput[]
    reasons: ReadinessReason[]
}

function fingerprint(code: string, inputs: unknown): string {
    return createHash("sha256")
        .update(`${code}:${JSON.stringify(inputs)}`)
        .digest("hex")
}

function exactDate(value: string | null): Date | null {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
    const parsed = new Date(`${value}T00:00:00.000Z`)
    return Number.isNaN(parsed.getTime()) ? null : parsed
}

function addCalendarYears(date: Date, years: number): Date {
    const result = new Date(date)
    result.setUTCFullYear(result.getUTCFullYear() + years)
    return result
}

function check(
    code: string,
    result: EligibilityCheckInput["result"],
    explanation: string,
    inputs: Record<string, unknown>,
    sourceUrl: string | null = ELIGIBILITY_SOURCE_URL,
    retrievalStatus: EligibilityCheckInput["retrievalStatus"] = "RETRIEVED",
): EligibilityCheckInput {
    return {
        code,
        result,
        explanation,
        inputs,
        sourceUrl,
        sourceVersion: sourceUrl ? RULESET_VERSION : null,
        checkedAt: new Date().toISOString(),
        retrievalStatus,
    }
}

function amountCheck(record: CaseRecord): EligibilityCheckInput {
    const amount = record.claimAmountCents
    if (amount === null) {
        return check("AMOUNT_LIMIT", "UNVERIFIED", "The claim amount has not been established.", {
            claimAmountCents: null,
            consentStatus: record.consentStatus,
        })
    }
    if (amount <= 2_000_000) {
        return check("AMOUNT_LIMIT", "PASS", "The amount does not exceed SGD 20,000.", {
            claimAmountCents: amount,
            consentStatus: record.consentStatus,
        })
    }
    if (amount > 3_000_000) {
        return check("AMOUNT_LIMIT", "FAIL", "The amount exceeds SGD 30,000.", {
            claimAmountCents: amount,
            consentStatus: record.consentStatus,
        })
    }
    if (record.consentStatus === "YES") {
        return check(
            "AMOUNT_LIMIT",
            "PASS",
            "The amount is above SGD 20,000 and not above SGD 30,000, with consent recorded.",
            {
                claimAmountCents: amount,
                consentStatus: record.consentStatus,
            },
        )
    }
    if (record.consentStatus === "NO") {
        return check(
            "AMOUNT_LIMIT",
            "FAIL",
            "The amount exceeds SGD 20,000 and consent from both parties is confirmed absent.",
            {
                claimAmountCents: amount,
                consentStatus: record.consentStatus,
            },
        )
    }
    return check(
        "AMOUNT_LIMIT",
        "UNVERIFIED",
        "The amount is above SGD 20,000 and consent from both parties is not yet known.",
        {
            claimAmountCents: amount,
            consentStatus: record.consentStatus,
        },
    )
}

function timeCheck(record: CaseRecord, today: Date): EligibilityCheckInput {
    const causeDate = exactDate(record.causeOfActionDate)
    if (!causeDate || record.causeOfActionDatePrecision !== "EXACT") {
        return check(
            "TIME_LIMIT",
            "UNVERIFIED",
            "An exact cause-of-action date is not available, so the 2-year filing period cannot be checked.",
            {
                causeOfActionDate: record.causeOfActionDate,
                originalWording: record.causeOfActionDateOriginal,
                precision: record.causeOfActionDatePrecision,
            },
        )
    }
    const todayUtc = new Date(
        Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
    )
    if (causeDate > todayUtc) {
        return check(
            "TIME_LIMIT",
            "UNVERIFIED",
            "The recorded cause-of-action date is in the future and needs review.",
            {
                causeOfActionDate: record.causeOfActionDate,
                checkedDate: todayUtc.toISOString().slice(0, 10),
            },
        )
    }
    const deadline = addCalendarYears(causeDate, 2)
    const result = todayUtc <= deadline ? "PASS" : "FAIL"
    return check(
        "TIME_LIMIT",
        result,
        result === "PASS"
            ? "The recorded date is within the current 2-year filing period."
            : "The recorded date is more than 2 years before the check date.",
        {
            causeOfActionDate: record.causeOfActionDate,
            lastDay: deadline.toISOString().slice(0, 10),
            checkedDate: todayUtc.toISOString().slice(0, 10),
        },
    )
}

function locationCheck(record: CaseRecord): EligibilityCheckInput {
    if (record.respondentLocationStatus === "SINGAPORE") {
        return check(
            "RESPONDENT_LOCATION",
            "PASS",
            "The respondent is recorded as located in Singapore.",
            {
                status: record.respondentLocationStatus,
            },
        )
    }
    if (record.respondentLocationStatus === "OUTSIDE_SINGAPORE") {
        return check(
            "RESPONDENT_LOCATION",
            "FAIL",
            "The respondent is recorded as outside Singapore.",
            {
                status: record.respondentLocationStatus,
            },
        )
    }
    return check(
        "RESPONDENT_LOCATION",
        "UNVERIFIED",
        "The respondent location has not been established.",
        {
            status: record.respondentLocationStatus,
        },
    )
}

function categoryChecks(record: CaseRecord): EligibilityCheckInput[] {
    if (!record.category) {
        return [
            check("DISPUTE_CATEGORY", "UNVERIFIED", "The dispute category has not been selected.", {
                category: null,
                userConfirmed: record.categoryUserConfirmed,
            }),
        ]
    }
    if (!record.categoryUserConfirmed) {
        return [
            check(
                "DISPUTE_CATEGORY",
                "UNVERIFIED",
                "The proposed dispute category has not been confirmed by the user.",
                {
                    category: record.category,
                    confidence: record.categoryConfidence,
                    userConfirmed: false,
                },
            ),
        ]
    }
    if (record.category === "GENERIC" && record.subtype === "EMPLOYMENT") {
        return [
            check(
                "DISPUTE_CATEGORY",
                "FAIL",
                "Employment matters are outside the Small Claims Tribunals flow.",
                {
                    category: record.category,
                    subtype: record.subtype,
                    userConfirmed: true,
                },
            ),
        ]
    }
    if (record.category === "GENERIC") {
        return [
            check(
                "DISPUTE_CATEGORY",
                "UNVERIFIED",
                "Generic intake is allowed, but SCT category eligibility still needs authoritative review.",
                {
                    category: record.category,
                    userConfirmed: true,
                },
            ),
        ]
    }

    const checks = [
        check(
            "DISPUTE_CATEGORY",
            "PASS",
            "The confirmed category appears in current Judiciary SCT guidance.",
            {
                category: record.category,
                userConfirmed: true,
            },
        ),
    ]

    if (record.category === "PROPERTY_DAMAGE") {
        const data = record.modelData?.model === "PROPERTY_DAMAGE" ? record.modelData : null
        if (data?.motorVehicleRelated === true || data?.neighbourCaused === true) {
            checks.push(
                check(
                    "PROPERTY_DAMAGE_EXCLUSION",
                    "FAIL",
                    "The recorded property-damage claim falls within a listed exclusion.",
                    {
                        motorVehicleRelated: data.motorVehicleRelated,
                        neighbourCaused: data.neighbourCaused,
                    },
                ),
            )
        } else if (data?.motorVehicleRelated === false && data.neighbourCaused === false) {
            checks.push(
                check(
                    "PROPERTY_DAMAGE_EXCLUSION",
                    "PASS",
                    "The recorded facts deny the two listed property-damage exclusions.",
                    {
                        motorVehicleRelated: false,
                        neighbourCaused: false,
                    },
                ),
            )
        } else {
            checks.push(
                check(
                    "PROPERTY_DAMAGE_EXCLUSION",
                    "UNVERIFIED",
                    "Motor-vehicle and neighbour exclusions have not both been checked.",
                    {
                        motorVehicleRelated: data?.motorVehicleRelated ?? null,
                        neighbourCaused: data?.neighbourCaused ?? null,
                    },
                ),
            )
        }
    }

    if (record.category === "CPFTA_UNFAIR_PRACTICE") {
        const data = record.modelData?.model === "CPFTA_UNFAIR_PRACTICE" ? record.modelData : null
        const complete =
            data?.relationshipEstablished === true &&
            Boolean(data.underlyingTransaction) &&
            Boolean(data.exactConduct) &&
            (data.evidenceIds?.length ?? 0) > 0
        checks.push(
            check(
                "CPFTA_CONDITIONS",
                complete ? "PASS" : "NOT_APPLICABLE",
                complete
                    ? "The intake records a consumer-supplier relationship, transaction, exact alleged conduct, and linked evidence; this does not declare a statutory violation."
                    : "The CPFTA-specific details are collected during filing preparation and do not block the initial eligibility check.",
                {
                    relationshipEstablished: data?.relationshipEstablished ?? null,
                    hasUnderlyingTransaction: Boolean(data?.underlyingTransaction),
                    hasExactConduct: Boolean(data?.exactConduct),
                    evidenceCount: data?.evidenceIds?.length ?? 0,
                },
            ),
        )
    }

    return checks
}

function warning(code: string, message: string, inputs: unknown, prominent = true): WarningInput {
    return { code, message, prominent, fingerprint: fingerprint(code, inputs) }
}

export function assessCase(state: CaseState, today = new Date()): AssessmentResult {
    const record = state.case
    const checks = [
        amountCheck(record),
        timeCheck(record, today),
        locationCheck(record),
        ...categoryChecks(record),
    ]
    const failedChecks = checks.filter(item => item.result === "FAIL")
    const unverifiedChecks = checks.filter(item => item.result === "UNVERIFIED")
    const eligibilityStatus =
        failedChecks.length > 0 ? "FAIL" : unverifiedChecks.length > 0 ? "UNVERIFIED" : "PASS"
    const warnings: WarningInput[] = []

    for (const item of failedChecks) {
        warnings.push(
            warning(
                `ELIGIBILITY_${item.code}`,
                `Known eligibility failure: ${item.explanation}`,
                item.inputs,
            ),
        )
    }
    for (const item of unverifiedChecks) {
        warnings.push(
            warning(
                `ELIGIBILITY_${item.code}`,
                `Eligibility remains unverified: ${item.explanation}`,
                item.inputs,
            ),
        )
    }

    const claimants = state.parties.filter(party => party.role === "CLAIMANT")
    const respondents = state.parties.filter(party => party.role === "RESPONDENT")
    if (!claimants.some(party => party.name && party.address)) {
        warnings.push(
            warning(
                "MISSING_CLAIMANT_PARTICULARS",
                "A claimant name and address have not both been recorded.",
                claimants.map(({ id, name, address }) => ({ id, name, address })),
            ),
        )
    }
    if (!respondents.some(party => party.name && party.address)) {
        warnings.push(
            warning(
                "MISSING_RESPONDENT_PARTICULARS",
                "A respondent name and Singapore service address have not both been recorded.",
                respondents.map(({ id, name, address, country }) => ({
                    id,
                    name,
                    address,
                    country,
                })),
            ),
        )
    }
    if (!record.factualSummary) {
        warnings.push(
            warning("MISSING_FACTUAL_SUMMARY", "The factual summary has not been prepared.", {
                factualSummary: null,
            }),
        )
    }
    if (state.remedies.length === 0) {
        warnings.push(
            warning("MISSING_REMEDY", "No requested remedy has been recorded.", { remedies: [] }),
        )
    }
    if (state.evidence.length === 0) {
        warnings.push(
            warning(
                "MISSING_EVIDENCE",
                "No evidence is currently uploaded. Ask for relevant alternatives before proceeding.",
                { evidenceCount: 0 },
            ),
        )
    }

    for (const evidence of state.evidence) {
        if (evidence.processingStatus === "FAILED" || evidence.processingStatus === "PARTIAL") {
            warnings.push(
                warning(
                    `EVIDENCE_${evidence.id}_${evidence.processingStatus}`,
                    evidence.processingStatus === "FAILED"
                        ? `${evidence.originalFilename} could not be fully processed and remains unreviewed.`
                        : `${evidence.originalFilename} was only partly inspected; unreadable or unprocessed content remains.`,
                    {
                        evidenceId: evidence.id,
                        sha256: evidence.sha256,
                        status: evidence.processingStatus,
                        error: evidence.processingError,
                    },
                ),
            )
        }
    }

    for (const fact of state.facts.filter(item => item.material)) {
        if (fact.reviewStatus === "PENDING") {
            warnings.push(
                warning(
                    `FACT_${fact.id}_UNREVIEWED`,
                    `Material fact awaiting user review: ${fact.statement}`,
                    {
                        factId: fact.id,
                        factRevision: fact.revision,
                        reviewStatus: fact.reviewStatus,
                    },
                ),
            )
        }
        if (
            ["UNASSESSED", "NOT_FOUND", "AMBIGUOUS", "CONTRADICTED"].includes(
                fact.evidenceAssessment,
            )
        ) {
            warnings.push(
                warning(
                    `FACT_${fact.id}_EVIDENCE`,
                    `Evidence status for "${fact.statement}": ${fact.evidenceAssessment}.`,
                    {
                        factId: fact.id,
                        factRevision: fact.revision,
                        evidenceAssessment: fact.evidenceAssessment,
                    },
                ),
            )
        }
        const looksLikeCashPayment =
            /\b(cash|paid|payment)\b/i.test(fact.statement) &&
            fact.evidenceAssessment !== "SUPPORTED"
        if (looksLikeCashPayment) {
            warnings.push(
                warning(
                    `FACT_${fact.id}_CASH_ALTERNATIVES`,
                    "This payment assertion may be challenged. Ask for ATM or bank withdrawal records, contemporaneous messages, an acknowledgment, or available CCTV; a withdrawal alone does not prove payment to the respondent.",
                    {
                        factId: fact.id,
                        factRevision: fact.revision,
                        evidenceAssessment: fact.evidenceAssessment,
                    },
                ),
            )
        }
    }

    for (const contradiction of state.contradictions.filter(item => item.status !== "RESOLVED")) {
        warnings.push(
            warning(
                `CONTRADICTION_${contradiction.id}`,
                `Unresolved contradiction: ${contradiction.description}`,
                {
                    contradictionId: contradiction.id,
                    revision: contradiction.revision,
                    status: contradiction.status,
                },
            ),
        )
    }
    for (const question of state.questions.filter(
        item => item.priority === "REQUIRED" && item.status !== "ANSWERED",
    )) {
        warnings.push(
            warning(
                `QUESTION_${question.id}`,
                `${question.status === "OPEN" ? "Required question remains open" : "Required question remains uncertain"}: ${question.question}`,
                { questionId: question.id, revision: question.revision, status: question.status },
            ),
        )
    }

    const sensitive = state.extractionRuns.flatMap(run =>
        run.possibleSensitiveContent.map(item => ({ runId: run.id, item })),
    )
    if (sensitive.length > 0) {
        warnings.push(
            warning(
                "PRIVACY_REVIEW_REQUIRED",
                "Potentially unnecessary sensitive content was detected. Review it before filing; originals have not been modified.",
                sensitive,
            ),
        )
    }
    const promptLike = state.extractionRuns.flatMap(run =>
        run.promptLikeInstructionsObserved.map(item => ({ runId: run.id, item })),
    )
    if (promptLike.length > 0) {
        warnings.push(
            warning(
                "EVIDENCE_PROMPT_LIKE_CONTENT",
                "Prompt-like instructions were observed inside evidence and were treated only as source content.",
                promptLike,
                false,
            ),
        )
    }

    const acknowledged = new Set(
        state.warnings
            .filter(item => item.status === "ACKNOWLEDGED")
            .map(item => `${item.code}:${item.fingerprint}`),
    )
    const reasons = warnings.map((item): ReadinessReason => ({
        code: item.code,
        message: item.message,
        kind: item.code.startsWith("ELIGIBILITY_")
            ? "ELIGIBILITY"
            : item.code.startsWith("CONTRADICTION_")
              ? "CONTRADICTION"
              : item.code.startsWith("EVIDENCE_") || item.code.includes("_EVIDENCE")
                ? "EVIDENCE"
                : item.code.startsWith("PRIVACY_")
                  ? "PRIVACY"
                  : item.code.includes("UNREVIEWED") || item.code.startsWith("QUESTION_")
                    ? "REVIEW"
                    : "MISSING_INFORMATION",
        acknowledged: acknowledged.has(`${item.code}:${item.fingerprint}`),
        hardBlock:
            item.code.startsWith("ELIGIBILITY_") &&
            failedChecks.some(failed => `ELIGIBILITY_${failed.code}` === item.code),
    }))

    const everyWarningAcknowledged = reasons.every(
        reason => reason.acknowledged || reason.hardBlock,
    )
    const materialFactsReviewed = state.facts
        .filter(item => item.material)
        .every(item => item.reviewStatus !== "PENDING")
    const requiredQuestionsReviewed = state.questions
        .filter(item => item.priority === "REQUIRED")
        .every(item => item.status !== "OPEN")
    let preparationStatus: CaseRecord["preparationStatus"]
    if (!materialFactsReviewed || !requiredQuestionsReviewed || !record.userReviewed) {
        preparationStatus = "NEEDS_USER_INPUT"
    } else if (state.evidence.length === 0 && !everyWarningAcknowledged) {
        preparationStatus = "NEEDS_EVIDENCE"
    } else if (
        state.contradictions.some(item => item.status === "OPEN") &&
        !everyWarningAcknowledged
    ) {
        preparationStatus = "NEEDS_CONFLICT_RESOLUTION"
    } else if (!everyWarningAcknowledged) {
        preparationStatus = "NOT_READY"
    } else if (warnings.length > 0) {
        preparationStatus = "READY_WITH_WARNINGS"
    } else {
        preparationStatus = "READY"
    }
    const canProceed =
        eligibilityStatus !== "FAIL" &&
        (preparationStatus === "READY" || preparationStatus === "READY_WITH_WARNINGS")

    return { eligibilityStatus, preparationStatus, canProceed, checks, warnings, reasons }
}

export function refreshAssessment(
    store: CaseStore,
    caseId: string,
    today = new Date(),
): AssessmentResult {
    const state = store.getCaseState(caseId)
    const result = assessCase(state, today)
    store.applyAssessment(caseId, {
        assessedRevision: state.case.revision,
        eligibilityStatus: result.eligibilityStatus,
        preparationStatus: result.preparationStatus,
        canProceed: result.canProceed,
        checks: result.checks,
        warnings: result.warnings,
    })
    return result
}
