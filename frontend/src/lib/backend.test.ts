import { describe, expect, it } from 'vitest'
import { frontendChecks, type BackendCaseState } from './backend'

const stateWith = (eligibilityChecks: BackendCaseState['eligibilityChecks']): BackendCaseState => ({
  case: { id: 'case_12345678', revision: 1, eligibilityStatus: 'UNVERIFIED', preparationStatus: 'NOT_READY', userReviewed: false },
  parties: [],
  remedies: [],
  facts: [],
  questions: [],
  eligibilityChecks,
  evidence: [],
  warnings: [],
  snapshots: [],
})

describe('frontendChecks', () => {
  it('maps backend eligibility results onto the four progress rows', () => {
    const checks = frontendChecks(stateWith([
      { code: 'AMOUNT_LIMIT', result: 'PASS', explanation: 'Amount passes.' },
      { code: 'TIME_LIMIT', result: 'FAIL', explanation: 'Date is too old.' },
      { code: 'RESPONDENT_LOCATION', result: 'UNVERIFIED', explanation: 'Location is unknown.' },
      { code: 'DISPUTE_CATEGORY', result: 'PASS', explanation: 'Category passes.' },
    ]))

    expect(checks.map((check) => [check.id, check.status])).toEqual([
      ['value', 'passed'],
      ['time', 'blocked'],
      ['location', 'pending'],
      ['category', 'passed'],
    ])
  })

  it('lets a category-specific failure override the general category pass', () => {
    const category = frontendChecks(stateWith([
      { code: 'DISPUTE_CATEGORY', result: 'PASS', explanation: 'Category is listed.' },
      { code: 'PROPERTY_DAMAGE_EXCLUSION', result: 'FAIL', explanation: 'A listed exclusion applies.' },
    ])).find((check) => check.id === 'category')

    expect(category).toMatchObject({ status: 'blocked', detail: 'A listed exclusion applies.' })
  })
})
