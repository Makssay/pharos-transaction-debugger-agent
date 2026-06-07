# Pharos Transaction Debugger Agent

AI Skill for debugging Pharos transactions in Codex. It analyzes failed, pending, and successful transactions through public Pharos JSON-RPC, then reports status, gas, fees, calldata selector hints, logs, explorer links, and optional historical replay results.

The skill is read-only. It never asks for a private key, never connects to a wallet, and never signs transactions.

## What it does

- Debugs Pharos transaction hashes on mainnet and Atlantic testnet.
- Detects `success`, `failed`, `pending`, and `not_found` states.
- Classifies tx type: native transfer, contract call, contract creation, empty contract call, or calldata sent to an EOA.
- Shows sender, recipient, value, nonce, block, confirmations, and explorer link.
- Calculates gas used, gas limit, effective gas price, and total PROS/PHRS fee.
- Extracts calldata selector and gives hints for known ERC20/ERC721 and swap/liquidity methods.
- Summarizes common logs/events such as `Transfer` and `Approval`.
- Replays failed mined transactions with historical `eth_call` when requested.
- Decodes common revert data shapes: `Error(string)`, `Panic(uint256)`, unknown/custom selectors, and numeric 32-byte error codes.

## Installation

```powershell
npx skills add https://github.com/Makssay/pharos-transaction-debugger-agent
```

Manual installation:

```text
.agents/skills/pharos-transaction-debugger-agent
```

## Usage

Debug a mainnet transaction:

```powershell
node .\.agents\skills\pharos-transaction-debugger-agent\scripts\debug-transaction.mjs --tx 0xc9ea2d149157bc6bb30a16afc18f55f88fda8a80fc4da46cf5fc10c9db0daa9c --network mainnet --format console
```

Debug with historical replay:

```powershell
node .\.agents\skills\pharos-transaction-debugger-agent\scripts\debug-transaction.mjs --tx 0xc9ea2d149157bc6bb30a16afc18f55f88fda8a80fc4da46cf5fc10c9db0daa9c --network mainnet --replay-failed --include-block --format console
```

JSON report:

```powershell
node .\.agents\skills\pharos-transaction-debugger-agent\scripts\debug-transaction.mjs --tx 0xc9ea2d149157bc6bb30a16afc18f55f88fda8a80fc4da46cf5fc10c9db0daa9c --network mainnet --replay-failed --format json
```

Save a Markdown report:

```powershell
node .\.agents\skills\pharos-transaction-debugger-agent\scripts\debug-transaction.mjs --tx 0xc9ea2d149157bc6bb30a16afc18f55f88fda8a80fc4da46cf5fc10c9db0daa9c --network mainnet --replay-failed --include-block --output tx-debug.md
```

## Example output

```text
Status: failed
Type: contract-call
Gas used: 31141 / 294801
Replay block: 9520237
Revert data: 0x00000000000000000000000000000000000000000000000000000000000000c9
Decoded: Numeric revert code: 201
```

## Supported networks

- Pharos Atlantic testnet (`atlantic-testnet`), chain `688689`, native token `PHRS`
- Pharos mainnet (`mainnet`), chain `1672`, native token `PROS`

## Dependencies

- Node.js 18+
- No npm package dependencies
- Foundry/cast is optional and only used when explicitly requested

## Safety

This skill uses public JSON-RPC reads only. It does not require wallet connection, browser automation, private keys, seed phrases, or signing approvals.
