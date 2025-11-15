projectoverview.md

Vision

A "social alpha" platform for Polymarket traders. "Polymarket Social Squads" is a web app that combines a group chat with a live, automated feed of your friends' real trades. It's a "Sleeper-like" social layer that turns the lonely experience of trading into a fun, competitive, and collaborative team sport.

Core Concept

Users form "Squads" (group chats of 3-10 members) with their friends. When any member of the Squad makes a trade or redeems a winning position, our app's bot automatically detects it and posts a message into the chat, sparking discussion and copy-trading.

A live leaderboard tracks everyone's open PnL, and a weekly "Squad MVP" wins a (gasless) NFT prize. This creates a "social proof" and "alpha" feed from the only people you trust: your friends.

MVP Scope

Polygon Wallet Connect: Use wagmi / web3modal for app identity (EVM 0x... address).

Public Address Profile: Users save their public Polymarket User Address to their profile.

Single Admin API Key: The backend uses one global admin API key for all Polymarket API calls.

Squads (Group Chats): Users can create/join squads (3-10 members) via an invite code.

Live Chat: A basic real-time chat room for each squad.

Polling Bot Feed: A backend "Bot" polls the GET /activity endpoint for all users. New trades and redemptions are automatically posted into the correct squad chat.

Deep-Linking: Bot messages include a direct link to the corresponding Polymarket market.

Live PnL Leaderboard: A simple display showing the total live PnL for each member, calculated by polling GET /positions and summing the cashPnl field.

Manual Refresh: A "Refresh" button on the leaderboard to instantly re-fetch PnL data.

Gasless NFT Prize: A weekly "Squad MVP" (highest live PnL) can claim an ERC-721 trophy.

Datastore: Supabase (cloud-hosted Postgres) for all data.

Security & Privacy

This is a view-only application. We only use a single admin API key to read publicly available user activity. We never handle user private keys, API keys, or privileged access, ensuring zero risk to user funds.

Demo Day Guardrails

Pre-created Demo Squads: The app will be pre-loaded with a demo squad ("The Alpha Team").

"Demo Mode" Bot Button: A hidden admin button to manually trigger a "bot" message in the chat.

"Pre-Minted" Prize: The "Claim Prize" button will simulate the minting process and show an instant "Success!" modal.

Non-goals (for MVP)

No actual trading within our app (users trade on Polymarket).

No user-supplied API keys (we use one global key).

No real-time WebSockets to Polymarket (we are polling).

No complex historical PnL calculation (we use live PnL only).

No local database (we use Supabase).

Tech Stack

Layer

Tech

Frontend

Next.js (as SPA) + TypeScript, wagmi / web3modal, Socket.IO client, Zustand, @dicebear/react

Backend

Node.js + Express + TypeScript, Socket.IO, @supabase/supabase-js, node-cache

Data

Polymarket API: GET /activity (bot feed), GET /positions (live PnL), Gamma API (market names)

Datastore

Supabase (Postgres)

Auth

Wallet address is the app ID. Polymarket User Address is saved to the user's profile.

Blockchain

Polygon PoS (for the NFT prize)

Smart Contract

ERC-721 (for the "Squad MVP" trophy)