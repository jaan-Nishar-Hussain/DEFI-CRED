const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
    const network = process.env.HARDHAT_NETWORK || "hardhat";
    const deploymentPath = `deployments/${network}.json`;
    
    if (!fs.existsSync(deploymentPath)) {
        throw new Error(`No deployment found for network ${network}`);
    }

    const deployment = JSON.parse(fs.readFileSync(deploymentPath));

    console.log("Creating crypto prediction game with the following parameters:");
    console.log("Contract Address:", deployment.predictorContract);
    console.log("Price Feed Address:", deployment.priceFeed);

    // Get contract instance
    const DeFiPredictorV2 = await ethers.getContractFactory("DeFiPredictorV2");
    const predictor = await DeFiPredictorV2.attach(deployment.predictorContract);

    // Get current price for reference
    const currentPrice = await predictor.getLatestPrice();
    console.log("Current ETH Price:", ethers.formatUnits(currentPrice, 8), "USD");

    // Game parameters
    const gameId = `crypto-${Date.now()}`; // Unique game ID
    const entryFee = ethers.parseEther("0.05"); // 0.05 MATIC entry fee
    const rewardMultiplier = 20000; // 2x reward (20000 = 2.0 * 10000)
    const platformFee = 300; // 3% platform fee
    const deadline = Math.floor(Date.now() / 1000) + 7200; // 2 hours from now
    
    // Prediction parameters - players predict if price will be greater than current price
    const predictionType = 0; // 0 = GreaterThan, 1 = LessThan, 2 = Between
    const priceMin = 0; // Not used for GreaterThan prediction
    const priceMax = 0; // Not used for GreaterThan prediction

    console.log("\nGame Parameters:");
    console.log("Game ID:", gameId);
    console.log("Entry Fee:", ethers.formatEther(entryFee), "MATIC");
    console.log("Reward Multiplier:", rewardMultiplier / 10000, "x");
    console.log("Platform Fee:", platformFee / 100, "%");
    console.log("Deadline:", new Date(deadline * 1000).toISOString());
    console.log("Prediction Type: Players predict if ETH price will be GREATER than their prediction");
    console.log("Current Reference Price:", ethers.formatUnits(currentPrice, 8), "USD");

    try {
        // Create the crypto prediction game
        console.log("\nCreating crypto prediction game...");
        const tx = await predictor.createGame(
            gameId,
            1, // GameType.Crypto
            ethers.ZeroHash, // No merkle root for crypto games
            entryFee,
            rewardMultiplier,
            platformFee,
            deadline,
            predictionType, // PredictionType.GreaterThan
            priceMin,
            priceMax
        );

        console.log("Waiting for transaction confirmation...");
        const receipt = await tx.wait();
        console.log("Game created! Transaction hash:", receipt.transactionHash);

        // Fund the game
        const fundAmount = ethers.parseEther("2.0"); // Fund with 2 MATIC
        console.log(`\nFunding game with ${ethers.formatEther(fundAmount)} MATIC...`);
        const fundTx = await predictor.fundGame(gameId, { value: fundAmount });
        const fundReceipt = await fundTx.wait();
        console.log("Game funded! Transaction hash:", fundReceipt.transactionHash);

        // Save game info
        const gameInfo = {
            gameId,
            gameType: "crypto",
            entryFee: entryFee.toString(),
            rewardMultiplier,
            platformFee,
            deadline,
            predictionType,
            priceMin,
            priceMax,
            fundAmount: fundAmount.toString(),
            currentPriceAtCreation: currentPrice.toString(),
            createTxHash: receipt.transactionHash,
            fundTxHash: fundReceipt.transactionHash,
            timestamp: new Date().toISOString()
        };

        // Save to crypto games file
        const cryptoGamesPath = 'crypto/games.json';
        if (!fs.existsSync('crypto')) {
            fs.mkdirSync('crypto');
        }
        
        let cryptoGames = [];
        if (fs.existsSync(cryptoGamesPath)) {
            cryptoGames = JSON.parse(fs.readFileSync(cryptoGamesPath));
        }
        cryptoGames.push(gameInfo);
        fs.writeFileSync(cryptoGamesPath, JSON.stringify(cryptoGames, null, 2));
        console.log("\nCrypto game information saved to crypto/games.json");

        console.log("\n=== Game Created Successfully! ===");
        console.log("Players can now join by predicting a price.");
        console.log("If the actual ETH price is GREATER than their prediction, they win!");
        console.log("Example: If player predicts $2000 and actual price is $2100, they win 2x their stake!");

    } catch (error) {
        console.error("Error creating crypto game:", error.message);
        throw error;
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
