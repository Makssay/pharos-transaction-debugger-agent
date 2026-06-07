#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const skillRoot = path.resolve(__dirname, "..");

const METHOD_SELECTORS = {
  "0xa9059cbb": "ERC20 transfer(address,uint256)",
  "0x095ea7b3": "ERC20 approve(address,uint256)",
  "0x23b872dd": "ERC20 transferFrom(address,address,uint256)",
  "0x70a08231": "ERC20 balanceOf(address)",
  "0x18160ddd": "ERC20 totalSupply()",
  "0x06fdde03": "ERC20/ERC721 name()",
  "0x95d89b41": "ERC20/ERC721 symbol()",
  "0x313ce567": "ERC20 decimals()",
  "0x40c10f19": "ERC20 mint(address,uint256)",
  "0x42966c68": "ERC20 burn(uint256)",
  "0x42842e0e": "ERC721 safeTransferFrom(address,address,uint256)",
  "0xb88d4fde": "ERC721 safeTransferFrom(address,address,uint256,bytes)",
  "0x23b872dd": "ERC20/ERC721 transferFrom(address,address,uint256)",
  "0x5c11d795": "UniswapV2 swapExactTokensForTokensSupportingFeeOnTransferTokens(...)",
  "0x38ed1739": "UniswapV2 swapExactTokensForTokens(...)",
  "0x7ff36ab5": "UniswapV2 swapExactETHForTokens(...)",
  "0x18cbafe5": "UniswapV2 swapExactTokensForETH(...)",
  "0xe8e33700": "UniswapV2 addLiquidity(...)",
  "0xf305d719": "UniswapV2 addLiquidityETH(...)",
  "0x02751cec": "UniswapV2 removeLiquidity(...)",
  "0xaf2979eb": "UniswapV2 removeLiquidityETH(...)",
  "0x4e71d92d": "claim()",
  "0xd0e30db0": "deposit()",
  "0x2e1a7d4d": "withdraw(uint256)",
  "0x8da5cb5b": "owner()",
  "0x3659cfe6": "upgradeTo(address)"
};

const EVENT_TOPICS = {
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef": "Transfer(address,address,uint256)",
  "0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925": "Approval(address,address,uint256)"
};

const ERC20_APPROVAL_TOPIC = "0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925";

function parseArgs(argv) {
  const args = {
    network: null,
    rpcUrl: null,
    tx: null,
    format: null,
    output: null,
    includeBlock: false,
    replayFailed: false,
    color: true
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => {
      if (i + 1 >= argv.length) throw new Error(`Missing value for ${arg}`);
      i += 1;
      return argv[i];
    };

    if (arg === "--tx" || arg === "--hash") args.tx = next();
    else if (arg === "--network") args.network = next();
    else if (arg === "--rpc-url") args.rpcUrl = next();
    else if (arg === "--format") args.format = next();
    else if (arg === "--output") args.output = next();
    else if (arg === "--include-block") args.includeBlock = true;
    else if (arg === "--replay-failed") args.replayFailed = true;
    else if (arg === "--no-color") args.color = false;
    else if (arg === "--help" || arg === "-h") args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return args;
}

function usage() {
  return [
    "Usage:",
    "  node scripts/debug-transaction.mjs --tx <tx_hash> [--network atlantic-testnet|mainnet] [--format markdown|json|console]",
    "",
    "Options:",
    "  --tx <hash>          Transaction hash, 0x plus 64 hex characters",
    "  --network <name>     atlantic-testnet or mainnet; defaults to assets/networks.json defaultNetwork",
    "  --rpc-url <url>      Override RPC URL",
    "  --format <format>    markdown, json, or console",
    "  --output <path>      Write report to file",
    "  --include-block      Fetch mined block metadata",
    "  --replay-failed      Replay failed mined transactions with historical eth_call",
    "  --no-color           Disable console colors"
  ].join("\n");
}

function loadNetworks() {
  const networkPath = path.join(skillRoot, "assets", "networks.json");
  const parsed = JSON.parse(fs.readFileSync(networkPath, "utf8"));
  return parsed;
}

function selectNetwork(config, name, rpcUrl) {
  const targetName = name || config.defaultNetwork || "atlantic-testnet";
  const network = config.networks.find((entry) => entry.name === targetName);
  if (!network) {
    const supported = config.networks.map((entry) => entry.name).join(", ");
    throw new Error(`Unsupported network "${targetName}". Supported networks: ${supported}`);
  }
  return { ...network, rpcUrl: rpcUrl || network.rpcUrl };
}

function validateTxHash(hash) {
  return /^0x[0-9a-fA-F]{64}$/.test(hash || "");
}

async function rpcRaw(rpcUrl, method, params = []) {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params })
  });

  if (!response.ok) {
    throw new Error(`RPC HTTP ${response.status}: ${response.statusText}`);
  }

  const payload = await response.json();
  return payload;
}

