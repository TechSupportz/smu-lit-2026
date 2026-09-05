import { createHash } from 'node:crypto';
import { readFile, unlink } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { dispatch, init } from '@flue/runtime';
import { createAgentRouter } from '@flue/runtime/routing';
import { Hono, type Context } from 'hono';
import * as v from 'valibot';
import { SCTPreFilingAgent } from './agents/sct-prefiling-agent.js';
import {
  AcknowledgeWarningInputSchema,
  CreateCaseInputSchema,
  IdSchema,
  ProposeFactInputSchema,
  ReviewFactInputSchema,
  UpdateCaseInputSchema,
  UpsertPartyInputSchema,
  UpsertRemedyInputSchema,
} from './domain/schemas.js';
import { AppError, ProcessingError, RevisionConflictError } from './errors.js';
import { refreshAssessment } from './services/assessment.js';
import { reconcileCase } from './services/reconciliation.js';
import {
  caseStore,
  evidenceService,
  flueCleanupService,
  guidanceService,
  pdfService,
  snapshotService,
} from './runtime.js';
import { config } from './config.js';

const RevisionSchema = v.pipe(v.number(), v.integer(), v.minValue(1));
const TextSchema = v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(20_000));

const AddQuestionSchema = v.object({
  expectedRevision: RevisionSchema,
  question: v.pipe(TextSchema, v.maxLength(2_000)),
  reason: v.pipe(TextSchema, v.maxLength(5_000)),
  relatedFactIds: v.optional(v.array(IdSchema), []),
  priority: v.picklist(['REQUIRED', 'IMPORTANT', 'OPTIONAL']),
});

const ResolveQuestionSchema = v.object({
  expectedRevision: RevisionSchema,
  status: v.picklist(['ANSWERED', 'UNRESOLVED']),
  answer: v.optional(v.nullable(TextSchema), null),
});

const AddContradictionSchema = v.object({
  expectedRevision: RevisionSchema,
  description: v.pipe(TextSchema, v.maxLength(5_000)),
  factIds: v.optional(v.array(IdSchema), []),
  evidenceIds: v.optional(v.array(IdSchema), []),
  severity: v.picklist(['LOW', 'MEDIUM', 'HIGH']),
});

const ResolveContradictionSchema = v.object({
  expectedRevision: RevisionSchema,
  status: v.picklist(['RESOLVED', 'ACCEPTED_UNCERTAINTY']),
});

const ExtractEvidenceSchema = v.object({ expectedRevision: RevisionSchema });
const SnapshotInputSchema = v.object({ expectedRevision: RevisionSchema });
const TurnInputSchema = v.object({
  idempotencyKey: v.pipe(v.string(), v.trim(), v.minLength(8), v.maxLength(200)),
  message: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(50_000)),
});
const GuidanceInputSchema = v.object({
  expectedRevision: RevisionSchema,
  query: v.pipe(v.string(), v.trim(), v.minLength(2), v.maxLength(500)),
  sources: v.optional(v.array(v.picklist(['eligibility', 'filing', 'statutes'])), ['eligibility', 'filing', 'statutes']),
});

