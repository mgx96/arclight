"use client";

import { createConfig, http, WagmiProvider } from "wagmi";
import { injected } from "wagmi/connectors";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { arcTestnet } from "@/lib/chain";

// Wallet connect is used to pick where Send and Bridge land. EIP-6963 discovery (on by default) adds
// each installed wallet as its own connector, so the user can choose MetaMask vs Coinbase vs others
// instead of us auto-grabbing whatever wallet hijacked window.ethereum. The generic injected() stays
// as a labelled fallback for browsers that don't announce via EIP-6963.
const wagmiConfig = createConfig({
  chains: [arcTestnet],
  connectors: [injected({ shimDisconnect: true })],
  multiInjectedProviderDiscovery: true,
  transports: { [arcTestnet.id]: http() },
  ssr: true,
});

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
