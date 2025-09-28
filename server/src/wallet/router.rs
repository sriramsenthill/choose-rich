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
use crate::mines::{
    CashoutRequest as MinesCashoutRequest, CashoutResponse as MinesCashoutResponse, 
    MoveRequest, MoveResponse, StartGameRequest, StartGameResponse, GameSession, SessionStatus
};
use crate::apex::{
    StartGameRequest as ApexStartGameRequest, StartGameResponse as ApexStartGameResponse,
    ChooseRequest as ApexChooseRequest, ChooseResponse as ApexChooseResponse,
    GameSession as ApexGameSession, GameOption
};
use crate::primitives::new_moka_cache;
use crate::server::Service;
use serde_json::to_value;

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
struct WalletCashoutRequest {
    amount: String, // Amount to cashout
}

#[derive(Serialize)]
struct WalletCashoutResponse {
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
    Json(payload): Json<WalletCashoutRequest>,
) -> ApiResult<WalletCashoutResponse> {
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

    Ok(Response::ok(WalletCashoutResponse {
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

// Mines game functions
async fn start_mines_game(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<StartGameRequest>,
) -> ApiResult<StartGameResponse> {
    // Get user from database using game_address
    let user = state.store.get_user_by_evm_addr(&payload.game_address).await
        .map_err(|e| garden::api::internal_error(&format!("Database error: {}", e)))?
        .ok_or_else(|| garden::api::bad_request("User not found for game address"))?;

    // Check if user has enough in-game balance
    let bet_amount = BigDecimal::from_str(&payload.amount.to_string())
        .map_err(|_| garden::api::bad_request("Invalid amount format"))?;
    if user.in_game_balance < bet_amount {
        return Err(garden::api::bad_request("Insufficient in-game balance"));
    }

    // Deduct bet amount from user's in-game balance
    let _updated_user = state.store.adjust_in_game_balance(&user.user_id, &(-bet_amount.clone())).await
        .map_err(|e| garden::api::internal_error(&format!("Failed to deduct in-game balance: {}", e)))?;

    let session = GameSession::new(payload.amount, payload.blocks, payload.mines, user.user_id.clone()).await
        .map_err(|e| garden::api::bad_request(&e.to_string()))?;

    // Record game start transaction
    let transaction = crate::store::GameTransaction {
        id: String::new(),
        user_id: user.user_id.clone(),
        transaction_type: "game_loss".to_string(), // Initially treat as loss, will change if they win
        amount: bet_amount,
        game_type: Some("mines".to_string()),
        game_session_id: Some(session.id.clone()),
        description: Some("Mines game bet".to_string()),
        created_at: None,
    };

    let _recorded_transaction = state.store.create_transaction(&transaction).await
        .map_err(|e| garden::api::internal_error(&format!("Failed to record transaction: {}", e)))?;

    let response = StartGameResponse {
        id: session.id.clone(),
        amount: payload.amount,
        blocks: payload.blocks,
        mines: payload.mines,
        session_status: SessionStatus::Active,
    };

    let service_state = match state.sessions.get(&Service::Mines).await {
        Some(cache) => cache,
        None => {
            let cache = new_moka_cache(std::time::Duration::from_secs(30 * 60));
            state.sessions.insert(Service::Mines, cache.clone()).await;
            cache
        }
    };

    service_state
        .insert(
            session.id.clone(),
            to_value(&session).map_err(|_| garden::api::internal_error("Serialization error"))?,
        )
        .await;

    Ok(Response::ok(response))
}

async fn make_mines_move(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<MoveRequest>,
) -> ApiResult<MoveResponse> {
    // Get user from database using game_address
    let user = state.store.get_user_by_evm_addr(&payload.game_address).await
        .map_err(|e| garden::api::internal_error(&format!("Database error: {}", e)))?
        .ok_or_else(|| garden::api::bad_request("User not found for game address"))?;

    let service_state = state
        .sessions
        .get(&Service::Mines)
        .await
        .ok_or(garden::api::bad_request("Session not found"))?;
    let mut session: GameSession = service_state
        .get(&payload.id)
        .await
        .and_then(|v| serde_json::from_value(v.clone()).ok())
        .ok_or(garden::api::bad_request("Session not found"))?;

    let response = session
        .make_move(payload.block, user.user_id.clone())
        .map_err(|e| garden::api::bad_request(&e.to_string()))?;
    service_state
        .insert(
            session.id.clone(),
            to_value(&session).map_err(|_| garden::api::internal_error("Serialization error"))?,
        )
        .await;

    if response.session_status == SessionStatus::Ended {
        // If the game ended (hit a mine), no additional balance changes needed
        // as the bet was already deducted when the game started
        service_state.remove(&payload.id).await;
    }

    Ok(Response::ok(response))
}

async fn cashout_mines_game(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<MinesCashoutRequest>,
) -> ApiResult<MinesCashoutResponse> {
    // Get user from database using game_address
    let user = state.store.get_user_by_evm_addr(&payload.game_address).await
        .map_err(|e| garden::api::internal_error(&format!("Database error: {}", e)))?
        .ok_or_else(|| garden::api::bad_request("User not found for game address"))?;

    let service_state = state
        .sessions
        .get(&Service::Mines)
        .await
        .ok_or(garden::api::bad_request("Session not found"))?;
    let mut session: GameSession = service_state
        .get(&payload.id)
        .await
        .and_then(|v| serde_json::from_value(v.clone()).ok())
        .ok_or(garden::api::bad_request("Session not found"))?;

    let response = session
        .cashout(user.user_id.clone())
        .map_err(|e| garden::api::bad_request(&e.to_string()))?;

    // Add winnings to user's balance
    let payout_amount = BigDecimal::from_str(&response.final_payout.to_string())
        .map_err(|_| garden::api::internal_error("Invalid payout amount"))?;
    if payout_amount > BigDecimal::from(0) {
        let _updated_user = state.store.adjust_in_game_balance(&user.user_id, &payout_amount).await
            .map_err(|e| garden::api::internal_error(&format!("Failed to add winnings: {}", e)))?;

        // Record win transaction
        let win_transaction = crate::store::GameTransaction {
            id: String::new(),
            user_id: user.user_id.clone(),
            transaction_type: "game_win".to_string(),
            amount: payout_amount,
            game_type: Some("mines".to_string()),
            game_session_id: Some(session.id.clone()),
            description: Some(format!("Mines game cashout - won {} from bet of {}", response.final_payout, response.src)),
            created_at: None,
        };

        let _win_recorded = state.store.create_transaction(&win_transaction).await
            .map_err(|e| garden::api::internal_error(&format!("Failed to record win transaction: {}", e)))?;
    }

    service_state
        .insert(
            session.id.clone(),
            to_value(&session).map_err(|_| garden::api::internal_error("Serialization error"))?,
        )
        .await;

    Ok(Response::ok(response))
}

// Apex game functions
async fn start_apex_game(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<ApexStartGameRequest>,
) -> ApiResult<ApexStartGameResponse> {
    // Get user from database using game_address
    let user = state.store.get_user_by_evm_addr(&payload.game_address).await
        .map_err(|e| garden::api::internal_error(&format!("Database error: {}", e)))?
        .ok_or_else(|| garden::api::bad_request("User not found for game address"))?;

    // Check if user has enough in-game balance
    let bet_amount = BigDecimal::from_str(&payload.amount.to_string())
        .map_err(|_| garden::api::bad_request("Invalid amount format"))?;
    if user.in_game_balance < bet_amount {
        return Err(garden::api::bad_request("Insufficient in-game balance"));
    }

    // Deduct bet amount from user's in-game balance
    let _updated_user = state.store.adjust_in_game_balance(&user.user_id, &(-bet_amount.clone())).await
        .map_err(|e| garden::api::internal_error(&format!("Failed to deduct in-game balance: {}", e)))?;

    let session = ApexGameSession::new(payload.amount, payload.option.clone()).await
        .map_err(|e| garden::api::internal_error(&format!("Failed to create game session: {}", e)))?;

    // Handle different game options
    let (payout_high, probability_high, payout_low, probability_low, payout_equal, probability_equal, payout_percentage, blinder_result) = match payload.option {
        GameOption::Blinder => {
            let mut session_mut = session.clone();
            let blinder_result = session_mut.get_blinder_result()
                .map_err(|e| garden::api::bad_request(&e.to_string()))?;
            let probability = 0.45; // 45% win probability
            let payout_percentage = (1.0 - 0.01) / probability;
            
            // Handle blinder result immediately since it's auto-resolved
            if blinder_result.won && blinder_result.payout > 0.0 {
                let payout_amount = BigDecimal::from_str(&blinder_result.payout.to_string())
                    .map_err(|_| garden::api::internal_error("Invalid payout amount"))?;
                let _updated_user = state.store.adjust_in_game_balance(&user.user_id, &payout_amount).await
                    .map_err(|e| garden::api::internal_error(&format!("Failed to add winnings: {}", e)))?;

                // Record win transaction
                let win_transaction = crate::store::GameTransaction {
                    id: String::new(),
                    user_id: user.user_id.clone(),
                    transaction_type: "game_win".to_string(),
                    amount: payout_amount,
                    game_type: Some("apex".to_string()),
                    game_session_id: Some(session.id.clone()),
                    description: Some("Apex blinder game win".to_string()),
                    created_at: None,
                };
                let _win_recorded = state.store.create_transaction(&win_transaction).await
                    .map_err(|e| garden::api::internal_error(&format!("Failed to record win transaction: {}", e)))?;
            }

            // Record initial bet transaction
            let bet_transaction = crate::store::GameTransaction {
                id: String::new(),
                user_id: user.user_id.clone(),
                transaction_type: if blinder_result.won { "game_win" } else { "game_loss" }.to_string(),
                amount: bet_amount.clone(),
                game_type: Some("apex".to_string()),
                game_session_id: Some(session.id.clone()),
                description: Some("Apex blinder game bet".to_string()),
                created_at: None,
            };
            let _bet_recorded = state.store.create_transaction(&bet_transaction).await
                .map_err(|e| garden::api::internal_error(&format!("Failed to record bet transaction: {}", e)))?;

            (
                None,
                None,
                None,
                None,
                None,
                None,
                Some(payout_percentage),
                Some(blinder_result),
            )
        }
        GameOption::NonBlinder => {
            let high_prob = (9 - session.system_number) as f64 / 10.0;
            let low_prob = session.system_number as f64 / 10.0;
            let equal_prob = 1.0 / 10.0;
            let high_payout = if high_prob > 0.0 {
                (1.0 - 0.01) / high_prob
            } else {
                0.0
            };
            let low_payout = if low_prob > 0.0 {
                (1.0 - 0.01) / low_prob
            } else {
                0.0
            };
            let equal_payout = (1.0 - 0.01) / equal_prob;

            // Record initial bet transaction for non-blinder (will be resolved when choice is made)
            let bet_transaction = crate::store::GameTransaction {
                id: String::new(),
                user_id: user.user_id.clone(),
                transaction_type: "game_loss".to_string(), // Initially treat as loss, will add win if they win
                amount: bet_amount.clone(),
                game_type: Some("apex".to_string()),
                game_session_id: Some(session.id.clone()),
                description: Some("Apex non-blinder game bet".to_string()),
                created_at: None,
            };
            let _bet_recorded = state.store.create_transaction(&bet_transaction).await
                .map_err(|e| garden::api::internal_error(&format!("Failed to record bet transaction: {}", e)))?;

            (
                Some(high_payout),
                Some(high_prob),
                Some(low_payout),
                Some(low_prob),
                Some(equal_payout),
                Some(equal_prob),
                None,
                None,
            )
        }
    };

    let response = ApexStartGameResponse {
        id: session.id.clone(),
        amount: payload.amount,
        option: payload.option,
        system_number: session.system_number,
        user_number: session.user_number,
        payout_high,
        probability_high,
        payout_low,
        probability_low,
        payout_equal,
        probability_equal,
        payout_percentage,
        blinder_suit: blinder_result,
        session_status: session.status.clone(),
    };

    let service_state = match state.sessions.get(&Service::Apex).await {
        Some(cache) => cache,
        None => {
            let cache = new_moka_cache(std::time::Duration::from_secs(30 * 60));
            state.sessions.insert(Service::Apex, cache.clone()).await;
            cache
        }
    };

    service_state
        .insert(
            session.id.clone(),
            to_value(&session).map_err(|_| garden::api::internal_error("Serialization error"))?,
        )
        .await;

    Ok(Response::ok(response))
}

async fn make_apex_choice(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<ApexChooseRequest>,
) -> ApiResult<ApexChooseResponse> {
    // Get user from database using game_address
    let user = state.store.get_user_by_evm_addr(&payload.game_address).await
        .map_err(|e| garden::api::internal_error(&format!("Database error: {}", e)))?
        .ok_or_else(|| garden::api::bad_request("User not found for game address"))?;

    let service_state = state
        .sessions
        .get(&Service::Apex)
        .await
        .ok_or(garden::api::bad_request("Session not found"))?;
    let mut session: ApexGameSession = service_state
        .get(&payload.id)
        .await
        .and_then(|v| serde_json::from_value(v.clone()).ok())
        .ok_or(garden::api::bad_request("Session not found"))?;
    
    let response = session
        .make_choice(payload.choice).await
        .map_err(|e| garden::api::bad_request(&e.to_string()))?;
    
    // Handle winnings
    if response.won && response.payout > 0.0 {
        let payout_amount = BigDecimal::from_str(&response.payout.to_string())
            .map_err(|_| garden::api::internal_error("Invalid payout amount"))?;
        let _updated_user = state.store.adjust_in_game_balance(&user.user_id, &payout_amount).await
            .map_err(|e| garden::api::internal_error(&format!("Failed to add winnings: {}", e)))?;

        // Record win transaction
        let win_transaction = crate::store::GameTransaction {
            id: String::new(),
            user_id: user.user_id.clone(),
            transaction_type: "game_win".to_string(),
            amount: payout_amount,
            game_type: Some("apex".to_string()),
            game_session_id: Some(session.id.clone()),
            description: Some(format!("Apex choice win - {} payout from choice {:?}", response.payout, response.choice)),
            created_at: None,
        };
        let _win_recorded = state.store.create_transaction(&win_transaction).await
            .map_err(|e| garden::api::internal_error(&format!("Failed to record win transaction: {}", e)))?;
    }

    service_state
        .insert(
            session.id.clone(),
            to_value(&session).map_err(|_| garden::api::internal_error("Serialization error"))?,
        )
        .await;
    Ok(Response::ok(response))
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
        .route("/mines/start", post(start_mines_game))
        .route("/mines/move", post(make_mines_move))
        .route("/mines/cashout", post(cashout_mines_game))
        .route("/apex/start", post(start_apex_game))
        .route("/apex/choose", post(make_apex_choice))
        .with_state(state)
}
