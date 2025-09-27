use crate::{
    primitives::new_moka_cache,
    server::{AppState, Service},
    store::GameTransaction,
};
use axum::{Router, extract::State, response::Json, routing::post, Extension};
use garden::api::{
    bad_request, internal_error,
    primitives::{ApiResult, Response},
};
use serde::{Deserialize, Serialize};
use serde_json::to_value;
use sqlx::types::BigDecimal;
use std::{sync::Arc, time::Duration, str::FromStr};
use uuid::Uuid;

const SESSION_TTL: Duration = Duration::from_secs(30 * 60);
const RANDOM_SERVER_URL: &str = "http://localhost:3000";

#[derive(Debug, Clone, Serialize, Deserialize)]
struct RandomNumberResponse {
    success: bool,
    #[serde(rename = "randomNumber")]
    random_number: u32,
}

// Function to get random number from random-verifiable-server
async fn get_random_number() -> eyre::Result<u32> {
    let client = reqwest::Client::new();
    let response = client
        .get(&format!("{}/random", RANDOM_SERVER_URL))
        .send()
        .await
        .map_err(|e| eyre::eyre!("Failed to request random number: {}", e))?;
    
    if !response.status().is_success() {
        return Err(eyre::eyre!("Random server returned error: {}", response.status()));
    }
    
    let random_response: RandomNumberResponse = response
        .json()
        .await
        .map_err(|e| eyre::eyre!("Failed to parse random number response: {}", e))?;
    
    if !random_response.success {
        return Err(eyre::eyre!("Random server indicated failure"));
    }
    
    Ok(random_response.random_number)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StartGameRequest {
    pub game_address: String,
    pub amount: f64,
    pub option: GameOption,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum GameOption {
    Blinder,
    NonBlinder,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StartGameResponse {
    pub id: String,
    pub amount: f64,
    pub option: GameOption,
    pub system_number: u32,
    pub user_number: Option<u32>, // Only for blinder mode
    pub payout_high: Option<f64>,
    pub probability_high: Option<f64>,
    pub payout_low: Option<f64>,
    pub probability_low: Option<f64>,
    pub payout_equal: Option<f64>,
    pub probability_equal: Option<f64>,
    pub payout_percentage: Option<f64>,    // Only for blinder
    pub blinder_suit: Option<BlinderSuit>, // Only for blinder mode
    pub session_status: SessionStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlinderSuit {
    pub won: bool,
    pub payout: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChooseRequest {
    pub game_address: String,
    pub id: String,
    pub choice: Choice,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Choice {
    High,
    Low,
    Equal,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChooseResponse {
    pub id: String,
    pub choice: Option<Choice>, // None for Blinder
    pub user_number: u32,
    pub system_number: u32,
    pub won: bool,
    pub payout: f64,
    pub session_status: SessionStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameSession {
    pub id: String,
    pub amount: f64,
    pub option: GameOption,
    pub system_number: u32,
    pub user_number: Option<u32>,
    pub status: SessionStatus,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum SessionStatus {
    Active,
    Ended,
}

impl GameSession {
    pub async fn new(amount: f64, option: GameOption) -> eyre::Result<Self> {
        let system_number = get_random_number().await?;
        let user_number = match option {
            GameOption::Blinder => Some(get_random_number().await?),
            GameOption::NonBlinder => None,
        };
        Ok(GameSession {
            id: Uuid::new_v4().to_string(),
            amount,
            option,
            system_number,
            user_number,
            status: SessionStatus::Active,
        })
    }

    pub fn get_choice_info(&self, choice: &Choice) -> (f64, f64) {
        let true_probability = match choice {
            Choice::High => (9.0 - self.system_number as f64) / 10.0,
            Choice::Low => self.system_number as f64 / 10.0,
            Choice::Equal => 1.0 / 10.0, // Always 1/10 = 0.1 (10% chance)
        };
        let payout = if true_probability > 0.0 {
            (1.0 - 0.01) / true_probability
        } else {
            0.0
        };
        (true_probability, payout)
    }

    pub async fn make_choice(&mut self, choice: Choice) -> eyre::Result<ChooseResponse> {
        if self.status != SessionStatus::Active {
            return Err(eyre::eyre!("Session is not active"));
        }
        if matches!(self.option, GameOption::Blinder) {
            return Err(eyre::eyre!("Cannot make choice in blinder mode"));
        }
        self.status = SessionStatus::Ended;
        let user_number = get_random_number().await?;
        let (_prob, payout_multiplier) = self.get_choice_info(&choice);
        let won = match choice {
            Choice::High => user_number > self.system_number,
            Choice::Low => user_number < self.system_number,
            Choice::Equal => user_number == self.system_number,
        };
        let payout = if won {
            self.amount * payout_multiplier
        } else {
            0.0
        };
        Ok(ChooseResponse {
            id: self.id.clone(),
            choice: Some(choice),
            user_number,
            system_number: self.system_number,
            won,
            payout,
            session_status: self.status.clone(),
        })
    }

    pub fn get_blinder_result(&mut self) -> eyre::Result<BlinderSuit> {
        if self.status != SessionStatus::Active {
            return Err(eyre::eyre!("Session is not active"));
        }
        if !matches!(self.option, GameOption::Blinder) {
            return Err(eyre::eyre!("Not a blinder game"));
        }
        self.status = SessionStatus::Ended;
        let user_number = self.user_number.unwrap();
        let won = user_number > self.system_number; // Draw means system wins
        let probability = 0.45; // 45% chance of winning (user_number > system_number)
        let payout_multiplier = (1.0 - 0.01) / probability; // 1% house edge
        let payout = if won {
            self.amount * payout_multiplier
        } else {
            0.0
        };
        Ok(BlinderSuit { won, payout })
    }
}

async fn start_game(
    State(state): State<Arc<AppState>>,
    Extension(user_addr): Extension<String>,
    Json(payload): Json<StartGameRequest>,
) -> ApiResult<StartGameResponse> {
    // Get user from database
    let user = state.store.get_user_by_wallet_addr(&user_addr).await
        .map_err(|e| internal_error(&format!("Database error: {}", e)))?
        .ok_or_else(|| bad_request("User not found"))?;

    // Check if user has enough in-game balance
    let bet_amount = BigDecimal::from_str(&payload.amount.to_string())
        .map_err(|_| bad_request("Invalid amount format"))?;
    if user.in_game_balance < bet_amount {
        return Err(bad_request("Insufficient in-game balance"));
    }

    // Deduct bet amount from user's in-game balance
    let _updated_user = state.store.adjust_in_game_balance(&user.user_id, &(-bet_amount.clone())).await
        .map_err(|e| internal_error(&format!("Failed to deduct in-game balance: {}", e)))?;
    let mut session = GameSession::new(payload.amount, payload.option.clone()).await
        .map_err(|e| internal_error(&format!("Failed to create game session: {}", e)))?;
    let (
        payout_high,
        prob_high,
        payout_low,
        prob_low,
        payout_equal,
        prob_equal,
        payout_percentage,
        blinder_suit,
    ) = match payload.option {
        GameOption::Blinder => {
            let blinder_result = session
                .get_blinder_result()
                .map_err(|e| bad_request(&e.to_string()))?;
            let probability = 0.45; // 45% win probability
            let payout_percentage = (1.0 - 0.01) / probability;
            
            // Handle blinder result immediately since it's auto-resolved
            if blinder_result.won && blinder_result.payout > 0.0 {
                let payout_amount = BigDecimal::from_str(&blinder_result.payout.to_string())
                    .map_err(|_| internal_error("Invalid payout amount"))?;
                let _updated_user = state.store.adjust_in_game_balance(&user.user_id, &payout_amount).await
                    .map_err(|e| internal_error(&format!("Failed to add winnings: {}", e)))?;

                // Record win transaction
                let win_transaction = GameTransaction {
                    id: String::new(),
                    user_id: user.user_id.clone(),
                    transaction_type: "game_win".to_string(),
                    amount: payout_amount,
                    game_type: Some("apex".to_string()),
                    game_session_id: Some(session.id.clone()),
                    description: Some(format!("Apex blinder win - {} payout", blinder_result.payout)),
                    created_at: None,
                };
                let _win_recorded = state.store.create_transaction(&win_transaction).await
                    .map_err(|e| internal_error(&format!("Failed to record win transaction: {}", e)))?;
            }

            // Record initial bet transaction
            let bet_transaction = GameTransaction {
                id: String::new(),
                user_id: user.user_id.clone(),
                transaction_type: if blinder_result.won { "game_win" } else { "game_loss" }.to_string(),
                amount: bet_amount.clone(),
                game_type: Some("apex".to_string()),
                game_session_id: Some(session.id.clone()),
                description: Some("Apex blinder game bet".to_string()),
                created_at: None,
            };
            let _bet_recorded = state.store.create_transaction(&bet_transaction).await
                .map_err(|e| internal_error(&format!("Failed to record bet transaction: {}", e)))?;

            (
                None,
                None,
                None,
                None,
                None,
                None,
                Some(payout_percentage),
                Some(blinder_result),
            )
        }
        GameOption::NonBlinder => {
            let high_prob = (9 - session.system_number) as f64 / 10.0;
            let low_prob = session.system_number as f64 / 10.0;
            let equal_prob = 1.0 / 10.0;
            let high_payout = if high_prob > 0.0 {
                (1.0 - 0.01) / high_prob
            } else {
                0.0
            };
            let low_payout = if low_prob > 0.0 {
                (1.0 - 0.01) / low_prob
            } else {
                0.0
            };
            let equal_payout = (1.0 - 0.01) / equal_prob;

            // Record initial bet transaction for non-blinder (will be resolved when choice is made)
            let bet_transaction = GameTransaction {
                id: String::new(),
                user_id: user.user_id.clone(),
                transaction_type: "game_loss".to_string(), // Initially treat as loss, will add win if they win
                amount: bet_amount.clone(),
                game_type: Some("apex".to_string()),
                game_session_id: Some(session.id.clone()),
                description: Some("Apex non-blinder game bet".to_string()),
                created_at: None,
            };
            let _bet_recorded = state.store.create_transaction(&bet_transaction).await
                .map_err(|e| internal_error(&format!("Failed to record bet transaction: {}", e)))?;

            (
                Some(high_payout),
                Some(high_prob),
                Some(low_payout),
                Some(low_prob),
                Some(equal_payout),
                Some(equal_prob),
                None,
                None,
            )
        }
    };
    let response = StartGameResponse {
        id: session.id.clone(),
        amount: payload.amount,
        option: payload.option,
        system_number: session.system_number,
        user_number: session.user_number,
        payout_high,
        probability_high: prob_high,
        payout_low,
        probability_low: prob_low,
        payout_equal,
        probability_equal: prob_equal,
        payout_percentage,
        blinder_suit,
        session_status: session.status.clone(),
    };
    let service_state = match state.sessions.get(&Service::Apex).await {
        Some(cache) => cache,
        None => {
            let cache = new_moka_cache(SESSION_TTL);
            state.sessions.insert(Service::Apex, cache.clone()).await;
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

async fn make_choice(
    State(state): State<Arc<AppState>>,
    Extension(user_addr): Extension<String>,
    Json(payload): Json<ChooseRequest>,
) -> ApiResult<ChooseResponse> {
    // Get user from database
    let user = state.store.get_user_by_wallet_addr(&user_addr).await
        .map_err(|e| internal_error(&format!("Database error: {}", e)))?
        .ok_or_else(|| bad_request("User not found"))?;

    let service_state = state
        .sessions
        .get(&Service::Apex)
        .await
        .ok_or(bad_request("Session not found"))?;
    let mut session: GameSession = service_state
        .get(&payload.id)
        .await
        .and_then(|v| serde_json::from_value(v.clone()).ok())
        .ok_or(bad_request("Session not found"))?;
    
    let response = session
        .make_choice(payload.choice).await
        .map_err(|e| bad_request(&e.to_string()))?;
    
    // Handle winnings
    if response.won && response.payout > 0.0 {
        let payout_amount = BigDecimal::from_str(&response.payout.to_string())
            .map_err(|_| internal_error("Invalid payout amount"))?;
        let _updated_user = state.store.adjust_in_game_balance(&user.user_id, &payout_amount).await
            .map_err(|e| internal_error(&format!("Failed to add winnings: {}", e)))?;

        // Record win transaction
        let win_transaction = GameTransaction {
            id: String::new(),
            user_id: user.user_id.clone(),
            transaction_type: "game_win".to_string(),
            amount: payout_amount,
            game_type: Some("apex".to_string()),
            game_session_id: Some(session.id.clone()),
            description: Some(format!("Apex choice win - {} payout from choice {:?}", response.payout, response.choice)),
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

pub fn router(state: Arc<AppState>) -> Router {
    Router::new()
        .route("/start", post(start_game))
        .route("/choose", post(make_choice))
        .with_state(state)
}
