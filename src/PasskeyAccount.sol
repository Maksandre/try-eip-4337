// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "account-abstraction/core/BaseAccount.sol";
import "./IWebAuthnVerifier.sol";

contract PasskeyAccount is BaseAccount {
    address public constant ENTRY_POINT_ADDRESS =
        0x4337084D9E255Ff0702461CF8895CE9E3b5Ff108;
    IWebAuthnVerifier public immutable VERIFIER;

    // store the P-256 public key (passkey credential pubkey)
    uint256 public pubKeyX;
    uint256 public pubKeyY;

    // tweak per-chain
    // TODO: remove for simplicity?
    bool public usePrecompiled = false;
    bool public requireUserVerification = true;

    constructor(uint256 _x, uint256 _y, address _verifierAddress) {
        pubKeyX = _x;
        pubKeyY = _y;
        VERIFIER = IWebAuthnVerifier(_verifierAddress);
    }

    receive() external payable {}

    function entryPoint() public view override returns (IEntryPoint) {
        return IEntryPoint(ENTRY_POINT_ADDRESS);
    }

    /// userOp.signature is ABI-encoded as:
    /// (bytes authenticatorData, string clientDataJSON, uint256 challengeLocation, uint256 responseTypeLocation, uint256 r, uint256 s)
    function _validateSignature(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash
    ) internal override returns (uint256) {
        (
            bytes memory authenticatorData,
            string memory clientDataJSON,
            uint256 challengeLoc,
            uint256 typeLoc,
            uint256 r,
            uint256 s
        ) = abi.decode(
                userOp.signature,
                (bytes, string, uint256, uint256, uint256, uint256)
            );

        bool ok = VERIFIER.verify(
            abi.encodePacked(userOpHash),
            authenticatorData,
            clientDataJSON,
            challengeLoc,
            typeLoc,
            r,
            s,
            pubKeyX,
            pubKeyY,
            requireUserVerification
        );

        return ok ? 0 : 1;
    }
}
