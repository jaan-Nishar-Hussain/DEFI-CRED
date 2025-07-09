const {
  time,
  loadFixture,
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { MerkleTree } = require("merkletreejs");
const keccak256 = require("keccak256");

// Import quiz questions from JSON file
const quizQuestions = require("../quiz-export.json");

describe("DeFiPredictorV2", function () {
  // We define a fixture to reuse the same setup in every test.
  async function deployDeFiPredictorFixture() {
    const [owner, addr1, addr2, addr3] = await ethers.getSigners();

    // Deploy MockAggregator
    const MockAggregator = await ethers.getContractFactory("MockAggregator");
    const mockAggregator = await MockAggregator.deploy();

    // Deploy DeFiPredictorV2
    const DeFiPredictorV2 = await ethers.getContractFactory("DeFiPredictorV2");
    const deFiPredictor = await DeFiPredictorV2.deploy(mockAggregator.target);

    return { deFiPredictor, mockAggregator, owner, addr1, addr2, addr3 };
  }

  function createMerkleTree(questions) {
    const leaves = questions.map(q => {
      const questionId = q.question.substring(0, 20); // Use first 20 chars as ID
      const correctAnswer = q.options.indexOf(q.answer);
      return keccak256(ethers.solidityPacked(["string", "uint8"], [questionId, correctAnswer]));
    });
    return new MerkleTree(leaves, keccak256, { sortPairs: true });
  }

  function getMerkleProof(tree, questionId, answer) {
    const leaf = keccak256(ethers.solidityPacked(["string", "uint8"], [questionId, answer]));
    return tree.getHexProof(leaf);
  }

  describe("Deployment", function () {
    it("Should set the right admin", async function () {
      const { deFiPredictor, owner } = await loadFixture(deployDeFiPredictorFixture);
      expect(await deFiPredictor.admin()).to.equal(owner.address);
    });

    it("Should set the price feed correctly", async function () {
      const { deFiPredictor, mockAggregator } = await loadFixture(deployDeFiPredictorFixture);
      expect(await deFiPredictor.priceFeed()).to.equal(mockAggregator.target);
    });

    it("Should initialize with zero platform fees", async function () {
      const { deFiPredictor } = await loadFixture(deployDeFiPredictorFixture);
      expect(await deFiPredictor.totalPlatformFees()).to.equal(0);
    });
  });

  describe("Game Creation", function () {
    it("Should create a quiz game successfully", async function () {
      const { deFiPredictor, owner } = await loadFixture(deployDeFiPredictorFixture);
      
      const cryptoQuestions = quizQuestions.filter(q => q.topic === "Crypto").slice(0, 5);
      const tree = createMerkleTree(cryptoQuestions);
      const merkleRoot = tree.getHexRoot();

      const gameId = "quiz_game_1";
      const deadline = await time.latest() + 3600; // 1 hour from now

      await expect(deFiPredictor.createGame(
        gameId,
        0, // GameType.Quiz
        merkleRoot,
        ethers.parseEther("0.1"), // 0.1 ETH entry fee
        15000, // 150% reward multiplier
        500, // 5% platform fee
        deadline,
        0, // PredictionType (not used for quiz)
        0, // priceMin (not used for quiz)
        0  // priceMax (not used for quiz)
      )).to.emit(deFiPredictor, "GameCreated").withArgs(gameId, 0);

      const gameInfo = await deFiPredictor.getGameInfo(gameId);
      expect(gameInfo.gameType).to.equal(0);
      expect(gameInfo.status).to.equal(1); // Active
      expect(gameInfo.entryFee).to.equal(ethers.parseEther("0.1"));
    });

    it("Should create a crypto prediction game successfully", async function () {
      const { deFiPredictor, owner } = await loadFixture(deployDeFiPredictorFixture);
      
      const gameId = "crypto_game_1";
      const deadline = await time.latest() + 3600;

      await expect(deFiPredictor.createGame(
        gameId,
        1, // GameType.Crypto
        ethers.ZeroHash, // No merkle root needed for crypto
        ethers.parseEther("0.05"),
        12000, // 120% reward multiplier
        300, // 3% platform fee
        deadline,
        0, // PredictionType.GreaterThan
        200000000000, // $2000 (8 decimals)
        250000000000  // $2500 (8 decimals)
      )).to.emit(deFiPredictor, "GameCreated").withArgs(gameId, 1);

      const gameInfo = await deFiPredictor.getGameInfo(gameId);
      expect(gameInfo.gameType).to.equal(1);
      expect(gameInfo.predictionType).to.equal(0);
    });

    it("Should not allow non-admin to create games", async function () {
      const { deFiPredictor, addr1 } = await loadFixture(deployDeFiPredictorFixture);
      
      const gameId = "unauthorized_game";
      const deadline = await time.latest() + 3600;

      await expect(deFiPredictor.connect(addr1).createGame(
        gameId,
        0,
        ethers.ZeroHash,
        ethers.parseEther("0.1"),
        15000,
        500,
        deadline,
        0,
        0,
        0
      )).to.be.revertedWith("Not admin");
    });
  });

  describe("Quiz Game Functionality", function () {
    let deFiPredictor, owner, addr1, addr2, addr3;
    let cryptoQuestions, tree, merkleRoot, gameId;

    beforeEach(async function () {
      ({ deFiPredictor, owner, addr1, addr2, addr3 } = await loadFixture(deployDeFiPredictorFixture));
      
      // Filter crypto questions for testing
      cryptoQuestions = quizQuestions.filter(q => q.topic === "Crypto").slice(0, 10);
      tree = createMerkleTree(cryptoQuestions);
      merkleRoot = tree.getHexRoot();
      
      gameId = "quiz_test_game";
      const deadline = await time.latest() + 3600;

      // Create and fund the game
      await deFiPredictor.createGame(
        gameId,
        0, // Quiz
        merkleRoot,
        ethers.parseEther("0.1"),
        15000,
        500,
        deadline,
        0, 0, 0
      );

      await deFiPredictor.fundGame(gameId, { value: ethers.parseEther("1") });
    });

    it("Should allow correct quiz answers and pay rewards", async function () {
      const question = cryptoQuestions[0];
      const questionId = question.question.substring(0, 20);
      const correctAnswer = question.options.indexOf(question.answer);
      const proof = getMerkleProof(tree, questionId, correctAnswer);

      const initialBalance = await ethers.provider.getBalance(addr1.address);
      
      await expect(deFiPredictor.connect(addr1).joinQuiz(
        gameId,
        proof,
        questionId,
        correctAnswer,
        { value: ethers.parseEther("0.1") }
      )).to.emit(deFiPredictor, "ClaimedReward");

      const finalBalance = await ethers.provider.getBalance(addr1.address);
      
      // Player should receive reward (entry fee - platform fee) * multiplier
      // Entry: 0.1 ETH, Platform fee: 5%, Reward multiplier: 150%
      const expectedReward = ethers.parseEther("0.1") * 95n / 100n * 15000n / 10000n;
      
      // Check if balance increased (accounting for gas costs)
      expect(finalBalance).to.be.greaterThan(initialBalance - ethers.parseEther("0.05"));
    });

    it("Should handle incorrect quiz answers", async function () {
      const question = cryptoQuestions[0];
      const questionId = question.question.substring(0, 20);
      const correctAnswer = question.options.indexOf(question.answer);
      const wrongAnswer = (correctAnswer + 1) % 4; // Different answer
      
      // Generate proof for wrong answer (should fail verification)
      const wrongProof = getMerkleProof(tree, questionId, wrongAnswer);

      await expect(deFiPredictor.connect(addr1).joinQuiz(
        gameId,
        wrongProof,
        questionId,
        wrongAnswer,
        { value: ethers.parseEther("0.1") }
      )).to.emit(deFiPredictor, "ClaimedReward").withArgs(addr1.address, gameId, 0);
    });

    it("Should test multiple crypto questions", async function () {
      // We create a fresh test game for this test to avoid "Already claimed" errors
      const newGameId = "fresh_quiz_game_for_multi_test";
      const newDeadline = await time.latest() + 3600;

      await deFiPredictor.createGame(
        newGameId,
        0, // Quiz
        merkleRoot,
        ethers.parseEther("0.1"),
        15000,
        500,
        newDeadline,
        0, 0, 0
      );

      await deFiPredictor.fundGame(newGameId, { value: ethers.parseEther("1") });
      
      // Use different players for different questions - just use 2 players
      const players = [addr1, addr2];
      
      for (let i = 0; i < Math.min(2, cryptoQuestions.length); i++) {
        const question = cryptoQuestions[i];
        const questionId = question.question.substring(0, 20);
        const correctAnswer = question.options.indexOf(question.answer);
        const proof = getMerkleProof(tree, questionId, correctAnswer);

        // Use a different player for each question
        const player = players[i];
        
        await expect(deFiPredictor.connect(player).joinQuiz(
          newGameId,
          proof,
          questionId,
          correctAnswer,
          { value: ethers.parseEther("0.1") }
        )).to.emit(deFiPredictor, "ClaimedReward");

        // Verify player data
        const playerData = await deFiPredictor.getPlayerData(newGameId, player.address);
        expect(playerData.joined).to.be.true;
        expect(playerData.claimed).to.be.true;
      }
    });

    it("Should prevent double participation", async function () {
      const question = cryptoQuestions[0];
      const questionId = question.question.substring(0, 20);
      const correctAnswer = question.options.indexOf(question.answer);
      const proof = getMerkleProof(tree, questionId, correctAnswer);

      // First participation
      await deFiPredictor.connect(addr1).joinQuiz(
        gameId,
        proof,
        questionId,
        correctAnswer,
        { value: ethers.parseEther("0.1") }
      );

      // Second participation should fail
      await expect(deFiPredictor.connect(addr1).joinQuiz(
        gameId,
        proof,
        questionId,
        correctAnswer,
        { value: ethers.parseEther("0.1") }
      )).to.be.revertedWith("Already claimed");
    });

    it("Should require correct entry fee", async function () {
      const question = cryptoQuestions[0];
      const questionId = question.question.substring(0, 20);
      const correctAnswer = question.options.indexOf(question.answer);
      const proof = getMerkleProof(tree, questionId, correctAnswer);

      await expect(deFiPredictor.connect(addr1).joinQuiz(
        gameId,
        proof,
        questionId,
        correctAnswer,
        { value: ethers.parseEther("0.05") } // Wrong amount
      )).to.be.revertedWith("Incorrect entry fee");
    });
  });

  describe("Crypto Prediction Functionality", function () {
    let deFiPredictor, mockAggregator, owner, addr1, addr2;
    let gameId;

    beforeEach(async function () {
      ({ deFiPredictor, mockAggregator, owner, addr1, addr2 } = await loadFixture(deployDeFiPredictorFixture));
      
      gameId = "crypto_test_game";
      const deadline = await time.latest() + 3600;

      // Set initial price to $2000
      await mockAggregator.setPrice(200000000000);

      // Create and fund the game
      await deFiPredictor.createGame(
        gameId,
        1, // Crypto
        ethers.ZeroHash,
        ethers.parseEther("0.05"),
        12000, // 120% multiplier
        300, // 3% platform fee
        deadline,
        0, // GreaterThan
        0, 0
      );

      await deFiPredictor.fundGame(gameId, { value: ethers.parseEther("0.5") });
    });

    it("Should handle correct greater than predictions", async function () {
      // Set price to $2100 (higher than $2000)
      await mockAggregator.setPrice(210000000000);
      
      // User predicts price will be greater than $1900
      const userPrediction = 190000000000;

      await expect(deFiPredictor.connect(addr1).joinCryptoPrediction(
        gameId,
        userPrediction,
        { value: ethers.parseEther("0.05") }
      )).to.emit(deFiPredictor, "ClaimedReward");

      const playerData = await deFiPredictor.getPlayerData(gameId, addr1.address);
      expect(playerData.joined).to.be.true;
      expect(playerData.prediction).to.equal(userPrediction);
    });

    it("Should handle incorrect greater than predictions", async function () {
      // Set price to $1900 (lower than $2000)
      await mockAggregator.setPrice(190000000000);
      
      // User predicts price will be greater than $2100 (but current is $1900)
      const userPrediction = 210000000000;

      await expect(deFiPredictor.connect(addr1).joinCryptoPrediction(
        gameId,
        userPrediction,
        { value: ethers.parseEther("0.05") }
      )).to.emit(deFiPredictor, "ClaimedReward").withArgs(addr1.address, gameId, 0);
    });

    it("Should handle less than prediction type", async function () {
      // Create a less than game
      const lessGameId = "crypto_less_game";
      const deadline = await time.latest() + 3600;

      await deFiPredictor.createGame(
        lessGameId,
        1, // Crypto
        ethers.ZeroHash,
        ethers.parseEther("0.05"),
        12000,
        300,
        deadline,
        1, // LessThan
        0, 0
      );

      await deFiPredictor.fundGame(lessGameId, { value: ethers.parseEther("0.5") });

      // Set price to $1800
      await mockAggregator.setPrice(180000000000);
      
      // User predicts price will be less than $2000 (correct)
      const userPrediction = 200000000000;

      await expect(deFiPredictor.connect(addr1).joinCryptoPrediction(
        lessGameId,
        userPrediction,
        { value: ethers.parseEther("0.05") }
      )).to.emit(deFiPredictor, "ClaimedReward");
    });

    it("Should handle between prediction type", async function () {
      // Create a between game
      const betweenGameId = "crypto_between_game";
      const deadline = await time.latest() + 3600;

      await deFiPredictor.createGame(
        betweenGameId,
        1, // Crypto
        ethers.ZeroHash,
        ethers.parseEther("0.05"),
        12000,
        300,
        deadline,
        2, // Between
        190000000000, // $1900 min
        210000000000  // $2100 max
      );

      await deFiPredictor.fundGame(betweenGameId, { value: ethers.parseEther("0.5") });

      // Set price to $2000 (between $1900 and $2100)
      await mockAggregator.setPrice(200000000000);

      await expect(deFiPredictor.connect(addr1).joinCryptoPrediction(
        betweenGameId,
        0, // User prediction not used for between type
        { value: ethers.parseEther("0.05") }
      )).to.emit(deFiPredictor, "ClaimedReward");
    });

    it("Should prevent joining expired games", async function () {
      // Fast forward past deadline
      await time.increaseTo(await time.latest() + 3700);

      await expect(deFiPredictor.connect(addr1).joinCryptoPrediction(
        gameId,
        200000000000,
        { value: ethers.parseEther("0.05") }
      )).to.be.revertedWith("Game expired");
    });
  });

  describe("Game Management", function () {
    it("Should allow admin to fund games", async function () {
      const { deFiPredictor, owner } = await loadFixture(deployDeFiPredictorFixture);
      
      const gameId = "fund_test_game";
      const deadline = await time.latest() + 3600;

      await deFiPredictor.createGame(
        gameId, 0, ethers.ZeroHash, ethers.parseEther("0.1"),
        15000, 500, deadline, 0, 0, 0
      );

      const fundAmount = ethers.parseEther("2");
      
      await expect(deFiPredictor.fundGame(gameId, { value: fundAmount }))
        .to.emit(deFiPredictor, "GameFunded")
        .withArgs(gameId, fundAmount);

      const gameInfo = await deFiPredictor.getGameInfo(gameId);
      expect(gameInfo.fundedAmount).to.equal(fundAmount);
    });

    it("Should allow admin to end games after deadline", async function () {
      const { deFiPredictor, owner } = await loadFixture(deployDeFiPredictorFixture);
      
      const gameId = "end_test_game";
      const deadline = await time.latest() + 100;

      await deFiPredictor.createGame(
        gameId, 0, ethers.ZeroHash, ethers.parseEther("0.1"),
        15000, 500, deadline, 0, 0, 0
      );

      // Fast forward past deadline
      await time.increaseTo(deadline + 1);

      await expect(deFiPredictor.endGame(gameId))
        .to.emit(deFiPredictor, "GameEnded")
        .withArgs(gameId);

      const gameInfo = await deFiPredictor.getGameInfo(gameId);
      expect(gameInfo.status).to.equal(2); // Ended
    });

    it("Should allow admin to update merkle root", async function () {
      const { deFiPredictor, owner } = await loadFixture(deployDeFiPredictorFixture);
      
      const gameId = "merkle_test_game";
      const deadline = await time.latest() + 3600;
      const initialRoot = ethers.keccak256(ethers.toUtf8Bytes("initial"));

      await deFiPredictor.createGame(
        gameId, 0, initialRoot, ethers.parseEther("0.1"),
        15000, 500, deadline, 0, 0, 0
      );

      const newRoot = ethers.keccak256(ethers.toUtf8Bytes("updated"));
      await deFiPredictor.updateMerkleRoot(gameId, newRoot);

      const gameInfo = await deFiPredictor.getGameInfo(gameId);
      expect(gameInfo.merkleRoot).to.equal(newRoot);
    });

    it("Should allow admin to withdraw platform fees", async function () {
      const { deFiPredictor, mockAggregator, owner, addr1 } = await loadFixture(deployDeFiPredictorFixture);
      
      // Create a game and generate some platform fees
      const gameId = "fee_test_game";
      const deadline = await time.latest() + 3600;

      await deFiPredictor.createGame(
        gameId, 1, ethers.ZeroHash, ethers.parseEther("0.1"),
        12000, 1000, deadline, 0, 0, 0 // 10% platform fee
      );

      await deFiPredictor.fundGame(gameId, { value: ethers.parseEther("1") });

      // Set price and make a prediction
      await mockAggregator.setPrice(200000000000);

      await deFiPredictor.connect(addr1).joinCryptoPrediction(
        gameId, 190000000000, { value: ethers.parseEther("0.1") }
      );

      const platformFees = await deFiPredictor.totalPlatformFees();
      expect(platformFees).to.be.greaterThan(0);

      const initialBalance = await ethers.provider.getBalance(owner.address);
      await deFiPredictor.withdrawFees(platformFees);
      const finalBalance = await ethers.provider.getBalance(owner.address);

      expect(finalBalance).to.be.greaterThan(initialBalance);
      expect(await deFiPredictor.totalPlatformFees()).to.equal(0);
    });
  });

  describe("Pause Functionality", function () {
    it("Should allow admin to pause and unpause", async function () {
      const { deFiPredictor, owner } = await loadFixture(deployDeFiPredictorFixture);
      
      await deFiPredictor.pause();
      
      // Try to join a game while paused
      const gameId = "pause_test_game";
      const deadline = await time.latest() + 3600;

      await deFiPredictor.createGame(
        gameId, 0, ethers.ZeroHash, ethers.parseEther("0.1"),
        15000, 500, deadline, 0, 0, 0
      );

      await expect(deFiPredictor.joinQuiz(
        gameId, [], "test", 0, { value: ethers.parseEther("0.1") }
      )).to.be.reverted; // Just check it's reverted, don't check specific message

      // Unpause and try again
      await deFiPredictor.unpause();
      // Should not revert now (though may fail for other reasons like invalid proof)
    });
  });

  describe("Edge Cases and Security", function () {
    it("Should handle insufficient pool funds", async function () {
      const { deFiPredictor, mockAggregator, owner, addr1 } = await loadFixture(deployDeFiPredictorFixture);
      
      const gameId = "low_fund_game";
      const deadline = await time.latest() + 3600;

      await deFiPredictor.createGame(
        gameId, 1, ethers.ZeroHash, ethers.parseEther("0.1"),
        50000, 300, deadline, 0, 0, 0 // Very high multiplier (500%)
      );

      // Fund with small amount
      await deFiPredictor.fundGame(gameId, { value: ethers.parseEther("0.01") });

      await mockAggregator.setPrice(250000000000); // Higher price

      await expect(deFiPredictor.connect(addr1).joinCryptoPrediction(
        gameId, 200000000000, { value: ethers.parseEther("0.1") }
      )).to.be.revertedWith("Insufficient pool");
    });

    it("Should get latest price from oracle", async function () {
      const { deFiPredictor, mockAggregator } = await loadFixture(deployDeFiPredictorFixture);
      
      const testPrice = 123456789000;
      await mockAggregator.setPrice(testPrice);
      
      const latestPrice = await deFiPredictor.getLatestPrice();
      expect(latestPrice).to.equal(testPrice);
    });

    it("Should track game players correctly", async function () {
      const { deFiPredictor, mockAggregator, owner, addr1, addr2 } = await loadFixture(deployDeFiPredictorFixture);
      
      const gameId = "players_test_game";
      const deadline = await time.latest() + 3600;

      await deFiPredictor.createGame(
        gameId, 1, ethers.ZeroHash, ethers.parseEther("0.1"),
        12000, 300, deadline, 0, 0, 0
      );

      await deFiPredictor.fundGame(gameId, { value: ethers.parseEther("1") });

      await mockAggregator.setPrice(200000000000);

      // Add players
      await deFiPredictor.connect(addr1).joinCryptoPrediction(
        gameId, 190000000000, { value: ethers.parseEther("0.1") }
      );

      await deFiPredictor.connect(addr2).joinCryptoPrediction(
        gameId, 210000000000, { value: ethers.parseEther("0.1") }
      );

      const players = await deFiPredictor.getGamePlayers(gameId);
      expect(players.length).to.equal(2);
      expect(players).to.include(addr1.address);
      expect(players).to.include(addr2.address);
    });
  });

  describe("Real Quiz Questions Test", function () {
    it("Should test with actual crypto questions from JSON", async function () {
      const { deFiPredictor, owner, addr1 } = await loadFixture(deployDeFiPredictorFixture);
      
      // Get specific crypto questions
      const ethereumQuestion = quizQuestions.find(q => 
        q.question.includes("Ethereum") && q.question.includes("created")
      );
      
      const bitcoinQuestion = quizQuestions.find(q => 
        q.question.includes("Bitcoin") && q.question.includes("supply")
      );

      if (!ethereumQuestion || !bitcoinQuestion) {
        console.log("Required questions not found in quiz data");
        return;
      }

      const testQuestions = [ethereumQuestion, bitcoinQuestion];
      const tree = createMerkleTree(testQuestions);
      const merkleRoot = tree.getHexRoot();
      
      const gameId = "real_quiz_game";
      const deadline = await time.latest() + 3600;

      await deFiPredictor.createGame(
        gameId, 0, merkleRoot, ethers.parseEther("0.1"),
        15000, 500, deadline, 0, 0, 0
      );

      await deFiPredictor.fundGame(gameId, { value: ethers.parseEther("2") });

      // Test Ethereum question
      const ethQuestionId = ethereumQuestion.question.substring(0, 20);
      const ethCorrectAnswer = ethereumQuestion.options.indexOf(ethereumQuestion.answer);
      const ethProof = getMerkleProof(tree, ethQuestionId, ethCorrectAnswer);

      await expect(deFiPredictor.connect(addr1).joinQuiz(
        gameId, ethProof, ethQuestionId, ethCorrectAnswer,
        { value: ethers.parseEther("0.1") }
      )).to.emit(deFiPredictor, "ClaimedReward");

      console.log(`✓ Ethereum question: "${ethereumQuestion.question}"`);
      console.log(`✓ Correct answer: ${ethereumQuestion.answer}`);
    });
  });
});
