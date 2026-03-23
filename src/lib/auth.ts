import { pbkdf2Sync, randomBytes, timingSafeEqual } from "crypto";
import type { NextRequest } from "next/server";

export function hashPasscode(passcode: string): { hash: string; salt: string } {
  const salt = randomBytes(16).toString("hex");
  const hash = pbkdf2Sync(passcode, salt, 100_000, 64, "sha256").toString("hex");
  return { hash, salt };
}

export function verifyPasscode(
  candidate: string,
  hash: string,
  salt: string
): boolean {
  const candidateBuf = pbkdf2Sync(candidate, salt, 100_000, 64, "sha256");
  const hashBuf = Buffer.from(hash, "hex");
  if (candidateBuf.length !== hashBuf.length) return false;
  return timingSafeEqual(candidateBuf, hashBuf);
}

/** Returns true if the request carries a valid passcode header, or if the
 *  tournament pre-dates the passcode feature (no hash stored). */
export function checkPasscodeHeader(
  req: NextRequest,
  passcodeHash: string | undefined,
  passcodeSalt: string | undefined
): boolean {
  if (!passcodeHash || !passcodeSalt) return true;
  const passcode = req.headers.get("x-tournament-passcode");
  if (!passcode) return false;
  return verifyPasscode(passcode, passcodeHash, passcodeSalt);
}

/** Removes credential fields before sending a tournament to the client. */
export function sanitizeTournament<
  T extends { passcodeHash?: string; passcodeSalt?: string }
>(tournament: T): Omit<T, "passcodeHash" | "passcodeSalt"> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passcodeHash: _h, passcodeSalt: _s, ...rest } = tournament;
  return rest;
}
