import { AUTH_TOKEN } from "../../constants/constants";
import { apiClient } from "../client";
import { API_CONFIG } from "../config";
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
  private headers = {
    Authorization: `Bearer ${AUTH_TOKEN}`,
  };

  async startGame(request: StartGameRequest): Promise<StartGameResponse> {
    try {
      return await apiClient.post<StartGameResponse>(
        API_CONFIG.GAMES.MINES.START,
        request,
        this.headers
      );
    } catch (error) {
      console.error("Error starting Mines game:", error);
      throw error;
    }
  }

  async makeMove(request: MoveRequest): Promise<MoveResponse> {
    try {
      return await apiClient.post<MoveResponse>(
        API_CONFIG.GAMES.MINES.MOVE,
        request,
        this.headers
      );
    } catch (error) {
      console.error("Error making move:", error);
      throw error;
    }
  }

  async cashout(request: CashoutRequest): Promise<CashoutResponse> {
    try {
      return await apiClient.post<CashoutResponse>(
        API_CONFIG.GAMES.MINES.CASHOUT,
        request,
        this.headers
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
        this.baseEndpoint,
        this.headers
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
