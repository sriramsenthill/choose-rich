// API configuration
export const API_CONFIG = {
  // Base URL from environment or fallback to provided API
  BASE_URL: import.meta.env.VITE_API_BASE_URL || "http://10.67.23.247:5433",

  // Game-specific endpoints
  GAMES: {
    MINES: {
      BASE: "/mines",
      START: "/mines/start",
      MOVE: "/mines/move",
      CASHOUT: "/mines/cashout",
    },
    // Future games can be added here
    // CRASH: {
    //   BASE: '/crash',
    //   START: '/crash/start',
    //   BET: '/crash/bet',
    //   CASHOUT: '/crash/cashout',
    // },
  },

  BALANCES: {
    BASE: "/user",
    REFRESH: "/refresh-balance",
  },
  // Request timeout
  TIMEOUT: 10000,

  // Retry configuration
  RETRY: {
    ATTEMPTS: 3,
    DELAY: 1000,
  },
} as const;

// Environment variables type
export interface ApiEnv {
  VITE_API_BASE_URL?: string;
}