async function rpc(rpcUrl, method, params = []) {
  const payload = await rpcRaw(rpcUrl, method, params);
  if (payload.error) {
    const message = payload.error.message || JSON.stringify(payload.error);
    throw new Error(`RPC ${method} error: ${message}`);
  }
  return payload.result;
}

function hexToBigInt(value) {
  if (!value || value === "0x") return 0n;
  return BigInt(value);
}

function hexToNumber(value) {
  if (!value) return null;
  return Number.parseInt(value, 16);
}

function formatDecimal(value, decimals = 18, precision = 6) {
  const big = typeof value === "bigint" ? value : BigInt(value || 0);
  const scale = 10n ** BigInt(decimals);
  const whole = big / scale;
  const fraction = big % scale;
  if (fraction === 0n) return whole.toString();
  const padded = fraction.toString().padStart(decimals, "0");
  const trimmed = padded.slice(0, precision).replace(/0+$/, "");
  return trimmed ? `${whole.toString()}.${trimmed}` : whole.toString();
}

function explorerUrl(network, kind, value) {
  const base = network.explorerUrl.endsWith("/") ? network.explorerUrl.slice(0, -1) : network.explorerUrl;
  return `${base}/${kind}/${value}`;
}

function rpcHost(url) {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

function methodHint(input) {
  if (!input || input === "0x") {
    return {
      selector: null,
      hint: "No calldata",
      calldataBytes: 0
    };
  }
  const selector = input.slice(0, 10).toLowerCase();
  const bytes = Math.max(0, (input.length - 2) / 2);
  return {
    selector,
    hint: METHOD_SELECTORS[selector] || "Unknown selector",
    calldataBytes: bytes
  };
}

function decodeHexString(hex) {
  let output = "";
  for (let i = 2; i < hex.length; i += 2) {
    const code = Number.parseInt(hex.slice(i, i + 2), 16);
    if (code !== 0) output += String.fromCharCode(code);
  }
  return output;
}

function decodeRevertData(data) {
  if (!data || data === "0x") {
    return { kind: "empty", summary: "Empty revert data" };
  }

  const selector = data.slice(0, 10).toLowerCase();
  if (selector === "0x08c379a0" && data.length >= 138) {
    const lengthHex = `0x${data.slice(138, 202)}`;
    const length = Number(hexToBigInt(lengthHex));
    const stringStart = 202;
    const stringHex = `0x${data.slice(stringStart, stringStart + length * 2)}`;
    const message = decodeHexString(stringHex);
    return { kind: "Error(string)", selector, message, summary: `Error(string): ${message}` };
  }

  if (selector === "0x4e487b71" && data.length >= 74) {
    const code = hexToBigInt(`0x${data.slice(10, 74)}`);
    return { kind: "Panic(uint256)", selector, code: code.toString(), summary: `Panic(uint256): ${code.toString()}` };
  }

  if (/^0x[0-9a-fA-F]{64}$/.test(data)) {
    const code = hexToBigInt(data);
    return { kind: "numeric-code", code: code.toString(), summary: `Numeric revert code: ${code.toString()}` };
  }

  if (/^0x[0-9a-fA-F]{8,}$/.test(data)) {
    return { kind: "custom-or-unknown", selector, summary: `Custom or unknown revert data, selector ${selector}` };
  }

  return { kind: "unknown", summary: "Unknown revert data shape" };
}

async function replayFailedTransaction(rpcUrl, tx, receipt) {
  if (!tx || !receipt || receipt.status !== "0x0" || !tx.blockNumber || !tx.to) {
    return null;
  }

  const call = {
    from: tx.from,
    to: tx.to,
    data: tx.input || "0x",
    value: tx.value || "0x0",
    gas: tx.gas
  };
  if (tx.maxFeePerGas || tx.maxPriorityFeePerGas) {
    if (tx.maxFeePerGas) call.maxFeePerGas = tx.maxFeePerGas;
    if (tx.maxPriorityFeePerGas) call.maxPriorityFeePerGas = tx.maxPriorityFeePerGas;
  } else if (tx.gasPrice) {
    call.gasPrice = tx.gasPrice;
  }

  const replay = await rpcRaw(rpcUrl, "eth_call", [call, tx.blockNumber]);
  if (replay.error) {
    const data = typeof replay.error.data === "string" ? replay.error.data : null;
    return {
      attempted: true,
      blockNumber: hexToNumber(tx.blockNumber),
      status: "reverted",
      message: replay.error.message || "execution reverted",
      data,
      decoded: data ? decodeRevertData(data) : null
    };
  }

  return {
    attempted: true,
    blockNumber: hexToNumber(tx.blockNumber),
    status: "returned",
    result: replay.result || null,
    decoded: null
  };
}

function classify(tx, receipt, targetCode) {
  if (!tx) return "not-found";
  if (!receipt) return "pending";
  if (!tx.to) return "contract-creation";
  if (!tx.input || tx.input === "0x") {
    return targetCode && targetCode !== "0x" ? "empty-contract-call" : "native-transfer";
  }
  return targetCode && targetCode !== "0x" ? "contract-call" : "calldata-to-eoa";
}

function summarizeLogs(logs = []) {
  return logs.map((log, index) => {
    const topic0 = (log.topics && log.topics[0] ? log.topics[0] : "").toLowerCase();
    const known = topic0 === ERC20_APPROVAL_TOPIC
      ? "Approval(address,address,uint256)"
      : EVENT_TOPICS[topic0] || "Unknown event";
    return {
      index,
      address: log.address,
      event: known,
      topics: log.topics ? log.topics.length : 0,
      dataBytes: log.data && log.data !== "0x" ? (log.data.length - 2) / 2 : 0
    };
  });
}

function makeAnalysis({ tx, receipt, block, targetCode, latestBlock, network, replay }) {
  const hint = methodHint(tx?.input);
  const type = classify(tx, receipt, targetCode);
  const status = !tx
    ? "not_found"
    : !receipt
      ? "pending"
      : receipt.status === "0x1"
        ? "success"
        : receipt.status === "0x0"
          ? "failed"
          : "unknown";

  const valueWei = hexToBigInt(tx?.value);
  const gasLimit = hexToBigInt(tx?.gas);
  const gasPrice = hexToBigInt(tx?.gasPrice);
  const maxFeePerGas = tx?.maxFeePerGas ? hexToBigInt(tx.maxFeePerGas) : null;
  const maxPriorityFeePerGas = tx?.maxPriorityFeePerGas ? hexToBigInt(tx.maxPriorityFeePerGas) : null;
  const gasUsed = receipt?.gasUsed ? hexToBigInt(receipt.gasUsed) : null;
  const effectiveGasPrice = receipt?.effectiveGasPrice ? hexToBigInt(receipt.effectiveGasPrice) : gasPrice;
  const feeWei = gasUsed === null ? null : gasUsed * effectiveGasPrice;
  const currentBlockNumber = hexToNumber(latestBlock);
  const txBlockNumber = tx?.blockNumber ? hexToNumber(tx.blockNumber) : null;
  const confirmations = currentBlockNumber !== null && txBlockNumber !== null
    ? Math.max(0, currentBlockNumber - txBlockNumber + 1)
    : null;

  const warnings = [];
  if (status === "not_found") warnings.push("Transaction was not found on the selected network.");
  if (status === "pending") warnings.push("Transaction exists but no receipt was returned yet.");
  if (status === "failed") warnings.push("Transaction failed. A mined receipt alone usually does not include the revert reason.");
  if (type === "calldata-to-eoa") warnings.push("Transaction sent calldata to an address with no contract bytecode.");
  if (receipt && gasUsed !== null && gasLimit > 0n && gasUsed === gasLimit) warnings.push("Gas used equals gas limit; out-of-gas is possible but not guaranteed.");

  return {
    generatedAt: new Date().toISOString(),
    network: {
      name: network.name,
      chainId: network.chainId,
      rpcHost: rpcHost(network.rpcUrl),
      explorerUrl: network.explorerUrl,
      nativeToken: network.nativeToken
    },
    status,
    type,
    txHash: tx?.hash || null,
    explorerTx: tx ? explorerUrl(network, "tx", tx.hash) : null,
    from: tx?.from || null,
    to: tx?.to || null,
    contractAddress: receipt?.contractAddress || null,
    nonce: tx?.nonce ? hexToNumber(tx.nonce) : null,
    blockNumber: txBlockNumber,
    latestBlock: currentBlockNumber,
    confirmations,
    blockTimestamp: block?.timestamp ? new Date(hexToNumber(block.timestamp) * 1000).toISOString() : null,
    valueWei: valueWei.toString(),
    valueNative: formatDecimal(valueWei, 18, 8),
    gasLimit: gasLimit.toString(),
    gasUsed: gasUsed === null ? null : gasUsed.toString(),
    gasPriceWei: gasPrice.toString(),
    effectiveGasPriceWei: effectiveGasPrice.toString(),
    maxFeePerGasWei: maxFeePerGas === null ? null : maxFeePerGas.toString(),
    maxPriorityFeePerGasWei: maxPriorityFeePerGas === null ? null : maxPriorityFeePerGas.toString(),
    feeWei: feeWei === null ? null : feeWei.toString(),
    feeNative: feeWei === null ? null : formatDecimal(feeWei, 18, 8),
    calldata: {
      selector: hint.selector,
      hint: hint.hint,
      bytes: hint.calldataBytes
    },
    logs: summarizeLogs(receipt?.logs || []),
    replay,
    warnings
  };
}

function renderMarkdown(report) {
  const lines = [];
  lines.push(`# Pharos Transaction Debug Report`);
  lines.push("");
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push(`Network: ${report.network.name} (chain ${report.network.chainId}, ${report.network.nativeToken})`);
  lines.push(`RPC host: ${report.network.rpcHost}`);
  if (report.explorerTx) lines.push(`Explorer: ${report.explorerTx}`);
  lines.push("");
  lines.push(`## Summary`);
  lines.push("");
  lines.push(`- Status: ${report.status}`);
  lines.push(`- Type: ${report.type}`);
  lines.push(`- Hash: ${report.txHash || "not found"}`);
  lines.push(`- From: ${report.from || "n/a"}`);
  lines.push(`- To: ${report.to || "n/a"}`);
  if (report.contractAddress) lines.push(`- Contract address: ${report.contractAddress}`);
  lines.push(`- Value: ${report.valueNative} ${report.network.nativeToken} (${report.valueWei} wei)`);
  if (report.blockNumber !== null) lines.push(`- Block: ${report.blockNumber}`);
  if (report.confirmations !== null) lines.push(`- Confirmations: ${report.confirmations}`);
  if (report.blockTimestamp) lines.push(`- Block time: ${report.blockTimestamp}`);
  lines.push("");
  lines.push(`## Gas And Fee`);
  lines.push("");
  lines.push(`- Gas limit: ${report.gasLimit}`);
  lines.push(`- Gas used: ${report.gasUsed || "pending"}`);
  lines.push(`- Gas price: ${report.gasPriceWei} wei`);
  lines.push(`- Effective gas price: ${report.effectiveGasPriceWei} wei`);
  if (report.maxFeePerGasWei) lines.push(`- Max fee per gas: ${report.maxFeePerGasWei} wei`);
  if (report.maxPriorityFeePerGasWei) lines.push(`- Max priority fee per gas: ${report.maxPriorityFeePerGasWei} wei`);
  lines.push(`- Total fee: ${report.feeNative || "pending"} ${report.network.nativeToken}`);
  lines.push("");
  lines.push(`## Calldata`);
  lines.push("");
  lines.push(`- Selector: ${report.calldata.selector || "none"}`);
  lines.push(`- Hint: ${report.calldata.hint}`);
  lines.push(`- Size: ${report.calldata.bytes} bytes`);
  lines.push("");
  lines.push(`## Logs`);
  lines.push("");
  if (!report.logs.length) {
    lines.push("No logs found.");
  } else {
    for (const log of report.logs) {
      lines.push(`- #${log.index} ${log.event} at ${log.address} (${log.topics} topics, ${log.dataBytes} data bytes)`);
    }
  }
  lines.push("");
  lines.push(`## Replay`);
  lines.push("");
  if (!report.replay) {
    lines.push("Replay not requested or not applicable.");
  } else {
    lines.push(`- Attempted: ${report.replay.attempted}`);
    lines.push(`- Block: ${report.replay.blockNumber}`);
    lines.push(`- Status: ${report.replay.status}`);
    if (report.replay.message) lines.push(`- Message: ${report.replay.message}`);
    if (report.replay.data) lines.push(`- Revert data: ${report.replay.data}`);
    if (report.replay.decoded) lines.push(`- Decoded: ${report.replay.decoded.summary}`);
    if (report.replay.result) lines.push(`- Result: ${report.replay.result}`);
  }
  if (report.warnings.length) {
    lines.push("");
    lines.push(`## Notes`);
    lines.push("");
    for (const warning of report.warnings) lines.push(`- ${warning}`);
  }
  return `${lines.join("\n")}\n`;
}

function renderConsole(report, color = true) {
  const c = {
    reset: color ? "\x1b[0m" : "",
    bold: color ? "\x1b[1m" : "",
    green: color ? "\x1b[32m" : "",
    red: color ? "\x1b[31m" : "",
    yellow: color ? "\x1b[33m" : "",
    cyan: color ? "\x1b[36m" : ""
  };
  const statusColor = report.status === "success" ? c.green : report.status === "failed" ? c.red : c.yellow;
  const lines = [];
  lines.push(`${c.bold}Pharos Transaction Debug Report${c.reset}`);
  lines.push(`Network: ${report.network.name} | chain ${report.network.chainId} | ${report.network.nativeToken}`);
  lines.push(`RPC: ${report.network.rpcHost}`);
  if (report.explorerTx) lines.push(`Explorer: ${report.explorerTx}`);
  lines.push("");
  lines.push(`Status: ${statusColor}${report.status}${c.reset}`);
  lines.push(`Type: ${report.type}`);
  lines.push(`Hash: ${report.txHash || "not found"}`);
  lines.push(`From: ${report.from || "n/a"}`);
  lines.push(`To: ${report.to || "n/a"}`);
  if (report.contractAddress) lines.push(`Contract: ${report.contractAddress}`);
  lines.push(`Value: ${report.valueNative} ${report.network.nativeToken}`);
  if (report.blockNumber !== null) lines.push(`Block: ${report.blockNumber} (${report.confirmations} confirmations)`);
  lines.push("");
  lines.push(`${c.cyan}Gas${c.reset}`);
  lines.push(`  Limit: ${report.gasLimit}`);
  lines.push(`  Used: ${report.gasUsed || "pending"}`);
  lines.push(`  Effective price: ${report.effectiveGasPriceWei} wei`);
  lines.push(`  Total fee: ${report.feeNative || "pending"} ${report.network.nativeToken}`);
  lines.push("");
  lines.push(`${c.cyan}Calldata${c.reset}`);
  lines.push(`  Selector: ${report.calldata.selector || "none"}`);
  lines.push(`  Hint: ${report.calldata.hint}`);
  lines.push(`  Size: ${report.calldata.bytes} bytes`);
  lines.push("");
  lines.push(`${c.cyan}Logs${c.reset}`);
  if (!report.logs.length) {
    lines.push("  none");
  } else {
    for (const log of report.logs) {
      lines.push(`  #${log.index} ${log.event} at ${log.address}`);
    }
  }
  lines.push("");
  lines.push(`${c.cyan}Replay${c.reset}`);
  if (!report.replay) {
    lines.push("  not requested or not applicable");
  } else {
    lines.push(`  Block: ${report.replay.blockNumber}`);
    lines.push(`  Status: ${report.replay.status}`);
    if (report.replay.message) lines.push(`  Message: ${report.replay.message}`);
    if (report.replay.data) lines.push(`  Revert data: ${report.replay.data}`);
    if (report.replay.decoded) lines.push(`  Decoded: ${report.replay.decoded.summary}`);
    if (report.replay.result) lines.push(`  Result: ${report.replay.result}`);
  }
  if (report.warnings.length) {
    lines.push("");
    lines.push(`${c.yellow}Notes${c.reset}`);
    for (const warning of report.warnings) lines.push(`  - ${warning}`);
  }
  return `${lines.join("\n")}\n`;
}

function inferFormat(args) {
  if (args.format) return args.format;
  if (args.output) {
    const lower = args.output.toLowerCase();
    if (lower.endsWith(".json")) return "json";
    if (lower.endsWith(".md") || lower.endsWith(".markdown")) return "markdown";
  }
  return "markdown";
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }
  if (!validateTxHash(args.tx)) {
    throw new Error("Invalid or missing transaction hash. Expected 0x plus 64 hex characters.");
  }

  const config = loadNetworks();
  const network = selectNetwork(config, args.network, args.rpcUrl);
  const format = inferFormat(args);
  if (!["markdown", "json", "console"].includes(format)) {
    throw new Error(`Unsupported format "${format}". Use markdown, json, or console.`);
  }

  const [tx, latestBlock] = await Promise.all([
    rpc(network.rpcUrl, "eth_getTransactionByHash", [args.tx]),
    rpc(network.rpcUrl, "eth_blockNumber", [])
  ]);

  let receipt = null;
  let targetCode = "0x";
  let block = null;
  let replay = null;

  if (tx) {
    receipt = await rpc(network.rpcUrl, "eth_getTransactionReceipt", [args.tx]);
    if (tx.to) {
      const blockTag = tx.blockNumber || "latest";
      targetCode = await rpc(network.rpcUrl, "eth_getCode", [tx.to, blockTag]);
    }
    if (args.includeBlock && tx.blockHash) {
      block = await rpc(network.rpcUrl, "eth_getBlockByHash", [tx.blockHash, false]);
    }
    if (args.replayFailed) {
      replay = await replayFailedTransaction(network.rpcUrl, tx, receipt);
    }
  }

  const report = makeAnalysis({ tx, receipt, block, targetCode, latestBlock, network, replay });
  const output = format === "json"
    ? `${JSON.stringify(report, null, 2)}\n`
    : format === "console"
      ? renderConsole(report, args.color)
      : renderMarkdown(report);

  if (args.output) {
    fs.writeFileSync(args.output, output, "utf8");
  } else {
    process.stdout.write(output);
  }
}

main().catch((error) => {
  console.error(`Error: ${error.message}`);
  process.exitCode = 1;
});

