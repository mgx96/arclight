// Quick check of the agent's wallet + Circle Gateway balances. Run with `pnpm balance`.
import { GatewayClient } from "@circle-fin/x402-batching/client";
import { ENV } from "./env.js";
import { ARC_TESTNET } from "./config.js";

const agent = new GatewayClient({
  chain: ARC_TESTNET.x402ChainName,
  privateKey: ENV.agentPrivateKey,
  rpcUrl: ARC_TESTNET.rpcUrl,
});

const b = await agent.getBalances();

console.log(`Agent ${agent.address} on ${ARC_TESTNET.caip2}`);
console.log(`  Wallet USDC        : ${b.wallet.formatted}`);
console.log(`  Gateway available  : ${b.gateway.formattedAvailable}`);
console.log(`  Gateway total      : ${b.gateway.formattedTotal}`);
console.log(`  Gateway withdrawable: ${b.gateway.formattedWithdrawable}`);

if (Number(b.gateway.available) === 0) {
  console.log("\nGateway balance is 0 — deposit USDC before the agent can pay for views:");
  console.log("  await new GatewayClient({ chain: 'arcTestnet', privateKey }).deposit('5')");
}
