export const RANK_VALUES = [
  "7D", "6D", "5D", "4D", "3D", "2D", "1D",
  "1K", "2K", "3K", "4K", "5K", "6K", "7K", "MK",
] as const;

export type PlayerRank = typeof RANK_VALUES[number];

const RANK_SET = new Set<string>(RANK_VALUES);

/** Returns a seed value: lower number = stronger seed. Unranked players sort last. */
export function rankSeedValue(rank: string | undefined): number {
  if (!rank) return RANK_VALUES.length + 1;
  const idx = RANK_VALUES.indexOf(rank as PlayerRank);
  return idx === -1 ? RANK_VALUES.length : idx;
}

/** Normalizes free-text rank strings to a canonical value, or returns undefined. */
export function normalizeRank(raw: string): PlayerRank | undefined {
  const s = raw.trim().toUpperCase().replace(/[-\s]/g, "");
  if (RANK_SET.has(s)) return s as PlayerRank;
  // "5DAN" → "5D", "3KYU" → "3K"
  const danMatch = s.match(/^(\d+)DAN$/);
  if (danMatch) {
    const v = `${danMatch[1]}D`;
    if (RANK_SET.has(v)) return v as PlayerRank;
  }
  const kyuMatch = s.match(/^(\d+)KYU$/);
  if (kyuMatch) {
    const v = `${kyuMatch[1]}K`;
    if (RANK_SET.has(v)) return v as PlayerRank;
  }
  if (["MUKYUU", "MQ", "UNGRADED", "無級", "MUKYU"].includes(s)) return "MK";
  return undefined;
}