function hashJson(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

async function jsonBody<TSchema extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>>(
  context: Context,
  schema: TSchema,
): Promise<v.InferOutput<TSchema>> {
  return v.parse(schema, await context.req.json());
}

function refreshedState(caseId: string): ReturnType<typeof caseStore.getCaseState> {
  refreshAssessment(caseStore, caseId);
  return caseStore.getCaseState(caseId);
}

function safeSnapshotPath(path: string): string {
  const root = resolve(config.snapshotDir);
  const candidate = resolve(path);
  if (candidate !== root && !candidate.startsWith(`${root}${sep}`)) {
    throw new ProcessingError('Snapshot path escaped the configured snapshot directory.');
  }
  return candidate;
}

function contentDisposition(filename: string): string {
  const ascii = filename.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  return `attachment; filename="${ascii || 'download'}"`;
}

function formText(form: FormData, key: string): string | null {
  const value = form.get(key);
  return typeof value === 'string' ? value : null;
}

const app = new Hono();

app.use('*', async (context, next) => {
  const origin = context.req.header('origin');
  if (origin && config.corsOrigins.includes(origin)) {
    context.header('Access-Control-Allow-Origin', origin);
    context.header('Vary', 'Origin');
    context.header('Access-Control-Allow-Headers', 'Content-Type, Idempotency-Key, If-Match');
    context.header('Access-Control-Allow-Methods', 'GET, HEAD, POST, PATCH, DELETE, OPTIONS');
    context.header('Access-Control-Expose-Headers', 'Location, Stream-Next-Offset, Stream-Up-To-Date');
  }
  context.header('Cache-Control', 'no-store');
  if (context.req.method === 'OPTIONS') return context.body(null, 204);
  await next();
});

app.onError((error, context) => {
  if (error instanceof AppError) {
    return context.json({ error: { code: error.code, message: error.message, details: error.details ?? null } }, error.status as 400);
  }
  if (v.isValiError(error)) {
    return context.json({
      error: {
        code: 'INVALID_INPUT',
        message: 'Request validation failed.',
        details: v.flatten(error.issues),
      },
    }, 400);
  }
  if (error instanceof SyntaxError) {
    return context.json({ error: { code: 'INVALID_JSON', message: 'Request body is not valid JSON.', details: null } }, 400);
  }
  console.error('[server] unhandled request error', error);
  return context.json({ error: { code: 'INTERNAL_ERROR', message: 'The server could not complete the request.', details: null } }, 500);
});

app.get('/health', (context) => context.json({ status: 'ok' }));

app.get('/cases', (context) => context.json({ cases: caseStore.listCases() }));

app.post('/cases', async (context) => {
  const input = await jsonBody(context, CreateCaseInputSchema);
  const created = caseStore.createCase(input);
  return context.json(refreshedState(created.id), 201, { Location: `/cases/${created.id}` });
});

app.get('/cases/:caseId', (context) => context.json(caseStore.getCaseState(context.req.param('caseId'))));

app.patch('/cases/:caseId', async (context) => {
  const caseId = context.req.param('caseId');
  const input = await jsonBody(context, UpdateCaseInputSchema);
  const state = await caseStore.mutations.run(caseId, () => {
    caseStore.updateCase(caseId, input);
    return refreshedState(caseId);
  });
  return context.json(state);
});

app.post('/cases/:caseId/parties', async (context) => {
  const caseId = context.req.param('caseId');
  const input = await jsonBody(context, UpsertPartyInputSchema);
  const state = await caseStore.mutations.run(caseId, () => {
    caseStore.upsertParty(caseId, input);
    return refreshedState(caseId);
  });
  return context.json(state, 201);
});

app.post('/cases/:caseId/facts', async (context) => {
  const caseId = context.req.param('caseId');
  const input = await jsonBody(context, ProposeFactInputSchema);
  const state = await caseStore.mutations.run(caseId, () => {
    caseStore.proposeFact(caseId, input, input.sourceType === 'USER_ASSERTION' ? 'USER' : 'AGENT');
    reconcileCase(caseStore, caseId);
    return refreshedState(caseId);
  });
  return context.json(state, 201);
});

app.patch('/cases/:caseId/facts/:factId/review', async (context) => {
  const caseId = context.req.param('caseId');
  const input = await jsonBody(context, ReviewFactInputSchema);
  const state = await caseStore.mutations.run(caseId, () => {
    caseStore.reviewFact(caseId, context.req.param('factId'), input);
    return refreshedState(caseId);
  });
  return context.json(state);
});

app.post('/cases/:caseId/remedies', async (context) => {
  const caseId = context.req.param('caseId');
  const input = await jsonBody(context, UpsertRemedyInputSchema);
  const state = await caseStore.mutations.run(caseId, () => {
    caseStore.upsertRemedy(caseId, input);
    return refreshedState(caseId);
  });
  return context.json(state, 201);
});

app.post('/cases/:caseId/evidence', async (context) => {
  const caseId = context.req.param('caseId');
  const form = await context.req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) throw new ProcessingError('Multipart field "file" is required.');
  const expectedRevision = Number.parseInt(formText(form, 'expectedRevision') ?? '', 10);
  const relevantPagesRaw = formText(form, 'relevantPages') ?? '[]';
  let relevantPages: unknown;
  try {
    relevantPages = JSON.parse(relevantPagesRaw);
  } catch {
    throw new ProcessingError('relevantPages must be a JSON array of 1-based page numbers.');
  }
  const metadata = v.parse(v.object({
    expectedRevision: RevisionSchema,
    documentType: v.nullable(v.pipe(v.string(), v.trim(), v.maxLength(200))),
    description: v.nullable(v.pipe(v.string(), v.trim(), v.maxLength(5_000))),
    relevantPages: v.array(v.pipe(v.number(), v.integer(), v.minValue(1))),
  }), {
    expectedRevision,
    documentType: formText(form, 'documentType'),
    description: formText(form, 'description'),
    relevantPages,
  });
  const state = await caseStore.mutations.run(caseId, async () => {
    await evidenceService.upload(caseId, file, metadata);
    return refreshedState(caseId);
  });
  return context.json(state, 201);
});

