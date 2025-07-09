const {
  time,
  loadFixture,
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { MerkleTree } = require("merkletreejs");
const keccak256 = require("keccak256");

// Import quiz questions
const quizQuestions = require("../quiz-export.json");

describe("DeFiPredictor Integration Tests", function () {
  async function deployFullSystemFixture() {
    const [owner, player1, player2, player3, player4] = await ethers.getSigners();

    const MockAggregator = await ethers.getContractFactory("MockAggregator");
    const mockAggregator = await MockAggregator.deploy();

    const DeFiPredictorV2 = await ethers.getContractFactory("DeFiPredictorV2");
    const deFiPredictor = await DeFiPredictorV2.deploy(mockAggregator.target);

    return { deFiPredictor, mockAggregator, owner, player1, player2, player3, player4 };
  }

  function createQuizMerkleTree(questions) {
    const leaves = questions.map(q => {
      const questionId = q.question.substring(0, 20);
      const correctAnswer = q.options.indexOf(q.answer);
      return keccak256(ethers.solidityPacked(["string", "uint8"], [questionId, correctAnswer]));
    });
    return new MerkleTree(leaves, keccak256, { sortPairs: true });
  }

  function getQuizMerkleProof(tree, questionId, answer) {
    const leaf = keccak256(ethers.solidityPacked(["string", "uint8"], [questionId, answer]));
    return tree.getHexProof(leaf);
  }

  describe("Complete Game Lifecycle Tests", function () {
    it("Should run a complete quiz game with real questions", async function () {
      const { deFiPredictor, owner, player1, player2, player3 } = await loadFixture(deployFullSystemFixture);
      
      // Filter crypto questions from JSON
      const cryptoQuestions = quizQuestions.filter(q => q.topic === "Crypto").slice(0, 5);
      const tree = createQuizMerkleTree(cryptoQuestions);
      const merkleRoot = tree.getHexRoot();

      const gameId = "complete_quiz_game";
      const deadline = await time.latest() + 3600;
      const entryFee = ethers.parseEther("0.1");
      const rewardMultiplier = 15000; // 150%

      // Step 1: Admin creates the game
      await expect(deFiPredictor.createGame(
        gameId, 0, merkleRoot, entryFee, rewardMultiplier, 500, deadline, 0, 0, 0
      )).to.emit(deFiPredictor, "GameCreated");

      // Step 2: Admin funds the game
      const fundAmount = ethers.parseEther("2");
      await expect(deFiPredictor.fundGame(gameId, { value: fundAmount }))
        .to.emit(deFiPredictor, "GameFunded");

      // Step 3: Players join with correct answers
      for (let i = 0; i < Math.min(3, cryptoQuestions.length); i++) {
        const question = cryptoQuestions[i];
        const questionId = question.question.substring(0, 20);
        const correctAnswer = question.options.indexOf(question.answer);
        const proof = getQuizMerkleProof(tree, questionId, correctAnswer);

        const player = [player1, player2, player3][i];
        
        const initialBalance = await ethers.provider.getBalance(player.address);
        
        await expect(deFiPredictor.connect(player).joinQuiz(
          gameId, proof, questionId, correctAnswer, { value: entryFee }
        )).to.emit(deFiPredictor, "ClaimedReward");

        const finalBalance = await ethers.provider.getBalance(player.address);
        
        // Player should receive reward
        expect(finalBalance).to.be.greaterThan(initialBalance - ethers.parseEther("0.05"));
        
        console.log(`✓ Player ${i + 1} answered: "${question.question.substring(0, 50)}..."`);
        console.log(`  Answer: ${question.answer}`);
      }

      // Step 4: Check game state
      const players = await deFiPredictor.getGamePlayers(gameId);
      expect(players.length).to.equal(3);

      const gameInfo = await deFiPredictor.getGameInfo(gameId);
      expect(gameInfo.status).to.equal(1); // Still active

      // Step 5: Admin ends the game after deadline
      await time.increaseTo(deadline + 1);
      await expect(deFiPredictor.endGame(gameId))
        .to.emit(deFiPredictor, "GameEnded");
    });

    it("Should run a complete crypto prediction game", async function () {
      const { deFiPredictor, mockAggregator, owner, player1, player2, player3 } = await loadFixture(deployFullSystemFixture);
      
      const gameId = "complete_crypto_game";
      const deadline = await time.latest() + 3600;
      const entryFee = ethers.parseEther("0.05");

      // Step 1: Set initial price
      const initialPrice = 200000000000; // $2000
      await mockAggregator.setPrice(initialPrice);

      // Step 2: Create crypto prediction game
      await expect(deFiPredictor.createGame(
        gameId, 1, ethers.ZeroHash, entryFee, 12000, 300, deadline, 0, 0, 0
      )).to.emit(deFiPredictor, "GameCreated");

      // Step 3: Fund the game
      await deFiPredictor.fundGame(gameId, { value: ethers.parseEther("1") });

      // Step 4: Players make predictions
      const predictions = [
        { player: player1, prediction: 190000000000, finalPrice: 210000000000 }, // Correct: 210 > 190
        { player: player2, prediction: 220000000000, finalPrice: 210000000000 }, // Incorrect: 210 < 220
        { player: player3, prediction: 180000000000, finalPrice: 210000000000 }  // Correct: 210 > 180
      ];

      for (const pred of predictions) {
        await mockAggregator.setPrice(pred.finalPrice);
        
        const initialBalance = await ethers.provider.getBalance(pred.player.address);
        
        await expect(deFiPredictor.connect(pred.player).joinCryptoPrediction(
          gameId, pred.prediction, { value: entryFee }
        )).to.emit(deFiPredictor, "ClaimedReward");

        const playerData = await deFiPredictor.getPlayerData(gameId, pred.player.address);
        expect(playerData.joined).to.be.true;
        expect(playerData.prediction).to.equal(pred.prediction);

        console.log(`✓ Player predicted: $${pred.prediction / 100000000}, Actual: $${pred.finalPrice / 100000000}`);
      }

      // Step 5: Check platform fees were collected
      const platformFees = await deFiPredictor.totalPlatformFees();
      expect(platformFees).to.be.greaterThan(0);

      // Step 6: End game and withdraw fees
      await time.increaseTo(deadline + 1);
      await deFiPredictor.endGame(gameId);
      
      const initialAdminBalance = await ethers.provider.getBalance(owner.address);
      await deFiPredictor.withdrawFees(platformFees);
      const finalAdminBalance = await ethers.provider.getBalance(owner.address);
      
      expect(finalAdminBalance).to.be.greaterThan(initialAdminBalance);
    });
  });

  describe("Multi-Game Concurrent Testing", function () {
    it("Should handle multiple games running simultaneously", async function () {
      const { deFiPredictor, mockAggregator, owner, player1, player2, player3, player4 } = await loadFixture(deployFullSystemFixture);
      
      const deadline = await time.latest() + 3600;

      // Create Quiz Game
      const cryptoQuestions = quizQuestions.filter(q => q.topic === "Crypto").slice(0, 3);
      const quizTree = createQuizMerkleTree(cryptoQuestions);
      const quizGameId = "multi_quiz_game";

      await deFiPredictor.createGame(
        quizGameId, 0, quizTree.getHexRoot(), ethers.parseEther("0.1"), 15000, 500, deadline, 0, 0, 0
      );
      await deFiPredictor.fundGame(quizGameId, { value: ethers.parseEther("1") });

      // Create Crypto Game 1 - Greater Than
      const cryptoGame1Id = "multi_crypto_game_1";
      await deFiPredictor.createGame(
        cryptoGame1Id, 1, ethers.ZeroHash, ethers.parseEther("0.05"), 12000, 300, deadline, 0, 0, 0
      );
      await deFiPredictor.fundGame(cryptoGame1Id, { value: ethers.parseEther("0.5") });

      // Create Crypto Game 2 - Between
      const cryptoGame2Id = "multi_crypto_game_2";
      await deFiPredictor.createGame(
        cryptoGame2Id, 1, ethers.ZeroHash, ethers.parseEther("0.08"), 11000, 400, deadline, 2, 
        195000000000, 205000000000 // Between $1950 and $2050
      );
      await deFiPredictor.fundGame(cryptoGame2Id, { value: ethers.parseEther("0.8") });

      // Players participate in different games
      await mockAggregator.setPrice(200000000000); // $2000

      // Player 1: Quiz game
      const question = cryptoQuestions[0];
      const questionId = question.question.substring(0, 20);
      const correctAnswer = question.options.indexOf(question.answer);
      const proof = getQuizMerkleProof(quizTree, questionId, correctAnswer);

      await deFiPredictor.connect(player1).joinQuiz(
        quizGameId, proof, questionId, correctAnswer, { value: ethers.parseEther("0.1") }
      );

      // Player 2: Crypto game 1 (Greater Than)
      await mockAggregator.setPrice(210000000000); // $2100
      await deFiPredictor.connect(player2).joinCryptoPrediction(
        cryptoGame1Id, 190000000000, { value: ethers.parseEther("0.05") }
      );

      // Player 3: Crypto game 2 (Between)
      await mockAggregator.setPrice(200000000000); // $2000 (between range)
      await deFiPredictor.connect(player3).joinCryptoPrediction(
        cryptoGame2Id, 0, { value: ethers.parseEther("0.08") }
      );

      // Player 4: Multiple games
      await deFiPredictor.connect(player4).joinCryptoPrediction(
        cryptoGame1Id, 205000000000, { value: ethers.parseEther("0.05") }
      );

      // Verify all games have correct participants
      const quizPlayers = await deFiPredictor.getGamePlayers(quizGameId);
      const crypto1Players = await deFiPredictor.getGamePlayers(cryptoGame1Id);
      const crypto2Players = await deFiPredictor.getGamePlayers(cryptoGame2Id);

      expect(quizPlayers.length).to.equal(1);
      expect(crypto1Players.length).to.equal(2);
      expect(crypto2Players.length).to.equal(1);

      console.log("✓ Successfully handled 3 concurrent games with 4 players");
    });
  });

  describe("Real-World Scenario Tests", function () {
    it("Should simulate a popular quiz with high participation", async function () {
      const { deFiPredictor, owner, player1, player2, player3, player4 } = await loadFixture(deployFullSystemFixture);
      
      // Use General Knowledge questions for broader appeal
      const generalQuestions = quizQuestions.filter(q => q.topic === "General Knowledge").slice(0, 10);
      const tree = createQuizMerkleTree(generalQuestions);
      
      const gameId = "popular_quiz_game";
      const deadline = await time.latest() + 7200; // 2 hours
      const entryFee = ethers.parseEther("0.01"); // Low entry fee

      await deFiPredictor.createGame(
        gameId, 0, tree.getHexRoot(), entryFee, 11000, 1000, deadline, 0, 0, 0 // 110% reward, 10% fee
      );

      // High funding for popular game
      await deFiPredictor.fundGame(gameId, { value: ethers.parseEther("5") });

      const players = [player1, player2, player3, player4];
      
      // Multiple players answer different questions
      for (let i = 0; i < players.length && i < generalQuestions.length; i++) {
        const question = generalQuestions[i];
        const questionId = question.question.substring(0, 20);
        const correctAnswer = question.options.indexOf(question.answer);
        const proof = getQuizMerkleProof(tree, questionId, correctAnswer);

        await expect(deFiPredictor.connect(players[i]).joinQuiz(
          gameId, proof, questionId, correctAnswer, { value: entryFee }
        )).to.emit(deFiPredictor, "ClaimedReward");

        console.log(`✓ Player ${i + 1}: ${question.question.substring(0, 40)}... → ${question.answer}`);
      }

      const totalPlayers = await deFiPredictor.getGamePlayers(gameId);
      expect(totalPlayers.length).to.equal(4);

      const gameInfo = await deFiPredictor.getGameInfo(gameId);
      console.log(`Game funded with: ${ethers.formatEther(gameInfo.fundedAmount)} ETH`);
    });

    it("Should simulate volatile crypto market conditions", async function () {
      const { deFiPredictor, mockAggregator, owner, player1, player2 } = await loadFixture(deployFullSystemFixture);
      
      const gameId = "volatile_crypto_game";
      const deadline = await time.latest() + 1800; // 30 minutes
      
      await deFiPredictor.createGame(
        gameId, 1, ethers.ZeroHash, ethers.parseEther("0.1"), 20000, 500, deadline, 0, 0, 0 // High reward for volatility
      );
      await deFiPredictor.fundGame(gameId, { value: ethers.parseEther("3") });

      // Simulate volatile price movements
      const priceMovements = [
        200000000000, // $2000 start
        195000000000, // $1950 (-2.5%)
        220000000000, // $2200 (+12.8%)
        185000000000, // $1850 (-15.9%)
        240000000000, // $2400 (+29.7%)
      ];

      for (let i = 0; i < priceMovements.length - 1; i++) {
        await mockAggregator.setPrice(priceMovements[i]);
        console.log(`Setting price to: $${priceMovements[i] / 100000000}`);
        
        // Fast forward time to simulate real trading
        await time.increase(60); // 1 minute intervals
      }

      // Final price for predictions
      const finalPrice = priceMovements[priceMovements.length - 1];
      await mockAggregator.setPrice(finalPrice);

      // Players make predictions based on trend
      await deFiPredictor.connect(player1).joinCryptoPrediction(
        gameId, 210000000000, { value: ethers.parseEther("0.1") }
      );

      await deFiPredictor.connect(player2).joinCryptoPrediction(
        gameId, 250000000000, { value: ethers.parseEther("0.1") }
      );

      console.log(`Final price: $${finalPrice / 100000000}`);
      console.log(`Player 1 predicted: $2100 (${finalPrice > 210000000000 ? 'CORRECT' : 'WRONG'})`);
      console.log(`Player 2 predicted: $2500 (${finalPrice > 250000000000 ? 'CORRECT' : 'WRONG'})`);
    });
  });

  describe("Stress Tests", function () {
    it("Should handle edge case with exact price predictions", async function () {
      const { deFiPredictor, mockAggregator, owner, player1 } = await loadFixture(deployFullSystemFixture);
      
      const gameId = "edge_case_game";
      const deadline = await time.latest() + 3600;
      const exactPrice = 200000000000; // $2000

      await deFiPredictor.createGame(
        gameId, 1, ethers.ZeroHash, ethers.parseEther("0.1"), 15000, 500, deadline, 0, 0, 0
      );
      await deFiPredictor.fundGame(gameId, { value: ethers.parseEther("1") });

      // Set exact price
      await mockAggregator.setPrice(exactPrice);

      // Player predicts exactly the current price
      await expect(deFiPredictor.connect(player1).joinCryptoPrediction(
        gameId, exactPrice, { value: ethers.parseEther("0.1") }
      )).to.emit(deFiPredictor, "ClaimedReward").withArgs(player1.address, gameId, 0);
      
      // For GreaterThan type, current price (200) is NOT > prediction (200), so player loses
      console.log("✓ Edge case handled: Exact price prediction correctly evaluated");
    });

    it("Should handle game with insufficient rewards", async function () {
      const { deFiPredictor, mockAggregator, owner, player1 } = await loadFixture(deployFullSystemFixture);
      
      const gameId = "insufficient_rewards_game";
      const deadline = await time.latest() + 3600;

      await deFiPredictor.createGame(
        gameId, 1, ethers.ZeroHash, ethers.parseEther("0.1"), 50000, 500, deadline, 0, 0, 0 // 500% reward
      );
      
      // Fund with very small amount
      await deFiPredictor.fundGame(gameId, { value: ethers.parseEther("0.01") });

      await mockAggregator.setPrice(250000000000); // Higher price

      // This should fail due to insufficient pool
      await expect(deFiPredictor.connect(player1).joinCryptoPrediction(
        gameId, 200000000000, { value: ethers.parseEther("0.1") }
      )).to.be.revertedWith("Insufficient pool");

      console.log("✓ Correctly prevented participation when pool insufficient for rewards");
    });
  });

  describe("Comprehensive Question Coverage", function () {
    it("Should test questions from all available topics", async function () {
      const { deFiPredictor, owner, player1, player2, player3 } = await loadFixture(deployFullSystemFixture);
      
      // Get unique topics
      const topics = [...new Set(quizQuestions.map(q => q.topic))];
      console.log(`Available topics: ${topics.join(", ")}`);

      for (const topic of topics) {
        const topicQuestions = quizQuestions.filter(q => q.topic === topic).slice(0, 2);
        if (topicQuestions.length === 0) continue;

        const tree = createQuizMerkleTree(topicQuestions);
        const gameId = `${topic.toLowerCase().replace(/\s+/g, '_')}_game`;
        const deadline = await time.latest() + 3600;

        await deFiPredictor.createGame(
          gameId, 0, tree.getHexRoot(), ethers.parseEther("0.05"), 12000, 300, deadline, 0, 0, 0
        );
        await deFiPredictor.fundGame(gameId, { value: ethers.parseEther("0.5") });

        // Test first question from this topic
        const question = topicQuestions[0];
        const questionId = question.question.substring(0, 20);
        const correctAnswer = question.options.indexOf(question.answer);
        const proof = getQuizMerkleProof(tree, questionId, correctAnswer);

        await expect(deFiPredictor.connect(player1).joinQuiz(
          gameId, proof, questionId, correctAnswer, { value: ethers.parseEther("0.05") }
        )).to.emit(deFiPredictor, "ClaimedReward");

        console.log(`✓ ${topic}: ${question.question.substring(0, 50)}... → ${question.answer}`);
        
        // Reset for next topic (in real scenario, different players would be used)
        await time.increase(100);
      }
    });
  });
});
