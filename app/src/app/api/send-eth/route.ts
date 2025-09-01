import "server-only";
import { NextResponse } from "next/server";
import { ethers } from "ethers";
import {
  verifyAuthenticationResponse,
  type AuthenticationResponseJSON,
} from "@simplewebauthn/server";
import { parseSignature } from "webauthn-p256";

import EntryPointDeployment from "../../../../../lib/account-abstraction/deployments/ethereum/EntryPoint.json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PROVIDER_URL = process.env.PROVIDER_URL || "http://127.0.0.1:8545";
const DEFAULT_PRIVATE_KEY =
  process.env.DEPLOYER_PRIVATE_KEY ||
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const rpID = process.env.RP_ID || "localhost";
const origin = process.env.ORIGIN || `http://${rpID}:3000`;

function ok(json: any, init: number = 200) {
  return NextResponse.json(json, {
    status: init,
    headers: { "Cache-Control": "no-store" },
  });
}
function bad(json: any, init: number = 400) {
  return NextResponse.json(json, {
    status: init,
    headers: { "Cache-Control": "no-store" },
  });
}

type UserOp = {
  sender: string;
  nonce: string; // hex string
  initCode: string;
  callData: string;
  accountGasLimits: string; // packed
  preVerificationGas: string; // hex string
  gasFees: string; // packed
  paymasterAndData: string;
  signature: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      userOp: UserOp;
      assertion: AuthenticationResponseJSON;
    };

    const provider = new ethers.JsonRpcProvider(PROVIDER_URL);
    const signer = new ethers.Wallet(DEFAULT_PRIVATE_KEY, provider);

    const entryPointAddress = (EntryPointDeployment as any).address as string;
    const entryPointAbi = (EntryPointDeployment as any).abi;
    const entryPoint = new ethers.Contract(
      entryPointAddress,
      entryPointAbi,
      signer
    );

    // Recompute userOpHash to verify WebAuthn challenge
    const userOpForHash = { ...body.userOp, signature: "0x" };
    const userOpHash: string = await entryPoint.getUserOpHash(userOpForHash);
    const hashBytes = ethers.getBytes(userOpHash);
    const challengeB64Url = Buffer.from(hashBytes)
      .toString("base64")
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");

    // Verify assertion against this challenge
    const verification = await verifyAuthenticationResponse({
      response: body.assertion,
      expectedChallenge: challengeB64Url,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        counter: 0, // not tracked here
        id: body.assertion.id,
        publicKey: new Uint8Array(), // not needed when only validating signature/challenge
      },
      requireUserVerification: false,
    } as any);

    if (!verification.verified) {
      return bad({ error: "Authentication could not be verified" }, 400);
    }

    // Extract signature parts and encode contract-expected signature
    const base64urlToBuffer = (input: string): Buffer => {
      const pad = input.padEnd(
        input.length + ((4 - (input.length % 4)) % 4),
        "="
      );
      const base64 = pad.replace(/-/g, "+").replace(/_/g, "/");
      return Buffer.from(base64, "base64");
    };

    const authenticatorData =
      "0x" +
      base64urlToBuffer(body.assertion.response.authenticatorData).toString(
        "hex"
      );
    const clientDataJSONBuf = base64urlToBuffer(
      body.assertion.response.clientDataJSON
    );
    const clientDataJSON = clientDataJSONBuf.toString("utf8");
    const signatureBuf = base64urlToBuffer(body.assertion.response.signature);
    const { r, s } = parseSignature(new Uint8Array(signatureBuf));

    const challengeLocation = clientDataJSON.indexOf(
      `"challenge":"${challengeB64Url}"`
    );
    const typeLocation = clientDataJSON.indexOf('"type":"webauthn.get"');

    const signatureEncoded = ethers.AbiCoder.defaultAbiCoder().encode(
      ["bytes", "string", "uint256", "uint256", "uint256", "uint256"],
      [
        authenticatorData,
        clientDataJSON,
        BigInt(challengeLocation),
        BigInt(typeLocation),
        r,
        s,
      ]
    );

    const userOp: UserOp = { ...body.userOp, signature: signatureEncoded };

    // Submit userOp
    const handleOpsTx = await entryPoint.handleOps(
      [userOp],
      await signer.getAddress()
    );
    const receipt = await handleOpsTx.wait();

    return ok({ txHash: receipt.hash });
  } catch (err: any) {
    console.error("send-eth failed:", err);
    return bad({ error: err?.message ?? String(err) }, 500);
  }
}
