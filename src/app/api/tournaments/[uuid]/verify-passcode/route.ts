import { NextRequest, NextResponse } from "next/server";
import { loadTournament } from "@/lib/storage";
import { verifyPasscode } from "@/lib/auth";
import { isValidUUID } from "@/lib/utils";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ uuid: string }> }
) {
  const { uuid } = await params;
  if (!isValidUUID(uuid)) {
    return NextResponse.json({ error: "Invalid tournament ID." }, { status: 400 });
  }

  const tournament = await loadTournament(uuid);
  if (!tournament) {
    return NextResponse.json({ error: "Tournament not found." }, { status: 404 });
  }

  const body = await req.json();
  const { passcode } = body as { passcode: string };

  if (!passcode || typeof passcode !== "string") {
    return NextResponse.json({ error: "Passcode required." }, { status: 400 });
  }

  // Tournaments created before this feature have no hash — allow through.
  if (!tournament.passcodeHash || !tournament.passcodeSalt) {
    return NextResponse.json({ valid: true });
  }

  const valid = verifyPasscode(passcode, tournament.passcodeHash, tournament.passcodeSalt);
  if (!valid) {
    return NextResponse.json({ error: "Incorrect passcode." }, { status: 401 });
  }

  return NextResponse.json({ valid: true });
}
