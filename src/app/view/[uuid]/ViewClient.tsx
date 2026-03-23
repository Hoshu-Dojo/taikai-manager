"use client";

import { useEffect, useState } from "react";
import { Tournament } from "@/types";
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
  winReason,
  poolComplete,
}: {
  rows: StandingRow[];
  poolName: string;
  topLabel: string;
  winTooltip: string;
  winReason: string;
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
          <tr className="text-left text-gray-500 text-xs border-b border-gray-100">
            <th className="px-5 py-2">#</th>
            <th className="px-5 py-2">Player</th>
            <th className="px-5 py-2 text-right">Flags</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.playerId} className="border-b border-gray-50 last:border-0">
              <td className="px-5 py-3 text-gray-600 font-medium">{i + 1}</td>
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
      {poolComplete && rows.length > 0 && (
        <p className="px-5 py-2 text-xs text-gray-600 border-t border-gray-100">
          {rows[0].playerName} advances — {winReason}
        </p>
      )}
    </div>
  );
}

// ─── Elimination bracket (read-only SVG tree) ─────────────────────────────────

// All dimensions are in SVG "virtual" units. The SVG scales to fill container
// width automatically via viewBox + width="100%", so no JS measurement needed.
const V_MW = 200;   // match box width
const V_MH = 72;    // match box height
const V_SH = 100;   // vertical slot per first-round match
const V_CG = 48;    // column gap (connector zone)
const V_LH = 26;    // label row height above bracket

