import { describe, it, expect } from 'vitest'
import { computeStandings, detectCircularTie } from '../standings'
import type { Pool, Player, Match } from '@/types'

const TOURNAMENT_ID = 'test-tournament'

function makePlayer(id: string): Player {
  return { id, name: id, poolId: 'pool1' }
}

function completedMatch(id: string, p1: string, p2: string, f1: number, f2: number, isRunoff = false): Match {
  return {
    id,
    poolId: 'pool1',
    player1Id: p1,
    player2Id: p2,
    round: 1,
    flagsPlayer1: f1,
    flagsPlayer2: f2,
    complete: true,
    isRunoff,
  }
}

function incompleteMatch(id: string, p1: string, p2: string): Match {
  return {
    id,
    poolId: 'pool1',
    player1Id: p1,
    player2Id: p2,
    round: 1,
    flagsPlayer1: null,
    flagsPlayer2: null,
    complete: false,
  }
}

// A circular 3-way tie: A beats B, B beats C, C beats A — all 2-1
// Each player ends up with 3 total flags, equal H2H
const circularPool: Pool = {
  id: 'pool1',
  name: 'Pool',
  playerIds: ['A', 'B', 'C'],
  matches: [
    completedMatch('m1', 'A', 'B', 2, 1), // A:2, B:1
    completedMatch('m2', 'B', 'C', 2, 1), // B:2, C:1
    completedMatch('m3', 'C', 'A', 2, 1), // C:2, A:1  → totals A:3, B:3, C:3
  ],
}

const ABC = ['A', 'B', 'C'].map(makePlayer)

describe('computeStandings', () => {
  it('ranks players by total flags when there is no tie', () => {
    // A:6, B:2, C:1 — clear winner
    const pool: Pool = {
      id: 'pool1',
      name: 'Pool',
      playerIds: ['A', 'B', 'C'],
      matches: [
        completedMatch('m1', 'A', 'B', 3, 0), // A:3, B:0
        completedMatch('m2', 'A', 'C', 3, 0), // A:3, C:0
        completedMatch('m3', 'B', 'C', 2, 1), // B:2, C:1
      ],
    }
    const standings = computeStandings(pool, ABC, TOURNAMENT_ID)

    expect(standings.map(r => r.playerId)).toEqual(['A', 'B', 'C'])
    expect(standings[0].flags).toBe(6)
    expect(standings[1].flags).toBe(2)
    expect(standings[2].flags).toBe(1)
  })

  it('computes stats correctly (flags, wins, matchesPlayed, flagDifferential)', () => {
    const pool: Pool = {
      id: 'pool1',
      name: 'Pool',
      playerIds: ['A', 'B', 'C'],
      matches: [
        completedMatch('m1', 'A', 'B', 3, 0),
        completedMatch('m2', 'A', 'C', 3, 0),
        completedMatch('m3', 'B', 'C', 2, 1),
      ],
    }
    const standings = computeStandings(pool, ABC, TOURNAMENT_ID)
    const a = standings.find(r => r.playerId === 'A')!

    expect(a.flags).toBe(6)
    expect(a.wins).toBe(2)
    expect(a.matchesPlayed).toBe(2)
    expect(a.flagDifferential).toBe(6) // 6 scored, 0 conceded
  })

  it('breaks a 2-way tie using head-to-head flags', () => {
    // A:4, B:4, C:1 — A and B tied; A beat B 2-1 so A wins H2H
    const pool: Pool = {
      id: 'pool1',
      name: 'Pool',
      playerIds: ['A', 'B', 'C'],
      matches: [
        completedMatch('m1', 'A', 'B', 2, 1), // A:2, B:1
        completedMatch('m2', 'A', 'C', 2, 1), // A:2, C:1  → A total: 4
        completedMatch('m3', 'B', 'C', 3, 0), // B:3, C:0  → B total: 4, C total: 1
      ],
    }
    const standings = computeStandings(pool, ABC, TOURNAMENT_ID)

    expect(standings.map(r => r.playerId)).toEqual(['A', 'B', 'C'])
  })

  it('resolves a 3-way circular tie using run-off results', () => {
    // Regular matches: A:3, B:3, C:3 (circular H2H)
    // Run-off: A beats B and C convincingly → A:5 flags, B:4, C:0
    const pool: Pool = {
      id: 'pool1',
      name: 'Pool',
      playerIds: ['A', 'B', 'C'],
      matches: [
        completedMatch('m1', 'A', 'B', 2, 1),
        completedMatch('m2', 'B', 'C', 2, 1),
        completedMatch('m3', 'C', 'A', 2, 1),
        completedMatch('r1', 'A', 'B', 2, 1, true), // run-off: A:2
        completedMatch('r2', 'A', 'C', 3, 0, true), // run-off: A:3 → A total: 5
        completedMatch('r3', 'B', 'C', 3, 0, true), // run-off: B:3 → B total: 4, C: 0
      ],
    }
    const standings = computeStandings(pool, ABC, TOURNAMENT_ID)

    expect(standings.map(r => r.playerId)).toEqual(['A', 'B', 'C'])
  })
})

