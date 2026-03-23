"use client";

import { useState, useCallback } from "react";
import { Tournament, Pool, Match, EliminationMatch } from "@/types";
import { computeStandings, computeWinReason, StandingRow } from "@/lib/standings";
import { roundLabel } from "@/lib/bracket";
import { displayName } from "@/lib/utils";

// ─── Flag pips ────────────────────────────────────────────────────────────────

function FlagPips({ count }: { count: number }) {
  return (
    <span className="inline-flex gap-0.5 flex-wrap justify-end">
      {Array.from({ length: count }).map((_, i) => (
        <span key={i} className="text-red-500" style={{ fontSize: 10, lineHeight: 1 }}>▲</span>
      ))}
    </span>
  );
}

// ─── Pool match score entry ───────────────────────────────────────────────────

type ScoreOption = { label: string; p1: number; p2: number };

function scoreOptions(p1Name: string, p2Name: string): ScoreOption[] {
  return [
    { label: `${p1Name} wins 3–0`, p1: 3, p2: 0 },
    { label: `${p1Name} wins 2–1`, p1: 2, p2: 1 },
    { label: `${p2Name} wins 2–1`, p1: 1, p2: 2 },
    { label: `${p2Name} wins 3–0`, p1: 0, p2: 3 },
  ];
}

