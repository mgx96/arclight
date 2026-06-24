// One-time gas float: send a little native USDC from the agent to the creator wallet so the
// creator can submit the on-chain gatewayMint() that settles its Gateway earnings into its wallet.
// On Arc, gas is paid in native USDC. Without this float the creator can never withdraw on-chain.
//
//   pnpm fund-creator            # read-only: print native balances, do nothing
//   pnpm fund-creator --send     # send the gas float (default 0.05), then re-read
//   pnpm fund-creator --send 0.1 # custom amount (native USDC, 18-dec)
import { createPublicClient, createWalletClient, http, formatEther, parseEther, defineChain } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { GatewayClient } from "@circle-fin/x402-batching/client";
import { ENV } from "./env.js";
import { ARC_TESTNET } from "./config.js";

const arc = defineChain({
  id: ARC_TESTNET.chainId,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: [ARC_TESTNET.rpcUrl] } },
});

const send = process.argv.includes("--send");
const amountArg = process.argv.find((a) => /^\d*\.?\d+$/.test(a)) ?? "0.05";

const agentAccount = privateKeyToAccount(ENV.agentPrivateKey);
const creator = ENV.creatorAddress;

const publicClient = createPublicClient({ chain: arc, transport: http(ARC_TESTNET.rpcUrl) });

const agentNative = await publicClient.getBalance({ address: agentAccount.address });
const creatorNative = await publicClient.getBalance({ address: creator });

console.log(`Agent   ${agentAccount.address}`);
console.log(`  native USDC (gas): ${formatEther(agentNative)}`);
console.log(`Creator ${creator}`);
console.log(`  native USDC (gas): ${formatEther(creatorNative)}`);

if (!send) {
  console.log(`\nRead-only. Re-run with \`pnpm fund-creator --send\` to send ${amountArg} native USDC as a gas float.`);
  process.exit(0);
}

const value = parseEther(amountArg);
if (agentNative < value) {
  console.error(`\nAgent native balance ${formatEther(agentNative)} < ${amountArg}; aborting.`);
  process.exit(1);
}

const wallet = createWalletClient({ account: agentAccount, chain: arc, transport: http(ARC_TESTNET.rpcUrl) });
console.log(`\nSending ${amountArg} native USDC gas float → creator …`);
const hash = await wallet.sendTransaction({ to: creator, value });
console.log(`  tx: ${hash}`);
await publicClient.waitForTransactionReceipt({ hash });

const creatorNativeAfter = await publicClient.getBalance({ address: creator });
console.log(`  creator native USDC now: ${formatEther(creatorNativeAfter)}`);

const creatorClient = new GatewayClient({
  chain: ARC_TESTNET.x402ChainName,
  privateKey: ENV.creatorPrivateKey,
  rpcUrl: ARC_TESTNET.rpcUrl,
});
const cb = await creatorClient.getBalances();
console.log(`  creator Gateway available: ${cb.gateway.formattedAvailable} USDC`);
console.log(`  creator wallet USDC:       ${cb.wallet.formatted} USDC`);
