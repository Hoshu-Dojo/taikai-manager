import { notFound } from "next/navigation";
import { loadTournament } from "@/lib/storage";
import ViewClient from "./ViewClient";

export default async function ViewPage({
  params,
}: {
  params: Promise<{ uuid: string }>;
}) {
  const { uuid } = await params;
  const tournament = await loadTournament(uuid);
  if (!tournament) notFound();

  return <ViewClient initialTournament={tournament} />;
}
