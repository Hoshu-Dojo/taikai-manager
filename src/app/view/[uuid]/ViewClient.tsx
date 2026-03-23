"use client";

import { useEffect, useRef, useState } from "react";
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

// ─── Elimination bracket (read-only tree) ─────────────────────────────────────

const COL_GAP = 40;       // fixed gap between columns (connector zone)
const MIN_MATCH_W = 140;
const MAX_MATCH_W = 320;

function MatchNode({
  match,
  players,
  matchW,
  matchH,
}: {
  match: EliminationMatch;
  players: Tournament["players"];
  matchW: number;
  matchH: number;
}) {
  const p1 = match.player1Id ? players.find((p) => p.id === match.player1Id) : null;
  const p2 = match.player2Id ? players.find((p) => p.id === match.player2Id) : null;
  const isScored = match.flagsP1 !== null && match.flagsP2 !== null;
  const isBye = match.player1Source === "bye" || match.player2Source === "bye";

  const p1Display = p1 ? displayName(p1) : (match.player1Source === "bye" ? "Bye" : "TBD");
  const p2Display = p2 ? displayName(p2) : (match.player2Source === "bye" ? "Bye" : "TBD");

  const p1Wins = isScored && match.winnerId === match.player1Id;
  const p2Wins = isScored && match.winnerId === match.player2Id;

  const textSize = matchW >= 220 ? "15px" : "13px";
  const px = Math.round(matchW * 0.06);

  if (isBye) {
    const advancer = match.player1Source === "bye" ? p2 : p1;
    const advancerDisplay = advancer ? displayName(advancer) : "TBD";
    return (
      <div
        className="bg-white border border-gray-200 rounded-lg overflow-hidden flex items-center"
        style={{ width: matchW, height: matchH }}
      >
        <div className="flex items-center justify-between w-full" style={{ paddingLeft: px, paddingRight: px }}>
          <span className="font-medium text-gray-800 truncate" style={{ fontSize: textSize }}>{advancerDisplay}</span>
          <span className="text-gray-400 ml-2 shrink-0" style={{ fontSize: "11px" }}>bye</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className="bg-white border border-gray-200 rounded-lg overflow-hidden flex flex-col"
      style={{ width: matchW, height: matchH }}
    >
      <div className={`flex items-center justify-between flex-1 ${p1Wins ? "bg-green-50" : ""}`} style={{ paddingLeft: px, paddingRight: px }}>
        <span className={`truncate ${p1Wins ? "font-bold text-gray-900" : "text-gray-600"}`} style={{ fontSize: textSize }}>
          {p1Display}
        </span>
        {isScored && (
          <span className={`font-semibold ml-2 shrink-0 ${p1Wins ? "text-green-600" : "text-gray-400"}`} style={{ fontSize: textSize }}>
            {match.flagsP1}
          </span>
        )}
      </div>
      <div className="border-t border-gray-100 shrink-0" />
      <div className={`flex items-center justify-between flex-1 ${p2Wins ? "bg-green-50" : ""}`} style={{ paddingLeft: px, paddingRight: px }}>
        <span className={`truncate ${p2Wins ? "font-bold text-gray-900" : "text-gray-600"}`} style={{ fontSize: textSize }}>
          {p2Display}
        </span>
        {isScored && (
          <span className={`font-semibold ml-2 shrink-0 ${p2Wins ? "text-green-600" : "text-gray-400"}`} style={{ fontSize: textSize }}>
            {match.flagsP2}
          </span>
        )}
      </div>
    </div>
  );
}

function BracketSection({ tournament }: { tournament: Tournament }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerW, setContainerW] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setContainerW(el.getBoundingClientRect().width);
    const ro = new ResizeObserver((entries) => {
      setContainerW(entries[0].contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const matches = tournament.eliminationMatches;
  if (matches.length === 0) return null;

  const maxRound = Math.max(...matches.map((m) => m.round));
  const firstRoundCount = matches.filter((m) => m.round === 1).length;

  const matchW = containerW === 0
    ? MIN_MATCH_W
    : Math.min(MAX_MATCH_W, Math.max(MIN_MATCH_W, (containerW - (maxRound - 1) * COL_GAP) / maxRound));
  const matchH = Math.round(matchW * 0.34);
  const slotH = Math.round(matchW * 0.52);
  const colTotal = matchW + COL_GAP;

  const totalW = maxRound * matchW + (maxRound - 1) * COL_GAP;
  const totalH = firstRoundCount * slotH;

  function cy(round: number, position: number): number {
    const span = Math.pow(2, round - 1);
    return ((position - 1) * span + span / 2) * slotH;
  }

  function lx(round: number): number {
    return (round - 1) * colTotal;
  }

  const connectors: string[] = [];
  for (let r = 1; r < maxRound; r++) {
    const roundMatches = matches
      .filter((m) => m.round === r)
      .sort((a, b) => a.position - b.position);
    for (let i = 0; i < roundMatches.length; i += 2) {
      const m1 = roundMatches[i];
      const m2 = roundMatches[i + 1];
      if (!m1 || !m2) continue;
      const rx = lx(r) + matchW;
      const y1 = cy(r, m1.position);
      const y2 = cy(r, m2.position);
      const mx = rx + COL_GAP / 2;
      const my = (y1 + y2) / 2;
      const nl = lx(r + 1);
      connectors.push(
        `M ${rx} ${y1} H ${mx} V ${y2} M ${rx} ${y2} H ${mx} M ${mx} ${my} H ${nl}`
      );
    }
  }

  return (
    <div ref={containerRef} className="space-y-3">
      <h2 className="text-lg font-sans font-bold" style={{ color: "var(--hd-inverse-text)" }}>
        Elimination Bracket
      </h2>
      {containerW > 0 && (
        <div style={{ display: "flex", justifyContent: "center" }}>
          <div>
            {/* Round labels */}
            <div style={{ display: "flex", gap: COL_GAP, width: totalW, paddingBottom: 12 }}>
              {Array.from({ length: maxRound }, (_, i) => i + 1).map((round) => (
                <div key={round} style={{ width: matchW, flexShrink: 0 }}>
                  <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--hd-inverse-text)" }}>
                    {roundLabel(round, maxRound)}
                  </p>
                </div>
              ))}
            </div>
            {/* Bracket canvas */}
            <div style={{ position: "relative", width: totalW, height: totalH }}>
              <svg
                width={totalW}
                height={totalH}
                overflow="visible"
                style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none" }}
              >
                {connectors.map((d, i) => (
                  <path key={i} d={d} stroke="rgba(255,255,255,0.45)" strokeWidth={1.5} fill="none" />
                ))}
              </svg>
              {matches.map((match) => (
                <div
                  key={match.id}
                  style={{ position: "absolute", left: lx(match.round), top: cy(match.round, match.position) - matchH / 2 }}
                >
                  <MatchNode
                    match={match}
                    players={tournament.players}
                    matchW={matchW}
                    matchH={matchH}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
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
