use crate::{
    server::AppState,
    wallet::{connect_wallet, WalletConnectionRequest, WalletConnectionResponse},
};
use axum::{
    extract::{State, Path},
    routing::{post, get},
    Json, Router,
};
use garden::api::primitives::{ApiResult, Response};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

#[derive(Serialize)]
struct GameAddressResponse {
    game_address: String,
    user_id: String,
}

#[derive(Serialize)]
struct BalanceResponse {
    balance: String,
    user_id: String,
    game_address: String,
}

#[derive(Deserialize)]
struct DepositRequest {
    amount: String, // Amount in USD or token units
}

#[derive(Serialize)]
struct DepositResponse {
    success: bool,
    new_balance: String,
    transaction_id: String,
}

#[derive(Deserialize)]
struct CashoutRequest {
    amount: String, // Amount to cashout
}

#[derive(Serialize)]
struct CashoutResponse {
    success: bool,
    amount_cashed_out: String,
    remaining_balance: String,
    transaction_id: String,
    recipient_address: String,
}

#[derive(Serialize)]
struct TransactionHistoryResponse {
    transactions: Vec<crate::store::GameTransaction>,
    total_count: usize,
}

// Wallet connection endpoint
async fn wallet_connect(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<WalletConnectionRequest>,
) -> ApiResult<WalletConnectionResponse> {
    connect_wallet(payload.wallet_address, &state.store).await
}

// Get game address for a user
async fn get_game_address(
    State(state): State<Arc<AppState>>,
    Path(wallet_address): Path<String>,
) -> ApiResult<GameAddressResponse> {
    let user = state.store.get_user_by_wallet_addr(&wallet_address).await
        .map_err(|e| garden::api::internal_error(&format!("Database error: {}", e)))?
        .ok_or_else(|| garden::api::not_found("User not found"))?;

    Ok(Response::ok(GameAddressResponse {
        game_address: user.evm_addr,
        user_id: user.user_id,
    }))
}

// Get balance for a game address
async fn get_balance(
    State(state): State<Arc<AppState>>,
    Path(address): Path<String>,
) -> ApiResult<BalanceResponse> {
    let user = state.store.get_user_by_wallet_addr(&address).await
        .map_err(|e| garden::api::internal_error(&format!("Database error: {}", e)))?
        .ok_or_else(|| garden::api::not_found("Address not found"))?;

    Ok(Response::ok(BalanceResponse {
        balance: user.game_balance.to_string(),
        user_id: user.user_id,
        game_address: user.evm_addr,
    }))
}

// Simulate deposit (in real app, this would be triggered by on-chain events)
async fn simulate_deposit(
    State(state): State<Arc<AppState>>,
    Path(address): Path<String>,
    Json(payload): Json<DepositRequest>,
) -> ApiResult<DepositResponse> {
    use sqlx::types::BigDecimal;
    use std::str::FromStr;
    
    let user = state.store.get_user_by_wallet_addr(&address).await
        .map_err(|e| garden::api::internal_error(&format!("Database error: {}", e)))?
        .ok_or_else(|| garden::api::not_found("Address not found"))?;

    let deposit_amount = BigDecimal::from_str(&payload.amount)
        .map_err(|_| garden::api::bad_request("Invalid amount format"))?;

    // Update balance
    let updated_user = state.store.adjust_user_balance(&user.user_id, &deposit_amount).await
        .map_err(|e| garden::api::internal_error(&format!("Failed to update balance: {}", e)))?;

    // Record transaction
    let transaction = crate::store::GameTransaction {
        id: String::new(),
        user_id: user.user_id.clone(),
        transaction_type: "deposit".to_string(),
        amount: deposit_amount,
        game_type: None,
        game_session_id: None,
        description: Some("Deposit to game account".to_string()),
        created_at: None,
    };

    let recorded_transaction = state.store.create_transaction(&transaction).await
        .map_err(|e| garden::api::internal_error(&format!("Failed to record transaction: {}", e)))?;

    Ok(Response::ok(DepositResponse {
        success: true,
        new_balance: updated_user.game_balance.to_string(),
        transaction_id: recorded_transaction.id,
    }))
}

// Cashout funds to original wallet
async fn cashout_funds(
    State(state): State<Arc<AppState>>,
    Path(address): Path<String>,
    Json(payload): Json<CashoutRequest>,
) -> ApiResult<CashoutResponse> {
    use sqlx::types::BigDecimal;
    use std::str::FromStr;
    
    let user = state.store.get_user_by_wallet_addr(&address).await
        .map_err(|e| garden::api::internal_error(&format!("Database error: {}", e)))?
        .ok_or_else(|| garden::api::not_found("Address not found"))?;

    let cashout_amount = BigDecimal::from_str(&payload.amount)
        .map_err(|_| garden::api::bad_request("Invalid amount format"))?;

    // Check if user has enough balance
    if user.game_balance < cashout_amount {
        return Err(garden::api::bad_request("Insufficient balance"));
    }

    // In a real application, you would initiate an on-chain transaction here
    // For now, we'll just update the database and record the transaction
    
    // Deduct from game balance
    let updated_user = state.store.adjust_user_balance(&user.user_id, &(-cashout_amount.clone())).await
        .map_err(|e| garden::api::internal_error(&format!("Failed to update balance: {}", e)))?;

    // Record cashout transaction
    let transaction = crate::store::GameTransaction {
        id: String::new(),
        user_id: user.user_id.clone(),
        transaction_type: "cashout".to_string(),
        amount: cashout_amount.clone(),
        game_type: None,
        game_session_id: None,
        description: Some(format!("Cashout to original wallet: {}", user.original_wallet_addr.as_ref().unwrap_or(&"Unknown".to_string()))),
        created_at: None,
    };

    let recorded_transaction = state.store.create_transaction(&transaction).await
        .map_err(|e| garden::api::internal_error(&format!("Failed to record transaction: {}", e)))?;

    Ok(Response::ok(CashoutResponse {
        success: true,
        amount_cashed_out: cashout_amount.to_string(),
        remaining_balance: updated_user.game_balance.to_string(),
        transaction_id: recorded_transaction.id,
        recipient_address: user.original_wallet_addr.unwrap_or("Unknown".to_string()),
    }))
}

// Get transaction history for a user
async fn get_transaction_history(
    State(state): State<Arc<AppState>>,
    Path(address): Path<String>,
) -> ApiResult<TransactionHistoryResponse> {
    let user = state.store.get_user_by_wallet_addr(&address).await
        .map_err(|e| garden::api::internal_error(&format!("Database error: {}", e)))?
        .ok_or_else(|| garden::api::not_found("Address not found"))?;

    let transactions = state.store.get_user_transactions(&user.user_id, Some(100)).await
        .map_err(|e| garden::api::internal_error(&format!("Failed to fetch transactions: {}", e)))?;

    let total_count = transactions.len();

    Ok(Response::ok(TransactionHistoryResponse {
        transactions,
        total_count,
    }))
}

async fn health_check() -> &'static str {
    "Wallet API is running!"
}

pub async fn router(state: Arc<AppState>) -> Router {
    Router::new()
        .route("/wallet/connect", post(wallet_connect))
        .route("/wallet/health", get(health_check))
        .route("/game-address/:wallet_address", get(get_game_address))
        .route("/balance-address/:address", get(get_balance))
        .route("/deposit/:address", post(simulate_deposit))
        .route("/cashout/:address", post(cashout_funds))
        .route("/transactions/:address", get(get_transaction_history))
        .with_state(state)
}


