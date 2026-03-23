export type TournamentFormat = "round_robin" | "pools_elimination" | "single_elimination";
export type TournamentStatus = "setup" | "pool_play" | "elimination" | "complete";

export interface Tournament {
  id: string;
  name: string;
  date: string; // ISO date string, e.g. "2026-03-22"
  status: TournamentStatus;
  format: TournamentFormat;
  tiebreakerMethod?: "rps" | "runoff";
  players: Player[];
  pools: Pool[];
  eliminationMatches: EliminationMatch[];
  createdAt: string;
  /** PBKDF2 hash of the organiser passcode. Never sent to clients. */
  passcodeHash?: string;
  /** Random salt for the PBKDF2 hash. Never sent to clients. */
  passcodeSalt?: string;
}

export interface Player {
  id: string;
  name: string;
  rank?: string;
  poolId: string | null;
}

export interface Pool {
  id: string;
  name: string; // "Pool A", "Pool B", etc.
  playerIds: string[];
  matches: Match[];
}

export interface Match {
  id: string;
  poolId: string;
  player1Id: string;
  player2Id: string;
  round: number;
  flagsPlayer1: number | null;
  flagsPlayer2: number | null;
  complete: boolean;
  isRunoff?: boolean; // true for run-off tiebreaker matches
}

export interface EliminationMatch {
  id: string; // e.g. "em_1"
  round: number; // 1 = first round, 2 = semis, 3 = final, etc.
  position: number; // 1-based slot within the round
  player1Id: string | null;
  player2Id: string | null;
  player1Source: string | null; // e.g. "pool:A:1", "match:em_3:winner", "bye"
  player2Source: string | null;
  flagsP1: number | null;
  flagsP2: number | null;
  winnerId: string | null;
  advancesToMatchId: string | null;
  advancesToSlot: 1 | 2 | null;
}
