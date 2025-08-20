# (DRAFT) Local ERC-4337 Development Guide

This guide teaches you ERC-4337 Account Abstraction from the ground up by building the complete infrastructure locally. You'll gain a deep understanding by implementing every component yourself, from the EntryPoint contract to bundlers and smart contract wallets. We'll use the **eth-infinitism** libraries, which are maintained by the core ERC-4337 team and provide the most reliable implementation of the standard.

> [!NOTE]
> If you are unfamiliar with concepts like **UserOperation**, **EntryPoint**, **alt-mempool**, **bundlers**, and **paymasters**, start with an introductory guide. This tutorial is intended for those who already understand the general idea of EIP-4337 but want to see how it works in practice.

---

### Why account abstraction matters

Ethereum accounts are currently split into two types: **Externally Owned Accounts (EOAs)** and **contract accounts**. EOAs can initiate transactions but are limited to a single ECDSA key for authentication. Contract accounts can execute arbitrary logic but cannot initiate transactions themselves.

**EIP-4337** introduces account abstraction without changing Ethereum's base protocol. Instead of regular transactions, users create `UserOperation` objects and broadcast them to a permissionless **alt-mempool**. **Bundlers** collect these UserOperations, validate them, and submit them in batches to a singleton **EntryPoint** contract on-chain. The EntryPoint contract:

- Verifies signatures
- Executes calls on behalf of smart accounts
- Deducts gas fees or consults paymasters when gas is sponsored

This approach enables smart contract wallets to function as primary accounts without relying on EOAs. It unlocks:

- Custom signature schemes (e.g., passkeys)
- Gas sponsorship (meta-transactions)
- Batched transactions
- Account recovery options

---

## Core Components

The ERC-4337 standard defines both **on-chain contracts** and **off-chain infrastructure**.

### On-Chain Architecture

| Component              | Role                                                                                                                                                                                                                                                                        |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| EntryPoint             | Singleton smart contract that verifies, executes, and charges UserOperations. Bundlers call its `handleOps()` function with a batch of UserOperations. It stores deposits and stakes, coordinates calls to wallets and paymasters, and returns unused gas fees to bundlers. |
| Smart Accounts         | Smart contract wallets implementing the `IAccount.validateUserOp()` hook to check signatures and nonces, and an `execute()` function to perform user-specified calls. The example **SimpleAccount** has a single owner and supports deposits, withdrawals, and calls.       |
| Paymasters             | Contracts that sponsor gas for a UserOperation. During validation, the EntryPoint calls `validatePaymasterUserOp()`; if it returns a context, `postOp()` is called after execution. Paymasters must stake and maintain a deposit to prevent griefing.                       |
| Aggregators (optional) | Contracts that verify aggregated signatures. They allow multiple UserOperations to share a single signature, reducing calldata costs.                                                                                                                                       |

### Off-Chain Architecture

| Component                   | Role                                                                                                                                                                                                                                                                  |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Alt-mempool                 | A separate mempool where clients send UserOperations. This mempool is independent of Ethereum's transaction pool and can implement censorship-resistant gossip protocols.                                                                                             |
| Bundlers                    | Off-chain relayers that monitor the alt-mempool, simulate UserOperations with `simulateValidation()` on the EntryPoint, group valid operations, and submit them on-chain via `handleOps()`. They pay gas upfront and are reimbursed from user deposits or paymasters. |
| UserOperation Creators      | Wallet libraries and SDKs that build UserOperations, estimate gas, sign them, and broadcast them to bundlers. The `@account-abstraction/sdk` provides a high-level API for constructing and signing operations.                                                       |
| Gas Estimators & Simulators | Bundlers also expose RPC methods like `eth_estimateUserOperationGas` and `simulateValidation` to help wallets accurately estimate gas limits for verification and execution.                                                                                          |

---

## Project Setup

### 1. Initialize Your Foundry Project

Create a new directory and initialize a Foundry project:

```sh
mkdir eip4337-local
cd eip4337-local
forge init
```

### 2. Install Required Dependencies

