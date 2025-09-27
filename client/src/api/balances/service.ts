import { AUTH_TOKEN } from "../../constants/constants";
import { apiClient } from "../client";
import { API_CONFIG } from "../config";
import type { BalanceData, RefreshBalanceRequest, RefreshBalanceResponse } from "./types";
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
}

export const balancesService = new BalancesService();
