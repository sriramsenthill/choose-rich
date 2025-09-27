use crate::store::User;
use sqlx::{Pool, Postgres, Result};

pub struct Store {
    pool: Pool<Postgres>,
}

impl Store {
    /// Run database migration to create the users table if it does not exist.
    pub async fn migrate(&self) -> Result<()> {
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS users (
                user_id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
                username VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                pk VARCHAR(255) NOT NULL,
                evm_addr VARCHAR(255) NOT NULL,
                original_wallet_addr VARCHAR(255),
                booky_balance NUMERIC NOT NULL
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
            INSERT INTO users (username, password, pk, evm_addr, original_wallet_addr, booky_balance)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
            "#,
        )
        .bind(&user.username)
        .bind(&user.password)
        .bind(&user.pk)
        .bind(&user.evm_addr)
        .bind(&user.original_wallet_addr)
        .bind(user.booky_balance.clone())
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
    pub async fn get_user_by_original_wallet_addr(&self, original_wallet_addr: &str) -> Result<Option<User>> {
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
}