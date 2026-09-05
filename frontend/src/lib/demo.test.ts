import { describe, expect, it } from 'vitest'
import { demoChecks } from './demo'
import type { EligibilityAnswers } from './types'

const answers = (overrides: Partial<EligibilityAnswers> = {}): EligibilityAnswers => ({
  amount: '1000',
  eventDate: '2025-09-05',
  respondentInSingapore: 'yes',
  category: 'goods',
  consent: false,
  ...overrides,
})

const check = (result: ReturnType<typeof demoChecks>, id: string) => {
  const found = result.find((item) => item.id === id)
  if (!found) throw new Error(`Missing check: ${id}`)
  return found
}

describe('demoChecks', () => {
  const today = new Date('2026-09-05T12:00:00')

  it('blocks claims above $30,000', () => {
    expect(check(demoChecks(answers({ amount: '30000.01', consent: true }), today), 'value')).toMatchObject({
      status: 'blocked',
    })
  })

  it('requires consent above $20,000 and passes with consent', () => {
    expect(check(demoChecks(answers({ amount: '20000.01' }), today), 'value')).toMatchObject({
      status: 'blocked',
    })
    expect(check(demoChecks(answers({ amount: '20000.01', consent: true }), today), 'value')).toMatchObject({
      status: 'passed',
    })
  })

  it('accepts an event exactly two years before today but blocks an older event', () => {
    expect(check(demoChecks(answers({ eventDate: '2024-09-05' }), today), 'time')).toMatchObject({
      status: 'passed',
    })
    expect(check(demoChecks(answers({ eventDate: '2024-09-04' }), today), 'time')).toMatchObject({
      status: 'blocked',
    })
  })

  it('does not pass future or unknown inputs', () => {
    const result = demoChecks(
      answers({ eventDate: '2026-09-06', category: 'something-new' }),
      today,
    )
    expect(check(result, 'time').status).not.toBe('passed')
    expect(check(result, 'category').status).not.toBe('passed')
  })

  it.each(['vehicle', 'neighbour', 'employment'])('blocks excluded category %s', (category) => {
    expect(check(demoChecks(answers({ category }), today), 'category')).toMatchObject({
      status: 'blocked',
    })
  })
})
