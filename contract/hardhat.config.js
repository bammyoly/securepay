require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const {
  SEPOLIA_RPC_URL,
  ARBITRUM_SEPOLIA_RPC_URL,
  PRIVATE_KEY,
  ETHERSCAN_API_KEY,
  ARBISCAN_API_KEY,
} = process.env;

// Fail fast if deploying without a private key
const accounts = PRIVATE_KEY ? [`0x${PRIVATE_KEY.replace(/^0x/, "")}`] : [];

module.exports = {
  solidity: {
    compilers: [
      {
        // Primary compiler — matches cofhe-contracts requirement
        version: "0.8.24",
        settings: {
          optimizer: { enabled: true, runs: 200 },
          evmVersion: "cancun",
        },
      },
      {
        // Keep 0.8.28 available for any toolbox-generated contracts
        version: "0.8.28",
        settings: {
          optimizer: { enabled: true, runs: 200 },
          evmVersion: "cancun",
        },
      },
    ],
  },

  networks: {
    hardhat: {
      chainId: 31337,
    },

    sepolia: {
      url: SEPOLIA_RPC_URL || "https://rpc.sepolia.org",
      accounts,
      chainId: 11155111,
    },

    // ✅ Primary target — CoFHE coprocessor is live here
    arbitrumSepolia: {
      url: ARBITRUM_SEPOLIA_RPC_URL || "https://sepolia-rollup.arbitrum.io/rpc",
      accounts,
      chainId: 421614,
    },
  },

  etherscan: {
    apiKey: {
      // Etherscan for Ethereum Sepolia
      sepolia: ETHERSCAN_API_KEY || "",
      // Arbiscan for Arbitrum Sepolia (different key + endpoint)
      arbitrumSepolia: ARBISCAN_API_KEY || "",
    },
    customChains: [
      {
        network: "arbitrumSepolia",
        chainId: 421614,
        urls: {
          apiURL: "https://api-sepolia.arbiscan.io/api",
          browserURL: "https://sepolia.arbiscan.io",
        },
      },
    ],
  },

  // Deterministic gas reporting
  gasReporter: {
    enabled: process.env.REPORT_GAS === "true",
    currency: "USD",
  },
};