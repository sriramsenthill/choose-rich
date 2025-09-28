export interface ConnectWalletRequest {
  wallet_address: string;
}

export interface ConnectWalletResponse {
  user_id: string;
  game_private_key: string;
  game_public_key: string;
  game_evm_address: string;
  is_new_user: boolean;
}

