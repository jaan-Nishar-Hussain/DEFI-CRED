// generateMerkleTree.js
const { MerkleTree } = require('merkletreejs');
const keccak256 = require('keccak256');
const fs = require('fs');
const path = require('path');

// Load quiz data
const quizData = require('../quiz-export.json');

/**
 * Generate a Merkle Tree for quiz answers
 * 
 * @param {Array} quizData - Array of quiz questions with answers
 * @returns {Object} - Contains merkleTree, merkleRoot and a function to generate proofs
 */
function generateQuizMerkleTree(quizData) {
  // Create leaf nodes by hashing questionId + answer
  // This matches how the contract will verify: keccak256(abi.encodePacked(questionId, answer))
  const leaves = quizData.map(item => {
    // Extract question ID from the question string
    const questionId = item.question.match(/\(([^)]+)\)/)[1]; // Extract text in parentheses
    
    // Find the index of the correct answer in the options array
    const correctAnswerIndex = item.options.indexOf(item.answer);
    
    // Hash the combination of questionId and answer index (this is what the contract will check)
    // We use the index (0-3) rather than the text answer for on-chain efficiency
    return keccak256(questionId + correctAnswerIndex);
  });

  // Create the Merkle Tree
  const merkleTree = new MerkleTree(leaves, keccak256, { sortPairs: true });
  
  // Get the Merkle Root
  const merkleRoot = merkleTree.getHexRoot();
  
  return {
    merkleTree,
    merkleRoot,
    // Function to generate a proof for a specific question and answer
    getProof: function(questionId, answerIndex) {
      const leaf = keccak256(questionId + answerIndex);
      return merkleTree.getHexProof(leaf);
    }
  };
}

// Generate the Merkle Tree from quiz data
const quiz = generateQuizMerkleTree(quizData);

// Print the Merkle Root that you'll need to provide when creating a game
console.log('Merkle Root for your quiz game:');
console.log(quiz.merkleRoot);
console.log();

// Example: Generate a proof for a specific question
// Let's pick the first question as an example
const exampleQuestion = quizData[0];
const questionId = exampleQuestion.question.match(/\(([^)]+)\)/)[1]; // Extract Q1, Q2, etc.
const correctAnswerIndex = exampleQuestion.options.indexOf(exampleQuestion.answer);

console.log(`Example question: ${exampleQuestion.question}`);
console.log(`Correct answer: ${exampleQuestion.answer} (index: ${correctAnswerIndex})`);
console.log();

// Generate the proof
const proof = quiz.getProof(questionId, correctAnswerIndex);
console.log('Merkle Proof:');
console.log(proof);
console.log();

// Generate and save a test dataset with questions, correct answers, and proofs
const testDataset = quizData.map(item => {
  const qId = item.question.match(/\(([^)]+)\)/)[1];
  const answerIdx = item.options.indexOf(item.answer);
  
  return {
    questionId: qId,
    question: item.question,
    options: item.options,
    correctAnswer: item.answer,
    answerIndex: answerIdx,
    proof: quiz.getProof(qId, answerIdx)
  };
});

// Save test data to a file
fs.writeFileSync(
  './quiz-merkle-data.json', 
  JSON.stringify({
    merkleRoot: quiz.merkleRoot,
    questions: testDataset
  }, null, 2)
);

console.log('Test dataset saved to quiz-merkle-data.json');
console.log('Use this merkleRoot when creating your quiz game on the blockchain.');
console.log();
console.log('Instructions:');
console.log('1. Use the merkleRoot when calling createGame() in your DeFiPredictorV2 contract');
console.log('2. For each user, provide:');
console.log('   - The questionId (e.g., "Q1")');
console.log('   - The answerIndex (0-3)');
console.log('   - The proof from quiz-merkle-data.json');
console.log();
console.log('When a user submits their answer, they will send:');
console.log('  joinQuiz(gameId, proof, questionId, answerIndex)');
