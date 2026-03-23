import { getApiUrl } from '../config';

const API_URL = getApiUrl();

export const getPublicPlayers = async () => {
    const res = await fetch(`${API_URL}/public/players`);
    if (!res.ok) throw new Error('Failed to fetch players');
    return res.json();
};

export const getPublicTeams = async () => {
    const res = await fetch(`${API_URL}/public/teams`);
    if (!res.ok) throw new Error('Failed to fetch teams');
    return res.json();
};

export const getPublicAuctionState = async () => {
    const res = await fetch(`${API_URL}/public/auction-state`);
    if (!res.ok) throw new Error('Failed to fetch auction state');
    return res.json();
};

export const getPublicCurrentBid = async () => {
    const res = await fetch(`${API_URL}/public/current-bid`);
    if (!res.ok) throw new Error('Failed to fetch current bid');
    return res.json();
};
