import { notFound } from "next/navigation";
import { loadTournament } from "@/lib/storage";
import ManageClient from "./ManageClient";

export default async function ManagePage({
  params,
}: {
  params: Promise<{ uuid: string }>;
}) {
  const { uuid } = await params;
  const tournament = loadTournament(uuid);
  if (!tournament) notFound();

  return <ManageClient initialTournament={tournament} />;
}
