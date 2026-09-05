import { describe, expect, it } from 'vitest';
import { assessCase } from '../src/services/assessment.js';
import { createCase, makeStoreSync } from './helpers.js';

describe('SCT eligibility assessment', () => {
  it.each([
    [2_000_000, 'UNKNOWN', 'PASS'],
    [2_000_001, 'UNKNOWN', 'UNVERIFIED'],
    [3_000_000, 'YES', 'PASS'],
    [3_000_000, 'NO', 'FAIL'],
    [3_000_001, 'YES', 'FAIL'],
  ] as const)('applies the exact claim amount boundary at %d cents with consent %s',
    (claimAmountCents, consentStatus, expected) => {
      const { store } = makeStoreSync('assessment-amount');
      try {
        const record = createCase(store);
        const state = store.getCaseState(record.id);
        const result = assessCase({
          ...state,
          case: {
            ...state.case,
            category: 'SALE_OF_GOODS',
            categoryUserConfirmed: true,
            causeOfActionDate: '2025-01-01',
            causeOfActionDatePrecision: 'EXACT',
            claimAmountCents,
            consentStatus,
            respondentLocationStatus: 'SINGAPORE',
          },
        }, new Date('2026-01-01T00:00:00.000Z'));
        expect(result.eligibilityStatus).toBe(expected);
        expect(result.checks.find((check) => check.code === 'AMOUNT_LIMIT')?.result).toBe(expected);
      } finally {
        store.close();
      }
    });

  it('keeps an unknown date unverified and does not turn it into a failure', () => {
    const { store } = makeStoreSync('assessment-date');
    try {
      const record = createCase(store);
      const state = store.getCaseState(record.id);
      const result = assessCase({
        ...state,
        case: {
          ...state.case,
          category: 'SALE_OF_GOODS',
          categoryUserConfirmed: true,
          causeOfActionDate: null,
          causeOfActionDateOriginal: 'Around last summer',
          causeOfActionDatePrecision: 'APPROXIMATE',
          claimAmountCents: 1_000_000,
          respondentLocationStatus: 'SINGAPORE',
        },
      }, new Date('2026-01-01T00:00:00.000Z'));
      expect(result.checks.find((check) => check.code === 'TIME_LIMIT')?.result).toBe('UNVERIFIED');
      expect(result.eligibilityStatus).toBe('UNVERIFIED');
      expect(result.checks.find((check) => check.code === 'TIME_LIMIT')?.inputs).toMatchObject({
        originalWording: 'Around last summer',
        precision: 'APPROXIMATE',
      });
    } finally {
      store.close();
    }
  });

  it('rejects an employment intake represented by the generic category subtype', () => {
    const { store } = makeStoreSync('assessment-employment');
    try {
      const record = createCase(store);
      const state = store.getCaseState(record.id);
      const result = assessCase({
        ...state,
        case: {
          ...state.case,
          category: 'GENERIC',
          subtype: 'EMPLOYMENT',
          categoryUserConfirmed: true,
          causeOfActionDate: '2025-01-01',
          causeOfActionDatePrecision: 'EXACT',
          claimAmountCents: 100_000,
          respondentLocationStatus: 'SINGAPORE',
        },
      }, new Date('2026-01-01T00:00:00.000Z'));
      expect(result.eligibilityStatus).toBe('FAIL');
      expect(result.checks.find((check) => check.code === 'DISPUTE_CATEGORY')).toMatchObject({ result: 'FAIL' });
    } finally {
      store.close();
    }
  });

  it('uses a calendar-year boundary for the two-year filing period', () => {
    const { store } = makeStoreSync('assessment-two-years');
    try {
      const record = createCase(store);
      const state = store.getCaseState(record.id);
      const base = {
        ...state,
        case: {
          ...state.case,
          category: 'SALE_OF_GOODS' as const,
          categoryUserConfirmed: true,
          claimAmountCents: 1_000_000,
          respondentLocationStatus: 'SINGAPORE' as const,
        },
      };
      expect(assessCase({ ...base, case: { ...base.case, causeOfActionDate: '2024-01-01', causeOfActionDatePrecision: 'EXACT' } }, new Date('2026-01-01T00:00:00Z'))
        .checks.find((check) => check.code === 'TIME_LIMIT')?.result).toBe('PASS');
      expect(assessCase({ ...base, case: { ...base.case, causeOfActionDate: '2023-12-31', causeOfActionDatePrecision: 'EXACT' } }, new Date('2026-01-01T00:00:00Z'))
        .checks.find((check) => check.code === 'TIME_LIMIT')?.result).toBe('FAIL');
    } finally {
      store.close();
    }
  });

  it('treats a confirmed user fact as review-complete without calling it evidence-supported', () => {
    const { store } = makeStoreSync('assessment-review');
    try {
      const record = createCase(store);
      const fact = store.proposeFact(record.id, {
        expectedRevision: record.revision,
        statement: 'The claimant paid SGD 500 in cash.',
        structuredValue: null,
        sourceMessageId: null,
        sourceType: 'USER_ASSERTION',
        material: true,
      });
      const reviewed = store.reviewFact(record.id, fact.id, {
        expectedRevision: store.getCase(record.id).revision,
        action: 'CONFIRM',
      });
      expect(reviewed.reviewStatus).toBe('CONFIRMED');
      expect(reviewed.evidenceAssessment).toBe('UNASSESSED');
      const result = assessCase(store.getCaseState(record.id));
      expect(result.warnings.some((warning) => warning.code === `FACT_${fact.id}_UNREVIEWED`)).toBe(false);
      expect(result.warnings.some((warning) => warning.code === `FACT_${fact.id}_EVIDENCE`)).toBe(true);
    } finally {
      store.close();
    }
  });
});
