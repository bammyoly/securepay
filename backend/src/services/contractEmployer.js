// src/services/contractEmployer.js
// Called by routes/auth.js after a user registers as employer.
// The backend deployer wallet signs a registerEmployer(wallet) tx
// so the new employer can immediately call paySalary / addEmployee.

import { ethers } from "ethers";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load ABI from wherever your frontend keeps it — adjust path if needed
// e.g. copy ConfidentialPayroll.json from frontend/src/contracts here,
// or reference it relatively across the monorepo.
const artifactPath = path.join(
  __dirname,
  "../../frontend/src/contracts/ConfidentialPayroll.json"
);
const { abi, address: CONTRACT_ADDRESS } = JSON.parse(
  readFileSync(artifactPath, "utf8")
);

let _contract = null;

function getContract() {
  if (_contract) return _contract;

  const rpcUrl     = process.env.RPC_URL;
  const privateKey = process.env.DEPLOYER_PRIVATE_KEY;

  if (!rpcUrl)     throw new Error("RPC_URL not set in .env");
  if (!privateKey) throw new Error("DEPLOYER_PRIVATE_KEY not set in .env");

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const signer   = new ethers.Wallet(privateKey, provider);
  _contract      = new ethers.Contract(CONTRACT_ADDRESS, abi, signer);
  return _contract;
}

/**
 * Registers a wallet as an employer on the ConfidentialPayroll contract.
 * Called once after a user completes the registration flow with role=employer.
 *
 * @param {string} walletAddress  - The employer's wallet address (checksummed or lowercase)
 * @returns {string}              - The transaction hash
 */
export async function registerEmployerOnChain(walletAddress) {
  const contract = getContract();

  // Check if already registered (idempotent)
  const already = await contract.isEmployer(walletAddress);
  if (already) {
    console.log(`[contract] ${walletAddress} already registered as employer — skipping`);
    return null;
  }

  console.log(`[contract] registering employer: ${walletAddress}`);
  const tx = await contract.registerEmployer(walletAddress);
  await tx.wait();
  console.log(`[contract] employer registered ✓ tx: ${tx.hash}`);
  return tx.hash;
}

/**
 * Revokes employer access on-chain.
 * Optional — call if an employer account is deleted or suspended.
 *
 * @param {string} walletAddress
 */
export async function revokeEmployerOnChain(walletAddress) {
  const contract = getContract();
  const active   = await contract.isEmployer(walletAddress);
  if (!active) return null;

  const tx = await contract.revokeEmployer(walletAddress);
  await tx.wait();
  console.log(`[contract] employer revoked ✓ tx: ${tx.hash}`);
  return tx.hash;
}