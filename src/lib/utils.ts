import { Player } from "@/types";

export function displayName(player: Pick<Player, "name" | "rank">): string {
  return player.rank ? `${player.name} (${player.rank})` : player.name;
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUUID(value: string): boolean {
  return UUID_REGEX.test(value);
}