describe('detectCircularTie', () => {
  it('returns null when regular matches are not all complete', () => {
    const pool: Pool = {
      id: 'pool1',
      name: 'Pool',
      playerIds: ['A', 'B', 'C'],
      matches: [
        completedMatch('m1', 'A', 'B', 2, 1),
        completedMatch('m2', 'B', 'C', 2, 1),
        incompleteMatch('m3', 'C', 'A'),
      ],
    }
    expect(detectCircularTie(pool, TOURNAMENT_ID)).toBeNull()
  })

  it('returns null when there is no tie', () => {
    const pool: Pool = {
      id: 'pool1',
      name: 'Pool',
      playerIds: ['A', 'B', 'C'],
      matches: [
        completedMatch('m1', 'A', 'B', 3, 0), // A clearly dominates
        completedMatch('m2', 'A', 'C', 3, 0),
        completedMatch('m3', 'B', 'C', 2, 1),
      ],
    }
    expect(detectCircularTie(pool, TOURNAMENT_ID)).toBeNull()
  })

  it('returns null when two players are tied but not three', () => {
    const pool: Pool = {
      id: 'pool1',
      name: 'Pool',
      playerIds: ['A', 'B', 'C'],
      matches: [
        completedMatch('m1', 'A', 'B', 2, 1), // A:2, B:1
        completedMatch('m2', 'A', 'C', 2, 1), // A:2, C:1  → A:4
        completedMatch('m3', 'B', 'C', 3, 0), // B:3, C:0  → B:4, C:1
      ],
    }
    // A and B tied at 4 — but H2H resolves it (not a circular tie)
    expect(detectCircularTie(pool, TOURNAMENT_ID)).toBeNull()
  })

  it('returns the tied player IDs when a circular 3-way tie exists', () => {
    const result = detectCircularTie(circularPool, TOURNAMENT_ID)
    expect(result).not.toBeNull()
    expect(result!.sort()).toEqual(['A', 'B', 'C'])
  })

  it('returns null after a run-off resolves the circular tie', () => {
    const pool: Pool = {
      ...circularPool,
      matches: [
        ...circularPool.matches,
        completedMatch('r1', 'A', 'B', 2, 1, true), // A:2
        completedMatch('r2', 'A', 'C', 3, 0, true), // A:3 → A total: 5
        completedMatch('r3', 'B', 'C', 3, 0, true), // B:3 → B total: 4, C: 0
      ],
    }
    expect(detectCircularTie(pool, TOURNAMENT_ID)).toBeNull()
  })

  it('returns the group again if the run-off is itself circular', () => {
    const pool: Pool = {
      ...circularPool,
      matches: [
        ...circularPool.matches,
        // Run-off also circular: A beats B, B beats C, C beats A
        completedMatch('r1', 'A', 'B', 2, 1, true),
        completedMatch('r2', 'B', 'C', 2, 1, true),
        completedMatch('r3', 'C', 'A', 2, 1, true),
      ],
    }
    const result = detectCircularTie(pool, TOURNAMENT_ID)
    expect(result).not.toBeNull()
    expect(result!.sort()).toEqual(['A', 'B', 'C'])
  })
})
