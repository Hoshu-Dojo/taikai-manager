import { describe, it, expect } from 'vitest'
import { rankSeedValue, normalizeRank, RANK_VALUES } from '../ranks'

describe('rankSeedValue', () => {
  it('7D is the strongest seed (value 0)', () => {
    expect(rankSeedValue('7D')).toBe(0)
  })
  it('MK is the weakest ranked value', () => {
    expect(rankSeedValue('MK')).toBe(RANK_VALUES.length - 1)
  })
  it('undefined ranks sort last', () => {
    expect(rankSeedValue(undefined)).toBe(RANK_VALUES.length + 1)
  })
  it('unrecognised strings sort after MK', () => {
    expect(rankSeedValue('UNKNOWN')).toBe(RANK_VALUES.length)
  })
  it('stronger ranks have lower seed values than weaker ranks', () => {
    expect(rankSeedValue('7D')).toBeLessThan(rankSeedValue('1D'))
    expect(rankSeedValue('1D')).toBeLessThan(rankSeedValue('1K'))
    expect(rankSeedValue('1K')).toBeLessThan(rankSeedValue('MK'))
  })
})

describe('normalizeRank', () => {
  it('passes canonical rank strings through unchanged', () => {
    expect(normalizeRank('7D')).toBe('7D')
    expect(normalizeRank('1K')).toBe('1K')
    expect(normalizeRank('MK')).toBe('MK')
  })
  it('handles lowercase input', () => {
    expect(normalizeRank('3d')).toBe('3D')
    expect(normalizeRank('2k')).toBe('2K')
  })
  it('handles DAN suffix', () => {
    expect(normalizeRank('5DAN')).toBe('5D')
    expect(normalizeRank('2dan')).toBe('2D')
  })
  it('handles KYU suffix', () => {
    expect(normalizeRank('3KYU')).toBe('3K')
    expect(normalizeRank('1kyu')).toBe('1K')
  })
  it('handles mukyuu variants', () => {
    expect(normalizeRank('MUKYUU')).toBe('MK')
    expect(normalizeRank('無級')).toBe('MK')
    expect(normalizeRank('MUKYU')).toBe('MK')
  })
  it('returns undefined for unrecognised input', () => {
    expect(normalizeRank('SHODAN')).toBeUndefined()
    expect(normalizeRank('ABC')).toBeUndefined()
  })
})
