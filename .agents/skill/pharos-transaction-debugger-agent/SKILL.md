---
name: pharos-transaction-debugger-agent
description: Read-only Pharos transaction debugger for transaction hashes, receipts, status, gas usage, fee calculation, calldata method hints, contract creation detection, event summaries, explorer links, and stuck or failed transaction triage on Pharos Atlantic testnet or mainnet. Use when a user asks to debug, inspect, explain, classify, troubleshoot, or produce a report for a Pharos tx hash. Never request private keys; use the bundled Node.js JSON-RPC script by default and use cast only when the user explicitly asks for Foundry output.
---

# Pharos Transaction Debugger Agent

Debug Pharos transactions with read-only checks. The skill retrieves the transaction, receipt, optional block data, target bytecode, calldata selector hints, gas/fee details, event summaries, and explorer links for Atlantic testnet or mainnet.

## Agent Execution Rules

- Use the bundled Node.js JSON-RPC script by default. Do not require Foundry, `cast`, `forge`, Bash, Git Bash, WSL, private keys, or wallet signing for this skill.
- If another generic Pharos skill says Foundry is mandatory, treat that as applying only to Foundry/cast workflows. For this Transaction Debugger Agent, continue with the bundled Node.js script.
- Do not stop after checking for `cast` if Node.js is available. Continue with `scripts/debug-transaction.mjs`.
- Only use `cast tx` and `cast receipt` when the user explicitly asks for Foundry/cast output.
- Treat all operations as read-only public RPC reads. Never request `PRIVATE_KEY`.

## Default Workflow

1. Validate the transaction hash as `0x` plus 64 hex characters.
2. Default to `atlantic-testnet` unless the user explicitly asks for `mainnet`.
3. Run the bundled script from the project where the skill is installed:

```powershell
node .\.agents\skills\pharos-transaction-debugger-agent\scripts\debug-transaction.mjs --tx 0x0000000000000000000000000000000000000000000000000000000000000000 --network atlantic-testnet --format markdown
```

For mainnet:

```powershell
node .\.agents\skills\pharos-transaction-debugger-agent\scripts\debug-transaction.mjs --tx <tx_hash> --network mainnet --format console
```

For JSON output:

```powershell
node .\.agents\skills\pharos-transaction-debugger-agent\scripts\debug-transaction.mjs --tx <tx_hash> --network atlantic-testnet --format json
```

To save a report:

```powershell
node .\.agents\skills\pharos-transaction-debugger-agent\scripts\debug-transaction.mjs --tx <tx_hash> --network mainnet --output tx-debug.md
```

To replay a failed mined transaction and capture raw revert data when the RPC node returns it:

```powershell
node .\.agents\skills\pharos-transaction-debugger-agent\scripts\debug-transaction.mjs --tx <tx_hash> --network mainnet --replay-failed --include-block --format console
```

## Inputs

- `--tx <hash>`: Required transaction hash.
- `--network atlantic-testnet|mainnet`: Optional. Defaults to `atlantic-testnet`.
- `--rpc-url <url>`: Optional custom RPC endpoint.
- `--format markdown|json|console`: Optional. Defaults to `markdown`; inferred from `--output` when possible.
- `--output <path>`: Optional report file.
- `--include-block`: Fetch the containing block for timestamp and miner/validator metadata when the transaction is mined.
- `--replay-failed`: For mined failed contract calls, run a historical `eth_call` at the transaction block using the original sender, target, calldata, value, gas, and fee fields. Report raw revert data and best-effort decoding.
- `--no-color`: Disable ANSI colors in console output.

## Report Rules

- Treat this skill as read-only. Do not ask for private keys and do not send transactions.
- Always state the target network, chain ID, native token symbol, RPC host, and explorer transaction link.
- If the transaction is missing, say it was not found on the selected network and suggest checking the other Pharos network.
- If `receipt` is missing but the transaction exists, mark it as pending and show nonce, gas limit, gas price, and from/to/value.
- If `receipt.status` is `0x0`, mark it failed. Explain that revert reason usually cannot be recovered from a mined receipt alone unless the same call can be replayed with complete context.
- Use `--replay-failed` when the user asks why a failed transaction reverted, wants the revert data, or asks for deeper failure analysis. Treat replay output as best-effort because historical calls can depend on RPC archive support and exact execution context.
- If `receipt.status` is `0x1`, mark it successful and show gas used, gas limit, effective gas price, and total fee.
- If `to` is null, classify the transaction as contract creation and show the deployed contract address from the receipt when available.
- If calldata is empty or `0x`, classify it as a native transfer or empty contract call depending on the target bytecode.
- Decode only safe hints from known method selectors and event topics. Do not pretend to know an unknown ABI.
- Include event topic hints for common ERC20/ERC721 `Transfer` and ERC20 `Approval` logs, but label unknown logs by contract address and topic count.

## Optional Foundry Path

The bundled Node.js script is preferred on Windows because it has no npm dependencies. If the user explicitly wants Foundry output, invoke the general Pharos onchain skill rules first, verify `cast` is installed, then use:

```bash
cast tx <tx_hash> --rpc-url <rpc>
cast receipt <tx_hash> --rpc-url <rpc>
```

Read `assets/networks.json` for the correct RPC URL, chain ID, explorer URL, and native token symbol.

## References

- Read `references/examples.md` for demo prompts, Discord submission flow, and sample command shapes.
- Read `references/safety.md` when explaining privacy, read-only behavior, missing revert reasons, or mainnet safety.
