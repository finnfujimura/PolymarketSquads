-- 1. USERS TABLE
-- Stores app users, linked to their EVM wallet address and public Polymarket address.
CREATE TABLE IF NOT EXISTS users (
    "evmAddress" TEXT PRIMARY KEY,
    "polymarketUserAddress" TEXT,
    "username" TEXT,
    "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- 2. SQUADS TABLE
-- Stores the group chats.
CREATE TABLE IF NOT EXISTS squads (
    "id" SERIAL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "inviteCode" TEXT NOT NULL UNIQUE,
    "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- 3. SQUAD_MEMBERS TABLE
-- A "join" table to link users to squads (many-to-many).
CREATE TABLE IF NOT EXISTS squad_members (
    "userId" TEXT REFERENCES users("evmAddress") ON DELETE CASCADE,
    "squadId" INT REFERENCES squads("id") ON DELETE CASCADE,
    "joinedAt" TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY ("userId", "squadId")
);

-- 4. CHAT_MESSAGES TABLE
-- Stores all chat history.
CREATE TABLE IF NOT EXISTS chat_messages (
    "id" SERIAL PRIMARY KEY,
    "squadId" INT REFERENCES squads("id") ON DELETE CASCADE,
    "authorAddress" TEXT REFERENCES users("evmAddress") ON DELETE SET NULL, -- Use SET NULL so bot messages persist
    "content" TEXT NOT NULL,
    "isBot" BOOLEAN DEFAULT FALSE,
    "timestamp" TIMESTAMPTZ DEFAULT NOW()
);
-- Add index for faster chat loading
CREATE INDEX IF NOT EXISTS idx_chat_squadId_timestamp ON chat_messages ("squadId", "timestamp" DESC);

-- 5. BOT_STATE TABLE
-- Stores the last seen trade for each user to prevent duplicate bot posts.
CREATE TABLE IF NOT EXISTS bot_state (
    "polymarketUserAddress" TEXT PRIMARY KEY,
    "lastSeenHash" TEXT,
    "lastPostTimestamp" TIMESTAMPTZ
);

-- 6. (OPTIONAL) RETENTION FUNCTION
-- A database function to automatically delete old messages.
-- You can call this from your backend after inserting a new message.
CREATE OR REPLACE FUNCTION delete_old_messages(squad_id INT)
RETURNS void AS $$
DECLARE
    row_count INT;
BEGIN
    -- Get total count
    SELECT COUNT(*) INTO row_count FROM chat_messages WHERE "squadId" = squad_id;

    -- If count exceeds 200, delete the oldest
    IF row_count > 200 THEN
        DELETE FROM chat_messages
        WHERE "id" IN (
            SELECT "id" FROM chat_messages
            WHERE "squadId" = squad_id
            ORDER BY "timestamp" ASC
            LIMIT (row_count - 200)
        );
    END IF;
END;
$$ LANGUAGE plpgsql;