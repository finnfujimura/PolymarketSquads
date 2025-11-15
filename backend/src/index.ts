import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import { supabase } from './supabase';
import authRoutes from './routes/auth';
import userRoutes from './routes/user';
import squadsRoutes from './routes/squads';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
});

const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_in_production';

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/squads', squadsRoutes);

// Test endpoint to verify Supabase connection
app.get('/api/health', async (req, res) => {
  try {
    // Test query to verify Supabase connection
    const { data, error } = await supabase.from('users').select('*').limit(1);
    
    if (error) {
      return res.status(500).json({ 
        status: 'error', 
        message: 'Supabase connection failed',
        error: error.message 
      });
    }
    
    res.json({ 
      status: 'ok', 
      message: 'Backend is running and Supabase is connected',
      supabaseConnected: true
    });
  } catch (err) {
    res.status(500).json({ 
      status: 'error', 
      message: 'Server error',
      error: err instanceof Error ? err.message : 'Unknown error'
    });
  }
});

// Socket.IO Authentication Middleware
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;

    if (!token) {
      return next(new Error('Authentication error: Missing token'));
    }

    const decoded = jwt.verify(token, JWT_SECRET) as { evmAddress: string };
    socket.data.userId = decoded.evmAddress;
    next();
  } catch (error) {
    next(new Error('Authentication error: Invalid token'));
  }
});

// Socket.IO Connection Handler
io.on('connection', (socket) => {
  const userId = socket.data.userId;
  console.log(`✅ User connected: ${userId}`);

  // Handle joining squad rooms
  socket.on('join:squad', async (squadId: string) => {
    try {
      // Verify user is a member of this squad
      const { data: membership, error } = await supabase
        .from('squad_members')
        .select('*')
        .eq('squadId', parseInt(squadId))
        .eq('userId', userId)
        .single();

      if (error || !membership) {
        socket.emit('error', { message: 'You are not a member of this squad' });
        return;
      }

      socket.join(`squad:${squadId}`);
      console.log(`📥 User ${userId} joined squad ${squadId}`);
    } catch (error) {
      console.error('Join squad error:', error);
      socket.emit('error', { message: 'Failed to join squad room' });
    }
  });

  // Handle chat messages
  socket.on('chat:send', async (data: { squadId: string; content: string }) => {
    try {
      const { squadId, content } = data;

      if (!squadId || !content || typeof content !== 'string') {
        socket.emit('error', { message: 'Invalid message data' });
        return;
      }

      // Verify user is a member of this squad
      const { data: membership, error: memberError } = await supabase
        .from('squad_members')
        .select('*')
        .eq('squadId', parseInt(squadId))
        .eq('userId', userId)
        .single();

      if (memberError || !membership) {
        socket.emit('error', { message: 'You are not a member of this squad' });
        return;
      }

      // Get user info
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('evmAddress', userId)
        .single();

      if (userError || !user) {
        socket.emit('error', { message: 'User not found' });
        return;
      }

      // Save message to database
      const { data: message, error: saveError } = await supabase
        .from('chat_messages')
        .insert({
          squadId: parseInt(squadId),
          authorAddress: userId,
          content: content.trim(),
          isBot: false,
        })
        .select()
        .single();

      if (saveError || !message) {
        socket.emit('error', { message: 'Failed to save message' });
        return;
      }

      // Call retention function (non-blocking)
      supabase.rpc('delete_old_messages', { squad_id: parseInt(squadId) })
        .then(() => console.log(`🗑️  Retention check for squad ${squadId}`))
        .catch((err) => console.error('Retention error:', err));

      // Broadcast message to squad room
      const chatMessage = {
        id: message.id.toString(),
        squadId: squadId,
        author: {
          evmAddress: user.evmAddress,
          username: user.username || 'Anonymous',
          avatarUrl: `https://api.dicebear.com/9.x/pixel-art/svg?seed=${user.evmAddress}`,
        },
        content: message.content,
        isBot: false,
        timestamp: message.timestamp,
      };

      io.to(`squad:${squadId}`).emit('chat:receive', chatMessage);
      console.log(`💬 Message sent in squad ${squadId} by ${user.username}`);
    } catch (error) {
      console.error('Chat send error:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  socket.on('disconnect', () => {
    console.log(`❌ User disconnected: ${userId}`);
  });
});

httpServer.listen(PORT, () => {
  console.log(`🚀 Backend server running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  console.log(`💬 Socket.IO ready for chat`);
});
