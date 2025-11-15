architecture.md

This document defines the high-level system architecture for the "Polymarket Social Squads" app. The system is designed for simplicity, clear separation of concerns, and rapid development for a hackathon.

System Components

The system is comprised of three (3) main components and two (2) data stores:

Frontend (Next.js SPA): A client-side application running in the user's browser. It handles all UI, wallet connections, and state management.

Backend (API & Chat Server): A Node.js/Express server that manages the REST API, user authentication, and the real-time Socket.IO chat server.

Backend (Bot Poller): A separate, simple Node.js service that runs on a timer. Its only job is to poll the external Polymarket API and push new trade events into our Chat Server.

Database (Supabase): A cloud-hosted Postgres database. This is our single source of truth for user profiles, squads, and chat history.

External API (Polymarket): The third-party API we poll for all data.

Architecture Diagram (Flow of Data)

 [User's Browser]                                  [Polymarket API (External)]
 [   FRONTEND   ]                                          ^
 (Next.js, wagmi,                                          |
  Socket.io-client)                                        | (3) Polls every 15s
       |                                                   |     (Global API Key)
       | (1) REST (HTTPS)                                  |
       | (2) WebSocket (Chat)                              |
       v                                                   |
 [ Backend API / Chat Server ] <---------------------------+ [ Backend Bot Poller ]
 (Node.js, Express, Socket.io)         (4) Pushes new trades   (Node.js, 15s timer)
       |                             (via internal Socket.IO)      |
       | (5) Reads/Writes (Supabase JS Client)               |     | (5) Reads/Writes
       v                                                     |     v
 [ Database (Supabase) ] <-----------------------------------+
 (Cloud-hosted Postgres:
  users, squads, chat_messages)


Data Flow & Responsibilities

Frontend <-> Backend API (REST)

The frontend uses wagmi to get a wallet address, then sends it to POST /auth/login.

The API returns a JWT (JSON Web Token).

The frontend uses this JWT as a Bearer token for all future REST calls (e.g., GET /squads/mine, POST /user/profile, GET /squads/:id/leaderboard).

Frontend <-> Chat Server (WebSocket)

The frontend connects to the Socket.IO server and authenticates using the same JWT.

It emits chat:send events (user messages).

It ons chat:receive events (to display new messages from users and the bot).

Bot Poller -> Polymarket API

This service runs in a simple setInterval loop (e.g., every 15 seconds).

It uses its Supabase client to fetch all users to poll.

It uses the single global admin API key to poll GET /activity and GET /positions for each user.

Bot Poller -> Chat Server

When the poller finds a new trade (by checking the bot_state table in Supabase), it acts as a privileged client.

It connects to its own Socket.IO server (running in the API component) with a special admin token.

It emits a bot:post-message event with the formatted trade details. The API server then broadcasts this to the correct squad room.

Backend API & Bot Poller <-> Database

Both the API Server and the Bot Poller initialize their own @supabase/supabase-js client.

They both connect to the same cloud-hosted Supabase project to read/write data (e.g., the API saves new users, the Bot saves new bot messages). This is a safe and simple way to share data between the two services.

Key Architectural Decisions

Polling over WebSocket: We are polling the Polymarket API instead of using their real-time WebSocket. This is a deliberate choice to reduce complexity, eliminate the need for user-supplied API keys, and make the bot service stateless and robust.

Single Global API Key: Simplifies user onboarding dramatically. The app is "view-only," so this is secure.

Supabase (Postgres): Replaces sqlite to avoid all local C++/native addon build errors. This provides a robust, zero-config cloud database that both backend services can easily and safely connect to.

Separation of Concerns: The API Server handles user requests. The Bot Poller handles data ingestion. They are two separate Node.js processes. This is critical for stability.