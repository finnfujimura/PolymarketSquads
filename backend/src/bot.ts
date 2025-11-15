import { io, Socket } from 'socket.io-client';
import dotenv from 'dotenv';
import { supabase } from './supabase';

dotenv.config();

const POLYMARKET_API_KEY = process.env.POLYMARKET_ADMIN_API_KEY;
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_in_production';
const POLL_INTERVAL = 15000; // 15 seconds

interface PolymarketActivity {
  timestamp: number;
  conditionId: string;
  type: 'TRADE' | 'REDEEM' | 'SPLIT' | 'MERGE' | 'CONVERSION' | 'REWARD';
  usdcSize: number;
  transactionHash: string;
  price: number;
  side: 'BUY' | 'SELL';
  title: string;
  slug: string;
  outcome: string;
}

let socket: Socket | null = null;

// Initialize Socket.IO connection to our own chat server
function initSocket() {
  // Create a bot token (we use a special evmAddress for the bot)
  const botAddress = '0xBOT0000000000000000000000000000000000000';
  const jwt = require('jsonwebtoken');
  const botToken = jwt.sign({ evmAddress: botAddress }, JWT_SECRET, { expiresIn: '7d' });

  socket = io(BACKEND_URL, {
    auth: { token: botToken },
  });

  socket.on('connect', () => {
    console.log('🤖 Bot connected to chat server');
  });

  socket.on('disconnect', () => {
    console.log('🤖 Bot disconnected from chat server');
  });

  socket.on('error', (error: any) => {
    console.error('🤖 Bot socket error:', error);
  });
}

// Fetch activities from Polymarket API
async function fetchUserActivities(polymarketUserAddress: string): Promise<PolymarketActivity[]> {
  try {
    const url = `https://gamma-api.polymarket.com/activity?user=${polymarketUserAddress}&type=TRADE&type=REDEEM&limit=5`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${POLYMARKET_API_KEY}`,
      },
    });

    if (!response.ok) {
      console.error(`Failed to fetch activities for ${polymarketUserAddress}: ${response.status}`);
      return [];
    }

    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error(`Error fetching activities for ${polymarketUserAddress}:`, error);
    return [];
  }
}

// Format a trade/redeem message with deep-link
function formatMessage(activity: PolymarketActivity, username: string): string {
  const emoji = activity.type === 'TRADE' 
    ? (activity.side === 'BUY' ? '📈' : '📉')
    : '💰';
  
  const action = activity.type === 'TRADE'
    ? `${activity.side.toLowerCase()}s`
    : 'redeems';

  const amount = `$${activity.usdcSize.toFixed(2)}`;
  
  const link = `<a href="https://polymarket.com/event/${activity.slug}" target="_blank" class="text-blue-600 dark:text-blue-400 underline">${activity.title}</a>`;

  return `${emoji} <strong>${username}</strong> ${action} ${amount} on ${activity.outcome} in ${link}`;
}

// Process activities for a single user
async function processUser(user: any) {
  try {
    const { polymarketUserAddress, evmAddress, username } = user;

    // Fetch recent activities
    const activities = await fetchUserActivities(polymarketUserAddress);

    if (activities.length === 0) {
      return;
    }

    // Get bot state for this user
    const { data: botState, error: stateError } = await supabase
      .from('bot_state')
      .select('*')
      .eq('polymarketUserAddress', polymarketUserAddress)
      .single();

    // Process each activity (newest first)
    for (const activity of activities) {
      // Skip if we've already seen this transaction
      if (botState && botState.lastSeenHash === activity.transactionHash) {
        continue;
      }

      // Rate limiting: Check if we posted for this user in the last 15 seconds
      if (botState && botState.lastPostTimestamp) {
        const timeSinceLastPost = Date.now() - new Date(botState.lastPostTimestamp).getTime();
        if (timeSinceLastPost < 15000) {
          console.log(`⏱️  Rate limit: Skipping ${username} (last post was ${Math.round(timeSinceLastPost / 1000)}s ago)`);
          continue;
        }
      }

      // Find which squad(s) this user is in
      const { data: memberships, error: memberError } = await supabase
        .from('squad_members')
        .select('squadId')
        .eq('userId', evmAddress);

      if (memberError || !memberships || memberships.length === 0) {
        console.log(`No squads found for user ${username}`);
        continue;
      }

      // Format the message
      const messageContent = formatMessage(activity, username || 'A trader');

      // Post to all squads this user is in
      for (const membership of memberships) {
        const squadId = membership.squadId;

        // Save to database
        const { error: saveError } = await supabase
          .from('chat_messages')
          .insert({
            squadId,
            authorAddress: null, // Bot messages have null author
            content: messageContent,
            isBot: true,
          });

        if (saveError) {
          console.error(`Failed to save bot message for squad ${squadId}:`, saveError);
          continue;
        }

        // Trigger retention (non-blocking, fire and forget)
        supabase.rpc('delete_old_messages', { squad_id: squadId });

        // Broadcast via Socket.IO
        if (socket && socket.connected) {
          const chatMessage = {
            id: Date.now().toString(),
            squadId: squadId.toString(),
            author: {
              evmAddress: 'bot',
              username: 'Bot',
              avatarUrl: 'https://api.dicebear.com/9.x/pixel-art/svg?seed=bot',
            },
            content: messageContent,
            isBot: true,
            timestamp: new Date().toISOString(),
          };

          socket.emit('chat:send', { squadId: squadId.toString(), content: messageContent });
          console.log(`🤖 Posted bot message to squad ${squadId}: ${activity.type} by ${username}`);
        }
      }

      // Update bot state with this transaction
      await supabase
        .from('bot_state')
        .upsert({
          polymarketUserAddress,
          lastSeenHash: activity.transactionHash,
          lastPostTimestamp: new Date().toISOString(),
        });

      // Only process the most recent new activity per user per cycle
      break;
    }
  } catch (error) {
    console.error(`Error processing user ${user.username}:`, error);
  }
}

// Main bot polling loop
async function botLoop() {
  try {
    // Get all users with Polymarket addresses
    const { data: users, error } = await supabase
      .from('users')
      .select('*')
      .not('polymarketUserAddress', 'is', null);

    if (error) {
      console.error('Error fetching users:', error);
      return;
    }

    if (!users || users.length === 0) {
      console.log('📭 No users with Polymarket addresses found');
      return;
    }

    console.log(`🔍 Checking ${users.length} user(s) for new activity...`);

    // Process each user
    for (const user of users) {
      await processUser(user);
    }
  } catch (error) {
    console.error('Bot loop error:', error);
  }
}

// Start the bot
function startBot() {
  console.log('🤖 Polymarket Bot Service Starting...');
  console.log(`📊 Polling interval: ${POLL_INTERVAL / 1000}s`);
  
  if (!POLYMARKET_API_KEY) {
    console.warn('⚠️  Warning: POLYMARKET_ADMIN_API_KEY not set. Bot will run but API calls may fail.');
  }

  // Initialize socket connection
  initSocket();

  // Run immediately
  botLoop();

  // Then run on interval
  setInterval(botLoop, POLL_INTERVAL);
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Bot shutting down...');
  if (socket) {
    socket.disconnect();
  }
  process.exit(0);
});

// Start the bot
startBot();
