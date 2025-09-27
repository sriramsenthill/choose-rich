# Random Number Server

A simple Express.js server that generates random numbers between 0-9.

## Features

- Generate single random numbers (0-9)
- Generate multiple random numbers at once
- CORS enabled for cross-origin requests
- Health check endpoint
- Error handling

## Installation

```bash
npm install
```

## Usage

### Start the server

```bash
# Development mode (with auto-restart)
npm run dev

# Production mode
npm start
```

The server will start on port 3000 by default.

## API Endpoints

### 1. Get Server Info
```
GET /
```
Returns server information and available endpoints.

### 2. Generate Single Random Number
```
GET /random
```
Returns a single random number between 0-9.

**Response:**
```json
{
  "success": true,
  "randomNumber": 7,
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### 3. Generate Multiple Random Numbers
```
GET /random/:count
```
Generate multiple random numbers (1-100).

**Example:**
```
GET /random/5
```

**Response:**
```json
{
  "success": true,
  "count": 5,
  "randomNumbers": [3, 7, 1, 9, 4],
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### 4. Health Check
```
GET /health
```
Check if the server is running.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

## Environment Variables

- `PORT`: Server port (default: 3000)

## Example Usage

```bash
# Get a single random number
curl http://localhost:3000/random

# Get 5 random numbers
curl http://localhost:3000/random/5

# Check server health
curl http://localhost:3000/health
```

## Integration with Your Game

You can use this server in your Rust minesweeper game by making HTTP requests to get random numbers instead of using the `rand` crate.

**Example in your game:**
```rust
// Instead of: rng.gen_range(1..=blocks)
// Make HTTP request to: http://localhost:3000/random
// Use the returned number as your mine position
```
