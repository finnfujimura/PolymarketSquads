api.md

This document is the "contract" between the frontend and backend. It defines all REST API endpoints, Socket.IO events, and data models for the "Polymarket Social Squads" app.

1. Data Models (TypeScript Interfaces)

These are the primary data shapes used within our application.

// The core user, authenticated by their EVM wallet
interface User {
  evmAddress: string;           // 0x... (Primary Key)
  username: string;             // e.g., "alex" or "steve"
  polymarketUserAddress?: string; // 0x... (The public PM address, nullable)
  avatarUrl: string;            // A generated Dicebear URL
}

// A group chat
interface Squad {
  id: string;
  name: string;
  inviteCode: string;
  members: User[]; // A list of current members
}

// A single chat message (from a user OR the bot)
interface ChatMessage {
  id: string;
  squadId: string;
  author: User;           // The user who sent it
  content: string;        // The message (or formatted HTML for the bot)
  isBot: boolean;
  timestamp: string;      // ISO 8601 timestamp
}

// A single entry on the leaderboard
interface LeaderboardEntry {
  user: User;
  totalLivePnl: number;   // Sum of `cashPnl` from all positions
  rank: number;
}


2. REST API Endpoints (Our Internal API)

All endpoints are prefixed with /api. All private endpoints require a Authorization: Bearer <jwt> header.

Auth

POST /api/auth/login

Description: Authenticates a user (logs in or signs up). Called after wagmi connection.

Body: { evmAddress: string }

Response: { token: string, user: User } (A JWT and the user object)

User

GET /api/user/me

Description: Gets the currently authenticated user's profile.

Auth: Required.

Response: { user: User }

POST /api/user/profile

Description: Updates the user's profile. Used to add their Polymarket address.

Auth: Required.

Body: { username?: string, polymarketUserAddress?: string }

Response: { user: User } (The updated user)

Squads

GET /api/squads

Description: Gets all squads the current user is a member of.

Auth: Required.

Response: { squads: Squad[] }

GET /api/squads/:id

Description: Gets details for a single squad.

Auth: Required (must be a member).

Response: { squad: Squad }

POST /api/squads/create

Description: Creates a new squad.

Auth: Required.

Body: { name: string }

Response: { squad: Squad } (The newly created squad)

POST /api/squads/join

Description: Joins an existing squad using an invite code.

Auth: Required.

Body: { inviteCode: string }

Response: { squad: Squad } (The squad they just joined)

GET /api/squads/:id/messages

Description: Gets the last 200 chat messages for a squad.

Auth: Required (must be a member).

Response: { messages: ChatMessage[] }

Leaderboard

GET /api/squads/:id/leaderboard

Description: Gets the (cached) live PnL leaderboard for a squad.

Auth: Required (must be a member).

Response: { leaderboard: LeaderboardEntry[] }

Prize

POST /api/squads/claim-prize

Description: For a "Squad MVP" to claim their prize.

Auth: Required.

Body: { squadId: string }

Response (Success): { signature: string, voucher: object } (The EIP-712 signature)

Response (Error): { message: "You are not the winner." }

Demo Mode (Guardrail)

POST /api/demo/fake-trade

Description: Instantly posts a fake bot message to a chat. For demo use only.

Auth: Not required (or use a simple secret).

Body: { squadId: string, messageContent: string }

Response: { success: true }

3. Socket.IO Events (Our Internal Chat Server)

Client -> Server

"connection"

Description: Client connects to the Socket.IO server.

Payload: auth: { token: string } (The JWT from login)

"chat:send"

Description: A user sends a new chat message.

Payload: { squadId: string, content: string }

Server -> Client

"chat:receive"

Description: The server broadcasts a new message (from a user OR the bot) to all members of a squad room.

Payload: ChatMessage (The full message object)

"connect_error"

Description: Sent by the server if the auth token is missing or invalid.

Payload: { message: "Authentication error" }

"error"

Description: Sent by the server if a user tries to do something they can't (e.g., send a message to a squad they aren't in).

Payload: { message: "You are not a member of this squad." }

4. External API Models (Polymarket Data Shapes)

These are the simplified TypeScript interfaces our backend bot expects to parse from the external Polymarket API.

For the Bot Feed (GET /activity)

Our bot will poll GET /activity?user=...&type=TRADE&type=REDEEM and expect an array of this shape.

// A simplified model of a Polymarket Activity Item
// (Based on the provided documentation)
interface PolymarketActivity {
  timestamp: number;
  conditionId: string;
  type: 'TRADE' | 'REDEEM' | 'SPLIT' | 'MERGE' | 'CONVERSION' | 'REWARD';
  usdcSize: number;       // The key value for our bot message
  transactionHash: string; // The unique ID we use to prevent duplicates
  price: number;
  side: 'BUY' | 'SELL';
  title: string;          // The market title
  slug: string;           // The event slug for deep-linking
  outcome: string;        // e.g., "YES" or "NO"
}


For the Leaderboard (GET /positions)

Our leaderboard will poll GET /positions?user=... and expect an array of this shape. We will sum the cashPnl field.

// A simplified model of a Polymarket Position
// (Based on the provided documentation)
interface PolymarketPosition {
  conditionId: string;
  size: number;
  avgPrice: number;
  currentValue: number;
  cashPnl: number;        // The key value for our leaderboard (sum of this)
  percentPnl: number;
  title: string;
  slug: string;
  outcome: string;
}
