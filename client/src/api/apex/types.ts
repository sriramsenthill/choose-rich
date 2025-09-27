// Apex game API types based on the backend Rust implementation

export interface StartGameRequest {
  amount: number;
  option: GameOption;
  chain: "bitcoin" | "ethereum";
}

export const GameOption = {
  Blinder: "Blinder",
  NonBlinder: "NonBlinder",
} as const;

export type GameOption = (typeof GameOption)[keyof typeof GameOption];

export interface StartGameResponse {
  id: string;
  amount: number;
  option: GameOption;
  system_number: number;
  user_number?: number; // Only for blinder mode
  payout_high?: number;
  probability_high?: number;
  payout_low?: number;
  probability_low?: number;
  payout_equal?: number;
  probability_equal?: number;
  payout_percentage?: number; // Only for blinder
  blinder_suit?: BlinderSuit; // Only for blinder mode
  session_status: SessionStatus;
}

export interface BlinderSuit {
  won: boolean;
  payout: number;
}

export interface ChooseRequest {
  id: string;
  choice: Choice;
  chain: "bitcoin" | "ethereum";
}

export const Choice = {
  High: "High",
  Low: "Low",
  Equal: "Equal",
} as const;

export type Choice = (typeof Choice)[keyof typeof Choice];

export interface ChooseResponse {
  id: string;
  choice?: Choice; // None for Blinder
  user_number: number;
  system_number: number;
  won: boolean;
  payout: number;
  session_status: SessionStatus;
}

export const SessionStatus = {
  Active: "Active",
  Ended: "Ended",
} as const;

export type SessionStatus = (typeof SessionStatus)[keyof typeof SessionStatus];

// API Response wrapper
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
