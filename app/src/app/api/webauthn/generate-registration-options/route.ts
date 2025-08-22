import { NextResponse } from "next/server";
import { generateRegistrationOptions } from "@simplewebauthn/server";

const rpName = process.env.WEBAUTHN_RP_NAME!;
const rpID = process.env.WEBAUTHN_RP_ID!;

// For demo only. Replace with your auth'd user id and persistence.
const USER_ID = "user-123";
const USER_NAME = "max@example.com";

// Very naive in-memory store
const challengeStore = new Map<string, string>();

export async function GET() {
  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    // userID: USER_ID,
    userName: USER_NAME,
  });

  // Store challenge for this user
  challengeStore.set(USER_ID, options.challenge);

  return NextResponse.json(options);
}

// Export for the verify route to read (demo-only)
export const _challengeStore = challengeStore;
export const _constants = { rpID };
