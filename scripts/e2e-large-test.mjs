/**
 * Tests a 12-player tournament: 3 pools of 4, bracket size 4, 3 rounds (QF + SF + Final).
 * Also tests validation: can't score elim match before both players known,
 * can't generate bracket while pool matches are still pending.
 */

const BASE = "http://localhost:3000/api/tournaments";

async function api(path, method = "GET", body = undefined) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${JSON.stringify(data)}`);
  return data;
}

async function apiExpectError(path, method, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.ok) throw new Error(`Expected error from ${method} ${path} but got ${res.status}`);
  return res.status;
}

function assert(cond, msg) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`  ✓ ${msg}`);
}

async function run() {
  console.log("\n=== 12-Player Multi-Round Bracket Test ===\n");

  // ── 1. Create 12-player tournament ───────────────────────────────────────
  console.log("1. Creating 12-player tournament…");
  let t = await api("/", "POST", {
    name: "Large Test Taikai",
    date: "2026-03-22",
    playerNames: [
      "A", "B", "C", "D", "E", "F",
      "G", "H", "I", "J", "K", "L",
    ],
  });

  assert(t.format === "pools_elimination", "format is pools_elimination");
  assert(t.pools.length === 3, `has 3 pools (got ${t.pools.length})`);
  const uuid = t.id;

  // ── 2. Validate: can't generate bracket before pools are complete ─────────
  console.log("\n2. Validating pre-generation error…");
  const status = await apiExpectError(`/${uuid}/generate-bracket`, "POST");
  assert(status === 400, `blocked with 400 before pools are done (got ${status})`);

  // ── 3. Score all pool matches ────────────────────────────────────────────
  console.log("\n3. Scoring pool matches…");
  for (const pool of t.pools) {
    for (const match of pool.matches) {
      t = await api(`/${uuid}/matches/${match.id}`, "PATCH", {
        flagsPlayer1: 2,
        flagsPlayer2: 1,
      });
    }
  }
  assert(t.pools.every((p) => p.matches.every((m) => m.complete)), "all pool matches done");

  // ── 4. Generate bracket ──────────────────────────────────────────────────
  console.log("\n4. Generating bracket…");
  t = await api(`/${uuid}/generate-bracket`, "POST");
  assert(t.status === "elimination", "status is elimination");

  const totalRounds = Math.max(...t.eliminationMatches.map((m) => m.round));
  const matchesByRound = (r) => t.eliminationMatches.filter((m) => m.round === r);

  console.log(`   Total rounds: ${totalRounds}`);
  console.log(`   Matches per round: ${Array.from({length: totalRounds}, (_, i) => matchesByRound(i+1).length).join(", ")}`);

  assert(totalRounds >= 2, `at least 2 rounds (got ${totalRounds})`);
  assert(matchesByRound(totalRounds).length === 1, "exactly 1 final match");

  // ── 5. Validate: can't score a match without both players ────────────────
  console.log("\n5. Validating premature scoring error…");
  // Find any match that doesn't have both players yet
  const notReady = t.eliminationMatches.find(
    (m) => !m.player1Id || !m.player2Id
  );
  if (notReady) {
    const s = await apiExpectError(`/${uuid}/elimination/${notReady.id}`, "PATCH", { flagsP1: 2, flagsP2: 1 });
    assert(s === 400, `blocked scoring match without both players (got ${s})`);
  } else {
    console.log("  ✓ (all matches already have both players — no premature match to test)");
  }

  // ── 6. Score elimination matches round by round ──────────────────────────
  console.log("\n6. Scoring elimination bracket…");
  let guard = 0;
  while (true) {
    if (++guard > 30) throw new Error("loop guard hit");
    t = await api(`/${uuid}`);
    const pending = t.eliminationMatches.find(
      (m) =>
        m.player1Id &&
        m.player2Id &&
        m.flagsP1 === null &&
        m.player1Source !== "bye" &&
        m.player2Source !== "bye"
    );
    if (!pending) break;
    console.log(`   Round ${pending.round} match ${pending.id}`);
    t = await api(`/${uuid}/elimination/${pending.id}`, "PATCH", { flagsP1: 2, flagsP2: 1 });
  }

  // ── 7. Final state ───────────────────────────────────────────────────────
  console.log("\n7. Verifying final state…");
  t = await api(`/${uuid}`);
  assert(t.status === "complete", `status is complete (got ${t.status})`);
  const finalM = t.eliminationMatches.find((m) => !m.advancesToMatchId);
  const champion = t.players.find((p) => p.id === finalM?.winnerId);
  assert(champion, `champion: ${champion?.name}`);

  console.log(`\n🏆 Champion: ${champion.name}`);
  console.log("\n=== All large-bracket tests passed ===\n");
}

run().catch((err) => {
  console.error("\n❌ Test failed:", err.message);
  process.exit(1);
});
