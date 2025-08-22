"use client";

import { useState } from "react";
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
        </div>
      )}

      {message && <p className={styles.message}>{message}</p>}
    </div>
  );
}
