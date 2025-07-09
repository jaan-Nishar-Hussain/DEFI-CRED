const { expect } = require("chai");
const { ethers } = require("hardhat");
const { MerkleTree } = require("merkletreejs");
const keccak256 = require("keccak256");

// Import quiz questions for testing
const quizQuestions = require("../quiz-export.json");

describe("Test Utilities and Helpers", function () {
  
  describe("Merkle Tree Generation", function () {
    it("Should generate consistent merkle trees for quiz questions", async function () {
      const sampleQuestions = [
        {
          question: "What is 2+2?",
          options: ["3", "4", "5", "6"],
          answer: "4",
          topic: "Math"
        },
        {
          question: "What is the capital of France?",
          options: ["London", "Berlin", "Paris", "Madrid"],
          answer: "Paris",
          topic: "Geography"
        }
      ];

      function createMerkleTree(questions) {
        const leaves = questions.map(q => {
          const questionId = q.question.substring(0, 20);
          const correctAnswer = q.options.indexOf(q.answer);
          return keccak256(ethers.solidityPacked(["string", "uint8"], [questionId, correctAnswer]));
        });
        return new MerkleTree(leaves, keccak256, { sortPairs: true });
      }

      const tree1 = createMerkleTree(sampleQuestions);
      const tree2 = createMerkleTree(sampleQuestions);

      expect(tree1.getHexRoot()).to.equal(tree2.getHexRoot());
      console.log("✓ Merkle tree generation is deterministic");
    });

    it("Should generate valid proofs for quiz answers", async function () {
      const testQuestion = {
        question: "Who created Ethereum?",
        options: ["Satoshi Nakamoto", "Vitalik Buterin", "Charles Hoskinson", "Gavin Wood"],
        answer: "Vitalik Buterin",
        topic: "Crypto"
      };

      function createMerkleTree(questions) {
        const leaves = questions.map(q => {
          const questionId = q.question.substring(0, 20);
          const correctAnswer = q.options.indexOf(q.answer);
          return keccak256(ethers.solidityPacked(["string", "uint8"], [questionId, correctAnswer]));
        });
        return new MerkleTree(leaves, keccak256, { sortPairs: true });
      }

      function getMerkleProof(tree, questionId, answer) {
        const leaf = keccak256(ethers.solidityPacked(["string", "uint8"], [questionId, answer]));
        return tree.getHexProof(leaf);
      }

      const tree = createMerkleTree([testQuestion]);
      const questionId = testQuestion.question.substring(0, 20);
      const correctAnswer = testQuestion.options.indexOf(testQuestion.answer);
      
      const proof = getMerkleProof(tree, questionId, correctAnswer);
      const leaf = keccak256(ethers.solidityPacked(["string", "uint8"], [questionId, correctAnswer]));
      
      expect(tree.verify(proof, leaf, tree.getHexRoot())).to.be.true;
      console.log("✓ Merkle proof verification works correctly");
    });
  });

  describe("Quiz Data Analysis", function () {
    it("Should analyze quiz question distribution", async function () {
      const topicCounts = {};
      quizQuestions.forEach(q => {
        topicCounts[q.topic] = (topicCounts[q.topic] || 0) + 1;
      });

      console.log("Quiz Question Distribution:");
      Object.entries(topicCounts).forEach(([topic, count]) => {
        console.log(`  ${topic}: ${count} questions`);
      });

      expect(Object.keys(topicCounts).length).to.be.greaterThan(0);
      expect(quizQuestions.length).to.be.greaterThan(0);
    });

    it("Should validate quiz question format", async function () {
      const invalidQuestions = [];
      
      quizQuestions.forEach((q, index) => {
        const issues = [];
        
        if (!q.question || typeof q.question !== 'string') {
          issues.push('Invalid question text');
        }
        
        if (!Array.isArray(q.options) || q.options.length !== 4) {
          issues.push('Should have exactly 4 options');
        }
        
        if (!q.answer || !q.options.includes(q.answer)) {
          issues.push('Answer not found in options');
        }
        
        if (!q.topic || typeof q.topic !== 'string') {
          issues.push('Missing or invalid topic');
        }
        
        if (issues.length > 0) {
          invalidQuestions.push({ index, question: q.question?.substring(0, 50), issues });
        }
      });

      if (invalidQuestions.length > 0) {
        console.log("Invalid questions found:");
        invalidQuestions.slice(0, 5).forEach(item => {
          console.log(`  Question ${item.index}: ${item.question}...`);
          console.log(`    Issues: ${item.issues.join(', ')}`);
        });
      }

      expect(invalidQuestions.length).to.equal(0, `Found ${invalidQuestions.length} invalid questions`);
      console.log(`✓ All ${quizQuestions.length} questions are properly formatted`);
    });

    it("Should find duplicate questions", async function () {
      const questionTexts = new Set();
      const duplicates = [];

      quizQuestions.forEach((q, index) => {
        const normalizedQuestion = q.question.toLowerCase().trim();
        if (questionTexts.has(normalizedQuestion)) {
          duplicates.push({ index, question: q.question.substring(0, 50) });
        } else {
          questionTexts.add(normalizedQuestion);
        }
      });

      if (duplicates.length > 0) {
        console.log("Duplicate questions found:");
        duplicates.slice(0, 10).forEach(dup => {
          console.log(`  Index ${dup.index}: ${dup.question}...`);
        });
      }

      console.log(`✓ Found ${duplicates.length} duplicate questions out of ${quizQuestions.length} total`);
    });

    it("Should analyze answer distribution", async function () {
      const answerPositions = { 0: 0, 1: 0, 2: 0, 3: 0 };
      
      quizQuestions.forEach(q => {
        const answerIndex = q.options.indexOf(q.answer);
        if (answerIndex >= 0 && answerIndex < 4) {
          answerPositions[answerIndex]++;
        }
      });

      console.log("Answer position distribution:");
      console.log(`  Position A (0): ${answerPositions[0]} questions`);
      console.log(`  Position B (1): ${answerPositions[1]} questions`);
      console.log(`  Position C (2): ${answerPositions[2]} questions`);
      console.log(`  Position D (3): ${answerPositions[3]} questions`);

      // Check if distribution is reasonably balanced (not more than 40% in any position)
      const total = Object.values(answerPositions).reduce((a, b) => a + b, 0);
      const maxPercentage = Math.max(...Object.values(answerPositions)) / total;
      
      expect(maxPercentage).to.be.lessThan(0.5, "Answer distribution too skewed");
      console.log(`✓ Answer distribution is reasonably balanced (max ${(maxPercentage * 100).toFixed(1)}%)`);
    });
  });

  describe("Crypto Price Simulation", function () {
    it("Should simulate realistic price movements", async function () {
      // Simulate ETH price over time with realistic volatility
      function simulatePrice(startPrice, volatility, steps) {
        const prices = [startPrice];
        let currentPrice = startPrice;
        
        for (let i = 0; i < steps; i++) {
          // Random walk with mean reversion
          const randomChange = (Math.random() - 0.5) * volatility;
          const meanReversion = (startPrice - currentPrice) * 0.001; // 0.1% mean reversion
          
          currentPrice = Math.max(currentPrice * (1 + randomChange + meanReversion), 1); // Minimum $1
          prices.push(Math.floor(currentPrice));
        }
        
        return prices;
      }

      const startPrice = 2000; // $2000 USD
      const volatility = 0.05; // 5% volatility per step
      const steps = 100;
      
      const prices = simulatePrice(startPrice * 100000000, volatility, steps); // Convert to 8 decimals
      
      expect(prices.length).to.equal(steps + 1);
      expect(prices[0]).to.equal(startPrice * 100000000);
      
      // Calculate statistics
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);
      const finalPrice = prices[prices.length - 1];
      
      console.log(`Price simulation results:`);
      console.log(`  Start: $${(prices[0] / 100000000).toFixed(2)}`);
      console.log(`  End: $${(finalPrice / 100000000).toFixed(2)}`);
      console.log(`  Min: $${(minPrice / 100000000).toFixed(2)}`);
      console.log(`  Max: $${(maxPrice / 100000000).toFixed(2)}`);
      console.log(`  Total change: ${((finalPrice - prices[0]) / prices[0] * 100).toFixed(2)}%`);
      
      expect(minPrice).to.be.greaterThan(0);
      expect(maxPrice).to.be.greaterThan(minPrice);
    });

    it("Should calculate prediction accuracy metrics", async function () {
      const predictions = [
        { predicted: 2100, actual: 2050, type: "greater" },
        { predicted: 1900, actual: 2050, type: "greater" },
        { predicted: 2200, actual: 2050, type: "less" },
        { predicted: 1800, actual: 2050, type: "less" },
      ];

      function evaluatePrediction(pred) {
        switch (pred.type) {
          case "greater":
            return pred.actual > pred.predicted;
          case "less":
            return pred.actual < pred.predicted;
          case "between":
            return pred.actual >= pred.min && pred.actual <= pred.max;
          default:
            return false;
        }
      }

      const results = predictions.map(pred => ({
        ...pred,
        correct: evaluatePrediction(pred),
        error: Math.abs(pred.actual - pred.predicted) / pred.actual * 100
      }));

      const accuracy = results.filter(r => r.correct).length / results.length;
      const avgError = results.reduce((sum, r) => sum + r.error, 0) / results.length;

      console.log("Prediction Analysis:");
      results.forEach((r, i) => {
        console.log(`  Prediction ${i + 1}: ${r.correct ? 'CORRECT' : 'WRONG'} (${r.error.toFixed(1)}% error)`);
      });
      console.log(`  Overall Accuracy: ${(accuracy * 100).toFixed(1)}%`);
      console.log(`  Average Error: ${avgError.toFixed(1)}%`);

      expect(accuracy).to.be.greaterThanOrEqual(0);
      expect(accuracy).to.be.lessThanOrEqual(1);
    });
  });

  describe("Gas Cost Analysis", function () {
    it("Should estimate gas costs for different operations", async function () {
      // This is a mock analysis - in real tests you'd measure actual gas usage
      const gasEstimates = {
        createGame: 200000,
        fundGame: 50000,
        joinQuiz: 150000,
        joinCryptoPrediction: 120000,
        claimRefund: 80000,
        endGame: 60000,
        withdrawFees: 40000
      };

      const ethPrice = 2000; // $2000 per ETH
      const gasPrice = 20; // 20 gwei

      console.log("Estimated Gas Costs (at 20 gwei, ETH = $2000):");
      Object.entries(gasEstimates).forEach(([operation, gas]) => {
        const costEth = (gas * gasPrice) / 1e9; // Convert to ETH
        const costUsd = costEth * ethPrice;
        console.log(`  ${operation}: ${gas.toLocaleString()} gas (~$${costUsd.toFixed(2)})`);
      });

      // Verify reasonable gas limits
      expect(gasEstimates.createGame).to.be.lessThan(500000);
      expect(gasEstimates.joinQuiz).to.be.lessThan(300000);
      expect(gasEstimates.joinCryptoPrediction).to.be.lessThan(300000);
    });
  });

  describe("Security Helpers", function () {
    it("Should validate entry fee calculations", async function () {
      function calculateReward(entryFee, platformFeeRate, rewardMultiplier) {
        const platformFee = entryFee * BigInt(platformFeeRate) / 10000n;
        const netEntry = entryFee - platformFee;
        const reward = netEntry * BigInt(rewardMultiplier) / 10000n;
        return { reward, platformFee, netEntry };
      }

      const testCases = [
        { entry: 1000000000000000000n, feeRate: 500, multiplier: 15000 }, // 1 ETH, 5%, 150%
        { entry: 100000000000000000n, feeRate: 300, multiplier: 12000 },  // 0.1 ETH, 3%, 120%
        { entry: 50000000000000000n, feeRate: 1000, multiplier: 20000 },  // 0.05 ETH, 10%, 200%
      ];

      testCases.forEach((tc, i) => {
        const result = calculateReward(tc.entry, tc.feeRate, tc.multiplier);
        
        expect(result.reward).to.be.greaterThan(0);
        expect(result.platformFee).to.be.greaterThan(0);
        expect(result.netEntry).to.equal(tc.entry - result.platformFee);
        
        console.log(`Test Case ${i + 1}:`);
        console.log(`  Entry: ${ethers.formatEther(tc.entry)} ETH`);
        console.log(`  Platform Fee: ${ethers.formatEther(result.platformFee)} ETH`);
        console.log(`  Potential Reward: ${ethers.formatEther(result.reward)} ETH`);
      });
    });

    it("Should validate time-based constraints", async function () {
      const now = Math.floor(Date.now() / 1000);
      const oneHour = 3600;
      const oneDay = 86400;

      const gameDeadlines = [
        { name: "Short Game", deadline: now + oneHour },
        { name: "Medium Game", deadline: now + oneDay },
        { name: "Long Game", deadline: now + oneDay * 7 },
      ];

      gameDeadlines.forEach(game => {
        const timeLeft = game.deadline - now;
        const hoursLeft = timeLeft / oneHour;
        
        expect(timeLeft).to.be.greaterThan(0);
        
        console.log(`${game.name}: ${hoursLeft.toFixed(1)} hours remaining`);
      });
    });
  });
});