Install the core Account Abstraction contracts. The `account-abstraction` package includes all essential contracts, including EntryPoint:

```sh
forge install eth-infinitism/account-abstraction
```

To implement passkey (WebAuthn) signatures, you also need a contract for **secp256r1** signature verification:

```sh
forge install daimo-eth/p256-verifier
```

### 3. Start Anvil (Local Ethereum Node)

Launch a local blockchain using Anvil:

```sh
anvil
```

For faster development, you can start Anvil with a pre-deployed EntryPoint contract:

```sh
anvil --load-state anvil/state.json
```

This loads a saved state with contracts already deployed, saving deployment time during development.

---

## 1. EntryPoint

The EntryPoint is the central coordinator for all Account Abstraction operations. Think of it as the "transaction processor" that replaces the traditional transaction pool for smart accounts. Instead of EOAs sending transactions directly, bundlers send batches of UserOperations to the EntryPoint's `handleOps()` function.

The EntryPoint version 0.8 is the core non-upgradable contract that handles all UserOperations. It has a deterministic address across all networks: `0x4337084d9e255ff0702461cf8895ce9e3b5ff108`.

The EntryPoint can be deployed to this canonical address on any network using the CREATE2 opcode through a deterministic deployment factory. This factory contract exists at `0x4e59b44847b379578588920ca78fbf26c0b4956c` and is available on most networks, including Anvil by default.

The most reliable method is to use the official **eth-infinitism** repository:

