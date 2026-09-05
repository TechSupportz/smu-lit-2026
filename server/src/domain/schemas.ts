import * as v from 'valibot';

export const NonEmptyStringSchema = v.pipe(v.string(), v.trim(), v.nonEmpty());
export const IdSchema = v.pipe(v.string(), v.trim(), v.minLength(8), v.maxLength(128));
export const IsoDateTimeSchema = v.pipe(v.string(), v.isoTimestamp());
export const NullableStringSchema = v.nullable(v.string());
export const JsonObjectSchema = v.record(v.string(), v.unknown());

export const PreFilingStageSchema = v.picklist([
  'INTAKE',
  'ELIGIBILITY',
  'PARTIES',
  'CLAIM_DETAILS',
  'EVIDENCE',
  'REMEDY',
  'VERIFICATION',
  'FINAL_REVIEW',
  'COMPLETE',
]);

export const EligibilityStatusSchema = v.picklist(['PASS', 'FAIL', 'UNVERIFIED']);
export const PreparationStatusSchema = v.picklist([
  'NOT_READY',
  'NEEDS_USER_INPUT',
  'NEEDS_EVIDENCE',
  'NEEDS_CONFLICT_RESOLUTION',
  'READY_WITH_WARNINGS',
  'READY',
]);

export const DisputeCategorySchema = v.picklist([
  'SALE_OF_GOODS',
  'PROVISION_OF_SERVICES',
  'RESIDENTIAL_TENANCY',
  'PROPERTY_DAMAGE',
  'CPFTA_UNFAIR_PRACTICE',
  'MOTOR_VEHICLE_DEPOSIT_REFUND',
  'GENERIC',
]);

const OptionalText = v.optional(v.nullable(v.pipe(v.string(), v.trim(), v.maxLength(10_000))), null);
const OptionalCents = v.optional(v.nullable(v.pipe(v.number(), v.integer(), v.minValue(0))), null);
const OptionalEvidenceIds = v.optional(v.array(IdSchema), []);

export const DisputeModelDataSchema = v.variant('model', [
  v.object({
    model: v.literal('SALE_OF_GOODS'), item: OptionalText, agreement: OptionalText,
    delivery: OptionalText, allegedIssue: OptionalText,
    payments: v.optional(v.array(v.object({ amountCents: OptionalCents, wording: OptionalText })), []),
    remedyNotes: OptionalText,
  }),
  v.object({
    model: v.literal('PROVISION_OF_SERVICES'), scope: OptionalText, quotedTerms: OptionalText,
    promisedTerms: OptionalText, performance: OptionalText, allegedFailure: OptionalText,
    payments: v.optional(v.array(v.object({ amountCents: OptionalCents, wording: OptionalText })), []),
    remedyNotes: OptionalText,
  }),
  v.object({
    model: v.literal('RESIDENTIAL_TENANCY'), premises: OptionalText, agreementPeriod: OptionalText,
    startDate: OptionalText, endDate: OptionalText, depositCents: OptionalCents,
    rentCents: OptionalCents, disputedObligation: OptionalText, remedyNotes: OptionalText,
  }),
  v.object({
    model: v.literal('PROPERTY_DAMAGE'), incident: OptionalText, ownership: OptionalText,
    allegedActor: OptionalText, causationAccount: OptionalText, damageEvidence: OptionalText,
    lossCalculation: OptionalText, motorVehicleRelated: v.optional(v.nullable(v.boolean()), null),
    neighbourCaused: v.optional(v.nullable(v.boolean()), null),
  }),
  v.object({
    model: v.literal('CPFTA_UNFAIR_PRACTICE'), consumerSupplierRelationship: OptionalText,
    relationshipEstablished: v.optional(v.nullable(v.boolean()), null),
    underlyingTransaction: OptionalText, exactConduct: OptionalText, occurredAt: OptionalText,
    allegedLossCents: OptionalCents, remedyNotes: OptionalText, evidenceIds: OptionalEvidenceIds,
  }),
  v.object({
    model: v.literal('MOTOR_VEHICLE_DEPOSIT_REFUND'), dealer: OptionalText,
    proposedTransaction: OptionalText, depositCents: OptionalCents, agreement: OptionalText,
    cancellationFacts: OptionalText, refundFacts: OptionalText, evidenceIds: OptionalEvidenceIds,
  }),
  v.object({
    model: v.literal('GENERIC'), description: OptionalText,
    fields: v.optional(JsonObjectSchema, {}),
  }),
]);

