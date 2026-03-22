"use client";

import { useState, useCallback } from "react";
import { Tournament, Pool, Match } from "@/types";
import { computeStandings, computeWinReason, StandingRow } from "@/lib/standings";

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

// ─── Score entry for one match ───────────────────────────────────────────────

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
      {/* Match header */}
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
  const topLabel = rankLabel(0, tournament.format)!;

  // Group matches by round
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

      {/* Standings */}
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
                          title={`${topLabel}: ${winReason}`}
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

      {/* Rounds */}
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
      </div>
    </main>
  );
}