app.get('/cases/:caseId/evidence', (context) => {
  const state = caseStore.getCaseState(context.req.param('caseId'));
  return context.json({
    evidence: state.evidence,
    extractionRuns: state.extractionRuns,
    extractions: state.extractions,
    factEvidenceLinks: state.factEvidenceLinks,
  });
});

app.get('/cases/:caseId/evidence/:evidenceId/content', async (context) => {
  const evidence = caseStore.getEvidence(context.req.param('caseId'), context.req.param('evidenceId'));
  const bytes = await readFile(evidenceService.resolveEvidencePath(evidence));
  const digest = createHash('sha256').update(bytes).digest('hex');
  if (digest !== evidence.sha256) throw new ProcessingError('Evidence original failed its integrity check.');
  return context.body(bytes, 200, {
    'Content-Type': evidence.mimeType,
    'Content-Disposition': contentDisposition(evidence.originalFilename),
    'X-Content-Type-Options': 'nosniff',
  });
});

app.post('/cases/:caseId/evidence/:evidenceId/extract', async (context) => {
  const caseId = context.req.param('caseId');
  const input = await jsonBody(context, ExtractEvidenceSchema);
  const state = await caseStore.mutations.run(caseId, async () => {
    await evidenceService.extract(caseId, context.req.param('evidenceId'), input.expectedRevision);
    reconcileCase(caseStore, caseId);
    return refreshedState(caseId);
  });
  return context.json(state);
});

app.post('/cases/:caseId/questions', async (context) => {
  const caseId = context.req.param('caseId');
  const input = await jsonBody(context, AddQuestionSchema);
  const state = await caseStore.mutations.run(caseId, () => {
    caseStore.addQuestion(caseId, input);
    return refreshedState(caseId);
  });
  return context.json(state, 201);
});

app.patch('/cases/:caseId/questions/:questionId', async (context) => {
  const caseId = context.req.param('caseId');
  const input = await jsonBody(context, ResolveQuestionSchema);
  const state = await caseStore.mutations.run(caseId, () => {
    caseStore.resolveQuestion(caseId, context.req.param('questionId'), input);
    return refreshedState(caseId);
  });
  return context.json(state);
});

app.post('/cases/:caseId/contradictions', async (context) => {
  const caseId = context.req.param('caseId');
  const input = await jsonBody(context, AddContradictionSchema);
  const state = await caseStore.mutations.run(caseId, () => {
    caseStore.addContradiction(caseId, input);
    return refreshedState(caseId);
  });
  return context.json(state, 201);
});

app.patch('/cases/:caseId/contradictions/:contradictionId', async (context) => {
  const caseId = context.req.param('caseId');
  const input = await jsonBody(context, ResolveContradictionSchema);
  const state = await caseStore.mutations.run(caseId, () => {
    caseStore.resolveContradiction(caseId, context.req.param('contradictionId'), input);
    return refreshedState(caseId);
  });
  return context.json(state);
});

app.post('/cases/:caseId/warnings/:warningId/acknowledge', async (context) => {
  const caseId = context.req.param('caseId');
  const input = await jsonBody(context, AcknowledgeWarningInputSchema);
  const state = await caseStore.mutations.run(caseId, () => {
    caseStore.acknowledgeWarning(caseId, context.req.param('warningId'), input);
    return refreshedState(caseId);
  });
  return context.json(state);
});

app.post('/cases/:caseId/guidance', async (context) => {
  const caseId = context.req.param('caseId');
  const input = await jsonBody(context, GuidanceInputSchema);
  const result = await caseStore.mutations.run(caseId, async () => {
    const guidance = await guidanceService.search(input.query, input.sources);
    const requirements = caseStore.recordGuidance(caseId, {
      expectedRevision: input.expectedRevision,
      query: input.query,
      checkedAt: guidance.checkedAt,
      sources: guidance.sources,
    });
    return { guidance, requirements, state: refreshedState(caseId) };
  });
  return context.json(result);
});

app.post('/cases/:caseId/snapshots', async (context) => {
  const input = await jsonBody(context, SnapshotInputSchema);
  return context.json(await snapshotService.create(context.req.param('caseId'), input.expectedRevision), 201);
});

app.get('/cases/:caseId/snapshots', (context) => {
  return context.json({ snapshots: caseStore.getCaseState(context.req.param('caseId')).snapshots });
});

app.get('/cases/:caseId/snapshots/:snapshotId', (context) => {
  return context.json(caseStore.getSnapshot(context.req.param('caseId'), context.req.param('snapshotId')));
});