export const ConsentStatusSchema = v.picklist(['YES', 'NO', 'UNKNOWN']);
export const LocationStatusSchema = v.picklist(['SINGAPORE', 'OUTSIDE_SINGAPORE', 'UNKNOWN']);
export const DatePrecisionSchema = v.picklist(['EXACT', 'MONTH', 'YEAR', 'APPROXIMATE', 'UNKNOWN']);
export const PartyRoleSchema = v.picklist(['CLAIMANT', 'RESPONDENT']);
export const PartyKindSchema = v.picklist(['INDIVIDUAL', 'ENTITY', 'UNKNOWN']);
export const FactSourceTypeSchema = v.picklist(['USER_ASSERTION', 'DOCUMENT', 'AI_INFERENCE']);
export const FactReviewStatusSchema = v.picklist(['PENDING', 'CONFIRMED', 'REJECTED', 'UNCERTAIN']);
export const EvidenceAssessmentSchema = v.picklist([
  'UNASSESSED',
  'SUPPORTED',
  'PARTIALLY_SUPPORTED',
  'CONTRADICTED',
  'NOT_FOUND',
  'AMBIGUOUS',
]);
export const LinkRelationshipSchema = v.picklist(['SUPPORTS', 'CONTRADICTS', 'CONTEXT', 'UNCLEAR']);
export const LinkReviewStatusSchema = v.picklist(['AGENT_PROPOSED', 'USER_CONFIRMED', 'REJECTED']);
export const QuestionPrioritySchema = v.picklist(['REQUIRED', 'IMPORTANT', 'OPTIONAL']);
export const QuestionStatusSchema = v.picklist(['OPEN', 'ANSWERED', 'UNRESOLVED']);
export const ContradictionSeveritySchema = v.picklist(['LOW', 'MEDIUM', 'HIGH']);
export const ContradictionStatusSchema = v.picklist(['OPEN', 'RESOLVED', 'ACCEPTED_UNCERTAINTY']);
export const CheckResultSchema = v.picklist(['PASS', 'FAIL', 'UNVERIFIED', 'NOT_APPLICABLE']);
export const RetrievalStatusSchema = v.picklist(['RETRIEVED', 'FAILED', 'NOT_ATTEMPTED', 'HISTORICAL']);
export const WarningStatusSchema = v.picklist(['OPEN', 'ACKNOWLEDGED', 'STALE']);
export const ProcessingStatusSchema = v.picklist(['PENDING', 'PROCESSING', 'PROCESSED', 'PARTIAL', 'FAILED']);

export const CaseRecordSchema = v.object({
  id: IdSchema,
  title: NullableStringSchema,
  displayName: NonEmptyStringSchema,
  stage: PreFilingStageSchema,
  revision: v.pipe(v.number(), v.integer(), v.minValue(1)),
  category: v.nullable(DisputeCategorySchema),
  categoryConfidence: v.nullable(v.pipe(v.number(), v.minValue(0), v.maxValue(1))),
  categoryUserConfirmed: v.boolean(),
  modelData: v.nullable(DisputeModelDataSchema),
  subtype: NullableStringSchema,
  factualSummary: NullableStringSchema,
  causeOfActionDate: NullableStringSchema,
  causeOfActionDateOriginal: NullableStringSchema,
  causeOfActionDatePrecision: DatePrecisionSchema,
  claimAmountCents: v.nullable(v.pipe(v.number(), v.integer(), v.minValue(0))),
  consentStatus: ConsentStatusSchema,
  respondentLocationStatus: LocationStatusSchema,
  officialAssessmentCompleted: v.boolean(),
  officialAssessmentReference: NullableStringSchema,
  eligibilityStatus: EligibilityStatusSchema,
  preparationStatus: PreparationStatusSchema,
  userReviewed: v.boolean(),
  canProceed: v.boolean(),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});

export const CreateCaseInputSchema = v.object({
  title: v.optional(v.nullable(v.pipe(v.string(), v.trim(), v.maxLength(200))), null),
  claimantName: v.optional(v.nullable(v.pipe(v.string(), v.trim(), v.maxLength(300))), null),
  category: v.optional(v.nullable(DisputeCategorySchema), null),
  idempotencyKey: v.optional(v.pipe(v.string(), v.trim(), v.minLength(8), v.maxLength(200))),
});

