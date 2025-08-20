// SPDX-License-Identifier: MIT
pragma solidity =0.8.21;

import "p256-verifier/WebAuthn.sol";
import "./IWebAuthnVerifier.sol";

/// @notice Stateless WebAuthn validator that bridges Daimo's library to an external ABI.
///         Pass the exact bytes used as the WebAuthn challenge (e.g. userOpHash) as `challenge`.
contract WebAuthnVerifier is IWebAuthnVerifier {
    /// @notice Verify a WebAuthn assertion against a P-256 public key.
    /// @param challenge Raw challenge bytes you sent to the authenticator (e.g. userOpHash).
    /// @param authenticatorData Authenticator data from the assertion.
    /// @param clientDataJSON Client data JSON from the assertion.
    /// @param challengeLocation Byte offset of the `"challenge"` value inside clientDataJSON.
    /// @param responseTypeLocation Byte offset of the `"type":"webauthn.get"` inside clientDataJSON.
    /// @param r ECDSA r
    /// @param s ECDSA s
    /// @param pubKeyX Passkey public key X coordinate (uint256)
    /// @param pubKeyY Passkey public key Y coordinate (uint256)
    /// @param requireUserVerification If true, UV must be set (UP always required).
    /// @return ok True if the assertion is valid for the given key and policy.
    function verify(
        bytes calldata challenge,
        bytes calldata authenticatorData,
        string calldata clientDataJSON,
        uint256 challengeLocation,
        uint256 responseTypeLocation,
        uint256 r,
        uint256 s,
        uint256 pubKeyX,
        uint256 pubKeyY,
        bool requireUserVerification
    ) external view returns (bool ok) {
        ok = WebAuthn.verifySignature(
            challenge,
            authenticatorData,
            requireUserVerification,
            clientDataJSON,
            challengeLocation,
            responseTypeLocation,
            r,
            s,
            pubKeyX,
            pubKeyY
        );
    }
}
