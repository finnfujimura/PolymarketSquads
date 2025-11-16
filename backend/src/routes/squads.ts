import { Router } from 'express';
import { supabase } from '../supabase';
import { authMiddleware, AuthRequest } from '../auth';
import NodeCache from 'node-cache';
import { io as socketClient } from 'socket.io-client';
import jwt from 'jsonwebtoken';

const router = Router();
const pnlCache = new NodeCache({ stdTTL: 30 }); // 30 second TTL

// Initialize Socket.IO client to send messages to chat
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';
const JWT_SECRET = process.env.JWT_SECRET!;
const socket = socketClient(BACKEND_URL, {
  auth: {
    token: jwt.sign({ polymarketUserAddress: '0xBOT0000000000000000000000000000000000000' }, JWT_SECRET),
  },
});

// Helper to generate a random 6-character invite code
function generateInviteCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Helper to get squad with members
async function getSquadWithMembers(squadId: number) {
  const { data: squad, error: squadError } = await supabase
    .from('squads')
    .select('*')
    .eq('id', squadId)
    .single();

  if (squadError || !squad) {
    return null;
  }

  const { data: memberRows, error: membersError } = await supabase
    .from('squad_members')
    .select('userId')
    .eq('squadId', squadId);

  if (membersError) {
    return null;
  }

  const userIds = memberRows.map(m => m.userId);
  
  if (userIds.length === 0) {
    return { ...squad, members: [] };
  }

  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('*')
    .in('polymarketUserAddress', userIds);

  if (usersError) {
    return null;
  }

  const members = users.map(user => ({
    ...user,
    avatarUrl: `https://api.dicebear.com/9.x/pixel-art/svg?seed=${user.polymarketUserAddress}`,
  }));

  return { ...squad, members };
}

