import { API_CONFIG } from "../config";
import { ApiClient } from "../client";
import type { ConnectWalletRequest, ConnectWalletResponse } from "./types";

const walletApiClient = new ApiClient(API_CONFIG.WALLET.BASE_URL);

class WalletService {
  async connectWallet(
    request: ConnectWalletRequest
  ): Promise<ConnectWalletResponse> {
    return walletApiClient.post<ConnectWalletResponse>(
      API_CONFIG.WALLET.CONNECT,
      request
    );
  }
}

export const walletService = new WalletService();

