import { createHash } from "node:crypto"
import { mkdirSync } from "node:fs"
import { dirname } from "node:path"
import { DatabaseSync, type SQLInputValue } from "node:sqlite"
import { nanoid } from "nanoid"
import {
    CaseRecordSchema,
    ContradictionRecordSchema,
    EligibilityCheckRecordSchema,
    EvidenceRecordSchema,
    FactRecordSchema,
    PartyRecordSchema,
    QuestionRecordSchema,
    RemedyRecordSchema,
    SnapshotRecordSchema,
    WarningRecordSchema,
    type CaseRecord,
    type ContradictionRecord,
    type CreateCaseInput,
    type EligibilityCheckRecord,
    type EvidenceRecord,
    type ExtractionOutput,
    type FactRecord,
    type PartyRecord,
    type ProposeFactInput,
    type QuestionRecord,
    type RemedyRecord,
    type ReviewFactInput,
    type SnapshotRecord,
    type UpdateCaseInput,
    type UpsertPartyInput,
    type UpsertRemedyInput,
    type WarningRecord,
} from "../domain/schemas.js"
import { IdempotencyConflictError, NotFoundError, RevisionConflictError } from "../errors.js"
import { migrate } from "./migrations.js"
import { MutationCoordinator } from "./mutation-coordinator.js"
import * as v from "valibot"

type Row = Record<string, unknown>

export interface ExtractionRunRecord {
    id: string
    caseId: string
    evidenceId: string
    model: string
    summary: string
    documentTitle: string | null
    pagesInspected: number[]
    unreadablePages: number[]
    possibleSensitiveContent: string[]
    promptLikeInstructionsObserved: string[]
    inspectionComplete: boolean
    createdAt: string
}

export interface EvidenceExtractionRecord {
    id: string
    caseId: string
    evidenceId: string
    type: string
    value: string
    page: number | null
    quote: string | null
    location: string | null
    confidence: number | null
    model: string
    extractionRunId: string
    createdAt: string
}

export interface FactEvidenceLinkRecord {
    id: string
    caseId: string
    factId: string
    evidenceId: string
    extractionId: string | null
    relationship: "SUPPORTS" | "CONTRADICTS" | "CONTEXT" | "UNCLEAR"
    reviewStatus: "AGENT_PROPOSED" | "USER_CONFIRMED" | "REJECTED"
    createdAt: string
    updatedAt: string
}

export interface ProceduralRequirementRecord {
    id: string
    caseId: string
    code: string
    status: string
    description: string
    sourceUrl: string | null
    sourceVersion: string | null
    retrievalStatus: string
    checkedAt: string
}

export interface CaseState {
    case: CaseRecord
    parties: PartyRecord[]
    facts: FactRecord[]
    evidence: EvidenceRecord[]
    extractionRuns: ExtractionRunRecord[]
    extractions: EvidenceExtractionRecord[]
    factEvidenceLinks: FactEvidenceLinkRecord[]
    questions: QuestionRecord[]
    contradictions: ContradictionRecord[]
    eligibilityChecks: EligibilityCheckRecord[]
    remedies: RemedyRecord[]
    proceduralRequirements: ProceduralRequirementRecord[]
    warnings: WarningRecord[]
    snapshots: SnapshotRecord[]
}

export interface WarningInput {
    code: string
    message: string
    prominent: boolean
    fingerprint: string
}

export interface EligibilityCheckInput {
    code: string
    result: "PASS" | "FAIL" | "UNVERIFIED" | "NOT_APPLICABLE"
    explanation: string
    inputs: Record<string, unknown>
    sourceUrl: string | null
    sourceVersion: string | null
    checkedAt: string
    retrievalStatus: "RETRIEVED" | "FAILED" | "NOT_ATTEMPTED" | "HISTORICAL"
}

function now(): string {
    return new Date().toISOString()
}

function id(prefix: string): string {
    return `${prefix}_${nanoid(16)}`
}

function hashJson(value: unknown): string {
    return createHash("sha256").update(JSON.stringify(value)).digest("hex")
}

function parseJson<T>(value: unknown, fallback: T): T {
    if (typeof value !== "string") return fallback
    try {
        return JSON.parse(value) as T
    } catch {
        return fallback
    }
}

function bool(value: unknown): boolean {
    return value === 1 || value === true
}

function caseFromRow(row: Row): CaseRecord {
    return v.parse(CaseRecordSchema, {
        id: row.id,
        title: row.title,
        displayName: row.display_name,
        stage: row.stage,
        revision: row.revision,
        category: row.category,
        categoryConfidence: row.category_confidence,
        categoryUserConfirmed: bool(row.category_user_confirmed),
        modelData: parseJson<Record<string, unknown> | null>(row.model_data_json, null),
        subtype: row.subtype,
        factualSummary: row.factual_summary,
        causeOfActionDate: row.cause_of_action_date,
        causeOfActionDateOriginal: row.cause_of_action_date_original,
        causeOfActionDatePrecision: row.cause_of_action_date_precision,
        claimAmountCents: row.claim_amount_cents,
        consentStatus: row.consent_status,
        respondentLocationStatus: row.respondent_location_status,
        officialAssessmentCompleted: bool(row.official_assessment_completed),
        officialAssessmentReference: row.official_assessment_reference,
        eligibilityStatus: row.eligibility_status,
        preparationStatus: row.preparation_status,
        userReviewed: bool(row.user_reviewed),
        canProceed: bool(row.can_proceed),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    })
}

function partyFromRow(row: Row): PartyRecord {
    return v.parse(PartyRecordSchema, {
        id: row.id,
        caseId: row.case_id,
        role: row.role,
        kind: row.kind,
        name: row.name,
        identificationType: row.identification_type,
        identificationNumber: row.identification_number,
        phone: row.phone,
        email: row.email,
        address: row.address,
        country: row.country,
        isPrimary: bool(row.is_primary),
        revision: row.revision,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    })
}

function factFromRow(row: Row): FactRecord {
    return v.parse(FactRecordSchema, {
        id: row.id,
        caseId: row.case_id,
        statement: row.statement,
        structuredValue: parseJson<Record<string, unknown> | null>(row.structured_value_json, null),
        sourceType: row.source_type,
        sourceMessageId: row.source_message_id,
        reviewStatus: row.review_status,
        evidenceAssessment: row.evidence_assessment,
        material: bool(row.material),
        revision: row.revision,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    })
}

function evidenceFromRow(row: Row): EvidenceRecord {
    return v.parse(EvidenceRecordSchema, {
        id: row.id,
        caseId: row.case_id,
        originalFilename: row.original_filename,
        mimeType: row.mime_type,
        storageKey: row.storage_key,
        sha256: row.sha256,
        sizeBytes: row.size_bytes,
        documentType: row.document_type,
        description: row.description,
        relevantPages: parseJson<number[]>(row.relevant_pages_json, []),
        pageCount: row.page_count,
        processingStatus: row.processing_status,
        processingError: row.processing_error,
        uploadedAt: row.uploaded_at,
        updatedAt: row.updated_at,
    })
}

