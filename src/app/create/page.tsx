"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CreateTournament() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [playerInput, setPlayerInput] = useState("");
  const [players, setPlayers] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function addPlayer() {
    const trimmed = playerInput.trim();
    if (!trimmed) return;
    if (players.includes(trimmed)) {
      setError("That name is already in the list.");
      return;
    }
    setPlayers((prev) => [...prev, trimmed]);
    setPlayerInput("");
    setError("");
  }

  function removePlayer(name: string) {
    setPlayers((prev) => prev.filter((p) => p !== name));
  }

  function handlePlayerKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      addPlayer();
    }
  }

  function formatLabel(count: number): string {
    if (count < 4) return "";
    if (count <= 8) return `${count} players → single round-robin`;
    const pools = count <= 10 ? 2 : count <= 15 ? 3 : count <= 20 ? 4 : count <= 25 ? 5 : 6;
    return `${count} players → ${pools} pools + elimination bracket`;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!name.trim()) { setError("Enter a tournament name."); return; }
    if (!date) { setError("Enter a date."); return; }
    if (players.length < 4) { setError("Add at least 4 players."); return; }

    setLoading(true);
    try {
      const res = await fetch("/api/tournaments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), date, playerNames: players }),
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
            <label className="block text-sm font-medium mb-1" style={{ color: "var(--hd-inverse-text)" }}>
              Tournament name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Spring Taikai 2026"
              className="w-full border border-gray-300 rounded-lg px-4 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Date */}
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: "var(--hd-inverse-text)" }}>
              Date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Players */}
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: "var(--hd-inverse-text)" }}>
              Participants
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={playerInput}
                onChange={(e) => setPlayerInput(e.target.value)}
                onKeyDown={handlePlayerKeyDown}
                placeholder="Enter a name and press Add or Enter"
                className="flex-1 border border-gray-300 rounded-lg px-4 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={addPlayer}
                className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium px-4 py-2 rounded-lg transition-colors"
              >
                Add
              </button>
            </div>

            {players.length > 0 && (
              <ul className="mt-3 space-y-1">
                {players.map((p) => (
                  <li
                    key={p}
                    className="flex items-center justify-between bg-white border border-gray-200 rounded-lg px-4 py-2 text-gray-800"
                  >
                    <span>{p}</span>
                    <button
                      type="button"
                      onClick={() => removePlayer(p)}
                      className="text-gray-400 hover:text-red-500 text-sm transition-colors"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {players.length >= 4 && (
              <p className="mt-2 text-sm font-medium" style={{ color: "var(--hd-accent)" }}>
                {formatLabel(players.length)}
              </p>
            )}
          </div>

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
