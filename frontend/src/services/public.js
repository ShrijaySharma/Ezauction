import { getAuctionApiUrl } from '../config';

export const getPublicPlayers = async () => {
    const res = await fetch(getAuctionApiUrl('/public/players'));
    if (!res.ok) throw new Error('Failed to fetch players');
    return res.json();
};

export const getPublicTeams = async () => {
    const res = await fetch(getAuctionApiUrl('/public/teams'));
    if (!res.ok) throw new Error('Failed to fetch teams');
    return res.json();
};

export const getPublicAuctionState = async () => {
    const res = await fetch(getAuctionApiUrl('/public/auction-state'));
    if (!res.ok) throw new Error('Failed to fetch auction state');
    return res.json();
};

export const getPublicCurrentBid = async () => {
    const res = await fetch(getAuctionApiUrl('/public/current-bid'));
    if (!res.ok) throw new Error('Failed to fetch current bid');
    return res.json();
};

export const getPublicTradingWindowStatus = async () => {
    const res = await fetch(getAuctionApiUrl('/public/trading-window'));
    if (!res.ok) throw new Error('Failed to fetch trading window status');
    return res.json();
};

export const getPublicTeamPurses = async (auctionId = null) => {
    try {
        const res = await fetch(getAuctionApiUrl('/host/team-purses', auctionId));
        if (!res.ok) return [];
        return res.json();
    } catch {
        return [];
    }
};

export const getPublicBroadcastConfig = async () => {
    try {
        const res = await fetch(getAuctionApiUrl('/public/broadcast-config'));
        if (!res.ok) return { theme: 'black_gold', hostDisplayMode: 'main' };
        return res.json();
    } catch {
        return { theme: 'black_gold', hostDisplayMode: 'main' };
    }
};