function questionFromRow(row: Row): QuestionRecord {
    return v.parse(QuestionRecordSchema, {
        id: row.id,
        caseId: row.case_id,
        question: row.question,
        reason: row.reason,
        relatedFactIds: parseJson<string[]>(row.related_fact_ids_json, []),
        priority: row.priority,
        status: row.status,
        answer: row.answer,
        suggestedAnswer: row.suggested_answer,
        revision: row.revision,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    })
}

function contradictionFromRow(row: Row): ContradictionRecord {
    return v.parse(ContradictionRecordSchema, {
        id: row.id,
        caseId: row.case_id,
        description: row.description,
        factIds: parseJson<string[]>(row.fact_ids_json, []),
        evidenceIds: parseJson<string[]>(row.evidence_ids_json, []),
        severity: row.severity,
        status: row.status,
        revision: row.revision,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    })
}

function eligibilityFromRow(row: Row): EligibilityCheckRecord {
    return v.parse(EligibilityCheckRecordSchema, {
        id: row.id,
        caseId: row.case_id,
        code: row.code,
        result: row.result,
        explanation: row.explanation,
        inputs: parseJson<Record<string, unknown>>(row.inputs_json, {}),
        sourceUrl: row.source_url,
        sourceVersion: row.source_version,
        checkedAt: row.checked_at,
        retrievalStatus: row.retrieval_status,
    })
}

function remedyFromRow(row: Row): RemedyRecord {
    return v.parse(RemedyRecordSchema, {
        id: row.id,
        caseId: row.case_id,
        type: row.type,
        description: row.description,
        amountCents: row.amount_cents,
        basis: row.basis,
        revision: row.revision,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    })
}

function warningFromRow(row: Row): WarningRecord {
    return v.parse(WarningRecordSchema, {
        id: row.id,
        caseId: row.case_id,
        code: row.code,
        message: row.message,
        prominent: bool(row.prominent),
        status: row.status,
        fingerprint: row.fingerprint,
        createdRevision: row.created_revision,
        acknowledgedRevision: row.acknowledged_revision,
        acknowledgedAt: row.acknowledged_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    })
}

function snapshotFromRow(row: Row): SnapshotRecord {
    return v.parse(SnapshotRecordSchema, {
        id: row.id,
        caseId: row.case_id,
        caseRevision: row.case_revision,
        displayName: row.display_name,
        basename: row.basename,
        jsonPath: row.json_path,
        jsonSha256: row.json_sha256,
        pdfPath: row.pdf_path,
        pdfSha256: row.pdf_sha256,
        supersedesSnapshotId: row.supersedes_snapshot_id,
        supersededBySnapshotId: row.superseded_by_snapshot_id,
        createdAt: row.created_at,
    })
}

export class CaseStore {
    readonly database: DatabaseSync
    readonly mutations = new MutationCoordinator()

    constructor(path: string) {
        mkdirSync(dirname(path), { recursive: true })
        this.database = new DatabaseSync(path)
        migrate(this.database)
    }

    close(): void {
        this.database.close()
    }

    transaction<T>(operation: () => T): T {
        this.database.exec("BEGIN IMMEDIATE")
        try {
            const result = operation()
            this.database.exec("COMMIT")
            return result
        } catch (error) {
            this.database.exec("ROLLBACK")
            throw error
        }
    }

    createCase(input: CreateCaseInput): CaseRecord {
        const requestHash = hashJson({ ...input, idempotencyKey: undefined })
        if (input.idempotencyKey) {
            const existing = this.database
                .prepare(
                    "SELECT request_hash, response_json FROM idempotency_records WHERE scope = ? AND idempotency_key = ?",
                )
                .get("create-case", input.idempotencyKey) as Row | undefined
            if (existing) {
                if (existing.request_hash !== requestHash)
                    throw new IdempotencyConflictError("create-case")
                return v.parse(CaseRecordSchema, parseJson(existing.response_json, {}))
            }
        }

        const timestamp = now()
        const caseId = id("case")
        const title = input.title?.trim() || null
        const claimantName = input.claimantName?.trim() || null
        const displayName = title || claimantName || "Untitled case"

        return this.transaction(() => {
            this.database
                .prepare(
                    `
        INSERT INTO cases (
          id, title, display_name, stage, category, category_user_confirmed, created_at, updated_at
        ) VALUES (?, ?, ?, 'INTAKE', ?, ?, ?, ?)
      `,
                )
                .run(
                    caseId,
                    title,
                    displayName,
                    input.category,
                    Number(input.category !== null),
                    timestamp,
                    timestamp,
                )

            if (claimantName) {
                this.database
                    .prepare(
                        `
          INSERT INTO parties (
            id, case_id, role, kind, name, is_primary, created_at, updated_at
          ) VALUES (?, ?, 'CLAIMANT', 'INDIVIDUAL', ?, 1, ?, ?)
        `,
                    )
                    .run(id("party"), caseId, claimantName, timestamp, timestamp)
            }

            this.audit(
                caseId,
                "CASE_CREATED",
                "USER",
                { title, claimantName, category: input.category },
                1,
            )
            const created = this.getCase(caseId)
            if (input.idempotencyKey) {
                this.database
                    .prepare(
                        `
          INSERT INTO idempotency_records(scope, idempotency_key, request_hash, response_json, created_at)
          VALUES (?, ?, ?, ?, ?)
        `,
                    )
                    .run(
                        "create-case",
                        input.idempotencyKey,
                        requestHash,
                        JSON.stringify(created),
                        timestamp,
                    )
            }
            return created
        })
    }

    listCases(): CaseRecord[] {
        return (
            this.database.prepare("SELECT * FROM cases ORDER BY updated_at DESC").all() as Row[]
        ).map(caseFromRow)
    }

    getCase(caseId: string): CaseRecord {
        const row = this.database.prepare("SELECT * FROM cases WHERE id = ?").get(caseId) as
            Row | undefined
        if (!row) throw new NotFoundError("Case", caseId)
        return caseFromRow(row)
    }

    private assertRevision(caseId: string, expectedRevision: number): CaseRecord {
        const record = this.getCase(caseId)
        if (record.revision !== expectedRevision) {
            throw new RevisionConflictError(caseId, expectedRevision, record.revision)
        }
        return record
    }

    private bumpCaseRevision(
        caseId: string,
        expectedRevision: number,
        resetUserReview = true,
    ): number {
        const timestamp = now()
        const result = this.database
            .prepare(
                `
      UPDATE cases SET revision = revision + 1, updated_at = ?,
        user_reviewed = CASE WHEN ? = 1 THEN 0 ELSE user_reviewed END
      WHERE id = ? AND revision = ?
    `,
            )
            .run(timestamp, Number(resetUserReview), caseId, expectedRevision)
        if (result.changes !== 1) {
            const actual = this.getCase(caseId).revision
            throw new RevisionConflictError(caseId, expectedRevision, actual)
        }
        return expectedRevision + 1
    }

