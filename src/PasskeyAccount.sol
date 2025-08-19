// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "account-abstraction/core/BaseAccount.sol";

contract PasskeyAccount is BaseAccount {
    address public constant ENTRY_POINT_ADDRESS = 0x4337084D9E255Ff0702461CF8895CE9E3b5Ff108;

    uint256 public pubKeyX;
    uint256 public pubKeyY;

    function entryPoint() public view virtual override returns (IEntryPoint) {
        return IEntryPoint(ENTRY_POINT_ADDRESS);
    }

    function _validateSignature(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash
    ) internal virtual override returns (uint256 validationData) {}
}
