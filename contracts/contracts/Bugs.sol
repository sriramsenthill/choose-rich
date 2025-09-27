// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.0;

// Import the entropy SDK in order to interact with the entropy contracts
import "@pythnetwork/entropy-sdk-solidity/IEntropyV2.sol";
import "@pythnetwork/entropy-sdk-solidity/IEntropyConsumer.sol";
// Import the EntropyStructsV2 contract to get the ProviderInfo struct
import "@pythnetwork/entropy-sdk-solidity/EntropyStructsV2.sol";

library BugsNumberGeneratorErrors {
    error IncorrectSender();
    error InsufficientFee();
    error InvalidRange();
    error InvalidParameters();
    error RequestNotFound();
}

/// Optimized contract using Pyth Entropy to calculate win probability based on parameters.
/// Instead of generating multiple numbers (costly), this contract calculates the probability
/// of winning based on total blocks, numbers chosen, and total defective numbers.
/// Returns true/false based on calculated win chance.
///
/// The BugsNumberGenerator contract implements the IEntropyConsumer interface imported from the Solidity SDK.
/// The interface helps in integrating with Entropy correctly.
contract BugsNumberGenerator is IEntropyConsumer {
    // Event emitted when a win chance calculation request is made
    event WinChanceRequest(uint64 sequenceNumber, uint256 totalBlocks, uint256 numbersChosen, uint256 totalDefective);
    
    // Event emitted when the win result is calculated
    event WinResult(uint64 sequenceNumber, bool didWin, uint256 winProbability);

    // Request structure to track win chance calculation
    struct WinChanceRequestData {
        uint256 totalBlocks;
        uint256 numbersChosen;
        uint256 totalDefective;
        bool isComplete;
        bool didWin;
        uint256 winProbability;
    }

    // Contracts using Pyth Entropy should import the solidity SDK and then store both the Entropy contract
    // and a specific entropy provider to use for requests. Each provider commits to a sequence of random numbers.
    // Providers are then responsible for fulfilling a request on chain by revealing their random number.
    // Users should choose a reliable provider who they trust to uphold these commitments.
    IEntropyV2 private entropy;
    address private entropyProvider;

    // Mapping to track win chance requests
    mapping(uint64 => WinChanceRequestData) public requests;

    constructor(address _entropy, address _entropyProvider) {
        entropy = IEntropyV2(_entropy);
        entropyProvider = _entropyProvider;
    }

    // Request to calculate win chance based on parameters
    function requestWinChance(uint256 totalBlocks, uint256 numbersChosen, uint256 totalDefective) external payable {
        // Validate inputs
        if (totalBlocks == 0 || numbersChosen == 0 || totalDefective == 0) {
            revert BugsNumberGeneratorErrors.InvalidParameters();
        }
        if (numbersChosen > totalBlocks || totalDefective > totalBlocks) {
            revert BugsNumberGeneratorErrors.InvalidParameters();
        }

        // The entropy protocol requires the caller to pay a fee (in native gas tokens) per requested random number.
        // This fee can either be paid by the contract itself or passed on to the end user.
        // This implementation of the requestWinChance method passes on the fee to the end user.
        uint256 fee = entropy.getFeeV2();
        if (msg.value < fee) {
            revert BugsNumberGeneratorErrors.InsufficientFee();
        }

        // Request the random number from the Entropy protocol. The call returns a sequence number that uniquely
        // identifies the generated random number. Callers can use this sequence number to match which request
        // is being revealed in the next stage of the protocol.
        // This requestV2 function will trust the provider to draw a random number. 
        uint64 sequenceNumber = entropy.requestV2{value: fee}();

        // Initialize the request
        requests[sequenceNumber] = WinChanceRequestData({
            totalBlocks: totalBlocks,
            numbersChosen: numbersChosen,
            totalDefective: totalDefective,
            isComplete: false,
            didWin: false,
            winProbability: 0
        });

        emit WinChanceRequest(sequenceNumber, totalBlocks, numbersChosen, totalDefective);
    }

    // Request to calculate win chance with a custom gas limit
    function requestWinChanceWithCustomGasLimit(uint256 totalBlocks, uint256 numbersChosen, uint256 totalDefective, uint32 gasLimit) external payable {
        if (totalBlocks == 0 || numbersChosen == 0 || totalDefective == 0) {
            revert BugsNumberGeneratorErrors.InvalidParameters();
        }
        if (numbersChosen > totalBlocks || totalDefective > totalBlocks) {
            revert BugsNumberGeneratorErrors.InvalidParameters();
        }

        uint256 fee = entropy.getFeeV2(gasLimit);
        if (msg.value < fee) {
            revert BugsNumberGeneratorErrors.InsufficientFee();
        }

        uint64 sequenceNumber = entropy.requestV2{value: fee}(gasLimit);

        requests[sequenceNumber] = WinChanceRequestData({
            totalBlocks: totalBlocks,
            numbersChosen: numbersChosen,
            totalDefective: totalDefective,
            isComplete: false,
            didWin: false,
            winProbability: 0
        });

        emit WinChanceRequest(sequenceNumber, totalBlocks, numbersChosen, totalDefective);
    }

    // Request to calculate win chance with a custom provider and custom gas limit
    function requestWinChanceWithCustomProviderAndGasLimit(address provider, uint256 totalBlocks, uint256 numbersChosen, uint256 totalDefective, uint32 gasLimit) external payable {
        if (totalBlocks == 0 || numbersChosen == 0 || totalDefective == 0) {
            revert BugsNumberGeneratorErrors.InvalidParameters();
        }
        if (numbersChosen > totalBlocks || totalDefective > totalBlocks) {
            revert BugsNumberGeneratorErrors.InvalidParameters();
        }

        uint256 fee = entropy.getFeeV2(provider, gasLimit);
        if (msg.value < fee) {
            revert BugsNumberGeneratorErrors.InsufficientFee();
        }

        uint64 sequenceNumber = entropy.requestV2{value: fee}(provider, gasLimit);

        requests[sequenceNumber] = WinChanceRequestData({
            totalBlocks: totalBlocks,
            numbersChosen: numbersChosen,
            totalDefective: totalDefective,
            isComplete: false,
            didWin: false,
            winProbability: 0
        });

        emit WinChanceRequest(sequenceNumber, totalBlocks, numbersChosen, totalDefective);
    }

    // Request to calculate win chance with a custom provider, custom gas limit and userContribution
    function requestWinChanceWithCustomProviderAndGasLimitAndUserContribution(
        address provider, 
        uint256 totalBlocks, 
        uint256 numbersChosen, 
        uint256 totalDefective, 
        uint32 gasLimit, 
        bytes32 userContribution
    ) external payable {
        if (totalBlocks == 0 || numbersChosen == 0 || totalDefective == 0) {
            revert BugsNumberGeneratorErrors.InvalidParameters();
        }
        if (numbersChosen > totalBlocks || totalDefective > totalBlocks) {
            revert BugsNumberGeneratorErrors.InvalidParameters();
        }

        uint256 fee = entropy.getFeeV2(provider, gasLimit);
        if (msg.value < fee) {
            revert BugsNumberGeneratorErrors.InsufficientFee();
        }

        uint64 sequenceNumber = entropy.requestV2{value: fee}(provider, userContribution, gasLimit);

        requests[sequenceNumber] = WinChanceRequestData({
            totalBlocks: totalBlocks,
            numbersChosen: numbersChosen,
            totalDefective: totalDefective,
            isComplete: false,
            didWin: false,
            winProbability: 0
        });

        emit WinChanceRequest(sequenceNumber, totalBlocks, numbersChosen, totalDefective);
    }

    // Get the default gas limit for the default provider
    function getDefaultProviderGasLimit() public view returns (uint32) {
        EntropyStructsV2.ProviderInfo memory providerInfo = entropy.getProviderInfoV2(entropy.getDefaultProvider());
        return providerInfo.defaultGasLimit;
    }

    // This method is required by the IEntropyConsumer interface.
    // It is called by the entropy contract when a random number is generated.
    function entropyCallback(
        uint64 sequenceNumber,
        // If your app uses multiple providers, you can use this argument
        // to distinguish which one is calling the app back. This app only
        // uses one provider so this argument is not used.
        address,
        bytes32 randomNumber
    ) internal override {
        WinChanceRequestData storage request = requests[sequenceNumber];
        
        // Check if request exists
        if (request.totalBlocks == 0) {
            revert BugsNumberGeneratorErrors.RequestNotFound();
        }

        // Check if calculation is already complete
        if (request.isComplete) {
            return;
        }

        // Calculate win probability based on the parameters
        // Formula: (numbersChosen / totalBlocks) * (totalDefective / totalBlocks)
        // This represents the probability of choosing a defective number
        uint256 winProbability = (request.numbersChosen * request.totalDefective * 10000) / (request.totalBlocks * request.totalBlocks);
        
        // Use the random number to determine if the user wins
        // Convert random number to percentage (0-10000, where 10000 = 100%)
        uint256 randomPercentage = (uint256(randomNumber) % 10000);
        
        // Determine if user wins based on probability
        bool didWin = randomPercentage < winProbability;
        
        // Update request with results
        request.winProbability = winProbability;
        request.didWin = didWin;
        request.isComplete = true;
        
        emit WinResult(sequenceNumber, didWin, winProbability);
    }

    // This method is required by the IEntropyConsumer interface.
    // It returns the address of the entropy contract which will call the callback.
    function getEntropy() internal view override returns (address) {
        return address(entropy);
    }

    // Get the fee for calculating win chance
    function getWinChanceFee() public view returns (uint256) {
        return entropy.getFeeV2();
    }

    // Get the current state of a win chance request
    function getRequestStatus(uint64 sequenceNumber) public view returns (
        uint256 totalBlocks,
        uint256 numbersChosen,
        uint256 totalDefective,
        bool isComplete,
        bool didWin,
        uint256 winProbability
    ) {
        WinChanceRequestData memory request = requests[sequenceNumber];
        return (
            request.totalBlocks,
            request.numbersChosen,
            request.totalDefective,
            request.isComplete,
            request.didWin,
            request.winProbability
        );
    }

    // Get the win result for a completed request
    function getWinResult(uint64 sequenceNumber) public view returns (bool didWin, uint256 winProbability) {
        WinChanceRequestData memory request = requests[sequenceNumber];
        if (!request.isComplete) {
            revert BugsNumberGeneratorErrors.RequestNotFound();
        }
        return (request.didWin, request.winProbability);
    }

    // Calculate win probability without making a request (for estimation)
    function calculateWinProbability(uint256 totalBlocks, uint256 numbersChosen, uint256 totalDefective) public pure returns (uint256) {
        if (totalBlocks == 0 || numbersChosen == 0 || totalDefective == 0) {
            return 0;
        }
        if (numbersChosen > totalBlocks || totalDefective > totalBlocks) {
            return 0;
        }
        
        // Formula: (numbersChosen / totalBlocks) * (totalDefective / totalBlocks) * 10000
        // Returns probability as basis points (0-10000, where 10000 = 100%)
        return (numbersChosen * totalDefective * 10000) / (totalBlocks * totalBlocks);
    }

    receive() external payable {}
}