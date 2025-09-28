import { AUTH_TOKEN } from "../../constants/constants";
import { API_CONFIG } from "../config";
import { apiClient, ApiClient } from "../client";
import type {
  BalanceData,
  RefreshBalanceRequest,
  RefreshBalanceResponse,
  WalletBalanceResponse,
} from "./types";

const walletApiClient = new ApiClient(API_CONFIG.WALLET.BASE_URL);
export class BalancesService {
  async getBalances(): Promise<BalanceData> {
    try {
      const response = await apiClient.get<BalanceData>(
        API_CONFIG.BALANCES.BASE,
        {
          Authorization: `Bearer ${AUTH_TOKEN}`,
        }
      );
      console.log(response);
      return response;
    } catch (error) {
      console.error("Failed to fetch balances:", error);
      throw error;
    }
  }

  async refreshBalance(request: RefreshBalanceRequest): Promise<RefreshBalanceResponse> {
    try {
      const response = await apiClient.post<RefreshBalanceResponse>(
        API_CONFIG.BALANCES.REFRESH,
        request,
        {
          "X-Server-secret": "X-Server-secret",
        }
      );
      console.log("Refresh balance response:", response);
      return response;
    } catch (error) {
      console.error("Failed to refresh balance:", error);
      throw error;
    }
  }

  async getWalletBalance(gameAddress: string): Promise<WalletBalanceResponse> {
    try {
      const response = await walletApiClient.get<WalletBalanceResponse>(
        `${API_CONFIG.BALANCE}/${gameAddress}`
      );
      return response;
    } catch (error) {
      console.error("Failed to fetch wallet balance:", error);
      throw error;
    }
  }

  async getStoredGameWalletBalance(): Promise<WalletBalanceResponse | null> {
    if (typeof window === "undefined") {
      return null;
    }
    const gameAddress = window.localStorage.getItem("choose-rich:game-wallet");
    if (!gameAddress) {
      return null;
    }
    return this.getWalletBalance(gameAddress);
  }
}

export const balancesService = new BalancesService();
