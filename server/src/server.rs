use moka::future::Cache;
use std::{sync::Arc, time::Duration};
use std::env;

use crate::store::Store;

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub enum Service {
    Mines,
    Apex,
}

// Application state
#[derive(Clone)]
pub struct AppState {
    pub sessions: Arc<Cache<Service, Arc<Cache<String, serde_json::Value>>>>,
    pub store: Arc<Store>,
    pub jwt_secret: String,
}

impl AppState {
    pub fn new(
        sessions: Arc<Cache<Service, Arc<Cache<String, serde_json::Value>>>>,
        store: Arc<Store>,
        jwt_secret: String,
    ) -> Self {
        Self {
            sessions,
            store,
            jwt_secret,
        }
    }
    pub async fn default() -> Self {
        
        // Read database URL and JWT secret from environment variables, with defaults
        let pg_default = env::var("DATABASE_URL")
            .unwrap_or_else(|_| "postgresql://postgres:postgres@localhost:5432/postgres".to_string());
        let jwt_secret = env::var("JWT_SECRET").unwrap_or_else(|_| "JWT_SECRET".to_string());

        // Parse the database name from the URL
        let url = url::Url::parse(&pg_default).expect("Invalid DATABASE_URL");
        let db_name = url.path().trim_start_matches('/');
        let mut url_no_db = url.clone();
        url_no_db.set_path("/postgres");
        let url_no_db_str = url_no_db.as_str();

        // Try to connect to the target database
        let pool = match sqlx::postgres::PgPoolOptions::new()
            .max_connections(200)
            .connect(&pg_default)
            .await {
            Ok(pool) => pool,
            Err(e) => {
                // If error is database does not exist, create it
                if let Some(db_err) = e.as_database_error() {
                    let msg = db_err.message();
                    if msg.contains("does not exist") {
                        // Connect to default postgres db and create the target db
                        let admin_pool = sqlx::postgres::PgPoolOptions::new()
                            .max_connections(1)
                            .connect(url_no_db_str)
                            .await
                            .expect("Failed to connect to postgres database for DB creation");
                        let create_db_query = format!("CREATE DATABASE \"{}\"", db_name);
                        let _ = sqlx::query(&create_db_query)
                            .execute(&admin_pool)
                            .await
                            .expect("Failed to create target database");
                        // Try connecting again
                        sqlx::postgres::PgPoolOptions::new()
                            .max_connections(200)
                            .connect(&pg_default)
                            .await
                            .expect("Failed to connect to newly created database")
                    } else {
                        panic!("Failed to connect to database: {}", msg);
                    }
                } else {
                    panic!("Failed to connect to database: {}", e);
                }
            }
        };
        Self {
            sessions: Arc::new(
                Cache::builder()
                    .time_to_live(Duration::from_secs(30 * 60))
                    .build(),
            ),
            store: Arc::new(Store::new(pool).await.unwrap()),
            jwt_secret: jwt_secret,
        }
    }
}