export const CasePatchFieldsSchema = v.object({
  title: v.optional(v.nullable(v.pipe(v.string(), v.trim(), v.maxLength(200)))),
  stage: v.optional(PreFilingStageSchema),
  category: v.optional(v.nullable(DisputeCategorySchema)),
  categoryConfidence: v.optional(v.nullable(v.pipe(v.number(), v.minValue(0), v.maxValue(1)))),
  categoryUserConfirmed: v.optional(v.boolean()),
  modelData: v.optional(v.nullable(DisputeModelDataSchema)),
  subtype: v.optional(v.nullable(v.pipe(v.string(), v.trim(), v.maxLength(200)))),
  factualSummary: v.optional(v.nullable(v.pipe(v.string(), v.trim(), v.maxLength(20_000)))),
  causeOfActionDate: v.optional(v.nullable(v.string())),
  causeOfActionDateOriginal: v.optional(v.nullable(v.pipe(v.string(), v.trim(), v.maxLength(200)))),
  causeOfActionDatePrecision: v.optional(DatePrecisionSchema),
  claimAmountCents: v.optional(v.nullable(v.pipe(v.number(), v.integer(), v.minValue(0)))),
  consentStatus: v.optional(ConsentStatusSchema),
  respondentLocationStatus: v.optional(LocationStatusSchema),
  officialAssessmentCompleted: v.optional(v.boolean()),
  officialAssessmentReference: v.optional(v.nullable(v.pipe(v.string(), v.trim(), v.maxLength(300)))),
  userReviewed: v.optional(v.boolean()),
});

export const UpdateCaseInputSchema = v.object({
  expectedRevision: v.pipe(v.number(), v.integer(), v.minValue(1)),
  patch: CasePatchFieldsSchema,
});

export const PartyRecordSchema = v.object({
  id: IdSchema,
  caseId: IdSchema,
  role: PartyRoleSchema,
  kind: PartyKindSchema,
  name: NullableStringSchema,
  identificationType: NullableStringSchema,
  identificationNumber: NullableStringSchema,
  phone: NullableStringSchema,
  email: NullableStringSchema,
  address: NullableStringSchema,
  country: NullableStringSchema,
  isPrimary: v.boolean(),
  revision: v.pipe(v.number(), v.integer(), v.minValue(1)),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});

export const UpsertPartyInputSchema = v.object({
  expectedRevision: v.pipe(v.number(), v.integer(), v.minValue(1)),
  partyId: v.optional(IdSchema),
  role: PartyRoleSchema,
  kind: v.optional(PartyKindSchema, 'UNKNOWN'),
  name: v.optional(v.nullable(v.pipe(v.string(), v.trim(), v.maxLength(300))), null),
  identificationType: v.optional(v.nullable(v.pipe(v.string(), v.trim(), v.maxLength(100))), null),
  identificationNumber: v.optional(v.nullable(v.pipe(v.string(), v.trim(), v.maxLength(200))), null),
  phone: v.optional(v.nullable(v.pipe(v.string(), v.trim(), v.maxLength(100))), null),
  email: v.optional(v.nullable(v.pipe(v.string(), v.trim(), v.maxLength(320))), null),
  address: v.optional(v.nullable(v.pipe(v.string(), v.trim(), v.maxLength(2_000))), null),
  country: v.optional(v.nullable(v.pipe(v.string(), v.trim(), v.maxLength(100))), null),
  isPrimary: v.optional(v.boolean(), false),
});

export const FactRecordSchema = v.object({
  id: IdSchema,
  caseId: IdSchema,
  statement: NonEmptyStringSchema,
  structuredValue: v.nullable(JsonObjectSchema),
  sourceType: FactSourceTypeSchema,
  sourceMessageId: NullableStringSchema,
  reviewStatus: FactReviewStatusSchema,
  evidenceAssessment: EvidenceAssessmentSchema,
  material: v.boolean(),
  revision: v.pipe(v.number(), v.integer(), v.minValue(1)),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});

