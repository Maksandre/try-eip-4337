# Local EIP-4337 Development Guide

This comprehensive guide teaches you ERC-4337 Account Abstraction from the ground up by building the complete infrastructure locally. You'll gain deep understanding by implementing every component yourself, from the EntryPoint contract to bundlers and smart contract wallets. We'll use the eth-infinitism libraries, which are maintained by the core ERC-4337 team and provide the most reliable implementation of the standard

## What is EIP-4337?

EIP-4337 introduces Account Abstraction to Ethereum, allowing smart contracts to act as user accounts. This enables features like gasless transactions, social recovery, and more flexible authentication methods without requiring changes to the Ethereum protocol.

## Project Setup

### 1. Initialize Your Foundry Project

Create a new directory and initialize a Foundry project:

```sh
mkdir eip4337-local-setup
cd eip4337-local-setup
forge init
```

### 2. Install Required Dependencies

Install the core Account Abstraction contracts and P256 verifier library:

```sh
forge install eth-infinitism/account-abstraction
forge install daimo-eth/p256-verifier
```

The `account-abstraction` package contains all the essential contracts including EntryPoint, while `p256-verifier` enables support for secp256r1 signatures (commonly used in WebAuthn).

## Setting Up the Local Blockchain

### Start Anvil (Local Ethereum Node)

Launch a local blockchain using Anvil:

```sh
anvil
```

<!-- TODO: this is only true for this repo, but not for the article -->
For faster development, you can start Anvil with a pre-deployed EntryPoint contract:

```sh
anvil --load-state anvil/state.json
```

This loads a saved state with contracts already deployed, saving you deployment time during development.

## Deploying the EntryPoint Contract

The EntryPoint is the core non-upgradable contract (version 0.8) that handles all UserOperations. It has a deterministic address across all networks: `0x4337084d9e255ff0702461cf8895ce9e3b5ff108`.

### Prerequisites for Deployment

The EntryPoint can be deployed using CREATE2 if the deterministic deployer contract exists at `0x4e59b44847b379578588920ca78fbf26c0b4956c`. This deployer is available on Anvil by default.

### Deployment Steps

The most reliable method is using the official eth-infinitism repository:

1. **Clone the Account Abstraction Repository**
   ```sh
   git clone https://github.com/eth-infinitism/account-abstraction.git
   cd account-abstraction
   ```

2. **Install Dependencies**
   ```sh
   yarn install
   ```

3. **Deploy the EntryPoint**
   ```sh
   yarn hardhat deploy --network dev
   ```

After successful deployment, you should see output similar to:

```
deploying "EntryPoint" (tx: 0x456b31559abf2560e9968663e4a73f0db03d1a0ff73019f71b61dcc6846f5f0c)...
: deployed at 0x0000000071727De22E5E9d8BAf0edAc6f37da032 with 5034766 gas
==entrypoint addr= 0x0000000071727De22E5E9d8BAf0edAc6f37da032
```

Verify that the EntryPoint address matches `0x4e59b44847b379578588920ca78fbf26c0b4956c`. This deterministic address ensures compatibility with Account Abstraction tooling and bundlers.

