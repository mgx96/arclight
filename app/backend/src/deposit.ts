// Deposit USDC from the agent's wallet into its Circle Gateway balance, so it can pay for views.
// Usage: pnpm deposit 5      (amount in USDC; defaults to 5)
import { GatewayClient } from "@circle-fin/x402-batching/client";
import { ENV } from "./env.js";
import { ARC_TESTNET } from "./config.js";

const amount = process.argv[2] ?? "5";

const agent = new GatewayClient({
  chain: ARC_TESTNET.x402ChainName,
  privateKey: ENV.agentPrivateKey,
  rpcUrl: ARC_TESTNET.rpcUrl,
});

console.log(`Depositing ${amount} USDC for agent ${agent.address} ...`);
const result = await agent.deposit(amount);
console.log(`  approval tx: ${result.approvalTxHash ?? "(skipped)"}`);
console.log(`  deposit  tx: ${result.depositTxHash}`);
console.log(`  deposited : ${result.formattedAmount} USDC`);

const b = await agent.getBalances();
console.log(`  Gateway available now: ${b.gateway.formattedAvailable} USDC`);