function MatchCard({
  match,
  tournamentId,
  players,
  onUpdate,
  matchNumber,
}: {
  match: Match;
  tournamentId: string;
  players: Tournament["players"];
  onUpdate: (updated: Tournament) => void;
  matchNumber?: number;
}) {
  const [editing, setEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const p1 = players.find((p) => p.id === match.player1Id)!;
  const p2 = players.find((p) => p.id === match.player2Id)!;
  const options = scoreOptions(displayName(p1), displayName(p2));

  async function submitScore(opt: ScoreOption) {
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(
        `/api/tournaments/${tournamentId}/matches/${match.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ flagsPlayer1: opt.p1, flagsPlayer2: opt.p2 }),
        }
      );
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Something went wrong.");
        setSubmitting(false);
        return;
      }
      const updated: Tournament = await res.json();
      setSubmitting(false);
      setEditing(false);
      onUpdate(updated);
    } catch {
      setError("Could not reach server.");
      setSubmitting(false);
    }
  }

  const winner =
    match.complete && match.flagsPlayer1 !== null && match.flagsPlayer2 !== null
      ? match.flagsPlayer1 > match.flagsPlayer2
        ? displayName(p1)
        : displayName(p2)
      : null;

  const showOptions = !match.complete || editing;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          {matchNumber && (
            <span className="block text-xs text-gray-500 mb-0.5">#{matchNumber}</span>
          )}
          <span className="text-gray-800 font-medium text-base">
            {displayName(p1)} <span className="text-gray-600 font-normal">vs</span> {displayName(p2)}
          </span>
        </div>
        {match.complete && (
          <span className="text-sm font-semibold text-green-600 whitespace-nowrap mt-0.5">
            {match.flagsPlayer1}–{match.flagsPlayer2}
          </span>
        )}
      </div>

      {match.complete && winner && !editing && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">{winner} wins</span>
          <button
            onClick={() => { setEditing(true); setError(""); }}
            className="text-xs hover:underline" style={{ color: "var(--hd-accent)" }}
          >
            Edit
          </button>
        </div>
      )}

      {showOptions && (
        <div className="space-y-1">
          {options.map((opt) => (
            <button
              key={opt.label}
              disabled={submitting}
              onClick={() => submitScore(opt)}
              className="w-full text-left px-4 py-4 rounded-xl border border-gray-200 text-gray-800 text-base font-medium transition-colors disabled:opacity-50 hover:border-[#4242C3] hover:bg-[#4242C3]/10 active:bg-[#4242C3]/20"
            >
              {opt.label}
            </button>
          ))}
          {editing && (
            <button
              disabled={submitting}
              onClick={() => { setEditing(false); setError(""); }}
              className="w-full text-sm text-gray-400 hover:text-gray-600 py-2"
            >
              Cancel
            </button>
          )}
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
      )}
    </div>
  );
}

// ─── Pool section ─────────────────────────────────────────────────────────────

function rankLabel(rank: number, format: Tournament["format"]) {
  if (rank !== 0) return null;
  return format === "round_robin" ? "Winner" : "Advances";
}

function PoolSection({
  pool,
  tournament,
  onUpdate,
}: {
  pool: Pool;
  tournament: Tournament;
  onUpdate: (updated: Tournament) => void;
}) {
  const standings: StandingRow[] = computeStandings(
    pool,
    tournament.players,
    tournament.id
  );
  const winReason = computeWinReason(pool, tournament.players, tournament.id);

  const rounds = new Map<number, Match[]>();
  for (const match of pool.matches) {
    const list = rounds.get(match.round) ?? [];
    list.push(match);
    rounds.set(match.round, list);
  }
  const roundNumbers = [...rounds.keys()].sort((a, b) => a - b);

  const completed = pool.matches.filter((m) => m.complete).length;
  const poolComplete = completed === pool.matches.length;

  // Sequential match numbers across all rounds in this pool
  let matchNum = 0;
  const matchNumbers = new Map<string, number>();
  for (const round of roundNumbers) {
    for (const match of rounds.get(round)!) {
      matchNumbers.set(match.id, ++matchNum);
    }
  }

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-sans font-bold" style={{ color: "var(--hd-inverse-text)" }}>{pool.name}</h2>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Standings — {completed}/{pool.matches.length} matches complete
          </h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 text-xs border-b border-gray-100">
              <th className="px-5 py-2">#</th>
              <th className="px-5 py-2">Player</th>
              <th className="px-5 py-2 text-right">Flags</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((row, i) => {
              const label = rankLabel(i, tournament.format);
              return (
                <tr key={row.playerId} className="border-b border-gray-50 last:border-0">
                  <td className="px-5 py-3 text-gray-600">{i + 1}</td>
                  <td className="px-5 py-3 font-medium text-gray-800">
                    <span className="flex items-center gap-2">
                      {row.playerName}
                      {label && poolComplete && (
                        <span className="text-xs font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                          {label}
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <FlagPips count={row.flags} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {poolComplete && standings.length > 0 && (
          <p className="px-5 py-2 text-xs text-gray-600 border-t border-gray-100">
            {standings[0].playerName} advances — {winReason}
          </p>
        )}
      </div>

      {roundNumbers.map((round) => (
        <div key={round} className="space-y-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--hd-inverse-text)" }}>
            Round {round}
          </h3>
          <div className={`grid gap-3 ${rounds.get(round)!.length <= 1 ? "grid-cols-1" : rounds.get(round)!.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
            {rounds.get(round)!.map((match) => (
              <MatchCard
                key={match.id}
                match={match}
                tournamentId={tournament.id}
                players={tournament.players}
                onUpdate={onUpdate}
                matchNumber={matchNumbers.get(match.id)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Elimination bracket ──────────────────────────────────────────────────────

type EliminationScoreOption = { label: string; p1: number; p2: number };

function eliminationScoreOptions(
  p1Name: string,
  p2Name: string
): EliminationScoreOption[] {
  return [
    { label: `${p1Name} wins 3–0`, p1: 3, p2: 0 },
    { label: `${p1Name} wins 2–1`, p1: 2, p2: 1 },
    { label: `${p2Name} wins 2–1`, p1: 1, p2: 2 },
    { label: `${p2Name} wins 3–0`, p1: 0, p2: 3 },
  ];
}

function EliminationMatchCard({
  match,
  tournamentId,
  players,
  onUpdate,
  readOnly,
  matchNumber,
}: {
  match: EliminationMatch;
  tournamentId: string;
  players: Tournament["players"];
  onUpdate: (updated: Tournament) => void;
  readOnly?: boolean;
  matchNumber?: number;
}) {
  const [editing, setEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const p1 = match.player1Id ? players.find((p) => p.id === match.player1Id) : null;
  const p2 = match.player2Id ? players.find((p) => p.id === match.player2Id) : null;

  const isBye =
    match.player1Source === "bye" || match.player2Source === "bye";
  const isScored = match.flagsP1 !== null && match.flagsP2 !== null;
  const winnerPlayer = match.winnerId ? players.find((p) => p.id === match.winnerId) : null;
  const winnerName = winnerPlayer ? displayName(winnerPlayer) : null;

  async function submitScore(opt: EliminationScoreOption) {
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(
        `/api/tournaments/${tournamentId}/elimination/${match.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ flagsP1: opt.p1, flagsP2: opt.p2 }),
        }
      );
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Something went wrong.");
        setSubmitting(false);
        return;
      }
      const updated: Tournament = await res.json();
      setSubmitting(false);
      setEditing(false);
      onUpdate(updated);
    } catch {
      setError("Could not reach server.");
      setSubmitting(false);
    }
  }

  const p1Display = p1 ? displayName(p1) : (match.player1Source === "bye" ? "Bye" : "TBD");
  const p2Display = p2 ? displayName(p2) : (match.player2Source === "bye" ? "Bye" : "TBD");

  const showOptions = !readOnly && !isBye && p1 && p2 && (!isScored || editing);

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          {matchNumber && (
            <span className="block text-xs text-gray-500 mb-0.5">#{matchNumber}</span>
          )}
          <span className="text-gray-800 font-medium text-base">
            <span className={match.winnerId === match.player1Id && isScored ? "font-bold" : ""}>
              {p1Display}
            </span>
            <span className="text-gray-600 font-normal"> vs </span>
            <span className={match.winnerId === match.player2Id && isScored ? "font-bold" : ""}>
              {p2Display}
            </span>
          </span>
        </div>
        {isScored && (
          <span className="text-sm font-semibold text-green-600 whitespace-nowrap mt-0.5">
            {match.flagsP1}–{match.flagsP2}
          </span>
        )}
      </div>

      {isBye && (
        <p className="text-xs text-gray-400">{winnerName} advances (bye)</p>
      )}

      {!isBye && !isScored && !p1 && !p2 && (
        <p className="text-xs text-gray-400">Waiting for previous results…</p>
      )}

      {!isBye && isScored && !editing && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">{winnerName} wins</span>
          {!readOnly && (
            <button
              onClick={() => { setEditing(true); setError(""); }}
              className="text-xs hover:underline" style={{ color: "var(--hd-accent)" }}
            >
              Edit
            </button>
          )}
        </div>
      )}

      {showOptions && (
        <div className="space-y-1">
          {eliminationScoreOptions(displayName(p1), displayName(p2)).map((opt) => (
            <button
              key={opt.label}
              disabled={submitting}
              onClick={() => submitScore(opt)}
              className="w-full text-left px-4 py-4 rounded-xl border border-gray-200 text-gray-800 text-base font-medium transition-colors disabled:opacity-50 hover:border-[#4242C3] hover:bg-[#4242C3]/10 active:bg-[#4242C3]/20"
            >
              {opt.label}
            </button>
          ))}
          {editing && (
            <button
              disabled={submitting}
              onClick={() => { setEditing(false); setError(""); }}
              className="w-full text-sm text-gray-400 hover:text-gray-600 py-2"
            >
              Cancel
            </button>
          )}
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
      )}
    </div>
  );
}

function BracketSection({
  tournament,
  onUpdate,
  readOnly,
}: {
  tournament: Tournament;
  onUpdate: (updated: Tournament) => void;
  readOnly?: boolean;
}) {
  const matches = tournament.eliminationMatches;
  if (matches.length === 0) return null;

  const maxRound = Math.max(...matches.map((m) => m.round));
  const firstRoundCount = matches.filter((m) => m.round === 1).length;
  // Each match box is ~80px tall; total bracket height for consistent alignment
  const MATCH_H = 88;
  const containerH = firstRoundCount * MATCH_H;

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-sans font-bold" style={{ color: "var(--hd-inverse-text)" }}>Elimination Bracket</h2>
      <div className="overflow-x-auto pb-2">
        <div className="flex gap-4 min-w-max w-full">
          {Array.from({ length: maxRound }, (_, ri) => ri + 1).map((round) => {
            const roundMatches = matches
              .filter((m) => m.round === round)
              .sort((a, b) => a.position - b.position);
            const label = roundLabel(round, maxRound);

            return (
              <div key={round} className="flex flex-col flex-1 min-w-[200px]">
                <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: "var(--hd-inverse-text)" }}>
                  {label}
                </p>
                <div
                  className="flex flex-col"
                  style={{
                    height: containerH,
                    justifyContent: "space-around",
                  }}
                >
                  {roundMatches.map((match) => (
                    <EliminationMatchCard
                      key={match.id}
                      match={match}
                      tournamentId={tournament.id}
                      players={tournament.players}
                      onUpdate={onUpdate}
                      readOnly={readOnly}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Final report ─────────────────────────────────────────────────────────────

function FinalReport({ tournament }: { tournament: Tournament }) {
  const finalMatch = tournament.eliminationMatches.find(
    (m) => !m.advancesToMatchId
  );

  // Champion: winner of the final (bracket) or top of pool (round_robin)
  const champion = (() => {
    if (finalMatch?.winnerId) {
      return tournament.players.find((p) => p.id === finalMatch.winnerId) ?? null;
    }
    if (tournament.format === "round_robin" && tournament.pools.length > 0) {
      const standings = computeStandings(tournament.pools[0], tournament.players, tournament.id);
      return tournament.players.find((p) => p.id === standings[0]?.playerId) ?? null;
    }
    return null;
  })();

  // Champion rationale line
  const championRationale = (() => {
    if (finalMatch?.winnerId && finalMatch.flagsP1 !== null) {
      const opponent = tournament.players.find(
        (p) => p.id === (finalMatch.winnerId === finalMatch.player1Id ? finalMatch.player2Id : finalMatch.player1Id)
      );
      const winnerFlags = finalMatch.winnerId === finalMatch.player1Id ? finalMatch.flagsP1 : finalMatch.flagsP2;
      const loserFlags  = finalMatch.winnerId === finalMatch.player1Id ? finalMatch.flagsP2 : finalMatch.flagsP1;
      return `Won the final ${winnerFlags}–${loserFlags} against ${opponent ? displayName(opponent) : "?"}`;
    }
    if (tournament.format === "round_robin" && tournament.pools.length > 0) {
      return computeWinReason(tournament.pools[0], tournament.players, tournament.id);
    }
    return null;
  })();

  const roundCount = tournament.eliminationMatches.length > 0
    ? Math.max(...tournament.eliminationMatches.map((m) => m.round))
    : 0;

  return (
    <div className="space-y-6 print:space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <h2 className="text-xl font-sans font-bold" style={{ color: "var(--hd-inverse-text)" }}>Final Report</h2>
        <button
          onClick={() => window.print()}
          className="text-sm hover:underline" style={{ color: "var(--hd-accent-secondary)" }}
        >
          Print ↗
        </button>
      </div>
      {/* Report title shown only when printing */}
      <div className="hidden print:block">
        <h2 className="text-xl font-bold text-gray-800">{tournament.name} — Final Report</h2>
        <p className="text-sm text-gray-500">{tournament.date}</p>
      </div>

      {champion && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-5 py-4 text-center">
          <p className="text-xs font-semibold text-yellow-700 uppercase tracking-wide mb-1">
            Champion
          </p>
          <p className="text-2xl font-bold text-yellow-900">{displayName(champion)}</p>
          {championRationale && (
            <p className="text-sm text-yellow-700 mt-1">{championRationale}</p>
          )}
        </div>
      )}

      {/* Pool results */}
      {tournament.pools.map((pool) => {
        const standings = computeStandings(pool, tournament.players, tournament.id);
        const winReason = computeWinReason(pool, tournament.players, tournament.id);
        return (
          <div key={pool.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                {pool.name} — Final Standings
              </h3>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 text-xs border-b border-gray-100">
                  <th className="px-5 py-2">#</th>
                  <th className="px-5 py-2">Player</th>
                  <th className="px-5 py-2 text-right">Flags</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((row, i) => (
                  <tr key={row.playerId} className="border-b border-gray-50 last:border-0">
                    <td className="px-5 py-3 text-gray-600">{i + 1}</td>
                    <td className="px-5 py-3 font-medium text-gray-800">{row.playerName}</td>
                    <td className="px-5 py-3 text-right text-gray-700">{row.flags}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {standings.length > 0 && (
              <p className="px-5 py-2 text-xs text-gray-600 border-t border-gray-50">
                {standings[0].playerName} advances — {winReason}
              </p>
            )}
          </div>
        );
      })}

      {/* Bracket results */}
      {tournament.eliminationMatches.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Bracket Results
            </h3>
          </div>
          <div className="divide-y divide-gray-50">
            {Array.from({ length: roundCount }, (_, ri) => ri + 1)
              .reverse()
              .map((round) => {
                const roundMatches = tournament.eliminationMatches
                  .filter((m) => m.round === round)
                  .sort((a, b) => a.position - b.position);
                const label = roundLabel(round, roundCount);
                return (
                  <div key={round}>
                    <p className="px-5 py-2 text-xs font-semibold text-gray-600 uppercase tracking-wide bg-gray-50">
                      {label}
                    </p>
                    {roundMatches
                      .filter((m) => m.player1Source !== "bye" && m.player2Source !== "bye")
                      .map((match) => {
                        const p1 = tournament.players.find((p) => p.id === match.player1Id);
                        const p2 = tournament.players.find((p) => p.id === match.player2Id);
                        const winner = tournament.players.find((p) => p.id === match.winnerId);
                        const loser  = match.winnerId === match.player1Id ? p2 : p1;
                        const winnerFlags = match.winnerId === match.player1Id ? match.flagsP1 : match.flagsP2;
                        const loserFlags  = match.winnerId === match.player1Id ? match.flagsP2 : match.flagsP1;
                        return (
                          <div key={match.id} className="px-5 py-3 flex items-center justify-between text-sm">
                            <span className="text-gray-800">
                              {p1 ? displayName(p1) : "?"} vs {p2 ? displayName(p2) : "?"}
                            </span>
                            <span className="text-gray-600 text-xs">
                              {match.flagsP1 !== null
                                ? `${winner ? displayName(winner) : "?"} won ${winnerFlags}–${loserFlags} against ${loser ? displayName(loser) : "?"}`
                                : "—"}
                            </span>
                          </div>
                        );
                      })}
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Generate bracket button ──────────────────────────────────────────────────

function GenerateBracketButton({
  tournament,
  onUpdate,
}: {
  tournament: Tournament;
  onUpdate: (updated: Tournament) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function generate() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `/api/tournaments/${tournament.id}/generate-bracket`,
        { method: "POST" }
      );
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Something went wrong.");
        setLoading(false);
        return;
      }
      const updated: Tournament = await res.json();
      onUpdate(updated);
    } catch {
      setError("Could not reach server.");
      setLoading(false);
    }
  }

  return (
    <div className="bg-green-50 border border-green-200 rounded-xl px-5 py-4 space-y-3">
      <p className="text-sm font-semibold text-green-800">
        All pool play is complete. Ready to generate the elimination bracket.
      </p>
      <button
        disabled={loading}
        onClick={generate}
        className="w-full bg-green-700 hover:bg-green-800 text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-50"
      >
        {loading ? "Generating…" : "Generate Elimination Bracket"}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

// ─── Main client component ────────────────────────────────────────────────────

export default function ManageClient({
  initialTournament,
}: {
  initialTournament: Tournament;
}) {
  const [tournament, setTournament] = useState<Tournament>(initialTournament);

  const handleUpdate = useCallback((updated: Tournament) => {
    setTournament(updated);
  }, []);

  const advancers = tournament.advancersPerPool ?? 1;
  const formatLabel =
    tournament.format === "round_robin"
      ? `${tournament.players.length} players · Single round-robin · Final ranking by total flags`
      : `${tournament.players.length} players · ${tournament.pools.length} pools + single-elimination bracket · Top ${advancers} per pool advance${advancers === 1 ? "s" : ""}`;

  const publicUrl = `/view/${tournament.id}`;
  const displayUrl = `/view/${tournament.id}/display`;

  // Show "generate bracket" button when all pools done and bracket not yet generated
  const allPoolsDone =
    tournament.format === "pools_elimination" &&
    tournament.status === "pool_play" &&
    tournament.pools.every((p) => p.matches.every((m) => m.complete));

  return (
    <main className="min-h-screen p-6 print:bg-white print:p-0" style={{ backgroundColor: "var(--hd-page-bg)" }}>
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Everything except the final report is hidden when printing */}
        <div className="print:hidden space-y-6">
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-serif font-semibold" style={{ color: "var(--hd-inverse-text)" }}>{tournament.name}</h1>
              <p className="text-sm" style={{ color: "var(--hd-subtle-text)" }}>{tournament.date}</p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <a
                href={publicUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm hover:underline whitespace-nowrap"
                style={{ color: "var(--hd-accent-secondary)" }}
              >
                Public view ↗
              </a>
              <a
                href={displayUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm hover:underline whitespace-nowrap"
                style={{ color: "var(--hd-accent-secondary)" }}
              >
                Display mode ↗
              </a>
            </div>
          </div>

          {/* Format info */}
          <div className="rounded-xl px-5 py-3 text-sm border" style={{ backgroundColor: "var(--hd-secondary-bg)", borderColor: "var(--hd-tertiary-bg)", color: "var(--hd-inverse-text)" }}>
            {formatLabel}
          </div>

          {/* Pools */}
          {tournament.pools.map((pool) => (
            <PoolSection
              key={pool.id}
              pool={pool}
              tournament={tournament}
              onUpdate={handleUpdate}
            />
          ))}

          {/* Generate bracket prompt */}
          {allPoolsDone && (
            <GenerateBracketButton
              tournament={tournament}
              onUpdate={handleUpdate}
            />
          )}

          {/* Elimination bracket */}
          {tournament.eliminationMatches.length > 0 && (
            <div className="pt-4 border-t" style={{ borderColor: "var(--hd-accent-secondary)" }}>
              <BracketSection
                tournament={tournament}
                onUpdate={handleUpdate}
              />
            </div>
          )}
        </div>

        {/* Final report — visible on screen and when printing */}
        {tournament.status === "complete" && (
          <div className="pt-4 border-t print:border-0" style={{ borderColor: "var(--hd-accent-secondary)" }}>
            <FinalReport tournament={tournament} />
          </div>
        )}
      </div>
    </main>
  );
}
