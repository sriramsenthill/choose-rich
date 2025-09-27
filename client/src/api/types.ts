// Common API types
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
}

export interface ApiError {
  success: false;
  error: string;
  message?: string;
}

// Game session status
export const SessionStatus = {
  Active: "Active",
  Ended: "Ended",
} as const;

export type SessionStatus = (typeof SessionStatus)[keyof typeof SessionStatus];

// Move action types
export type MoveAction = "reveal" | "flag" | "unflag";

// Base game configuration
export interface BaseGameConfig {
  amount: number;
  blocks: number;
  mines: number;
}

// Game session interface
export interface GameSession {
  id: string;
  src: number;
  blocks: number;
  mines: number;
  mine_positions: Set<number>;
  revealed_blocks: Set<number>;
  actions: Record<string, MoveAction>;
  current_multiplier: number;
  status: SessionStatus;
}
