use crate::{
    auth::{AuthLayer, router as auth_router},
    deposit_monitor::{DepositMonitor, DepositMonitorConfig},
    server::AppState,
    store::Store,
    wallet::router as wallet_router,
};
use axum::{Router, routing::get};
use moka::future::Cache;
use std::sync::Arc;
mod apex;
mod auth;
mod deposit_monitor;
mod mines;
mod primitives;
mod server;
mod store;
mod wallet;

const JWT_SECRET: &str = "JWT_SECRET";

#[tokio::main]
async fn main() {
    let _ = tracing_subscriber::fmt().try_init();
    let sessions = Arc::new(Cache::builder().build());
    let pg_default = "postgresql://postgres:postgres@localhost:5432/postgres";
    println!("Attempting to connect to database: {}", pg_default);

    let pool = sqlx::postgres::PgPoolOptions::new()
        .max_connections(200)
        .connect(pg_default)
        .await
        .expect(
            "Failed to connect to database. Please ensure PostgreSQL is running on localhost:5432",
        );

    println!("Successfully connected to database!");
    println!("Running database migrations...");
    let store = Arc::new(
        Store::new(pool)
            .await
            .expect("Failed to create store or run migrations"),
    );
    println!("Database migrations completed successfully!");
    let app_state = AppState::new(sessions, store.clone(), JWT_SECRET.to_string());

    // Initialize and start deposit monitor (reduced frequency since we now have on-demand refresh)
    let monitor_config = DepositMonitorConfig {
        check_interval_secs: 300, // Check every 5 minutes instead of 5 seconds
        required_confirmations: 3,
        rpc_url: None,
        enable_simulation: true,
        simulation_probability: 0.001, // Much lower probability since users can refresh manually
    };

    let deposit_monitor = DepositMonitor::new(store.clone(), monitor_config);

    // Start the deposit monitor
    if let Err(e) = deposit_monitor.start().await {
        eprintln!("Failed to start deposit monitor: {}", e);
    } else {
        println!("Deposit monitor started successfully!");
    }

    use tower_http::cors::{Any, CorsLayer};

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let wallet_router = wallet_router(Arc::new(app_state.clone())).await;
    let auth_router = auth_router(Arc::new(app_state.clone())).await;

    // Apply authentication only to auth router (mines and apex moved to wallet router)
    let protected_router = Router::new()
        .merge(auth_router)
        .layer(AuthLayer {
            expected_secret: "X-Server-secret".to_string(),
            jwt_secret: JWT_SECRET.to_string(),
        });

    let app_router = Router::new()
        .route("/", get(|| async { "Choose Rich API is running!" }))
        .merge(protected_router)
        .merge(wallet_router) // Wallet router without authentication
        .layer(cors);

    // serve this route in 0.0.0.0 : 3002
    let listener = tokio::net::TcpListener::bind("0.0.0.0:3002").await.unwrap();
    tracing::info!("server started at 0.0.0.0:3002");
    axum::serve(listener, app_router).await.unwrap();
}
