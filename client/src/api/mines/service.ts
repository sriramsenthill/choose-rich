import { minesApiService } from "./api";
import type {
  StartGameRequest,
  StartGameResponse,
  MoveRequest,
  MoveResponse,
  CashoutRequest,
  CashoutResponse,
} from "./types";

// Mines service that uses the real API
class MinesService {
  async startGame(request: Omit<StartGameRequest, 'game_address'>): Promise<StartGameResponse> {
    return minesApiService.startGame(request);
  }

  async makeMove(request: Omit<MoveRequest, 'game_address'>): Promise<MoveResponse> {
    return minesApiService.makeMove(request);
  }

  async cashout(request: Omit<CashoutRequest, 'game_address'>): Promise<CashoutResponse> {
    return minesApiService.cashout(request);
  }

  async healthCheck(): Promise<boolean> {
    return minesApiService.healthCheck();
  }
}

// Export singleton instance
export const minesService = new MinesService();
