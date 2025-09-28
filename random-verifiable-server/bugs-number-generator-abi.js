const IBugsNumberGeneratorAbi = [
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "_entropy",
          "type": "address"
        },
        {
          "internalType": "address",
          "name": "_entropyProvider",
          "type": "address"
        }
      ],
      "stateMutability": "nonpayable",
      "type": "constructor"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": false,
          "internalType": "uint64",
          "name": "sequenceNumber",
          "type": "uint64"
        },
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "totalBlocks",
          "type": "uint256"
        },
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "numbersChosen",
          "type": "uint256"
        },
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "totalDefective",
          "type": "uint256"
        }
      ],
      "name": "WinChanceRequest",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": false,
          "internalType": "uint64",
          "name": "sequenceNumber",
          "type": "uint64"
        },
        {
          "indexed": false,
          "internalType": "bool",
          "name": "didWin",
          "type": "bool"
        },
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "winProbability",
          "type": "uint256"
        }
      ],
      "name": "WinResult",
      "type": "event"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "totalBlocks",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "numbersChosen",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "totalDefective",
          "type": "uint256"
        }
      ],
      "name": "calculateWinProbability",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "pure",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "getDefaultProviderGasLimit",
      "outputs": [
        {
          "internalType": "uint32",
          "name": "",
          "type": "uint32"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint64",
          "name": "sequenceNumber",
          "type": "uint64"
        }
      ],
      "name": "getRequestStatus",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "totalBlocks",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "numbersChosen",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "totalDefective",
          "type": "uint256"
        },
        {
          "internalType": "bool",
          "name": "isComplete",
          "type": "bool"
        },
        {
          "internalType": "bool",
          "name": "didWin",
          "type": "bool"
        },
        {
          "internalType": "uint256",
          "name": "winProbability",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint64",
          "name": "sequenceNumber",
          "type": "uint64"
        }
      ],
      "name": "getWinResult",
      "outputs": [
        {
          "internalType": "bool",
          "name": "didWin",
          "type": "bool"
        },
        {
          "internalType": "uint256",
          "name": "winProbability",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "getWinChanceFee",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint64",
          "name": "",
          "type": "uint64"
        }
      ],
      "name": "requests",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "totalBlocks",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "numbersChosen",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "totalDefective",
          "type": "uint256"
        },
        {
          "internalType": "bool",
          "name": "isComplete",
          "type": "bool"
        },
        {
          "internalType": "bool",
          "name": "didWin",
          "type": "bool"
        },
        {
          "internalType": "uint256",
          "name": "winProbability",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "totalBlocks",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "numbersChosen",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "totalDefective",
          "type": "uint256"
        }
      ],
      "name": "requestWinChance",
      "outputs": [],
      "stateMutability": "payable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "totalBlocks",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "numbersChosen",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "totalDefective",
          "type": "uint256"
        },
        {
          "internalType": "uint32",
          "name": "gasLimit",
          "type": "uint32"
        }
      ],
      "name": "requestWinChanceWithCustomGasLimit",
      "outputs": [],
      "stateMutability": "payable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "provider",
          "type": "address"
        },
        {
          "internalType": "uint256",
          "name": "totalBlocks",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "numbersChosen",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "totalDefective",
          "type": "uint256"
        },
        {
          "internalType": "uint32",
          "name": "gasLimit",
          "type": "uint32"
        }
      ],
      "name": "requestWinChanceWithCustomProviderAndGasLimit",
      "outputs": [],
      "stateMutability": "payable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "provider",
          "type": "address"
        },
        {
          "internalType": "uint256",
          "name": "totalBlocks",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "numbersChosen",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "totalDefective",
          "type": "uint256"
        },
        {
          "internalType": "uint32",
          "name": "gasLimit",
          "type": "uint32"
        },
        {
          "internalType": "bytes32",
          "name": "userContribution",
          "type": "bytes32"
        }
      ],
      "name": "requestWinChanceWithCustomProviderAndGasLimitAndUserContribution",
      "outputs": [],
      "stateMutability": "payable",
      "type": "function"
    },
    {
      "stateMutability": "payable",
      "type": "receive"
    }
  ];
  
  module.exports = {
      IBugsNumberGeneratorAbi
  };