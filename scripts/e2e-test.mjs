/**
 * End-to-end test for Phase 2.
 * Creates a 9-player tournament, scores all pool matches,
 * generates the elimination bracket, scores it to completion,
 * and verifies the final state.
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

function assert(cond, msg) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`  ✓ ${msg}`);
}

// Score a pool match 2-1 for player1
async function scorePoolMatch(uuid, matchId) {
  return api(`/${uuid}/matches/${matchId}`, "PATCH", { flagsPlayer1: 2, flagsPlayer2: 1 });
}

// Score an elimination match 2-1 for player1
async function scoreElimMatch(uuid, matchId) {
  return api(`/${uuid}/elimination/${matchId}`, "PATCH", { flagsP1: 2, flagsP2: 1 });
}

async function run() {
  console.log("\n=== Phase 2 End-to-End Test ===\n");

  // ── 1. Create tournament (9 players → pools_elimination) ──────────────────
  console.log("1. Creating 9-player tournament…");
  let t = await api("/", "POST", {
    name: "E2E Test Taikai",
    date: "2026-03-22",
    playerNames: ["Alice", "Bob", "Carol", "Dave", "Eve", "Frank", "Grace", "Hank", "Ivy"],
  });

  assert(t.format === "pools_elimination", `format is pools_elimination (got ${t.format})`);
  assert(t.status === "pool_play", `status starts as pool_play`);
  assert(t.pools.length >= 2, `has ${t.pools.length} pools`);
  assert(t.eliminationMatches.length === 0, `no elimination matches yet`);
  const uuid = t.id;

  // ── 2. Score all pool matches ──────────────────────────────────────────────
  console.log("\n2. Scoring all pool matches…");
  for (const pool of t.pools) {
    console.log(`   Pool: ${pool.name} (${pool.matches.length} matches)`);
    for (const match of pool.matches) {
      t = await scorePoolMatch(uuid, match.id);
    }
  }

  // Verify all pools complete
  assert(
    t.pools.every((p) => p.matches.every((m) => m.complete)),
    "all pool matches marked complete"
  );
  assert(t.status === "pool_play", "status still pool_play (bracket not yet generated)");

  // ── 3. Attempt to score a non-existent elimination match (should 404) ──────
  console.log("\n3. Testing error cases…");
  try {
    await api(`/${uuid}/elimination/em_999`, "PATCH", { flagsP1: 2, flagsP2: 1 });
    assert(false, "should have thrown for unknown match");
  } catch (e) {
    assert(e.message.includes("404") || e.message.includes("not found") || e.message.includes("Match"), "404 for unknown elimination match");
  }

  // Attempt to generate bracket twice (second should fail)
  // (First: actually generate it)
  console.log("\n4. Generating elimination bracket…");
  t = await api(`/${uuid}/generate-bracket`, "POST");

  assert(t.status === "elimination", "status updated to elimination");
  assert(t.eliminationMatches.length > 0, `${t.eliminationMatches.length} elimination matches created`);

  const rounds = [...new Set(t.eliminationMatches.map((m) => m.round))].sort();
  console.log(`   Rounds: ${rounds.join(", ")} | Matches: ${t.eliminationMatches.length}`);

  // Verify bracket structure
  const finalMatch = t.eliminationMatches.find((m) => !m.advancesToMatchId);
  assert(finalMatch, "final match exists (advancesToMatchId = null)");

  const r1Matches = t.eliminationMatches.filter((m) => m.round === 1);
  assert(r1Matches.length >= 1, `round 1 has ${r1Matches.length} match(es)`);

  // All round-1 matches where both players are real (not bye) have player IDs set
  const realR1 = r1Matches.filter(
    (m) => m.player1Source !== "bye" && m.player2Source !== "bye"
  );
  assert(
    realR1.every((m) => m.player1Id && m.player2Id),
    "all real round-1 matches have both player IDs"
  );

  // Bye matches are pre-completed
  const byeMatches = r1Matches.filter(
    (m) => m.player1Source === "bye" || m.player2Source === "bye"
  );
  if (byeMatches.length > 0) {
    assert(
      byeMatches.every((m) => m.winnerId !== null),
      `${byeMatches.length} bye match(es) are pre-completed`
    );
  }

  // Attempt second generate (should fail)
  try {
    await api(`/${uuid}/generate-bracket`, "POST");
    assert(false, "should have rejected second generate attempt");
  } catch (e) {
    assert(e.message.includes("400") || e.message.includes("already"), "second generate attempt rejected");
  }

  // ── 5. Score elimination matches round by round ───────────────────────────
  console.log("\n5. Scoring elimination matches…");
  t = await api(`/${uuid}`); // fresh copy

  let iterGuard = 0;
  while (true) {
    if (++iterGuard > 20) throw new Error("too many scoring iterations");

    // Find a match that has both players and is not yet scored
    const pending = t.eliminationMatches.find(
      (m) =>
        m.player1Id &&
        m.player2Id &&
        m.flagsP1 === null &&
        m.player1Source !== "bye" &&
        m.player2Source !== "bye"
    );

    if (!pending) break;

    console.log(`   Scoring ${pending.id} (round ${pending.round}): ${pending.player1Id} vs ${pending.player2Id}`);
    t = await scoreElimMatch(uuid, pending.id);
  }

  // ── 6. Verify tournament is complete ──────────────────────────────────────
  console.log("\n6. Verifying final state…");
  t = await api(`/${uuid}`);

  assert(t.status === "complete", `status is complete (got ${t.status})`);

  const champion = (() => {
    const fm = t.eliminationMatches.find((m) => !m.advancesToMatchId);
    return t.players.find((p) => p.id === fm?.winnerId);
  })();
  assert(champion, `champion determined: ${champion?.name}`);

  // All elimination matches scored
  const unscored = t.eliminationMatches.filter(
    (m) =>
      m.player1Source !== "bye" &&
      m.player2Source !== "bye" &&
      m.flagsP1 === null
  );
  assert(unscored.length === 0, "all real elimination matches are scored");

  console.log(`\n🏆 Champion: ${champion.name}`);
  console.log("\n=== All tests passed ===\n");
}

run().catch((err) => {
  console.error("\n❌ Test failed:", err.message);
  process.exit(1);
});
