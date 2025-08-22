import "server-only";
import { NextResponse } from "next/server";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { getUser, setAuthenticationChallenge } from "@/lib/fakeDB";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const rpID = process.env.RP_ID || "localhost";

  const user = getUser();
  const allowCredentials = user.registeredPasskeys.map((pk) => ({ id: pk.id }));

  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: "preferred",
    allowCredentials,
  });

  setAuthenticationChallenge(options.challenge);

  return NextResponse.json(options, {
    status: 200,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
