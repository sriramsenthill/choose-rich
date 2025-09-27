# Choose Rich Gambling API Documentation

This is a comprehensive API for a gambling platform with two games: **Mines** and **Apex**. The system manages user wallets, game balances, and transaction history.

## Core Features

- **Wallet Management**: Connect external wallets and generate game wallets
- **Balance System**: Separate game balance from on-chain wallets
- **Two Games**: Mines (minesweeper-style) and Apex (number guessing)
- **Transaction Tracking**: Complete history of deposits, games, wins, and cashouts
- **Cashout System**: Transfer winnings back to original wallet

## Architecture Overview

### Database Schema

#### Users Table
- `user_id`: Primary key (UUID)
- `username`: Auto-generated username
- `password`: Not used for wallet users
- `pk`: Private key of generated game wallet
- `evm_addr`: Game wallet address (for deposits)
- `original_wallet_addr`: User's connected wallet address
- `game_balance`: Current game balance (NUMERIC)
- `created_at`, `updated_at`: Timestamps

#### Game Transactions Table
- `id`: Transaction ID (UUID)
- `user_id`: Reference to user
- `transaction_type`: deposit, withdrawal, game_win, game_loss, cashout
- `amount`: Transaction amount
- `game_type`: mines, apex (or null for non-game transactions)
- `game_session_id`: Session ID for game-related transactions
- `description`: Human-readable description
- `created_at`: Timestamp

## API Endpoints

### Wallet Management

#### Connect Wallet
```
POST /wallet/connect
```
**Request:**
```json
{
  "wallet_address": "0x1234..."
}
```
**Response:**
```json
{
  "user_id": "uuid",
  "game_private_key": "0x...",
  "game_public_key": "uuid",
  "game_evm_address": "0x...",
  "is_new_user": true
}
```

#### Get Game Address
```
GET /game-address/{wallet_address}
```
**Response:**
```json
{
  "game_address": "0x...",
  "user_id": "uuid"
}
```

#### Get Balance
```
GET /balance-address/{address}
```
**Response:**
```json
{
  "balance": "100.50",
  "user_id": "uuid",
  "game_address": "0x..."
}
```

#### Deposit (Simulation)
```
POST /deposit/{address}
```
**Request:**
```json
{
  "amount": "50.00"
}
```
**Response:**
```json
{
  "success": true,
  "new_balance": "150.50",
  "transaction_id": "uuid"
}
```

#### Cashout
```
POST /cashout/{address}
```
**Request:**
```json
{
  "amount": "100.00"
}
```
**Response:**
```json
{
  "success": true,
  "amount_cashed_out": "100.00",
  "remaining_balance": "50.50",
  "transaction_id": "uuid",
  "recipient_address": "0x..."
}
```

#### Transaction History
```
GET /transactions/{address}
```
**Response:**
```json
{
  "transactions": [...],
  "total_count": 25
}
```

### Mines Game

The Mines game is a minesweeper-style game where players reveal blocks to win multipliers.

#### Start Game
```
POST /mines/start
```
**Headers:** `Authorization: Bearer <jwt_token>`

**Request:**
```json
{
  "amount": 10,
  "blocks": 25,
  "mines": 5
}
```
**Response:**
```json
{
  "id": "game_session_id",
  "amount": 10,
  "blocks": 25,
  "mines": 5,
  "session_status": "Active"
}
```

#### Make Move
```
POST /mines/move
```
**Headers:** `Authorization: Bearer <jwt_token>`

**Request:**
```json
{
  "id": "game_session_id",
  "block": 15
}
```
**Response:**
```json
{
  "id": "game_session_id",
  "actions": {"move_1": {"block": 15, "multiplier": 1.24, "safe": true}},
  "current_multiplier": 1.24,
  "potential_payout": 12,
  "final_payout": null,
  "bomb_blocks": null,
  "session_status": "Active"
}
```

#### Cashout
```
POST /mines/cashout
```
**Headers:** `Authorization: Bearer <jwt_token>`

**Request:**
```json
{
  "id": "game_session_id"
}
```
**Response:**
```json
{
  "id": "game_session_id",
  "src": 10,
  "final_payout": 12,
  "actions": {...},
  "bomb_blocks": [3, 7, 12, 18, 22],
  "session_status": "Ended"
}
```

### Apex Game

The Apex game is a number guessing game with two modes: Blinder and Non-Blinder.

#### Start Game
```
POST /apex/start
```
**Headers:** `Authorization: Bearer <jwt_token>`

**Request:**
```json
{
  "amount": 10,
  "option": "NonBlinder" // or "Blinder"
}
```

**Response (Non-Blinder):**
```json
{
  "id": "game_session_id",
  "amount": 10,
  "option": "NonBlinder",
  "system_number": 5,
  "user_number": null,
  "payout_high": 1.98,
  "probability_high": 0.5,
  "payout_low": 1.98,
  "probability_low": 0.5,
  "payout_equal": 9.9,
  "probability_equal": 0.1,
  "session_status": "Active"
}
```

**Response (Blinder):**
```json
{
  "id": "game_session_id",
  "amount": 10,
  "option": "Blinder",
  "system_number": 5,
  "user_number": 7,
  "payout_percentage": 2.2,
  "blinder_suit": {
    "won": true,
    "payout": 22
  },
  "session_status": "Ended"
}
```

#### Make Choice (Non-Blinder only)
```
POST /apex/choose
```
**Headers:** `Authorization: Bearer <jwt_token>`

**Request:**
```json
{
  "id": "game_session_id",
  "choice": "High" // "Low", "Equal"
}
```
**Response:**
```json
{
  "id": "game_session_id",
  "choice": "High",
  "user_number": 8,
  "system_number": 5,
  "won": true,
  "payout": 19,
  "session_status": "Ended"
}
```

## Game Flow

### 1. User Onboarding
1. User connects their external wallet via `/wallet/connect`
2. System generates a game wallet and returns credentials
3. User can get their game address via `/game-address/{wallet}`

### 2. Deposit Funds
1. User deposits to their game address (in real app, this would be monitored on-chain)
2. For testing, use `/deposit/{address}` to simulate deposits
3. Check balance with `/balance-address/{address}`

### 3. Play Games
1. Start a game session (deducts bet from balance)
2. Make moves/choices
3. If won, winnings are automatically added to balance
4. If lost, no additional deduction (bet was already taken)

### 4. Cashout
1. User requests cashout via `/cashout/{address}`
2. System deducts from game balance
3. In real app, would initiate on-chain transfer to original wallet

## Security Features

- **JWT Authentication**: All game endpoints require valid JWT tokens
- **Server Secret**: Admin endpoints can use server secret header
- **Balance Validation**: All operations check sufficient balance
- **Transaction Atomicity**: Database transactions ensure consistency
- **User Isolation**: Users can only access their own data

## Error Handling

All endpoints return consistent error responses:
```json
{
  "error": "Insufficient balance",
  "status": 400
}
```

Common error codes:
- 400: Bad request (insufficient balance, invalid input)
- 401: Unauthorized (missing/invalid auth)
- 404: Not found (user/session not found)
- 500: Internal server error

## House Edge

Both games implement a 1% house edge:
- **Mines**: Applied to multiplier calculations
- **Apex**: Applied to payout calculations

This ensures the platform is profitable while maintaining fair odds for players.

## Development Notes

- Database migrations run automatically on startup
- All balances are stored as `NUMERIC` for precision
- Timestamps are stored in UTC
- Game sessions are cached in memory with 30-minute TTL
- Transaction history provides complete audit trail
