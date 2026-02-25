import api from './auth';

export const getCurrentInfo = async () => {
  const response = await api.get('/host/current-info');
  return response.data;
};

export const getAllBids = async () => {
  const response = await api.get('/host/bids');
  return response.data;
};

export const getAllTeams = async () => {
  const response = await api.get('/host/teams');
  return response.data;
};

export const getUnsoldPlayers = async () => {
  const response = await api.get('/host/unsold-players');
  return response.data;
};

