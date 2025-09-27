const express = require('express');
const cors = require('cors');
const { createWalletClient, getContract, http, publicActions, parseEventLogs } = require('viem');
const { arbitrumSepolia } = require('viem/chains');
const { privateKeyToAccount } = require('viem/accounts');
const { IGenerateNumberAbi } = require('./contract-abi.js');

const app = express();
const PORT = process.env.PORT || 3000;

// Contract configuration
const CONTRACT_ADDRESS = "0x6C6a7a837a84c0946F4FE12f83C2253812341d72"; // Your deployed contract
const PRIVATE_KEY = "0x9c38fe9f16124f5f09cb7c877009b52cf439ffa755996bea145e242abab981a8";
const RPC_URL = "https://sepolia-rollup.arbitrum.io/rpc";

// Initialize wallet client
const client = createWalletClient({
    chain: arbitrumSepolia,
    account: privateKeyToAccount(PRIVATE_KEY),
    transport: http(RPC_URL),
}).extend(publicActions);

// Initialize contract
const generateNumberContract = getContract({
    address: CONTRACT_ADDRESS,
    abi: IGenerateNumberAbi,
    client,
});

// Middleware
app.use(cors());
app.use(express.json());

// Generate truly random number using Pyth Entropy contract
async function generateRandomNumber() {
    try {
        console.log("🎲 Requesting random number from Pyth Entropy contract...");
        
        // Get the fee required
        const numberFee = await generateNumberContract.read.getNumberFee();
        console.log(`Fee required: ${numberFee} wei`);
        
        // Request random number
        const txHash = await generateNumberContract.write.requestNumber({
            value: numberFee,
        });
        
        console.log(`Transaction Hash: ${txHash}`);
        
        // Wait for transaction receipt
        const receipt = await client.waitForTransactionReceipt({
            hash: txHash,
        });
        
        // Parse the NumberRequest event to get sequence number
        const requestLogs = parseEventLogs({
            abi: IGenerateNumberAbi,
            eventName: "NumberRequest",
            logs: receipt.logs,
        });
        
        const sequenceNumber = requestLogs[0].args.sequenceNumber;
        console.log(`Sequence Number: ${sequenceNumber}`);
        
        // Wait for the NumberResult event
        console.log("⏳ Waiting for random number result...");
        const result = await new Promise((resolve, reject) => {
            const unwatch = generateNumberContract.watchEvent.NumberResult({
                fromBlock: receipt.blockNumber - 1n,
                onLogs: (logs) => {
                    for (const log of logs) {
                        if (log.args.sequenceNumber === sequenceNumber) {
                            unwatch();
                            resolve(log.args.randomNumber || 0n);
                        }
                    }
                },
            });
            
            // Timeout after 60 seconds
            setTimeout(() => {
                unwatch();
                reject(new Error('Timeout waiting for random number'));
            }, 60000);
        });
        
        console.log(`🎲 Generated Number: ${result}`);
        const randomNumber = Number(result) % 10;
        console.log(`Number (0-9): ${randomNumber}`);
        
        return randomNumber;
    } catch (error) {
        console.error("Error generating random number:", error);
        throw error;
    }
}

// Routes
app.get('/', (req, res) => {
    res.json({
        message: 'Pyth Entropy Random Number Server',
        version: '1.0.0',
        description: 'Generates truly random numbers using Pyth Entropy blockchain contract',
        contract: CONTRACT_ADDRESS,
        chain: 'Arbitrum Sepolia',
        endpoints: {
            'GET /random': 'Generate a truly random number between 0-9 using Pyth Entropy',
            'GET /random/:count': 'Generate multiple truly random numbers (1-10)',
            'GET /fee': 'Get the current fee required for random number generation'
        }
    });
});

// Get current fee endpoint
app.get('/fee', async (req, res) => {
    try {
        const fee = await generateNumberContract.read.getNumberFee();
        res.json({
            success: true,
            fee: fee.toString(),
            feeEth: (Number(fee) / 1e18).toString(),
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to get fee information',
            details: error.message
        });
    }
});

// Single random number endpoint
app.get('/random', async (req, res) => {
    try {
        const randomNumber = await generateRandomNumber();
        res.json({
            success: true,
            randomNumber: randomNumber,
            source: 'Pyth Entropy Contract',
            contract: CONTRACT_ADDRESS,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to generate random number',
            details: error.message
        });
    }
});

// Multiple random numbers endpoint (limited to 10 for blockchain efficiency)
app.get('/random/:count', async (req, res) => {
    const count = parseInt(req.params.count);
    
    if (isNaN(count) || count < 1 || count > 10) {
        return res.status(400).json({
            success: false,
            error: 'Count must be a number between 1 and 10 (blockchain requests are expensive)'
        });
    }
    
    try {
        const randomNumbers = [];
        for (let i = 0; i < count; i++) {
            console.log(`Generating random number ${i + 1}/${count}...`);
            const randomNumber = await generateRandomNumber();
            randomNumbers.push(randomNumber);
        }
        
        res.json({
            success: true,
            count: count,
            randomNumbers: randomNumbers,
            source: 'Pyth Entropy Contract',
            contract: CONTRACT_ADDRESS,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to generate random numbers',
            details: error.message
        });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString()
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        success: false,
        error: 'Something went wrong!'
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found'
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🎲 Pyth Entropy Random Server running on port ${PORT}`);
    console.log(`📡 Available endpoints:`);
    console.log(`   GET  http://localhost:${PORT}/`);
    console.log(`   GET  http://localhost:${PORT}/random`);
    console.log(`   GET  http://localhost:${PORT}/random/3`);
    console.log(`   GET  http://localhost:${PORT}/fee`);
    console.log(`   GET  http://localhost:${PORT}/health`);
    console.log(`\n🔗 Contract: ${CONTRACT_ADDRESS}`);
    console.log(`⛓️  Chain: Arbitrum Sepolia`);
    console.log(`\n⚠️  Note: Each random number request costs gas fees!`);
});

module.exports = app;
