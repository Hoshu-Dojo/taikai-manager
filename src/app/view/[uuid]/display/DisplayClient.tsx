"use client";

import { useEffect, useState } from "react";
import { Tournament } from "@/types";
import { computeStandings, computeWinReason } from "@/lib/standings";
import { displayName } from "@/lib/utils";
import BracketTree from "@/components/BracketTree";

const POLL_INTERVAL_MS = 7000;

// ─── Pool standings card ───────────────────────────────────────────────────────

function PoolCard({
  tournament,
  poolId,
  topLabel,
}: {
  tournament: Tournament;
  poolId: string;
  topLabel: string;
}) {
  const pool = tournament.pools.find((p) => p.id === poolId)!;
  const rows = computeStandings(pool, tournament.players, tournament.id);
  const poolComplete = pool.matches.every((m) => m.complete);
  const winReason = poolComplete ? computeWinReason(pool, tournament.players, tournament.id) : null;

  return (
    <div className="rounded-2xl overflow-hidden border" style={{ backgroundColor: "var(--hd-secondary-bg)", borderColor: "var(--hd-tertiary-bg)" }}>
      <div className="px-6 py-3 border-b" style={{ borderColor: "var(--hd-tertiary-bg)" }}>
        <h2 className="text-base font-semibold uppercase tracking-widest" style={{ color: "var(--hd-subtle-text)" }}>
          {pool.name}
        </h2>
      </div>
      <table className="w-full">
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.playerId} className="border-b last:border-0" style={{ borderColor: "var(--hd-tertiary-bg)" }}>
              <td className="px-6 py-4 text-xl font-semibold w-10" style={{ color: "var(--hd-subtle-text)" }}>
                {i + 1}
              </td>
              <td className="px-2 py-4">
                <span className="text-2xl font-semibold" style={{ color: "var(--hd-inverse-text)" }}>
                  {row.playerName}
                </span>
                {i === 0 && poolComplete && (
                  <span
                    className="ml-3 text-sm font-semibold px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: "var(--hd-accent-secondary)", color: "var(--hd-inverse-text)" }}
                  >
                    {topLabel}
                  </span>
                )}
              </td>
              <td className="px-6 py-4 text-right">
                <span className="text-3xl font-bold tabular-nums" style={{ color: "var(--hd-accent-secondary)" }}>
                  {row.flags}
                </span>
                <span className="ml-1 text-base" style={{ color: "var(--hd-subtle-text)" }}>flags</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {poolComplete && rows.length > 0 && winReason && (
        <div className="px-6 py-3 border-t text-base" style={{ borderColor: "var(--hd-tertiary-bg)", color: "var(--hd-subtle-text)" }}>
          {rows[0].playerName} advances — {winReason}
        </div>
      )}
    </div>
  );
}

// ─── Champion banner ───────────────────────────────────────────────────────────

function ChampionBanner({ tournament }: { tournament: Tournament }) {
  const finalMatch = tournament.eliminationMatches.find((m) => !m.advancesToMatchId);
  let champion = null;

  if (finalMatch?.winnerId) {
    champion = tournament.players.find((p) => p.id === finalMatch.winnerId) ?? null;
  } else if (tournament.format === "round_robin" && tournament.pools.length > 0) {
    const standings = computeStandings(tournament.pools[0], tournament.players, tournament.id);
    champion = tournament.players.find((p) => p.id === standings[0]?.playerId) ?? null;
  }

  if (!champion) return null;

  return (
    <div className="rounded-2xl px-8 py-8 text-center border" style={{ backgroundColor: "var(--hd-secondary-bg)", borderColor: "var(--hd-accent-secondary)" }}>
      <p className="text-base font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--hd-accent-secondary)" }}>
        Champion
      </p>
      <p className="text-6xl font-serif font-semibold" style={{ color: "var(--hd-inverse-text)" }}>
        {displayName(champion)}
      </p>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function DisplayClient({
  initialTournament,
}: {
  initialTournament: Tournament;
}) {
  const [tournament, setTournament] = useState<Tournament>(initialTournament);
  const [pollFailures, setPollFailures] = useState(0);

  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const res = await fetch(`/api/tournaments/${tournament.id}`, { cache: "no-store" });
        if (res.ok) {
          setTournament(await res.json());
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
  const multiPool = tournament.pools.length > 1;

  return (
    <main className="min-h-screen p-8 space-y-8" style={{ backgroundColor: "var(--hd-page-bg)" }}>
      {/* Title */}
      <div className="text-center space-y-1">
        <h1 className="text-5xl font-serif font-semibold" style={{ color: "var(--hd-inverse-text)" }}>
          {tournament.name}
        </h1>
        <p className="text-lg" style={{ color: "var(--hd-subtle-text)" }}>{tournament.date}</p>
      </div>

      {/* Champion banner (when complete) */}
      {tournament.status === "complete" && (
        <ChampionBanner tournament={tournament} />
      )}

      {/* Pool standings */}
      {tournament.pools.length > 0 && tournament.status !== "complete" && (
        <div className={multiPool ? "grid grid-cols-2 gap-6" : "max-w-2xl mx-auto"}>
          {tournament.pools.map((pool) => (
            <PoolCard
              key={pool.id}
              tournament={tournament}
              poolId={pool.id}
              topLabel={topLabel}
            />
          ))}
        </div>
      )}

      {/* Elimination bracket */}
      {tournament.eliminationMatches.length > 0 && tournament.status !== "complete" && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold uppercase tracking-widest" style={{ color: "var(--hd-subtle-text)" }}>
            Elimination Bracket
          </h2>
          <BracketTree
            matches={tournament.eliminationMatches}
            players={tournament.players}
            totalRounds={Math.max(...tournament.eliminationMatches.map((m) => m.round))}
            large
          />
        </div>
      )}

      {/* Connection lost warning */}
      {pollFailures >= 3 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 px-6 py-3 rounded-lg text-sm font-medium" style={{ backgroundColor: "#7c2d12", color: "#fef2f2" }}>
          Connection lost — display may be outdated
        </div>
      )}
    </main>
  );
}
