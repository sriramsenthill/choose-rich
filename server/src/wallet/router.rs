use crate::{
    server::AppState,
    wallet::{connect_wallet, WalletConnectionRequest, WalletConnectionResponse},
};
use axum::{
    extract::State,
    routing::post,
    Json, Router,
};
use garden::api::primitives::ApiResult;
use std::sync::Arc;

// Wallet connection endpoint
async fn wallet_connect(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<WalletConnectionRequest>,
) -> ApiResult<WalletConnectionResponse> {
    connect_wallet(payload.wallet_address, &state.store).await
}

async fn health_check() -> &'static str {
    "Wallet API is running!"
}

pub async fn router(state: Arc<AppState>) -> Router {
    Router::new()
        .route("/wallet/connect", post(wallet_connect))
        .route("/wallet/health", axum::routing::get(health_check))
        .with_state(state)
}


