import express from 'express';
import dotenv from 'dotenv';
import { supabase } from './supabase';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());

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

app.listen(PORT, () => {
  console.log(`🚀 Backend server running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
});
