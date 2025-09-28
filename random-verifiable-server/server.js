const express = require('express');
const cors = require('cors');
const { createWalletClient, getContract, http, publicActions, parseEventLogs } = require('viem');
const { arbitrumSepolia } = require('viem/chains');
const { privateKeyToAccount } = require('viem/accounts');
const { IGenerateNumberAbi } = require('./contract-abi.js');
const { IBugsNumberGeneratorAbi } = require('./bugs-number-generator-abi.js');

const app = express();
const PORT = process.env.PORT || 3000;

// Contract configuration
const CONTRACT_ADDRESS = "0x6C6a7a837a84c0946F4FE12f83C2253812341d72"; // Your deployed contract
const BUGS_CONTRACT_ADDRESS = "0x7595e0AA952925A4D2afc3fc0DFf7dB6CeFf4D63"; // Your deployed BugsNumberGenerator contract
const PRIVATE_KEY = "0x9c38fe9f16124f5f09cb7c877009b52cf439ffa755996bea145e242abab981a8";
const RPC_URL = "https://sepolia-rollup.arbitrum.io/rpc";

// Initialize wallet client
const client = createWalletClient({
    chain: arbitrumSepolia,
    account: privateKeyToAccount(PRIVATE_KEY),
    transport: http(RPC_URL),
}).extend(publicActions);

// Initialize contracts
const generateNumberContract = getContract({
    address: CONTRACT_ADDRESS,
    abi: IGenerateNumberAbi,
    client,
});

