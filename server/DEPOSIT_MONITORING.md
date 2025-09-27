# Deposit Monitoring System 🔄💰

The Choose Rich platform features an advanced **automated deposit monitoring system** that continuously monitors all game wallet addresses for incoming deposits and instantly updates user balances. This system is designed for high performance, reliability, and smooth user experience.

## 🏗️ Architecture Overview

The deposit monitoring system consists of several key components:

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Deposit        │    │   Blockchain     │    │   Database      │
│  Monitor        │───▶│   Scanner        │───▶│   Balance       │
│  Service        │    │   (Simulation)   │    │   Updates       │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                        │                       │
         ▼                        ▼                       ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Background    │    │   Transaction    │    │  Transaction    │
│   Task Runner   │    │   Processing     │    │   History       │
│   (5s intervals)│    │   Engine         │    │   Recording     │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## 🚀 Key Features

### ⚡ Real-time Monitoring
- **5-second check intervals** for near-instant deposit detection
- **Background processing** that doesn't block game operations
- **Automatic balance updates** without user intervention
- **Comprehensive error handling** and retry mechanisms

### 🔐 Security & Reliability
- **Duplicate transaction prevention** using transaction hash tracking
- **Atomic database operations** ensuring data consistency
- **Comprehensive logging** for audit trails and debugging
- **Graceful error handling** with detailed error reporting

### 🧪 Development & Testing
- **Simulation mode** for development and testing
- **Manual controls** for triggering deposits and checks
- **Configurable probability** for simulated deposits
- **Force deposit functionality** for testing specific scenarios

## 📋 Configuration

The deposit monitor is highly configurable through the `DepositMonitorConfig` structure:

```rust
pub struct DepositMonitorConfig {
    pub check_interval_secs: u64,        // How often to check (default: 5)
    pub required_confirmations: u32,      // Blockchain confirmations needed (default: 3)
    pub rpc_url: Option<String>,          // Blockchain RPC endpoint
    pub enable_simulation: bool,          // Enable simulation mode (default: true)
    pub simulation_probability: f64,      // Chance of random deposits (default: 0.01)
}
```

### Default Configuration
```rust
DepositMonitorConfig {
    check_interval_secs: 5,
    required_confirmations: 3,
    rpc_url: None,
    enable_simulation: true,
    simulation_probability: 0.02, // 2% chance per check cycle
}
```

## 🔄 How It Works

### 1. Service Initialization
When the server starts:
1. Database connections are established
2. Migration ensures proper table structure
3. Deposit monitor service is created with configuration
4. Background task is spawned with specified interval

### 2. Monitoring Cycle
Every 5 seconds (configurable), the monitor:
1. **Queries database** for all user game addresses
2. **Scans blockchain** (or simulates) for new deposits
3. **Processes detected deposits** by updating balances
4. **Records transactions** for audit and user history
5. **Updates internal state** to prevent duplicate processing

### 3. Deposit Processing
When a deposit is detected:
1. **Validates transaction** isn't already processed
2. **Identifies recipient user** by game address
3. **Updates user balance** atomically in database
4. **Records transaction** with full details and description
5. **Logs successful processing** with amount and user info

## 🛠️ API Endpoints

The deposit monitoring system exposes several endpoints for management and testing:

### Monitor Status
Get real-time status of the deposit monitor:

```bash
GET /monitor/status
```

**Response:**
```json
{
  "status": {
    "is_running": true,
    "check_interval_secs": 5,
    "simulation_mode": true,
    "current_block": 1000145,
    "processed_transactions": 23,
    "monitored_addresses": 15
  }
}
```

### Force Deposit (Testing)
Manually trigger a deposit for testing:

```bash
POST /monitor/force-deposit
Content-Type: application/json

{
  "user_id": "123e4567-e89b-12d3-a456-426614174000",
  "amount": "25.50"
}
```

### Manual Check Trigger
Manually trigger a deposit check cycle:

```bash
POST /monitor/check
```

## 📊 Database Schema

### Users Table
The system monitors the `evm_addr` field for each user:

```sql
CREATE TABLE users (
    user_id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    username VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    pk VARCHAR(255) NOT NULL,                    -- Private key (hex)
    evm_addr VARCHAR(255) NOT NULL,              -- Game wallet address (MONITORED)
    original_wallet_addr VARCHAR(255),           -- User's external wallet
    game_balance NUMERIC NOT NULL DEFAULT 0,     -- In-game balance (UPDATED)
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
```

### Game Transactions Table
All deposit transactions are recorded:

```sql
CREATE TABLE game_transactions (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    user_id TEXT NOT NULL REFERENCES users(user_id),
    transaction_type VARCHAR(20) NOT NULL,       -- 'deposit' for monitor
    amount NUMERIC NOT NULL,                     -- Deposit amount
    game_type VARCHAR(20),                       -- NULL for deposits
    game_session_id TEXT,                        -- NULL for deposits
    description TEXT,                            -- Blockchain tx details
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
```

## 🎯 Use Cases

