use crate::{
    deposit_monitor::{
        DepositEvent, DepositMonitorConfig, DepositResult, FailedDeposit, MonitoredAddress,
        PendingDeposit, ProcessedDeposit, SimulationState,
    },
    store::{GameTransaction, Store},
};
use alloy::{
    network::EthereumWallet,
    providers::{Provider, ProviderBuilder},
    rpc::types::{Block, Filter, Log, TransactionReceipt},
    transports::http::{Client, Http},
};
use rand::Rng;
use sqlx::{types::BigDecimal, Row};
use std::{
    collections::HashMap,
    str::FromStr,
    sync::{Arc, Mutex},
    time::Duration,
};
use tokio::time;
use tracing::{debug, error, info, warn};

pub struct DepositMonitor {
    store: Arc<Store>,
    config: DepositMonitorConfig,
    simulation_state: Arc<Mutex<SimulationState>>,
    is_running: Arc<Mutex<bool>>,
}

impl DepositMonitor {
    pub fn new(store: Arc<Store>, config: DepositMonitorConfig) -> Self {
        Self {
            store,
            config,
            simulation_state: Arc::new(Mutex::new(SimulationState::default())),
            is_running: Arc::new(Mutex::new(false)),
        }
    }

    pub async fn start(&self) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        {
            let mut running = self.is_running.lock().unwrap();
            if *running {
                warn!("Deposit monitor is already running");
                return Ok(());
            }
            *running = true;
        }

        info!(
            "Starting deposit monitor with {} second intervals",
            self.config.check_interval_secs
        );

        let store = Arc::clone(&self.store);
        let config = self.config.clone();
        let simulation_state = Arc::clone(&self.simulation_state);
        let is_running = Arc::clone(&self.is_running);

        tokio::spawn(async move {
            let mut interval = time::interval(Duration::from_secs(config.check_interval_secs));

            loop {
                // Check if we should stop
                {
                    let running = is_running.lock().unwrap();
                    if !*running {
                        break;
                    }
                }

                interval.tick().await;

                let monitor = DepositMonitor {
                    store: Arc::clone(&store),
                    config: config.clone(),
                    simulation_state: Arc::clone(&simulation_state),
                    is_running: Arc::clone(&is_running),
                };

                match monitor.check_deposits().await {
                    Ok(result) => {
                        if !result.processed_deposits.is_empty() || !result.failed_deposits.is_empty()
                        {
                            info!(
                                "Deposit check completed: {} processed, {} failed",
                                result.processed_deposits.len(),
                                result.failed_deposits.len()
                            );

                            // Log successful deposits
                            for deposit in &result.processed_deposits {
                                info!(
                                    "Processed deposit: {} to {} (user: {}) - new balance: {}",
                                    deposit.amount,
                                    deposit.game_address,
                                    deposit.user_id,
                                    deposit.new_balance
                                );
                            }

                            // Log failed deposits
                            for failed in &result.failed_deposits {
                                error!(
                                    "Failed to process deposit: {} to {} - {}",
                                    failed.amount, failed.game_address, failed.error
                                );
                            }
                        } else {
                            debug!("No new deposits detected");
                        }
                    }
                    Err(e) => {
                        error!("Error during deposit check: {}", e);
                    }
                }
            }

            info!("Deposit monitor stopped");
        });

