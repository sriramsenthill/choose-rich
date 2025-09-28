export interface BalanceData {
  ethereum: {
    address: string;
    balance: number;
    account_balance?: number;
    in_game_balance?: number;
  };
  bitcoin: {
    address: string;
    balance: number;
    account_balance?: number;
    in_game_balance?: number;
  };
}

export interface RefreshBalanceRequest {
  wallet_address: string;
}

export interface RefreshBalanceResponse {
  account_balance: string;
  in_game_balance: string;
  user_id: string;
  game_address: string;
  deposits_found: number;
  total_new_deposit_amount: string;
}

export interface WalletBalanceResponse {
  account_balance: string;
  in_game_balance: string;
  user_id: string;
  game_address: string;
}
