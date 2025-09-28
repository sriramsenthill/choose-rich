use crate::{
    mines::{
        CashoutRequest, CashoutResponse, GameSession, MoveRequest, MoveResponse, SESSION_TTL,
        SessionStatus, StartGameRequest, StartGameResponse,
    },
    primitives::new_moka_cache,
    server::{AppState, Service},
    store::GameTransaction,
};
use axum::{
    Json, Router,
    extract::State,
    routing::post,
};
use garden::api::{
    bad_request, internal_error,
    primitives::{ApiResult, Response},
};
use serde_json::to_value;
use sqlx::types::BigDecimal;
use std::{sync::Arc, str::FromStr};

async fn start_game(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<StartGameRequest>,
) -> ApiResult<StartGameResponse> {
    // Get user from database using game_address
    let user = state.store.get_user_by_evm_addr(&payload.game_address).await
        .map_err(|e| internal_error(&format!("Database error: {}", e)))?
        .ok_or_else(|| bad_request("User not found for game address"))?;

    // Check if user has enough in-game balance
    let bet_amount = BigDecimal::from_str(&payload.amount.to_string())
        .map_err(|_| bad_request("Invalid amount format"))?;
    if user.in_game_balance < bet_amount {
        return Err(bad_request("Insufficient in-game balance"));
    }

    // Deduct bet amount from user's in-game balance
    let _updated_user = state.store.adjust_in_game_balance(&user.user_id, &(-bet_amount.clone())).await
        .map_err(|e| internal_error(&format!("Failed to deduct in-game balance: {}", e)))?;

    let session = GameSession::new(payload.amount, payload.blocks, payload.mines, user.user_id.clone()).await
        .map_err(|e| bad_request(&e.to_string()))?;

    // Record game start transaction
    let transaction = GameTransaction {
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
        .map_err(|e| internal_error(&format!("Failed to record transaction: {}", e)))?;

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
            let cache = new_moka_cache(SESSION_TTL);
            state.sessions.insert(Service::Mines, cache.clone()).await;
            cache
        }
    };

    service_state
        .insert(
            session.id.clone(),
            to_value(&session).map_err(|_| internal_error("Serialization error"))?,
        )
        .await;

    Ok(Response::ok(response))
}

async fn make_move(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<MoveRequest>,
) -> ApiResult<MoveResponse> {
    // Get user from database using game_address
    let user = state.store.get_user_by_evm_addr(&payload.game_address).await
        .map_err(|e| internal_error(&format!("Database error: {}", e)))?
        .ok_or_else(|| bad_request("User not found for game address"))?;

    let service_state = state
        .sessions
        .get(&Service::Mines)
        .await
        .ok_or(bad_request("Session not found"))?;
    let mut session: GameSession = service_state
        .get(&payload.id)
        .await
        .and_then(|v| serde_json::from_value(v.clone()).ok())
        .ok_or(bad_request("Session not found"))?;

    let response = session
        .make_move(payload.block, user.user_id.clone())
        .map_err(|e| bad_request(&e.to_string()))?;
    service_state
        .insert(
            session.id.clone(),
            to_value(&session).map_err(|_| internal_error("Serialization error"))?,
        )
        .await;

    if response.session_status == SessionStatus::Ended {
        // If the game ended (hit a mine), no additional balance changes needed
        // as the bet was already deducted when the game started
        service_state.remove(&payload.id).await;
    }

    Ok(Response::ok(response))
}

async fn cashout(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<CashoutRequest>,
) -> ApiResult<CashoutResponse> {
    // Get user from database using game_address
    let user = state.store.get_user_by_evm_addr(&payload.game_address).await
        .map_err(|e| internal_error(&format!("Database error: {}", e)))?
        .ok_or_else(|| bad_request("User not found for game address"))?;

    let service_state = state
        .sessions
        .get(&Service::Mines)
        .await
        .ok_or(bad_request("Session not found"))?;
    let mut session: GameSession = service_state
        .get(&payload.id)
        .await
        .and_then(|v| serde_json::from_value(v.clone()).ok())
        .ok_or(bad_request("Session not found"))?;

    let response = session
        .cashout(user.user_id.clone())
        .map_err(|e| bad_request(&e.to_string()))?;

    // Add winnings to user's balance
    let payout_amount = BigDecimal::from_str(&response.final_payout.to_string())
        .map_err(|_| internal_error("Invalid payout amount"))?;
    if payout_amount > BigDecimal::from(0) {
        let _updated_user = state.store.adjust_in_game_balance(&user.user_id, &payout_amount).await
            .map_err(|e| internal_error(&format!("Failed to add winnings: {}", e)))?;

        // Record win transaction
        let win_transaction = GameTransaction {
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
            .map_err(|e| internal_error(&format!("Failed to record win transaction: {}", e)))?;
    }

    service_state
        .insert(
            session.id.clone(),
            to_value(&session).map_err(|_| internal_error("Serialization error"))?,
        )
        .await;

    Ok(Response::ok(response))
}

async fn health_check() -> &'static str {
    "Mines API is running!"
}

pub async fn router(state: Arc<AppState>) -> Router {
    Router::new()
        .route("/mines/start", post(start_game))
        .route("/mines/move", post(make_move))
        .route("/mines/cashout", post(cashout))
        .with_state(state)
}
