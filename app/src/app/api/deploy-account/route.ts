// app/api/deploy-account/route.ts
import "server-only";
import { NextResponse } from "next/server";
import { ethers } from "ethers";
import PasskeyAccountArtifact from "../../../../../out/PasskeyAccount.sol/PasskeyAccount.json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// WebAuthnVerifier on your chain
const WEB_AUTHN_VERIFIER_ADDRESS =
  process.env.VERIFIER_ADDRESS || "0xA15BB66138824a1c7167f5E85b957d04Dd34E468";

// Local RPC (Anvil by default)
const PROVIDER_URL = process.env.PROVIDER_URL || "http://127.0.0.1:8545";

// DO NOT put real keys here; override via env for your local node
const DEFAULT_PRIVATE_KEY =
  process.env.DEPLOYER_PRIVATE_KEY ||
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

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

export async function POST(req: Request) {
  try {
    const { pubKeyX, pubKeyY } = (await req.json()) as {
      pubKeyX?: string;
      pubKeyY?: string;
    };

    if (!pubKeyX || !pubKeyY) {
      return bad({ error: "Missing pubKeyX or pubKeyY" }, 400);
    }

    // Support Foundry/Hardhat style bytecode locations
    const abi = (PasskeyAccountArtifact as any).abi;
    const rawBytecode =
      (PasskeyAccountArtifact as any).bytecode?.object ??
      (PasskeyAccountArtifact as any).bytecode;

    if (!abi?.length || !rawBytecode || typeof rawBytecode !== "string") {
      return bad(
        {
          error:
            "PasskeyAccount artifact missing or malformed. Rebuild contracts and ensure ABI and bytecode are present.",
        },
        500
      );
    }

    // Connect provider & wallet (ethers v6)
    const provider = new ethers.JsonRpcProvider(PROVIDER_URL);
    const wallet = new ethers.Wallet(DEFAULT_PRIVATE_KEY, provider);

    // Create factory
    const factory = new ethers.ContractFactory(abi, rawBytecode, wallet);

    // Handle decimal or hex inputs, and make them BigInt
    const toBI = (v: string) => (v.startsWith("0x") ? BigInt(v) : BigInt(v));

    const x = toBI(pubKeyX);
    const y = toBI(pubKeyY);

    // Prepare tx to estimate gas
    const unsigned = await factory.getDeployTransaction(
      x,
      y,
      WEB_AUTHN_VERIFIER_ADDRESS
    );

    const gasEstimate = await provider.estimateGas({
      from: wallet.address,
      data: unsigned.data,
      // value not needed; constructor has no payable
    });

    const contract = await factory.deploy(x, y, WEB_AUTHN_VERIFIER_ADDRESS, {
      gasEstimate,
    });

    await contract.waitForDeployment();

    return ok({ address: contract.target as string });
  } catch (err: any) {
    console.error("Deployment failed:", err);
    return bad({ error: err?.message ?? String(err) }, 500);
  }
}

// Optional: block other methods (useful during local debugging)
export async function GET() {
  return bad({ error: "Method not allowed" }, 405);
}
