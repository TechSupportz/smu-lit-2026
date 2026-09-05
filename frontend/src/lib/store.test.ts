import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { EligibilityCheck } from './types'

const storage = new Map<string, string>()

vi.stubGlobal('localStorage', {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
  removeItem: (key: string) => storage.delete(key),
  clear: () => storage.clear(),
})

describe('useCase navigation gates', async () => {
  const { useCase } = await import('./store')

  beforeEach(() => {
    storage.clear()
    useCase.getState().reset()
  })

  const passedChecks = (): EligibilityCheck[] =>
    useCase.getState().checks.map((check) => ({ ...check, status: 'passed' }))

  it('cannot bypass eligibility or the external checklist gates', () => {
    useCase.getState().go('filing')
    expect(useCase.getState().stage).toBe('eligibility')

    useCase.getState().setChecks(passedChecks())
    useCase.getState().go('filing')
    expect(useCase.getState().stage).toBe('filing')

    useCase.getState().go('preparation')
    expect(useCase.getState().stage).toBe('checkpoint')

    for (const id of ['filed', 'served', 'declaration']) useCase.getState().toggleItem(id)
    useCase.getState().go('preparation')
    expect(useCase.getState().stage).toBe('preparation')
  })

  it('requires all three checklist ids before completion', () => {
    useCase.getState().setChecks(passedChecks())
    useCase.getState().go('complete')
    expect(useCase.getState().stage).toBe('checkpoint')

    useCase.getState().toggleItem('filed')
    useCase.getState().toggleItem('served')
    useCase.getState().go('complete')
    expect(useCase.getState().stage).toBe('checkpoint')

    useCase.getState().toggleItem('declaration')
    useCase.getState().go('complete')
    expect(useCase.getState().stage).toBe('complete')
  })

  it('resumes filing before a PDF exists and invalidates a changed landing category', () => {
    useCase.getState().setChecks(passedChecks())
    useCase.getState().resume()
    expect(useCase.getState().stage).toBe('filing')
    useCase.getState().start('employment')
    expect(useCase.getState().checks.every(check => check.status === 'pending')).toBe(true)
    useCase.getState().go('filing')
    expect(useCase.getState().stage).toBe('eligibility')
  })

  it('invalidates checks and checklist when answers change', () => {
    useCase.getState().setChecks(passedChecks())
    for (const id of ['filed', 'served', 'declaration']) useCase.getState().toggleItem(id)

    useCase.getState().setAnswers({ amount: '2500' })

    expect(useCase.getState().checks.every((check) => check.status === 'pending')).toBe(true)
    expect(useCase.getState().checklist).toEqual([])
  })
})
