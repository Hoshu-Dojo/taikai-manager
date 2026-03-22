/**
 * End-to-end test for round-robin format (≤8 players).
 * Verifies tournament auto-completes when last match is scored.
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

async function run() {
  console.log("\n=== Round-Robin End-to-End Test ===\n");

  // ── 1. Create 6-player tournament ────────────────────────────────────────
  console.log("1. Creating 6-player round-robin tournament…");
  let t = await api("/", "POST", {
    name: "RR Test Taikai",
    date: "2026-03-22",
    playerNames: ["Alice", "Bob", "Carol", "Dave", "Eve", "Frank"],
  });

  assert(t.format === "round_robin", `format is round_robin (got ${t.format})`);
  assert(t.status === "pool_play", "status starts as pool_play");
  assert(t.pools.length === 1, "has exactly 1 pool");
  const uuid = t.id;
  const pool = t.pools[0];
  console.log(`   Pool: ${pool.name} (${pool.matches.length} matches)`);

  // ── 2. Score all but the last match ──────────────────────────────────────
  console.log("\n2. Scoring all but the last match…");
  const allMatches = pool.matches;
  for (let i = 0; i < allMatches.length - 1; i++) {
    t = await api(`/${uuid}/matches/${allMatches[i].id}`, "PATCH", {
      flagsPlayer1: 3,
      flagsPlayer2: 0,
    });
  }
  assert(t.status === "pool_play", "status still pool_play before last match");

  // ── 3. Score last match — should trigger complete ─────────────────────────
  console.log("\n3. Scoring final match…");
  const last = allMatches[allMatches.length - 1];
  t = await api(`/${uuid}/matches/${last.id}`, "PATCH", {
    flagsPlayer1: 2,
    flagsPlayer2: 1,
  });
  assert(t.status === "complete", `status auto-set to complete (got ${t.status})`);

  // Verify no elimination matches (round_robin has none)
  assert(t.eliminationMatches.length === 0, "no elimination matches for round-robin");

  console.log("\n=== All round-robin tests passed ===\n");
}

run().catch((err) => {
  console.error("\n❌ Test failed:", err.message);
  process.exit(1);
});
