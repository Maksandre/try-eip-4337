// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

interface IWebAuthnVerifier {
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
    ) external view returns (bool ok);
}
