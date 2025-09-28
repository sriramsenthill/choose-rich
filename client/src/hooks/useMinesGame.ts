import { useState, useCallback } from "react";
import { minesService, SessionStatus } from "../api/mines";
import type {
  MinesGameState,
  StartGameRequest,
  MoveRequest,
  CashoutRequest,
} from "../api/mines";

interface BetSettings {
  betAmount: number;
  minesCount: number;
  gridSize: number;
  targetWin: number;
  multiplier: number;
}

interface UseMinesGameReturn {
  // Game state
  gameState: MinesGameState;
  betSettings: BetSettings;
  isLoading: boolean;
  error: string | null;
  revealedBlocks: Set<number>;
  bombBlocks: number[];

  // Actions
  updateBetSettings: (settings: Partial<BetSettings>) => void;
  startGame: (amount: number) => Promise<void>;
  makeMove: (block: number) => Promise<void>;
  cashout: () => Promise<void>;
  resetGame: () => void;
  clearError: () => void;
}

const initialGameState: MinesGameState = {
  sessionId: null,
  isPlaying: false,
  canCashout: false,
  currentMultiplier: 1,
  revealedCount: 0,
  gameOver: false,
  gameWon: false,
  cashoutTriggered: false,
  betAmount: 0.1,
  minesCount: 3,
  gridSize: 4,
  targetWin: 0,
  multiplier: 0,
  payoutAmount: 0,
  potential_payout: 0,
};

const initialBetSettings: BetSettings = {
  betAmount: 0.1,
  minesCount: 3,
  gridSize: 4,
  targetWin: 0,
  multiplier: 0,
};