    updateCase(
        caseId: string,
        input: UpdateCaseInput,
        actor: "USER" | "AGENT" = "USER",
    ): CaseRecord {
        return this.transaction(() => {
            this.assertRevision(caseId, input.expectedRevision)
            const mapping: Record<string, string> = {
                title: "title",
                stage: "stage",
                category: "category",
                categoryConfidence: "category_confidence",
                categoryUserConfirmed: "category_user_confirmed",
                modelData: "model_data_json",
                subtype: "subtype",
                factualSummary: "factual_summary",
                causeOfActionDate: "cause_of_action_date",
                causeOfActionDateOriginal: "cause_of_action_date_original",
                causeOfActionDatePrecision: "cause_of_action_date_precision",
                claimAmountCents: "claim_amount_cents",
                consentStatus: "consent_status",
                respondentLocationStatus: "respondent_location_status",
                officialAssessmentCompleted: "official_assessment_completed",
                officialAssessmentReference: "official_assessment_reference",
                userReviewed: "user_reviewed",
            }
            const assignments: string[] = []
            const values: SQLInputValue[] = []
            for (const [key, value] of Object.entries(input.patch)) {
                if (value === undefined) continue
                assignments.push(`${mapping[key]} = ?`)
                if (typeof value === "boolean") values.push(Number(value))
                else if (key === "modelData" && value !== null) values.push(JSON.stringify(value))
                else if (value === null || typeof value === "string" || typeof value === "number")
                    values.push(value)
                else throw new Error(`Unsupported case patch field: ${key}`)
            }
            const materialFields = Object.keys(input.patch).filter(
                field => !["title", "stage", "userReviewed"].includes(field),
            )
            const nextRevision = this.bumpCaseRevision(
                caseId,
                input.expectedRevision,
                materialFields.length > 0,
            )
            if (assignments.length > 0) {
                values.push(now(), caseId)
                this.database
                    .prepare(
                        `UPDATE cases SET ${assignments.join(", ")}, updated_at = ? WHERE id = ?`,
                    )
                    .run(...values)
            }
            if (input.patch.title !== undefined) {
                const claimant = this.database
                    .prepare(
                        "SELECT name FROM parties WHERE case_id = ? AND role = 'CLAIMANT' AND is_primary = 1 ORDER BY created_at LIMIT 1",
                    )
                    .get(caseId) as Row | undefined
                const displayName =
                    input.patch.title?.trim() ||
                    (claimant?.name as string | undefined) ||
                    "Untitled case"
                this.database
                    .prepare("UPDATE cases SET display_name = ? WHERE id = ?")
                    .run(displayName, caseId)
            }
            this.audit(
                caseId,
                "CASE_UPDATED",
                actor,
                { changedFields: Object.keys(input.patch) },
                nextRevision,
            )
            return this.getCase(caseId)
        })
    }

