import { notFound } from "next/navigation";
import Link from "next/link";
import { loadTournament } from "@/lib/storage";
import { Tournament, Pool, Match } from "@/types";

function formatStatus(status: Tournament["status"]) {
  switch (status) {
    case "setup": return "Setup";
    case "pool_play": return "Pool Play";
    case "elimination": return "Elimination";
    case "complete": return "Complete";
  }
}

function PoolCard({ pool, tournament }: { pool: Pool; tournament: Tournament }) {
  const poolPlayers = pool.playerIds.map(
    (id) => tournament.players.find((p) => p.id === id)!
  );

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
      <h2 className="text-lg font-semibold text-gray-800">{pool.name}</h2>

      <div>
        <h3 className="text-xs font-medium text-gray-500 uppercase mb-2">Players</h3>
        <ul className="space-y-1">
          {poolPlayers.map((p) => (
            <li key={p.id} className="text-gray-700 text-sm">{p.name}</li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="text-xs font-medium text-gray-500 uppercase mb-2">
          Matches ({pool.matches.filter((m) => m.complete).length}/{pool.matches.length} complete)
        </h3>
        <ul className="space-y-2">
          {pool.matches.map((match: Match) => {
            const p1 = tournament.players.find((p) => p.id === match.player1Id)!;
            const p2 = tournament.players.find((p) => p.id === match.player2Id)!;
            return (
              <li key={match.id} className="text-sm text-gray-700 flex items-center justify-between">
                <span>
                  Round {match.round}: <span className="font-medium">{p1.name}</span> vs <span className="font-medium">{p2.name}</span>
                </span>
                {match.complete ? (
                  <span className="text-green-600 text-xs font-medium">
                    {match.flagsPlayer1}–{match.flagsPlayer2}
                  </span>
                ) : (
                  <span className="text-gray-400 text-xs">pending</span>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

export default async function ManagePage({
  params,
}: {
  params: Promise<{ uuid: string }>;
}) {
  const { uuid } = await params;
  const tournament = loadTournament(uuid);
  if (!tournament) notFound();

  const publicUrl = `/view/${uuid}`;

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{tournament.name}</h1>
            <p className="text-sm text-gray-500">{tournament.date} · {formatStatus(tournament.status)}</p>
          </div>
          <Link
            href={publicUrl}
            target="_blank"
            className="text-sm text-blue-600 hover:underline whitespace-nowrap"
          >
            Public view ↗
          </Link>
        </div>

        {/* Format info */}
        <div className="bg-blue-50 border border-blue-100 rounded-xl px-5 py-3 text-sm text-blue-800">
          {tournament.format === "round_robin"
            ? `${tournament.players.length} players · Single round-robin · Final ranking by total flags`
            : `${tournament.players.length} players · ${tournament.pools.length} pools + single-elimination bracket`}
        </div>

        {/* Pools */}
        <div className="space-y-4">
          {tournament.pools.map((pool) => (
            <PoolCard key={pool.id} pool={pool} tournament={tournament} />
          ))}
        </div>

        <p className="text-xs text-gray-400 text-center">
          Score entry coming in Phase 1.
        </p>
      </div>
    </main>
  );
}