const bugsNumberGeneratorContract = getContract({
    address: BUGS_CONTRACT_ADDRESS,
    abi: IBugsNumberGeneratorAbi,
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

// Calculate win chance using BugsNumberGenerator contract
async function calculateWinChance(totalBlocks, numbersChosen, totalDefective) {
    try {
        console.log("🎯 Requesting win chance calculation from BugsNumberGenerator contract...");
        console.log(`Parameters: Total Blocks: ${totalBlocks}, Numbers Chosen: ${numbersChosen}, Total Defective: ${totalDefective}`);
        
        // Get the fee required
        const winChanceFee = await bugsNumberGeneratorContract.read.getWinChanceFee();
        console.log(`Fee required: ${winChanceFee} wei`);
        
        // Calculate expected probability
        const expectedProbability = await bugsNumberGeneratorContract.read.calculateWinProbability([
            BigInt(totalBlocks),
            BigInt(numbersChosen),
            BigInt(totalDefective)
        ]);
        console.log(`Expected Win Probability: ${Number(expectedProbability) / 100}% (${expectedProbability} basis points)`);
        
        // Request win chance calculation
        const txHash = await bugsNumberGeneratorContract.write.requestWinChance(
            [BigInt(totalBlocks), BigInt(numbersChosen), BigInt(totalDefective)],
            { value: winChanceFee }
        );
        
        console.log(`Transaction Hash: ${txHash}`);
        
        // Wait for transaction receipt
        const receipt = await client.waitForTransactionReceipt({
            hash: txHash,
        });
        
        // Parse the WinChanceRequest event to get sequence number
        const requestLogs = parseEventLogs({
            abi: IBugsNumberGeneratorAbi,
            eventName: "WinChanceRequest",
            logs: receipt.logs,
        });
        
        const sequenceNumber = requestLogs[0].args.sequenceNumber;
        console.log(`Sequence Number: ${sequenceNumber}`);
        
        // Wait for the WinResult event
        console.log("⏳ Waiting for win result...");
        const result = await new Promise((resolve, reject) => {
            const unwatch = bugsNumberGeneratorContract.watchEvent.WinResult({
                fromBlock: receipt.blockNumber - 1n,
                onLogs: (logs) => {
                    for (const log of logs) {
                        if (log.args.sequenceNumber === sequenceNumber) {
                            unwatch();
                            resolve({
                                didWin: log.args.didWin || false,
                                winProbability: log.args.winProbability || 0n
                            });
                        }
                    }
                },
            });
            
            // Timeout after 60 seconds
            setTimeout(() => {
                unwatch();
                reject(new Error('Timeout waiting for win result'));
            }, 60000);
        });
        
        console.log(`🎯 Win Result: ${result.didWin ? "WON" : "LOST"}`);
        console.log(`Win Probability: ${Number(result.winProbability) / 100}% (${result.winProbability} basis points)`);
        
        return {
            didWin: result.didWin,
            winProbability: Number(result.winProbability),
            expectedProbability: Number(expectedProbability),
            totalBlocks,
            numbersChosen,
            totalDefective
        };
    } catch (error) {
        console.error("Error calculating win chance:", error);
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
            'GET /fee': 'Get the current fee required for random number generation',
            'GET /win-chance': 'Calculate win chance with query parameters (totalBlocks, numbersChosen, totalDefective)',
            'GET /bugs-fee': 'Get the current fee required for win chance calculation'
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

// Get BugsNumberGenerator fee endpoint
app.get('/bugs-fee', async (req, res) => {
    try {
        const fee = await bugsNumberGeneratorContract.read.getWinChanceFee();
        res.json({
            success: true,
            fee: fee.toString(),
            feeEth: (Number(fee) / 1e18).toString(),
            contract: BUGS_CONTRACT_ADDRESS,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to get BugsNumberGenerator fee information',
            details: error.message
        });
    }
});

// Win chance calculation endpoint
app.get('/win-chance', async (req, res) => {
    const { totalBlocks, numbersChosen, totalDefective } = req.query;
    
    // Validate parameters
    if (!totalBlocks || !numbersChosen || !totalDefective) {
        return res.status(400).json({
            success: false,
            error: 'Missing required parameters: totalBlocks, numbersChosen, totalDefective',
            example: '/win-chance?totalBlocks=17&numbersChosen=10&totalDefective=3'
        });
    }
    
    const totalBlocksNum = parseInt(totalBlocks);
    const numbersChosenNum = parseInt(numbersChosen);
    const totalDefectiveNum = parseInt(totalDefective);
    
    if (isNaN(totalBlocksNum) || isNaN(numbersChosenNum) || isNaN(totalDefectiveNum)) {
        return res.status(400).json({
            success: false,
            error: 'All parameters must be valid numbers'
        });
    }
    
    if (totalBlocksNum <= 0 || numbersChosenNum <= 0 || totalDefectiveNum <= 0) {
        return res.status(400).json({
            success: false,
            error: 'All parameters must be positive numbers'
        });
    }
    
    if (numbersChosenNum > totalBlocksNum || totalDefectiveNum > totalBlocksNum) {
        return res.status(400).json({
            success: false,
            error: 'numbersChosen and totalDefective cannot be greater than totalBlocks'
        });
    }
    
    try {
        const result = await calculateWinChance(totalBlocksNum, numbersChosenNum, totalDefectiveNum);
        res.json({
            success: true,
            didWin: result.didWin,
            winProbability: result.winProbability,
            expectedProbability: result.expectedProbability,
            parameters: {
                totalBlocks: result.totalBlocks,
                numbersChosen: result.numbersChosen,
                totalDefective: result.totalDefective
            },
            source: 'BugsNumberGenerator Contract',
            contract: BUGS_CONTRACT_ADDRESS,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to calculate win chance',
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
    console.log(`   GET  http://localhost:${PORT}/win-chance?totalBlocks=17&numbersChosen=10&totalDefective=3`);
    console.log(`   GET  http://localhost:${PORT}/bugs-fee`);
    console.log(`   GET  http://localhost:${PORT}/health`);
    console.log(`\n🔗 GenerateNumber Contract: ${CONTRACT_ADDRESS}`);
    console.log(`🎯 BugsNumberGenerator Contract: ${BUGS_CONTRACT_ADDRESS}`);
    console.log(`⛓️  Chain: Arbitrum Sepolia`);
    console.log(`\n⚠️  Note: Each request costs gas fees!`);
});

module.exports = app;