    upsertParty(
        caseId: string,
        input: UpsertPartyInput,
        actor: "USER" | "AGENT" = "USER",
    ): PartyRecord {
        return this.transaction(() => {
            this.assertRevision(caseId, input.expectedRevision)
            const timestamp = now()
            const partyId = input.partyId ?? id("party")
            const existing = input.partyId
                ? (this.database
                      .prepare("SELECT * FROM parties WHERE id = ? AND case_id = ?")
                      .get(input.partyId, caseId) as Row | undefined)
                : undefined
            if (input.partyId && !existing) throw new NotFoundError("Party", input.partyId)

            if (existing) {
                this.database
                    .prepare(
                        `
          UPDATE parties SET role = ?, kind = ?, name = ?, identification_type = ?,
            identification_number = ?, phone = ?, email = ?, address = ?, country = ?,
            is_primary = ?, revision = revision + 1, updated_at = ?
          WHERE id = ? AND case_id = ?
        `,
                    )
                    .run(
                        input.role,
                        input.kind,
                        input.name,
                        input.identificationType,
                        input.identificationNumber,
                        input.phone,
                        input.email,
                        input.address,
                        input.country,
                        Number(input.isPrimary),
                        timestamp,
                        partyId,
                        caseId,
                    )
            } else {
                this.database
                    .prepare(
                        `
          INSERT INTO parties (
            id, case_id, role, kind, name, identification_type, identification_number,
            phone, email, address, country, is_primary, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
                    )
                    .run(
                        partyId,
                        caseId,
                        input.role,
                        input.kind,
                        input.name,
                        input.identificationType,
                        input.identificationNumber,
                        input.phone,
                        input.email,
                        input.address,
                        input.country,
                        Number(input.isPrimary),
                        timestamp,
                        timestamp,
                    )
            }
            const revision = this.bumpCaseRevision(caseId, input.expectedRevision)
            this.audit(
                caseId,
                existing ? "PARTY_UPDATED" : "PARTY_CREATED",
                actor,
                { partyId, role: input.role },
                revision,
            )
            return partyFromRow(
                this.database.prepare("SELECT * FROM parties WHERE id = ?").get(partyId) as Row,
            )
        })
    }

    proposeFact(
        caseId: string,
        input: ProposeFactInput,
        actor: "USER" | "AGENT" = "AGENT",
    ): FactRecord {
        return this.transaction(() => {
            this.assertRevision(caseId, input.expectedRevision)
            const timestamp = now()
            const factId = id("fact")
            this.database
                .prepare(
                    `
        INSERT INTO facts (
          id, case_id, statement, structured_value_json, source_type, source_message_id,
          review_status, evidence_assessment, material, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'PENDING', 'UNASSESSED', ?, ?, ?)
      `,
                )
                .run(
                    factId,
                    caseId,
                    input.statement,
                    input.structuredValue === null ? null : JSON.stringify(input.structuredValue),
                    input.sourceType,
                    input.sourceMessageId,
                    Number(input.material),
                    timestamp,
                    timestamp,
                )
            const revision = this.bumpCaseRevision(caseId, input.expectedRevision)
            this.audit(
                caseId,
                "FACT_PROPOSED",
                actor,
                { factId, sourceType: input.sourceType },
                revision,
            )
            return factFromRow(
                this.database.prepare("SELECT * FROM facts WHERE id = ?").get(factId) as Row,
            )
        })
    }

    reviewFact(caseId: string, factId: string, input: ReviewFactInput): FactRecord {
        return this.transaction(() => {
            this.assertRevision(caseId, input.expectedRevision)
            const row = this.database
                .prepare("SELECT * FROM facts WHERE id = ? AND case_id = ?")
                .get(factId, caseId) as Row | undefined
            if (!row) throw new NotFoundError("Fact", factId)
            const timestamp = now()
            const reviewStatus =
                input.action === "CONFIRM"
                    ? "CONFIRMED"
                    : input.action === "REJECT"
                      ? "REJECTED"
                      : input.action === "MARK_UNCERTAIN"
                        ? "UNCERTAIN"
                        : "CONFIRMED"
            const statement = input.action === "EDIT" ? input.statement : row.statement
            const structured =
                input.action === "EDIT"
                    ? input.structuredValue === null
                        ? null
                        : JSON.stringify(input.structuredValue)
                    : row.structured_value_json
            this.database
                .prepare(
                    `
        UPDATE facts SET statement = ?, structured_value_json = ?, review_status = ?,
          revision = revision + 1, updated_at = ? WHERE id = ?
      `,
                )
                .run(
                    statement as SQLInputValue,
                    structured as SQLInputValue,
                    reviewStatus,
                    timestamp,
                    factId,
                )
            const revision = this.bumpCaseRevision(caseId, input.expectedRevision)
            this.audit(caseId, `FACT_${input.action}`, "USER", { factId }, revision)
            return factFromRow(
                this.database.prepare("SELECT * FROM facts WHERE id = ?").get(factId) as Row,
            )
        })
    }

    upsertRemedy(
        caseId: string,
        input: UpsertRemedyInput,
        actor: "USER" | "AGENT" = "USER",
    ): RemedyRecord {
        return this.transaction(() => {
            this.assertRevision(caseId, input.expectedRevision)
            const timestamp = now()
            const remedyId = input.remedyId ?? id("remedy")
            const existing = input.remedyId
                ? (this.database
                      .prepare("SELECT * FROM remedies WHERE id = ? AND case_id = ?")
                      .get(input.remedyId, caseId) as Row | undefined)
                : undefined
            if (input.remedyId && !existing) throw new NotFoundError("Remedy", input.remedyId)
            if (existing) {
                this.database
                    .prepare(
                        `
          UPDATE remedies SET type = ?, description = ?, amount_cents = ?, basis = ?,
            revision = revision + 1, updated_at = ? WHERE id = ?
        `,
                    )
                    .run(
                        input.type,
                        input.description,
                        input.amountCents,
                        input.basis,
                        timestamp,
                        remedyId,
                    )
            } else {
                this.database
                    .prepare(
                        `
          INSERT INTO remedies(id, case_id, type, description, amount_cents, basis, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
                    )
                    .run(
                        remedyId,
                        caseId,
                        input.type,
                        input.description,
                        input.amountCents,
                        input.basis,
                        timestamp,
                        timestamp,
                    )
            }
            const revision = this.bumpCaseRevision(caseId, input.expectedRevision)
            this.audit(
                caseId,
                existing ? "REMEDY_UPDATED" : "REMEDY_CREATED",
                actor,
                { remedyId },
                revision,
            )
            return remedyFromRow(
                this.database.prepare("SELECT * FROM remedies WHERE id = ?").get(remedyId) as Row,
            )
        })
    }

    addEvidenceMetadata(
        caseId: string,
        input: {
            expectedRevision: number
            originalFilename: string
            mimeType: string
            storageKey: string
            sha256: string
            sizeBytes: number
            documentType: string | null
            description: string | null
            relevantPages: number[]
            pageCount: number | null
        },
    ): EvidenceRecord {
        return this.transaction(() => {
            this.assertRevision(caseId, input.expectedRevision)
            const timestamp = now()
            const evidenceId = id("evidence")
            this.database
                .prepare(
                    `
        INSERT INTO evidence_documents (
          id, case_id, original_filename, mime_type, storage_key, sha256, size_bytes,
          document_type, description, relevant_pages_json, page_count, uploaded_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
                )
                .run(
                    evidenceId,
                    caseId,
                    input.originalFilename,
                    input.mimeType,
                    input.storageKey,
                    input.sha256,
                    input.sizeBytes,
                    input.documentType,
                    input.description,
                    JSON.stringify(input.relevantPages),
                    input.pageCount,
                    timestamp,
                    timestamp,
                )
            const revision = this.bumpCaseRevision(caseId, input.expectedRevision)
            this.audit(
                caseId,
                "EVIDENCE_UPLOADED",
                "USER",
                {
                    evidenceId,
                    filename: input.originalFilename,
                    sha256: input.sha256,
                    sizeBytes: input.sizeBytes,
                },
                revision,
            )
            return evidenceFromRow(
                this.database
                    .prepare("SELECT * FROM evidence_documents WHERE id = ?")
                    .get(evidenceId) as Row,
            )
        })
    }

    getEvidence(caseId: string, evidenceId: string): EvidenceRecord {
        const row = this.database
            .prepare("SELECT * FROM evidence_documents WHERE id = ? AND case_id = ?")
            .get(evidenceId, caseId) as Row | undefined
        if (!row) throw new NotFoundError("Evidence", evidenceId)
        return evidenceFromRow(row)
    }

    markEvidenceProcessing(caseId: string, evidenceId: string): EvidenceRecord {
        this.getCase(caseId)
        this.getEvidence(caseId, evidenceId)
        const timestamp = now()
        this.database
            .prepare(
                `
      UPDATE evidence_documents SET processing_status = 'PROCESSING', processing_error = NULL, updated_at = ?
      WHERE id = ? AND case_id = ?
    `,
            )
            .run(timestamp, evidenceId, caseId)
        this.audit(
            caseId,
            "EVIDENCE_PROCESSING_STARTED",
            "SYSTEM",
            { evidenceId },
            this.getCase(caseId).revision,
        )
        return this.getEvidence(caseId, evidenceId)
    }

    saveExtraction(
        caseId: string,
        evidenceId: string,
        input: {
            expectedRevision: number
            model: string
            output: ExtractionOutput
            rawResponseHash: string
        },
    ): ExtractionRunRecord {
        return this.transaction(() => {
            this.assertRevision(caseId, input.expectedRevision)
            this.getEvidence(caseId, evidenceId)
            const timestamp = now()
            const runId = id("extract")
            this.database
                .prepare(
                    `
        INSERT INTO extraction_runs (
          id, case_id, evidence_id, model, summary, document_title, pages_inspected_json,
          unreadable_pages_json, possible_sensitive_content_json, prompt_like_instructions_json,
          inspection_complete, raw_response_hash, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
                )
                .run(
                    runId,
                    caseId,
                    evidenceId,
                    input.model,
                    input.output.summary,
                    input.output.documentTitle,
                    JSON.stringify(input.output.pagesInspected),
                    JSON.stringify(input.output.unreadablePages),
                    JSON.stringify(input.output.possibleSensitiveContent),
                    JSON.stringify(input.output.promptLikeInstructionsObserved),
                    Number(input.output.inspectionComplete),
                    input.rawResponseHash,
                    timestamp,
                )
            const insertItem = this.database.prepare(`
        INSERT INTO evidence_extractions (
          id, case_id, evidence_id, extraction_type, value, page, quote, location,
          confidence, model, extraction_run_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
            for (const item of input.output.items) {
                insertItem.run(
                    id("item"),
                    caseId,
                    evidenceId,
                    item.type,
                    item.value,
                    item.page ?? null,
                    item.quote ?? null,
                    item.location ?? null,
                    item.confidence ?? null,
                    input.model,
                    runId,
                    timestamp,
                )
            }
            const status =
                input.output.inspectionComplete && input.output.unreadablePages.length === 0
                    ? "PROCESSED"
                    : "PARTIAL"
            this.database
                .prepare(
                    `
        UPDATE evidence_documents SET processing_status = ?, processing_error = NULL, updated_at = ?
        WHERE id = ? AND case_id = ?
      `,
                )
                .run(status, timestamp, evidenceId, caseId)
            const revision = this.bumpCaseRevision(caseId, input.expectedRevision)
            this.audit(
                caseId,
                "EVIDENCE_EXTRACTION_SAVED",
                "AGENT",
                {
                    evidenceId,
                    runId,
                    model: input.model,
                    itemCount: input.output.items.length,
                    inspectionComplete: input.output.inspectionComplete,
                },
                revision,
            )
            return this.getExtractionRun(runId)
        })
    }

    failEvidenceProcessing(
        caseId: string,
        evidenceId: string,
        input: {
            expectedRevision: number
            error: string
        },
    ): EvidenceRecord {
        return this.transaction(() => {
            this.assertRevision(caseId, input.expectedRevision)
            this.getEvidence(caseId, evidenceId)
            const timestamp = now()
            this.database
                .prepare(
                    `
        UPDATE evidence_documents SET processing_status = 'FAILED', processing_error = ?, updated_at = ?
        WHERE id = ? AND case_id = ?
      `,
                )
                .run(input.error.slice(0, 2_000), timestamp, evidenceId, caseId)
            const revision = this.bumpCaseRevision(caseId, input.expectedRevision)
            this.audit(
                caseId,
                "EVIDENCE_PROCESSING_FAILED",
                "SYSTEM",
                { evidenceId, error: input.error.slice(0, 500) },
                revision,
            )
            return this.getEvidence(caseId, evidenceId)
        })
    }

    getExtractionRun(runId: string): ExtractionRunRecord {
        const row = this.database
            .prepare("SELECT * FROM extraction_runs WHERE id = ?")
            .get(runId) as Row | undefined
        if (!row) throw new NotFoundError("Extraction run", runId)
        return {
            id: String(row.id),
            caseId: String(row.case_id),
            evidenceId: String(row.evidence_id),
            model: String(row.model),
            summary: String(row.summary),
            documentTitle: row.document_title as string | null,
            pagesInspected: parseJson<number[]>(row.pages_inspected_json, []),
            unreadablePages: parseJson<number[]>(row.unreadable_pages_json, []),
            possibleSensitiveContent: parseJson<string[]>(row.possible_sensitive_content_json, []),
            promptLikeInstructionsObserved: parseJson<string[]>(
                row.prompt_like_instructions_json,
                [],
            ),
            inspectionComplete: bool(row.inspection_complete),
            createdAt: String(row.created_at),
        }
    }

    linkFactToEvidence(
        caseId: string,
        input: {
            expectedRevision: number
            factId: string
            evidenceId: string
            extractionId?: string
            relationship: FactEvidenceLinkRecord["relationship"]
        },
    ): FactEvidenceLinkRecord {
        return this.transaction(() => {
            this.assertRevision(caseId, input.expectedRevision)
            const fact = this.database
                .prepare("SELECT id FROM facts WHERE id = ? AND case_id = ?")
                .get(input.factId, caseId)
            if (!fact) throw new NotFoundError("Fact", input.factId)
            this.getEvidence(caseId, input.evidenceId)
            if (input.extractionId) {
                const extraction = this.database
                    .prepare(
                        `
          SELECT id FROM evidence_extractions WHERE id = ? AND evidence_id = ? AND case_id = ?
        `,
                    )
                    .get(input.extractionId, input.evidenceId, caseId)
                if (!extraction) throw new NotFoundError("Evidence extraction", input.extractionId)
            }
            const timestamp = now()
            const linkId = id("link")
            this.database
                .prepare(
                    `
        INSERT INTO fact_evidence_links (
          id, case_id, fact_id, evidence_id, extraction_id, relationship, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
                )
                .run(
                    linkId,
                    caseId,
                    input.factId,
                    input.evidenceId,
                    input.extractionId ?? null,
                    input.relationship,
                    timestamp,
                    timestamp,
                )
            const assessment =
                input.relationship === "SUPPORTS"
                    ? "SUPPORTED"
                    : input.relationship === "CONTRADICTS"
                      ? "CONTRADICTED"
                      : "AMBIGUOUS"
            this.database
                .prepare(
                    `
        UPDATE facts SET evidence_assessment = ?, revision = revision + 1, updated_at = ? WHERE id = ?
      `,
                )
                .run(assessment, timestamp, input.factId)
            const revision = this.bumpCaseRevision(caseId, input.expectedRevision)
            this.audit(caseId, "FACT_EVIDENCE_LINKED", "AGENT", { linkId, ...input }, revision)
            return this.factEvidenceLinkFromRow(
                this.database
                    .prepare("SELECT * FROM fact_evidence_links WHERE id = ?")
                    .get(linkId) as Row,
            )
        })
    }

    addQuestion(
        caseId: string,
        input: {
            expectedRevision: number
            question: string
            reason: string
            relatedFactIds: string[]
            priority: "REQUIRED" | "IMPORTANT" | "OPTIONAL"
            suggestedAnswer?: string | null
        },
    ): QuestionRecord {
        return this.transaction(() => {
            this.assertRevision(caseId, input.expectedRevision)
            const timestamp = now()
            const questionId = id("question")
            this.database
                .prepare(
                    `
        INSERT INTO questions (
          id, case_id, question, reason, related_fact_ids_json, priority, suggested_answer, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
                )
                .run(
                    questionId,
                    caseId,
                    input.question,
                    input.reason,
                    JSON.stringify(input.relatedFactIds),
                    input.priority,
                    input.suggestedAnswer ?? null,
                    timestamp,
                    timestamp,
                )
            const revision = this.bumpCaseRevision(caseId, input.expectedRevision)
            this.audit(
                caseId,
                "QUESTION_ADDED",
                "AGENT",
                { questionId, priority: input.priority },
                revision,
            )
            return questionFromRow(
                this.database
                    .prepare("SELECT * FROM questions WHERE id = ?")
                    .get(questionId) as Row,
            )
        })
    }

    resolveQuestion(
        caseId: string,
        questionId: string,
        input: {
            expectedRevision: number
            status: "ANSWERED" | "UNRESOLVED"
            answer: string | null
        },
    ): QuestionRecord {
        return this.transaction(() => {
            this.assertRevision(caseId, input.expectedRevision)
            const existing = this.database
                .prepare("SELECT id FROM questions WHERE id = ? AND case_id = ?")
                .get(questionId, caseId)
            if (!existing) throw new NotFoundError("Question", questionId)
            const timestamp = now()
            this.database
                .prepare(
                    `
        UPDATE questions SET status = ?, answer = ?, revision = revision + 1, updated_at = ? WHERE id = ?
      `,
                )
                .run(input.status, input.answer, timestamp, questionId)
            const revision = this.bumpCaseRevision(caseId, input.expectedRevision)
            this.audit(
                caseId,
                "QUESTION_RESOLVED",
                "USER",
                { questionId, status: input.status },
                revision,
            )
            return questionFromRow(
                this.database
                    .prepare("SELECT * FROM questions WHERE id = ?")
                    .get(questionId) as Row,
            )
        })
    }

    addContradiction(
        caseId: string,
        input: {
            expectedRevision: number
            description: string
            factIds: string[]
            evidenceIds: string[]
            severity: "LOW" | "MEDIUM" | "HIGH"
        },
    ): ContradictionRecord {
        return this.transaction(() => {
            this.assertRevision(caseId, input.expectedRevision)
            const timestamp = now()
            const contradictionId = id("conflict")
            this.database
                .prepare(
                    `
        INSERT INTO contradictions (
          id, case_id, description, fact_ids_json, evidence_ids_json, severity, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
                )
                .run(
                    contradictionId,
                    caseId,
                    input.description,
                    JSON.stringify(input.factIds),
                    JSON.stringify(input.evidenceIds),
                    input.severity,
                    timestamp,
                    timestamp,
                )
            const revision = this.bumpCaseRevision(caseId, input.expectedRevision)
            this.audit(
                caseId,
                "CONTRADICTION_ADDED",
                "AGENT",
                { contradictionId, severity: input.severity },
                revision,
            )
            return contradictionFromRow(
                this.database
                    .prepare("SELECT * FROM contradictions WHERE id = ?")
                    .get(contradictionId) as Row,
            )
        })
    }

    resolveContradiction(
        caseId: string,
        contradictionId: string,
        input: {
            expectedRevision: number
            status: "RESOLVED" | "ACCEPTED_UNCERTAINTY"
        },
    ): ContradictionRecord {
        return this.transaction(() => {
            this.assertRevision(caseId, input.expectedRevision)
            const existing = this.database
                .prepare("SELECT id FROM contradictions WHERE id = ? AND case_id = ?")
                .get(contradictionId, caseId)
            if (!existing) throw new NotFoundError("Contradiction", contradictionId)
            const timestamp = now()
            this.database
                .prepare(
                    `
        UPDATE contradictions SET status = ?, revision = revision + 1, updated_at = ? WHERE id = ?
      `,
                )
                .run(input.status, timestamp, contradictionId)
            const revision = this.bumpCaseRevision(caseId, input.expectedRevision)
            this.audit(
                caseId,
                "CONTRADICTION_REVIEWED",
                "USER",
                { contradictionId, status: input.status },
                revision,
            )
            return contradictionFromRow(
                this.database
                    .prepare("SELECT * FROM contradictions WHERE id = ?")
                    .get(contradictionId) as Row,
            )
        })
    }

    applyAssessment(
        caseId: string,
        input: {
            assessedRevision: number
            eligibilityStatus: "PASS" | "FAIL" | "UNVERIFIED"
            preparationStatus: CaseRecord["preparationStatus"]
            canProceed: boolean
            checks: EligibilityCheckInput[]
            warnings: WarningInput[]
        },
    ): CaseRecord {
        return this.transaction(() => {
            this.assertRevision(caseId, input.assessedRevision)
            const timestamp = now()
            const activeWarningKeys = new Set(
                input.warnings.map(warning => `${warning.code}:${warning.fingerprint}`),
            )
            const warningRows = this.database
                .prepare(
                    "SELECT id, code, fingerprint FROM warnings WHERE case_id = ? AND status != ?",
                )
                .all(caseId, "STALE") as Row[]
            for (const row of warningRows) {
                if (!activeWarningKeys.has(`${String(row.code)}:${String(row.fingerprint)}`)) {
                    this.database
                        .prepare(
                            "UPDATE warnings SET status = 'STALE', updated_at = ? WHERE id = ?",
                        )
                        .run(timestamp, row.id as SQLInputValue)
                }
            }

            const upsertWarning = this.database.prepare(`
        INSERT INTO warnings (
          id, case_id, code, message, prominent, status, fingerprint,
          created_revision, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 'OPEN', ?, ?, ?, ?)
        ON CONFLICT(case_id, code, fingerprint) DO UPDATE SET
          message = excluded.message,
          prominent = excluded.prominent,
          updated_at = excluded.updated_at
      `)
            for (const warning of input.warnings) {
                upsertWarning.run(
                    id("warning"),
                    caseId,
                    warning.code,
                    warning.message,
                    Number(warning.prominent),
                    warning.fingerprint,
                    input.assessedRevision,
                    timestamp,
                    timestamp,
                )
            }

            const activeCheckCodes = new Set(input.checks.map(check => check.code))
            const checkRows = this.database
                .prepare("SELECT id, code FROM eligibility_checks WHERE case_id = ?")
                .all(caseId) as Row[]
            const deleteCheck = this.database.prepare(
                "DELETE FROM eligibility_checks WHERE id = ? AND case_id = ?",
            )
            for (const row of checkRows) {
                if (!activeCheckCodes.has(String(row.code))) {
                    deleteCheck.run(row.id as SQLInputValue, caseId)
                }
            }

            const upsertCheck = this.database.prepare(`
        INSERT INTO eligibility_checks (
          id, case_id, code, result, explanation, inputs_json, source_url,
          source_version, checked_at, retrieval_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(case_id, code) DO UPDATE SET
          result = excluded.result,
          explanation = excluded.explanation,
          inputs_json = excluded.inputs_json,
          source_url = excluded.source_url,
          source_version = excluded.source_version,
          checked_at = excluded.checked_at,
          retrieval_status = excluded.retrieval_status
      `)
            for (const check of input.checks) {
                upsertCheck.run(
                    id("check"),
                    caseId,
                    check.code,
                    check.result,
                    check.explanation,
                    JSON.stringify(check.inputs),
                    check.sourceUrl,
                    check.sourceVersion,
                    check.checkedAt,
                    check.retrievalStatus,
                )
            }

            this.database
                .prepare(
                    `
        UPDATE cases SET eligibility_status = ?, preparation_status = ?, can_proceed = ?, updated_at = ?
        WHERE id = ? AND revision = ?
      `,
                )
                .run(
                    input.eligibilityStatus,
                    input.preparationStatus,
                    Number(input.canProceed),
                    timestamp,
                    caseId,
                    input.assessedRevision,
                )
            this.audit(
                caseId,
                "ASSESSMENT_REFRESHED",
                "SYSTEM",
                {
                    eligibilityStatus: input.eligibilityStatus,
                    preparationStatus: input.preparationStatus,
                    canProceed: input.canProceed,
                    warningCount: input.warnings.length,
                },
                input.assessedRevision,
            )
            return this.getCase(caseId)
        })
    }

    recordGuidance(
        caseId: string,
        input: {
            expectedRevision: number
            query: string
            checkedAt: string
            sources: Array<{
                url: string
                status: "RETRIEVED" | "FAILED"
                excerpts: string[]
                error?: string
            }>
        },
    ): ProceduralRequirementRecord[] {
        return this.transaction(() => {
            this.assertRevision(caseId, input.expectedRevision)
            const upsert = this.database.prepare(`
        INSERT INTO procedural_requirements (
          id, case_id, code, status, description, source_url, source_version, retrieval_status, checked_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(case_id, code) DO UPDATE SET
          status = excluded.status,
          description = excluded.description,
          source_url = excluded.source_url,
          source_version = excluded.source_version,
          retrieval_status = excluded.retrieval_status,
          checked_at = excluded.checked_at
      `)
            for (const source of input.sources) {
                const code = `GUIDANCE_${hashJson({ query: input.query, url: source.url }).slice(0, 16).toUpperCase()}`
                const description =
                    source.status === "RETRIEVED"
                        ? `Query: ${input.query}\n${source.excerpts.join("\n\n")}`.slice(0, 20_000)
                        : `Query: ${input.query}\nRetrieval failed: ${source.error ?? "Unknown error"}`
                upsert.run(
                    id("requirement"),
                    caseId,
                    code,
                    source.status === "RETRIEVED" ? "CHECKED" : "UNVERIFIED",
                    description,
                    source.url,
                    input.checkedAt.slice(0, 10),
                    source.status,
                    input.checkedAt,
                )
            }
            const revision = this.bumpCaseRevision(caseId, input.expectedRevision)
            this.audit(
                caseId,
                "OFFICIAL_GUIDANCE_RETRIEVED",
                "AGENT",
                {
                    query: input.query,
                    sources: input.sources.map(({ url, status }) => ({ url, status })),
                },
                revision,
            )
            return (
                this.database
                    .prepare(
                        "SELECT * FROM procedural_requirements WHERE case_id = ? ORDER BY code",
                    )
                    .all(caseId) as Row[]
            ).map(row => ({
                id: String(row.id),
                caseId: String(row.case_id),
                code: String(row.code),
                status: String(row.status),
                description: String(row.description),
                sourceUrl: row.source_url as string | null,
                sourceVersion: row.source_version as string | null,
                retrievalStatus: String(row.retrieval_status),
                checkedAt: String(row.checked_at),
            }))
        })
    }

    acknowledgeWarning(
        caseId: string,
        warningId: string,
        input: {
            expectedRevision: number
            fingerprint: string
        },
    ): WarningRecord {
        return this.transaction(() => {
            this.assertRevision(caseId, input.expectedRevision)
            const row = this.database
                .prepare("SELECT * FROM warnings WHERE id = ? AND case_id = ?")
                .get(warningId, caseId) as Row | undefined
            if (!row) throw new NotFoundError("Warning", warningId)
            const warning = warningFromRow(row)
            if (warning.fingerprint !== input.fingerprint || warning.status === "STALE") {
                throw new RevisionConflictError(
                    caseId,
                    input.expectedRevision,
                    this.getCase(caseId).revision,
                )
            }
            if (warning.status === "ACKNOWLEDGED") return warning
            const timestamp = now()
            const revision = this.bumpCaseRevision(caseId, input.expectedRevision, false)
            this.database
                .prepare(
                    `
        UPDATE warnings SET status = 'ACKNOWLEDGED', acknowledged_revision = ?,
          acknowledged_at = ?, updated_at = ? WHERE id = ?
      `,
                )
                .run(revision, timestamp, timestamp, warningId)
            this.audit(
                caseId,
                "WARNING_ACKNOWLEDGED",
                "USER",
                {
                    warningId,
                    code: warning.code,
                    fingerprint: warning.fingerprint,
                    decision: "PROCEED_WITH_WARNING",
                },
                revision,
            )
            return warningFromRow(
                this.database.prepare("SELECT * FROM warnings WHERE id = ?").get(warningId) as Row,
            )
        })
    }

    createSnapshotRecord(input: Omit<SnapshotRecord, "supersededBySnapshotId">): SnapshotRecord {
        return this.transaction(() => {
            this.assertRevision(input.caseId, input.caseRevision)
            if (input.supersedesSnapshotId) {
                const previous = this.database
                    .prepare("SELECT id FROM snapshots WHERE id = ? AND case_id = ?")
                    .get(input.supersedesSnapshotId, input.caseId)
                if (!previous) throw new NotFoundError("Snapshot", input.supersedesSnapshotId)
            }
            this.database
                .prepare(
                    `
        INSERT INTO snapshots (
          id, case_id, case_revision, display_name, basename, json_path, json_sha256,
          pdf_path, pdf_sha256, supersedes_snapshot_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
                )
                .run(
                    input.id,
                    input.caseId,
                    input.caseRevision,
                    input.displayName,
                    input.basename,
                    input.jsonPath,
                    input.jsonSha256,
                    input.pdfPath,
                    input.pdfSha256,
                    input.supersedesSnapshotId,
                    input.createdAt,
                )
            if (input.supersedesSnapshotId) {
                this.database
                    .prepare("UPDATE snapshots SET superseded_by_snapshot_id = ? WHERE id = ?")
                    .run(input.id, input.supersedesSnapshotId)
            }
            this.audit(
                input.caseId,
                "SNAPSHOT_CREATED",
                "USER",
                {
                    snapshotId: input.id,
                    caseRevision: input.caseRevision,
                    supersedesSnapshotId: input.supersedesSnapshotId,
                },
                input.caseRevision,
            )
            return this.getSnapshot(input.caseId, input.id)
        })
    }

    attachSnapshotPdf(
        caseId: string,
        snapshotId: string,
        pdfPath: string,
        pdfSha256: string,
    ): SnapshotRecord {
        return this.transaction(() => {
            const snapshot = this.getSnapshot(caseId, snapshotId)
            if (snapshot.pdfPath) return snapshot
            this.database
                .prepare(
                    "UPDATE snapshots SET pdf_path = ?, pdf_sha256 = ? WHERE id = ? AND case_id = ?",
                )
                .run(pdfPath, pdfSha256, snapshotId, caseId)
            this.audit(
                caseId,
                "SNAPSHOT_PDF_COMPILED",
                "SYSTEM",
                { snapshotId, pdfSha256 },
                snapshot.caseRevision,
            )
            return this.getSnapshot(caseId, snapshotId)
        })
    }

    getSnapshot(caseId: string, snapshotId: string): SnapshotRecord {
        const row = this.database
            .prepare("SELECT * FROM snapshots WHERE id = ? AND case_id = ?")
            .get(snapshotId, caseId) as Row | undefined
        if (!row) throw new NotFoundError("Snapshot", snapshotId)
        return snapshotFromRow(row)
    }

    beginTurn(
        caseId: string,
        input: { idempotencyKey: string; requestHash: string },
    ): {
        id: string
        duplicate: boolean
        submissionId: string | null
        agentUid: string | null
        acceptedAt: string | null
        status: string
    } {
        this.getCase(caseId)
        const existing = this.database
            .prepare(
                `
      SELECT * FROM turn_requests WHERE case_id = ? AND idempotency_key = ?
    `,
            )
            .get(caseId, input.idempotencyKey) as Row | undefined
        if (existing) {
            if (existing.request_hash !== input.requestHash)
                throw new IdempotencyConflictError(`turn:${caseId}`)
            return {
                id: String(existing.id),
                duplicate: true,
                submissionId: existing.submission_id as string | null,
                agentUid: existing.agent_uid as string | null,
                acceptedAt: existing.accepted_at as string | null,
                status: String(existing.status),
            }
        }
        const timestamp = now()
        const turnId = id("turn")
        this.database
            .prepare(
                `
      INSERT INTO turn_requests (
        id, case_id, idempotency_key, request_hash, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, 'ADMITTING', ?, ?)
    `,
            )
            .run(turnId, caseId, input.idempotencyKey, input.requestHash, timestamp, timestamp)
        return {
            id: turnId,
            duplicate: false,
            submissionId: null,
            agentUid: null,
            acceptedAt: null,
            status: "ADMITTING",
        }
    }

    finishTurnAdmission(
        turnId: string,
        receipt: { submissionId: string; uid: string; acceptedAt: string },
    ): void {
        this.database
            .prepare(
                `
      UPDATE turn_requests SET submission_id = ?, agent_uid = ?, accepted_at = ?, status = 'ACCEPTED', updated_at = ?
      WHERE id = ?
    `,
            )
            .run(receipt.submissionId, receipt.uid, receipt.acceptedAt, now(), turnId)
    }

    failTurnAdmission(turnId: string, errorCode: string): void {
        this.database
            .prepare(
                `
      UPDATE turn_requests SET status = 'FAILED', error_code = ?, updated_at = ? WHERE id = ?
    `,
            )
            .run(errorCode, now(), turnId)
    }

    getCaseState(caseId: string): CaseState {
        const record = this.getCase(caseId)
        const all = (sql: string): Row[] => this.database.prepare(sql).all(caseId)
        const extractionRuns = all(
            "SELECT * FROM extraction_runs WHERE case_id = ? ORDER BY created_at",
        ).map(row => ({
            id: String(row.id),
            caseId: String(row.case_id),
            evidenceId: String(row.evidence_id),
            model: String(row.model),
            summary: String(row.summary),
            documentTitle: row.document_title as string | null,
            pagesInspected: parseJson<number[]>(row.pages_inspected_json, []),
            unreadablePages: parseJson<number[]>(row.unreadable_pages_json, []),
            possibleSensitiveContent: parseJson<string[]>(row.possible_sensitive_content_json, []),
            promptLikeInstructionsObserved: parseJson<string[]>(
                row.prompt_like_instructions_json,
                [],
            ),
            inspectionComplete: bool(row.inspection_complete),
            createdAt: String(row.created_at),
        }))
        const extractions = all(
            "SELECT * FROM evidence_extractions WHERE case_id = ? ORDER BY created_at",
        ).map(row => ({
            id: String(row.id),
            caseId: String(row.case_id),
            evidenceId: String(row.evidence_id),
            type: String(row.extraction_type),
            value: String(row.value),
            page: row.page as number | null,
            quote: row.quote as string | null,
            location: row.location as string | null,
            confidence: row.confidence as number | null,
            model: String(row.model),
            extractionRunId: String(row.extraction_run_id),
            createdAt: String(row.created_at),
        }))
        return {
            case: record,
            parties: all(
                "SELECT * FROM parties WHERE case_id = ? ORDER BY role, is_primary DESC, created_at",
            ).map(partyFromRow),
            facts: all("SELECT * FROM facts WHERE case_id = ? ORDER BY created_at").map(
                factFromRow,
            ),
            evidence: all(
                "SELECT * FROM evidence_documents WHERE case_id = ? ORDER BY uploaded_at",
            ).map(evidenceFromRow),
            extractionRuns,
            extractions,
            factEvidenceLinks: all(
                "SELECT * FROM fact_evidence_links WHERE case_id = ? ORDER BY created_at",
            ).map(row => this.factEvidenceLinkFromRow(row)),
            questions: all("SELECT * FROM questions WHERE case_id = ? ORDER BY created_at").map(
                questionFromRow,
            ),
            contradictions: all(
                "SELECT * FROM contradictions WHERE case_id = ? ORDER BY created_at",
            ).map(contradictionFromRow),
            eligibilityChecks: all(
                "SELECT * FROM eligibility_checks WHERE case_id = ? ORDER BY code",
            ).map(eligibilityFromRow),
            remedies: all("SELECT * FROM remedies WHERE case_id = ? ORDER BY created_at").map(
                remedyFromRow,
            ),
            proceduralRequirements: all(
                "SELECT * FROM procedural_requirements WHERE case_id = ? ORDER BY code",
            ).map(row => ({
                id: String(row.id),
                caseId: String(row.case_id),
                code: String(row.code),
                status: String(row.status),
                description: String(row.description),
                sourceUrl: row.source_url as string | null,
                sourceVersion: row.source_version as string | null,
                retrievalStatus: String(row.retrieval_status),
                checkedAt: String(row.checked_at),
            })),
            warnings: all(
                "SELECT * FROM warnings WHERE case_id = ? AND status != 'STALE' ORDER BY prominent DESC, created_at",
            ).map(warningFromRow),
            snapshots: all(
                "SELECT * FROM snapshots WHERE case_id = ? ORDER BY created_at DESC",
            ).map(snapshotFromRow),
        }
    }

    deleteCaseRecords(caseId: string): { evidencePaths: string[]; snapshotPaths: string[] } {
        return this.transaction(() => {
            this.getCase(caseId)
            const evidencePaths = (
                this.database
                    .prepare("SELECT storage_key FROM evidence_documents WHERE case_id = ?")
                    .all(caseId) as Row[]
            ).map(row => String(row.storage_key))
            const snapshotRows = this.database
                .prepare("SELECT json_path, pdf_path FROM snapshots WHERE case_id = ?")
                .all(caseId) as Row[]
            const snapshotPaths = snapshotRows.flatMap(row =>
                [row.json_path, row.pdf_path].filter(
                    (value): value is string => typeof value === "string",
                ),
            )
            this.audit(caseId, "CASE_DELETED", "USER", {}, this.getCase(caseId).revision)
            this.database.prepare("DELETE FROM cases WHERE id = ?").run(caseId)
            return { evidencePaths, snapshotPaths }
        })
    }

    audit(
        caseId: string | null,
        eventType: string,
        actorType: string,
        payload: unknown,
        caseRevision: number | null,
    ): void {
        this.database
            .prepare(
                `
      INSERT INTO audit_events(id, case_id, event_type, actor_type, payload_json, case_revision, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
            )
            .run(
                id("audit"),
                caseId,
                eventType,
                actorType,
                JSON.stringify(payload),
                caseRevision,
                now(),
            )
    }

    private factEvidenceLinkFromRow(row: Row): FactEvidenceLinkRecord {
        return {
            id: String(row.id),
            caseId: String(row.case_id),
            factId: String(row.fact_id),
            evidenceId: String(row.evidence_id),
            extractionId: row.extraction_id as string | null,
            relationship: row.relationship as FactEvidenceLinkRecord["relationship"],
            reviewStatus: row.review_status as FactEvidenceLinkRecord["reviewStatus"],
            createdAt: String(row.created_at),
            updatedAt: String(row.updated_at),
        }
    }
}
