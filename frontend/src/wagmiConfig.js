import { http, createConfig, fallback } from "wagmi";
import { sepolia, arbitrumSepolia } from "wagmi/chains";
import { injected, walletConnect, coinbaseWallet } from "wagmi/connectors";

const projectId        = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID;
const sepoliaRpc       = import.meta.env.VITE_SEPOLIA_RPC       || "https://rpc.sepolia.org";
const arbSepoliaRpc    = import.meta.env.VITE_ARB_SEPOLIA_RPC   || "https://sepolia-rollup.arbitrum.io/rpc";

if (!projectId) {
  console.warn("[wagmi] VITE_WALLETCONNECT_PROJECT_ID is not set — WalletConnect will not work");
}

export const SUPPORTED_CHAINS = [arbitrumSepolia, sepolia];

// Arbitrum Sepolia is the primary chain (CoFHE coprocessor lives here)
export const PRIMARY_CHAIN = arbitrumSepolia;

export const config = createConfig({
  chains: [arbitrumSepolia, sepolia],   // first chain = default

  connectors: [
    injected(),
    walletConnect({
      projectId,
      showQrModal: true,
      metadata: {
        name:        "Confidential Payroll",
        description: "FHE-encrypted payroll on Fhenix CoFHE",
        url:         window.location.origin,
        icons:       [`${window.location.origin}/logo.png`],
      },
    }),
    coinbaseWallet({
      appName: "Confidential Payroll",
    }),
  ],

  transports: {
    // Fallback to public RPC if env var is not set
    [arbitrumSepolia.id]: fallback([
      http(arbSepoliaRpc),
      http("https://arbitrum-sepolia.drpc.org"),
    ]),
    [sepolia.id]: fallback([
      http(sepoliaRpc),
      http("https://ethereum-sepolia.drpc.org"),
    ]),
  },
});