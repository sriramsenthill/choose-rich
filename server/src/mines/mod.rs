mod router;
use rand::Rng;
use std::env;
pub use router::router;
use serde::{Deserialize, Serialize};
use std::{
    collections::{HashMap, HashSet},
    time::Duration,
};
use uuid::Uuid;

use once_cell::sync::Lazy;

static RANDOM_SERVER_URL: Lazy<String> = Lazy::new(|| {
    env::var("RANDOM_SERVER_URL")
        .unwrap_or_else(|_| "http://localhost:3000".to_string())
});


#[derive(Debug, Clone, Serialize, Deserialize)]
struct RandomNumberResponse {
    success: bool,
    #[serde(rename = "randomNumber")]
    random_number: u32,
}

// Function to get random number for mines game - uses local random immediately
// Makes fire-and-forget call to random server for logging/verification purposes only
async fn get_mines_random_number(min: u32, max: u32) -> u32 {
    // Use local random immediately for fast response
    let mut rng = rand::thread_rng();
    let local_random = rng.gen_range(min..=max);
    
    // Fire-and-forget call to random server (don't wait for response)
    let server_url = RANDOM_SERVER_URL.clone();
    tokio::spawn(async move {
        // This runs in background, we don't care about the result
        let _ = get_random_number_from_server_with_url(&server_url).await;
    });
    
    local_random
}

// Function to get random number from random-verifiable-server
// Falls back to rand if server is unavailable
async fn get_random_number_with_fallback(min: u32, max: u32) -> u32 {
    match get_random_number_from_server().await {
        Ok(num) => {
            // Scale the 0-9 number to our desired range
            let range = max - min + 1;
            min + (num % range)
        }
        Err(_) => {
            // Fallback to local rand if server is unavailable
            let mut rng = rand::thread_rng();
            rng.gen_range(min..=max)
        }
    }
}

// Internal function to call the random server with custom URL
async fn get_random_number_from_server_with_url(server_url: &str) -> eyre::Result<u32> {
    let client = reqwest::Client::new();
    let response = client
        .get(&format!("{}/random", server_url))
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

// Internal function to call the random server
async fn get_random_number_from_server() -> eyre::Result<u32> {
    get_random_number_from_server_with_url(&RANDOM_SERVER_URL).await
}

const SESSION_TTL: Duration = Duration::from_secs(30 * 60);

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StartGameRequest {
    pub game_address: String,
    pub amount: f64,
    pub blocks: u32,
    pub mines: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StartGameResponse {
    pub id: String,
    pub amount: f64,
    pub blocks: u32,
    pub mines: u32,
    pub session_status: SessionStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MoveRequest {
    pub game_address: String,
    pub id: String,
    pub block: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MoveAction {
    pub block: u32,
    pub multiplier: f64,
    pub safe: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MoveResponse {
    pub id: String,
    pub actions: HashMap<String, MoveAction>,
    pub current_multiplier: Option<f64>,
    pub potential_payout: Option<f64>,
    pub final_payout: Option<f64>,
    pub bomb_blocks: Option<Vec<u32>>,
    pub session_status: SessionStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CashoutRequest {
    pub game_address: String,
    pub id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CashoutResponse {
    pub id: String,
    pub src: f64,
    pub final_payout: f64,
    pub actions: HashMap<String, MoveAction>,
    pub bomb_blocks: Vec<u32>,
    pub session_status: SessionStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameSession {
    pub id: String,
    pub user_id: String,
    pub src: f64,
    pub blocks: u32,
    pub mines: u32,
    pub mine_positions: HashSet<u32>,
    pub revealed_blocks: HashSet<u32>,
    pub actions: HashMap<String, MoveAction>,
    pub current_multiplier: f64,
    pub status: SessionStatus,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum SessionStatus {
    Active,
    Ended,
}

impl GameSession {
    pub async fn new(src: f64, blocks: u32, mines: u32, user_id: String) -> eyre::Result<Self> {
        if blocks.isqrt() * blocks.isqrt() != blocks {
            return Err(eyre::eyre!("Invalid Blocks"));
        }

        let mut mine_positions = HashSet::with_capacity(mines as usize);
        
        // Generate mine positions using fast local random for mines game
        while mine_positions.len() < mines as usize {
            let position = get_mines_random_number(1, blocks).await;
            mine_positions.insert(position);
        }

        Ok(GameSession {
            id: Uuid::new_v4().to_string(),
            src,
            blocks,
            user_id,
            mines,
            mine_positions,
            revealed_blocks: HashSet::new(),
            actions: HashMap::new(),
            current_multiplier: 1.0,
            status: SessionStatus::Active,
        })
    }

    pub fn make_move(&mut self, block: u32, user_id: String) -> eyre::Result<MoveResponse> {
        if self.user_id != user_id {
            return Err(eyre::eyre!("User ID does not match"));
        }

        if self.status != SessionStatus::Active {
            return Err(eyre::eyre!("Session is not active"));
        }
        if block < 1 || block > self.blocks || self.revealed_blocks.contains(&block) {
            return Err(eyre::eyre!("Invalid block"));
        }

        self.revealed_blocks.insert(block);
        let move_number = format!("move_{}", self.actions.len() + 1);

        if self.mine_positions.contains(&block) {
            self.status = SessionStatus::Ended;
            self.actions.insert(
                move_number,
                MoveAction {
                    block,
                    multiplier: 0.0,
                    safe: false,
                },
            );
            return Ok(MoveResponse {
                id: self.id.clone(),
                actions: self.actions.clone(),
                current_multiplier: None,
                potential_payout: None,
                final_payout: Some(0.0),
                bomb_blocks: Some(self.mine_positions.iter().copied().collect()),
                session_status: SessionStatus::Ended,
            });
        }

        let safe_picks = self.revealed_blocks.len() as u32;
        self.current_multiplier = self.calculate_multiplier(safe_picks);
        self.actions.insert(
            move_number,
            MoveAction {
                block,
                multiplier: self.current_multiplier,
                safe: true,
            },
        );

        Ok(MoveResponse {
            id: self.id.clone(),
            actions: self.actions.clone(),
            current_multiplier: Some(self.current_multiplier),
            potential_payout: Some(self.src * self.current_multiplier),
            final_payout: None,
            bomb_blocks: None,
            session_status: self.status.clone(),
        })
    }

    pub fn cashout(&mut self, user_id: String) -> eyre::Result<CashoutResponse> {
        if self.user_id != user_id {
            return Err(eyre::eyre!("User ID does not match"));
        }

        if self.status != SessionStatus::Active {
            return Err(eyre::eyre!("Session is not active"));
        }

        self.status = SessionStatus::Ended;
        let final_payout = self.src * self.current_multiplier;
        Ok(CashoutResponse {
            id: self.id.clone(),
            src: self.src,
            final_payout,
            actions: self.actions.clone(),
            bomb_blocks: self.mine_positions.iter().copied().collect(),
            session_status: self.status.clone(),
        })
    }

    fn calculate_multiplier(&self, safe_picks: u32) -> f64 {
        const HOUSE_EDGE: f64 = 0.01; // 1% house edge

        (0..safe_picks).fold(1.0, |acc, i| {
            let remaining = self.blocks - self.mines - i;
            if remaining > 0 {
                // Apply house edge: multiply by (1 - house_edge) to reduce payouts
                acc * (1.0 - HOUSE_EDGE) * self.blocks as f64 / remaining as f64
            } else {
                acc
            }
        })
    }
}
