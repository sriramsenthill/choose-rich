import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/UI/Button";
import { FaArrowLeft } from "react-icons/fa";
import { useMinesGame } from "../hooks/useMinesGame";
import { useBalanceStore } from "../store/balanceStore";
import { Modal } from "../components/UI/StatusModal";
import { Bug } from "../components/UI/BugAnimation";
import { Flower } from "../components/UI/FlowerAnimation";
import { toApiAmount } from "../utils/utils";

interface MineBoxProps {
  isMine: boolean;
  isRevealed: boolean;
  onClick: () => void;
  isGameOver: boolean;
  isPlaying: boolean;
  isSelected: boolean;
  onSoundEffect: (soundType: "mineOpen" | "bomb") => void;
}

interface MinesGridProps {
  gridSize: number;
  isPlaying: boolean;
  gameOver: boolean;
  gameWon: boolean;
  cashoutTriggered: boolean;
  onCashoutReveal: () => void;
  onMakeMove: (block: number) => void;
  revealedBlocks: Set<number>;
  bombBlocks: number[];
  selectedBlocks: Set<number>;
  onSoundEffect: (soundType: "mineOpen" | "bomb") => void;
}

interface GridCell {
  id: number;
  isMine: boolean;
  isRevealed: boolean;
}

const MineBox = ({
  isMine,
  isRevealed,
  onClick,
  isGameOver,
  isPlaying,
  isSelected,
  onSoundEffect,
}: MineBoxProps) => {
  const [isAnimating, setIsAnimating] = useState(false);
  const [hasPlayedResultSound, setHasPlayedResultSound] = useState(false);

  const handleClick = () => {
    if (!isRevealed && !isGameOver && isPlaying) {
      setIsAnimating(true);
      // Play mine open sound
      onSoundEffect("mineOpen");
      setTimeout(() => {
        setIsAnimating(false);
        onClick();
      }, 150);
    }
  };

  // Play result sound when mine gets revealed
  useEffect(() => {
    if (isRevealed && !hasPlayedResultSound) {
      setHasPlayedResultSound(true);
      setTimeout(() => {
        if (isMine) {
          onSoundEffect("bomb");
        }
        // No sound for diamonds
      }, 200);
    }
  }, [isRevealed, isMine, hasPlayedResultSound, onSoundEffect]);

  const getBoxContent = () => {
    if (!isRevealed) return "";
    if (isMine)
      return (
        <div className="pt-3">
          <Bug width={120} height={120} speed={1} />
        </div>
      );
    return <Flower width={75} height={75} speed={1} />;
  };

  const getBoxClass = () => {
    let baseClass =
      "w-full h-full flex items-center justify-center font-bold transition-all duration-200 transform rounded-lg shadow-md text-sm sm:text-base md:text-lg lg:text-xl";

    // Add cursor and hover effects based on playing state
    if (isPlaying && !isRevealed && !isGameOver) {
      baseClass += " cursor-pointer hover:scale-105 active:scale-95";
    } else {
      baseClass += " cursor-default";
    }

    if (isAnimating) {
      baseClass += " scale-110 rotate-2";
    }

    // Add opacity based on selection state
    if (isRevealed && !isSelected) {
      baseClass += " opacity-60";
    }

    if (isRevealed) {
      if (isMine) {
        return `${baseClass} bg-red-500 text-white shadow-red-500/50`;
      }
      return `${baseClass} bg-primary text-white shadow-primary/50`;
    }

    // Unrevealed blocks use stone.png background
    return `${baseClass} rounded-lg hover:shadow-white/10`;
  };

  const getBoxStyle = () => {
    if (!isRevealed) {
      return {
        backgroundImage: "url('/stone.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      };
    }
    return {};
  };

  return (
    <button
      className={getBoxClass()}
      style={getBoxStyle()}
      onClick={handleClick}
    >
      {getBoxContent()}
    </button>
  );
};

const MinesGrid = ({
  gridSize,
  isPlaying,
  gameOver: propGameOver,
  gameWon: propGameWon,
  onMakeMove,
  revealedBlocks,
  bombBlocks,
  selectedBlocks,
  onSoundEffect,
}: MinesGridProps) => {
  const totalCells = gridSize * gridSize;

  // Generate grid directly from props instead of using state
  const generateGrid = (): GridCell[] => {
    const newGrid: GridCell[] = [];
    for (let i = 0; i < totalCells; i++) {
      newGrid.push({
        id: i + 1, // API uses 1-based indexing
        isMine: bombBlocks ? bombBlocks.includes(i + 1) : false,
        isRevealed: revealedBlocks.has(i + 1),
      });
    }
    return newGrid;
  };

  const grid = generateGrid();

  // Reveal cell - this will call the API
  const revealCell = (id: number) => {
    if (
      propGameOver ||
      propGameWon ||
      grid.find((cell) => cell.id === id)?.isRevealed
    ) {
      return;
    }

    onMakeMove(id);
  };

  // Handle cashout reveal - no longer needed since grid is generated from props

  return (
    <div className="flex flex-col items-center space-y-4 w-fit bg-[#211745E5] rounded-3xl">
      <div className="w-64 h-64 sm:w-80 sm:h-80 lg:w-[36rem] lg:h-[36rem] rounded-lg shadow-lg p-3 lg:p-6 flex items-center justify-center">
        <div
          className="grid gap-0.5 lg:gap-1 w-full h-full"
          style={{
            gridTemplateColumns: `repeat(${gridSize}, 1fr)`,
            gridTemplateRows: `repeat(${gridSize}, 1fr)`,
          }}
        >
          {grid.map((cell) => (
            <MineBox
              key={cell.id}
              isMine={cell.isMine}
              isRevealed={cell.isRevealed}
              onClick={() => revealCell(cell.id)}
              isGameOver={propGameOver}
              isPlaying={isPlaying}
              isSelected={selectedBlocks.has(cell.id)}
              onSoundEffect={onSoundEffect}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

const MINE_OPTIONS = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22,
  23, 24,
];
const GRID_SIZE_OPTIONS = [3, 4, 5, 6, 7, 8, 9, 10];
const QUICK_BET_AMOUNTS = [
  0.00001, 0.0001, 0.001, 0.01, 0.1, 0.5, 1, 2, 5, 10, 25, 50, 100,
];

export const Mines = () => {
  const navigate = useNavigate();
  const { getBalance } = useBalanceStore();
  const [selectedBlocks, setSelectedBlocks] = useState<Set<number>>(new Set());
  const selectedToken: "ETH" = "ETH";
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mineOpenAudioRef = useRef<HTMLAudioElement | null>(null);
  const bugsSoundAudioRef = useRef<HTMLAudioElement | null>(null);
  const profitModalAudioRef = useRef<HTMLAudioElement | null>(null);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const {
    gameState,
    betSettings,
    isLoading,
    revealedBlocks,
    bombBlocks,
    updateBetSettings,
    startGame,
    makeMove,
    cashout,
  } = useMinesGame();

  // Handlers for the API integration

  const handleBetAmountChange = (value: string) => {
    const amount = parseFloat(value);
    console.log("change", amount);
    updateBetSettings({ betAmount: amount });
  };

  const handleMinesChange = (mines: number) => {
    updateBetSettings({ minesCount: mines });
  };

  const setQuickBet = (amount: number) => {
    updateBetSettings({ betAmount: amount });
  };

  // Calculate display amount based on chain
  const getDisplayAmount = (amount: number) => {
    return amount / Math.pow(10, 18);
  };

  // Handle start game with button click sound
  const handleStartGame = () => {
    const apiAmount = toApiAmount(betSettings.betAmount, 18);
    startGame("ethereum", apiAmount);
  };

  // Handle cashout with button click sound
  const handleCashout = () => {
    cashout();
  };

  // const handleReveal = (revealedCount: number) => {
  //   // This will be handled by the API response
  // };

  // const handleGameEnd = (won: boolean, amount: number) => {
  //   // This will be handled by the API response
  // };

  const handleCashoutReveal = () => {
    // This will be handled by the API response
  };

  const handleMakeMove = (block: number) => {
    // Track selected blocks
    setSelectedBlocks((prev) => new Set(prev).add(block));
    // Make the move
    makeMove(block);
  };

  // Enable audio on user interaction
  const enableAudio = async () => {
    if (!audioRef.current) {
      audioRef.current = new Audio("/minesbackground.mp3");
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

  // Function to play sound effects
  const playSoundEffect = (soundType: "mineOpen" | "bomb") => {
    console.log(`Playing sound: ${soundType}`); // Debug log
    let audioRef: React.MutableRefObject<HTMLAudioElement | null>;

    switch (soundType) {
      case "mineOpen":
        audioRef = mineOpenAudioRef;
        break;
      case "bomb":
        audioRef = bugsSoundAudioRef;
        break;
    }

    if (!audioRef.current) {
      const soundFile =
        soundType === "mineOpen" ? "/rockClick.mp3" : "/bugsSound.mp3";
      console.log(`Loading sound file: ${soundFile}`); // Debug log
      audioRef.current = new Audio(soundFile);
      audioRef.current.volume = 0.5; // Normal volume for other sounds
    }

    // Play the sound
    audioRef.current.currentTime = 0; // Reset to beginning
    audioRef.current.play().catch((error) => {
      console.log(`Audio play failed for ${soundType}:`, error);
    });
  };

  // Reset selected blocks when starting a new game
  useEffect(() => {
    if (!gameState.isPlaying && !gameState.gameOver && !gameState.gameWon) {
      setSelectedBlocks(new Set());
    }
  }, [gameState.isPlaying, gameState.gameOver, gameState.gameWon]);

  // Also reset selected blocks when game starts
  useEffect(() => {
    if (gameState.isPlaying && gameState.revealedCount === 0) {
      setSelectedBlocks(new Set());
    }
  }, [gameState.isPlaying, gameState.revealedCount]);

  // Play sound effects when mines are revealed
  useEffect(() => {
    if (gameState.gameOver || gameState.gameWon) {
      // Check if we hit a bomb
      if (gameState.gameOver && !gameState.gameWon) {
        // Play bomb sound when game ends due to hitting a mine
        setTimeout(() => {
          playSoundEffect("bomb");
        }, 200); // Small delay to let the mine open sound finish
      }
      // No sound for winning (diamonds)
    }
  }, [gameState.gameOver, gameState.gameWon]);

  // Play profit modal sound when game ends with win or cashout
  useEffect(() => {
    if (
      (gameState.gameWon || gameState.cashoutTriggered) &&
      gameState.payoutAmount > 0
    ) {
      // Play profit modal sound when winning or cashing out
      setTimeout(() => {
        playProfitModalSound();
      }, 500); // Delay to let other sounds finish
    }
  }, [gameState.gameWon, gameState.cashoutTriggered, gameState.payoutAmount]);

  // Handle background music
  useEffect(() => {
    if (audioEnabled && audioRef.current) {
      // Play music when audio is enabled
      const playMusic = async () => {
        try {
          if (audioRef.current) {
            await audioRef.current.play();
          }
        } catch (error) {
          console.log("Audio play failed:", error);
        }
      };

      playMusic();
    }

    // Cleanup: pause music when component unmounts
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      if (profitModalAudioRef.current) {
        profitModalAudioRef.current.pause();
        profitModalAudioRef.current.currentTime = 0;
      }
    };
  }, [audioEnabled]);

  return (
    <div
      className="flex flex-col lg:flex-row h-full w-full"
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
              BUGS
            </h1>
          </div>
        </div>

        {/* Betting Interface */}
        <div className="space-y-4 lg:space-y-6 font-audiowide">
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

          {/* Bet Amount Section */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium font-audiowide">
              Bet Amount
            </label>
            <div className="flex items-center gap-2">
              <div className="flex-1 relative">
                <input
                  type="number"
                  value={betSettings.betAmount}
                  onChange={(e) => handleBetAmountChange(e.target.value)}
                  disabled={gameState.isPlaying}
                  className={`w-full font-ethnocentric px-3 py-2 border border-borders rounded-xl focus:ring-0 focus:outline-1 focus:outline-primary/20 focus:shadow-lg focus:shadow-primary/20 focus:border-transparent text-sm ${
                    gameState.isPlaying ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                  placeholder="0.00000000"
                  step="0.00000001"
                  min="0"
                />
              </div>

              <img
                src="https://garden.imgix.net/token-images/ethereum.svg"
                alt="ETH"
                className="w-6 h-6"
              />
            </div>

            {/* Quick Bet Amounts */}
            <div className="flex flex-wrap gap-1">
              {QUICK_BET_AMOUNTS.map((amount) => (
                <button
                  key={amount}
                  onClick={() => setQuickBet(amount)}
                  disabled={gameState.isPlaying}
                  className={`px-2 py-1 rounded text-xs ${
                    gameState.isPlaying
                      ? "opacity-50 cursor-not-allowed"
                      : betSettings.betAmount === amount
                      ? "bg-primary/40 text-white"
                      : "bg-white/10 hover:bg-primary/50"
                  }`}
                >
                  ${amount}
                </button>
              ))}
            </div>
          </div>

          {/* Grid Size Selection */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-white font-ethnocentric">
              Grid Size
            </label>
            <div className="relative">
              <select
                value={betSettings.gridSize}
                onChange={(e) =>
                  updateBetSettings({ gridSize: parseInt(e.target.value) })
                }
                disabled={gameState.isPlaying}
                className={`w-full px-3 py-2 font-ethnocentric border border-borders rounded-lg focus:ring-1 focus:ring-primary/20 focus:outline-0 focus:border-transparent appearance-none text-sm ${
                  gameState.isPlaying ? "opacity-50 cursor-not-allowed" : ""
                }`}
              >
                {GRID_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>
                    {size}×{size} Grid
                  </option>
                ))}
              </select>
              <div className="absolute right-2 top-1/2 transform -translate-y-1/2 pointer-events-none text-sm">
                ▼
              </div>
            </div>
          </div>

          {/* Mines Selection */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-white font-ethnocentric">
              Bugs
            </label>
            <div className="relative">
              <select
                value={betSettings.minesCount}
                onChange={(e) => handleMinesChange(parseInt(e.target.value))}
                disabled={gameState.isPlaying}
                className={`w-full px-3 py-2 border font-ethnocentric border-borders rounded-lg focus:ring-1 focus:ring-primary/20 focus:outline-0 focus:border-transparent appearance-none text-sm ${
                  gameState.isPlaying ? "opacity-50 cursor-not-allowed" : ""
                }`}
              >
                {MINE_OPTIONS.filter(
                  (count) => count < betSettings.gridSize * betSettings.gridSize
                ).map((count) => (
                  <option key={count} value={count}>
                    {count} bugs
                  </option>
                ))}
              </select>
              <div className="absolute right-2 top-1/2 transform -translate-y-1/2 pointer-events-none text-sm">
                ▼
              </div>
            </div>
          </div>

          {/* Bet Button or Cashout Button */}
          {!gameState.isPlaying ? (
            <Button
              size="lg"
              variant="primary"
              onClick={handleStartGame}
              disabled={
                betSettings.betAmount <= 0 ||
                betSettings.betAmount > (getBalance("ETH") / Math.pow(10, 18)) ||
                isLoading
              }
            >
              {isLoading
                ? "LOADING..."
                : gameState.gameOver ||
                  gameState.gameWon ||
                  gameState.cashoutTriggered
                ? "NEW GAME"
                : "BET"}
            </Button>
          ) : (
            <div className="space-y-2">
              <Button
                size="lg"
                variant="primary"
                onClick={handleCashout}
                disabled={!gameState.canCashout || isLoading}
                className={`w-full py-3 rounded-lg font-semibold text-base transition-colors ${
                  isLoading ? "opacity-50 cursor-not-allowed" : ""
                }`}
              >
                {isLoading
                  ? "CASHING OUT..."
                  : `CASHOUT $${getDisplayAmount(
                      gameState.potential_payout,
                      gameState.chain
                    ).toFixed(8)}`}
              </Button>
            </div>
          )}
        </div>
      </div>
      {/* Right Side - Mines Interface (Desktop) / Top (Mobile) */}
      <div className="flex w-full lg:w-3/4 items-center justify-center p-4 rounded-r-2xl relative order-1 lg:order-2">
        {(gameState.gameOver || gameState.cashoutTriggered) && (
          <Modal
            type={
              gameState.gameWon || gameState.cashoutTriggered
                ? "profit"
                : "loss"
            }
            multiplier={gameState.multiplier.toString()}
            amount={gameState.payoutAmount.toFixed(2)}
          />
        )}
        <MinesGrid
          gridSize={betSettings.gridSize}
          isPlaying={gameState.isPlaying}
          gameOver={gameState.gameOver}
          gameWon={gameState.gameWon}
          cashoutTriggered={gameState.cashoutTriggered}
          onCashoutReveal={handleCashoutReveal}
          onMakeMove={handleMakeMove}
          revealedBlocks={revealedBlocks}
          bombBlocks={bombBlocks}
          selectedBlocks={selectedBlocks}
          onSoundEffect={playSoundEffect}
        />
      </div>
    </div>
  );
};