1. Clone the [Account Abstraction repository](https://github.com/eth-infinitism/account-abstraction) and install its dependencies with `yarn` or `npm`.
2. Deploy the EntryPoint contract using the provided scripts:

```sh
yarn hardhat deploy --network dev
```

After a successful deployment, you should see output similar to:

```
deploying "EntryPoint" (tx: 0x456b31559abf2560e9968663e4a73f0db03d1a0ff73019f71b61dcc6846f5f0c)...: deployed at 0x4337084D9E255Ff0702461CF8895CE9E3b5Ff108 with 5034766 gas
==entrypoint addr= 0x4337084D9E255Ff0702461CF8895CE9E3b5Ff108
```

Verify that the EntryPoint address matches `0x4337084D9E255Ff0702461CF8895CE9E3b5Ff108`. This deterministic address ensures compatibility with Account Abstraction tooling and bundlers.

## 2. Smart Wallet with PassKeys

> [!NOTE]
> Disclaimer: This guide is for educational purposes only. Deploying smart contracts involves real risk; always audit contracts, test on a local network and seek professional advice before handling real funds.

If you've played with ERC-4337 before, you know the usual setup: a smart wallet that inherits from `BaseAccount`, some `validateUserOp` magic, and an ECDSA signature check to see if the operation is legit.

Now imagine swapping that MetaMask-style key for something your phone already has — a PassKey. FaceID, TouchID, your laptop's fingerprint sensor. No seed phrase, no password reset link, no lost private keys panic.

That's exactly what we're doing here: replacing the ECDSA check with a WebAuthn P-256 signature verification.

### Step 1 — Start with BaseAccount

I didn't want to reinvent ERC-4337's boilerplate. The Eth-Infinitism BaseAccount already implements the ERC-4337 plumbing: nonce handling, `validateUserOp`, entry point checks.

That validateUserOp method is where the magic happens. Normally, you'd grab userOpHash and run ecrecover to see if the ECDSA signature matches your stored address. We're going to tear that part out and drop in a P-256 verifier.

Because the latest verion of account abstraction library requires solidity 0.8.28 or higher and the P256-Verifier requires exact version of 0.8.21 we need to pre-deploy its contracts beforehand.

If you started anvil using prepared state, than `P256-Verifier` is already deployed to a determenistic address `0xc2b78104907F722DABAc4C69f826a522B2754De4`. You can ensure by quering the code of this address:

```sh
cast code 0xc2b78104907F722DABAc4C69f826a522B2754De4
```

If the code is `0x0` you need to deploy it yourself. The official repository provides a deployment script. However, even though it supposed to create determenistic address, most likely it wount for you, because of metadata appended <!-- TODO find the proof in the foundry doc or give a link to the issue -->. So instead the easiest way would be to replay the [existing deployment](https://basescan.org/tx/0x9aea3316c197992740ef943ae3269901fae3c58e4654acc5cd6c2e7529eb8990) transaction against your Anvil node. You can try it yourself, but if you get stuck just execute the deployment script I prepare.

<!-- TODO the link to the deployment script -->

<!-- TODO: link -->

I will also deploy WebAuthn.sol to verify PassKeys.

<!-- TODO: code from WebAuthVerifier.sol, IWebAuthVerifier.sol, DeployVerifier.s.sol here -->

### Step 2 — Storing a PassKey on-chain

When a user registers a PassKey in your dApp, their browser gives you a public key on the P-256 curve — two numbers, `x` and `y`. We store those on-chain in our smart wallet. That's the user's identity now.

```solidity
bytes32 public pubKeyX;
bytes32 public pubKeyY;

function initialize(bytes32 _x, bytes32 _y) external {
    pubKeyX = _x;
    pubKeyY = _y;
}
```

That's it. No addresses, no seed phrases, just curve coordinates. Lose those keys and you lose the wallet, so think about recovery later.

### Step 3 — Verifying a PassKey signature

<!-- TODO fact check -->

The PassKey signing flow is very different from Ethereum signatures. When the browser signs something, you don't just get (r, s). You also get a bundle of authenticatorData and clientDataJSON that need to be hashed together exactly like WebAuthn specifies.

This is where Daimo's WebAuthn.sol saves you. It knows how to take those fields, reconstruct the signed message, and check it against (pubKeyX, pubKeyY).

So inside our `validateUserOp`, we decode the signature payload and hand it to the verifier:

```solidity
function validateUserOp(
    PackedUserOperation calldata userOp,
    bytes32 userOpHash,
    uint256 /* missingAccountFunds */
) public override returns (uint256) {
    WebAuthn.Signature memory sig = abi.decode(userOp.signature, (WebAuthn.Signature));
    bool valid = WebAuthn.verifySignature(pubKeyX, pubKeyY, sig, userOpHash);
    require(valid, "Invalid PassKey signature");
    return 0;
}
```

If that check passes, the EntryPoint is happy and the operation goes through.

### Step 4 — Signing from the browser

On the frontend, it feels almost too simple. You call navigator.credentials.create() to make a PassKey during wallet creation. That gives you `x` and `y` for storage in the contract.

Later, when sending a transaction, you call `navigator.credentials.get()` to sign your `userOpHash`. The browser pops up FaceID or your fingerprint prompt, the user approves, and you get back the signature bundle to stick into `userOp.signature`.

No seed phrase ceremony, no wallet popup. It's just the web doing what the web is good at.

### Warnings

Here's the honest part: P-256 on EVM is expensive. Right now, each signature verification costs hundreds of thousands of gas. On L1, you're going to feel that.

Until EIP-7212 (native P-256 precompile) is widely deployed, this is best suited for L2s or appchains where gas isn't painful.

And then there's recovery. PassKeys are tied to devices. Lose your phone and you lose the key. You need some way to rotate keys or add backup credentials. This isn't a "just deploy it" setup unless you're okay with that risk (you're not).

<!-- TODO: generate Pass Key with my apple and deploy the Smart Account to our Anvil node -->

## 3. Bundler and Alt-mempool

You prepared a `UserOperation` (your WebAuthn‑signed request bundled in JSON). Now what? You don't send it to Ethereum directly, because nodes will never pass it through – UserOp is not a valid transaction itself. So you need to send it to someone who create a valid transaction. You send it to a bundler.

### How bundlers work

<!-- TODO: Historically it was per-bundler mempool -->
<!-- TODO: Now it is shared mempool -->
<!-- TODO: Using some real bundler such as eth-infinitism or any other -->

## 4. Sending UserOp

<!-- TODO: Fund my Wallet (or EntryPoint) so it can pay fees -->
<!-- TODO: Using some real JS library/SDK to send a user op signed with pass keys to Bundler -->