### 1. New User Onboarding
```
1. User connects external wallet (0x1234...)
2. System generates game wallet (0xabcd...)
3. User sends crypto to game wallet
4. Monitor detects deposit within 5 seconds
5. Balance updated automatically
6. User can immediately start playing
```

### 2. Existing User Top-up
```
1. User checks their game wallet address
2. User sends additional funds to game wallet
3. Monitor detects new deposit
4. Balance increases automatically
5. User sees updated balance in games
```

### 3. Development Testing
```
1. Developer starts server in simulation mode
2. System randomly generates deposits
3. Balances update automatically for testing
4. Manual controls available for specific testing
```

## 🧪 Testing & Development

### Simulation Mode
The system includes a sophisticated simulation engine for development:

```rust
// Enable simulation with custom probability
let config = DepositMonitorConfig {
    enable_simulation: true,
    simulation_probability: 0.1, // 10% chance per cycle
    ..Default::default()
};
```

### Test Coverage
Comprehensive test suite includes:
- ✅ **Service lifecycle** (start/stop/status)
- ✅ **Deposit simulation** with various amounts
- ✅ **Balance updates** and database consistency
- ✅ **Transaction recording** and audit trails
- ✅ **Concurrent processing** and race condition handling
- ✅ **Error handling** for invalid users/amounts
- ✅ **Precision handling** for decimal amounts

### Running Tests
```bash
# Run all deposit monitor tests
cargo test deposit_monitor

# Run with output for debugging
cargo test deposit_monitor -- --nocapture

# Run specific test
cargo test test_force_simulate_deposit
```

## 🔧 Production Deployment

### Real Blockchain Integration
For production deployment, implement real blockchain monitoring by:

1. **Configure RPC endpoint**:
```rust
let config = DepositMonitorConfig {
    enable_simulation: false,
    rpc_url: Some("https://mainnet.infura.io/v3/YOUR_PROJECT_ID".to_string()),
    ..Default::default()
};
```

2. **Implement blockchain scanning** in `monitor.rs`:
```rust
// Replace simulation with real blockchain calls
async fn scan_blockchain_deposits(&self, addresses: &[MonitoredAddress]) 
    -> Result<Vec<DepositEvent>, Box<dyn std::error::Error + Send + Sync>> {
    // Use alloy-rs or web3 to scan for deposits
    // Filter by contract addresses and block ranges
    // Return actual deposit events from blockchain
}
```

### Performance Optimization
For high-traffic production environments:

- **Increase connection pool size** for database
- **Implement caching** for frequently accessed data
- **Use database read replicas** for balance queries
- **Batch process deposits** for efficiency
- **Implement circuit breakers** for blockchain RPC calls

### Monitoring & Alerting
Set up monitoring for:
- **Service health** and uptime
- **Deposit processing latency**
- **Failed deposit attempts**
- **Balance consistency checks**
- **RPC endpoint availability**

## 🚨 Error Handling

The system includes comprehensive error handling:

### Common Errors
- **User not found** for deposit address
- **Invalid deposit amounts** (negative/zero)
- **Database connection failures**
- **Blockchain RPC timeouts**
- **Duplicate transaction processing**

### Error Recovery
- **Automatic retry** for transient failures
- **Detailed logging** for debugging
- **Graceful degradation** when services are unavailable
- **Manual recovery tools** for stuck transactions

## 📈 Performance Metrics

### Expected Performance
- **Deposit detection**: < 5 seconds
- **Balance update**: < 100ms after detection
- **Database queries**: < 50ms average
- **Memory usage**: < 50MB baseline
- **CPU usage**: < 5% on modern hardware

### Scalability
The system is designed to handle:
- **10,000+ monitored addresses**
- **100+ deposits per minute**
- **High concurrent user load**
- **Multiple blockchain networks**

## 🔮 Future Enhancements

### Planned Features
- [ ] **Multi-chain support** (Bitcoin, Polygon, etc.)
- [ ] **Real-time WebSocket notifications**
- [ ] **Deposit confirmation levels**
- [ ] **Automatic cashout triggers**
- [ ] **Advanced analytics dashboard**
- [ ] **Smart contract event listening**
- [ ] **Cross-chain bridge integration**

### Architecture Improvements
- [ ] **Microservice separation**
- [ ] **Message queue integration**
- [ ] **Distributed caching**
- [ ] **Container orchestration**
- [ ] **Auto-scaling capabilities**

## 🤝 Contributing

When contributing to the deposit monitoring system:

1. **Run full test suite** before submitting PRs
2. **Add tests** for new functionality
3. **Update documentation** for API changes
4. **Consider performance impact** of changes
5. **Test in simulation mode** before blockchain integration

## 📞 Support

For issues related to deposit monitoring:

1. **Check logs** with `RUST_LOG=debug`
2. **Verify monitor status** via `/monitor/status`
3. **Test with force deposits** for debugging
4. **Review database transactions** for inconsistencies
5. **Create GitHub issue** with detailed logs

---

**The deposit monitoring system is the backbone of Choose Rich's seamless user experience, ensuring fast, reliable, and secure handling of all cryptocurrency deposits.** 🚀💰