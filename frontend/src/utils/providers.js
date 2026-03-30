// src/utils/providers.js
import { ethers } from "ethers";
import { arbitrumSepolia } from "wagmi/chains";

// ---------------------------------------------------------------------------
// RPC endpoints
// Do NOT use import.meta.env here — this file may be evaluated in Node.js
// context (e.g. hardhat scripts) where import.meta doesn't exist.
// Hardcode the fallbacks; Vite will tree-shake and inline them at build time.
// ---------------------------------------------------------------------------
const ARB_RPC =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_ARB_SEPOLIA_RPC) ||
  "https://arb-sepolia.g.alchemy.com/v2/Il3WPGy-R0xsCYDWi0LbG";

const ETH_RPC =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_SEPOLIA_RPC) ||
  "https://eth-sepolia.g.alchemy.com/v2/RL0K93iLy4_YN01pONT5H";

/**
 * Read provider — JsonRpcProvider straight to Alchemy.
 * Use for view calls: balanceOf, usdc(), allowance.
 * Do NOT use for queryFilter/getLogs — Alchemy free tier limits to 10 blocks.
 */
export const getReadProvider = (chainId) => {
  const rpc = chainId === arbitrumSepolia.id ? ARB_RPC : ETH_RPC;
  return new ethers.JsonRpcProvider(rpc);
};

// Public RPCs with no eth_getLogs block range restriction
const ARB_PUBLIC_RPC = "https://sepolia-rollup.arbitrum.io/rpc";
const ETH_PUBLIC_RPC = "https://rpc.sepolia.org";

/**
 * Events provider — uses public RPC for queryFilter/getLogs.
 * Alchemy free tier restricts getLogs to 10 blocks — public RPC has no limit.
 */
export const getEventsProvider = (chainId) => {
  const rpc = chainId === arbitrumSepolia.id ? ARB_PUBLIC_RPC : ETH_PUBLIC_RPC;
  return new ethers.JsonRpcProvider(rpc);
};

/**
 * Write signer — BrowserProvider through MetaMask for signing transactions.
 * Use for approve, deposit, withdraw, paySalary etc.
 */
export const getWriteSigner = async () => {
  const provider = new ethers.BrowserProvider(window.ethereum);
  await provider.send("eth_requestAccounts", []);
  return provider.getSigner();
};