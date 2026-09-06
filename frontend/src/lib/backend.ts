import {
    initialChecks,
    type CaseDetails,
    type EligibilityAnswers,
    type EligibilityCheck,
    type CasePrepArtifact,
    type CasePrepBundle,
} from "./types"

export type { CasePrepArtifact, CasePrepBundle }

type DisputeCategory =
    | "SALE_OF_GOODS"
    | "PROVISION_OF_SERVICES"
    | "RESIDENTIAL_TENANCY"
    | "PROPERTY_DAMAGE"
    | "CPFTA_UNFAIR_PRACTICE"
    | "GENERIC"
type CheckResult = "PASS" | "FAIL" | "UNVERIFIED" | "NOT_APPLICABLE"

export type BackendCaseState = {
    case: {
        id: string
        revision: number
        eligibilityStatus: "PASS" | "FAIL" | "UNVERIFIED"
        preparationStatus: string
        userReviewed: boolean
        category: DisputeCategory | "MOTOR_VEHICLE_DEPOSIT_REFUND" | null
        subtype?: string | null
        modelData?: Record<string, unknown> | null
        claimAmountCents: number | null
        factualSummary?: string | null
    }
    parties: Array<{ id: string; role: "CLAIMANT" | "RESPONDENT"; name: string | null }>
    remedies: Array<{ id: string; description?: string }>
    facts: Array<{ id: string; material: boolean; reviewStatus: string }>
    questions: BackendQuestion[]
    eligibilityChecks: Array<{ code: string; result: CheckResult; explanation: string }>
    evidence: Array<{
        id: string
        originalFilename: string
        sizeBytes: number
        processingStatus: string
    }>
    warnings: Array<{
        id: string
        code: string
        message: string
        status: string
        fingerprint: string
    }>
    snapshots: Array<{ id: string; basename: string; pdfSha256?: string | null }>
}

export type BackendQuestion = {
    id: string
    question: string
    reason: string
    priority: string
    status: "OPEN" | "ANSWERED" | "UNRESOLVED"
    answer: string | null
    suggestedAnswer: string | null
}

type ErrorEnvelope = { error?: { code?: string; message?: string; details?: unknown } }

export class BackendError extends Error {
    constructor(
        public readonly status: number,
        public readonly code: string,
        message: string,
    ) {
        super(message)
        this.name = "BackendError"
    }
}

const configuredBase = import.meta.env.VITE_API_BASE_URL?.trim() || "/api"
export const backendBaseUrl = configuredBase.replace(/\/$/, "")
export const backendAgentUrl = (caseId: string) =>
    `${backendBaseUrl}/agents/sct-prefiling/${encodeURIComponent(caseId)}`

