// One-off validation: does Circle Gateway's same-chain `withdraw()` honor an arbitrary `recipient`?
// If yes, the creator's batched Gateway earnings can be settled straight into the managed (MPC) wallet
// in a single instant hop — collapsing today's two-step Withdraw→Move into one.
//
//   pnpm tsx src/validate-withdraw-recipient.ts             # read-only: print balances, do nothing
//   pnpm tsx src/validate-withdraw-recipient.ts --send      # withdraw 0.05 USDC → managed wallet
//   pnpm tsx src/validate-withdraw-recipient.ts --send 0.1  # custom amount
import { createPublicClient, http, formatEther, defineChain } from "viem";
import { GatewayClient } from "@circle-fin/x402-batching/client";
import { ENV } from "./env.js";
import { ARC_TESTNET } from "./config.js";
import { getInfo } from "./circle-treasury.js";

const arc = defineChain({
  id: ARC_TESTNET.chainId,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: [ARC_TESTNET.rpcUrl] } },
});

const send = process.argv.includes("--send");
const amount = process.argv.find((a) => /^\d*\.?\d+$/.test(a)) ?? "0.05";

const managed = await getInfo();
if (!managed) {
  console.error("No managed wallet provisioned — set CIRCLE_API_KEY/CIRCLE_ENTITY_SECRET and run the demo once first.");
  process.exit(1);
}

const creator = new GatewayClient({
  chain: ARC_TESTNET.x402ChainName,
  privateKey: ENV.creatorPrivateKey,
  rpcUrl: ARC_TESTNET.rpcUrl,
});
const publicClient = createPublicClient({ chain: arc, transport: http(ARC_TESTNET.rpcUrl) });

const before = await creator.getBalances();
const managedBefore = await publicClient.getBalance({ address: managed.address });

console.log(`Creator key        ${creator.address}`);
console.log(`  Gateway available: ${before.gateway.formattedAvailable} USDC`);
console.log(`Managed wallet     ${managed.address}`);
console.log(`  on-chain USDC:     ${formatEther(managedBefore)} USDC`);

if (!send) {
  console.log(`\nRead-only. Re-run with \`--send\` to withdraw ${amount} USDC to the managed wallet and confirm recipient is honored.`);
  process.exit(0);
}

// If there's no Gateway credit on hand, top it up from the creator's own on-chain USDC so the
// validation is deterministic (doesn't depend on view-batching timing). Net effect: the creator's
// own funds round-trip out to the managed wallet, which is exactly the path we want to prove.
if (Number(before.gateway.formattedAvailable) < Number(amount)) {
  const topUp = (Number(amount) + 0.03).toFixed(6); // small buffer over the withdraw amount for fees
  console.log(`\nGateway available below ${amount}; depositing ${topUp} from creator on-chain USDC first …`);
  const dep = await creator.deposit(topUp);
  console.log(`  deposit tx: ${dep.depositTxHash}`);
  const mid = await creator.getBalances();
  console.log(`  Gateway available now: ${mid.gateway.formattedAvailable} USDC`);
}

console.log(`\nWithdrawing ${amount} USDC, recipient = managed wallet (same chain, instant) …`);
const result = await creator.withdraw(amount, { recipient: managed.address });
console.log(`  mintTxHash:   ${result.mintTxHash}`);
console.log(`  amount:       ${result.formattedAmount} USDC`);
console.log(`  recipient:    ${result.recipient}`);

const managedAfter = await publicClient.getBalance({ address: managed.address });
const delta = formatEther(managedAfter - managedBefore);
console.log(`\nManaged wallet on-chain USDC: ${formatEther(managedBefore)} → ${formatEther(managedAfter)}  (Δ +${delta})`);

const recipientMatch = result.recipient.toLowerCase() === managed.address.toLowerCase();
const fundsLanded = managedAfter > managedBefore;
console.log(`\nrecipient honored: ${recipientMatch ? "YES ✓" : "NO ✗"}`);
console.log(`funds landed in managed wallet: ${fundsLanded ? "YES ✓" : "NO ✗ (mint may still be settling)"}`);
console.log(recipientMatch && fundsLanded
  ? "\n=> withdraw({ recipient }) works on Arc. Auto-settle Gateway→managed in one hop is viable."
  : "\n=> Inconclusive — inspect the tx on Arcscan before relying on it.");
