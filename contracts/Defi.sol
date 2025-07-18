// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";

contract DeFiPredictorV2 is ReentrancyGuard, Pausable {
    enum GameType { Quiz, Crypto } // Removed Sports
    enum GameStatus { NotStarted, Active, Ended, Expired }
    enum PredictionType { GreaterThan, LessThan, Between }

    struct Game {
        GameType gameType;
        GameStatus status;
        PredictionType predictionType;
        bytes32 merkleRoot;
        uint256 entryFee;         // In native POL tokens
        uint256 rewardMultiplier;
        uint256 platformFee;
        uint256 deadline;
        uint256 fundedAmount;     // In native POL tokens
        int256 priceMin;
        int256 priceMax;
    }

    struct PlayerData {
        bool joined;
        bool claimed;
        bool refunded;
        int256 prediction;
    }

    mapping(string => Game) private games;
    mapping(string => mapping(address => PlayerData)) private players;
    mapping(string => address[]) private gamePlayers;
    string[] private gameIds; // Array to store all game IDs

    AggregatorV3Interface public priceFeed;
    address public admin;
    uint256 public totalPlatformFees;  // Accumulated platform fees in native POL tokens

    event GameCreated(string indexed gameId, GameType gameType);
    event GameFunded(string indexed gameId, uint256 amount);
    event ClaimedReward(address indexed player, string gameId, uint256 reward);
    event Refunded(address indexed player, string gameId, uint256 amount);
    event GameEnded(string indexed gameId);

    modifier onlyAdmin() {
        require(msg.sender == admin, "Not admin");
        _;
    }

    constructor(address _priceFeed) {
        priceFeed = AggregatorV3Interface(_priceFeed);
        admin = msg.sender;
    }

    function createGame(
        string calldata gameId,
        GameType gameType,
        bytes32 merkleRoot,
        uint256 entryFee,        // Entry fee in POL tokens (smallest units)
        uint256 rewardMultiplier,
        uint256 platformFee,
        uint256 deadline,
        PredictionType predictionType,
        int256 priceMin,
        int256 priceMax
    ) external onlyAdmin {
        require(games[gameId].status == GameStatus.NotStarted, "Game already exists");
        games[gameId] = Game({
            gameType: gameType,
            status: GameStatus.Active,
            predictionType: predictionType,
            merkleRoot: merkleRoot,
            entryFee: entryFee,
            rewardMultiplier: rewardMultiplier,
            platformFee: platformFee,
            deadline: deadline,
            fundedAmount: 0,
            priceMin: priceMin,
            priceMax: priceMax
        });

        gameIds.push(gameId); // Add the new game ID to our array
        emit GameCreated(gameId, gameType);
    }

    function fundGame(string calldata gameId) external payable onlyAdmin {
        Game storage g = games[gameId];
        require(g.status == GameStatus.Active, "Game not active");
        
        // Native POL is sent with the transaction
        g.fundedAmount += msg.value;
        emit GameFunded(gameId, msg.value);
    }

    function updateMerkleRoot(string calldata gameId, bytes32 newRoot) external onlyAdmin {
        games[gameId].merkleRoot = newRoot;
    }

    function endGame(string calldata gameId) external onlyAdmin {
        Game storage g = games[gameId];
        require(block.timestamp > g.deadline, "Deadline not reached");
        g.status = GameStatus.Ended;
        emit GameEnded(gameId);
    }

    function joinQuiz(
        string calldata gameId,
        bytes32[] calldata proof,
        string calldata questionId,
        uint8 answer
    ) external payable whenNotPaused nonReentrant {
        Game storage g = games[gameId];
        require(g.status == GameStatus.Active, "Game not active");
        require(g.gameType == GameType.Quiz, "Not a quiz game");
        require(block.timestamp <= g.deadline, "Game expired");
        require(msg.value == g.entryFee, "Incorrect entry fee");

        PlayerData storage p = players[gameId][msg.sender];
        require(!p.claimed, "Already claimed");

        bytes32 leaf = keccak256(abi.encodePacked(questionId, answer));
        bool isCorrect = MerkleProof.verify(proof, g.merkleRoot, leaf);

        uint256 platformCut = (msg.value * g.platformFee) / 10000;
        totalPlatformFees += platformCut;

        if (isCorrect) {
            uint256 reward = ((msg.value - platformCut) * g.rewardMultiplier) / 10000;
            require(g.fundedAmount >= reward, "Insufficient pool");
            g.fundedAmount -= reward;

            // Transfer native POL as reward
            (bool sent, ) = payable(msg.sender).call{value: reward}("");
            require(sent, "Reward transfer failed");

            emit ClaimedReward(msg.sender, gameId, reward);
        } else {
            g.fundedAmount += (msg.value - platformCut);
            emit ClaimedReward(msg.sender, gameId, 0);
        }

        p.joined = true;
        p.claimed = true;
        gamePlayers[gameId].push(msg.sender);
    }

    function joinCryptoPrediction(
        string calldata gameId,
        int256 userPrediction
    ) external payable whenNotPaused nonReentrant {
        Game storage g = games[gameId];
        require(g.status == GameStatus.Active, "Game not active");
        require(g.gameType == GameType.Crypto, "Not a crypto game");
        require(block.timestamp <= g.deadline, "Game expired");
        require(msg.value == g.entryFee, "Incorrect entry fee");

        PlayerData storage p = players[gameId][msg.sender];
        require(!p.claimed, "Already claimed");

        (, int256 price, , , ) = priceFeed.latestRoundData();

        bool isCorrect;
        if (g.predictionType == PredictionType.GreaterThan) {
            isCorrect = price > userPrediction;
        } else if (g.predictionType == PredictionType.LessThan) {
            isCorrect = price < userPrediction;
        } else {
            isCorrect = price >= g.priceMin && price <= g.priceMax;
        }

        uint256 platformCut = (msg.value * g.platformFee) / 10000;
        totalPlatformFees += platformCut;

        if (isCorrect) {
            uint256 reward = ((msg.value - platformCut) * g.rewardMultiplier) / 10000;
            require(g.fundedAmount >= reward, "Insufficient pool");
            g.fundedAmount -= reward;

            // Transfer native POL as reward
            (bool sent, ) = payable(msg.sender).call{value: reward}("");
            require(sent, "Reward transfer failed");

            emit ClaimedReward(msg.sender, gameId, reward);
        } else {
            g.fundedAmount += (msg.value - platformCut);
            emit ClaimedReward(msg.sender, gameId, 0);
        }

        p.joined = true;
        p.claimed = true;
        p.prediction = userPrediction;
        gamePlayers[gameId].push(msg.sender);
    }

    function claimRefund(string calldata gameId) external whenNotPaused nonReentrant {
        Game storage g = games[gameId];
        PlayerData storage p = players[gameId][msg.sender];

        require(block.timestamp > g.deadline, "Game still active");
        require(p.joined, "Did not participate");
        require(!p.claimed, "Already claimed");
        require(!p.refunded, "Already refunded");

        p.refunded = true;

        // Transfer native POL as refund
        (bool sent, ) = payable(msg.sender).call{value: g.entryFee}("");
        require(sent, "Refund transfer failed");

        emit Refunded(msg.sender, gameId, g.entryFee);
    }

    function withdrawFees(uint256 amount) external onlyAdmin {
        require(amount <= totalPlatformFees, "Exceeds fees");
        totalPlatformFees -= amount;
        
        // Transfer accumulated native POL fees to admin
        (bool sent, ) = payable(admin).call{value: amount}("");
        require(sent, "Fee withdrawal failed");
    }

    function pause() external onlyAdmin { _pause(); }
    function unpause() external onlyAdmin { _unpause(); }

    function getLatestPrice() public view returns (int256) {
        (, int256 price, , , ) = priceFeed.latestRoundData();
        return price;
    }

    function getGamePlayers(string calldata gameId) external view returns (address[] memory) {
        return gamePlayers[gameId];
    }

    function getPlayerData(string calldata gameId, address user) external view returns (PlayerData memory) {
        return players[gameId][user];
    }

    function getPlayerGames(address player) external view returns (string[] memory) {
        uint256 participationCount = 0;
        
        // Count the games where the player has participated
        for (uint256 i = 0; i < gameIds.length; i++) {
            if (players[gameIds[i]][player].joined) {
                participationCount++;
            }
        }
        
        // Create and fill array with game IDs where player participated
        string[] memory playerGames = new string[](participationCount);
        uint256 currentIndex = 0;
        
        for (uint256 i = 0; i < gameIds.length && currentIndex < participationCount; i++) {
            if (players[gameIds[i]][player].joined) {
                playerGames[currentIndex] = gameIds[i];
                currentIndex++;
            }
        }
        
        return playerGames;
    }

    function getGameBasicDetails(string calldata gameId) external view returns (
        GameType gameType,
        GameStatus status,
        PredictionType predictionType,
        uint256 entryFee,
        uint256 rewardMultiplier,
        uint256 platformFee
    ) {
        Game storage g = games[gameId];
        return (
            g.gameType,
            g.status,
            g.predictionType,
            g.entryFee,
            g.rewardMultiplier,
            g.platformFee
        );
    }

    function getGameExtendedDetails(string calldata gameId) external view returns (
        uint256 deadline,
        uint256 fundedAmount,
        int256 priceMin,
        int256 priceMax,
        uint256 playerCount
    ) {
        Game storage g = games[gameId];
        return (
            g.deadline,
            g.fundedAmount,
            g.priceMin,
            g.priceMax,
            gamePlayers[gameId].length
        );
    }

    function getGameCount() external view returns (uint256) {
        return gameIds.length;
    }

    function getGameIdAtIndex(uint256 index) external view returns (string memory) {
        require(index < gameIds.length, "Index out of bounds");
        return gameIds[index];
    }

    function getActiveGames() external view returns (string[] memory) {
        // First, count active games
        uint256 activeCount = 0;
        for (uint256 i = 0; i < gameIds.length; i++) {
            if (games[gameIds[i]].status == GameStatus.Active) {
                activeCount++;
            }
        }

        // Create array of proper size
        string[] memory activeGames = new string[](activeCount);
        
        // Fill array with active game IDs
        uint256 currentIndex = 0;
        for (uint256 i = 0; i < gameIds.length && currentIndex < activeCount; i++) {
            if (games[gameIds[i]].status == GameStatus.Active) {
                activeGames[currentIndex] = gameIds[i];
                currentIndex++;
            }
        }
        
        return activeGames;
    }

    function getActiveGamesByType(GameType gameType) external view returns (string[] memory) {
        // First, count active games of this type
        uint256 typeCount = 0;
        for (uint256 i = 0; i < gameIds.length; i++) {
            Game storage g = games[gameIds[i]];
            if (g.status == GameStatus.Active && g.gameType == gameType) {
                typeCount++;
            }
        }

        // Create array of proper size
        string[] memory typedGames = new string[](typeCount);
        
        // Fill array with active game IDs of this type
        uint256 currentIndex = 0;
        for (uint256 i = 0; i < gameIds.length && currentIndex < typeCount; i++) {
            Game storage g = games[gameIds[i]];
            if (g.status == GameStatus.Active && g.gameType == gameType) {
                typedGames[currentIndex] = gameIds[i];
                currentIndex++;
            }
        }
        
        return typedGames;
    }
    
    function canParticipate(string calldata gameId, address user) external view returns (bool userCanParticipate, string memory reason) {
        Game storage g = games[gameId];
        
        if (g.status != GameStatus.Active) {
            return (false, "Game is not active");
        }
        
        if (block.timestamp > g.deadline) {
            return (false, "Game has expired");
        }
        
        PlayerData storage p = players[gameId][user];
        
        if (p.joined && (p.claimed || p.refunded)) {
            return (false, "Already participated");
        }
        
        // Check if user has enough native POL tokens
        if (user.balance < g.entryFee) {
            return (false, "Insufficient POL balance");
        }
        
        return (true, "");
    }
    
    receive() external payable {}
    
    fallback() external payable {}
}
