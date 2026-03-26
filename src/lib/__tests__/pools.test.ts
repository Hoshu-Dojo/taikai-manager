import { describe, it, expect } from 'vitest'
import { determineFormat, determinePoolCount, generatePoolSchedule, assignPools } from '../pools'
import type { Pool, Player } from '@/types'

function makePlayer(id: string): Player {
  return { id, name: id, poolId: null }
}

function makePool(playerIds: string[]): Pool {
  return { id: 'pool1', name: 'Pool', playerIds, matches: [] }
}

describe('determineFormat', () => {
  it('returns round_robin for 4 players', () => {
    expect(determineFormat(4)).toBe('round_robin')
  })
  it('returns round_robin for 5 players', () => {
    expect(determineFormat(5)).toBe('round_robin')
  })
  it('returns pools_elimination for 6 players', () => {
    expect(determineFormat(6)).toBe('pools_elimination')
  })
  it('returns pools_elimination for larger groups', () => {
    expect(determineFormat(10)).toBe('pools_elimination')
  })
})

describe('determinePoolCount', () => {
  it.each([
    [5, 1],
    [6, 2],
    [7, 2],
    [8, 2],
    [9, 3],
    [12, 4],
  ])('%i players → %i pools', (count, expected) => {
    expect(determinePoolCount(count)).toBe(expected)
  })
})

describe('generatePoolSchedule', () => {
  it('3 players → 3 matches, all pairs covered exactly once', () => {
    const pool = makePool(['A', 'B', 'C'])
    const players = ['A', 'B', 'C'].map(makePlayer)
    const matches = generatePoolSchedule(pool, players)

    expect(matches).toHaveLength(3)

    const pairs = matches.map(m => [m.player1Id, m.player2Id].sort().join('-')).sort()
    expect(pairs).toEqual(['A-B', 'A-C', 'B-C'])
  })

  it('4 players → 6 matches, all pairs covered exactly once', () => {
    const pool = makePool(['A', 'B', 'C', 'D'])
    const players = ['A', 'B', 'C', 'D'].map(makePlayer)
    const matches = generatePoolSchedule(pool, players)

    expect(matches).toHaveLength(6)

    const pairs = matches.map(m => [m.player1Id, m.player2Id].sort().join('-')).sort()
    expect(pairs).toEqual(['A-B', 'A-C', 'A-D', 'B-C', 'B-D', 'C-D'])
  })

  it('matches are initialised with null scores and complete=false', () => {
    const pool = makePool(['A', 'B', 'C'])
    const players = ['A', 'B', 'C'].map(makePlayer)
    const matches = generatePoolSchedule(pool, players)

    for (const m of matches) {
      expect(m.flagsPlayer1).toBeNull()
      expect(m.flagsPlayer2).toBeNull()
      expect(m.complete).toBe(false)
    }
  })
})

describe('assignPools', () => {
  it('assigns all players across pools', () => {
    const players = ['A', 'B', 'C', 'D', 'E', 'F'].map(makePlayer)
    const pools = assignPools(players)

    const allAssigned = pools.flatMap(p => p.playerIds)
    expect(allAssigned.sort()).toEqual(['A', 'B', 'C', 'D', 'E', 'F'])
  })

  it('6 players → 2 pools', () => {
    const players = ['A', 'B', 'C', 'D', 'E', 'F'].map(makePlayer)
    const pools = assignPools(players)
    expect(pools).toHaveLength(2)
  })

  it('no player appears in more than one pool', () => {
    const players = Array.from({ length: 9 }, (_, i) => makePlayer(`P${i}`))
    const pools = assignPools(players)
    const allIds = pools.flatMap(p => p.playerIds)
    expect(new Set(allIds).size).toBe(allIds.length)
  })
})
