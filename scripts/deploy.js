const { ethers, network } = require("hardhat");

async function main() {
  console.log("Starting deployment...");
  console.log("Network:", network.name);

  let priceFeedAddress;

  // Deploy MockPriceFeed for local testing, use real price feed for testnet
  if (network.name === "hardhat" || network.name === "localhost") {
    console.log("Deploying Mock Price Feed...");
    const PriceFeedMock = await ethers.getContractFactory("MockAggregator");
    const priceFeedMock = await PriceFeedMock.deploy(350000000000); // Initial price $3500
    await priceFeedMock.waitForDeployment();
    priceFeedAddress = await priceFeedMock.getAddress();
    console.log("MockAggregator deployed to:", priceFeedAddress);
  } else if (network.name === "polygonAmoy") {
    // Polygon Amoy testnet ETH/USD price feed
    priceFeedAddress = "0xe7656e23fE8077D438aEfbec2fAbDf2D8e070C4f";
    console.log("Using Chainlink Price Feed at:", priceFeedAddress);
  } else {
    throw new Error("Unsupported network. Please use hardhat, localhost, or polygonAmoy");
  }

  // Deploy DeFiPredictorV2
  console.log("Deploying DeFiPredictorV2...");
  const DeFiPredictorV2 = await ethers.getContractFactory("DeFiPredictorV2");
  const predictor = await DeFiPredictorV2.deploy(priceFeedAddress);
  await predictor.waitForDeployment();

  console.log("DeFiPredictorV2 deployed to:", await predictor.getAddress());
  console.log("Admin address:", await predictor.admin());
  
  // Verify contract on testnet
  if (network.name === "polygonAmoy") {
    console.log("Waiting for 5 block confirmations before verification...");
    // Wait for 5 block confirmations
    const receipt = await predictor.deploymentTransaction().wait(5);

    console.log("Verifying contract on Polygonscan...");
    try {
      await hre.run("verify:verify", {
        address: await predictor.getAddress(),
        constructorArguments: [priceFeedAddress],
      });
      console.log("Contract verified successfully");
    } catch (error) {
      console.log("Verification failed:", error.message);
    }
  }

  // Output deployment information
  const deploymentInfo = {
    network: network.name,
    priceFeed: priceFeedAddress,
    predictorContract: await predictor.getAddress(),
    admin: await predictor.admin(),
    merkleRoot: ethers.ZeroHash, // Initial merkle root (empty)
    timestamp: new Date().toISOString()
  };

  console.log("\nDeployment Info:", deploymentInfo);
  
  // Save deployment info to a file
  const fs = require("fs");
  const deploymentPath = `deployments/${network.name}.json`;
  
  // Create deployments directory if it doesn't exist
  if (!fs.existsSync("deployments")) {
    fs.mkdirSync("deployments");
  }

  fs.writeFileSync(
    deploymentPath,
    JSON.stringify(deploymentInfo, null, 2)
  );
  console.log(`\nDeployment info saved to ${deploymentPath}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
