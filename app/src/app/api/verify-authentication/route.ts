import "server-only";
import { NextResponse } from "next/server";
import {
  verifyAuthenticationResponse,
  type AuthenticationResponseJSON,
} from "@simplewebauthn/server";
import { parseSignature } from "webauthn-p256";
import { getUser, findPasskey, updatePasskeyCounter } from "@/lib/fakeDB";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const rpID = process.env.RP_ID || "localhost";
const origin = process.env.ORIGIN || `http://${rpID}:3000`;

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(req: Request) {
  const user = getUser();
  const expectedChallenge = user.currentAuthenticationChallenge;

  if (!expectedChallenge) {
    return json({ error: "No authentication challenge present" }, 400);
  }

  const body = (await req.json()) as AuthenticationResponseJSON;

  const storedPasskey = findPasskey(body.id);
  if (!storedPasskey) {
    return json({ error: `Unknown credential ID ${body.id}` }, 400);
  }

  try {
    const verification = await verifyAuthenticationResponse({
      response: body,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        counter: storedPasskey.counter,
        id: storedPasskey.id,
        publicKey: storedPasskey.publicKey,
      },
      requireUserVerification: false,
    });

    const { verified, authenticationInfo } = verification;
    if (!verified || !authenticationInfo) {
      return json({ error: "Authentication could not be verified" }, 400);
    }

    // Update counter
    updatePasskeyCounter(storedPasskey.id, authenticationInfo.newCounter);

    // Decode base64url fields for contract use
    const base64urlToBuffer = (input: string): Buffer => {
      const pad = input.padEnd(
        input.length + ((4 - (input.length % 4)) % 4),
        "="
      );
      const base64 = pad.replace(/-/g, "+").replace(/_/g, "/");
      return Buffer.from(base64, "base64");
    };

    const authenticatorDataBuf = base64urlToBuffer(
      body.response.authenticatorData
    );
    const clientDataJSONBuf = base64urlToBuffer(body.response.clientDataJSON);
    const signatureBuf = base64urlToBuffer(body.response.signature);

    const clientDataJSONString = clientDataJSONBuf.toString("utf8");
    const challengeLocation = clientDataJSONString.indexOf(
      `"challenge":"${expectedChallenge}"`
    );
    const typeLocation = clientDataJSONString.indexOf('"type":"webauthn.get"');

    const { r, s } = parseSignature(new Uint8Array(signatureBuf));

    return json({
      verified: true,
      authenticatorData: "0x" + authenticatorDataBuf.toString("hex"),
      clientDataJSON: clientDataJSONString,
      challengeLocation,
      typeLocation,
      r: r.toString(),
      s: s.toString(),
    });
  } catch (err: any) {
    console.error("Authentication verification failed:", err);
    return json({ error: err?.message ?? String(err) }, 400);
  }
}

export async function GET() {
  return json({ error: "Method not allowed" }, 405);
}
