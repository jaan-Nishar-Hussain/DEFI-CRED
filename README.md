# DeFi Predictor Smart Contract

A decentralized platform for quiz games and cryptocurrency price predictions, built on Ethereum using Solidity.

## Features

- **Quiz Games**: Create and participate in quiz games with verifiable correct answers using Merkle trees
- **Crypto Price Predictions**: Predict future cryptocurrency prices with different prediction types
- **Reward System**: Win rewards for correct answers and predictions
- **Admin Controls**: Manage games, update configurations, and control platform fees

## Smart Contract Architecture

- `DeFiPredictorV2.sol`: Main contract for game management, participation, and rewards
- `MockAggregator.sol`: Mock price feed for local development and testing

## Development Setup

1. Clone the repository
2. Install dependencies:
   ```shell
   npm install
   ```
3. Create a `.env` file based on the `.env.example` template:
   ```shell
   cp .env.example .env
   ```
4. Add your wallet's private key and RPC URL to the `.env` file

## Testing

Run the comprehensive test suite:

```shell
npx hardhat test
```

## Deployment

### Local Deployment

To deploy to a local Hardhat node:

1. Start a local Hardhat node:
   ```shell
   npx hardhat node
   ```

2. Deploy the contracts:
   ```shell
   npx hardhat run scripts/deploy.js --network localhost
   ```

### Polygon Mainnet Deployment

⚠️ **WARNING: This will deploy to the real Polygon mainnet and cost real MATIC!** ⚠️

To deploy to Polygon mainnet:

1. Make sure your `.env` file is configured with:
   - `PRIVATE_KEY`: Your wallet's private key
   - `POLYGON_RPC_URL`: Your RPC URL for Polygon mainnet
   - `POLYGONSCAN_API_KEY`: Your Polygonscan API key for contract verification

2. Run the deployment script:
   ```shell
   ./deploy-polygon.sh
   ```
   
   Or manually:
   ```shell
   npx hardhat run scripts/deploy.js --network polygon
   ```

### Polygon Mumbai Testnet Deployment

To deploy to Polygon Mumbai testnet:

1. Make sure your `.env` file is configured with:
   - `PRIVATE_KEY`: Your wallet's private key
   - `MUMBAI_RPC_URL`: Your RPC URL for Polygon Mumbai
   - `POLYGONSCAN_API_KEY`: Your Polygonscan API key for contract verification

2. Run the deployment script:
   ```shell
   ./deploy-mumbai.sh
   ```
   
   Or manually:
   ```shell
   npx hardhat run scripts/deploy.js --network mumbai
   ```

### Polygon Amoy Testnet Deployment

To deploy to Polygon Amoy testnet:

1. Make sure your `.env` file is configured with:
   - `PRIVATE_KEY`: Your wallet's private key
   - `ALCHEMY_URL`: Your Alchemy RPC URL for Polygon Amoy
   - `POLYGONSCAN_API_KEY`: Your Polygonscan API key for contract verification

2. Run the deployment script:
   ```shell
   ./deploy-amoy.sh
   ```
   
   Or manually:
   ```shell
   npx hardhat run scripts/deploy.js --network polygonAmoy
   ```

### Other Networks

The deploy script supports multiple networks. To deploy to a different network, add the network configuration to `hardhat.config.js` and run:

```shell
npx hardhat run scripts/deploy.js --network <network-name>
```

## After Deployment

After deployment, the contract addresses and deployment details will be saved to:
- `deployment-info.json` (main deployment info)
- `deployment-info-<network-name>.json` (network-specific deployment info)

## License

MIT