function trunc(s: string, max: number) {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

function BracketSection({ tournament }: { tournament: Tournament }) {
  const matches = tournament.eliminationMatches;
  if (matches.length === 0) return null;

  const maxRound = Math.max(...matches.map((m) => m.round));
  const firstRoundCount = matches.filter((m) => m.round === 1).length;
  const colTotal = V_MW + V_CG;
  const viewW = maxRound * V_MW + (maxRound - 1) * V_CG;
  const viewH = V_LH + firstRoundCount * V_SH;

  // Vertical centre of a match (offset by label row)
  function cy(round: number, position: number): number {
    const span = Math.pow(2, round - 1);
    return V_LH + ((position - 1) * span + span / 2) * V_SH;
  }

  // Left edge of a round's column
  function lx(round: number): number {
    return (round - 1) * colTotal;
  }

  // Build connector paths
  const connectors: string[] = [];
  for (let r = 1; r < maxRound; r++) {
    const roundMatches = matches
      .filter((m) => m.round === r)
      .sort((a, b) => a.position - b.position);
    for (let i = 0; i < roundMatches.length; i += 2) {
      const m1 = roundMatches[i];
      const m2 = roundMatches[i + 1];
      if (!m1 || !m2) continue;
      const rx = lx(r) + V_MW;
      const y1 = cy(r, m1.position);
      const y2 = cy(r, m2.position);
      const mx = rx + V_CG / 2;
      const my = (y1 + y2) / 2;
      const nl = lx(r + 1);
      connectors.push(`M ${rx} ${y1} H ${mx} V ${y2} M ${rx} ${y2} H ${mx} M ${mx} ${my} H ${nl}`);
    }
  }

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-sans font-bold" style={{ color: "var(--hd-inverse-text)" }}>
        Elimination Bracket
      </h2>
      <svg
        viewBox={`0 0 ${viewW} ${viewH}`}
        width="100%"
        style={{ display: "block", height: "auto" }}
      >
        {/* Round labels */}
        {Array.from({ length: maxRound }, (_, i) => i + 1).map((round) => (
          <text
            key={round}
            x={lx(round) + V_MW / 2}
            y={V_LH - 8}
            textAnchor="middle"
            fontSize={10}
            fill="var(--hd-inverse-text)"
            fontFamily="system-ui, sans-serif"
            fontWeight="600"
          >
            {roundLabel(round, maxRound).toUpperCase()}
          </text>
        ))}

        {/* Connector lines */}
        {connectors.map((d, i) => (
          <path key={i} d={d} stroke="rgba(255,255,255,0.45)" strokeWidth={1.5} fill="none" />
        ))}

        {/* Match boxes */}
        {matches.map((match) => {
          const p1 = match.player1Id ? tournament.players.find((p) => p.id === match.player1Id) : null;
          const p2 = match.player2Id ? tournament.players.find((p) => p.id === match.player2Id) : null;
          const isScored = match.flagsP1 !== null && match.flagsP2 !== null;
          const isBye = match.player1Source === "bye" || match.player2Source === "bye";
          const p1Wins = isScored && match.winnerId === match.player1Id;
          const p2Wins = isScored && match.winnerId === match.player2Id;
          const p1Name = p1 ? displayName(p1) : (match.player1Source === "bye" ? "Bye" : "TBD");
          const p2Name = p2 ? displayName(p2) : (match.player2Source === "bye" ? "Bye" : "TBD");

          const bx = lx(match.round);
          const center = cy(match.round, match.position);
          const top = center - V_MH / 2;
          const mid = top + V_MH / 2;
          const PAD = 8;
          const SCORE_X = bx + V_MW - PAD;
          const NAME_CHARS = 22;

          if (isBye) {
            const advancer = match.player1Source === "bye" ? p2 : p1;
            const name = advancer ? displayName(advancer) : "TBD";
            return (
              <g key={match.id}>
                <rect x={bx} y={top} width={V_MW} height={V_MH} rx={4} fill="white" stroke="#e5e7eb" strokeWidth={1} />
                <text x={bx + PAD} y={center} dominantBaseline="central" fontSize={13} fill="#1f2937" fontWeight="500" fontFamily="system-ui, sans-serif">
                  {trunc(name, NAME_CHARS)}
                </text>
                <text x={SCORE_X} y={center} dominantBaseline="central" textAnchor="end" fontSize={11} fill="#9ca3af" fontFamily="system-ui, sans-serif">
                  bye
                </text>
              </g>
            );
          }

          return (
            <g key={match.id}>
              {/* Winner row tint */}
              {p1Wins && <rect x={bx + 1} y={top + 1} width={V_MW - 2} height={V_MH / 2 - 1} rx={3} fill="#f0fdf4" />}
              {p2Wins && <rect x={bx + 1} y={mid} width={V_MW - 2} height={V_MH / 2 - 1} rx={3} fill="#f0fdf4" />}
              {/* Box outline */}
              <rect x={bx} y={top} width={V_MW} height={V_MH} rx={4} fill="white" stroke="#e5e7eb" strokeWidth={1} />
              {/* Row divider */}
              <line x1={bx} y1={mid} x2={bx + V_MW} y2={mid} stroke="#f3f4f6" strokeWidth={1} />
              {/* Player 1 */}
              <text x={bx + PAD} y={top + V_MH / 4} dominantBaseline="central" fontSize={13} fill={p1Wins ? "#166534" : "#4b5563"} fontWeight={p1Wins ? "700" : "400"} fontFamily="system-ui, sans-serif">
                {trunc(p1Name, NAME_CHARS)}
              </text>
              {isScored && (
                <text x={SCORE_X} y={top + V_MH / 4} dominantBaseline="central" textAnchor="end" fontSize={13} fill={p1Wins ? "#16a34a" : "#9ca3af"} fontWeight="600" fontFamily="system-ui, sans-serif">
                  {match.flagsP1}
                </text>
              )}
              {/* Player 2 */}
              <text x={bx + PAD} y={top + 3 * V_MH / 4} dominantBaseline="central" fontSize={13} fill={p2Wins ? "#166534" : "#4b5563"} fontWeight={p2Wins ? "700" : "400"} fontFamily="system-ui, sans-serif">
                {trunc(p2Name, NAME_CHARS)}
              </text>
              {isScored && (
                <text x={SCORE_X} y={top + 3 * V_MH / 4} dominantBaseline="central" textAnchor="end" fontSize={13} fill={p2Wins ? "#16a34a" : "#9ca3af"} fontWeight="600" fontFamily="system-ui, sans-serif">
                  {match.flagsP2}
                </text>
              )}
            </g>
          );
        })}
      </svg>
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

// ─── Main client component ────────────────────────────────────────────────────

export default function ViewClient({
  initialTournament,
}: {
  initialTournament: Tournament;
}) {
  const [tournament, setTournament] = useState<Tournament>(initialTournament);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [pollFailures, setPollFailures] = useState(0);

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
          setPollFailures(0);
        } else {
          setPollFailures((n) => n + 1);
        }
      } catch {
        setPollFailures((n) => n + 1);
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(id);
  }, [tournament.id]);

  const topLabel = tournament.format === "round_robin" ? "Winner" : "Advances";

  return (
    <main className="min-h-screen print:bg-white" style={{ backgroundColor: "var(--hd-page-bg)" }}>
      {/* Everything except the final report is hidden when printing */}
      <div className="print:hidden space-y-6 p-6">
        <div className="max-w-2xl mx-auto space-y-6">
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
                winReason={winReason}
                poolComplete={poolComplete}
              />
            );
          })}
        </div>

        {/* Elimination bracket — full width so it fills the screen */}
        {tournament.eliminationMatches.length > 0 && tournament.status !== "complete" && (
          <BracketSection tournament={tournament} />
        )}

        <div className="max-w-2xl mx-auto">
          {/* Last updated / connection status */}
          {pollFailures >= 3 ? (
            <p className="text-center text-xs font-medium rounded px-3 py-2" style={{ backgroundColor: "#7c2d12", color: "#fef2f2" }}>
              Connection lost — data may be outdated
            </p>
          ) : (
            <p className="text-center text-xs" style={{ color: "var(--hd-subtle-text)" }}>
              Updated {lastUpdated.toLocaleTimeString()}
            </p>
          )}
        </div>
      </div>

      {/* Final report — visible on screen and when printing */}
      {tournament.status === "complete" && (
        <div className="p-6">
          <div className="max-w-2xl mx-auto">
            <FinalReport tournament={tournament} />
          </div>
        </div>
      )}
    </main>
  );
}
