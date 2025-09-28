use crate::store::{GameTransaction, User};
use sqlx::types::BigDecimal;
use sqlx::{Pool, Postgres, Result};

pub struct Store {
    pool: Pool<Postgres>,
}

impl Store {
    /// Get a reference to the database pool
    pub fn pool(&self) -> &Pool<Postgres> {
        &self.pool
    }

    /// Run database migration to create the users table if it doesn't exist.
    pub async fn migrate(&self) -> Result<()> {
        
        // Drop existing tables to start fresh
        // sqlx::query("DROP TABLE IF EXISTS game_transactions CASCADE")
        //     .execute(&self.pool)
        //     .await?;
        
        // sqlx::query("DROP TABLE IF EXISTS users CASCADE")
        //     .execute(&self.pool)
        //     .await?;

        // Create users table with correct schema
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS users (
                user_id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
                username VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                pk VARCHAR(255) NOT NULL,
                evm_addr VARCHAR(255) NOT NULL,
                original_wallet_addr VARCHAR(255),
                account_balance NUMERIC NOT NULL DEFAULT 0,
                in_game_balance NUMERIC NOT NULL DEFAULT 0,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
            "#,
        )
        .execute(&self.pool)
        .await?;

        // Create game transactions table for tracking deposits, withdrawals, wins, and losses
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS game_transactions (
                id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
                user_id TEXT NOT NULL REFERENCES users(user_id),
                transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('deposit', 'withdrawal', 'game_win', 'game_loss', 'cashout')),
                amount NUMERIC NOT NULL,
                game_type VARCHAR(20) CHECK (game_type IN ('mines', 'apex')),
                game_session_id TEXT,
                description TEXT,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
            "#,
        )
        .execute(&self.pool)
        .await?;

