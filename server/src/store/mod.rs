mod db_store;
pub use db_store::*;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::types::BigDecimal;

#[derive(Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct User {
    pub user_id: String,
    pub username: String,
    pub password: String,
    pub pk: String,
    pub evm_addr: String,
    pub original_wallet_addr: Option<String>,
    pub game_balance: BigDecimal,
    #[serde(with = "chrono::serde::ts_seconds_option")]
    pub created_at: Option<DateTime<Utc>>,
    #[serde(with = "chrono::serde::ts_seconds_option")]
    pub updated_at: Option<DateTime<Utc>>,
}

#[derive(Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct GameTransaction {
    pub id: String,
    pub user_id: String,
    pub transaction_type: String,
    pub amount: BigDecimal,
    pub game_type: Option<String>,
    pub game_session_id: Option<String>,
    pub description: Option<String>,
    #[serde(with = "chrono::serde::ts_seconds_option")]
    pub created_at: Option<DateTime<Utc>>,
}

impl User {
    pub fn new(
        user_id: String,
        username: String,
        password: String,
        pk: String,
        evm_addr: String,
        original_wallet_addr: Option<String>,
        game_balance: BigDecimal,
    ) -> Self {
        Self {
            user_id, // Will be set by DB
            username,
            password,
            pk,
            evm_addr,
            original_wallet_addr,
            game_balance,
            created_at: None, // Will be set by DB
            updated_at: None, // Will be set by DB
        }
    }
}
