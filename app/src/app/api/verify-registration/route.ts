import { NextResponse } from "next/server";
import {
  verifyRegistrationResponse,
  type RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { parsePublicKey } from "webauthn-p256";
import { getUser, setRegistrationChallenge, addPasskey } from "@/lib/fakeDB";

export const runtime = "nodejs"; // uses Buffer/Node APIs
export const dynamic = "force-dynamic"; // never cache

export async function POST(req: Request) {
  try {
    const rpID = process.env.RP_ID || "localhost";
    const origin = process.env.ORIGIN || `http://${rpID}:3000`;

    const user = getUser();
    const expectedChallenge = user.currentRegistrationChallenge;
    if (!expectedChallenge) {
      return NextResponse.json(
        { error: "No challenge found for user" },
        { status: 400 }
      );
    }

    const body = (await req.json()) as RegistrationResponseJSON;

    const verification = await verifyRegistrationResponse({
      response: body,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: false,
    });

    const { verified, registrationInfo } = verification;
    if (!verified || !registrationInfo) {
      return NextResponse.json(
        { error: "Registration not verified" },
        { status: 400 }
      );
    }

    const credentialPublicKey = registrationInfo.credential.publicKey;
    const credentialID = registrationInfo.credential.id;
    const counter = registrationInfo.credential.counter;

    addPasskey({ id: credentialID, publicKey: credentialPublicKey, counter });

    const { x, y } = parsePublicKey(new Uint8Array(credentialPublicKey));

    // Clear challenge
    setRegistrationChallenge("");

    return NextResponse.json(
      {
        verified: true,
        pubKeyX: x.toString(),
        pubKeyY: y.toString(),
      },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch (err: any) {
    console.error("Registration verification failed:", err);
    return NextResponse.json(
      { error: err?.message ?? "Internal Server Error" },
      { status: 500 }
    );
  }
}

// Optional: reject other methods (helps local debugging)
export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
