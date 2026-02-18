import api from './auth';
import { getApiUrl } from '../config';

const getApiBaseUrl = getApiUrl;

export const getAuctionState = async () => {
  const response = await api.get('/admin/auction-state');
  return response.data;
};

export const updateAuctionStatus = async (status) => {
  const response = await api.post('/admin/auction-status', { status });
  return response.data;
};

export const loadPlayer = async (playerId) => {
  const response = await api.post('/admin/load-player', { playerId });
  return response.data;
};

export const getCurrentBid = async () => {
  const response = await api.get('/admin/current-bid');
  return response.data;
};

export const getAllBids = async () => {
  const response = await api.get('/admin/bids');
  return response.data;
};

export const undoBid = async () => {
  const response = await api.post('/admin/undo-bid');
  return response.data;
};

export const lockBidding = async (locked) => {
  const response = await api.post('/admin/lock-bidding', { locked });
  return response.data;
};

export const updateBidIncrements = async (increment1, increment2) => {
  const response = await api.post('/admin/bid-increments', { increment1, increment2 });
  return response.data;
};

export const markPlayer = async (playerId, status, soldPrice, soldToTeam) => {
  const response = await api.post('/admin/mark-player', { playerId, status, soldPrice, soldToTeam });
  return response.data;
};

export const resetBidding = async () => {
  const response = await api.post('/admin/reset-bidding');
  return response.data;
};

export const getAllPlayers = async () => {
  const response = await api.get('/admin/players');
  return response.data;
};

export const getAuctionHistory = async () => {
  const response = await api.get('/admin/history');
  return response.data;
};

// Bulk add players
export const addPlayersBulk = async (players) => {
  const response = await api.post('/admin/players-bulk', { players });
  return response.data;
};

// Add new player
export const addPlayer = async (playerData) => {
  const response = await api.post('/admin/players', playerData);
  return response.data;
};

export const updatePlayer = async (playerId, playerData) => {
  const response = await api.put(`/admin/players/${playerId}`, playerData);
  return response.data;
};

export const deletePlayer = async (playerId) => {
  const response = await api.delete(`/admin/players/${playerId}`);
  return response.data;
};

export const uploadImage = async (file) => {
  const formData = new FormData();
  formData.append('image', file);

  const API_BASE_URL = getApiBaseUrl();
  const response = await fetch(`${API_BASE_URL}/admin/upload-image`, {
    method: 'POST',
    body: formData,
    credentials: 'include'
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Image upload failed' }));
    throw new Error(errorData.error || 'Image upload failed');
  }

  const data = await response.json();
  // Backend returns full URL
  return data.imageUrl;
};

export const getAllTeams = async () => {
  const response = await api.get('/admin/teams');
  return response.data;
};

export const updateTeamBudget = async (teamId, budget) => {
  const response = await api.put(`/admin/teams/${teamId}/budget`, { budget });
  return response.data;
};

export const getPlayersByStatus = async (status) => {
  const response = await api.get(`/admin/players-by-status/${status}`);
  return response.data;
};

export const addTeam = async (teamData) => {
  try {
    console.log('Adding team with data:', teamData);
    const formData = new FormData();
    formData.append('name', teamData.name || '');
    if (teamData.owner_name && teamData.owner_name.trim()) {
      formData.append('owner_name', teamData.owner_name.trim());
    }
    if (teamData.budget && teamData.budget.toString().trim()) {
      formData.append('budget', teamData.budget.toString().trim());
    }
    if (teamData.logo) {
      formData.append('logo', teamData.logo);
    }

    const API_BASE_URL = getApiBaseUrl();
    const url = `${API_BASE_URL}/admin/teams`;
    console.log('Sending request to:', url);
    console.log('FormData entries:');
    for (let pair of formData.entries()) {
      console.log(pair[0], pair[1]);
    }

    const response = await fetch(url, {
      method: 'POST',
      body: formData,
      credentials: 'include'
    });

    console.log('Response status:', response.status, response.statusText);
    console.log('Response URL:', response.url);

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
        console.error('Error response:', errorData);
      } catch (e) {
        console.error('Failed to parse error response:', e);
        const text = await response.text();
        console.error('Response text:', text);
        errorData = { error: `HTTP ${response.status}: ${response.statusText}` };
      }
      throw new Error(errorData.error || 'Team creation failed');
    }

    const result = await response.json();
    console.log('Team created successfully:', result);
    return result;
  } catch (error) {
    console.error('Error in addTeam:', error);
    throw error;
  }
};

export const updateTeam = async (teamId, teamData) => {
  const formData = new FormData();
  if (teamData.name) formData.append('name', teamData.name);
  if (teamData.owner_name !== undefined) formData.append('owner_name', teamData.owner_name || '');
  if (teamData.budget !== undefined) formData.append('budget', teamData.budget);
  if (teamData.logo) formData.append('logo', teamData.logo);

  const API_BASE_URL = getApiBaseUrl();
  const response = await fetch(`${API_BASE_URL}/admin/teams/${teamId}`, {
    method: 'PUT',
    body: formData,
    credentials: 'include'
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Team update failed' }));
    throw new Error(errorData.error || 'Team update failed');
  }

  return response.json();
};

export const deleteTeam = async (teamId) => {
  const response = await api.delete(`/admin/teams/${teamId}`);
  return response.data;
};

export const getTeamSquads = async () => {
  const response = await api.get('/admin/team-squads');
  return response.data;
};

export const removePlayerFromTeam = async (playerId) => {
  const response = await api.post(`/admin/remove-player-from-team/${playerId}`);
  return response.data;
};

export const resetUnsoldTag = async (playerId) => {
  const response = await api.post(`/admin/reset-unsold-tag/${playerId}`);
  return response.data;
};


export const lockTeamBidding = async (teamId, locked) => {
  const response = await api.put(`/admin/teams/${teamId}/lock-bidding`, { locked });
  return response.data;
};

export const getMaxPlayersPerTeam = async () => {
  try {
    const response = await api.get('/admin/max-players');
    return response.data;
  } catch (error) {
    console.error('Error fetching max players:', error);
    return { maxPlayersPerTeam: 10 }; // Default fallback
  }
};

export const updateMaxPlayersPerTeam = async (maxPlayersPerTeam) => {
  const response = await api.post('/admin/max-players', { maxPlayersPerTeam });
  return response.data;
};

export const updateEnforceMaxBid = async (enforceMaxBid) => {
  const response = await api.post('/admin/enforce-max-bid', { enforceMaxBid });
  return response.data;
};

export const deleteAllPlayers = async () => {
  const response = await api.delete('/admin/players-all');
  return response.data;
};

export const adminPlaceBid = async (teamId, amount) => {
  const response = await api.post('/admin/admin-bid', { teamId, amount });
  return response.data;
};

