// src/components/BracketTree.tsx
"use client";

import { EliminationMatch, Player } from "@/types";
import { roundLabel } from "@/lib/bracket";
import { displayName } from "@/lib/utils";

const BASE = {
  BOX_W: 180, BOX_H: 64, COL_W: 220, LBL_H: 32, SLOT_H: 90,
};

function scale(v: number, large: boolean) {
  return large ? Math.round(v * 1.4) : v;
}

function trunc(s: string, max = 22) {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

export interface BracketTreeProps {
  matches: EliminationMatch[];
  players: Player[];           // array — callers pass tournament.players directly
  totalRounds: number;
  large?: boolean;
  onMatchTap?: (matchId: string) => void;
}

export default function BracketTree({
  matches,
  players,
  totalRounds,
  large = false,
  onMatchTap,
}: BracketTreeProps) {
  if (matches.length === 0) return null;

  const B = { ...BASE };
  const BOX_W  = scale(B.BOX_W,  large);
  const BOX_H  = scale(B.BOX_H,  large);
  const COL_W  = scale(B.COL_W,  large);
  const LBL_H  = scale(B.LBL_H,  large);
  const SLOT_H = scale(B.SLOT_H, large);
  const FONT_NAME  = scale(13, large);
  const FONT_LABEL = scale(12, large);
  const PAD = scale(8, large);

  const derivedRounds = Math.max(...matches.map((m) => m.round));
  if (process.env.NODE_ENV === "development" && derivedRounds !== totalRounds) {
    console.warn(`BracketTree: totalRounds prop (${totalRounds}) differs from derived (${derivedRounds}); using derived.`);
  }
  const maxRound = derivedRounds;
  const firstRoundCount = matches.filter((m) => m.round === 1).length;

  const svgW = maxRound * COL_W;
  const svgH = LBL_H + firstRoundCount * SLOT_H + Math.round(SLOT_H / 2);

  function colX(round: number) { return (round - 1) * COL_W; }
  function cy(round: number, position: number) {
    const span = Math.pow(2, round - 1);
    return LBL_H + ((position - 1) * span + span / 2) * SLOT_H;
  }

  // Build connector paths
  const connectors: string[] = [];
  for (let r = 1; r < maxRound; r++) {
    const rMatches = matches.filter((m) => m.round === r).sort((a, b) => a.position - b.position);
    for (let i = 0; i < rMatches.length; i += 2) {
      const m1 = rMatches[i];
      const m2 = rMatches[i + 1];
      if (!m1 || !m2) continue;
      const exitX  = colX(r) + BOX_W;
      const midX   = exitX + Math.round((COL_W - BOX_W) / 2);
      const nextX  = colX(r + 1);
      const y1 = cy(r, m1.position);
      const y2 = cy(r, m2.position);
      const my = Math.round((y1 + y2) / 2);
      connectors.push(
        `M ${exitX} ${y1} H ${midX} V ${y2} M ${exitX} ${y2} H ${midX} M ${midX} ${my} H ${nextX}`
      );
    }
  }

  return (
    <div style={{ width: "100%", overflowX: "auto", overflowY: "visible" }}>
      <svg
        viewBox={`0 0 ${svgW} ${svgH}`}
        width={svgW}
        height={svgH}
        style={{ display: "block", minWidth: svgW }}
      >
        {/* Round labels */}
        {Array.from({ length: maxRound }, (_, i) => i + 1).map((round) => (
          <text
            key={round}
            x={colX(round) + Math.round(BOX_W / 2)}
            y={Math.round(LBL_H * 0.75)}
            textAnchor="middle"
            fontSize={FONT_LABEL}
            fontWeight="600"
            fill="var(--hd-subtle-text, #6b7280)"
            fontFamily="system-ui, sans-serif"
          >
            {roundLabel(round, maxRound).toUpperCase()}
          </text>
        ))}

        {/* Connectors */}
        {connectors.map((d, i) => (
          <path key={i} d={d} stroke="rgba(239,232,210,0.75)" strokeWidth={large ? 3 : 2} fill="none" />
        ))}

        {/* Match boxes */}
        {matches.map((match) => {
          const p1 = match.player1Id ? players.find((p) => p.id === match.player1Id) : null;
          const p2 = match.player2Id ? players.find((p) => p.id === match.player2Id) : null;
          const isBye = match.player1Source === "bye" || match.player2Source === "bye";
          const isScored = match.flagsP1 !== null && match.flagsP2 !== null;
          const p1Wins = isScored && match.winnerId === match.player1Id;
          const p2Wins = isScored && match.winnerId === match.player2Id;
          const bothKnown = match.player1Id !== null && match.player2Id !== null;

          const bx  = colX(match.round);
          const ctr = cy(match.round, match.position);
          const top = ctr - Math.round(BOX_H / 2);
          const mid = top + Math.round(BOX_H / 2);
          const scoreX = bx + BOX_W - PAD;
          const nameY1 = top + Math.round(BOX_H / 4);
          const nameY2 = top + Math.round((BOX_H * 3) / 4);

          const tappable = !!onMatchTap && bothKnown && !isBye;
          const handleTap = tappable ? () => onMatchTap!(match.id) : undefined;

          if (isBye) {
            const advancer = match.player1Source === "bye" ? p2 : p1;
            const name = advancer ? displayName(advancer) : "";
            return (
              <g key={match.id}>
                <rect x={bx} y={top} width={BOX_W} height={BOX_H} rx={4} fill="white" stroke="#e5e7eb" strokeWidth={1} />
                <text x={bx + PAD} y={ctr} dominantBaseline="central" fontSize={FONT_NAME} fill="#1f2937" fontFamily="system-ui, sans-serif">
                  {trunc(name)}
                </text>
                <text x={scoreX} y={ctr} dominantBaseline="central" textAnchor="end" fontSize={FONT_NAME - 2} fill="#9ca3af" fontFamily="system-ui, sans-serif">
                  bye
                </text>
              </g>
            );
          }

          const p1Name = p1 ? trunc(displayName(p1)) : "";
          const p2Name = p2 ? trunc(displayName(p2)) : "";

          return (
            <g
              key={match.id}
              onClick={handleTap}
              style={tappable ? { cursor: "pointer" } : undefined}
            >
              {p1Wins && <rect x={bx + 1} y={top + 1} width={BOX_W - 2} height={Math.round(BOX_H / 2) - 1} rx={3} fill="#f0fdf4" />}
              {p2Wins && <rect x={bx + 1} y={mid}     width={BOX_W - 2} height={Math.round(BOX_H / 2) - 1} rx={3} fill="#f0fdf4" />}
              <rect x={bx} y={top} width={BOX_W} height={BOX_H} rx={4} fill="white" stroke={tappable ? "#d1d5db" : "#e5e7eb"} strokeWidth={1} />
              <line x1={bx} y1={mid} x2={bx + BOX_W} y2={mid} stroke="#f3f4f6" strokeWidth={1} />
              {/* Player 1 */}
              <text x={bx + PAD} y={nameY1} dominantBaseline="central" fontSize={FONT_NAME} fill={p1Wins ? "#166534" : "#4b5563"} fontWeight={p1Wins ? "700" : "400"} fontFamily="system-ui, sans-serif">
                {p1Name}
              </text>
              {isScored && (
                <text x={scoreX} y={nameY1} dominantBaseline="central" textAnchor="end" fontSize={FONT_NAME} fill={p1Wins ? "#16a34a" : "#9ca3af"} fontWeight="600" fontFamily="system-ui, sans-serif">
                  {match.flagsP1}
                </text>
              )}
              {/* Player 2 */}
              <text x={bx + PAD} y={nameY2} dominantBaseline="central" fontSize={FONT_NAME} fill={p2Wins ? "#166534" : "#4b5563"} fontWeight={p2Wins ? "700" : "400"} fontFamily="system-ui, sans-serif">
                {p2Name}
              </text>
              {isScored && (
                <text x={scoreX} y={nameY2} dominantBaseline="central" textAnchor="end" fontSize={FONT_NAME} fill={p2Wins ? "#16a34a" : "#9ca3af"} fontWeight="600" fontFamily="system-ui, sans-serif">
                  {match.flagsP2}
                </text>
              )}
              {/* Invisible tap target (larger than visible box) */}
              {tappable && (
                <rect x={bx} y={top} width={BOX_W} height={BOX_H} rx={4} fill="transparent" />
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