async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${backendBaseUrl}${path}`, init)
    if (!response.ok) {
        let body: ErrorEnvelope = {}
        try {
            body = (await response.json()) as ErrorEnvelope
        } catch {
            /* non-JSON upstream error */
        }
        throw new BackendError(
            response.status,
            body.error?.code ?? "REQUEST_FAILED",
            body.error?.message ?? `Backend request failed (${response.status}).`,
        )
    }
    return response.json() as Promise<T>
}

function backendUrl(pathOrUrl: string): string {
    if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl
    if (pathOrUrl === backendBaseUrl || pathOrUrl.startsWith(`${backendBaseUrl}/`)) {
        return pathOrUrl
    }
    if (/^https?:\/\//i.test(backendBaseUrl)) {
        const configured = new URL(backendBaseUrl)
        const basePath = configured.pathname.replace(/\/$/, "")
        if (basePath && pathOrUrl.startsWith(`${basePath}/`)) {
            return `${configured.origin}${pathOrUrl}`
        }
    }
    return `${backendBaseUrl}${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`
}

async function requestBlob(pathOrUrl: string): Promise<Blob> {
    const response = await fetch(backendUrl(pathOrUrl))
    if (!response.ok) {
        let body: ErrorEnvelope = {}
        try {
            body = (await response.json()) as ErrorEnvelope
        } catch {
            /* non-JSON upstream error */
        }
        throw new BackendError(
            response.status,
            body.error?.code ?? "DOWNLOAD_FAILED",
            body.error?.message ?? `Backend file download failed (${response.status}).`,
        )
    }
    return response.blob()
}

async function downloadBlob(blob: Blob, filename: string): Promise<void> {
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = filename
    anchor.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const json = (method: string, body: unknown): RequestInit => ({
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
})

function categoryPatch(category: string): {
    category: DisputeCategory
    subtype: string | null
    modelData: Record<string, unknown> | null
} {
    switch (category) {
        case "goods":
            return {
                category: "SALE_OF_GOODS",
                subtype: null,
                modelData: { model: "SALE_OF_GOODS" },
            }
        case "services":
            return {
                category: "PROVISION_OF_SERVICES",
                subtype: null,
                modelData: { model: "PROVISION_OF_SERVICES" },
            }
        case "tenancy":
            return {
                category: "RESIDENTIAL_TENANCY",
                subtype: null,
                modelData: { model: "RESIDENTIAL_TENANCY" },
            }
        case "property":
            return {
                category: "PROPERTY_DAMAGE",
                subtype: null,
                modelData: {
                    model: "PROPERTY_DAMAGE",
                    motorVehicleRelated: false,
                    neighbourCaused: false,
                },
            }
        case "vehicle":
            return {
                category: "PROPERTY_DAMAGE",
                subtype: null,
                modelData: {
                    model: "PROPERTY_DAMAGE",
                    motorVehicleRelated: true,
                    neighbourCaused: false,
                },
            }
        case "neighbour":
            return {
                category: "PROPERTY_DAMAGE",
                subtype: null,
                modelData: {
                    model: "PROPERTY_DAMAGE",
                    motorVehicleRelated: false,
                    neighbourCaused: true,
                },
            }
        case "unfair":
            return {
                category: "CPFTA_UNFAIR_PRACTICE",
                subtype: null,
                modelData: { model: "CPFTA_UNFAIR_PRACTICE" },
            }
        case "employment":
            return { category: "GENERIC", subtype: "EMPLOYMENT", modelData: null }
        default:
            return { category: "GENERIC", subtype: null, modelData: null }
    }
}

export function frontendCategory(state: BackendCaseState): string {
    const modelData = state.case.modelData
    switch (state.case.category) {
        case "SALE_OF_GOODS":
            return "goods"
        case "PROVISION_OF_SERVICES":
            return "services"
        case "RESIDENTIAL_TENANCY":
            return "tenancy"
        case "PROPERTY_DAMAGE":
            return modelData?.motorVehicleRelated === true
                ? "vehicle"
                : modelData?.neighbourCaused === true
                  ? "neighbour"
                  : "property"
        case "CPFTA_UNFAIR_PRACTICE":
            return "unfair"
        case "GENERIC":
            return state.case.subtype === "EMPLOYMENT" ? "employment" : "other"
        case "MOTOR_VEHICLE_DEPOSIT_REFUND":
            return "other"
        default:
            return ""
    }
}

function eligibilityPatch(answers: EligibilityAnswers) {
    const amount = Number(answers.amount)
    const category = categoryPatch(answers.category)
    return {
        ...category,
        categoryUserConfirmed: true,
        claimAmountCents: Number.isFinite(amount) ? Math.round(amount * 100) : null,
        causeOfActionDate: answers.eventDate || null,
        causeOfActionDateOriginal: answers.eventDate || null,
        causeOfActionDatePrecision: answers.eventDate ? "EXACT" : "UNKNOWN",
        consentStatus: amount > 20_000 ? (answers.consent ? "YES" : "NO") : "UNKNOWN",
        respondentLocationStatus:
            answers.respondentInSingapore === "yes"
                ? "SINGAPORE"
                : answers.respondentInSingapore === "no"
                  ? "OUTSIDE_SINGAPORE"
                  : "UNKNOWN",
    }
}

export async function getBackendCase(caseId: string): Promise<BackendCaseState> {
    return request(`/cases/${encodeURIComponent(caseId)}`)
}

export async function assessBackendEligibility(
    answers: EligibilityAnswers,
    caseId: string | null,
    idempotencyKey: string,
): Promise<BackendCaseState> {
    let record: { id: string; revision: number }
    if (caseId) {
        try {
            const current = await getBackendCase(caseId)
            record = current.case
        } catch (error) {
            if (!(error instanceof BackendError) || error.status !== 404) throw error
            const created = await request<BackendCaseState>(
                "/cases",
                json("POST", {
                    category: categoryPatch(answers.category).category,
                    idempotencyKey,
                }),
            )
            record = created.case
        }
    } else {
        const created = await request<BackendCaseState>(
            "/cases",
            json("POST", { category: categoryPatch(answers.category).category, idempotencyKey }),
        )
        record = created.case
    }
    return request(
        `/cases/${encodeURIComponent(record.id)}`,
        json("PATCH", {
            expectedRevision: record.revision,
            patch: eligibilityPatch(answers),
        }),
    )
}

export function frontendChecks(state: BackendCaseState): EligibilityCheck[] {
    const codes: Record<string, string[]> = {
        value: ["AMOUNT_LIMIT"],
        time: ["TIME_LIMIT"],
        location: ["RESPONDENT_LOCATION"],
        category: ["DISPUTE_CATEGORY", "PROPERTY_DAMAGE_EXCLUSION", "CPFTA_CONDITIONS"],
    }
    return initialChecks.map(item => {
        const relevant = state.eligibilityChecks.filter(check =>
            codes[item.id]?.includes(check.code),
        )
        const failed = relevant.find(check => check.result === "FAIL")
        const unknown = relevant.find(check => check.result === "UNVERIFIED")
        const result = failed ?? unknown ?? relevant.find(check => check.result === "PASS")
        return {
            ...item,
            status: failed ? "blocked" : unknown || !result ? "pending" : "passed",
            detail: result?.explanation,
        }
    })
}

export async function syncCaseDetails(
    caseId: string,
    details: CaseDetails,
): Promise<BackendCaseState> {
    let state = await getBackendCase(caseId)
    state = await request(
        `/cases/${encodeURIComponent(caseId)}`,
        json("PATCH", {
            expectedRevision: state.case.revision,
            patch: {
                factualSummary: details.summary,
                title: details.respondent ? `Claim against ${details.respondent}` : null,
            },
        }),
    )
    const respondent = state.parties.find(party => party.role === "RESPONDENT")
    state = await request(
        `/cases/${encodeURIComponent(caseId)}/parties`,
        json("POST", {
            expectedRevision: state.case.revision,
            ...(respondent ? { partyId: respondent.id } : {}),
            role: "RESPONDENT",
            kind: "UNKNOWN",
            name: details.respondent,
            country: "Singapore",
            isPrimary: true,
        }),
    )
    const remedy = state.remedies[0]
    return request(
        `/cases/${encodeURIComponent(caseId)}/remedies`,
        json("POST", {
            expectedRevision: state.case.revision,
            ...(remedy ? { remedyId: remedy.id } : {}),
            type: "OTHER",
            description: details.outcome,
        }),
    )
}

export async function answerBackendQuestion(
    caseId: string,
    questionId: string,
    answer: string,
): Promise<BackendCaseState> {
    const current = await getBackendCase(caseId)
    return request(
        `/cases/${encodeURIComponent(caseId)}/questions/${encodeURIComponent(questionId)}`,
        json("PATCH", {
            expectedRevision: current.case.revision,
            status: "ANSWERED",
            answer,
        }),
    )
}

export async function uploadBackendEvidence(caseId: string, file: File): Promise<BackendCaseState> {
    const current = await getBackendCase(caseId)
    const form = new FormData()
    form.set("file", file)
    form.set("expectedRevision", String(current.case.revision))
    form.set("relevantPages", "[]")
    return request(`/cases/${encodeURIComponent(caseId)}/evidence`, { method: "POST", body: form })
}

export async function createBackendPdf(
    caseId: string,
): Promise<{ blob: Blob; filename: string; state: BackendCaseState }> {
    let state = await getBackendCase(caseId)
    const pendingFact = state.facts.some(fact => fact.material && fact.reviewStatus === "PENDING")
    const openQuestion = state.questions.some(
        question => question.priority === "REQUIRED" && question.status === "OPEN",
    )
    if (pendingFact || openQuestion) {
        throw new Error("Review the pending facts and required questions before preparing the PDF.")
    }
    state = await request(
        `/cases/${encodeURIComponent(caseId)}`,
        json("PATCH", {
            expectedRevision: state.case.revision,
            patch: { userReviewed: true },
        }),
    )
    const created = await request<{ record: { id: string; basename: string } }>(
        `/cases/${encodeURIComponent(caseId)}/snapshots`,
        json("POST", {
            expectedRevision: state.case.revision,
        }),
    )
    await request(
        `/cases/${encodeURIComponent(caseId)}/snapshots/${encodeURIComponent(created.record.id)}/pdf`,
        { method: "POST" },
    )
    const response = await fetch(
        `${backendBaseUrl}/cases/${encodeURIComponent(caseId)}/snapshots/${encodeURIComponent(created.record.id)}/pdf`,
    )
    if (!response.ok) throw new Error(`The PDF download failed (${response.status}).`)
    return {
        blob: await response.blob(),
        filename: `${created.record.basename}.pdf`,
        state: await getBackendCase(caseId),
    }
}

/** Generate the court-day cue card and the combined evidence PDF stack. */
export async function generateCasePrep(caseId: string): Promise<CasePrepBundle> {
    return request(`/cases/${encodeURIComponent(caseId)}/case-prep`, { method: "POST" })
}

/** Return the latest generated case-prep artifacts, if the backend has one. */
export async function getCasePrep(caseId: string): Promise<CasePrepBundle> {
    return request(`/cases/${encodeURIComponent(caseId)}/case-prep`)
}

export async function getCasePrepCueCard(caseId: string): Promise<Blob> {
    return requestBlob(`/cases/${encodeURIComponent(caseId)}/case-prep/cue-card`)
}

export async function getCasePrepStack(caseId: string): Promise<Blob> {
    return requestBlob(`/cases/${encodeURIComponent(caseId)}/case-prep/stack`)
}

export async function downloadCasePrepCueCard(caseId: string, filename: string): Promise<void> {
    await downloadBlob(await getCasePrepCueCard(caseId), filename)
}

export async function downloadCasePrepStack(caseId: string, filename: string): Promise<void> {
    await downloadBlob(await getCasePrepStack(caseId), filename)
}

export async function getBackendSnapshotPdf(caseId: string, snapshotId: string): Promise<Blob> {
    return requestBlob(
        `/cases/${encodeURIComponent(caseId)}/snapshots/${encodeURIComponent(snapshotId)}/pdf`,
    )
}

export async function getBackendEvidenceContent(
    caseId: string,
    evidenceId: string,
): Promise<Blob> {
    return requestBlob(
        `/cases/${encodeURIComponent(caseId)}/evidence/${encodeURIComponent(evidenceId)}/content`,
    )
}

export async function downloadBackendSnapshotPdf(
    caseId: string,
    snapshotId: string,
    filename: string,
): Promise<void> {
    await downloadBlob(await getBackendSnapshotPdf(caseId, snapshotId), filename)
}

export async function downloadBackendEvidenceContent(
    caseId: string,
    evidenceId: string,
    filename: string,
): Promise<void> {
    await downloadBlob(await getBackendEvidenceContent(caseId, evidenceId), filename)
}

export async function downloadCasePrepArtifact(
    artifact: CasePrepArtifact,
): Promise<void> {
    await downloadBlob(await requestBlob(artifact.url), artifact.filename)
}

export async function downloadCasePrepPrefiling(
    prefiling: NonNullable<CasePrepBundle["prefiling"]>,
): Promise<void> {
    await downloadBlob(await requestBlob(prefiling.url), prefiling.filename)
}

export async function downloadCasePrepEvidence(
    evidence: CasePrepBundle["evidence"][number],
): Promise<void> {
    await downloadBlob(await requestBlob(evidence.url), evidence.originalFilename)
}

export async function deleteBackendCase(caseId: string): Promise<void> {
    let state: BackendCaseState
    try {
        state = await getBackendCase(caseId)
    } catch (error) {
        if (error instanceof BackendError && error.status === 404) return
        throw error
    }
    await request(`/cases/${encodeURIComponent(caseId)}?expectedRevision=${state.case.revision}`, {
        method: "DELETE",
    })
}

export async function downloadBackendFile(
    source: NonNullable<import("./types").CaseFile["backendSource"]>,
    filename: string,
): Promise<void> {
    const path =
        source.type === "evidence"
            ? `/cases/${encodeURIComponent(source.caseId)}/evidence/${encodeURIComponent(source.recordId)}/content`
            : `/cases/${encodeURIComponent(source.caseId)}/snapshots/${encodeURIComponent(source.recordId)}/pdf`
    await downloadBlob(await requestBlob(path), filename)
}
