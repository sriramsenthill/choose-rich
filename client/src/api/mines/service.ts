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
  async startGame(request: StartGameRequest): Promise<StartGameResponse> {
    return minesApiService.startGame(request);
  }

  async makeMove(request: MoveRequest): Promise<MoveResponse> {
    return minesApiService.makeMove(request);
  }

  async cashout(request: CashoutRequest): Promise<CashoutResponse> {
    return minesApiService.cashout(request);
  }

  async healthCheck(): Promise<boolean> {
    return minesApiService.healthCheck();
  }
}

// Export singleton instance
export const minesService = new MinesService();
