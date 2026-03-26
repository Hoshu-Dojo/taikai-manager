import { describe, it, expect } from 'vitest'
import { roundLabel, generateSimpleBracket } from '../bracket'
import type { Player } from '@/types'

function makePlayer(id: string, rank?: string): Player {
  return { id, name: id, rank, poolId: null }
}

const TOURNAMENT_ID = 'test-tournament'

describe('roundLabel', () => {
  it('returns "Final" for the last round', () => {
    expect(roundLabel(1, 1)).toBe('Final')
    expect(roundLabel(3, 3)).toBe('Final')
  })
  it('returns "Semifinal" for one round before the final', () => {
    expect(roundLabel(1, 2)).toBe('Semifinal')
    expect(roundLabel(2, 3)).toBe('Semifinal')
  })
  it('returns "Quarterfinal" for two rounds before the final', () => {
    expect(roundLabel(1, 3)).toBe('Quarterfinal')
    expect(roundLabel(2, 4)).toBe('Quarterfinal')
  })
  it('returns "Round N" for earlier rounds', () => {
    expect(roundLabel(1, 4)).toBe('Round 1')
    expect(roundLabel(2, 5)).toBe('Round 2')
  })
})

describe('generateSimpleBracket', () => {
  it('2 players → 1 match with both players assigned', () => {
    const players = [makePlayer('P1', '3D'), makePlayer('P2', '1K')]
    const matches = generateSimpleBracket(players, TOURNAMENT_ID)
    expect(matches).toHaveLength(1)
    expect(matches[0].player1Id).not.toBeNull()
    expect(matches[0].player2Id).not.toBeNull()
  })

  it('4 players → 3 matches total', () => {
    const players = [
      makePlayer('P1', '3D'),
      makePlayer('P2', '2D'),
      makePlayer('P3', '1K'),
      makePlayer('P4', '2K'),
    ]
    const matches = generateSimpleBracket(players, TOURNAMENT_ID)
    expect(matches).toHaveLength(3)
  })

  it('4 players → no byes in round 1', () => {
    const players = [
      makePlayer('P1', '3D'),
      makePlayer('P2', '2D'),
      makePlayer('P3', '1K'),
      makePlayer('P4', '2K'),
    ]
    const matches = generateSimpleBracket(players, TOURNAMENT_ID)
    const round1 = matches.filter(m => m.round === 1)
    for (const m of round1) {
      expect(m.player1Id).not.toBeNull()
      expect(m.player2Id).not.toBeNull()
      expect(m.winnerId).toBeNull()
    }
  })

  it('3 players → highest seed gets a bye and auto-advances', () => {
    const players = [
      makePlayer('P1', '3D'), // strongest
      makePlayer('P2', '2D'),
      makePlayer('P3', '1K'),
    ]
    const matches = generateSimpleBracket(players, TOURNAMENT_ID)
    // Bracket rounds up to 4 slots → 3 matches total
    expect(matches).toHaveLength(3)
    // Exactly one first-round match should be a bye (winnerId already set)
    const round1 = matches.filter(m => m.round === 1)
    const byeMatches = round1.filter(m => m.winnerId !== null)
    expect(byeMatches).toHaveLength(1)
  })

  it('all players appear in the bracket', () => {
    const players = [
      makePlayer('P_weak', '1K'),
      makePlayer('P_strong', '3D'),
      makePlayer('P_mid', '2D'),
    ]
    const matches = generateSimpleBracket(players, TOURNAMENT_ID)
    const allPlayerIds = matches.flatMap(m => [m.player1Id, m.player2Id]).filter(Boolean)
    expect(allPlayerIds).toContain('P_strong')
    expect(allPlayerIds).toContain('P_mid')
    expect(allPlayerIds).toContain('P_weak')
  })
})
