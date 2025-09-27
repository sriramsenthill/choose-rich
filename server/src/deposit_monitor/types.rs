use serde::{Deserialize, Serialize};
use sqlx::types::BigDecimal;
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PendingDeposit {
    pub user_id: String,
    pub game_address: String,
    pub amount: BigDecimal,
    pub transaction_hash: String,
    pub block_number: u64,
    pub confirmation_count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DepositEvent {
    pub from_address: String,
    pub to_address: String,
    pub amount: BigDecimal,
    pub transaction_hash: String,
    pub block_number: u64,
    pub timestamp: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MonitoredAddress {
    pub user_id: String,
    pub game_address: String,
    pub last_checked_block: u64,
}

#[derive(Debug, Clone)]
pub struct DepositMonitorConfig {
    pub check_interval_secs: u64,
    pub required_confirmations: u32,
    pub rpc_url: Option<String>,
    pub enable_simulation: bool,
    pub simulation_probability: f64, // Probability of generating a random deposit (0.0 to 1.0)
}

impl Default for DepositMonitorConfig {
    fn default() -> Self {
        Self {
            check_interval_secs: 5,
            required_confirmations: 3,
            rpc_url: None,
            enable_simulation: true,
            simulation_probability: 0.01, // 1% chance per check cycle
        }
    }
}

#[derive(Debug, Clone)]
pub struct DepositResult {
    pub processed_deposits: Vec<ProcessedDeposit>,
    pub failed_deposits: Vec<FailedDeposit>,
}

#[derive(Debug, Clone)]
pub struct ProcessedDeposit {
    pub user_id: String,
    pub game_address: String,
    pub amount: BigDecimal,
    pub transaction_hash: String,
    pub new_balance: BigDecimal,
    pub transaction_id: String,
}

#[derive(Debug, Clone)]
pub struct FailedDeposit {
    pub user_id: String,
    pub game_address: String,
    pub amount: BigDecimal,
    pub transaction_hash: String,
    pub error: String,
}

// Cache for tracking processed transactions to avoid duplicates
pub type ProcessedTransactionCache = HashMap<String, bool>;

// In-memory simulation state for development/testing
#[derive(Debug, Clone)]
pub struct SimulationState {
    pub pending_deposits: HashMap<String, Vec<PendingDeposit>>,
    pub processed_transactions: ProcessedTransactionCache,
    pub current_block: u64,
}

impl Default for SimulationState {
    fn default() -> Self {
        Self {
            pending_deposits: HashMap::new(),
            processed_transactions: HashMap::new(),
            current_block: 1000000, // Start at a reasonable block number
        }
    }
}
