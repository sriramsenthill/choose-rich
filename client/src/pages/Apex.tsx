import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/UI/Button";
import { FaArrowLeft } from "react-icons/fa";
import { useBalanceStore } from "../store/balanceStore";
import { Reel } from "../components/Reel";
import { useApexGame } from "../hooks/useApexGame";
import { GameOption, Choice } from "../api/apex";
import { Modal } from "../components/UI/StatusModal";
import { toApiAmount } from "../utils/utils";

const QUICK_BET_AMOUNTS = [0.1, 0.5, 1, 2, 5, 10, 25, 50, 100];

export const Apex = () => {
  const navigate = useNavigate();
  const { getBalance } = useBalanceStore();
  const { gameState, isLoading, error, startGame, makeChoice, resetGame } =
    useApexGame();

  // UI state
  const [activeType, setActiveType] = useState<GameOption>(GameOption.Blinder);
  const [betAmount, setBetAmount] = useState(0.1);
  const selectedToken: "ETH" = "ETH";

  // Audio refs
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const slotMachineAudioRef = useRef<HTMLAudioElement | null>(null);
  const profitModalAudioRef = useRef<HTMLAudioElement | null>(null);
  const loseAudioRef = useRef<HTMLAudioElement | null>(null);
  const [audioEnabled, setAudioEnabled] = useState(false);

  // Play slot machine sound
  const playSlotMachineSound = () => {
    if (!slotMachineAudioRef.current) {
      slotMachineAudioRef.current = new Audio("/slotMachine.mp3");
      slotMachineAudioRef.current.volume = 0.6;
    }

    slotMachineAudioRef.current.currentTime = 0;
    slotMachineAudioRef.current.play().catch((error) => {
      console.log("Slot machine sound failed:", error);
    });
  };

  const handleTypeChange = (type: GameOption) => {
    setActiveType(type);
  };

  const handleBetAmountChange = (value: string) => {
    // Handle empty string case
    if (value === "") {
      setBetAmount(0);
      return;
    }

    const amount = parseFloat(value);
    console.log("change apex", amount);
    // Only update if the value is a valid positive number
    if (!isNaN(amount) && amount >= 0) {
      setBetAmount(amount);
    }
  };

  const setQuickBet = (amount: number) => {
    setBetAmount(amount);
  };


  const handleStartGame = async () => {
    if (betAmount <= 0 || isNaN(betAmount)) {
      console.log("Invalid bet amount:", betAmount);
      return;
    }

    try {
      // Convert amount to API format (18 decimals for ETH)
      const apiAmount = toApiAmount(betAmount, 18);
      console.log(
        "Starting game with betAmount:",
        betAmount,
        "apiAmount:",
        apiAmount
      );

      // Double check that apiAmount is valid
      if (apiAmount <= 0) {
        console.error("Invalid API amount calculated:", apiAmount);
        return;
      }

      // Start game via API (balance managed by backend)
      // Only Ethereum is supported for now
      await startGame(apiAmount, activeType, "ethereum");
    } catch (err) {
      console.error("Failed to start game:", err);
    }
  };

  const handleUserChoice = async (choice: Choice) => {
    if (gameState.systemRoll === null) return;

    try {
      await makeChoice(choice);
    } catch (err) {
      console.error("Failed to make choice:", err);
    }
  };

  // Handle game completion (balance managed by backend)
  const handleGameComplete = () => {
    // Balance is managed by backend
  };

  // Start a new game (reset and start immediately)
  const handleNewGame = async () => {
    resetGame();
    // Small delay to ensure reset completes
    setTimeout(() => {
      handleStartGame();
    }, 100);
  };

  // Enable audio on user interaction
  const enableAudio = async () => {
    if (!audioRef.current) {
      audioRef.current = new Audio("/apexbackground.mp3");
      audioRef.current.loop = true;
      audioRef.current.volume = 0.3;
    }

    try {
      await audioRef.current.play();
      setAudioEnabled(true);
    } catch (error) {
      console.log("Audio play failed:", error);
    }
  };

  // Handle any click to enable audio
  const handleScreenClick = () => {
    if (!audioEnabled) {
      enableAudio();
    }
  };

  // Play profit modal sound
  const playProfitModalSound = () => {
    if (!profitModalAudioRef.current) {
      profitModalAudioRef.current = new Audio("/profitModal.mp3");
      profitModalAudioRef.current.volume = 0.8;
    }

    profitModalAudioRef.current.currentTime = 0;
    profitModalAudioRef.current.play().catch((error) => {
      console.log("Profit modal sound failed:", error);
    });
  };

  // Play lose sound
  const playLoseSound = () => {
    if (!loseAudioRef.current) {
      loseAudioRef.current = new Audio("/Lose.mp3");
      loseAudioRef.current.volume = 0.7;
    }
    loseAudioRef.current.currentTime = 0;
    loseAudioRef.current.play().catch((error) => {
      console.log("Lose sound failed:", error);
    });
  };

  // Handle game completion
  useEffect(() => {
    if (gameState.gameOver && gameState.gameWon && gameState.multiplier > 0) {
      handleGameComplete();
    }
  }, [gameState.gameOver, gameState.gameWon, gameState.multiplier]);

  // Play lose sound after 3 seconds when game is lost
  useEffect(() => {
    if (gameState.gameOver && !gameState.gameWon) {
      const timer = setTimeout(() => {
        playLoseSound();
      }, 400); // 3 seconds delay

      return () => clearTimeout(timer);
    }
  }, [gameState.gameOver, gameState.gameWon]);

  // Play profit modal sound when game ends with win
  useEffect(() => {
    if (gameState.gameOver && gameState.gameWon && gameState.payoutAmount > 0) {
      // Play profit modal sound when winning
      setTimeout(() => {
        playProfitModalSound();
      }, 500); // Delay to let other sounds finish
    }
  }, [gameState.gameOver, gameState.gameWon, gameState.payoutAmount]);

  // Handle slot machine sounds for blinded mode
  useEffect(() => {
    if (gameState.isRolling && activeType === GameOption.Blinder) {
      // Play first slot machine sound immediately
      playSlotMachineSound();

      // Play second slot machine sound with slight delay (simulating two reels)
      setTimeout(() => {
        playSlotMachineSound();
      }, 500); // 500ms delay for the second reel
    }
  }, [gameState.isRolling, activeType]);

  // Audio cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      if (slotMachineAudioRef.current) {
        slotMachineAudioRef.current.pause();
        slotMachineAudioRef.current.currentTime = 0;
      }
      if (profitModalAudioRef.current) {
        profitModalAudioRef.current.pause();
        profitModalAudioRef.current.currentTime = 0;
      }
      if (loseAudioRef.current) {
        loseAudioRef.current.pause();
        loseAudioRef.current.currentTime = 0;
      }
    };
  }, []);

  return (
    <div
      className="flex flex-col lg:flex-row h-full w-full font-audiowide"
      onClick={handleScreenClick}
    >
      {/* Left Side - Betting Interface (Desktop) / Bottom (Mobile) */}
      <div
        className="w-full lg:w-1/4 p-3 lg:p-4 overflow-y-auto bg-[#211745] rounded-2xl order-2 lg:order-1"
        style={{
          border: "2px solid",
          borderImageSource:
            "linear-gradient(205.26deg, rgba(255, 255, 255, 0.5) -6.2%, rgba(255, 255, 255, 0.25) 100%)",
        }}
      >
        {/* Header */}
        <div className="mb-4">
          <div className="flex items-center justify-start gap-4 mb-3">
            <button
              onClick={() => navigate("/")}
              className="px-3 py-2 text-white rounded-lg hover:bg-white/10 cursor-pointer transition-colors text-sm"
            >
              <FaArrowLeft />
            </button>
            <h1 className="text-xl lg:text-2xl font-semibold font-ethnocentric">
              APEX
            </h1>
          </div>
        </div>

        {/* Betting Interface */}
        <div className="space-y-4 lg:space-y-6">
          {/* Token Selection */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-white font-ethnocentric">
              Token
            </label>
            <div className="flex items-center justify-between gap-2 bg-primary/20 p-1 rounded-lg">
              <span className="px-3 py-2 rounded-lg w-full text-center text-sm bg-primary">
                ETH
              </span>
            </div>
          </div>

          {/* Game Type Switch */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-white font-ethnocentric">
              Game Type
            </label>
            <div className="flex items-center justify-between gap-2 bg-primary/20 p-1 rounded-lg">
              <button
                className={`px-3 py-2 rounded-lg w-full cursor-pointer transition-colors text-sm ${
                  activeType === GameOption.Blinder
                    ? "bg-primary"
                    : "hover:bg-white/10"
                }`}
                onClick={() => handleTypeChange(GameOption.Blinder)}
                disabled={gameState.isPlaying && !gameState.gameOver}
              >
                Blinded
              </button>
              <button
                className={`px-3 py-2 rounded-lg w-full cursor-pointer transition-colors text-sm ${
                  activeType === GameOption.NonBlinder
                    ? "bg-primary"
                    : "hover:bg-white/10"
                }`}
                onClick={() => handleTypeChange(GameOption.NonBlinder)}
                disabled={gameState.isPlaying && !gameState.gameOver}
              >
                Non Blinded
              </button>
            </div>
          </div>

          {/* Bet Amount Section */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-white font-ethnocentric">
              Bet Amount
            </label>
            <div className="flex items-center gap-2">
              <div className="flex-1 relative">
                <input
                  type="number"
                  value={betAmount}
                  onChange={(e) => handleBetAmountChange(e.target.value)}
                  disabled={gameState.isPlaying && !gameState.gameOver}
                  className={`w-full px-3 py-2 border border-borders rounded-xl focus:ring-0 focus:outline-1 focus:outline-primary/20 focus:shadow-lg focus:shadow-primary/20 focus:border-transparent text-sm ${
                    gameState.isPlaying && !gameState.gameOver
                      ? "opacity-50 cursor-not-allowed"
                      : ""
                  }`}
                  placeholder="0.00000000"
                  step="0.00000001"
                  min="0"
                />
              </div>
              <img
                src={"https://garden.imgix.net/token-images/ethereum.svg"
                }
                alt={selectedToken}
                className="w-6 h-6"
              />
            </div>

            {/* Quick Bet Amounts */}
            <div className="flex flex-wrap gap-1">
              {QUICK_BET_AMOUNTS.map((amount) => (
                <button
                  key={amount}
                  onClick={() => setQuickBet(amount)}
                  disabled={gameState.isPlaying && !gameState.gameOver}
                  className={`px-2 py-1 rounded text-xs ${
                    gameState.isPlaying && !gameState.gameOver
                      ? "opacity-50 cursor-not-allowed"
                      : betAmount === amount
                      ? "bg-primary text-white"
                      : "bg-primary/20 hover:bg-primary/50"
                  }`}
                >
                  ${amount}
                </button>
              ))}
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="text-red-400 text-sm bg-red-500/20 p-2 rounded-lg">
              {error}
            </div>
          )}

          {/* Game Action Button */}
          {!gameState.isPlaying || gameState.gameOver ? (
            <Button
              size="lg"
              variant="primary"
              onClick={gameState.gameOver ? handleNewGame : handleStartGame}
              disabled={
                betAmount <= 0 ||
                betAmount > getBalance("ETH") ||
                isLoading
              }
            >
              {isLoading
                ? "LOADING..."
                : gameState.gameOver
                ? "PLAY AGAIN"
                : "BET"}
            </Button>
          ) : activeType === GameOption.Blinder ? (
            <div className="text-center text-white/80 text-sm py-4">
              Both rolls are rolling automatically...
            </div>
          ) : (
            <div className="space-y-2 flex flex-col">
              <div className="text-center text-white/80 text-sm">
                Choose your strategy:
              </div>
              <div className="flex gap-2 flex-col">
                <Button
                  size="lg"
                  variant="primary"
                  onClick={() => handleUserChoice(Choice.High)}
                  disabled={gameState.isRolling || isLoading}
                  className="flex-1 py-2 rounded-lg font-semibold text-sm"
                >
                  HIGH{" "}
                  {gameState.gameData?.probability_high && (
                    <div className="text-xs opacity-80 mt-1">
                      {(gameState.gameData.probability_high * 100).toFixed(1)}%
                    </div>
                  )}
                </Button>
                <Button
                  size="lg"
                  variant="primary"
                  onClick={() => handleUserChoice(Choice.Low)}
                  disabled={gameState.isRolling || isLoading}
                  className="flex-1 py-2 rounded-lg font-semibold text-sm"
                >
                  LOW{" "}
                  {gameState.gameData?.probability_low && (
                    <div className="text-xs opacity-80 mt-1">
                      {(gameState.gameData.probability_low * 100).toFixed(1)}%
                    </div>
                  )}
                </Button>
                <Button
                  size="lg"
                  variant="primary"
                  onClick={() => handleUserChoice(Choice.Equal)}
                  disabled={gameState.isRolling || isLoading}
                  className="flex-1 py-2 rounded-lg font-semibold text-sm"
                >
                  EQUAL{" "}
                  {gameState.gameData?.probability_equal && (
                    <div className="text-xs opacity-80 mt-1">
                      {(gameState.gameData.probability_equal * 100).toFixed(1)}%
                    </div>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right Side - Game Interface (Desktop) / Top (Mobile) */}
      <div className="flex w-full lg:w-3/4 items-center justify-center p-4 rounded-r-2xl relative order-1 lg:order-2">
        {gameState.gameOver && (
          <Modal
            type={gameState.gameWon ? "profit" : "loss"}
            multiplier={gameState.multiplier.toString()}
            amount={gameState.payoutAmount.toFixed(8)}
          />
        )}
        <div className="flex flex-col items-center space-y-2 lg:space-y-8 w-full max-w-2xl">
          {/* Game Title */}
          <div className="text-center">
            <h2 className="text-lg lg:text-3xl font-bold text-white mb-1 lg:mb-2 font-ethnocentric">
              APEX ROLLS
            </h2>
            <p className="text-white/60 text-xs lg:text-base">
              {activeType === GameOption.Blinder
                ? "Both rolls simultaneously - Higher number wins!"
                : "System rolls first, then choose HIGH or LOW for your roll"}
            </p>
          </div>

          {/* Slot Rolls */}
          <div className="flex items-center justify-center space-x-3 lg:space-x-12">
            {/* User Roll */}
            <Reel
              value={gameState.userRoll}
              isRolling={
                gameState.isRolling &&
                (activeType === GameOption.Blinder ||
                  gameState.userChoice !== null)
              }
              label="YOUR ROLL"
              isUser={true}
            />

            {/* VS Divider */}
            <div className="text-lg lg:text-2xl font-bold text-white/40">
              VS
            </div>

            {/* System Roll */}
            <Reel
              value={gameState.systemRoll}
              isRolling={
                gameState.isRolling && activeType === GameOption.Blinder
              }
              label="SYSTEM ROLL"
              isUser={false}
            />
          </div>

          {/* Non-blinded choice display */}
          {activeType === GameOption.NonBlinder &&
            gameState.systemRoll !== null &&
            !gameState.gameOver && (
              <div className="text-center text-white/80">
                <p>
                  System rolled:{" "}
                  <span className="font-bold text-lg lg:text-2xl">
                    {gameState.systemRoll}
                  </span>
                </p>
                <p className="text-xs lg:text-sm mt-1 lg:mt-2">
                  Choose HIGH or LOW for your roll
                </p>
              </div>
            )}
        </div>
      </div>
    </div>
  );
};
