import fs from "fs";
import path from "path";
import { Tournament } from "@/types";

const DATA_DIR = path.join(process.cwd(), "data", "tournaments");

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function tournamentPath(id: string): string {
  return path.join(DATA_DIR, `${id}.json`);
}

export function saveTournament(tournament: Tournament): void {
  ensureDataDir();
  fs.writeFileSync(tournamentPath(tournament.id), JSON.stringify(tournament, null, 2), "utf-8");
}

export function loadTournament(id: string): Tournament | null {
  const filePath = tournamentPath(id);
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as Tournament;
}

export function listTournaments(): Tournament[] {
  ensureDataDir();
  const files = fs.readdirSync(DATA_DIR).filter((f) => f.endsWith(".json"));
  return files.map((f) => {
    const raw = fs.readFileSync(path.join(DATA_DIR, f), "utf-8");
    return JSON.parse(raw) as Tournament;
  });
}