export const useMinesGame = (): UseMinesGameReturn => {
  const [gameState, setGameState] = useState<MinesGameState>(initialGameState);
  const [betSettings, setBetSettings] =
    useState<BetSettings>(initialBetSettings);
  // Balance management is now handled by the backend
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revealedBlocks, setRevealedBlocks] = useState<Set<number>>(new Set());
  const [bombBlocks, setBombBlocks] = useState<number[]>([]);

  // Calculate multiplier based on mines count and grid size
  const calculateMultiplier = useCallback(
    (mines: number, gridSize: number): number => {
      const totalCells = gridSize * gridSize;
      const safeCells = totalCells - mines;
      const baseMultiplier = totalCells / safeCells;
      return Math.round(baseMultiplier * 100) / 100;
    },
    []
  );

  // Calculate target win amount
  const calculateTargetWin = useCallback(
    (bet: number, mines: number, gridSize: number): number => {
      const multiplier = calculateMultiplier(mines, gridSize);
      return Math.round(bet * multiplier * 100) / 100;
    },
    [calculateMultiplier]
  );

  // Update bet settings
  const updateBetSettings = useCallback(
    (settings: Partial<BetSettings>) => {
      setBetSettings((prev) => {
        const newSettings = { ...prev, ...settings };

        // Recalculate multiplier and target win
        const multiplier = calculateMultiplier(
          newSettings.minesCount,
          newSettings.gridSize
        );
        const targetWin = calculateTargetWin(
          newSettings.betAmount,
          newSettings.minesCount,
          newSettings.gridSize
        );

        return {
          ...newSettings,
          multiplier,
          targetWin,
        };
      });
    },
    [calculateMultiplier, calculateTargetWin]
  );

  // Start a new game
  const startGame = useCallback(
    async (amount: number) => {
      if (amount <= 0) {
        setError("Invalid bet amount");
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const request: Omit<StartGameRequest, 'game_address'> = {
          amount,
          blocks: betSettings.gridSize * betSettings.gridSize,
          mines: betSettings.minesCount,
        };

        const response = await minesService.startGame(request);

        // Reset revealed blocks and bomb blocks for new game
        setRevealedBlocks(new Set());
        setBombBlocks([]);

        setGameState((prev) => ({
          ...prev,
          sessionId: response.id,
          isPlaying: true,
          canCashout: false,
          currentMultiplier: 1,
          revealedCount: 0,
          gameOver: false,
          gameWon: false,
          cashoutTriggered: false,
          betAmount: amount,
          minesCount: betSettings.minesCount,
          gridSize: betSettings.gridSize,
          targetWin: betSettings.targetWin,
          multiplier: betSettings.multiplier,
        }));

        // Deduct bet amount from balance
        // Balance is managed by backend
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to start game");
      } finally {
        setIsLoading(false);
      }
    },
    [betSettings]
  );

  // Make a move
  const makeMove = useCallback(
    async (block: number) => {
      if (!gameState.sessionId || !gameState.isPlaying) {
        setError("No active game session");
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const request: Omit<MoveRequest, 'game_address'> = {
          id: gameState.sessionId,
          block,
        };

        const response = await minesService.makeMove(request);

        // Update revealed blocks
        setRevealedBlocks((prev) => {
          const newSet = new Set(prev);
          newSet.add(block);
          return newSet;
        });

        // Update game state based on response
        setGameState((prev) => {
          const newState = { ...prev };

          if (response.session_status === SessionStatus.Ended) {
            // Game ended (hit a mine or won)
            newState.isPlaying = false;
            newState.gameOver =
              !response.final_payout || response.final_payout === 0;
            newState.gameWon = response.final_payout
              ? response.final_payout > 0
              : false;

            // Set the actual payout amount from backend (already in decimal format)
            newState.payoutAmount = response.final_payout || 0;

            if (response.final_payout && response.final_payout > 0) {
              // Balance is managed by backend
            }

            // Set bomb blocks for display and reveal them
            if (response.bomb_blocks) {
              setBombBlocks(response.bomb_blocks);
              // Reveal all blocks when game ends (bombs and diamonds)
              setRevealedBlocks((prev) => {
                const newSet = new Set(prev);
                // Add all bomb blocks
                response.bomb_blocks!.forEach((bombBlock) =>
                  newSet.add(bombBlock)
                );
                // Add all remaining safe blocks as diamonds
                const totalBlocks = betSettings.gridSize * betSettings.gridSize;
                for (let i = 1; i <= totalBlocks; i++) {
                  if (!response.bomb_blocks!.includes(i)) {
                    newSet.add(i);
                  }
                }
                return newSet;
              });
            }
          } else {
            // Game continues
            newState.canCashout = true;
            newState.currentMultiplier = response.current_multiplier || 1;
            newState.revealedCount = Object.keys(response.actions).length;
            newState.potential_payout = response.potential_payout || 0;
          }

          return newState;
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to make move");
      } finally {
        setIsLoading(false);
      }
    },
    [
      gameState.sessionId,
      gameState.isPlaying,
      betSettings.gridSize,
    ]
  );

  // Cashout
  const cashout = useCallback(async () => {
    if (!gameState.sessionId || !gameState.isPlaying) {
      setError("No active game session");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const request: Omit<CashoutRequest, 'game_address'> = {
        id: gameState.sessionId,
      };

      const response = await minesService.cashout(request);

      // Add winnings to balance
      // Balance is managed by backend

      // Set bomb blocks for display and reveal them
      if (response.bomb_blocks) {
        // Calculate all blocks to reveal
        const allBlocksToReveal = new Set<number>();
        // Add all bomb blocks
        response.bomb_blocks.forEach((bombBlock) =>
          allBlocksToReveal.add(bombBlock)
        );
        // Add all remaining safe blocks as diamonds
        const totalBlocks = betSettings.gridSize * betSettings.gridSize;
        for (let i = 1; i <= totalBlocks; i++) {
          if (!response.bomb_blocks.includes(i)) {
            allBlocksToReveal.add(i);
          }
        }

        // Update both states at the same time
        setBombBlocks(response.bomb_blocks);
        setRevealedBlocks(allBlocksToReveal);
      }

      setGameState((prev) => ({
        ...prev,
        isPlaying: false,
        canCashout: false,
        cashoutTriggered: true,
        gameOver: false,
        gameWon: true,
        payoutAmount: response.final_payout,
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to cashout");
    } finally {
      setIsLoading(false);
    }
  }, [gameState.sessionId, gameState.isPlaying, betSettings.gridSize]);

  // Reset game
  const resetGame = useCallback(() => {
    setGameState(initialGameState);
    setBetSettings(initialBetSettings);
    setRevealedBlocks(new Set());
    setBombBlocks([]);
    setError(null);
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    gameState,
    betSettings,
    isLoading,
    error,
    revealedBlocks,
    bombBlocks,
    updateBetSettings,
    startGame,
    makeMove,
    cashout,
    resetGame,
    clearError,
  };
};
