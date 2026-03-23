import { Player } from "@/types";

export function displayName(player: Pick<Player, "name" | "rank">): string {
  return player.rank ? `${player.name} (${player.rank})` : player.name;
}
