use crate::{
    deposit_monitor::{DepositMonitor, DepositMonitorConfig},
    server::AppState,
    wallet::{WalletConnectionRequest, WalletConnectionResponse, connect_wallet},
};
use axum::{
    Json, Router,
    extract::{Path, State},
    routing::{get, post},
};
use garden::api::primitives::{ApiResult, Response};
use serde::{Deserialize, Serialize};
use sqlx::types::BigDecimal;
use std::{str::FromStr, sync::Arc};
use alloy::{
    providers::{Provider, ProviderBuilder},
    primitives::{Address, U256},
};

#[derive(Serialize)]
struct GameAddressResponse {
    game_address: String,
    user_id: String,
}

#[derive(Serialize)]
struct BalanceResponse {
    account_balance: String,
    in_game_balance: String,
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

#[derive(Serialize)]
struct MonitorStatusResponse {
    status: std::collections::HashMap<String, serde_json::Value>,
}

#[derive(Deserialize)]
struct ForceDepositRequest {
    user_id: String,
    amount: String,
}

#[derive(Serialize)]
struct ForceDepositResponse {
    success: bool,
    user_id: String,
    amount: String,
    new_balance: String,
    transaction_id: String,
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
    let user = state
        .store
        .get_user_by_wallet_addr(&wallet_address)
        .await
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
    let user = state
        .store
        .get_user_by_wallet_addr(&address)
        .await
        .map_err(|e| garden::api::internal_error(&format!("Database error: {}", e)))?
        .ok_or_else(|| garden::api::not_found("Address not found"))?;

