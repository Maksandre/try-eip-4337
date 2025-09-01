import "server-only";
import { NextResponse } from "next/server";
import { ethers } from "ethers";

import EntryPointDeployment from "../../../../../lib/account-abstraction/deployments/ethereum/EntryPoint.json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PROVIDER_URL = process.env.PROVIDER_URL || "http://127.0.0.1:8545";

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
    const address = searchParams.get("address");
    if (!address || !ethers.isAddress(address)) {
      return bad({ error: "Missing or invalid address" }, 400);
    }

    const provider = new ethers.JsonRpcProvider(PROVIDER_URL);

    const ethBalanceWei = await provider.getBalance(address);

    const entryPointAddress = (EntryPointDeployment as any).address as string;
    const entryPointAbi = (EntryPointDeployment as any).abi;
    if (!entryPointAddress || !entryPointAbi) {
      return bad({ error: "EntryPoint deployment not found" }, 500);
    }

    const entryPoint = new ethers.Contract(
      entryPointAddress,
      entryPointAbi,
      provider
    );

    let depositWei: bigint | null = null;
    try {
      // Prefer getDepositInfo if available; fallback to balanceOf
      if (typeof entryPoint.getDepositInfo === "function") {
        const info = await entryPoint.getDepositInfo(address);
        // info has .deposit for current deposit on some versions
        if (info && typeof info.deposit === "bigint") {
          depositWei = info.deposit as bigint;
        } else if (info && info[0] !== undefined) {
          depositWei = info[0] as bigint;
        }
      }
    } catch (_) {
      // ignore and try fallback
    }

    if (depositWei === null) {
      try {
        if (typeof entryPoint.balanceOf === "function") {
          depositWei = (await entryPoint.balanceOf(address)) as bigint;
        }
      } catch (_) {
        depositWei = 0n;
      }
    }

    return ok({
      address,
      ethBalanceWei: ethBalanceWei.toString(),
      ethBalanceEth: ethers.formatEther(ethBalanceWei),
      entryPointDepositWei: (depositWei ?? 0n).toString(),
      entryPointDepositEth: ethers.formatEther(depositWei ?? 0n),
      entryPoint: entryPointAddress,
    });
  } catch (err: any) {
    return bad({ error: err?.message ?? String(err) }, 500);
  }
}
