import { Router } from 'express';
import { supabase } from '../supabase';
import { authMiddleware, AuthRequest } from '../auth';

const router = Router();

// GET /api/user/me
router.get('/me', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('polymarketUserAddress', req.userId)
      .single();

    if (error || !user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Add avatarUrl
    const userResponse = {
      ...user,
      avatarUrl: `https://api.dicebear.com/9.x/pixel-art/svg?seed=${user.polymarketUserAddress}`,
    };

    res.json({ user: userResponse });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/user/profile
router.post('/profile', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { username, polymarketUserAddress } = req.body;

    // Build update object
    const updates: any = {};
    if (username !== undefined) updates.username = username;
    if (polymarketUserAddress !== undefined) updates.polymarketUserAddress = polymarketUserAddress;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: 'No fields to update' });
    }

    const { data: user, error } = await supabase
      .from('users')
      .update(updates)
      .eq('polymarketUserAddress', req.userId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    // Add avatarUrl
    const userResponse = {
      ...user,
      avatarUrl: `https://api.dicebear.com/9.x/pixel-art/svg?seed=${user.polymarketUserAddress}`,
    };

    res.json({ user: userResponse });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
