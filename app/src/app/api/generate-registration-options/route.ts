import { NextResponse } from "next/server";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import { getUser, setRegistrationChallenge } from "@/lib/fakeDB";

// Keep this on the Node runtime; the server package may rely on Node APIs
export const runtime = "nodejs";
// Don’t cache: each call must return a fresh challenge
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rpName = "Passkey SmartAccount Demo";
    const rpID = process.env.RP_ID || "localhost";
    const origin = process.env.ORIGIN || `http://${rpID}:3000`; // not used by generateRegistrationOptions, but useful to keep configured

    const user = getUser();

    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userID: user.id,
      userName: user.username,
      attestationType: "none",
      authenticatorSelection: {
        residentKey: "discouraged",
        userVerification: "preferred",
      },
    });

    setRegistrationChallenge(options.challenge);

    return NextResponse.json(options, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Internal Server Error" },
      { status: 500 }
    );
  }
}
