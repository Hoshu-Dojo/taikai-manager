"use client";

import { useState, useCallback } from "react";
import { Tournament, Pool, Match, EliminationMatch } from "@/types";
import { computeStandings, computeWinReason, StandingRow } from "@/lib/standings";
import { roundLabel } from "@/lib/bracket";

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
}: {
  match: Match;
  tournamentId: string;
  players: Tournament["players"];
  onUpdate: (updated: Tournament) => void;
}) {
  const [entering, setEntering] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const p1 = players.find((p) => p.id === match.player1Id)!;
  const p2 = players.find((p) => p.id === match.player2Id)!;
  const options = scoreOptions(p1.name, p2.name);

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
      setEntering(false);
      onUpdate(updated);
    } catch {
      setError("Could not reach server.");
      setSubmitting(false);
    }
  }

  const winner =
    match.complete && match.flagsPlayer1 !== null && match.flagsPlayer2 !== null
      ? match.flagsPlayer1 > match.flagsPlayer2
        ? p1.name
        : p2.name
      : null;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-gray-800 font-medium">
          {p1.name} <span className="text-gray-400 font-normal">vs</span> {p2.name}
        </span>
        {match.complete && (
          <span className="text-sm font-semibold text-green-600 whitespace-nowrap">
            {match.flagsPlayer1}–{match.flagsPlayer2}
          </span>
        )}
      </div>

      {match.complete && winner && !entering && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">{winner} wins</span>
          <button
            onClick={() => { setEntering(true); setError(""); }}
            className="text-xs text-blue-500 hover:underline"
          >
            Edit
          </button>
        </div>
      )}

      {!match.complete && !entering && (
        <button
          onClick={() => { setEntering(true); setError(""); }}
          className="w-full text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2 rounded-lg transition-colors"
        >
          Enter score
        </button>
      )}

      {entering && (
        <div className="space-y-2">
          {options.map((opt) => (
            <button
              key={opt.label}
              disabled={submitting}
              onClick={() => submitScore(opt)}
              className="w-full text-left px-4 py-3 rounded-lg border border-gray-200 hover:bg-blue-50 hover:border-blue-300 text-gray-800 text-sm font-medium transition-colors disabled:opacity-50"
            >
              {opt.label}
            </button>
          ))}
          <button
            disabled={submitting}
            onClick={() => { setEntering(false); setError(""); }}
            className="w-full text-sm text-gray-400 hover:text-gray-600 py-1"
          >
            Cancel
          </button>
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

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-bold text-gray-800">{pool.name}</h2>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Standings — {completed}/{pool.matches.length} matches complete
          </h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-400 text-xs border-b border-gray-100">
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
                  <td className="px-5 py-3 text-gray-400">{i + 1}</td>
                  <td className="px-5 py-3 font-medium text-gray-800">
                    <span className="flex items-center gap-2">
                      {row.playerName}
                      {label && poolComplete && (
                        <span
                          title={`${label}: ${winReason}`}
                          className="text-xs font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded-full cursor-help"
                        >
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
      </div>

      {roundNumbers.map((round) => (
        <div key={round} className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
            Round {round}
          </h3>
          {rounds.get(round)!.map((match) => (
            <MatchCard
              key={match.id}
              match={match}
              tournamentId={tournament.id}
              players={tournament.players}
              onUpdate={onUpdate}
            />
          ))}
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
}: {
  match: EliminationMatch;
  tournamentId: string;
  players: Tournament["players"];
  onUpdate: (updated: Tournament) => void;
  readOnly?: boolean;
}) {
  const [entering, setEntering] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const p1 = match.player1Id ? players.find((p) => p.id === match.player1Id) : null;
  const p2 = match.player2Id ? players.find((p) => p.id === match.player2Id) : null;

  const isBye =
    match.player1Source === "bye" || match.player2Source === "bye";
  const isScored = match.flagsP1 !== null && match.flagsP2 !== null;
  const winnerName = match.winnerId
    ? players.find((p) => p.id === match.winnerId)?.name ?? "?"
    : null;

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
      setEntering(false);
      onUpdate(updated);
    } catch {
      setError("Could not reach server.");
      setSubmitting(false);
    }
  }

  const p1Display = p1?.name ?? (match.player1Source === "bye" ? "Bye" : "TBD");
  const p2Display = p2?.name ?? (match.player2Source === "bye" ? "Bye" : "TBD");

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-gray-800 font-medium">
          <span className={match.winnerId === match.player1Id && isScored ? "font-bold" : ""}>
            {p1Display}
          </span>
          <span className="text-gray-400 font-normal"> vs </span>
          <span className={match.winnerId === match.player2Id && isScored ? "font-bold" : ""}>
            {p2Display}
          </span>
        </span>
        {isScored && (
          <span className="text-sm font-semibold text-green-600 whitespace-nowrap">
            {match.flagsP1}–{match.flagsP2}
          </span>
        )}
      </div>

      {isBye && (
        <p className="text-xs text-gray-400">{winnerName} advances (bye)</p>
      )}

      {!isBye && isScored && !entering && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">{winnerName} wins</span>
          {!readOnly && (
            <button
              onClick={() => { setEntering(true); setError(""); }}
              className="text-xs text-blue-500 hover:underline"
            >
              Edit
            </button>
          )}
        </div>
      )}

      {!isBye && !isScored && !entering && !readOnly && p1 && p2 && (
        <button
          onClick={() => { setEntering(true); setError(""); }}
          className="w-full text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2 rounded-lg transition-colors"
        >
          Enter score
        </button>
      )}

      {!isBye && !isScored && !p1 && !p2 && (
        <p className="text-xs text-gray-400">Waiting for previous results…</p>
      )}

      {entering && p1 && p2 && (
        <div className="space-y-2">
          {eliminationScoreOptions(p1.name, p2.name).map((opt) => (
            <button
              key={opt.label}
              disabled={submitting}
              onClick={() => submitScore(opt)}
              className="w-full text-left px-4 py-3 rounded-lg border border-gray-200 hover:bg-blue-50 hover:border-blue-300 text-gray-800 text-sm font-medium transition-colors disabled:opacity-50"
            >
              {opt.label}
            </button>
          ))}
          <button
            disabled={submitting}
            onClick={() => { setEntering(false); setError(""); }}
            className="w-full text-sm text-gray-400 hover:text-gray-600 py-1"
          >
            Cancel
          </button>
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
      <h2 className="text-xl font-bold text-gray-800">Elimination Bracket</h2>
      <div className="overflow-x-auto pb-2">
        <div className="flex gap-6 min-w-max">
          {Array.from({ length: maxRound }, (_, ri) => ri + 1).map((round) => {
            const roundMatches = matches
              .filter((m) => m.round === round)
              .sort((a, b) => a.position - b.position);
            const label = roundLabel(round, maxRound);

            return (
              <div key={round} className="flex flex-col" style={{ width: 220 }}>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
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
  const champion = (() => {
    const finalMatch = tournament.eliminationMatches.find(
      (m) => !m.advancesToMatchId
    );
    if (!finalMatch?.winnerId) return null;
    return tournament.players.find((p) => p.id === finalMatch.winnerId);
  })();

  const roundCount = tournament.eliminationMatches.length > 0
    ? Math.max(...tournament.eliminationMatches.map((m) => m.round))
    : 0;

  return (
    <div className="space-y-6 print:space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-800">Final Report</h2>
        <button
          onClick={() => window.print()}
          className="text-sm text-blue-600 hover:underline print:hidden"
        >
          Print ↗
        </button>
      </div>

      {champion && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-5 py-4 text-center">
          <p className="text-xs font-semibold text-yellow-700 uppercase tracking-wide mb-1">
            Champion
          </p>
          <p className="text-2xl font-bold text-yellow-900">{champion.name}</p>
        </div>
      )}

      {/* Pool results */}
      {tournament.pools.map((pool) => {
        const standings = computeStandings(pool, tournament.players, tournament.id);
        return (
          <div key={pool.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                {pool.name} — Final Standings
              </h3>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400 text-xs border-b border-gray-100">
                  <th className="px-5 py-2">#</th>
                  <th className="px-5 py-2">Player</th>
                  <th className="px-5 py-2 text-right">Flags</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((row, i) => (
                  <tr key={row.playerId} className="border-b border-gray-50 last:border-0">
                    <td className="px-5 py-3 text-gray-400">{i + 1}</td>
                    <td className="px-5 py-3 font-medium text-gray-800">{row.playerName}</td>
                    <td className="px-5 py-3 text-right text-gray-700">{row.flags}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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
                    <p className="px-5 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide bg-gray-50">
                      {label}
                    </p>
                    {roundMatches
                      .filter((m) => m.player1Source !== "bye" && m.player2Source !== "bye")
                      .map((match) => {
                        const p1 = tournament.players.find((p) => p.id === match.player1Id);
                        const p2 = tournament.players.find((p) => p.id === match.player2Id);
                        const winner = tournament.players.find((p) => p.id === match.winnerId);
                        return (
                          <div key={match.id} className="px-5 py-3 flex items-center justify-between text-sm">
                            <span className="text-gray-800">
                              <span className={match.winnerId === match.player1Id ? "font-bold" : ""}>
                                {p1?.name ?? "?"}
                              </span>
                              <span className="text-gray-400"> vs </span>
                              <span className={match.winnerId === match.player2Id ? "font-bold" : ""}>
                                {p2?.name ?? "?"}
                              </span>
                            </span>
                            <span className="text-gray-500 text-xs">
                              {match.flagsP1 !== null
                                ? `${match.flagsP1}–${match.flagsP2} · ${winner?.name ?? "?"} wins`
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

  const formatLabel =
    tournament.format === "round_robin"
      ? `${tournament.players.length} players · Single round-robin · Final ranking by total flags`
      : `${tournament.players.length} players · ${tournament.pools.length} pools + single-elimination bracket`;

  const publicUrl = `/view/${tournament.id}`;

  // Show "generate bracket" button when all pools done and bracket not yet generated
  const allPoolsDone =
    tournament.format === "pools_elimination" &&
    tournament.status === "pool_play" &&
    tournament.pools.every((p) => p.matches.every((m) => m.complete));

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{tournament.name}</h1>
            <p className="text-sm text-gray-500">{tournament.date}</p>
          </div>
          <a
            href={publicUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-600 hover:underline whitespace-nowrap"
          >
            Public view ↗
          </a>
        </div>

        {/* Format info */}
        <div className="bg-blue-50 border border-blue-100 rounded-xl px-5 py-3 text-sm text-blue-800">
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
          <BracketSection
            tournament={tournament}
            onUpdate={handleUpdate}
          />
        )}

        {/* Final report */}
        {tournament.status === "complete" && (
          <FinalReport tournament={tournament} />
        )}
      </div>
    </main>
  );
}
