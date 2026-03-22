import { notFound } from "next/navigation";
import { loadTournament } from "@/lib/storage";
import { Tournament, Pool } from "@/types";

function StandingsTable({ pool, tournament }: { pool: Pool; tournament: Tournament }) {
  const rows = pool.playerIds.map((id) => {
    const player = tournament.players.find((p) => p.id === id)!;
    const myMatches = pool.matches.filter(
      (m) => m.complete && (m.player1Id === id || m.player2Id === id)
    );
    const flags = myMatches.reduce((sum, m) => {
      return sum + (m.player1Id === id ? (m.flagsPlayer1 ?? 0) : (m.flagsPlayer2 ?? 0));
    }, 0);
    return { name: player.name, flags };
  });

  rows.sort((a, b) => b.flags - a.flags);

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
      <h2 className="text-lg font-semibold text-gray-800">{pool.name}</h2>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gray-500 text-xs uppercase border-b border-gray-100">
            <th className="pb-2">Player</th>
            <th className="pb-2 text-right">Flags</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.name} className="border-b border-gray-50 last:border-0">
              <td className="py-2 text-gray-800">
                <span className="text-gray-400 mr-2">{i + 1}.</span>
                {r.name}
              </td>
              <td className="py-2 text-right font-medium text-gray-900">{r.flags}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function ViewPage({
  params,
}: {
  params: Promise<{ uuid: string }>;
}) {
  const { uuid } = await params;
  const tournament = loadTournament(uuid);
  if (!tournament) notFound();

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{tournament.name}</h1>
          <p className="text-sm text-gray-500">{tournament.date}</p>
        </div>

        {tournament.pools.map((pool) => (
          <StandingsTable key={pool.id} pool={pool} tournament={tournament} />
        ))}
      </div>
    </main>
  );
}
