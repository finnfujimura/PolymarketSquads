projectplan.md

This plan outlines the steps to build the "Polymarket Social Squads" app using a Supabase backend. This architecture avoids all local database build errors and is ideal for a hackathon.

0) Scope & Constraints

Platforms: Web (Next.js as a Single Page App) + Node.js backend.

Datastore: Supabase (cloud-hosted Postgres) is the only database.

Networking: Socket.IO for our internal chat. Polling (REST) for Polymarket data.

Identity:

App ID: EVM Address (from wagmi).

Polymarket ID: Polymarket User Address (text input).

Bot:

Polls GET /activity for TRADE and REDEEM types.

Guardrail: Max 1 bot message per user every 15 seconds to prevent floods.

Feature: Messages include a deep-link to the Polymarket market.

Leaderboard:

Live PnL only (sum of cashPnl from GET /positions).

Cache: PnL results are cached for 30 seconds (using node-cache).

Chat:

Permissions: Only squad members can post in a squad chat.

Retention: Only the last 200 messages per squad are kept.

Demo:

Guardrail 1: "Fake Bot" endpoint for instant demo messages.

Guardrail 2: "Fake Mint" flow for instant prize claiming.

Guardrail 3: Pre-created demo squads in the database.

1) Minimal Repo & Runtime (Supabase)

Goal: Frontend and backend run locally; Supabase database is set up and connected.

1.1 Setup Supabase Project (GUI)

Go to supabase.com, create a new project.

Navigate to the "SQL Editor".

Copy and paste the contents of schema.sql and Run the script to create all our tables.

Go to Project Settings > API and copy the Project URL and anon public key.
Acceptance: Supabase project is live and tables are created.

1.2 Create folders

/frontend (Next.js + TypeScript)

/backend (Node.js + Express + TypeScript)
Acceptance: Folder layout exists in repo.

1.3 Initialize frontend

Create Next.js TypeScript app.

Add dependencies: wagmi, @web3modal/wagmi, socket.io-client, zustand, @dicebear/react, @dicebear/pixel-art, @supabase/supabase-js.
Acceptance: pnpm dev renders a test page.

1.4 Initialize backend

Setup Express with TypeScript.

Add dependencies: express, socket.io, @supabase/supabase-js, zod, dotenv, pino, node-fetch (or axios), node-cache.

Create /backend/.env and add:

POLYMARKET_ADMIN_API_KEY=...

SUPABASE_URL=... (From your project settings)

SUPABASE_ANON_KEY=... (From your project settings)
Acceptance: pnpm dev starts the server.

1.5 Database Client (backend/src/supabase.ts)

Create a supabase.ts file that initializes and exports the Supabase client.

This client will be imported by both the API server and the Bot service.
Acceptance: The backend can successfully query the Supabase database (e.g., supabase.from('users').select('*')).

2) User Identity & Squads

Goal: Users can connect, register their Polymarket address, and join a squad.

2.1 Wallet connect & Profile (Frontend + Backend)

Frontend: Use wagmi to connect. On connect, POST /auth/login { evmAddress } to find/create user in users table.

Frontend: "Profile" page shows the user's Dicebear avatar (seeded by their evmAddress).

Frontend: A simple input on the "Profile" page for "Polymarket User Address."

Backend: POST /user/profile endpoint that saves the polymarketUserAddress to the users table.
Acceptance: A user can connect their wallet and save their public Polymarket address to Supabase.

2.2 Create/Join Squads (Frontend + Backend)

Backend: POST /squads/create { name } → creates squad, adds user to squad_members, returns inviteCode.

Backend: POST /squads/join { inviteCode } → finds squad, adds user to squad_members.

Frontend: A simple UI to create or join a squad.
Acceptance: Two users can successfully create and/or join the same squad.

3) Core Chat & "Polling" Bot Feed

Goal: A live chat room where a bot posts users' trades (via polling).

3.1 Basic squad chat (with Permissions & Retention)

Backend: Setup Socket.IO.

Permission Middleware: A Socket.IO middleware checks if the socket.handshake.auth.userId is a member of the squadId room before allowing chat:send.

Backend: On chat:send, receive the message, save it to chat_messages in Supabase, and broadcast it.

Retention Hook: After saving, trigger a non-blocking function deleteOldMessages(squadId) (e.g., supabase.rpc('delete_old_messages', { squad_id: squadId })).

Frontend: socket.emit('chat:send', ...). On chat:receive, display the message with the sender's Dicebear avatar.

