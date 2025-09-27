# Choose Rich API Usage Examples

## Example Flow: Complete User Journey

### 1. Connect Wallet
```bash
curl -X POST http://localhost:5433/wallet/connect \
  -H "Content-Type: application/json" \
  -H "X-Server-secret: X-Server-secret" \
  -d '{
    "wallet_address": "0x742F35Cc6C4C4B6c5B7b8e7e7F8E9F0A1B2C3D4E"
  }'
```

Response:
```json
{
  "user_id": "123e4567-e89b-12d3-a456-426614174000",
  "game_private_key": "0x...",
  "game_public_key": "123e4567-e89b-12d3-a456-426614174000",
  "game_evm_address": "0xabc123...",
  "is_new_user": true
}
```

### 2. Get Game Address
```bash
curl -X GET http://localhost:5433/game-address/0x742F35Cc6C4C4B6c5B7b8e7e7F8E9F0A1B2C3D4E \
  -H "X-Server-secret: X-Server-secret"
```

### 3. Simulate Deposit
```bash
curl -X POST http://localhost:5433/deposit/0x742F35Cc6C4C4B6c5B7b8e7e7F8E9F0A1B2C3D4E \
  -H "Content-Type: application/json" \
  -H "X-Server-secret: X-Server-secret" \
  -d '{
    "amount": "100.00"
  }'
```

### 4. Check Balance
```bash
curl -X GET http://localhost:5433/balance-address/0x742F35Cc6C4C4B6c5B7b8e7e7F8E9F0A1B2C3D4E \
  -H "X-Server-secret: X-Server-secret"
```

### 5. Play Mines Game

#### Start Game
```bash
curl -X POST http://localhost:5433/mines/start \
  -H "Content-Type: application/json" \
  -H "X-Server-secret: X-Server-secret" \
  -d '{
    "amount": 10,
    "blocks": 25,
    "mines": 5
  }'
```

#### Make a Move
```bash
curl -X POST http://localhost:5433/mines/move \
  -H "Content-Type: application/json" \
  -H "X-Server-secret: X-Server-secret" \
  -d '{
    "id": "game_session_id_from_start_response",
    "block": 1
  }'
```

#### Cashout (if successful)
```bash
curl -X POST http://localhost:5433/mines/cashout \
  -H "Content-Type: application/json" \
  -H "X-Server-secret: X-Server-secret" \
  -d '{
    "id": "game_session_id_from_start_response"
  }'
```

### 6. Play Apex Game

#### Start Non-Blinder Game
```bash
curl -X POST http://localhost:5433/apex/start \
  -H "Content-Type: application/json" \
  -H "X-Server-secret: X-Server-secret" \
  -d '{
    "amount": 10,
    "option": "NonBlinder"
  }'
```

#### Make Choice
```bash
curl -X POST http://localhost:5433/apex/choose \
  -H "Content-Type: application/json" \
  -H "X-Server-secret: X-Server-secret" \
  -d '{
    "id": "game_session_id_from_start_response",
    "choice": "High"
  }'
```

#### Start Blinder Game (Auto-resolves)
```bash
curl -X POST http://localhost:5433/apex/start \
  -H "Content-Type: application/json" \
  -H "X-Server-secret: X-Server-secret" \
  -d '{
    "amount": 10,
    "option": "Blinder"
  }'
```

### 7. View Transaction History
```bash
curl -X GET http://localhost:5433/transactions/0x742F35Cc6C4C4B6c5B7b8e7e7F8E9F0A1B2C3D4E \
  -H "X-Server-secret: X-Server-secret"
```

### 8. Monitor Deposit Status
```bash
curl -X GET http://localhost:3002/monitor/status \
  -H "X-Server-secret: X-Server-secret"
```

### 9. Force a Deposit (Testing Only)
```bash
curl -X POST http://localhost:3002/monitor/force-deposit \
  -H "Content-Type: application/json" \
  -H "X-Server-secret: X-Server-secret" \
  -d '{
    "user_id": "123e4567-e89b-12d3-a456-426614174000",
    "amount": "25.00"
  }'
```

### 10. Trigger Manual Deposit Check
```bash
curl -X POST http://localhost:3002/monitor/check \
  -H "X-Server-secret: X-Server-secret"
```

### 11. Cashout to Original Wallet
```bash
curl -X POST http://localhost:3002/cashout/0x742F35Cc6C4C4B6c5B7b8e7e7F8E9F0A1B2C3D4E \
  -H "Content-Type: application/json" \
  -H "X-Server-secret: X-Server-secret" \
  -d '{
    "amount": "50.00"
  }'
```

## JavaScript/TypeScript Example

