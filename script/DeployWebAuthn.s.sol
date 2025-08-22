// SPDX-License-Identifier: MIT
pragma solidity 0.8.21;

import {Script, console2} from "forge-std/Script.sol";
import {WebAuthnVerifier} from "../src/WebAuthnVerifier.sol";

contract DeployWebAuthnScript is Script {
    function setUp() public {}

    function run() public {
        vm.broadcast();
        address verifier = address(new WebAuthnVerifier());
        console2.log(verifier);
    }
}
