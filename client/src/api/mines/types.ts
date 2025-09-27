import { SessionStatus } from "../types";

// Mines-specific types based on the Rust backend
export interface StartGameRequest {
  amount: number;
  blocks: number;
  mines: number;
  chain: "bitcoin" | "ethereum";
}

export interface StartGameResponse {
  id: string;
  amount: number;
  blocks: number;
  mines: number;
  session_status: SessionStatus;
}

export interface MoveRequest {
  id: string;
  block: number;
  chain: "bitcoin" | "ethereum";
}

export interface MoveAction {
  block: number;
  multiplier: number;
  safe: boolean;
}

export interface MoveResponse {
  id: string;
  actions: Record<string, MoveAction>;
  current_multiplier?: number;
  potential_payout?: number;
  final_payout?: number;
  bomb_blocks?: number[];
  session_status: SessionStatus;
}

export interface CashoutRequest {
  id: string;
  chain: "bitcoin" | "ethereum";
}

export interface CashoutResponse {
  id: string;
  src: number;
  final_payout: number;
  actions: Record<string, MoveAction>;
  bomb_blocks?: number[];
  session_status: SessionStatus;
}

// Client-side game state for Mines
export interface MinesGameState {
  sessionId: string | null;
  isPlaying: boolean;
  canCashout: boolean;
  currentMultiplier: number;
  revealedCount: number;
  gameOver: boolean;
  gameWon: boolean;
  cashoutTriggered: boolean;
  betAmount: number;
  minesCount: number;
  gridSize: number;
  targetWin: number;
  multiplier: number;
  potential_payout: number;
  payoutAmount: number; // Actual amount won/lost from backend
  chain: "bitcoin" | "ethereum";
}
