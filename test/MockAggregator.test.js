const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("MockAggregator", function () {
  let mockAggregator;
  let owner, addr1;

  beforeEach(async function () {
    [owner, addr1] = await ethers.getSigners();
    
    const MockAggregator = await ethers.getContractFactory("MockAggregator");
    mockAggregator = await MockAggregator.deploy();
  });

  describe("Deployment", function () {
    it("Should set the default price to $2000", async function () {
      const [, price] = await mockAggregator.latestRoundData();
      expect(price).to.equal(200000000000); // $2000 with 8 decimals
    });

    it("Should set correct decimals", async function () {
      expect(await mockAggregator.decimals()).to.equal(8);
    });

    it("Should set correct description", async function () {
      expect(await mockAggregator.description()).to.equal("Mock ETH/USD Price Feed");
    });

    it("Should set correct version", async function () {
      expect(await mockAggregator.version()).to.equal(1);
    });
  });

  describe("Price Updates", function () {
    it("Should update price correctly", async function () {
      const newPrice = 250000000000; // $2500
      await mockAggregator.updateAnswer(newPrice);
      
      const [, price] = await mockAggregator.latestRoundData();
      expect(price).to.equal(newPrice);
    });

    it("Should set price correctly with setPrice", async function () {
      const newPrice = 180000000000; // $1800
      await mockAggregator.setPrice(newPrice);
      
      const [, price] = await mockAggregator.latestRoundData();
      expect(price).to.equal(newPrice);
    });

    it("Should handle multiple price updates", async function () {
      const prices = [150000000000, 300000000000, 175000000000]; // $1500, $3000, $1750
      
      for (const testPrice of prices) {
        await mockAggregator.setPrice(testPrice);
        const [, price] = await mockAggregator.latestRoundData();
        expect(price).to.equal(testPrice);
      }
    });
  });

  describe("Round Data", function () {
    it("Should return consistent round data", async function () {
      const roundId = 5;
      const testPrice = 220000000000; // $2200
      
      await mockAggregator.setPrice(testPrice);
      
      const [retRoundId, answer, startedAt, updatedAt, answeredInRound] = await mockAggregator.getRoundData(roundId);
      
      expect(retRoundId).to.equal(roundId);
      expect(answer).to.equal(testPrice);
      expect(Number(startedAt)).to.be.greaterThan(0);
      expect(Number(updatedAt)).to.be.greaterThan(0);
      expect(answeredInRound).to.equal(roundId);
    });

    it("Should return latest round data correctly", async function () {
      const testPrice = 190000000000; // $1900
      await mockAggregator.setPrice(testPrice);
      
      const [roundId, answer, startedAt, updatedAt, answeredInRound] = await mockAggregator.latestRoundData();
      
      expect(roundId).to.equal(1);
      expect(answer).to.equal(testPrice);
      expect(answeredInRound).to.equal(1);
    });
  });

  describe("Price Simulation Tests", function () {
    it("Should simulate realistic crypto price movements", async function () {
      // Simulate ETH price movements
      const ethPrices = [
        200000000000, // $2000 - starting price
        210000000000, // $2100 - 5% increase
        189000000000, // $1890 - 10% decrease from 2100
        225000000000, // $2250 - 19% increase
        202500000000, // $2025 - 10% decrease
      ];

      for (let i = 0; i < ethPrices.length; i++) {
        await mockAggregator.setPrice(ethPrices[i]);
        
        const [, price] = await mockAggregator.latestRoundData();
        expect(price).to.equal(ethPrices[i]);
        
        console.log(`Block ${i + 1}: ETH Price = $${ethPrices[i] / 100000000}`);
      }
    });

    it("Should handle extreme price scenarios", async function () {
      // Test very high price
      const highPrice = 1000000000000; // $10,000
      await mockAggregator.setPrice(highPrice);
      let [, price] = await mockAggregator.latestRoundData();
      expect(price).to.equal(highPrice);

      // Test very low price
      const lowPrice = 10000000000; // $100
      await mockAggregator.setPrice(lowPrice);
      [, price] = await mockAggregator.latestRoundData();
      expect(price).to.equal(lowPrice);

      // Test zero price
      await mockAggregator.setPrice(0);
      [, price] = await mockAggregator.latestRoundData();
      expect(price).to.equal(0);
    });

    it("Should simulate flash crash scenario", async function () {
      // Start at normal price
      await mockAggregator.setPrice(200000000000); // $2000
      
      // Flash crash to 50% of original
      await mockAggregator.setPrice(100000000000); // $1000
      let [, price] = await mockAggregator.latestRoundData();
      expect(price).to.equal(100000000000);
      
      // Quick recovery to 90% of original
      await mockAggregator.setPrice(180000000000); // $1800
      [, price] = await mockAggregator.latestRoundData();
      expect(price).to.equal(180000000000);
    });
  });
});
