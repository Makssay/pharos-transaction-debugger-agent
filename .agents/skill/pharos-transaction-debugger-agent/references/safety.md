# Safety Notes

## Read-only boundary

This skill must not request private keys, seed phrases, `.env` contents, wallet passwords, browser wallet access, or signing approvals. It only reads public chain data through JSON-RPC or optional `cast tx` and `cast receipt` commands.

## Network clarity

Always show the selected network before the result. The same transaction hash can be absent on one Pharos network and present on another, so a missing transaction is not proof that the hash is invalid.

## Failed transactions

A mined failed transaction receipt usually contains `status = 0x0` but does not contain a revert reason. Do not invent a reason. If the user provides the contract ABI, calldata intent, and block context, a separate replay/debug workflow may be possible, but this skill should report that as a next step rather than claiming certainty.

## Pending transactions

When a transaction exists but no receipt is returned, classify it as pending or not yet indexed by the RPC node. Show nonce, from, to, value, gas limit, and gas price so the user can reason about replacement or waiting.

## Calldata and event decoding

Decode known selectors and event topics as hints only. Unknown selectors require ABI, verified source, or user-provided method signatures. Label uncertain interpretations clearly.