export const ProposeFactInputSchema = v.object({
  expectedRevision: v.pipe(v.number(), v.integer(), v.minValue(1)),
  statement: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(10_000)),
  structuredValue: v.optional(v.nullable(JsonObjectSchema), null),
  sourceType: FactSourceTypeSchema,
  sourceMessageId: v.optional(v.nullable(v.pipe(v.string(), v.trim(), v.maxLength(200))), null),
  material: v.optional(v.boolean(), true),
});

export const ReviewFactInputSchema = v.variant('action', [
  v.object({
    action: v.literal('CONFIRM'),
    expectedRevision: v.pipe(v.number(), v.integer(), v.minValue(1)),
  }),
  v.object({
    action: v.literal('REJECT'),
    expectedRevision: v.pipe(v.number(), v.integer(), v.minValue(1)),
  }),
  v.object({
    action: v.literal('MARK_UNCERTAIN'),
    expectedRevision: v.pipe(v.number(), v.integer(), v.minValue(1)),
  }),
  v.object({
    action: v.literal('EDIT'),
    expectedRevision: v.pipe(v.number(), v.integer(), v.minValue(1)),
    statement: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(10_000)),
    structuredValue: v.optional(v.nullable(JsonObjectSchema), null),
  }),
]);

export const RemedyRecordSchema = v.object({
  id: IdSchema,
  caseId: IdSchema,
  type: v.picklist(['MONEY', 'WORK', 'ALTERNATIVE_MONEY', 'COSTS', 'DISBURSEMENTS', 'OTHER']),
  description: NonEmptyStringSchema,
  amountCents: v.nullable(v.pipe(v.number(), v.integer(), v.minValue(0))),
  basis: NullableStringSchema,
  revision: v.pipe(v.number(), v.integer(), v.minValue(1)),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});

export const UpsertRemedyInputSchema = v.object({
  expectedRevision: v.pipe(v.number(), v.integer(), v.minValue(1)),
  remedyId: v.optional(IdSchema),
  type: RemedyRecordSchema.entries.type,
  description: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(5_000)),
  amountCents: v.optional(v.nullable(v.pipe(v.number(), v.integer(), v.minValue(0))), null),
  basis: v.optional(v.nullable(v.pipe(v.string(), v.trim(), v.maxLength(5_000))), null),
});

export const EvidenceRecordSchema = v.object({
  id: IdSchema,
  caseId: IdSchema,
  originalFilename: NonEmptyStringSchema,
  mimeType: NonEmptyStringSchema,
  storageKey: NonEmptyStringSchema,
  sha256: NonEmptyStringSchema,
  sizeBytes: v.pipe(v.number(), v.integer(), v.minValue(0)),
  documentType: NullableStringSchema,
  description: NullableStringSchema,
  relevantPages: v.array(v.pipe(v.number(), v.integer(), v.minValue(1))),
  pageCount: v.nullable(v.pipe(v.number(), v.integer(), v.minValue(1))),
  processingStatus: ProcessingStatusSchema,
  processingError: NullableStringSchema,
  uploadedAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});

export const ExtractionItemSchema = v.object({
  type: v.picklist(['DATE', 'AMOUNT', 'PARTY', 'STATEMENT', 'CONTRACT_TERM', 'ADDRESS', 'OTHER']),
  value: NonEmptyStringSchema,
  page: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1))),
  quote: v.optional(v.pipe(v.string(), v.maxLength(2_000))),
  location: v.optional(v.pipe(v.string(), v.maxLength(500))),
  confidence: v.optional(v.pipe(v.number(), v.minValue(0), v.maxValue(1))),
});

export const ExtractionOutputSchema = v.object({
  documentTitle: v.optional(v.nullable(v.pipe(v.string(), v.maxLength(500))), null),
  summary: v.pipe(v.string(), v.maxLength(10_000)),
  items: v.pipe(v.array(ExtractionItemSchema), v.maxLength(500)),
  pagesInspected: v.pipe(v.array(v.pipe(v.number(), v.integer(), v.minValue(1))), v.maxLength(500)),
  unreadablePages: v.pipe(v.array(v.pipe(v.number(), v.integer(), v.minValue(1))), v.maxLength(500)),
  possibleSensitiveContent: v.pipe(v.array(v.pipe(v.string(), v.maxLength(500))), v.maxLength(100)),
  promptLikeInstructionsObserved: v.pipe(v.array(v.pipe(v.string(), v.maxLength(500))), v.maxLength(100)),
  inspectionComplete: v.boolean(),
});

