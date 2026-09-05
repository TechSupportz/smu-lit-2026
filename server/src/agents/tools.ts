import { createHash } from 'node:crypto';
import { useTool } from '@flue/runtime';
import * as v from 'valibot';
import {
  CasePatchFieldsSchema,
  DisputeCategorySchema,
  DisputeModelDataSchema,
  FactSourceTypeSchema,
  UpsertPartyInputSchema,
  UpsertRemedyInputSchema,
} from '../domain/schemas.js';
import type { assessCase } from '../services/assessment.js';
import { refreshAssessment } from '../services/assessment.js';
import { reconcileCase } from '../services/reconciliation.js';
import { caseStore, evidenceService, guidanceService, pdfService, snapshotService } from '../runtime.js';

const RevisionSchema = v.pipe(v.number(), v.integer(), v.minValue(1));
const ToolIdSchema = v.pipe(v.string(), v.minLength(8), v.maxLength(128));

function withAssessment<T>(caseId: string, value: T): { value: T; caseRevision: number; assessment: ReturnType<typeof assessCase> } {
  reconcileCase(caseStore, caseId);
  const assessment = refreshAssessment(caseStore, caseId);
  return { value, caseRevision: caseStore.getCase(caseId).revision, assessment };
}

function searchable(value: unknown): string {
  return typeof value === 'string' ? value.toLowerCase() : '';
}

function toolOutput(value: unknown): string {
  return JSON.stringify(value);
}

