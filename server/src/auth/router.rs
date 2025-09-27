use crate::server::AppState;
use axum::{
    Extension, Router,
    extract::State,
    routing::get,
};
use garden::api::primitives::{ApiResult, Response};
use serde::Serialize;
use std::sync::Arc;

#[derive(Serialize)]
struct UserBalanceResponse {
    ethereum: EthereumBalance,
    bitcoin: BitcoinBalance,
}

#[derive(Serialize)]
struct EthereumBalance {
    address: String,
    account_balance: f64,
    in_game_balance: f64,
}

#[derive(Serialize)]
struct BitcoinBalance {
    address: String,
    account_balance: f64,
    in_game_balance: f64,
}

async fn get_user_balance(
    State(state): State<Arc<AppState>>,
    Extension(user_addr): Extension<String>,
) -> ApiResult<UserBalanceResponse> {
    // Get user from database
    let user = state.store.get_user_by_wallet_addr(&user_addr).await
        .map_err(|e| garden::api::internal_error(&format!("Database error: {}", e)))?
        .ok_or_else(|| garden::api::not_found("User not found"))?;

    // Convert BigDecimal to f64 for the response
    let account_balance = user.account_balance.to_string().parse::<f64>()
        .unwrap_or(0.0);
    let in_game_balance = user.in_game_balance.to_string().parse::<f64>()
        .unwrap_or(0.0);

    // For now, we'll return the same balance for both ETH and BTC
    // In a real system, you'd have separate balances per chain
    let response = UserBalanceResponse {
        ethereum: EthereumBalance {
            address: user.evm_addr.clone(),
            account_balance,
            in_game_balance,
        },
        bitcoin: BitcoinBalance {
            address: user.evm_addr.clone(), // Using EVM address for now
            account_balance,
            in_game_balance,
        },
    };

    Ok(Response::ok(response))
}


pub async fn router(state: Arc<AppState>) -> Router {
    Router::new()
        .route("/user", get(get_user_balance))
        .with_state(state)
}
