// src/components/ScorePanel.tsx
"use client";

import { EliminationMatch, Player } from "@/types";
import { displayName } from "@/lib/utils";

interface ScorePanelProps {
  match: EliminationMatch;
  players: Player[];
  onClose: () => void;
  onScore: (matchId: string, flagsP1: number, flagsP2: number) => void;
}

const SCORE_OPTIONS: { label: string; p1: number; p2: number }[] = [
  { label: "3 – 0", p1: 3, p2: 0 },
  { label: "2 – 1", p1: 2, p2: 1 },
  { label: "1 – 2", p1: 1, p2: 2 },
  { label: "0 – 3", p1: 0, p2: 3 },
];

export default function ScorePanel({ match, players, onClose, onScore }: ScorePanelProps) {
  const p1 = players.find((p) => p.id === match.player1Id);
  const p2 = players.find((p) => p.id === match.player2Id);
  const isScored = match.flagsP1 !== null && match.flagsP2 !== null;

  function isCurrent(opt: { p1: number; p2: number }) {
    return isScored && match.flagsP1 === opt.p1 && match.flagsP2 === opt.p2;
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0,
          backgroundColor: "rgba(0,0,0,0.45)",
          zIndex: 40,
        }}
      />
      {/* Panel */}
      <div
        style={{
          position: "fixed", bottom: 0, left: 0, right: 0,
          backgroundColor: "white",
          borderRadius: "16px 16px 0 0",
          padding: "20px 20px 36px",
          zIndex: 50,
        }}
      >
        {/* Handle */}
        <div style={{ width: 36, height: 4, backgroundColor: "#d1d5db", borderRadius: 2, margin: "0 auto 16px" }} />

        {/* Label */}
        <p style={{ textAlign: "center", fontSize: 11, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
          {isScored ? "Correct score" : "Score entry"}
        </p>

        {/* Player names */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 8 }}>
          <span style={{ fontWeight: 600, fontSize: 15, color: "#111" }}>{p1 ? displayName(p1) : "—"}</span>
          <span style={{ fontSize: 12, color: "#9ca3af", flexShrink: 0 }}>vs</span>
          <span style={{ fontWeight: 600, fontSize: 15, color: "#111", textAlign: "right" }}>{p2 ? displayName(p2) : "—"}</span>
        </div>

        {/* Score buttons */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {SCORE_OPTIONS.map((opt) => (
            <button
              key={opt.label}
              onClick={() => onScore(match.id, opt.p1, opt.p2)}
              style={{
                padding: "16px 0",
                fontSize: 16,
                fontWeight: 700,
                borderRadius: 10,
                border: isCurrent(opt) ? "2px solid #16a34a" : "1.5px solid #e5e7eb",
                backgroundColor: isCurrent(opt) ? "#f0fdf4" : "#f9fafb",
                color: isCurrent(opt) ? "#16a34a" : "#111",
                cursor: "pointer",
              }}
            >
              {opt.label}{isCurrent(opt) ? " ✓" : ""}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
