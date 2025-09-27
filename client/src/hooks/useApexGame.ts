import { useState, useCallback } from "react";
import { apexApi, GameOption, Choice } from "../api/apex";

import type { StartGameResponse } from "../api/apex";

interface ApexGameState {
  isPlaying: boolean;
  gameOver: boolean;
  gameWon: boolean;
  userRoll: number | null;
  systemRoll: number | null;
  userChoice: Choice | null;
  multiplier: number;
  isRolling: boolean;
  gameId: string | null;
  gameData: StartGameResponse | null;
  payoutAmount: number;
  chain: "bitcoin" | "ethereum";
}

export const useApexGame = (onSlotMachineSound?: () => void) => {
  const [gameState, setGameState] = useState<ApexGameState>({
    isPlaying: false,
    gameOver: false,
    gameWon: false,
    userRoll: null,
    systemRoll: null,
    userChoice: null,
    multiplier: 0,
    isRolling: false,
    gameId: null,
    gameData: null,
    payoutAmount: 0,
    chain: "bitcoin",
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startGame = useCallback(
    async (
      amount: number,
      option: GameOption,
      chain: "bitcoin" | "ethereum"
    ) => {
      try {
        console.log(
          "Starting Apex game with amount:",
          amount,
          "option:",
          option
        );
        setIsLoading(true);
        setError(null);

        // Reset game state first to trigger animations
        setGameState({
          isPlaying: false,
          gameOver: false,
          gameWon: false,
          userRoll: null,
          systemRoll: null,
          userChoice: null,
          multiplier: 0,
          isRolling: false,
          gameId: null,
          gameData: null,
          payoutAmount: 0,
          chain,
        });

        console.log("Calling apexApi.startGame with:", {
          amount,
          option,
          chain,
        });
        const response = await apexApi.startGame({
          amount, // Amount is already converted to API format in the component
          option,
          chain,
        });
        console.log("Apex API response:", response);

        // Play slot machine sound when API response is received
        if (onSlotMachineSound) {
          onSlotMachineSound();
        }

        // Set initial state with rolling animation
        setGameState({
          isPlaying: true,
          isRolling: true,
          gameOver: false,
          gameWon: false,
          userRoll: null, // Start with null to trigger animation
          systemRoll: null, // Start with null to trigger animation
          userChoice: null,
          multiplier: 0,
          gameId: response.id,
          gameData: response,
          payoutAmount: 0,
          chain,
        });

        // Set actual values after a short delay to trigger animation
        setTimeout(() => {
          setGameState((prev) => ({
            ...prev,
            userRoll: response.user_number || null,
            systemRoll: response.system_number,
          }));
        }, 100);

        // For blinder mode, the game is already complete
        if (option === GameOption.Blinder && response.blinder_suit) {
          setTimeout(() => {
            setGameState((prev) => ({
              ...prev,
              isRolling: false,
              gameOver: true,
              gameWon: response.blinder_suit!.won,
              multiplier: response.blinder_suit!.won
                ? response.payout_percentage || 2
                : 0,
              payoutAmount: response.blinder_suit!.won
                ? (response.blinder_suit!.payout /
                    (chain === "bitcoin"
                      ? Math.pow(10, 8)
                      : Math.pow(10, 18))) *
                  (response.payout_percentage || 2)
                : 0,
            }));
          }, 3200); // Animation time
        } else {
          // For non-blinder mode, stop rolling after showing system number
          setTimeout(() => {
            setGameState((prev) => ({
              ...prev,
              isRolling: false,
            }));
          }, 1000);
        }

        return response;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to start game");
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [onSlotMachineSound]
  );

  const makeChoice = useCallback(
    async (choice: Choice) => {
      if (!gameState.gameId) {
        throw new Error("No active game");
      }

      try {
        setIsLoading(true);
        setError(null);

        setGameState((prev) => ({
          ...prev,
          userChoice: choice,
          isRolling: true,
          userRoll: null, // Reset to null to trigger animation
        }));

        const response = await apexApi.makeChoice({
          id: gameState.gameId,
          choice,
          chain: gameState.chain,
        });

        // Play slot machine sound when API response is received
        if (onSlotMachineSound) {
          onSlotMachineSound();
        }

        // Set the new user roll after a short delay to trigger animation
        setTimeout(() => {
          setGameState((prev) => ({
            ...prev,
            userRoll: response.user_number,
            isRolling: false,
            gameOver: false,
            gameWon: response.won,
            multiplier: response.won
              ? response.payout / (gameState.gameData?.amount || 1)
              : 0,
            payoutAmount: response.won
              ? response.payout /
                (gameState.chain === "bitcoin"
                  ? Math.pow(10, 8)
                  : Math.pow(10, 18))
              : 0,
          }));
        }, 100);

        // Show result after animation
        setTimeout(() => {
          setGameState((prev) => ({
            ...prev,
            gameOver: true,
          }));
        }, 3200);

        return response;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to make choice");
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [
      gameState.gameId,
      gameState.gameData?.amount,
      gameState.chain,
      onSlotMachineSound,
    ]
  );

  const resetGame = useCallback(() => {
    setGameState({
      isPlaying: false,
      gameOver: false,
      gameWon: false,
      userRoll: null,
      systemRoll: null,
      userChoice: null,
      multiplier: 0,
      isRolling: false,
      gameId: null,
      gameData: null,
      payoutAmount: 0,
      chain: "bitcoin",
    });
    setError(null);
  }, []);

  return {
    gameState,
    isLoading,
    error,
    startGame,
    makeChoice,
    resetGame,
  };
};
