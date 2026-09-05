import { createHash } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { nanoid } from 'nanoid';
import type { AppConfig } from '../config.js';
import type { SnapshotRecord } from '../domain/schemas.js';
import { ProcessingError } from '../errors.js';
import type { CaseState, CaseStore } from '../storage/case-store.js';
import { assessCase, refreshAssessment, type AssessmentResult } from './assessment.js';

function hash(value: string | Uint8Array): string {
  return createHash('sha256').update(value).digest('hex');
}

function slug(value: string): string {
  const normalized = value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  return normalized.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'untitled-case';
}

function compactTimestamp(date: Date): string {
  return date.toISOString().replace(/[-:.]/g, '');
}

function safePath(root: string, caseId: string, filename: string): string {
  const normalizedRoot = resolve(root);
  const candidate = resolve(normalizedRoot, caseId, filename);
  if (!candidate.startsWith(`${normalizedRoot}${sep}`)) throw new ProcessingError('Snapshot path escaped its workspace');
  return candidate;
}

function buildTimeline(state: CaseState): Array<Record<string, unknown>> {
  return state.facts.flatMap((fact) => {
    const value = fact.structuredValue;
    const date = typeof value?.date === 'string' ? value.date : null;
    const originalWording = typeof value?.originalWording === 'string' ? value.originalWording : null;
    const precision = typeof value?.precision === 'string' ? value.precision : null;
    return date || originalWording ? [{
      factId: fact.id,
      date,
      originalWording,
      precision,
      statement: fact.statement,
      reviewStatus: fact.reviewStatus,
      evidenceAssessment: fact.evidenceAssessment,
    }] : [];
  });
}

export interface FinalSnapshot {
  schemaVersion: '1.0.0';
  snapshot: {
    id: string;
    name: string;
    displayName: string;
    createdAt: string;
    caseId: string;
    caseRevision: number;
    supersedesSnapshotId: string | null;
  };
  status: {
    eligibilityStatus: CaseState['case']['eligibilityStatus'];
    preparationStatus: CaseState['case']['preparationStatus'];
    userReviewed: boolean;
    canProceed: boolean;
    handoffPermission: 'FILING_READY' | 'PREPARATION_WITH_WARNINGS' | 'BLOCKED_ELIGIBILITY' | 'NOT_READY';
  };
  dispute: Record<string, unknown>;
  parties: CaseState['parties'];
  claimsAndRemedies: Record<string, unknown>;
  facts: CaseState['facts'];
  timeline: Array<Record<string, unknown>>;
  evidenceIndex: Array<Record<string, unknown>>;
  unresolvedQuestions: CaseState['questions'];
  contradictions: CaseState['contradictions'];
  proceduralChecks: CaseState['eligibilityChecks'];
  proceduralRequirements: CaseState['proceduralRequirements'];
  reviewRecords: Record<string, unknown>;
  warnings: CaseState['warnings'];
  readinessReasons: AssessmentResult['reasons'];
  limitations: string[];
}

export class SnapshotService {
  constructor(
    private readonly store: CaseStore,
    private readonly appConfig: AppConfig,
  ) {}

