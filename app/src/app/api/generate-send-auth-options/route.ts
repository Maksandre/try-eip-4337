import "server-only";
import { NextResponse } from "next/server";
import { ethers } from "ethers";
import { generateAuthenticationOptions } from "@simplewebauthn/server";

import EntryPointDeployment from "../../../../../lib/account-abstraction/deployments/ethereum/EntryPoint.json";
import PasskeyAccountArtifact from "../../../../../out/PasskeyAccount.sol/PasskeyAccount.json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PROVIDER_URL = process.env.PROVIDER_URL || "http://127.0.0.1:8545";
const rpID = process.env.RP_ID || "localhost";

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

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const sender = searchParams.get("sender");
    const to = searchParams.get("to");
    const valueEth = searchParams.get("valueEth");

    if (!sender || !ethers.isAddress(sender))
      return bad({ error: "Invalid sender" }, 400);
    if (!to || !ethers.isAddress(to))
      return bad({ error: "Invalid recipient" }, 400);
    if (!valueEth) return bad({ error: "Missing valueEth" }, 400);

    const value = ethers.parseEther(valueEth);

    const provider = new ethers.JsonRpcProvider(PROVIDER_URL);

    const entryPointAddress = (EntryPointDeployment as any).address as string;
    const entryPointAbi = (EntryPointDeployment as any).abi;
    const entryPoint = new ethers.Contract(
      entryPointAddress,
      entryPointAbi,
      provider
    );

    const nonce: bigint = await entryPoint.getNonce(sender, 0);

    const accountIface = new ethers.Interface(
      (PasskeyAccountArtifact as any).abi
    );
    const callData: string = accountIface.encodeFunctionData("execute", [
      to,
      value,
      "0x",
    ]);

    const fee = await provider.getFeeData();
    const maxFeePerGas = fee.maxFeePerGas ?? ethers.parseUnits("2", "gwei");
    const maxPriorityFeePerGas =
      fee.maxPriorityFeePerGas ?? ethers.parseUnits("1", "gwei");

    const packUints = (high: bigint, low: bigint): string => {
      const packed = (high << BigInt(128)) | low;
      return ethers.hexlify(ethers.zeroPadValue(ethers.toBeHex(packed), 32));
    };

    const callGasLimit = BigInt(200000);
    const verificationGasLimit = BigInt(300000);
    const accountGasLimits = packUints(verificationGasLimit, callGasLimit);
    const gasFees = packUints(maxPriorityFeePerGas, maxFeePerGas);

    const userOp = {
      sender,
      nonce: ethers.toBeHex(nonce),
      initCode: "0x",
      callData,
      accountGasLimits,
      preVerificationGas: ethers.toBeHex(BigInt(50000)),
      gasFees,
      paymasterAndData: "0x",
      signature: "0x",
    } as const;

    const userOpHash: string = await entryPoint.getUserOpHash(userOp);

    // Convert hash to base64url for WebAuthn challenge
    const hashBytes = ethers.getBytes(userOpHash);
    const challengeB64Url = Buffer.from(hashBytes)
      .toString("base64")
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");

    const options = await generateAuthenticationOptions({
      rpID,
      userVerification: "preferred",
      challenge: challengeB64Url,
    });

    return ok({ options, userOp });
  } catch (err: any) {
    return bad({ error: err?.message ?? String(err) }, 500);
  }
}
