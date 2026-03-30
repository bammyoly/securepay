// src/hooks/useChainGuard.js
// Reads chainId directly from window.ethereum so it always reflects
// the real wallet state regardless of wagmi's internal sync.

import { useState, useEffect } from "react";
import { arbitrumSepolia } from "wagmi/chains";

export const TARGET_CHAIN_ID = arbitrumSepolia.id; // 421614

export const useChainGuard = () => {
  const [chainId, setChainId] = useState(null);

  useEffect(() => {
    if (!window.ethereum) return;

    // Read current chainId immediately
    const readChain = async () => {
      try {
        const hex = await window.ethereum.request({ method: "eth_chainId" });
        setChainId(parseInt(hex, 16));
      } catch (e) {
        console.error("[useChainGuard] eth_chainId:", e);
      }
    };

    readChain();

    // Listen for chain changes directly on the provider
    const onChainChanged = (hex) => {
      const id = parseInt(hex, 16);
      console.log("[useChainGuard] chainChanged:", id);
      setChainId(id);
    };

    window.ethereum.on("chainChanged", onChainChanged);
    return () => window.ethereum.removeListener("chainChanged", onChainChanged);
  }, []);

  const onArb = chainId === TARGET_CHAIN_ID;

  return { chainId, onArb };
};