  async create(caseId: string, expectedRevision: number): Promise<{ record: SnapshotRecord; snapshot: FinalSnapshot }> {
    return this.store.mutations.run(caseId, async () => {
      const before = this.store.getCase(caseId);
      if (before.revision !== expectedRevision) {
        // Reuse the store's normal conflict error and current revision details.
        this.store.updateCase(caseId, { expectedRevision, patch: {} });
      }
      refreshAssessment(this.store, caseId);
      const state = this.store.getCaseState(caseId);
      if (!state.case.userReviewed) {
        throw new ProcessingError('The final case review must be explicitly completed before creating a snapshot.');
      }
      if (state.facts.some((fact) => fact.material && fact.reviewStatus === 'PENDING')) {
        throw new ProcessingError('Every material fact must be confirmed, edited, rejected, or marked uncertain before snapshot creation.');
      }
      if (state.questions.some((question) => question.priority === 'REQUIRED' && question.status === 'OPEN')) {
        throw new ProcessingError('Required questions must be answered or explicitly marked unresolved before snapshot creation.');
      }

      const assessment = assessCase(state);
      const createdAt = new Date();
      const snapshotId = `snapshot_${nanoid(16)}`;
      const displayName = state.case.title
        || state.parties.find((party) => party.role === 'CLAIMANT' && party.isPrimary)?.name
        || 'Untitled case';
      const basename = `${nanoid(16)}-${compactTimestamp(createdAt)}-${slug(displayName)}`;
      const latest = state.snapshots[0] ?? null;
      const handoffPermission = state.case.eligibilityStatus === 'FAIL' ? 'BLOCKED_ELIGIBILITY'
        : state.case.preparationStatus === 'READY' ? 'FILING_READY'
          : state.case.preparationStatus === 'READY_WITH_WARNINGS' ? 'PREPARATION_WITH_WARNINGS'
            : 'NOT_READY';
      const snapshot: FinalSnapshot = {
        schemaVersion: '1.0.0',
        snapshot: {
          id: snapshotId,
          name: `${basename}.json`,
          displayName,
          createdAt: createdAt.toISOString(),
          caseId,
          caseRevision: state.case.revision,
          supersedesSnapshotId: latest?.id ?? null,
        },
        status: {
          eligibilityStatus: state.case.eligibilityStatus,
          preparationStatus: state.case.preparationStatus,
          userReviewed: state.case.userReviewed,
          canProceed: state.case.canProceed,
          handoffPermission,
        },
        dispute: {
          category: state.case.category,
          subtype: state.case.subtype,
          categoryConfidence: state.case.categoryConfidence,
          categoryUserConfirmed: state.case.categoryUserConfirmed,
          modelData: state.case.modelData,
          causeOfActionDate: state.case.causeOfActionDate,
          causeOfActionDateOriginal: state.case.causeOfActionDateOriginal,
          causeOfActionDatePrecision: state.case.causeOfActionDatePrecision,
          factualSummary: state.case.factualSummary,
        },
        parties: state.parties,
        claimsAndRemedies: {
          claimAmountCents: state.case.claimAmountCents,
          consentStatus: state.case.consentStatus,
          remedies: state.remedies,
        },
        facts: state.facts,
        timeline: buildTimeline(state),
        evidenceIndex: state.evidence.map((evidence) => ({
          id: evidence.id,
          originalFilename: evidence.originalFilename,
          mimeType: evidence.mimeType,
          sha256: evidence.sha256,
          sizeBytes: evidence.sizeBytes,
          documentType: evidence.documentType,
          description: evidence.description,
          relevantPages: evidence.relevantPages,
          pageCount: evidence.pageCount,
          processingStatus: evidence.processingStatus,
          processingError: evidence.processingError,
          extractionRuns: state.extractionRuns.filter((run) => run.evidenceId === evidence.id),
          extractions: state.extractions.filter((item) => item.evidenceId === evidence.id),
          factLinks: state.factEvidenceLinks.filter((link) => link.evidenceId === evidence.id),
        })),
        unresolvedQuestions: state.questions.filter((question) => question.status !== 'ANSWERED'),
        contradictions: state.contradictions.filter((contradiction) => contradiction.status !== 'RESOLVED'),
        proceduralChecks: state.eligibilityChecks,
        proceduralRequirements: state.proceduralRequirements,
        reviewRecords: {
          caseUserReviewed: state.case.userReviewed,
          factReviews: state.facts.map(({ id: factId, reviewStatus, revision }) => ({ factId, reviewStatus, revision })),
          warningAcknowledgments: state.warnings
            .filter((item) => item.status === 'ACKNOWLEDGED')
            .map(({ id: warningId, code, fingerprint, acknowledgedAt, acknowledgedRevision }) => ({
              warningId, code, fingerprint, acknowledgedAt, acknowledgedRevision,
            })),
        },
        warnings: state.warnings,
        readinessReasons: assessment.reasons,
        limitations: [
          'This is a preparation snapshot, not an official court form or legal advice.',
          'User confirmation does not independently establish documentary support or legal correctness.',
          'AI extractions and inferences remain distinguishable from user-confirmed facts.',
          'Original evidence is stored separately and is not embedded in this snapshot.',
        ],
      };
      const json = `${JSON.stringify(snapshot, null, 2)}\n`;
      const jsonPath = safePath(this.appConfig.snapshotDir, caseId, `${basename}.json`);
      await mkdir(dirname(jsonPath), { recursive: true });
      await writeFile(jsonPath, json, { flag: 'wx', mode: 0o400 });
      try {
        const record = this.store.createSnapshotRecord({
          id: snapshotId,
          caseId,
          caseRevision: state.case.revision,
          displayName,
          basename,
          jsonPath,
          jsonSha256: hash(json),
          pdfPath: null,
          pdfSha256: null,
          supersedesSnapshotId: latest?.id ?? null,
          createdAt: createdAt.toISOString(),
        });
        return { record, snapshot };
      } catch (error) {
        await unlink(jsonPath).catch(() => undefined);
        throw error;
      }
    });
  }
}
