const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
    const network = process.env.HARDHAT_NETWORK || "hardhat";
    const deploymentPath = `deployments/${network}.json`;
    
    if (!fs.existsSync(deploymentPath)) {
        throw new Error(`No deployment found for network ${network}`);
    }

    const deployment = JSON.parse(fs.readFileSync(deploymentPath));
    const merkleData = JSON.parse(fs.readFileSync('quiz/merkle-data.json'));

    console.log("Creating quiz game with the following parameters:");
    console.log("Contract Address:", deployment.predictorContract);
    console.log("Merkle Root:", merkleData.merkleRoot);

    // Get contract instance
    const DeFiPredictorV2 = await ethers.getContractFactory("DeFiPredictorV2");
    const predictor = await DeFiPredictorV2.attach(deployment.predictorContract);

    // Game parameters
    const gameId = `quiz-${Date.now()}`; // Unique game ID
    const entryFee = ethers.parseEther("0.1"); // 0.1 MATIC entry fee
    const rewardMultiplier = 15000; // 1.5x reward (15000 = 1.5 * 10000)
    const platformFee = 500; // 5% platform fee
    const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now

    console.log("\nGame Parameters:");
    console.log("Game ID:", gameId);
    console.log("Entry Fee:", ethers.formatEther(entryFee), "MATIC");
    console.log("Reward Multiplier:", rewardMultiplier / 10000, "x");
    console.log("Platform Fee:", platformFee / 100, "%");
    console.log("Deadline:", new Date(deadline * 1000).toISOString());

    try {
        // Create the quiz game
        console.log("\nCreating quiz game...");
        const tx = await predictor.createGame(
            gameId,
            0, // GameType.Quiz
            merkleData.merkleRoot,
            entryFee,
            rewardMultiplier,
            platformFee,
            deadline,
            0, // PredictionType (not used for quiz)
            0, // priceMin (not used for quiz)
            0  // priceMax (not used for quiz)
        );

        console.log("Waiting for transaction confirmation...");
        const receipt = await tx.wait();
        console.log("Game created! Transaction hash:", receipt.transactionHash);

        // Fund the game
        const fundAmount = ethers.parseEther("1.0"); // Fund with 1 MATIC
        console.log(`\nFunding game with ${ethers.formatEther(fundAmount)} MATIC...`);
        const fundTx = await predictor.fundGame(gameId, { value: fundAmount });
        const fundReceipt = await fundTx.wait();
        console.log("Game funded! Transaction hash:", fundReceipt.transactionHash);

        // Save game info
        const gameInfo = {
            gameId,
            entryFee: entryFee.toString(),
            rewardMultiplier,
            platformFee,
            deadline,
            fundAmount: fundAmount.toString(),
            merkleRoot: merkleData.merkleRoot,
            createTxHash: receipt.transactionHash,
            fundTxHash: fundReceipt.transactionHash,
            timestamp: new Date().toISOString()
        };

        const gamesPath = 'quiz/games.json';
        let games = [];
        if (fs.existsSync(gamesPath)) {
            games = JSON.parse(fs.readFileSync(gamesPath));
        }
        games.push(gameInfo);
        fs.writeFileSync(gamesPath, JSON.stringify(games, null, 2));
        console.log("\nGame information saved to quiz/games.json");

    } catch (error) {
        console.error("Error creating game:", error.message);
        throw error;
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