        //create indexes
        self.create_indexes().await?;
        Ok(())
    }
    pub async fn new(pool: Pool<Postgres>) -> Result<Self> {
        let store = Store { pool };
        store.migrate().await?;
        Ok(store)
    }

    // Create a new user
    pub async fn create_user(&self, user: &User) -> Result<User> {
        sqlx::query_as::<_, User>(
            r#"
            INSERT INTO users (username, password, pk, evm_addr, original_wallet_addr, account_balance, in_game_balance)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
            "#,
        )
        .bind(&user.username)
        .bind(&user.password)
        .bind(&user.pk)
        .bind(&user.evm_addr)
        .bind(&user.original_wallet_addr)
        .bind(user.account_balance.clone())
        .bind(user.in_game_balance.clone())
        .fetch_one(&self.pool)
        .await
    }

    // Find user by EVM wallet address
    pub async fn get_user_by_evm_addr(&self, evm_addr: &str) -> Result<Option<User>> {
        sqlx::query_as::<_, User>(
            r#"
            SELECT * FROM users WHERE evm_addr = $1
            "#,
        )
        .bind(evm_addr)
        .fetch_optional(&self.pool)
        .await
    }

    // Find user by original wallet address (the wallet they connected with)
    pub async fn get_user_by_original_wallet_addr(
        &self,
        original_wallet_addr: &str,
    ) -> Result<Option<User>> {
        sqlx::query_as::<_, User>(
            r#"
            SELECT * FROM users WHERE original_wallet_addr = $1
            "#,
        )
        .bind(original_wallet_addr)
        .fetch_optional(&self.pool)
        .await
    }

    pub async fn get_user_by_wallet_addr(&self, wallet_addr: &str) -> Result<Option<User>> {
        // First try original wallet address
        if let Some(user) = self.get_user_by_original_wallet_addr(wallet_addr).await? {
            return Ok(Some(user));
        }

        // Then try EVM address
        self.get_user_by_evm_addr(wallet_addr).await
    }

    // Create indexes
    pub async fn create_indexes(&self) -> Result<()> {
        // Index on username for faster lookups
        sqlx::query(
            r#"
            CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users (username)
            "#,
        )
        .execute(&self.pool)
        .await?;

        // Index on evm_addr for Ethereum-related queries
        sqlx::query(
            r#"
            CREATE INDEX IF NOT EXISTS idx_users_evm_addr ON users (evm_addr)
            "#,
        )
        .execute(&self.pool)
        .await?;

        // Index on original_wallet_addr for wallet connection lookups
        sqlx::query(
            r#"
            CREATE INDEX IF NOT EXISTS idx_users_original_wallet_addr ON users (original_wallet_addr)
            "#,
        )
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    // Update user's account balance (total deposited amount)
    pub async fn update_account_balance(
        &self,
        user_id: &str,
        new_balance: &BigDecimal,
    ) -> Result<User> {
        sqlx::query_as::<_, User>(
            r#"
            UPDATE users
            SET account_balance = $1, updated_at = CURRENT_TIMESTAMP
            WHERE user_id = $2
            RETURNING *
            "#,
        )
        .bind(new_balance)
        .bind(user_id)
        .fetch_one(&self.pool)
        .await
    }

    // Update user's in-game balance (available for playing)
    pub async fn update_in_game_balance(
        &self,
        user_id: &str,
        new_balance: &BigDecimal,
    ) -> Result<User> {
        sqlx::query_as::<_, User>(
            r#"
            UPDATE users
            SET in_game_balance = $1, updated_at = CURRENT_TIMESTAMP
            WHERE user_id = $2
            RETURNING *
            "#,
        )
        .bind(new_balance)
        .bind(user_id)
        .fetch_one(&self.pool)
        .await
    }

    // Add or subtract from user's account balance
    pub async fn adjust_account_balance(&self, user_id: &str, amount: &BigDecimal) -> Result<User> {
        sqlx::query_as::<_, User>(
            r#"
            UPDATE users
            SET account_balance = account_balance + $1, updated_at = CURRENT_TIMESTAMP
            WHERE user_id = $2
            RETURNING *
            "#,
        )
        .bind(amount)
        .bind(user_id)
        .fetch_one(&self.pool)
        .await
    }

    // Add or subtract from user's in-game balance
    pub async fn adjust_in_game_balance(&self, user_id: &str, amount: &BigDecimal) -> Result<User> {
        sqlx::query_as::<_, User>(
            r#"
            UPDATE users
            SET in_game_balance = in_game_balance + $1, updated_at = CURRENT_TIMESTAMP
            WHERE user_id = $2
            RETURNING *
            "#,
        )
        .bind(amount)
        .bind(user_id)
        .fetch_one(&self.pool)
        .await
    }

    // Process deposit: adds to both account_balance and in_game_balance
    pub async fn process_deposit(&self, user_id: &str, amount: &BigDecimal) -> Result<User> {
        sqlx::query_as::<_, User>(
            r#"
            UPDATE users
            SET account_balance = account_balance + $1, 
                in_game_balance = in_game_balance + $1, 
                updated_at = CURRENT_TIMESTAMP
            WHERE user_id = $2
            RETURNING *
            "#,
        )
        .bind(amount)
        .bind(user_id)
        .fetch_one(&self.pool)
        .await
    }

    // Record a game transaction
    pub async fn create_transaction(
        &self,
        transaction: &GameTransaction,
    ) -> Result<GameTransaction> {
        sqlx::query_as::<_, GameTransaction>(
            r#"
            INSERT INTO game_transactions (user_id, transaction_type, amount, game_type, game_session_id, description)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
            "#,
        )
        .bind(&transaction.user_id)
        .bind(&transaction.transaction_type)
        .bind(&transaction.amount)
        .bind(&transaction.game_type)
        .bind(&transaction.game_session_id)
        .bind(&transaction.description)
        .fetch_one(&self.pool)
        .await
    }

    // Get transaction history for a user
    pub async fn get_user_transactions(
        &self,
        user_id: &str,
        limit: Option<i64>,
    ) -> Result<Vec<GameTransaction>> {
        let limit = limit.unwrap_or(50);
        sqlx::query_as::<_, GameTransaction>(
            r#"
            SELECT * FROM game_transactions
            WHERE user_id = $1
            ORDER BY created_at DESC
            LIMIT $2
            "#,
        )
        .bind(user_id)
        .bind(limit)
        .fetch_all(&self.pool)
        .await
    }

    // Process game result (win or loss) and update in-game balance only
    pub async fn process_game_result(
        &self,
        user_id: &str,
        amount: &BigDecimal,
        game_type: &str,
        game_session_id: &str,
        is_win: bool,
    ) -> Result<(User, GameTransaction)> {
        let mut tx = self.pool.begin().await?;

        let transaction_type = if is_win { "game_win" } else { "game_loss" };
        let adjustment_amount = if is_win {
            amount.clone()
        } else {
            -amount.clone()
        };

        // Update user in-game balance only (account balance remains unchanged)
        let updated_user = sqlx::query_as::<_, User>(
            r#"
            UPDATE users
            SET in_game_balance = in_game_balance + $1, updated_at = CURRENT_TIMESTAMP
            WHERE user_id = $2
            RETURNING *
            "#,
        )
        .bind(&adjustment_amount)
        .bind(user_id)
        .fetch_one(&mut *tx)
        .await?;

        // Record transaction
        let transaction = sqlx::query_as::<_, GameTransaction>(
            r#"
            INSERT INTO game_transactions (user_id, transaction_type, amount, game_type, game_session_id, description)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
            "#,
        )
        .bind(user_id)
        .bind(transaction_type)
        .bind(amount)
        .bind(game_type)
        .bind(game_session_id)
        .bind(if is_win { "Game win" } else { "Game loss" })
        .fetch_one(&mut *tx)
        .await?;

        tx.commit().await?;
        Ok((updated_user, transaction))
    }

    // Get user balances by various identifier - returns (account_balance, in_game_balance)
    pub async fn get_user_balances(&self, identifier: &str) -> Result<Option<(BigDecimal, BigDecimal)>> {
        // Try by user_id first
        if let Ok(Some(user)) = self.get_user_by_evm_addr(identifier).await {
            return Ok(Some((user.account_balance, user.in_game_balance)));
        }

        // Try by original wallet address
        if let Ok(Some(user)) = self.get_user_by_original_wallet_addr(identifier).await {
            return Ok(Some((user.account_balance, user.in_game_balance)));
        }

        Ok(None)
    }

    // Get user in-game balance (for backward compatibility)
    pub async fn get_user_balance(&self, identifier: &str) -> Result<Option<BigDecimal>> {
        if let Some((_, in_game_balance)) = self.get_user_balances(identifier).await? {
            return Ok(Some(in_game_balance));
        }
        Ok(None)
    }
}
