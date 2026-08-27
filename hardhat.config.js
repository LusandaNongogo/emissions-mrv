require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const { SEPOLIA_RPC_URL, PRIVATE_KEY, ETHERSCAN_API_KEY } = process.env;

// The sepolia network is only declared when the required environment variables are
// present, so `npx hardhat test` runs against the in-process network without needing
// an RPC endpoint or a funded key.
const networks = {};
if (SEPOLIA_RPC_URL && PRIVATE_KEY) {
  networks.sepolia = {
    url: SEPOLIA_RPC_URL,
    accounts: [PRIVATE_KEY],
  };
}

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      // Optimizer left off to match the Remix settings the deployed contract was
      // compiled with, so recompiling here reproduces the deployed bytecode.
      optimizer: { enabled: false, runs: 200 },
    },
  },
  networks,
  etherscan: {
    apiKey: ETHERSCAN_API_KEY || "",
  },
};
