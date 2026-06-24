"use client";

import { formatUnits } from "viem";
import { useAccount, useBalance } from "wagmi";
import { arcTestnet } from "./chain";

// Live, wallet-specific balance: reads the CONNECTED wallet's native USDC on Arc straight from the RPC,
// so the number reflects whichever wallet is connected right now and updates the moment you switch. This
// is independent of the backend's fixed demo-creator identity, which earns and signs payouts.
export function useWalletBalance() {
  const { address, isConnected } = useAccount();
  const { data, isLoading, refetch } = useBalance({
    address,
    chainId: arcTestnet.id,
    query: { enabled: !!address, refetchInterval: 12_000 },
  });

  return {
    isConnected,
    address,
    usdc: data ? Number(formatUnits(data.value, data.decimals)) : null,
    symbol: data?.symbol ?? "USDC",
    isLoading,
    refetch,
  };
}
