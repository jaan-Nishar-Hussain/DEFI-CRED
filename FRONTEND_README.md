# DeFi Predictor Frontend

Complete frontend implementation for the DeFi Predictor V2 smart contract, featuring both admin and user interfaces built in JavaScript.

## Project Structure

```
DEFI-PREDICT/
├── admin/                  # Admin Dashboard
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── hooks/         # Custom React hooks
│   │   ├── services/      # Blockchain services
│   │   ├── constants/     # Contract addresses and configs
│   │   └── ...
│   └── package.json
├── user/                   # User Interface
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── hooks/         # Custom React hooks
│   │   ├── services/      # Blockchain services
│   │   ├── constants/     # Contract addresses and configs
│   │   └── ...
│   └── package.json
└── contracts/             # Smart contracts
```

## Features

### Admin Dashboard
- **Game Management**: Create, fund, and end games
- **Quiz Games**: Set Merkle roots for quiz questions
- **Crypto Prediction Games**: Create price prediction challenges
- **Platform Management**: Withdraw platform fees
- **Statistics**: View platform stats and active games
- **Real-time Updates**: Live game status and participant data

### User Interface
- **Game Participation**: Join quiz and crypto prediction games
- **Wallet Integration**: MetaMask connection with network switching
- **Quiz Gameplay**: Answer questions with Merkle proof verification
- **Price Predictions**: Make ETH price predictions with oracle data
- **User Stats**: Track participation history and winnings
- **Responsive Design**: Mobile-friendly interface

## Technical Implementation

### Smart Contract Integration
- **ethers.js v6**: Modern Ethereum library for blockchain interactions
- **Contract Service**: Centralized service for all contract calls
- **Event Listening**: Real-time contract event monitoring
- **Error Handling**: Comprehensive error catching and user feedback

### Wallet Integration
- **MetaMask Support**: Seamless wallet connection
- **Network Switching**: Automatic Polygon Amoy testnet switching
- **Account Management**: Balance display and account switching
- **Security**: Secure transaction signing and validation

### Game Types
1. **Quiz Games**:
   - Multiple choice questions with Merkle proof verification
   - Hardcoded demo questions for testing
   - Secure answer validation
   - Winner selection and reward distribution

2. **Crypto Prediction Games**:
   - ETH price predictions using Chainlink oracles
   - Higher/lower price predictions
   - Timed game rounds
   - Automatic winner determination

## Getting Started

### Prerequisites
- Node.js (v16 or higher)
- MetaMask browser extension
- POL tokens on Polygon Amoy testnet

### Installation

1. **Install Admin Dashboard**:
   ```bash
   cd admin
   npm install
   ```

2. **Install User Interface**:
   ```bash
   cd user
   npm install
   ```

### Development

1. **Start Admin Dashboard**:
   ```bash
   cd admin
   npm start
   ```
   Opens at `http://localhost:3000`

2. **Start User Interface**:
   ```bash
   cd user
   npm start
   ```
   Opens at `http://localhost:3001` (if 3000 is taken)

### Production Build

1. **Build Admin Dashboard**:
   ```bash
   cd admin
   npm run build
   ```

2. **Build User Interface**:
   ```bash
   cd user
   npm run build
   ```

## Configuration

### Network Configuration
Update `src/constants/contract.js` in both admin and user directories:

```javascript
export const NETWORKS = {
  polygonAmoy: {
    chainId: '0x13882',
    chainName: 'Polygon Amoy Testnet',
    rpcUrls: ['https://rpc-amoy.polygon.technology/'],
    blockExplorerUrls: ['https://amoy.polygonscan.com/'],
    nativeCurrency: {
      name: 'POL',
      symbol: 'POL',
      decimals: 18,
    },
  },
};

export const CONTRACT_ADDRESS = "YOUR_DEPLOYED_CONTRACT_ADDRESS";
```

### Contract Deployment
1. Deploy the DeFiPredictorV2 contract to Polygon Amoy testnet
2. Update the `CONTRACT_ADDRESS` in both admin and user constants
3. Ensure the contract ABI matches the imported ABI files

## Usage

### Admin Workflow
1. Connect MetaMask wallet to Polygon Amoy testnet
2. Create new games (quiz or crypto prediction)
3. Fund games with POL tokens
4. Set Merkle roots for quiz games
5. Monitor game participation and status
6. End games when conditions are met
7. Withdraw platform fees

### User Workflow
1. Connect MetaMask wallet to Polygon Amoy testnet
2. Browse available games
3. Join games by paying entry fees
4. For quiz games: Answer questions with provided proofs
5. For crypto games: Make price predictions
6. Claim rewards when games end
7. View participation history and stats

## Demo Data

### Quiz Questions
The user interface includes hardcoded demo questions for testing:
- Question 1: Ethereum cryptocurrency knowledge
- Question 7: Historical civilizations

### Merkle Proofs
Hardcoded Merkle proofs are provided for the demo questions:
- Q1 with answer 1 (Ether): Valid proof included
- Q7 with answer 1 (Sumerians): Valid proof included

### Price Prediction
- Uses live Chainlink ETH/USD price feeds
- Supports higher/lower predictions
- Automatic winner determination based on oracle data

## Security Features

### Frontend Security
- Input validation and sanitization
- Secure wallet connection handling
- Transaction confirmation flows
- Error boundary implementations

### Smart Contract Integration
- Proper gas estimation
- Transaction retry mechanisms
- Event-based updates
- Merkle proof verification

## Troubleshooting

### Common Issues

1. **MetaMask Connection Issues**:
   - Ensure MetaMask is installed and unlocked
   - Check network connection to Polygon Amoy
   - Refresh page and try reconnecting

2. **Transaction Failures**:
   - Verify sufficient POL balance for gas fees
   - Check contract address and network configuration
   - Ensure contract is deployed and functional

3. **Game Participation Issues**:
   - Verify game is active and accepting participants
   - Check entry fee requirements
   - Ensure correct Merkle proofs for quiz games

### Network Configuration
If automatic network switching fails:
1. Manually add Polygon Amoy to MetaMask
2. Use RPC URL: `https://rpc-amoy.polygon.technology/`
3. Chain ID: `80002`
4. Currency: `POL`

## Contributing

1. Fork the repository
2. Create feature branches for new functionality
3. Ensure all TypeScript files are converted to JavaScript
4. Test thoroughly on Polygon Amoy testnet
5. Submit pull requests with detailed descriptions

## License

This project is licensed under the MIT License.

## Support

For support and questions:
- Check the troubleshooting section
- Review smart contract documentation
- Test on Polygon Amoy testnet first
- Ensure all dependencies are properly installed
