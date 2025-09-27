import { useEffect, useRef, useCallback } from "react";
import { useBalanceStore } from "../store/balanceStore";
import { balancesService } from "../api/balances";

export const useBalances = (pollInterval: number = 5000) => {
  const { setBalances, setLoading, setError, isLoading, error } =
    useBalanceStore();

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchBalances = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const balanceData = await balancesService.getBalances();
      console.log("Fetched balance data:", balanceData);

      // Transform API response to store format
      const transformedBalances = {
        BTC: {
          balance: balanceData.bitcoin.balance,
          symbol: "BTC",
        },
        ETH: {
          balance: balanceData.ethereum.balance,
          symbol: "ETH",
        },
      };

      setBalances(transformedBalances);
      console.log("Balance state updated successfully");
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to fetch balances";
      setError(errorMessage);
      console.error("Error fetching balances:", err);
    } finally {
      setLoading(false);
    }
  }, [setBalances, setLoading, setError]);

  const startPolling = useCallback(() => {
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
    startPolling();

    // Cleanup on unmount
    return () => {
      stopPolling();
    };
  }, [pollInterval, startPolling, stopPolling]);

  return {
    fetchBalances,
    startPolling,
    stopPolling,
    isLoading,
    error,
  };
};
