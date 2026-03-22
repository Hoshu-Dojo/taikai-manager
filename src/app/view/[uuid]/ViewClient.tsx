"use client";

import { useEffect, useState } from "react";
import { Tournament, EliminationMatch } from "@/types";
import { computeStandings, computeWinReason, StandingRow } from "@/lib/standings";
import { roundLabel } from "@/lib/bracket";

const POLL_INTERVAL_MS = 7000;

// ─── Flag pips ────────────────────────────────────────────────────────────────

function FlagPips({ count }: { count: number }) {
  return (
    <span className="inline-flex gap-0.5 flex-wrap justify-end">
      {Array.from({ length: count }).map((_, i) => (
        <span key={i} className="text-red-500" style={{ fontSize: 14, lineHeight: 1 }}>▲</span>
      ))}
    </span>
  );
}

// ─── Pool standings table ─────────────────────────────────────────────────────

function StandingsTable({
  rows,
  poolName,
  topLabel,
  winTooltip,
  poolComplete,
}: {
  rows: StandingRow[];
  poolName: string;
  topLabel: string;
  winTooltip: string;
  poolComplete: boolean;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
        <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">
          {poolName}
        </h2>
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
          {rows.map((row, i) => (
            <tr key={row.playerId} className="border-b border-gray-50 last:border-0">
              <td className="px-5 py-3 text-gray-400 font-medium">{i + 1}</td>
              <td className="px-5 py-3 font-semibold text-gray-900">
                <span className="flex items-center gap-2">
                  {row.playerName}
                  {i === 0 && poolComplete && (
                    <span
                      title={winTooltip}
                      className="text-xs font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded-full cursor-help"
                    >
                      {topLabel}
                    </span>
                  )}
                </span>
              </td>
              <td className="px-5 py-3 text-right">
                <FlagPips count={row.flags} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Elimination bracket (read-only) ─────────────────────────────────────────

function EliminationMatchBox({
  match,
  players,
}: {
  match: EliminationMatch;
  players: Tournament["players"];
}) {
  const p1 = match.player1Id ? players.find((p) => p.id === match.player1Id) : null;
  const p2 = match.player2Id ? players.find((p) => p.id === match.player2Id) : null;
  const isScored = match.flagsP1 !== null && match.flagsP2 !== null;
  const isBye = match.player1Source === "bye" || match.player2Source === "bye";
  const winnerName = match.winnerId
    ? players.find((p) => p.id === match.winnerId)?.name
    : null;

  const p1Display = p1?.name ?? (match.player1Source === "bye" ? "Bye" : "TBD");
  const p2Display = p2?.name ?? (match.player2Source === "bye" ? "Bye" : "TBD");

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3 text-sm space-y-1.5">
      <div>
        <span className={isScored && match.winnerId === match.player1Id ? "font-bold text-gray-900" : "text-gray-600"}>
          {p1Display}
        </span>
        {isScored && (
          <span className="ml-2 text-green-600 font-semibold text-xs">{match.flagsP1}</span>
        )}
      </div>
      <div>
        <span className={isScored && match.winnerId === match.player2Id ? "font-bold text-gray-900" : "text-gray-600"}>
          {p2Display}
        </span>
        {isScored && (
          <span className="ml-2 text-green-600 font-semibold text-xs">{match.flagsP2}</span>
        )}
      </div>
      {isBye && winnerName && (
        <p className="text-xs text-gray-400">{winnerName} — bye</p>
      )}
    </div>
  );
}

function BracketSection({
  tournament,
}: {
  tournament: Tournament;
}) {
  const matches = tournament.eliminationMatches;
  if (matches.length === 0) return null;

  const maxRound = Math.max(...matches.map((m) => m.round));
  const firstRoundCount = matches.filter((m) => m.round === 1).length;
  const MATCH_H = 88;
  const containerH = firstRoundCount * MATCH_H;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-gray-800">Elimination Bracket</h2>
      <div className="overflow-x-auto pb-2">
        <div className="flex gap-6 min-w-max">
          {Array.from({ length: maxRound }, (_, ri) => ri + 1).map((round) => {
            const roundMatches = matches
              .filter((m) => m.round === round)
              .sort((a, b) => a.position - b.position);
            const label = roundLabel(round, maxRound);

            return (
              <div key={round} className="flex flex-col" style={{ width: 200 }}>
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
                    <EliminationMatchBox
                      key={match.id}
                      match={match}
                      players={tournament.players}
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

// ─── Final report (read-only) ─────────────────────────────────────────────────

function FinalReport({ tournament }: { tournament: Tournament }) {
  const finalMatch = tournament.eliminationMatches.find(
    (m) => !m.advancesToMatchId
  );
  const champion = finalMatch?.winnerId
    ? tournament.players.find((p) => p.id === finalMatch.winnerId)
    : (() => {
        // round_robin: top of the single pool
        if (tournament.format === "round_robin" && tournament.pools.length > 0) {
          const standings = computeStandings(
            tournament.pools[0],
            tournament.players,
            tournament.id
          );
          if (standings.length > 0) {
            return tournament.players.find((p) => p.id === standings[0].playerId);
          }
        }
        return null;
      })();

  const roundCount = tournament.eliminationMatches.length > 0
    ? Math.max(...tournament.eliminationMatches.map((m) => m.round))
    : 0;

  return (
    <div className="space-y-6">
      {champion && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-5 py-4 text-center">
          <p className="text-xs font-semibold text-yellow-700 uppercase tracking-wide mb-1">
            Champion
          </p>
          <p className="text-2xl font-bold text-yellow-900">{champion.name}</p>
        </div>
      )}

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

// ─── Main client component ────────────────────────────────────────────────────

export default function ViewClient({
  initialTournament,
}: {
  initialTournament: Tournament;
}) {
  const [tournament, setTournament] = useState<Tournament>(initialTournament);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const res = await fetch(`/api/tournaments/${tournament.id}`, {
          cache: "no-store",
        });
        if (res.ok) {
          const data: Tournament = await res.json();
          setTournament(data);
          setLastUpdated(new Date());
        }
      } catch {
        // Silently ignore polling errors
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(id);
  }, [tournament.id]);

  const topLabel = tournament.format === "round_robin" ? "Winner" : "Advances";

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{tournament.name}</h1>
          <p className="text-sm text-gray-500">
            {tournament.date} · Live standings
          </p>
        </div>

        {/* Pool standings */}
        {tournament.pools.map((pool) => {
          const rows = computeStandings(pool, tournament.players, tournament.id);
          const winReason = computeWinReason(pool, tournament.players, tournament.id);
          const poolComplete = pool.matches.every((m) => m.complete);
          return (
            <StandingsTable
              key={pool.id}
              rows={rows}
              poolName={pool.name}
              topLabel={topLabel}
              winTooltip={`${topLabel}: ${winReason}`}
              poolComplete={poolComplete}
            />
          );
        })}

        {/* Elimination bracket */}
        {tournament.eliminationMatches.length > 0 && tournament.status !== "complete" && (
          <BracketSection tournament={tournament} />
        )}

        {/* Final report when tournament is complete */}
        {tournament.status === "complete" && (
          <FinalReport tournament={tournament} />
        )}

        {/* Last updated */}
        <p className="text-center text-xs text-gray-300">
          Updated {lastUpdated.toLocaleTimeString()}
        </p>
      </div>
    </main>
  );
}
