const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export const api = {
  async login(evmAddress: string) {
    const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ evmAddress }),
    });

    if (!response.ok) {
      throw new Error('Login failed');
    }

    return response.json();
  },

  async getMe(token: string) {
    const response = await fetch(`${API_BASE_URL}/api/user/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch user');
    }

    return response.json();
  },

  async updateProfile(token: string, data: { username?: string; polymarketUserAddress?: string }) {
    const response = await fetch(`${API_BASE_URL}/api/user/profile`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error('Failed to update profile');
    }

    return response.json();
  },

  async getSquads(token: string) {
    const response = await fetch(`${API_BASE_URL}/api/squads`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch squads');
    }

    return response.json();
  },

  async getSquad(token: string, squadId: string) {
    const response = await fetch(`${API_BASE_URL}/api/squads/${squadId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch squad');
    }

    return response.json();
  },

  async createSquad(token: string, name: string) {
    const response = await fetch(`${API_BASE_URL}/api/squads/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ name }),
    });

    if (!response.ok) {
      throw new Error('Failed to create squad');
    }

    return response.json();
  },

  async joinSquad(token: string, inviteCode: string) {
    const response = await fetch(`${API_BASE_URL}/api/squads/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ inviteCode }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to join squad');
    }

    return response.json();
  },

  async getMessages(token: string, squadId: string) {
    const response = await fetch(`${API_BASE_URL}/api/squads/${squadId}/messages`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch messages');
    }

    return response.json();
  },

  async getLeaderboard(token: string, squadId: string) {
    const response = await fetch(`${API_BASE_URL}/api/squads/${squadId}/leaderboard`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch leaderboard');
    }

    return response.json();
  },
};
