import api from './auth';
import { getAuctionApiPath } from '../config';

export const getCurrentInfo = async (auctionId = null) => {
  const url = auctionId ? getAuctionApiPath('/host/current-info', auctionId) : '/host/current-info';
  const response = await api.get(url);
  return response.data;
};

export const getAllBids = async (auctionId = null) => {
  const url = auctionId ? getAuctionApiPath('/host/current-bids', auctionId) : '/host/current-bids';
  const response = await api.get(url);
  return response.data;
};

export const getAllTeams = async (auctionId = null) => {
  const url = auctionId ? getAuctionApiPath('/host/teams', auctionId) : '/host/teams';
  const response = await api.get(url);
  return response.data;
};

export const getUnsoldPlayers = async (auctionId = null) => {
  const url = auctionId ? getAuctionApiPath('/host/unsold-players', auctionId) : '/host/unsold-players';
  const response = await api.get(url);
  return response.data;
};

export const getTeamPurses = async (auctionId = null) => {
  const url = auctionId ? getAuctionApiPath('/host/team-purses', auctionId) : '/host/team-purses';
  const response = await api.get(url);
  return response.data;
};


