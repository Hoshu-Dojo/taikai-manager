import { describe, it, expect } from 'vitest'
import { displayName, isValidUUID } from '../utils'

describe('displayName', () => {
  it('shows name only when no rank is set', () => {
    expect(displayName({ name: 'Alice', rank: undefined })).toBe('Alice')
  })
  it('shows name and rank when rank is set', () => {
    expect(displayName({ name: 'Bob', rank: '3D' })).toBe('Bob (3D)')
  })
})

describe('isValidUUID', () => {
  it('accepts a valid UUID', () => {
    expect(isValidUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true)
  })
  it('accepts uppercase UUIDs', () => {
    expect(isValidUUID('550E8400-E29B-41D4-A716-446655440000')).toBe(true)
  })
  it('rejects a string without hyphens', () => {
    expect(isValidUUID('550e8400e29b41d4a716446655440000')).toBe(false)
  })
  it('rejects an empty string', () => {
    expect(isValidUUID('')).toBe(false)
  })
  it('rejects a short string', () => {
    expect(isValidUUID('abc-def')).toBe(false)
  })
})
