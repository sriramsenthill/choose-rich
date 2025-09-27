import { create } from "zustand";

interface TokenBalance {
  balance: number;
  symbol: string;
}

interface BalanceState {
  balances: {
    BTC: TokenBalance;
    ETH: TokenBalance;
  };
  isLoading: boolean;
  error: string | null;
  setBalances: (balances: { BTC: TokenBalance; ETH: TokenBalance }) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  getBalance: (token: "BTC" | "ETH") => number;
}

export const useBalanceStore = create<BalanceState>((set, get) => ({
  balances: {
    BTC: { balance: 0, symbol: "BTC" },
    ETH: { balance: 0, symbol: "ETH" },
  },
  isLoading: false,
  error: null,
  setBalances: (balances) => set({ balances }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
  getBalance: (token) => get().balances[token].balance,
}));
