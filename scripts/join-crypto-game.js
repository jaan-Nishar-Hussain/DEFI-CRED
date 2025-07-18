const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
    const network = process.env.HARDHAT_NETWORK || "hardhat";
    const deploymentPath = `deployments/${network}.json`;
    
    if (!fs.existsSync(deploymentPath)) {
        throw new Error(`No deployment found for network ${network}`);
    }

    const deployment = JSON.parse(fs.readFileSync(deploymentPath));

    // Get contract instance
    const DeFiPredictorV2 = await ethers.getContractFactory("DeFiPredictorV2");
    const predictor = await DeFiPredictorV2.attach(deployment.predictorContract);

    // Get current price
    const currentPrice = await predictor.getLatestPrice();
    console.log("Current ETH Price:", ethers.formatUnits(currentPrice, 8), "USD");

    // Load crypto games
    const cryptoGamesPath = 'crypto/games.json';
    if (!fs.existsSync(cryptoGamesPath)) {
        console.log("No crypto games found. Create one first using create-crypto-game.js");
        return;
    }

    const cryptoGames = JSON.parse(fs.readFileSync(cryptoGamesPath));
    const activeGames = cryptoGames.filter(game => {
        const now = Math.floor(Date.now() / 1000);
        return game.deadline > now;
    });

    if (activeGames.length === 0) {
        console.log("No active crypto games found.");
        return;
    }

    console.log("\nActive Crypto Games:");
    activeGames.forEach((game, index) => {
        console.log(`${index + 1}. Game ID: ${game.gameId}`);
        console.log(`   Entry Fee: ${ethers.formatEther(game.entryFee)} MATIC`);
        console.log(`   Reward: ${game.rewardMultiplier / 10000}x`);
        console.log(`   Ends: ${new Date(game.deadline * 1000).toISOString()}`);
        console.log(`   Created when ETH was: $${ethers.formatUnits(game.currentPriceAtCreation, 8)}`);
        console.log("");
    });

    // Example: Join the first active game
    if (activeGames.length > 0) {
        const gameToJoin = activeGames[0];
        
        // Player's prediction (example: predict ETH will be above $2000)
        const playerPrediction = ethers.parseUnits("2000", 8); // $2000 with 8 decimals
        
        console.log(`\nExample: Joining game ${gameToJoin.gameId}`);
        console.log(`Prediction: ETH will be above $${ethers.formatUnits(playerPrediction, 8)}`);
        console.log(`Current Price: $${ethers.formatUnits(currentPrice, 8)}`);
        console.log(`Entry Fee: ${ethers.formatEther(gameToJoin.entryFee)} MATIC`);
        
        // Uncomment the lines below to actually join the game
        /*
        try {
            const tx = await predictor.joinCryptoPrediction(
                gameToJoin.gameId,
                playerPrediction,
                { value: gameToJoin.entryFee }
            );
            
            console.log("Waiting for transaction confirmation...");
            const receipt = await tx.wait();
            console.log("Successfully joined! Transaction hash:", receipt.transactionHash);
            
            // The contract will automatically determine if you win based on the actual price
            
        } catch (error) {
            console.error("Error joining game:", error.message);
        }
        */
        
        console.log("\nTo actually join the game, uncomment the transaction code in this script.");
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
