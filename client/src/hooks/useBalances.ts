import { useEffect, useRef, useCallback } from "react";
import { useBalanceStore } from "../store/balanceStore";
import { balancesService } from "../api/balances";
import type {
  RefreshBalanceRequest,
  WalletBalanceResponse,
} from "../api/balances/types";

export const useBalances = (pollInterval: number = 7000) => {
  const { setBalances, setLoading, setError, isLoading, error } =
    useBalanceStore();

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const updateBalancesFromWallet = useCallback(
    (walletBalance: WalletBalanceResponse | null) => {
      const inGameBalanceNumber = walletBalance
        ? parseFloat(walletBalance.in_game_balance)
        : 0;

      // Convert ETH to wei for storage (multiply by 10^18)
      // This ensures consistency with the display logic that divides by 10^18
      const balanceInWei = inGameBalanceNumber * Math.pow(10, 18);

      const transformedBalances = {
        ETH: {
          balance: balanceInWei,
          symbol: "ETH",
        },
      };

      setBalances(transformedBalances);
      console.log("Balance state updated:", transformedBalances, "Original ETH:", inGameBalanceNumber);
    },
    [setBalances]
  );

  const fetchBalances = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const walletBalance = await balancesService.getStoredGameWalletBalance();
      updateBalancesFromWallet(walletBalance);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to fetch balances";
      setError(errorMessage);
      console.error("Error fetching balances:", err);
    } finally {
      setLoading(false);
    }
  }, [setLoading, setError, updateBalancesFromWallet]);

  const startPolling = useCallback(() => {
    if (pollInterval <= 0) {
      return;
    }

    // Fetch immediately
    fetchBalances();

    // Set up polling
    intervalRef.current = setInterval(fetchBalances, pollInterval);
  }, [fetchBalances, pollInterval]);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (pollInterval <= 0) {
      stopPolling();
      return;
    }

    startPolling();

    // Cleanup on unmount
    return () => {
      stopPolling();
    };
  }, [pollInterval, startPolling, stopPolling]);

  const refreshBalance = useCallback(
    async (walletAddress: string) => {
      try {
        setLoading(true);
        setError(null);

        const request: RefreshBalanceRequest = {
          wallet_address: walletAddress,
        };

        const refreshResponse = await balancesService.refreshBalance(request);
        console.log("Refresh balance response:", refreshResponse);

        // Update balance store directly with the refresh response
        updateBalancesFromWallet({
          account_balance: refreshResponse.account_balance,
          in_game_balance: refreshResponse.in_game_balance,
          user_id: refreshResponse.user_id,
          game_address: refreshResponse.game_address,
        });

        return refreshResponse;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to refresh balance";
        setError(errorMessage);
        console.error("Error refreshing balance:", err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [setLoading, setError, updateBalancesFromWallet]
  );

  return {
    fetchBalances,
    refreshBalance,
    startPolling,
    stopPolling,
    isLoading,
    error,
  };
};
