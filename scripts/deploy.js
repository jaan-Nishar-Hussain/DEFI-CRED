// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
const hre = require("hardhat");
const fs = require("fs");

// Price feeds for different networks
const PRICE_FEEDS = {
  // Testnet addresses
  polygonAmoy: "0x694AA1769357215DE4FAC081bf1f309aDC325306", // Using Sepolia ETH/USD as a replacement
  
  // Local development
  hardhat: "MOCK", // Will deploy a mock
  localhost: "MOCK", // Will deploy a mock
};

async function main() {
  console.log("Starting deployment process...");
  
  // Get the network we're deploying to
  const networkName = hre.network.name;
  console.log(`Deploying to ${networkName} network...`);
  
  let priceFeedAddress;
  let mockAggregator;
  
  // Check if we need to deploy a mock or use an existing price feed
  if (PRICE_FEEDS[networkName] === "MOCK") {
    console.log("Deploying MockAggregator for local development...");
    const MockAggregator = await hre.ethers.getContractFactory("MockAggregator");
    mockAggregator = await MockAggregator.deploy();
    await mockAggregator.waitForDeployment();
    
    priceFeedAddress = await mockAggregator.getAddress();
    console.log(`MockAggregator deployed to: ${priceFeedAddress}`);
    
    // Initialize price in mock (optional)
    const initialPrice = 200000000000; // $2000 with 8 decimals
    await mockAggregator.setPrice(initialPrice);
    console.log(`MockAggregator price initialized to: $${initialPrice / 100000000}`);
  } else {
    // Use the network-specific price feed
    priceFeedAddress = PRICE_FEEDS[networkName];
    if (!priceFeedAddress) {
      throw new Error(`No price feed configured for network: ${networkName}`);
    }
    console.log(`Using ${networkName} ETH/USD price feed at: ${priceFeedAddress}`);
  }

  // Deploy DeFiPredictorV2
  const DeFiPredictorV2 = await hre.ethers.getContractFactory("DeFiPredictorV2");
  const deFiPredictor = await DeFiPredictorV2.deploy(priceFeedAddress);
  await deFiPredictor.waitForDeployment();

  const deFiPredictorAddress = await deFiPredictor.getAddress();
  const deployTx = deFiPredictor.deploymentTransaction();
  
  console.log(`DeFiPredictorV2 deployed to: ${deFiPredictorAddress}`);
  console.log(`Transaction hash: ${deployTx.hash}`);
  
  // Get deployer address
  const [deployer] = await hre.ethers.getSigners();
  console.log(`Deployed by: ${deployer.address}`);

  // For public networks, verify the contract on the explorer (Etherscan/Polygonscan)
  if (networkName !== "hardhat" && networkName !== "localhost") {
    console.log(`Waiting for block confirmations on ${networkName}...`);
    try {
      // Wait for 6 blocks to ensure the transaction is confirmed
      await hre.ethers.provider.waitForTransaction(deployTx.hash, 6);
      
      console.log(`Verifying contract on ${networkName === "polygonAmoy" ? "Polygonscan" : "Etherscan"}...`);
      await hre.run("verify:verify", {
        address: deFiPredictorAddress,
        constructorArguments: [priceFeedAddress],
      });
      console.log("Contract verified successfully!");
    } catch (error) {
      console.error("Error during verification:", error.message);
      console.log("You may need to verify the contract manually.");
    }
  }

  // Save deployment info
  const deploymentInfo = {
    network: networkName,
    deFiPredictor: deFiPredictorAddress,
    priceFeed: priceFeedAddress,
    admin: deployer.address,
    deployedAt: new Date().toISOString(),
    txHash: deployTx ? deployTx.hash : null
  };

  // Add mock address if we deployed one
  if (mockAggregator) {
    deploymentInfo.mockAggregator = priceFeedAddress;
  }

  const deploymentInfoPath = `./deployment-info-${networkName}.json`;
  fs.writeFileSync(
    deploymentInfoPath,
    JSON.stringify(deploymentInfo, null, 2)
  );
  console.log(`Deployment information saved to ${deploymentInfoPath}`);

  // Also update the main deployment-info.json
  fs.writeFileSync(
    './deployment-info.json',
    JSON.stringify(deploymentInfo, null, 2)
  );
  console.log("Deployment information saved to deployment-info.json");

  console.log(`Deployment to ${networkName} completed successfully!`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