```typescript
class ChooseRichAPI {
  private baseUrl = 'http://localhost:3002';
  private serverSecret = 'X-Server-secret';

  async connectWallet(walletAddress: string) {
    const response = await fetch(`${this.baseUrl}/wallet/connect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Server-secret': this.serverSecret,
      },
      body: JSON.stringify({ wallet_address: walletAddress })
    });
    return response.json();
  }

  async getBalance(address: string) {
    const response = await fetch(`${this.baseUrl}/balance-address/${address}`, {
      headers: { 'X-Server-secret': this.serverSecret }
    });
    return response.json();
  }

  async startMinesGame(amount: number, blocks: number = 25, mines: number = 5) {
    const response = await fetch(`${this.baseUrl}/mines/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Server-secret': this.serverSecret,
      },
      body: JSON.stringify({ amount, blocks, mines })
    });
    return response.json();
  }

  async makeMove(gameId: string, block: number) {
    const response = await fetch(`${this.baseUrl}/mines/move`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Server-secret': this.serverSecret,
      },
      body: JSON.stringify({ id: gameId, block })
    });
    return response.json();
  }

  async cashoutMines(gameId: string) {
    const response = await fetch(`${this.baseUrl}/mines/cashout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Server-secret': this.serverSecret,
      },
      body: JSON.stringify({ id: gameId })
    });
    return response.json();
  }

  async getMonitorStatus() {
    const response = await fetch(`${this.baseUrl}/monitor/status`, {
      headers: { 'X-Server-secret': this.serverSecret }
    });
    return response.json();
  }

  async forceDeposit(userId: string, amount: string) {
    const response = await fetch(`${this.baseUrl}/monitor/force-deposit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Server-secret': this.serverSecret,
      },
      body: JSON.stringify({ user_id: userId, amount })
    });
    return response.json();
  }

  async triggerDepositCheck() {
    const response = await fetch(`${this.baseUrl}/monitor/check`, {
      method: 'POST',
      headers: { 'X-Server-secret': this.serverSecret }
    });
    return response.json();
  }
}

// Usage
const api = new ChooseRichAPI();

async function playFullGame() {
  // Connect wallet
  const walletData = await api.connectWallet('0x742F35Cc6C4C4B6c5B7b8e7e7F8E9F0A1B2C3D4E');
  console.log('Connected:', walletData);

  // Start game
  const game = await api.startMinesGame(10, 25, 5);
  console.log('Game started:', game);

  // Make some moves
  let currentGame = game;
  for (let block of [1, 5, 10, 15, 20]) {
    const moveResult = await api.makeMove(currentGame.id, block);
    console.log(`Move ${block}:`, moveResult);
    
    if (moveResult.session_status === 'Ended') {
      console.log('Game ended - hit a mine!');
      break;
    }
    
    // Cashout if we're feeling lucky
    if (moveResult.potential_payout && moveResult.potential_payout > 15) {
      const cashout = await api.cashoutMines(currentGame.id);
      console.log('Cashed out:', cashout);
      break;
    }
  }

  // Check final balance
  const balance = await api.getBalance('0x742F35Cc6C4C4B6c5B7b8e7e7F8E9F0A1B2C3D4E');
  console.log('Final balance:', balance);
}

playFullGame().catch(console.error);

// Example: Using deposit monitoring
async function testDepositMonitoring() {
  const api = new ChooseRichAPI();
  
  // Check monitor status
  const status = await api.getMonitorStatus();
  console.log('Monitor Status:', status);
  
  // Connect wallet first
  const walletData = await api.connectWallet('0x742F35Cc6C4C4B6c5B7b8e7e7F8E9F0A1B2C3D4E');
  console.log('Connected wallet:', walletData);
  
  // Force a deposit for testing (simulation mode)
  const forceDeposit = await api.forceDeposit(walletData.user_id, '10.0');
  console.log('Forced deposit:', forceDeposit);
  
  // Check balance after deposit
  const balance = await api.getBalance('0x742F35Cc6C4C4B6c5B7b8e7e7F8E9F0A1B2C3D4E');
  console.log('Balance after deposit:', balance);
  
  // Trigger manual deposit check
  const checkResult = await api.triggerDepositCheck();
  console.log('Manual check result:', checkResult);
}

testDepositMonitoring().catch(console.error);
```

## Error Handling Examples

```typescript
async function safeApiCall() {
  try {
    const game = await api.startMinesGame(1000, 25, 5); // Might fail if insufficient balance
  } catch (error) {
    if (error.status === 400) {
      console.log('Insufficient balance or invalid parameters');
    } else if (error.status === 401) {
      console.log('Authentication failed');
    } else {
      console.log('Server error:', error);
    }
  }
}
```

## Real-World Integration Notes

1. **Authentication**: In production, replace the server secret with proper JWT authentication
2. **Deposits**: The system now includes automatic deposit monitoring that:
   - Runs every 5 seconds checking all game addresses
   - Updates user balances when deposits are detected
   - Records transaction history automatically
   - Can be configured for real blockchain integration
3. **Cashouts**: Implement actual on-chain transactions for withdrawals
4. **Rate Limiting**: Add rate limiting to prevent abuse
5. **Validation**: Add more robust input validation
6. **Monitoring**: Comprehensive logging and monitoring for all transactions and deposits

## Deposit Monitoring Features

The new deposit monitoring system provides:

- **Automatic Detection**: Constantly monitors all game addresses for new deposits
- **Balance Updates**: Automatically updates user game balances when deposits are detected
- **Transaction Recording**: Creates proper transaction records for audit trails
- **Simulation Mode**: For development/testing with configurable probability
- **Manual Controls**: Force deposits and trigger checks for testing
- **Status Monitoring**: Real-time status of the monitoring service
- **Fast Updates**: 5-second check intervals for responsive user experience

### Configuration Options

- `check_interval_secs`: How often to check for deposits (default: 5 seconds)
- `enable_simulation`: Enable simulation mode for testing (default: true)
- `simulation_probability`: Chance of generating random deposits (default: 2%)
- `required_confirmations`: Blockchain confirmations needed (default: 3)
- `rpc_url`: Blockchain RPC endpoint for real monitoring
