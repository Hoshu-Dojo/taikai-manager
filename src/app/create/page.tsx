"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { displayName } from "@/lib/utils";
import { RANK_VALUES, normalizeRank } from "@/lib/ranks";

const DAN_RANKS = RANK_VALUES.filter((r) => r.endsWith("D"));
const KYU_RANKS = RANK_VALUES.filter((r) => r.endsWith("K") || r === "MK");

export default function CreateTournament() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [playerInput, setPlayerInput] = useState("");
  const [rankInput, setRankInput] = useState("");
  const [players, setPlayers] = useState<{ name: string; rank: string }[]>([]);
  const [formatOverride, setFormatOverride] = useState<"auto" | "single_elimination">("auto");
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkInput, setBulkInput] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const isSingleElim = formatOverride === "single_elimination";

  function addPlayer() {
    const trimmed = playerInput.trim();
    if (!trimmed) return;
    if (isSingleElim && !rankInput) {
      setError("Rank is required for single elimination tournaments.");
      return;
    }
    if (players.some((p) => p.name === trimmed)) {
      setError("That name is already in the list.");
      return;
    }
    setPlayers((prev) => [...prev, { name: trimmed, rank: rankInput }]);
    setPlayerInput("");
    setRankInput("");
    setError("");
  }

  function addBulk() {
    const lines = bulkInput.split("\n").map((l) => l.trim()).filter(Boolean);
    const added: string[] = [];
    const skipped: string[] = [];
    const next = [...players];
    for (const line of lines) {
      const commaIdx = line.lastIndexOf(",");
      let pName: string;
      let pRank: string;
      if (commaIdx !== -1) {
        pName = line.slice(0, commaIdx).trim();
        const rawRank = line.slice(commaIdx + 1).trim();
        pRank = normalizeRank(rawRank) ?? rawRank;
      } else {
        pName = line;
        pRank = "";
      }
      if (!pName) continue;
      if (next.some((p) => p.name === pName)) {
        skipped.push(pName);
      } else {
        next.push({ name: pName, rank: pRank });
        added.push(pName);
      }
    }
    setPlayers(next);
    setBulkInput("");
    setBulkMode(false);
    if (skipped.length > 0) {
      setError(`Added ${added.length}. Skipped duplicates: ${skipped.join(", ")}.`);
    } else {
      setError("");
    }
  }

  function removePlayer(playerName: string) {
    setPlayers((prev) => prev.filter((p) => p.name !== playerName));
  }

  function handlePlayerKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      addPlayer();
    }
  }

  function formatLabel(count: number): string {
    if (count < 4) return "";
    if (isSingleElim) {
      const bracket = Math.pow(2, Math.ceil(Math.log2(count)));
      const byes = bracket - count;
      return `${count} players → single elimination bracket${byes > 0 ? ` · ${byes} bye${byes > 1 ? "s" : ""}` : ""}`;
    }
    if (count <= 5) return `${count} players → single round-robin`;
    const pools = Math.floor(count / 3);
    return `${count} players → ${pools} pools of 3–4 · top 1 per pool advances`;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!name.trim()) { setError("Enter a tournament name."); return; }
    if (!date) { setError("Enter a date."); return; }
    if (players.length < 4) { setError("Add at least 4 players."); return; }
    if (isSingleElim && players.some((p) => !p.rank)) {
      setError("All participants need a rank for single elimination tournaments.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/tournaments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          date,
          formatOverride: isSingleElim ? "single_elimination" : undefined,
          players: players.map((p) => ({ name: p.name, rank: p.rank || undefined })),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Something went wrong.");
        return;
      }

      const tournament = await res.json();
      router.push(`/manage/${tournament.id}`);
    } catch {
      setError("Could not connect to the server.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen p-6" style={{ backgroundColor: "var(--hd-page-bg)" }}>
      <div className="max-w-lg mx-auto space-y-6">
        <h1 className="text-2xl font-serif font-semibold" style={{ color: "var(--hd-inverse-text)" }}>New Tournament</h1>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Name */}
          <div>
            <label htmlFor="tournament-name" className="block text-sm font-medium mb-1" style={{ color: "var(--hd-inverse-text)" }}>
              Tournament name
            </label>
            <input
              id="tournament-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Spring Taikai 2026"
              className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#4242C3]"
            />
          </div>

          {/* Date */}
          <div>
            <label htmlFor="tournament-date" className="block text-sm font-medium mb-1" style={{ color: "var(--hd-inverse-text)" }}>
              Date
            </label>
            <input
              id="tournament-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#4242C3]"
            />
          </div>

          {/* Players */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="player-name" className="block text-sm font-medium" style={{ color: "var(--hd-inverse-text)" }}>
                Participants
                {isSingleElim && (
                  <span className="ml-2 text-xs font-normal" style={{ color: "var(--hd-subtle-text)" }}>
                    seeded automatically by rank
                  </span>
                )}
              </label>
              <button
                type="button"
                onClick={() => { setBulkMode((v) => !v); setError(""); }}
                className="text-xs underline"
                style={{ color: "var(--hd-accent)" }}
              >
                {bulkMode ? "Add one at a time" : "Paste a list"}
              </button>
            </div>

            {bulkMode ? (
              <div className="space-y-2">
                <textarea
                  autoFocus
                  value={bulkInput}
                  onChange={(e) => setBulkInput(e.target.value)}
                  rows={6}
                  placeholder={"Tanaka Kenji, 5D\nYamamoto Hiroshi, 4-dan\nSmith Sarah, 3kyu"}
                  className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#4242C3] font-mono text-sm"
                />
                <p className="text-xs text-gray-500">
                  One name per line. Rank after a comma: <em>Tanaka Kenji, 5D</em> or <em>Tanaka Kenji, 5-dan</em>
                </p>
                <button
                  type="button"
                  onClick={addBulk}
                  disabled={!bulkInput.trim()}
                  className="bg-gray-200 hover:bg-gray-300 disabled:opacity-40 text-gray-800 font-medium px-4 py-2 rounded-lg transition-colors"
                >
                  Add All
                </button>
              </div>
            ) : (
              <>
                <div className="flex gap-2">
                  <input
                    id="player-name"
                    type="text"
                    value={playerInput}
                    onChange={(e) => setPlayerInput(e.target.value)}
                    onKeyDown={handlePlayerKeyDown}
                    placeholder="Name"
                    className="flex-1 bg-white border border-gray-300 rounded-lg px-4 py-2 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#4242C3]"
                  />
                  <select
                    value={rankInput}
                    onChange={(e) => setRankInput(e.target.value)}
                    className="w-24 bg-white border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#4242C3]"
                  >
                    {!isSingleElim && <option value="">—</option>}
                    {isSingleElim && <option value="" disabled>Rank</option>}
                    <optgroup label="Dan">
                      {DAN_RANKS.map((r) => <option key={r} value={r}>{r}</option>)}
                    </optgroup>
                    <optgroup label="Kyu">
                      {KYU_RANKS.map((r) => <option key={r} value={r}>{r}</option>)}
                    </optgroup>
                  </select>
                  <button
                    type="button"
                    onClick={addPlayer}
                    className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium px-4 py-2 rounded-lg transition-colors"
                  >
                    Add
                  </button>
                </div>
                {!isSingleElim && (
                  <p className="mt-1 text-xs text-gray-500">Rank is optional.</p>
                )}
              </>
            )}

            {players.length > 0 && (
              <ul className="mt-3 space-y-1">
                {players.map((p, i) => (
                  <li
                    key={p.name}
                    className="flex items-center justify-between bg-white border border-gray-200 rounded-lg px-4 py-2 text-gray-800"
                  >
                    <span className="flex items-center gap-2">
                      {isSingleElim && (
                        <span className="text-xs font-mono text-gray-400 w-5 text-right shrink-0">{i + 1}.</span>
                      )}
                      {displayName(p)}
                      {isSingleElim && !p.rank && (
                        <span className="text-xs text-red-500">no rank</span>
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => removePlayer(p.name)}
                      className="text-gray-600 hover:text-red-600 text-sm transition-colors ml-4 shrink-0"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {players.length >= 4 && (
              <p className="mt-2 text-sm font-medium" style={{ color: "var(--hd-accent-secondary)" }}>
                {formatLabel(players.length)}
              </p>
            )}
          </div>

          {/* Format choice — shown once there are enough players */}
          {players.length >= 4 && (
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: "var(--hd-inverse-text)" }}>
                Format
              </label>
              <div className="space-y-2">
                {(["auto", "single_elimination"] as const).map((choice) => (
                  <label
                    key={choice}
                    className={`flex items-start gap-3 cursor-pointer bg-white border rounded-lg px-4 py-3 transition-colors ${formatOverride === choice ? "border-[#4242C3]" : "border-gray-200 hover:border-gray-300"}`}
                  >
                    <input
                      type="radio"
                      name="formatOverride"
                      value={choice}
                      checked={formatOverride === choice}
                      onChange={() => setFormatOverride(choice)}
                      className="mt-0.5 accent-[#4242C3]"
                    />
                    <div>
                      <span className="text-sm font-medium text-gray-900">
                        {choice === "auto" ? "Standard format" : "Single elimination bracket"}
                      </span>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {choice === "auto"
                          ? players.length <= 5
                            ? "Everyone plays everyone once. Final ranking by total flags."
                            : "Players compete in round-robin pools. Top finisher per pool advances to a knockout bracket."
                          : "Straight knockout. Bracket seeded automatically by rank."}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full disabled:opacity-50 font-semibold px-6 py-3 rounded-lg transition-colors"
            style={{ backgroundColor: "var(--hd-accent)", color: "var(--hd-inverse-text)" }}
          >
            {loading ? "Creating…" : "Create Tournament"}
          </button>
        </form>
      </div>
    </main>
  );
}
