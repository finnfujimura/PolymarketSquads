import { Router } from 'express';
import { supabase } from '../supabase';
import { generateToken } from '../auth';

const router = Router();

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { evmAddress } = req.body;

    if (!evmAddress || typeof evmAddress !== 'string') {
      return res.status(400).json({ message: 'evmAddress is required' });
    }

    // Normalize address to lowercase
    const normalizedAddress = evmAddress.toLowerCase();

    // Check if user exists
    const { data: existingUser, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('evmAddress', normalizedAddress)
      .single();

    let user;

    if (fetchError && fetchError.code !== 'PGRST116') {
      // PGRST116 = not found, which is expected for new users
      throw fetchError;
    }

    if (existingUser) {
      user = existingUser;
    } else {
      // Create new user with default username and Dicebear avatar
      const defaultUsername = `user_${normalizedAddress.slice(2, 8)}`;
      const avatarUrl = `https://api.dicebear.com/9.x/pixel-art/svg?seed=${normalizedAddress}`;

      const { data: newUser, error: insertError } = await supabase
        .from('users')
        .insert({
          evmAddress: normalizedAddress,
          username: defaultUsername,
          polymarketUserAddress: null,
        })
        .select()
        .single();

      if (insertError) {
        throw insertError;
      }

      user = newUser;
    }

    // Generate JWT
    const token = generateToken(normalizedAddress);

    // Add avatarUrl to response (not stored in DB, generated on-the-fly)
    const userResponse = {
      ...user,
      avatarUrl: `https://api.dicebear.com/9.x/pixel-art/svg?seed=${normalizedAddress}`,
    };

    res.json({ token, user: userResponse });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
