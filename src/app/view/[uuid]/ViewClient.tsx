"use client";

import { useEffect, useState } from "react";
import { Tournament, EliminationMatch } from "@/types";
import { computeStandings, computeWinReason, StandingRow } from "@/lib/standings";
import { roundLabel } from "@/lib/bracket";
import { displayName } from "@/lib/utils";

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
  const winnerPlayer = match.winnerId ? players.find((p) => p.id === match.winnerId) : null;
  const winnerName = winnerPlayer ? displayName(winnerPlayer) : null;

  const p1Display = p1 ? displayName(p1) : (match.player1Source === "bye" ? "Bye" : "TBD");
  const p2Display = p2 ? displayName(p2) : (match.player2Source === "bye" ? "Bye" : "TBD");

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
    <div className="space-y-6">
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
            {standings.length > 0 && (
              <p className="px-5 py-2 text-xs text-gray-400 border-t border-gray-50">
                {standings[0].playerName} advances — {winReason}
              </p>
            )}
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
    <main className="min-h-screen p-6 print:bg-white print:p-0" style={{ backgroundColor: "var(--hd-page-bg)" }}>
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Everything except the final report is hidden when printing */}
        <div className="print:hidden space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-2xl font-serif font-semibold" style={{ color: "var(--hd-inverse-text)" }}>{tournament.name}</h1>
            <p className="text-sm" style={{ color: "var(--hd-subtle-text)" }}>
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

          {/* Last updated */}
          <p className="text-center text-xs" style={{ color: "var(--hd-subtle-text)" }}>
            Updated {lastUpdated.toLocaleTimeString()}
          </p>
        </div>

        {/* Final report — visible on screen and when printing */}
        {tournament.status === "complete" && (
          <FinalReport tournament={tournament} />
        )}
      </div>
    </main>
  );
}