// GET /api/squads - Get all squads for current user
router.get('/', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { data: memberRows, error: memberError } = await supabase
      .from('squad_members')
      .select('squadId')
      .eq('userId', req.userId);

    if (memberError) {
      throw memberError;
    }

    if (!memberRows || memberRows.length === 0) {
      return res.json({ squads: [] });
    }

    const squadIds = memberRows.map(m => m.squadId);

    const squads = await Promise.all(
      squadIds.map(id => getSquadWithMembers(id))
    );

    const validSquads = squads.filter(s => s !== null);

    res.json({ squads: validSquads });
  } catch (error) {
    console.error('Get squads error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/squads/:id - Get details for a single squad
router.get('/:id', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const squadId = parseInt(req.params.id);

    if (isNaN(squadId)) {
      return res.status(400).json({ message: 'Invalid squad ID' });
    }

    // Check if user is a member
    const { data: membership, error: memberError } = await supabase
      .from('squad_members')
      .select('*')
      .eq('squadId', squadId)
      .eq('userId', req.userId)
      .single();

    if (memberError || !membership) {
      return res.status(403).json({ message: 'You are not a member of this squad' });
    }

    const squad = await getSquadWithMembers(squadId);

    if (!squad) {
      return res.status(404).json({ message: 'Squad not found' });
    }

    res.json({ squad });
  } catch (error) {
    console.error('Get squad error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/squads/create - Create a new squad
router.post('/create', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { name } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ message: 'Squad name is required' });
    }

    const inviteCode = generateInviteCode();

    // Create squad
    const { data: squad, error: squadError } = await supabase
      .from('squads')
      .insert({
        name: name.trim(),
        inviteCode,
      })
      .select()
      .single();

    if (squadError) {
      throw squadError;
    }

    // Add creator as first member
    const { error: memberError } = await supabase
      .from('squad_members')
      .insert({
        squadId: squad.id,
        userId: req.userId,
      });

    if (memberError) {
      throw memberError;
    }

    const fullSquad = await getSquadWithMembers(squad.id);

    res.json({ squad: fullSquad });
  } catch (error) {
    console.error('Create squad error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/squads/join - Join a squad with invite code
router.post('/join', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { inviteCode } = req.body;

    if (!inviteCode || typeof inviteCode !== 'string') {
      return res.status(400).json({ message: 'Invite code is required' });
    }

    // Find squad by invite code
    const { data: squad, error: squadError } = await supabase
      .from('squads')
      .select('*')
      .eq('inviteCode', inviteCode.trim().toUpperCase())
      .single();

    if (squadError || !squad) {
      return res.status(404).json({ message: 'Squad not found with that invite code' });
    }

    // Check if already a member
    const { data: existingMember } = await supabase
      .from('squad_members')
      .select('*')
      .eq('squadId', squad.id)
      .eq('userId', req.userId)
      .single();

    if (existingMember) {
      const fullSquad = await getSquadWithMembers(squad.id);
      return res.json({ squad: fullSquad, message: 'You are already a member of this squad' });
    }

    // Check member count (3-10 limit from spec)
    const { data: members, error: countError } = await supabase
      .from('squad_members')
      .select('userId')
      .eq('squadId', squad.id);

    if (countError) {
      throw countError;
    }

    if (members.length >= 10) {
      return res.status(400).json({ message: 'Squad is full (max 10 members)' });
    }

    // Add member
    const { error: memberError } = await supabase
      .from('squad_members')
      .insert({
        squadId: squad.id,
        userId: req.userId,
      });

    if (memberError) {
      throw memberError;
    }

    const fullSquad = await getSquadWithMembers(squad.id);

    res.json({ squad: fullSquad });
  } catch (error) {
    console.error('Join squad error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/squads/:id/messages - Get chat messages for a squad
router.get('/:id/messages', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const squadId = parseInt(req.params.id);

    if (isNaN(squadId)) {
      return res.status(400).json({ message: 'Invalid squad ID' });
    }

    // Verify user is a member
    const { data: membership, error: memberError } = await supabase
      .from('squad_members')
      .select('*')
      .eq('squadId', squadId)
      .eq('userId', req.userId)
      .single();

    if (memberError || !membership) {
      return res.status(403).json({ message: 'You are not a member of this squad' });
    }

    // Get last 200 messages
    const { data: messages, error: messagesError } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('squadId', squadId)
      .order('timestamp', { ascending: true })
      .limit(200);

    if (messagesError) {
      throw messagesError;
    }

    // Get unique author addresses
    const authorAddresses = [...new Set(messages.map(m => m.authorAddress).filter(Boolean))];

    // Fetch user data for all authors
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('*')
      .in('polymarketUserAddress', authorAddresses);

    if (usersError) {
      throw usersError;
    }

    // Create user map
    const userMap = new Map(users.map(u => [u.polymarketUserAddress, u]));

    // Format messages
    const formattedMessages = messages.map(msg => {
      const author = msg.authorAddress ? userMap.get(msg.authorAddress) : null;
      return {
        id: msg.id.toString(),
        squadId: squadId.toString(),
        author: author ? {
          polymarketUserAddress: author.polymarketUserAddress,
          username: author.username || 'Anonymous',
          avatarUrl: `https://api.dicebear.com/9.x/pixel-art/svg?seed=${author.polymarketUserAddress}`,
        } : {
          polymarketUserAddress: 'bot',
          username: 'Bot',
          avatarUrl: 'https://api.dicebear.com/9.x/pixel-art/svg?seed=bot',
        },
        content: msg.content,
        isBot: msg.isBot,
        timestamp: msg.timestamp,
      };
    });

    res.json({ messages: formattedMessages });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/squads/:id/leaderboard - Get live PnL leaderboard for squad
router.get('/:id/leaderboard', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const squadId = parseInt(req.params.id);
    const userId = req.userId!;

    if (isNaN(squadId)) {
      return res.status(400).json({ message: 'Invalid squad ID' });
    }

    // Verify user is a member of this squad
    const { data: membership, error: memberError } = await supabase
      .from('squad_members')
      .select('*')
      .eq('squadId', squadId)
      .eq('userId', userId)
      .single();

    if (memberError || !membership) {
      return res.status(403).json({ message: 'You are not a member of this squad' });
    }

    // Check cache first
    const cacheKey = `leaderboard:${squadId}`;
    const cached = pnlCache.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    // Get all squad members
    const { data: memberRows, error: membersError } = await supabase
      .from('squad_members')
      .select('userId')
      .eq('squadId', squadId);

    if (membersError || !memberRows || memberRows.length === 0) {
      return res.json({ leaderboard: [] });
    }

    const userIds = memberRows.map(m => m.userId);

    // Get user details
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('*')
      .in('polymarketUserAddress', userIds);

    if (usersError || !users) {
      return res.status(500).json({ message: 'Failed to fetch users' });
    }

    const POLYMARKET_API_KEY = process.env.POLYMARKET_ADMIN_API_KEY;

    // Fetch PnL for each member (all-time only)
    const leaderboard = await Promise.all(
      users.map(async (user: any) => {
        
        // If no polymarket address, return 0 PnL
        if (!user.polymarketUserAddress) {
          return {
            polymarketUserAddress: user.polymarketUserAddress,
            username: user.username || 'Anonymous',
            avatarUrl: user.avatarUrl || `https://api.dicebear.com/9.x/pixel-art/svg?seed=${user.polymarketUserAddress}`,
            totalLivePnl: 0,
            topPosition: null,
          };
        }

        try {
          // Fetch closed positions, open positions, and value in parallel
          const [closedResponse, openResponse, valueResponse] = await Promise.all([
            fetch(
              `https://data-api.polymarket.com/closed-positions?user=${user.polymarketUserAddress}&limit=50&sortBy=REALIZEDPNL`,
              { headers: { Authorization: `Bearer ${POLYMARKET_API_KEY}` } }
            ),
            fetch(
              `https://data-api.polymarket.com/positions?user=${user.polymarketUserAddress}`,
              { headers: { Authorization: `Bearer ${POLYMARKET_API_KEY}` } }
            ),
            fetch(
              `https://data-api.polymarket.com/value?user=${user.polymarketUserAddress}`,
              { headers: { Authorization: `Bearer ${POLYMARKET_API_KEY}` } }
            ),
          ]);

          if (!closedResponse.ok || !openResponse.ok || !valueResponse.ok) {
            console.error(`Failed to fetch data for ${user.username}: closed=${closedResponse.status}, open=${openResponse.status}, value=${valueResponse.status}`);
            return {
              polymarketUserAddress: user.polymarketUserAddress,
              username: user.username || 'Anonymous',
              avatarUrl: user.avatarUrl || `https://api.dicebear.com/9.x/pixel-art/svg?seed=${user.polymarketUserAddress}`,
              totalLivePnl: 0,
              topPosition: null,
            };
          }

          const closedPositions = await closedResponse.json();
          const openPositions = await openResponse.json();
          const valueData: any = await valueResponse.json();

          // Sum up realizedPnl from all closed positions
          const realizedPnl = Array.isArray(closedPositions)
            ? closedPositions.reduce((sum: number, pos: any) => sum + (pos.realizedPnl || 0), 0)
            : 0;

          // Add unrealized PnL from open positions
          const openPositionsValue = valueData?.value || 0;

          // Total PnL = realized + unrealized
          const totalLivePnl = realizedPnl + openPositionsValue;

          // Find top position (highest cashPnl from open positions)
          let topPosition = null;
          if (Array.isArray(openPositions) && openPositions.length > 0) {
            const sortedPositions = openPositions
              .filter((pos: any) => pos.cashPnl && pos.cashPnl > 0)
              .sort((a: any, b: any) => (b.cashPnl || 0) - (a.cashPnl || 0));
            
            if (sortedPositions.length > 0) {
              const best = sortedPositions[0];
              topPosition = {
                title: best.title || 'Unknown Market',
                cashPnl: parseFloat((best.cashPnl || 0).toFixed(2)),
                outcome: best.outcome || 'Unknown',
                slug: best.slug || '',
              };
            }
          }

          return {
            polymarketUserAddress: user.polymarketUserAddress,
            username: user.username || 'Anonymous',
            avatarUrl: user.avatarUrl || `https://api.dicebear.com/9.x/pixel-art/svg?seed=${user.polymarketUserAddress}`,
            totalLivePnl: parseFloat(totalLivePnl.toFixed(2)),
            topPosition,
          };
        } catch (error) {
          console.error(`Error fetching PnL for ${user.username}:`, error);
          return {
            polymarketUserAddress: user.polymarketUserAddress,
            username: user.username || 'Anonymous',
            avatarUrl: user.avatarUrl || `https://api.dicebear.com/9.x/pixel-art/svg?seed=${user.polymarketUserAddress}`,
            totalLivePnl: 0,
            topPosition: null,
          };
        }
      })
    );

    // Sort by PnL descending
    leaderboard.sort((a, b) => b.totalLivePnl - a.totalLivePnl);

    const result = { leaderboard };

    // Cache for 30 seconds
    pnlCache.set(cacheKey, result);

    res.json(result);
  } catch (error) {
    console.error('Get leaderboard error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
