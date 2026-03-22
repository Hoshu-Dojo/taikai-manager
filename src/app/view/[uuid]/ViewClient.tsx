"use client";

import { useEffect, useState } from "react";
import { Tournament } from "@/types";
import { computeStandings, computeWinReason, StandingRow } from "@/lib/standings";

const POLL_INTERVAL_MS = 7000;

function FlagPips({ count }: { count: number }) {
  return (
    <span className="inline-flex gap-0.5 flex-wrap justify-end">
      {Array.from({ length: count }).map((_, i) => (
        <span key={i} className="text-red-500" style={{ fontSize: 14, lineHeight: 1 }}>▲</span>
      ))}
    </span>
  );
}

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
        // Silently ignore polling errors — stale data is fine
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(id);
  }, [tournament.id]);

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

        {/* Standings per pool */}
        {tournament.pools.map((pool) => {
          const rows = computeStandings(pool, tournament.players, tournament.id);
          const topLabel = tournament.format === "round_robin" ? "Winner" : "Advances";
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

        {/* Last updated */}
        <p className="text-center text-xs text-gray-300">
          Updated {lastUpdated.toLocaleTimeString()}
        </p>
      </div>
    </main>
  );
}
