/**
 * Creates a 3-player tournament with scores that produce a circular tie,
 * then prints the manage URL so you can see the run-off prompt immediately.
 *
 * Usage (dev server must be running):
 *   node scripts/seed-circular-tie.mjs
 *   node scripts/seed-circular-tie.mjs http://localhost:3001   # if on a different port
 */

const BASE = process.argv[2] ?? "http://localhost:3000";

// 1. Create tournament
const create = await fetch(`${BASE}/api/tournaments`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    name: "Circular Tie Test",
    date: new Date().toISOString().slice(0, 10),
    players: [{ name: "Alice" }, { name: "Bob" }, { name: "Carol" }],
  }),
});

if (!create.ok) {
  console.error("Failed to create tournament:", await create.text());
  process.exit(1);
}

const tournament = await create.json();
const { id, pools } = tournament;
const matches = pools[0].matches; // single pool with 3 matches

// matches are: round 1 = Alice vs Bob, round 2 = ?, round 3 = ?
// We need: winner of each match is player1 of the *next* match — circular.
// Strategy: make player1 win every match (2-1).
// That gives player1 of each match 2 flags and player2 1 flag.
// In a 3-player pool, the circle method produces:
//   Round 1: players[0] vs players[2]
//   Round 2: players[0] vs players[1]
//   Round 3: players[1] vs players[2]
// We need A beat B, B beat C, C beat A — so we score selectively.

// Identify the three players
const [alice, bob, carol] = pools[0].playerIds.map(
  (pid) => tournament.players.find((p) => p.id === pid)
);

console.log(`Players: ${alice.name}, ${bob.name}, ${carol.name}`);
console.log(`Matches (${matches.length}):`);

// Build a lookup: for any match, who is player1 and player2?
function playerName(pid) {
  return tournament.players.find((p) => p.id === pid)?.name ?? pid;
}

// Score each match so the circular tie emerges:
//   We want: alice beats bob, bob beats carol, carol beats alice.
// For each match, determine flagsPlayer1 and flagsPlayer2 accordingly.

for (const match of matches) {
  const p1 = match.player1Id;
  const p2 = match.player2Id;
  const p1Name = playerName(p1);
  const p2Name = playerName(p2);

  // Determine who should win this match to build the cycle:
  // alice > bob, bob > carol, carol > alice
  const shouldP1Win =
    (p1 === alice.id && p2 === bob.id) ||
    (p1 === bob.id && p2 === carol.id) ||
    (p1 === carol.id && p2 === alice.id);

  const flagsPlayer1 = shouldP1Win ? 2 : 1;
  const flagsPlayer2 = shouldP1Win ? 1 : 2;

  console.log(`  Round ${match.round}: ${p1Name} vs ${p2Name} → ${p1Name} ${flagsPlayer1}–${flagsPlayer2} ${p2Name}`);

  const patch = await fetch(
    `${BASE}/api/tournaments/${id}/matches/${match.id}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ flagsPlayer1, flagsPlayer2 }),
    }
  );

  if (!patch.ok) {
    console.error(`  Failed to score match ${match.id}:`, await patch.text());
    process.exit(1);
  }
}

console.log(`
✓ Done. Open the manage page to see the run-off prompt:

  ${BASE}/manage/${id}

Public view:
  ${BASE}/view/${id}
`);
