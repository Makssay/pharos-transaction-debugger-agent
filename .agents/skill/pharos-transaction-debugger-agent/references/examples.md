# Examples

## Prompt examples

- Use $pharos-transaction-debugger-agent to debug this Pharos testnet tx: `0x...`
- Use $pharos-transaction-debugger-agent to explain why this mainnet transaction failed: `0x...`
- Use $pharos-transaction-debugger-agent to make a JSON report for this tx hash on Atlantic testnet.
- Use $pharos-transaction-debugger-agent to inspect gas used, fee, calldata, and logs for this transaction.

## Demo commands

PowerShell:

```powershell
node .\.agents\skills\pharos-transaction-debugger-agent\scripts\debug-transaction.mjs --tx <tx_hash> --network atlantic-testnet --format console
```

Mainnet report:

```powershell
node .\.agents\skills\pharos-transaction-debugger-agent\scripts\debug-transaction.mjs --tx <tx_hash> --network mainnet --include-block --output tx-debug.md
```

JSON output:

```powershell
node .\.agents\skills\pharos-transaction-debugger-agent\scripts\debug-transaction.mjs --tx <tx_hash> --network atlantic-testnet --format json
```

## Discord/video flow

1. Run a console report for a known successful transaction.
2. Point out status, transaction type, method selector, gas used, fee, and explorer link.
3. Run a second report for a failed or pending transaction if available.
4. Show that the agent stays read-only and never asks for a private key.
