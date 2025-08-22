import { NextRequest, NextResponse } from "next/server";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import {
  _challengeStore,
  _constants,
} from "../generate-registration-options/route";

const origin = process.env.WEBAUTHN_ORIGIN!;
const rpID = _constants.rpID;

// For demo only. Replace with your auth'd user id and persistence.
const USER_ID = "user-123";

export async function POST(req: NextRequest) {
  const body = await req.json();

  const expectedChallenge = _challengeStore.get(USER_ID);
  if (!expectedChallenge) {
    return NextResponse.json(
      { verified: false, error: "No challenge for user" },
      { status: 400 }
    );
  }

  try {
    const verification = await verifyRegistrationResponse({
      response: body,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      // requireUserVerification: true, // optional depending on your policy
    });

    if (verification.verified) {
      // Persist credential info for later authentication or on-chain export.
      // Example available fields:
      // const { registrationInfo } = verification;
      // const {
      //   credentialPublicKey, // COSE-encoded
      //   credentialID,        // Buffer
      //   counter,
      //   credentialBackedUp,
      //   credentialDeviceType,
      // } = registrationInfo!;

      // Clear the challenge
      _challengeStore.delete(USER_ID);

      return NextResponse.json({ verified: true });
    }

    return NextResponse.json({ verified: false, details: verification });
  } catch (err: any) {
    return NextResponse.json(
      { verified: false, error: String(err) },
      { status: 400 }
    );
  }
}
