require("dotenv").config();
const hre = require("hardhat");
const fs  = require("fs");
const path = require("path");

async function main() {
  const { ethers, network, run } = hre;
  const [deployer] = await ethers.getSigners();

  console.log("Deploying with:", deployer.address);
  console.log("Network:", network.name);
  console.log("Chain ID:", (await ethers.provider.getNetwork()).chainId.toString());

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "ETH");
  if (balance === 0n) throw new Error("Deployer has no ETH");

  const usdcAddress = process.env.USDC_ADDRESS;
  if (!usdcAddress) throw new Error("USDC_ADDRESS not set in .env");
  if (!ethers.isAddress(usdcAddress)) throw new Error("Invalid USDC address");

  const { chainId } = await ethers.provider.getNetwork();
  if (chainId === 1n) throw new Error("Mainnet deploy blocked");

  console.log("\nUsing Circle USDC:", usdcAddress);

  // 1. Deploy cUSDC (plain ERC20 wrapper)
  console.log("\nDeploying cUSDC...");
  const cUSDCFactory = await ethers.getContractFactory("cUSDC");
  const cusdc        = await cUSDCFactory.deploy(usdcAddress);
  await cusdc.waitForDeployment();
  const cusdcAddress = await cusdc.getAddress();
  console.log("cUSDC deployed:", cusdcAddress);

  // 2. Deploy Vault (FHE encrypted balances)
  console.log("\nDeploying Vault...");
  const VaultFactory = await ethers.getContractFactory("Vault");
  const vault        = await VaultFactory.deploy(cusdcAddress);
  await vault.waitForDeployment();
  const vaultAddress = await vault.getAddress();
  console.log("Vault deployed:", vaultAddress);

  // 3. Deploy ConfidentialPayroll (uses Vault)
  console.log("\nDeploying ConfidentialPayroll...");
  const PayrollFactory = await ethers.getContractFactory("ConfidentialPayroll");
  const payroll        = await PayrollFactory.deploy(vaultAddress);
  await payroll.waitForDeployment();
  const payrollAddress = await payroll.getAddress();
  console.log("ConfidentialPayroll deployed:", payrollAddress);

  // 4. Link Vault → Payroll
  console.log("\nLinking payroll to vault...");
  const tx = await vault.setPayroll(payrollAddress);
  await tx.wait();
  const linked = await vault.payroll();
  if (linked.toLowerCase() !== payrollAddress.toLowerCase()) {
    throw new Error("Vault payroll link mismatch");
  }
  console.log("Vault linked to payroll ✓");

  // 5. Link cUSDC → Vault (for vaultTransfer)
  console.log("\nLinking vault to cUSDC...");
  const tx2 = await cusdc.setVault(vaultAddress);
  await tx2.wait();
  console.log("cUSDC linked to vault ✓");

  // 6. Export to frontend
  const contractsDir = path.join(__dirname, "..", "..", "frontend", "src", "contracts");
  if (!fs.existsSync(contractsDir)) fs.mkdirSync(contractsDir, { recursive: true });

  const saveContract = async (name, instance) => {
    const artifact = await hre.artifacts.readArtifact(name);
    const addr     = await instance.getAddress();
    fs.writeFileSync(
      path.join(contractsDir, `${name}.json`),
      JSON.stringify({
        address:    addr,
        abi:        artifact.abi,
        network:    network.name,
        chainId:    chainId.toString(),
        deployedAt: new Date().toISOString(),
        deployer:   deployer.address,
      }, null, 2)
    );
    console.log(`Saved ${name}.json → frontend`);
  };

  console.log("\nExporting to frontend...");
  await saveContract("cUSDC", cusdc);
  await saveContract("Vault", vault);
  await saveContract("ConfidentialPayroll", payroll);

  // addresses.json for easy import
  fs.writeFileSync(
    path.join(contractsDir, "addresses.json"),
    JSON.stringify({
      USDC:                 usdcAddress,
      cUSDC:                cusdcAddress,
      Vault:                vaultAddress,
      ConfidentialPayroll:  payrollAddress,
      network:              network.name,
      chainId:              chainId.toString(),
      deployedAt:           new Date().toISOString(),
    }, null, 2)
  );
  console.log("Saved addresses.json");

  // 7. Verify on Arbiscan
  if (network.name === "arbitrumSepolia" && process.env.ARBISCAN_API_KEY) {
    console.log("\nWaiting 30s for Arbiscan to index...");
    await new Promise(r => setTimeout(r, 30000));

    for (const [name, addr, args] of [
      ["cUSDC",                cusdcAddress,  [usdcAddress]],
      ["Vault",                vaultAddress,  [cusdcAddress]],
      ["ConfidentialPayroll",  payrollAddress, [vaultAddress]],
    ]) {
      try {
        await run("verify:verify", { address: addr, constructorArguments: args });
        console.log(`${name} verified`);
      } catch (err) {
        if (err.message?.includes("Already Verified")) console.log(`${name} already verified`);
        else console.warn(`${name} verification failed:`, err.message);
      }
    }
  }

  console.log("\n========== Deployment Summary ==========");
  console.log("Network:              ", network.name);
  console.log("Chain ID:             ", chainId.toString());
  console.log("Circle USDC:          ", usdcAddress);
  console.log("cUSDC:                ", cusdcAddress);
  console.log("Vault:                ", vaultAddress);
  console.log("ConfidentialPayroll:  ", payrollAddress);
  console.log("=========================================\n");
}

main().catch(err => {
  console.error("Deployment failed:", err);
  process.exitCode = 1;
});