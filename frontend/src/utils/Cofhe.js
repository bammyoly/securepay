// src/utils/Cofhe.js
// Singleton cofhejs manager — Arbitrum Sepolia (421614)

import { arbitrumSepolia } from "wagmi/chains";

const TARGET_CHAIN_ID = arbitrumSepolia.id; // 421614

let _cofhejs          = null;
let _FheTypes         = null;
let _Encryptable      = null;
let _ready            = false;
let _initError        = null;
let _lastChainId      = null;
let _listenerAttached = false;
let _initPromise      = null; // lock — prevents concurrent/duplicate init calls

export const isCofheReady  = () => _ready;
export const getCofheError = () => _initError;

const reset = () => {
  _ready       = false;
  _initError   = null;
  _lastChainId = null;
  _initPromise = null; // clear lock so next init can run
};

const attachChainListener = () => {
  if (_listenerAttached || !window.ethereum) return;
  window.ethereum.on("chainChanged", (hex) => {
    console.log("[Cofhe] chainChanged →", parseInt(hex, 16));
    reset();
  });
  _listenerAttached = true;
};

const getCurrentChainId = async () => {
  const hex = await window.ethereum.request({ method: "eth_chainId" });
  return parseInt(hex, 16);
};

const _doInit = async () => {
  const chainId = await getCurrentChainId();
  if (chainId !== TARGET_CHAIN_ID) {
    const msg = `Wrong network (${chainId}) — switch to Arbitrum Sepolia`;
    _initError = msg;
    return { success: false, error: msg };
  }

  if (!_cofhejs) {
    console.log("[Cofhe] loading cofhejs/web...");
    const mod    = await import("cofhejs/web");
    _cofhejs     = mod.cofhejs;
    _FheTypes    = mod.FheTypes;
    _Encryptable = mod.Encryptable;
  }

  await window.ethereum.request({ method: "eth_requestAccounts" });

  const ethersV5       = await import("ethers-v5");
  const ethersProvider = new ethersV5.ethers.providers.Web3Provider(window.ethereum, "any");
  await ethersProvider.ready;
  const ethersSigner   = ethersProvider.getSigner();

  console.log("[Cofhe] calling initializeWithEthers...");
  const initResult = await _cofhejs.initializeWithEthers({
    ethersProvider,
    ethersSigner,
    environment: "TESTNET",
  });
  console.log("[Cofhe] initializeWithEthers:", initResult);

  if (!initResult.success) {
    const cause = initResult.error?.cause;
    console.error("[Cofhe] cause:", cause);
    throw new Error(cause?.message ?? initResult.error?.message ?? "initializeWithEthers failed");
  }

  const permitResult = await _cofhejs.createPermit();
  console.log("[Cofhe] createPermit:", permitResult);

  if (!permitResult.success) {
    const cause = permitResult.error?.cause;
    console.error("[Cofhe] permit cause:", cause);
    throw new Error(cause?.message ?? permitResult.error?.message ?? "createPermit failed");
  }

  _ready       = true;
  _lastChainId = TARGET_CHAIN_ID;
  _initError   = null;
  console.log("[Cofhe] ready ✓");
  return { success: true };
};

export const initializeCofhejs = async () => {
  attachChainListener();

  // Already ready on the correct chain — return immediately, no MetaMask prompt
  if (_ready && _lastChainId === TARGET_CHAIN_ID) return { success: true };

  // Was ready on a different chain — reset
  if (_ready) reset();

  // If init is already in progress, return the same promise
  // This prevents React StrictMode / multiple components from triggering
  // parallel inits that each request a MetaMask signature
  if (_initPromise) {
    console.log("[Cofhe] init already in progress, reusing promise");
    return _initPromise;
  }

  // Start init and store the promise
  _initPromise = _doInit().catch((err) => {
    _ready     = false;
    _initError = err.message ?? String(err);
    _initPromise = null;
    console.error("[Cofhe] init failed:", err);
    return { success: false, error: _initError };
  });

  return _initPromise;
};

export const unsealValue = async (ctHash, fheType) => {
  if (!_ready) throw new Error("CoFHE not initialized");
  const type   = fheType ?? _FheTypes.Uint64;
  const result = await _cofhejs.unseal(ctHash, type);
  console.log("[Cofhe] unseal:", result);
  if (!result.success) {
    throw new Error(result.error?.cause?.message ?? result.error?.message ?? "unseal failed");
  }
  return result.data;
};

export const encryptValue = async (encryptable) => {
  if (!_ready) throw new Error("CoFHE not initialized");
  const result = await _cofhejs.encrypt([encryptable]);
  console.log("[Cofhe] encrypt:", result);
  if (!result.success || !result.data?.[0]) {
    throw new Error(result.error?.cause?.message ?? result.error?.message ?? "encrypt failed");
  }
  return result.data[0];
};

export const getEncryptable = () => _Encryptable;
export const getFheTypes    = () => _FheTypes;