        Ok(())
    }

    pub async fn stop(&self) {
        let mut running = self.is_running.lock().unwrap();
        *running = false;
        info!("Deposit monitor stop requested");
    }

    pub async fn check_deposits(&self) -> Result<DepositResult, Box<dyn std::error::Error + Send + Sync>> {
        debug!("Starting deposit check cycle");

        // Get all game addresses from the database
        let monitored_addresses = self.get_monitored_addresses().await?;
        debug!("Monitoring {} addresses", monitored_addresses.len());

        let mut processed_deposits = Vec::new();
        let mut failed_deposits = Vec::new();

        if self.config.enable_simulation {
            // Use simulation mode for development/testing
            let deposits = self.simulate_deposits(&monitored_addresses).await?;
            debug!("Simulated {} deposits", deposits.len());

            for deposit in deposits {
                match self.process_deposit(deposit).await {
                    Ok(processed) => processed_deposits.push(processed),
                    Err(e) => {
                        error!("Failed to process simulated deposit: {}", e);
                        // We don't have enough info to create FailedDeposit here
                    }
                }
            }
        } else {
            // Real blockchain monitoring (placeholder for now)
            warn!("Real blockchain monitoring not yet implemented - using simulation");
            // TODO: Implement real blockchain monitoring
        }

        Ok(DepositResult {
            processed_deposits,
            failed_deposits,
        })
    }

    async fn get_monitored_addresses(&self) -> Result<Vec<MonitoredAddress>, Box<dyn std::error::Error + Send + Sync>> {
        // Query database for all user game addresses
        let users = sqlx::query("SELECT user_id, evm_addr FROM users WHERE evm_addr IS NOT NULL")
            .fetch_all(self.store.pool())
            .await?;

        let addresses = users
            .into_iter()
            .filter_map(|row| {
                let user_id: String = row.try_get("user_id").ok()?;
                let evm_addr: String = row.try_get("evm_addr").ok()?;
                Some(MonitoredAddress {
                    user_id,
                    game_address: evm_addr,
                    last_checked_block: 0, // Will be tracked separately in real implementation
                })
            })
            .collect();

        Ok(addresses)
    }

    async fn simulate_deposits(
        &self,
        addresses: &[MonitoredAddress],
    ) -> Result<Vec<DepositEvent>, Box<dyn std::error::Error + Send + Sync>> {
        let mut deposits = Vec::new();
        let mut rng = rand::thread_rng();

        // Update simulation state
        {
            let mut state = self.simulation_state.lock().unwrap();
            state.current_block += 1;
        }

        // For each address, randomly generate deposits based on probability
        for address in addresses {
            if rng.r#gen::<f64>() < self.config.simulation_probability {
                // Generate a random deposit amount between 0.001 and 10 ETH (in Wei-like units)
                let amount_eth = rng.gen_range(0.001..10.0);
                let amount = BigDecimal::from_str(&amount_eth.to_string())?;

                // Generate a fake transaction hash
                let tx_hash = format!(
                    "0x{:064x}",
                    rng.r#gen::<u64>() as u128 * rng.r#gen::<u64>() as u128
                );

                let current_block = {
                    let state = self.simulation_state.lock().unwrap();
                    state.current_block
                };

                // Check if we've already processed this transaction
                let processed = {
                    let state = self.simulation_state.lock().unwrap();
                    state.processed_transactions.contains_key(&tx_hash)
                };

                if !processed {
                    let deposit = DepositEvent {
                        from_address: format!("0x{:040x}", rng.r#gen::<u128>()),
                        to_address: address.game_address.clone(),
                        amount,
                        transaction_hash: tx_hash.clone(),
                        block_number: current_block,
                        timestamp: chrono::Utc::now().timestamp(),
                    };

                    deposits.push(deposit);

                    // Mark as processed in simulation state
                    {
                        let mut state = self.simulation_state.lock().unwrap();
                        state.processed_transactions.insert(tx_hash, true);
                    }
                }
            }
        }

        if !deposits.is_empty() {
            debug!("Simulated {} deposits", deposits.len());
        }

        Ok(deposits)
    }

    async fn process_deposit(
        &self,
        deposit: DepositEvent,
    ) -> Result<ProcessedDeposit, Box<dyn std::error::Error + Send + Sync>> {
        debug!(
            "Processing deposit: {} to {} (tx: {})",
            deposit.amount, deposit.to_address, deposit.transaction_hash
        );

        // Get user by game address
        let user = self
            .store
            .get_user_by_evm_addr(&deposit.to_address)
            .await?
            .ok_or_else(|| format!("User not found for address: {}", deposit.to_address))?;

        // Update user balance
        let updated_user = self
            .store
            .adjust_user_balance(&user.user_id, &deposit.amount)
            .await?;

        // Record transaction
        let transaction = GameTransaction {
            id: String::new(),
            user_id: user.user_id.clone(),
            transaction_type: "deposit".to_string(),
            amount: deposit.amount.clone(),
            game_type: None,
            game_session_id: None,
            description: Some(format!(
                "Deposit from blockchain - tx: {}",
                deposit.transaction_hash
            )),
            created_at: None,
        };

        let recorded_transaction = self.store.create_transaction(&transaction).await?;

        info!(
            "Successfully processed deposit of {} for user {} to address {} - new balance: {}",
            deposit.amount, user.user_id, deposit.to_address, updated_user.game_balance
        );

        Ok(ProcessedDeposit {
            user_id: user.user_id,
            game_address: deposit.to_address,
            amount: deposit.amount,
            transaction_hash: deposit.transaction_hash,
            new_balance: updated_user.game_balance,
            transaction_id: recorded_transaction.id,
        })
    }

    pub async fn get_status(&self) -> HashMap<String, serde_json::Value> {
        let mut status = HashMap::new();

        let is_running = {
            let running = self.is_running.lock().unwrap();
            *running
        };

        status.insert("is_running".to_string(), serde_json::json!(is_running));
        status.insert(
            "check_interval_secs".to_string(),
            serde_json::json!(self.config.check_interval_secs),
        );
        status.insert(
            "simulation_mode".to_string(),
            serde_json::json!(self.config.enable_simulation),
        );

        if self.config.enable_simulation {
            let state = self.simulation_state.lock().unwrap();
            status.insert(
                "current_block".to_string(),
                serde_json::json!(state.current_block),
            );
            status.insert(
                "processed_transactions".to_string(),
                serde_json::json!(state.processed_transactions.len()),
            );
        }

        // Get number of monitored addresses
        if let Ok(addresses) = self.get_monitored_addresses().await {
            status.insert(
                "monitored_addresses".to_string(),
                serde_json::json!(addresses.len()),
            );
        }

        status
    }

    // Manual trigger for testing
    pub async fn trigger_manual_check(&self) -> Result<DepositResult, Box<dyn std::error::Error + Send + Sync>> {
        info!("Manual deposit check triggered");
        self.check_deposits().await
    }

    // Force simulate a deposit for testing
    pub async fn force_simulate_deposit(
        &self,
        user_id: &str,
        amount: BigDecimal,
    ) -> Result<ProcessedDeposit, Box<dyn std::error::Error + Send + Sync>> {
        info!("Force simulating deposit of {} for user {}", amount, user_id);

        // Get user to get their game address
        let user = sqlx::query("SELECT user_id, evm_addr FROM users WHERE user_id = $1")
            .bind(user_id)
            .fetch_one(self.store.pool())
            .await?;

        let mut rng = rand::thread_rng();
        let tx_hash = format!(
            "0x{:064x}",
            rng.r#gen::<u64>() as u128 * rng.r#gen::<u64>() as u128
        );

        let current_block = {
            let mut state = self.simulation_state.lock().unwrap();
            state.current_block += 1;
            state.current_block
        };

        let deposit = DepositEvent {
            from_address: format!("0x{:040x}", rng.r#gen::<u128>()),
            to_address: user.try_get("evm_addr")?,
            amount,
            transaction_hash: tx_hash,
            block_number: current_block,
            timestamp: chrono::Utc::now().timestamp(),
        };

        self.process_deposit(deposit).await
    }
}