export function useSctTools(caseId: string): void {
  useTool({
    name: 'get_case_state',
    description: 'Read the complete structured state, provenance, warnings, checks, and current revision for this case.',
    run() {
      const assessment = refreshAssessment(caseStore, caseId);
      return toolOutput({ state: caseStore.getCaseState(caseId), assessment });
    },
  });

  useTool({
    name: 'update_case_details',
    description: 'Update case details from the conversation. This cannot confirm the final review or confirm a proposed category for the user.',
    input: v.object({
      expectedRevision: RevisionSchema,
      patch: v.omit(CasePatchFieldsSchema, ['userReviewed', 'categoryUserConfirmed']),
    }),
    async run({ data }) {
      return caseStore.mutations.run(caseId, () => {
        const patch = {
          ...data.patch,
          ...(data.patch.category !== undefined ? { categoryUserConfirmed: false } : {}),
        };
        const value = caseStore.updateCase(caseId, { expectedRevision: data.expectedRevision, patch }, 'AGENT');
        return toolOutput(withAssessment(caseId, value));
      });
    },
  });

  useTool({
    name: 'propose_fact',
    description: 'Record a user assertion, document-derived candidate, or AI inference as a pending fact. This never confirms the fact.',
    input: v.object({
      expectedRevision: RevisionSchema,
      statement: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(10_000)),
      structuredValue: v.optional(v.nullable(v.record(v.string(), v.unknown())), null),
      sourceType: FactSourceTypeSchema,
      sourceMessageId: v.optional(v.nullable(v.string()), null),
      material: v.optional(v.boolean(), true),
    }),
    async run({ data }) {
      return caseStore.mutations.run(caseId, () => {
        const value = caseStore.proposeFact(caseId, data, 'AGENT');
        return toolOutput(withAssessment(caseId, value));
      });
    },
  });

  useTool({
    name: 'upsert_party',
    description: 'Create or update claimant/respondent particulars while preserving the case revision check.',
    input: UpsertPartyInputSchema,
    async run({ data }) {
      return caseStore.mutations.run(caseId, () => {
        const value = caseStore.upsertParty(caseId, data, 'AGENT');
        return toolOutput(withAssessment(caseId, value));
      });
    },
  });

  useTool({
    name: 'upsert_remedy',
    description: 'Create or update a requested remedy and amount. Record discrepancies instead of silently reconciling them.',
    input: UpsertRemedyInputSchema,
    async run({ data }) {
      return caseStore.mutations.run(caseId, () => {
        const value = caseStore.upsertRemedy(caseId, data, 'AGENT');
        return toolOutput(withAssessment(caseId, value));
      });
    },
  });

  useTool({
    name: 'list_uploaded_files',
    description: 'List immutable uploaded evidence originals and their processing status.',
    run() {
      return toolOutput(caseStore.getCaseState(caseId).evidence);
    },
  });

  useTool({
    name: 'inspect_file',
    description: 'Inspect stored extraction runs, cited items, and fact links for one uploaded evidence file.',
    input: v.object({ evidenceId: ToolIdSchema }),
    run({ data }) {
      const state = caseStore.getCaseState(caseId);
      const evidence = caseStore.getEvidence(caseId, data.evidenceId);
      return toolOutput({
          evidence,
          extractionRuns: state.extractionRuns.filter((run) => run.evidenceId === data.evidenceId),
          extractions: state.extractions.filter((item) => item.evidenceId === data.evidenceId),
          factLinks: state.factEvidenceLinks.filter((link) => link.evidenceId === data.evidenceId),
      });
    },
  });

  useTool({
    name: 'extract_from_file',
    description: 'Run the bounded Gemini/OpenRouter extraction for one evidence original and preserve partial/unreadable-page status.',
    input: v.object({ evidenceId: ToolIdSchema, expectedRevision: RevisionSchema }),
    async run({ data }) {
      return caseStore.mutations.run(caseId, async () => {
        const value = await evidenceService.extract(caseId, data.evidenceId, data.expectedRevision);
        return toolOutput(withAssessment(caseId, value));
      });
    },
  });

  useTool({
    name: 'find_in_files',
    description: 'Search existing evidence extraction values, quotes, and source locations. This does not claim the whole original was inspected.',
    input: v.object({ query: v.pipe(v.string(), v.trim(), v.minLength(2), v.maxLength(500)) }),
    run({ data }) {
      const query = data.query.toLowerCase();
      const state = caseStore.getCaseState(caseId);
      const matches = state.extractions.filter((item) => [item.value, item.quote, item.location]
        .some((value) => searchable(value).includes(query))).slice(0, 100);
      return toolOutput({ query: data.query, matches });
    },
  });

  useTool({
    name: 'verify_fact_against_files',
    description: 'Return explicit links and cautious lexical candidates for one fact. Only explicit reviewed links establish support or contradiction.',
    input: v.object({ factId: ToolIdSchema }),
    run({ data }) {
      const state = caseStore.getCaseState(caseId);
      const fact = state.facts.find((item) => item.id === data.factId);
      if (!fact) throw new Error('Fact not found');
      const links = state.factEvidenceLinks.filter((link) => link.factId === data.factId);
      const tokens = fact.statement.toLowerCase().split(/\W+/).filter((token) => token.length >= 4);
      const candidates = state.extractions.filter((item) => {
        const haystack = `${item.value} ${item.quote ?? ''}`.toLowerCase();
        return tokens.some((token) => haystack.includes(token));
      }).slice(0, 25);
      const reviewed = links.filter((link) => link.reviewStatus !== 'REJECTED');
      const result = reviewed.some((link) => link.relationship === 'CONTRADICTS') ? 'contradicted'
        : reviewed.some((link) => link.relationship === 'SUPPORTS') ? 'supported'
          : candidates.length > 0 ? 'ambiguous' : 'not_found';
      return toolOutput({ result, fact, links, lexicalCandidates: candidates });
    },
  });

  useTool({
    name: 'link_fact_to_evidence',
    description: 'Propose an explicit support, contradiction, context, or unclear link with a cited extraction when available.',
    input: v.object({
      expectedRevision: RevisionSchema,
      factId: ToolIdSchema,
      evidenceId: ToolIdSchema,
      extractionId: v.optional(ToolIdSchema),
      relationship: v.picklist(['SUPPORTS', 'CONTRADICTS', 'CONTEXT', 'UNCLEAR']),
    }),
    async run({ data }) {
      return caseStore.mutations.run(caseId, () => {
        const value = caseStore.linkFactToEvidence(caseId, {
          expectedRevision: data.expectedRevision,
          factId: data.factId,
          evidenceId: data.evidenceId,
          relationship: data.relationship,
          ...(data.extractionId === undefined ? {} : { extractionId: data.extractionId }),
        });
        return toolOutput(withAssessment(caseId, value));
      });
    },
  });

  useTool({
    name: 'find_contradictions',
    description: 'List explicit contradictions; never silently choose one account.',
    run() {
      return toolOutput(caseStore.getCaseState(caseId).contradictions);
    },
  });

  useTool({
    name: 'add_contradiction',
    description: 'Record a cited conflict between facts or evidence for user review.',
    input: v.object({
      expectedRevision: RevisionSchema,
      description: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(5_000)),
      factIds: v.optional(v.array(ToolIdSchema), []),
      evidenceIds: v.optional(v.array(ToolIdSchema), []),
      severity: v.picklist(['LOW', 'MEDIUM', 'HIGH']),
    }),
    async run({ data }) {
      return caseStore.mutations.run(caseId, () => {
        const value = caseStore.addContradiction(caseId, data);
        return toolOutput(withAssessment(caseId, value));
      });
    },
  });

  useTool({
    name: 'list_open_questions',
    description: 'List open, answered, and explicitly unresolved investigation questions.',
    run() {
      return toolOutput(caseStore.getCaseState(caseId).questions);
    },
  });

  useTool({
    name: 'add_open_question',
    description: 'Record a focused follow-up question and why it matters.',
    input: v.object({
      expectedRevision: RevisionSchema,
      question: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(5_000)),
      reason: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(5_000)),
      relatedFactIds: v.optional(v.array(ToolIdSchema), []),
      priority: v.picklist(['REQUIRED', 'IMPORTANT', 'OPTIONAL']),
    }),
    async run({ data }) {
      return caseStore.mutations.run(caseId, () => {
        const value = caseStore.addQuestion(caseId, data);
        return toolOutput(withAssessment(caseId, value));
      });
    },
  });

  useTool({
    name: 'resolve_open_question',
    description: 'Record that a question was answered or explicitly remains uncertain; preserve the supplied answer wording.',
    input: v.object({
      expectedRevision: RevisionSchema,
      questionId: ToolIdSchema,
      status: v.picklist(['ANSWERED', 'UNRESOLVED']),
      answer: v.optional(v.nullable(v.pipe(v.string(), v.maxLength(10_000))), null),
    }),
    async run({ data }) {
      return caseStore.mutations.run(caseId, () => {
        const value = caseStore.resolveQuestion(caseId, data.questionId, data);
        return toolOutput(withAssessment(caseId, value));
      });
    },
  });

  useTool({
    name: 'retrieve_official_guidance',
    description: 'Retrieve current procedural guidance only from the configured Singapore Judiciary and Singapore Statutes Online allowlist.',
    input: v.object({
      expectedRevision: RevisionSchema,
      query: v.pipe(v.string(), v.trim(), v.minLength(2), v.maxLength(500)),
      sources: v.optional(v.array(v.picklist(['eligibility', 'filing', 'statutes'])), ['eligibility', 'filing', 'statutes']),
    }),
    async run({ data }) {
      return caseStore.mutations.run(caseId, async () => {
        const result = await guidanceService.search(data.query, data.sources);
        const value = caseStore.recordGuidance(caseId, {
          expectedRevision: data.expectedRevision,
          query: data.query,
          checkedAt: result.checkedAt,
          sources: result.sources,
        });
        return toolOutput({ result, persistedRequirements: value, assessment: refreshAssessment(caseStore, caseId) });
      });
    },
  });

  useTool({
    name: 'check_prefiling_completeness',
    description: 'Evaluate eligibility and preparation separately and return structured reasons without turning warnings into failures.',
    run() {
      const assessment = refreshAssessment(caseStore, caseId);
      return toolOutput({ case: caseStore.getCase(caseId), assessment });
    },
  });

  useTool({
    name: 'save_final_prefiling_state',
    description: 'Save an immutable revision-bound JSON snapshot after required user review. A failed eligibility check remains a blocked handoff.',
    input: v.object({ expectedRevision: RevisionSchema }),
    async run({ data }) {
      return toolOutput(await snapshotService.create(caseId, data.expectedRevision));
    },
  });

  useTool({
    name: 'compile_snapshot_pdf',
    description: 'Compile one immutable saved snapshot into the bounded Typst case-summary PDF.',
    input: v.object({ snapshotId: ToolIdSchema }),
    async run({ data }) {
      return toolOutput(await pdfService.compile(caseId, data.snapshotId));
    },
  });
}

export function requestHash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export const AgentCategorySchema = DisputeCategorySchema;
export const AgentModelDataSchema = DisputeModelDataSchema;
