import { notFound } from "next/navigation";
import { loadTournament } from "@/lib/storage";
import DisplayClient from "./DisplayClient";

export default async function DisplayPage({
  params,
}: {
  params: Promise<{ uuid: string }>;
}) {
  const { uuid } = await params;
  const tournament = await loadTournament(uuid);
  if (!tournament) notFound();

  return <DisplayClient initialTournament={tournament} />;
}
