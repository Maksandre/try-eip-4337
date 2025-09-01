"use client";

import { useEffect, useState } from "react";
import {
  startRegistration,
  startAuthentication,
} from "@simplewebauthn/browser";
import styles from "./page.module.css";

interface AuthVerificationResult {
  authenticatorData: string;
  clientDataJSON: string;
  challengeLocation: number;
  typeLocation: number;
  r: string;
  s: string;
}

export default function Home() {
  const [pubKeyX, setPubKeyX] = useState<string | null>(null);
  const [pubKeyY, setPubKeyY] = useState<string | null>(null);
  const [accountAddress, setAccountAddress] = useState<string | null>(null);
  const [authResult, setAuthResult] = useState<AuthVerificationResult | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [ethBalance, setEthBalance] = useState<string | null>(null);
  const [entryPointDeposit, setEntryPointDeposit] = useState<string | null>(
    null
  );
  const [sendTo, setSendTo] = useState<string>("");
  const [sendValue, setSendValue] = useState<string>("");

  useEffect(() => {
    async function fetchBalances(addr: string) {
      try {
        const res = await fetch(`/api/balances?address=${addr}`);
        const json = await res.json();
        if (res.ok) {
          setEthBalance(json.ethBalanceEth);
          setEntryPointDeposit(json.entryPointDepositEth);
        } else {
          setMessage(json.error || "Failed to fetch balances");
        }
      } catch (e: any) {
        setMessage(e?.message || String(e));
      }
    }
    if (accountAddress) {
      fetchBalances(accountAddress);
    } else {
      setEthBalance(null);
      setEntryPointDeposit(null);
    }
  }, [accountAddress]);

  async function handleRegister() {
    setLoading(true);
    setMessage(null);
    try {
      const options = await fetch("/api/generate-registration-options").then(
        (res) => res.json()
      );
      const attResp = await startRegistration(options);
      const verification = await fetch("/api/verify-registration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(attResp),
      }).then((res) => res.json());
      if (verification.verified) {
        setPubKeyX(verification.pubKeyX);
        setPubKeyY(verification.pubKeyY);
        setMessage("Registration successful!");
      } else {
        setMessage("Registration could not be verified");
      }
    } catch (err: any) {
      setMessage(err.message || String(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleAuthenticate() {
    setLoading(true);
    setMessage(null);
    try {
      const options = await fetch("/api/generate-authentication-options").then(
        (res) => res.json()
      );
      const assertion = await startAuthentication(options);
      const verification = await fetch("/api/verify-authentication", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(assertion),
      }).then((res) => res.json());
      if (verification.verified) {
        setAuthResult(verification as AuthVerificationResult);
        setMessage("Authentication successful!");
      } else {
        setMessage("Authentication could not be verified");
      }
    } catch (err: any) {
      setMessage(err.message || String(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleDeploy() {
    if (!pubKeyX || !pubKeyY) {
      setMessage("Please register a passkey first to obtain pubKeyX/Y");
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch("/api/deploy-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pubKeyX, pubKeyY }),
      });
      const json = await response.json();
      if (json.address) {
        setAccountAddress(json.address);
        setMessage("SmartAccount deployed successfully");
      } else {
        setMessage(json.error || "Deployment failed");
      }
    } catch (err: any) {
      setMessage(err.message || String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.container}>
      <h1 className={styles.heading}>ERC-4337 Passkey SmartAccount Demo</h1>
      <p className={styles.description}>This simple demo …</p>

      <div className={styles.section}>
        <button
          className={styles.button}
          onClick={handleRegister}
          disabled={loading}
        >
          Register Passkey
        </button>
      </div>

      <div className={styles.section}>
        <button
          className={styles.button}
          onClick={handleAuthenticate}
          disabled={loading || !pubKeyX}
        >
          Authenticate &amp; Sign
        </button>
      </div>

      <div className={styles.section}>
        <button
          className={styles.button}
          onClick={handleDeploy}
          disabled={loading || !pubKeyX}
        >
          Deploy SmartAccount
        </button>
      </div>

      {accountAddress && (
        <div className={styles.section}>
          <h2 className={styles.subheading}>SmartAccount Address</h2>
          <code className={styles.code}>{accountAddress}</code>
          <div style={{ marginTop: "0.75rem" }}>
            <div>
              ETH Balance: <strong>{ethBalance ?? "-"}</strong>
            </div>
            <div>
              EntryPoint Deposit: <strong>{entryPointDeposit ?? "-"}</strong>
            </div>
            <button
              className={styles.button}
              style={{ marginTop: "0.5rem" }}
              onClick={async () => {
                if (!accountAddress) return;
                setLoading(true);
                try {
                  const res = await fetch(
                    `/api/balances?address=${accountAddress}`
                  );
                  const json = await res.json();
                  if (res.ok) {
                    setEthBalance(json.ethBalanceEth);
                    setEntryPointDeposit(json.entryPointDepositEth);
                  } else {
                    setMessage(json.error || "Failed to refresh balances");
                  }
                } catch (e: any) {
                  setMessage(e?.message || String(e));
                } finally {
                  setLoading(false);
                }
              }}
              disabled={loading}
            >
              Refresh Balances
            </button>
          </div>
        </div>
      )}

      {accountAddress && (
        <div className={styles.section}>
          <h2 className={styles.subheading}>Send ETH (Passkey-signed)</h2>
          <div
            style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}
          >
            <input
              placeholder="Recipient 0x..."
              value={sendTo}
              onChange={(e) => setSendTo(e.target.value)}
              style={{ padding: "0.5rem", borderRadius: 6 }}
            />
            <input
              placeholder="Amount in ETH (e.g. 0.01)"
              value={sendValue}
              onChange={(e) => setSendValue(e.target.value)}
              style={{ padding: "0.5rem", borderRadius: 6 }}
            />
            <button
              className={styles.button}
              disabled={loading || !sendTo || !sendValue}
              onClick={async () => {
                if (!accountAddress) return;
                setLoading(true);
                setMessage(null);
                try {
                  const prep = await fetch(
                    `/api/generate-send-auth-options?sender=${accountAddress}&to=${sendTo}&valueEth=${sendValue}`
                  );
                  const { options, userOp, error } = await prep.json();
                  if (!prep.ok) {
                    setMessage(
                      error ||
                        options?.error ||
                        "Failed to prepare user operation"
                    );
                    setLoading(false);
                    return;
                  }

                  const assertion = await startAuthentication(options);

                  const submit = await fetch("/api/send-eth", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ userOp, assertion }),
                  });
                  const submitJson = await submit.json();
                  if (submit.ok) {
                    setMessage(`Submitted. Tx: ${submitJson.txHash}`);
                    setTimeout(async () => {
                      const res = await fetch(
                        `/api/balances?address=${accountAddress}`
                      );
                      const json = await res.json();
                      if (res.ok) {
                        setEthBalance(json.ethBalanceEth);
                        setEntryPointDeposit(json.entryPointDepositEth);
                      }
                    }, 1500);
                  } else {
                    setMessage(submitJson.error || "Submission failed");
                  }
                } catch (e: any) {
                  setMessage(e?.message || String(e));
                } finally {
                  setLoading(false);
                }
              }}
            >
              Send ETH
            </button>
          </div>
        </div>
      )}

      {message && <p className={styles.message}>{message}</p>}
    </div>
  );
}