    Ok(Response::ok(BalanceResponse {
        account_balance: user.account_balance.to_string(),
        in_game_balance: user.in_game_balance.to_string(),
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

    let user = state
        .store
        .get_user_by_wallet_addr(&address)
        .await
        .map_err(|e| garden::api::internal_error(&format!("Database error: {}", e)))?
        .ok_or_else(|| garden::api::not_found("Address not found"))?;

    let deposit_amount = BigDecimal::from_str(&payload.amount)
        .map_err(|_| garden::api::bad_request("Invalid amount format"))?;

    // Update balance - deposit adds to both account and in-game balance
    let updated_user = state
        .store
        .process_deposit(&user.user_id, &deposit_amount)
        .await
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

    let recorded_transaction = state
        .store
        .create_transaction(&transaction)
        .await
        .map_err(|e| {
            garden::api::internal_error(&format!("Failed to record transaction: {}", e))
        })?;

    Ok(Response::ok(DepositResponse {
        success: true,
        new_balance: updated_user.account_balance.to_string(),
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

    let user = state
        .store
        .get_user_by_wallet_addr(&address)
        .await
        .map_err(|e| garden::api::internal_error(&format!("Database error: {}", e)))?
        .ok_or_else(|| garden::api::not_found("Address not found"))?;

    let cashout_amount = BigDecimal::from_str(&payload.amount)
        .map_err(|_| garden::api::bad_request("Invalid amount format"))?;

    // Check if user has enough in-game balance
    if user.in_game_balance < cashout_amount {
        return Err(garden::api::bad_request("Insufficient in-game balance"));
    }

    // In a real application, you would initiate an on-chain transaction here
    // For now, we'll just update the database and record the transaction

    // Deduct from in-game balance only (account balance represents total deposited, so unchanged)
    let updated_user = state
        .store
        .adjust_in_game_balance(&user.user_id, &(-cashout_amount.clone()))
        .await
        .map_err(|e| garden::api::internal_error(&format!("Failed to update balance: {}", e)))?;

    // Record cashout transaction
    let transaction = crate::store::GameTransaction {
        id: String::new(),
        user_id: user.user_id.clone(),
        transaction_type: "cashout".to_string(),
        amount: cashout_amount.clone(),
        game_type: None,
        game_session_id: None,
        description: Some(format!(
            "Cashout to original wallet: {}",
            user.original_wallet_addr
                .as_ref()
                .unwrap_or(&"Unknown".to_string())
        )),
        created_at: None,
    };

    let recorded_transaction = state
        .store
        .create_transaction(&transaction)
        .await
        .map_err(|e| {
            garden::api::internal_error(&format!("Failed to record transaction: {}", e))
        })?;

    Ok(Response::ok(CashoutResponse {
        success: true,
        amount_cashed_out: cashout_amount.to_string(),
        remaining_balance: updated_user.in_game_balance.to_string(),
        transaction_id: recorded_transaction.id,
        recipient_address: user.original_wallet_addr.unwrap_or("Unknown".to_string()),
    }))
}

// Get transaction history for a user
async fn get_transaction_history(
    State(state): State<Arc<AppState>>,
    Path(address): Path<String>,
) -> ApiResult<TransactionHistoryResponse> {
    let user = state
        .store
        .get_user_by_wallet_addr(&address)
        .await
        .map_err(|e| garden::api::internal_error(&format!("Database error: {}", e)))?
        .ok_or_else(|| garden::api::not_found("Address not found"))?;

    let transactions = state
        .store
        .get_user_transactions(&user.user_id, Some(100))
        .await
        .map_err(|e| {
            garden::api::internal_error(&format!("Failed to fetch transactions: {}", e))
        })?;

    let total_count = transactions.len();

    Ok(Response::ok(TransactionHistoryResponse {
        transactions,
        total_count,
    }))
}

// Get deposit monitor status
async fn get_monitor_status(
    State(state): State<Arc<AppState>>,
) -> ApiResult<MonitorStatusResponse> {
    // Create a temporary monitor instance to get status
    let monitor_config = DepositMonitorConfig::default();
    let monitor = DepositMonitor::new(state.store.clone(), monitor_config);
    let status = monitor.get_status().await;

    Ok(Response::ok(MonitorStatusResponse { status }))
}



// Trigger manual deposit check
async fn trigger_deposit_check(State(state): State<Arc<AppState>>) -> ApiResult<serde_json::Value> {
    let monitor_config = DepositMonitorConfig::default();
    let monitor = DepositMonitor::new(state.store.clone(), monitor_config);

    let result = monitor
        .trigger_manual_check()
        .await
        .map_err(|e| garden::api::internal_error(&format!("Failed to check deposits: {}", e)))?;

    Ok(Response::ok(serde_json::json!({
        "processed_deposits": result.processed_deposits.len(),
        "failed_deposits": result.failed_deposits.len(),
        "details": {
            "processed": result.processed_deposits,
            "failed": result.failed_deposits
        }
    })))
}

#[derive(Deserialize)]
struct RefreshBalanceRequest {
    wallet_address: String,
}

#[derive(Serialize)]
struct RefreshBalanceResponse {
    account_balance: String,
    in_game_balance: String,
    user_id: String,
    game_address: String,
    deposits_found: u32,
    total_new_deposit_amount: String,
}

// ARB Sepolia RPC endpoint
const ARB_SEPOLIA_RPC: &str = "https://sepolia-rollup.arbitrum.io/rpc";

async fn refresh_balance(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<RefreshBalanceRequest>,
) -> ApiResult<RefreshBalanceResponse> {
    // Get user from database
    let user = state.store.get_user_by_wallet_addr(&payload.wallet_address).await
        .map_err(|e| garden::api::internal_error(&format!("Database error: {}", e)))?
        .ok_or_else(|| garden::api::not_found("User not found"))?;

    // Check the game address (owned by us) for deposits from user's original wallet
    let address_to_check = user.evm_addr.clone(); // This is the game address we control

    // Check ARB Sepolia for new deposits
    let (deposits_found, total_new_deposit_amount) = check_arb_sepolia_deposits(&address_to_check, &user, &state).await
        .map_err(|e| garden::api::internal_error(&format!("Failed to check ARB Sepolia deposits: {}", e)))?;

    // Get updated user data after potential deposits
    let updated_user = if deposits_found > 0 {
        state.store.get_user_by_wallet_addr(&payload.wallet_address).await
            .map_err(|e| garden::api::internal_error(&format!("Database error: {}", e)))?
            .ok_or_else(|| garden::api::not_found("User not found"))?
    } else {
        user
    };

    let response = RefreshBalanceResponse {
        account_balance: updated_user.account_balance.to_string(),
        in_game_balance: updated_user.in_game_balance.to_string(),
        user_id: updated_user.user_id,
        game_address: updated_user.evm_addr,
        deposits_found,
        total_new_deposit_amount: total_new_deposit_amount.to_string(),
    };

    Ok(Response::ok(response))
}

async fn check_arb_sepolia_deposits(
    address_to_check: &str, 
    user: &crate::store::User, 
    state: &Arc<AppState>
) -> Result<(u32, BigDecimal), Box<dyn std::error::Error + Send + Sync>> {
    // Create provider for ARB Sepolia
    let provider = ProviderBuilder::new()
        .connect_http(ARB_SEPOLIA_RPC.parse()?);

    // Parse the address
    let address: Address = address_to_check.parse()
        .map_err(|e| format!("Invalid address format: {}", e))?;

    // Get current balance
    let balance_wei: U256 = provider.get_balance(address).await
        .map_err(|e| format!("Failed to get balance: {}", e))?;

    // Convert to ETH (BigDecimal)
    let balance_eth_str = alloy::primitives::utils::format_ether(balance_wei);
    let current_balance = BigDecimal::from_str(&balance_eth_str)
        .map_err(|e| format!("Failed to parse balance: {}", e))?;

    // Get the last known balance from our database (using account_balance as reference)
    let last_known_balance = &user.account_balance;

    // Calculate difference
    let balance_difference = &current_balance - last_known_balance;

    // If there's a positive difference, it means new deposits
    if balance_difference > BigDecimal::from(0) {
        // Process the deposit
        let _updated_user = state.store.process_deposit(&user.user_id, &balance_difference).await
            .map_err(|e| format!("Failed to process deposit: {}", e))?;

        // Record transaction
        let transaction = crate::store::GameTransaction {
            id: String::new(),
            user_id: user.user_id.clone(),
            transaction_type: "deposit".to_string(),
            amount: balance_difference.clone(),
            game_type: None,
            game_session_id: None,
            description: Some(format!(
                "ARB Sepolia deposit detected in game address: {} (user's original wallet: {})", 
                address_to_check,
                user.original_wallet_addr.as_ref().unwrap_or(&"Unknown".to_string())
            )),
            created_at: None,
        };

        let _recorded_transaction = state.store.create_transaction(&transaction).await
            .map_err(|e| format!("Failed to record transaction: {}", e))?;

        tracing::info!(
            "New deposit detected: {} ETH for user {} in game address {} (from user's wallet: {})",
            balance_difference,
            user.user_id,
            address_to_check,
            user.original_wallet_addr.as_ref().unwrap_or(&"Unknown".to_string())
        );

        Ok((1, balance_difference))
    } else {
        // No new deposits found
        Ok((0, BigDecimal::from(0)))
    }
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
        .route("/monitor/status", get(get_monitor_status))
        .route("/monitor/check", post(trigger_deposit_check))
        .route("/refresh-balance", post(refresh_balance))
        .with_state(state)
}
