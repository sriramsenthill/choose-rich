import { create } from "zustand";

interface TokenBalance {
  balance: number;
  symbol: string;
}

interface BalanceState {
  balances: {
    ETH: TokenBalance;
  };
  isLoading: boolean;
  error: string | null;
  setBalances: (balances: { ETH: TokenBalance }) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  getBalance: (token: "ETH") => number;
}

export const useBalanceStore = create<BalanceState>((set, get) => ({
  balances: {
    ETH: { balance: 0, symbol: "ETH" },
  },
  isLoading: false,
  error: null,
  setBalances: (balances) => set({ balances }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
  getBalance: (token) => get().balances[token].balance,
}));
