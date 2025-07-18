require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

module.exports = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {
      chainId: 31337,
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
    },
    polygonAmoy: {
      url: process.env.ALCHEMY_URL, // Alchemy RPC endpoint
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 80002,
      gasPrice: 35000000000,
    },
  },
etherscan: {
  apiKey: process.env.POLYGONSCAN_API_KEY, // Single key format for v2 API
  customChains: [
    {
      network: "polygonAmoy",
      chainId: 80002,
      urls: {
        apiURL: "https://api-amoy.polygonscan.com/api",
        browserURL: "https://amoy.polygonscan.com"
      }
    }
  ]
},
  sourcify: {
    enabled: true // Enable as fallback
  }
};