export const WarningRecordSchema = v.object({
  id: IdSchema,
  caseId: IdSchema,
  code: NonEmptyStringSchema,
  message: NonEmptyStringSchema,
  prominent: v.boolean(),
  status: WarningStatusSchema,
  fingerprint: NonEmptyStringSchema,
  createdRevision: v.pipe(v.number(), v.integer(), v.minValue(1)),
  acknowledgedRevision: v.nullable(v.pipe(v.number(), v.integer(), v.minValue(1))),
  acknowledgedAt: v.nullable(IsoDateTimeSchema),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});

export const AcknowledgeWarningInputSchema = v.object({
  expectedRevision: v.pipe(v.number(), v.integer(), v.minValue(1)),
  fingerprint: NonEmptyStringSchema,
  decision: v.literal('PROCEED_WITH_WARNING'),
});

export const QuestionRecordSchema = v.object({
  id: IdSchema,
  caseId: IdSchema,
  question: NonEmptyStringSchema,
  reason: NonEmptyStringSchema,
  relatedFactIds: v.array(IdSchema),
  priority: QuestionPrioritySchema,
  status: QuestionStatusSchema,
  answer: NullableStringSchema,
  revision: v.pipe(v.number(), v.integer(), v.minValue(1)),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});

export const ContradictionRecordSchema = v.object({
  id: IdSchema,
  caseId: IdSchema,
  description: NonEmptyStringSchema,
  factIds: v.array(IdSchema),
  evidenceIds: v.array(IdSchema),
  severity: ContradictionSeveritySchema,
  status: ContradictionStatusSchema,
  revision: v.pipe(v.number(), v.integer(), v.minValue(1)),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});

export const EligibilityCheckRecordSchema = v.object({
  id: IdSchema,
  caseId: IdSchema,
  code: NonEmptyStringSchema,
  result: CheckResultSchema,
  explanation: NonEmptyStringSchema,
  inputs: JsonObjectSchema,
  sourceUrl: NullableStringSchema,
  sourceVersion: NullableStringSchema,
  checkedAt: IsoDateTimeSchema,
  retrievalStatus: RetrievalStatusSchema,
});

export const SnapshotRecordSchema = v.object({
  id: IdSchema,
  caseId: IdSchema,
  caseRevision: v.pipe(v.number(), v.integer(), v.minValue(1)),
  displayName: NonEmptyStringSchema,
  basename: NonEmptyStringSchema,
  jsonPath: NonEmptyStringSchema,
  jsonSha256: NonEmptyStringSchema,
  pdfPath: NullableStringSchema,
  pdfSha256: NullableStringSchema,
  supersedesSnapshotId: NullableStringSchema,
  supersededBySnapshotId: NullableStringSchema,
  createdAt: IsoDateTimeSchema,
});

export type CaseRecord = v.InferOutput<typeof CaseRecordSchema>;
export type CreateCaseInput = v.InferOutput<typeof CreateCaseInputSchema>;
export type UpdateCaseInput = v.InferOutput<typeof UpdateCaseInputSchema>;
export type PartyRecord = v.InferOutput<typeof PartyRecordSchema>;
export type UpsertPartyInput = v.InferOutput<typeof UpsertPartyInputSchema>;
export type FactRecord = v.InferOutput<typeof FactRecordSchema>;
export type ProposeFactInput = v.InferOutput<typeof ProposeFactInputSchema>;
export type ReviewFactInput = v.InferOutput<typeof ReviewFactInputSchema>;
export type RemedyRecord = v.InferOutput<typeof RemedyRecordSchema>;
export type UpsertRemedyInput = v.InferOutput<typeof UpsertRemedyInputSchema>;
export type EvidenceRecord = v.InferOutput<typeof EvidenceRecordSchema>;
export type ExtractionOutput = v.InferOutput<typeof ExtractionOutputSchema>;
export type WarningRecord = v.InferOutput<typeof WarningRecordSchema>;
export type QuestionRecord = v.InferOutput<typeof QuestionRecordSchema>;
export type ContradictionRecord = v.InferOutput<typeof ContradictionRecordSchema>;
export type EligibilityCheckRecord = v.InferOutput<typeof EligibilityCheckRecordSchema>;
export type SnapshotRecord = v.InferOutput<typeof SnapshotRecordSchema>;