app.get('/cases/:caseId/snapshots/:snapshotId/json', async (context) => {
  const snapshot = caseStore.getSnapshot(context.req.param('caseId'), context.req.param('snapshotId'));
  const bytes = await readFile(safeSnapshotPath(snapshot.jsonPath));
  const digest = createHash('sha256').update(bytes).digest('hex');
  if (digest !== snapshot.jsonSha256) throw new ProcessingError('Snapshot JSON failed its integrity check.');
  return context.body(bytes, 200, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Disposition': contentDisposition(`${snapshot.basename}.json`),
  });
});

app.post('/cases/:caseId/snapshots/:snapshotId/pdf', async (context) => {
  return context.json(await pdfService.compile(context.req.param('caseId'), context.req.param('snapshotId')));
});

app.get('/cases/:caseId/snapshots/:snapshotId/pdf', async (context) => {
  const snapshot = caseStore.getSnapshot(context.req.param('caseId'), context.req.param('snapshotId'));
  if (!snapshot.pdfPath || !snapshot.pdfSha256) throw new ProcessingError('The snapshot PDF has not been compiled.');
  const bytes = await readFile(safeSnapshotPath(snapshot.pdfPath));
  const digest = createHash('sha256').update(bytes).digest('hex');
  if (digest !== snapshot.pdfSha256 || bytes.subarray(0, 5).toString() !== '%PDF-') {
    throw new ProcessingError('Snapshot PDF failed its integrity check.');
  }
  return context.body(bytes, 200, {
    'Content-Type': 'application/pdf',
    'Content-Disposition': contentDisposition(`${snapshot.basename}.pdf`),
  });
});

app.post('/cases/:caseId/turns', async (context) => {
  const caseId = context.req.param('caseId');
  const input = await jsonBody(context, TurnInputSchema);
  const message = { kind: 'user' as const, body: input.message };
  const requestHash = hashJson(message);
  const admission = caseStore.beginTurn(caseId, { idempotencyKey: input.idempotencyKey, requestHash });
  if (admission.duplicate && admission.submissionId && admission.agentUid && admission.acceptedAt) {
    return context.json({ ...admission, streamUrl: `/agents/sct-prefiling/${caseId}` }, 202);
  }
  if (admission.duplicate && admission.status === 'FAILED') {
    throw new ProcessingError('This turn key previously failed admission; retry with a new idempotency key.');
  }
  try {
    const receipt = await dispatch(SCTPreFilingAgent, {
      id: caseId,
      message,
      idempotencyKey: `turn:${input.idempotencyKey}`,
    });
    caseStore.finishTurnAdmission(admission.id, receipt);
    return context.json({
      turnRequestId: admission.id,
      duplicate: admission.duplicate || receipt.deduplicated === true,
      submissionId: receipt.submissionId,
      uid: receipt.uid,
      acceptedAt: receipt.acceptedAt,
      streamUrl: `/agents/sct-prefiling/${caseId}`,
    }, 202);
  } catch (error) {
    caseStore.failTurnAdmission(admission.id, error instanceof Error ? error.name : 'UNKNOWN');
    throw error;
  }
});

app.delete('/cases/:caseId', async (context) => {
  const caseId = context.req.param('caseId');
  const expectedRevision = Number.parseInt(context.req.query('expectedRevision') ?? '', 10);
  const record = caseStore.getCase(caseId);
  if (!Number.isInteger(expectedRevision) || expectedRevision < 1) {
    throw new ProcessingError('A positive expectedRevision query parameter is required.');
  }
  if (record.revision !== expectedRevision) throw new RevisionConflictError(caseId, expectedRevision, record.revision);
  await init(SCTPreFilingAgent, { id: caseId }).abort().catch(() => undefined);
  const conversationCleanup = await flueCleanupService.purgeCase(caseId);
  const deleted = await caseStore.mutations.run(caseId, () => caseStore.deleteCaseRecords(caseId));
  const paths = [
    ...deleted.evidencePaths.map((storageKey) => {
      const root = resolve(config.evidenceDir);
      const path = resolve(root, storageKey);
      if (path !== root && !path.startsWith(`${root}${sep}`)) throw new ProcessingError('Evidence cleanup path escaped its directory.');
      return path;
    }),
    ...deleted.snapshotPaths.map(safeSnapshotPath),
  ];
  const cleanup = await Promise.allSettled(paths.map((path) => unlink(path)));
  const cleanupFailures = cleanup.filter((result) => result.status === 'rejected').length;
  return context.json({
    deleted: true,
    caseId,
    removedFiles: paths.length - cleanupFailures,
    cleanupFailures,
    conversationCleanup,
  });
});

app.route('/agents/sct-prefiling', createAgentRouter(SCTPreFilingAgent));

export default app;
