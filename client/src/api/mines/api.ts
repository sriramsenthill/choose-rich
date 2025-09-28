import { apiClient } from "../client";
import { API_CONFIG } from "../config";
import { getGameAddress } from "../../utils/utils";
import type {
  StartGameRequest,
  StartGameResponse,
  MoveRequest,
  MoveResponse,
  CashoutRequest,
  CashoutResponse,
} from "./types";

// Mines API service
export class MinesApiService {
  private baseEndpoint = API_CONFIG.GAMES.MINES.BASE;

  async startGame(request: Omit<StartGameRequest, 'game_address'>): Promise<StartGameResponse> {
    try {
      const gameAddress = getGameAddress();
      if (!gameAddress) {
        throw new Error("Game address not found in localStorage");
      }

      const fullRequest: StartGameRequest = {
        ...request,
        game_address: gameAddress,
      };

      return await apiClient.post<StartGameResponse>(
        API_CONFIG.GAMES.MINES.START,
        fullRequest
      );
    } catch (error) {
      console.error("Error starting Mines game:", error);
      throw error;
    }
  }

  async makeMove(request: Omit<MoveRequest, 'game_address'>): Promise<MoveResponse> {
    try {
      const gameAddress = getGameAddress();
      if (!gameAddress) {
        throw new Error("Game address not found in localStorage");
      }

      const fullRequest: MoveRequest = {
        ...request,
        game_address: gameAddress,
      };

      return await apiClient.post<MoveResponse>(
        API_CONFIG.GAMES.MINES.MOVE,
        fullRequest
      );
    } catch (error) {
      console.error("Error making move:", error);
      throw error;
    }
  }

  async cashout(request: Omit<CashoutRequest, 'game_address'>): Promise<CashoutResponse> {
    try {
      const gameAddress = getGameAddress();
      if (!gameAddress) {
        throw new Error("Game address not found in localStorage");
      }

      const fullRequest: CashoutRequest = {
        ...request,
        game_address: gameAddress,
      };

      return await apiClient.post<CashoutResponse>(
        API_CONFIG.GAMES.MINES.CASHOUT,
        fullRequest
      );
    } catch (error) {
      console.error("Error cashing out:", error);
      throw error;
    }
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      const response = await apiClient.get<{ message: string }>(
        this.baseEndpoint
      );
      return response.message === "Mines API is running!";
    } catch (error) {
      console.error("Health check failed:", error);
      return false;
    }
  }
}

// Export singleton instance
export const minesApiService = new MinesApiService();
