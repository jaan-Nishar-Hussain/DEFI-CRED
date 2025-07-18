const { ethers } = require("hardhat");
const { MerkleTree } = require("merkletreejs");
const keccak256 = require("keccak256");
const fs = require("fs");
const path = require("path");

async function main() {
    console.log("Starting Merkle tree generation...");
    
    // Load quiz data from utils/quiz-export.json
    const quizPath = path.join(__dirname, "../utils/quiz-export.json");
    console.log("Reading quiz data from:", quizPath);
    
    const questions = JSON.parse(fs.readFileSync(quizPath));
    
    // Add IDs to questions if they don't have them and get correct answers as indices
    const processedQuestions = questions.map((q, index) => {
        // Generate question ID if not present
        if (!q.id) {
            q.id = `Q${index + 1}`;
        }
        
        // Convert string answer to index
        if (typeof q.answer === 'string') {
            q.correctAnswer = q.options.findIndex(opt => opt === q.answer);
            if (q.correctAnswer === -1) {
                console.warn(`Warning: Answer "${q.answer}" not found in options for question: ${q.question}`);
                q.correctAnswer = 0; // Default to first option if not found
            }
        }
        
        return q;
    });
    
    console.log(`Loaded ${processedQuestions.length} questions from utils/quiz-export.json`);

    // Create leaves for Merkle tree
    const leaves = processedQuestions.map(q => 
        keccak256(ethers.solidityPacked(
            ["string", "uint8"], 
            [q.id, q.correctAnswer]
        ))
    );

    // Create Merkle tree
    const merkleTree = new MerkleTree(leaves, keccak256, { sortPairs: true });
    const merkleRoot = merkleTree.getHexRoot();

    // Generate proofs for each question
    const questionsWithProofs = processedQuestions.map((q, index) => {
        const leaf = keccak256(ethers.solidityPacked(
            ["string", "uint8"], 
            [q.id, q.correctAnswer]
        ));
        const proof = merkleTree.getHexProof(leaf);
        
        return {
            ...q,
            merkleProof: proof
        };
    });

    // Create output data
    const merkleData = {
        merkleRoot,
        questions: questionsWithProofs,
        timestamp: new Date().toISOString()
    };

    // Save Merkle data
    const outputPath = 'quiz/merkle-data.json';
    if (!fs.existsSync('quiz')) {
        fs.mkdirSync('quiz');
    }
    fs.writeFileSync(outputPath, JSON.stringify(merkleData, null, 2));

    console.log("\nMerkle Tree Generation Complete!");
    console.log("Merkle Root:", merkleRoot);
    console.log("Data saved to:", outputPath);

    // Update deployment info with new Merkle root
    const network = process.env.HARDHAT_NETWORK || "hardhat";
    const deploymentPath = `deployments/${network}.json`;
    
    if (fs.existsSync(deploymentPath)) {
        const deploymentInfo = JSON.parse(fs.readFileSync(deploymentPath));
        deploymentInfo.merkleRoot = merkleRoot;
        fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
        console.log(`\nUpdated deployment info in ${deploymentPath} with new Merkle root`);
    }

    // Print verification example
    console.log("\nExample Question Verification Data:");
    const exampleQuestion = questionsWithProofs[0];
    console.log(`Question ID: ${exampleQuestion.id}`);
    console.log(`Correct Answer: ${exampleQuestion.correctAnswer}`);
    console.log(`Merkle Proof: ${JSON.stringify(exampleQuestion.merkleProof)}`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
