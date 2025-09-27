mod db_store;
pub use db_store::*;
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
    pub booky_balance: BigDecimal,
}

impl User {
    pub fn new(
        user_id: String,
        username: String,
        password: String,
        pk: String,
        evm_addr: String,
        original_wallet_addr: Option<String>,
        booky_balance: BigDecimal,
    ) -> Self {
        Self {
            user_id, // Will be set by DB
            username,
            password,
            pk,
            evm_addr,
            original_wallet_addr,
            booky_balance,
        }
    }
}
