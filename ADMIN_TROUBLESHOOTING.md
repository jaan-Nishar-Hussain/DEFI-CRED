# Admin Frontend Troubleshooting Guide

The admin frontend is showing only the wallet connection screen because **this is the expected behavior** when no wallet is connected. Here's how to properly use the admin dashboard:

## Current Status: ✅ Working Correctly

The admin dashboard is functioning as designed. It shows:
1. **Wallet Connection Screen** - When no wallet is connected
2. **Network Switch Prompt** - When connected to wrong network  
3. **Full Dashboard** - When wallet is connected to Polygon Amoy

## Steps to Access Full Admin Dashboard:

### 1. Install MetaMask
- Install MetaMask browser extension if not already installed
- Create or import a wallet

### 2. Connect to Polygon Amoy Testnet
Add Polygon Amoy network to MetaMask:
- **Network Name**: Polygon Amoy Testnet
- **RPC URL**: `https://rpc-amoy.polygon.technology/`
- **Chain ID**: `80002`
- **Currency Symbol**: `POL`
- **Block Explorer**: `https://amoy.polygonscan.com/`

### 3. Get Test POL Tokens
- Visit [Polygon Amoy Faucet](https://faucet.polygon.technology/)
- Request POL tokens for your wallet address
- You need POL for gas fees

### 4. Start Admin Frontend
```bash
cd admin
npm start
```
Opens at: `http://localhost:3000`

### 5. Connect Wallet
1. Click "Connect Wallet" button
2. Approve MetaMask connection
3. Switch network if prompted
4. You should now see the full dashboard

## Full Dashboard Features (After Connection):

### Navigation Tabs:
- **Overview** - Platform stats and recent games
- **Create Game** - Create new quiz/crypto games  
- **Manage Games** - View and manage all games
- **Fund Games** - Add funds to games
- **Admin Actions** - End games, update Merkle roots, withdraw fees

### Admin Functions Available:
- ✅ Create Quiz Games
- ✅ Create Crypto Prediction Games
- ✅ Fund Games with POL
- ✅ Update Merkle Roots for Quizzes
- ✅ End Games Manually
- ✅ Withdraw Platform Fees
- ✅ View Platform Statistics
- ✅ Monitor Active Games

## Troubleshooting:

### Issue: Only seeing "Connect Wallet" screen
**Solution**: This is normal! Connect your MetaMask wallet.

### Issue: "Wrong Network" message
**Solution**: Click "Switch Network" or manually switch to Polygon Amoy.

### Issue: Transaction failures
**Solution**: Ensure you have POL tokens for gas fees.

### Issue: Contract errors
**Solution**: Verify the contract is deployed at the configured address.

## Contract Configuration:
- **Contract Address**: `0x4F7A040D213bcdB8c9b22e6b18eED68A9BD4047C`
- **Network**: Polygon Amoy Testnet (Chain ID: 80002)
- **Currency**: POL

## Debug Mode:
If you want to see wallet connection status, open browser console (F12) to see connection logs and any errors.

The admin frontend is **complete and working correctly** - you just need to connect your wallet to see all features!
