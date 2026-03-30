import { useState } from "react";

const CHAIN_PARAMS = {
  421614: {
    chainId:           "0x66eee",
    chainName:         "Arbitrum Sepolia",
    nativeCurrency:    { name: "Ethereum", symbol: "ETH", decimals: 18 },
    rpcUrls:           ["https://sepolia-rollup.arbitrum.io/rpc"],
    blockExplorerUrls: ["https://sepolia.arbiscan.io"],
  },
  11155111: {
    chainId:           "0xaa36a7",
    chainName:         "Sepolia",
    nativeCurrency:    { name: "Ethereum", symbol: "ETH", decimals: 18 },
    rpcUrls:           ["https://rpc.sepolia.org"],
    blockExplorerUrls: ["https://sepolia.etherscan.io"],
  },
};

export const useNetworkSwitch = () => {
  const [switching,   setSwitching]   = useState(false);
  const [switchError, setSwitchError] = useState("");

  const switchTo = async (targetChainId) => {
    const params = CHAIN_PARAMS[targetChainId];
    if (!params) {
      setSwitchError(`Unknown chain: ${targetChainId}`);
      return false;
    }

    setSwitching(true);
    setSwitchError("");

    try {
      // Step 1: try switching directly (works if chain is already in wallet)
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: params.chainId }],
      });
      return true;

    } catch (err) {
      if (err.code === 4001) {
        // User rejected — silent, not an error
        return false;
      }

      if (err.code === 4902 || err.code === -32603) {
        // Chain not in wallet — add it then switch
        try {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [params],
          });
          return true;
        } catch (addErr) {
          if (addErr.code === 4001) return false; // user rejected add
          console.error("[network] wallet_addEthereumChain failed:", addErr);
          setSwitchError("Failed to add network — try adding Arbitrum Sepolia manually in MetaMask");
          setTimeout(() => setSwitchError(""), 5000);
          return false;
        }
      }

      console.error("[network] wallet_switchEthereumChain failed:", err);
      setSwitchError(`Switch failed (${err.code ?? err.message})`);
      setTimeout(() => setSwitchError(""), 5000);
      return false;

    } finally {
      setSwitching(false);
    }
  };

  return { switchTo, switching, switchError };
};