Frontend: Add a small UI element: <div class="text-green-500">Bot: Online</div>.
Acceptance: Two users in the same squad can send/receive messages. Chat history is capped.

3.2 "Squad Bot" Service (Backend cron job)

In bot.ts, create a function that runs on a timer (setInterval every 15 seconds).

Bot Logic:

Get all users from the users table who have a polymarketUserAddress.

For each user, call the Polymarket API: GET /activity?user=...&type=TRADE&type=REDEEM&limit=5.

For each activity (tx), check its transactionHash against bot_state.lastSeenHash.

If tx.transactionHash is new:
a. Rate-Limit: Check bot_state.lastPostTimestamp. If now - lastPostTimestamp < 15s, skip this user.
b. Format Message: Get tx.title, tx.slug, tx.side, tx.usdcSize. Create a message string.
c. Add Deep-Link: The message must include an HTML link: e.g., <a href="https://polymarket.com/event/${tx.slug}" target="_blank">${tx.title}</a>.
d. Post to Chat: Find the user's squadId. Save to chat_messages (isBot: true). Broadcast via Socket.IO.
e. Update State: Update bot_state with the new lastSeenHash and lastPostTimestamp.
Acceptance: A user trades on Polymarket. Within ~15-30s, a rate-limited, deep-linked bot message automatically appears in their chat.

4) Leaderboard & NFT Prize

Goal: Rank squad members by PnL (with caching) and reward the winner.

4.1 Live leaderboard (Backend with Caching)

Backend: const leaderboardCache = new NodeCache({ stdTTL: 30 });

Backend: GET /squads/:id/leaderboard endpoint.

Logic:

const cacheKey = \leaderboard:${squadId}`;`

If leaderboardCache.has(cacheKey), return the cached data.

If cache miss:
a. Get all members of the squad from Supabase.
b. For each member, call GET /positions?user=... (using their polymarketUserAddress).
c. Loop through all positions and sum the cashPnl field to get a totalLivePnl for each user.
d. Create the results array: [{ username, totalLivePnl, evmAddress, avatarUrl }, ...].
e. leaderboardCache.set(cacheKey, results);
f. Return results.

Frontend: A simple view that renders this array with Dicebear avatars.

Frontend: Add a "Refresh" button. On click, it re-fetches from /squads/:id/leaderboard.
Acceptance: A squad leaderboard shows the correct, cached, total live PnL for all members.

4.2 "Squad MVP" logic (Backend)

A simple cron job (e.g., runs once a day) that calls the leaderboard logic for all squads.

It saves the winner (evmAddress of user with highest PnL) for each squad in a new table (e.g., squad_winners: squadId, winnerAddress).

4.3 Gasless NFT mint (Frontend + Smart Contract)

Deploy a basic ERC-721 "Squad MVP" contract to the Polygon PoS testnet.

Backend: POST /squads/claim-prize endpoint (checks if user is in squad_winners, returns EIP-712 signature).
Acceptance: (See Demo Guardrails).

5) DEMO DAY GUARDRAILS (MANDATORY)

Goal: Ensure a smooth, flawless demo.

5.1 "Fake Bot" Endpoint (Backend)

Create: POST /demo/fake-trade { squadId, messageContent }.

Logic: Instantly saves messageContent to chat_messages (isBot: true) and broadcasts it to the squadId room.

Demo Flow: Presenter clicks a hidden button in the UI that calls this endpoint to instantly post the "bot" message.

5.2 "Fake Mint" Flow (Frontend)

The "Claim Prize" button will NOT call the gasless relayer.

Demo Flow:

User clicks "Claim Prize".

Show a "Minting..." spinner for 2 seconds.

Show a "Success! Your MVP Trophy has been minted!" modal.

This demonstrates the full flow without risking a slow or failed live transaction.

5.3 Pre-load Database (SQL Editor)

Demo Flow: Right before the presentation, run the schema.sql script (and a simple INSERT script for your demo users) in the Supabase SQL Editor to guarantee a clean, populated app.

Final Acceptance Checklist

[ ] Users can connect, join a squad, and see Dicebear avatars.

[ ] The chat has a "Bot: Online" indicator.

[ ] The demo operator can click a hidden button to instantly post a fake bot message.

[ ] The bot message contains a clickable deep-link to a Polymarket event.

[ ] The leaderboard displays correct totalLivePnl (sum of cashPnl).

[ ] Clicking the "Refresh" button on the leaderboard shows a loading state and updates.

[ ] A "winning" user can click "Claim Prize" and see an instant "Success!" modal.

[ ] The Supabase DB is pre-loaded with the "The Alpha Team" squad for the demo.