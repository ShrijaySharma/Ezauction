export const getApiUrl = () => {
    // Always use relative path.
    // In dev: Vite proxy handles it -> localhost:4000
    // In prod: Vercel rewrite handles it -> onrender.com
    return '/api';
};

// The auction slug is the tenant boundary for every non-super-admin API call.
// Keeping this in one place prevents pages from accidentally falling back to
// legacy /api/* endpoints, which return unscoped data.
export const getCurrentAuctionId = () => {
    const match = window.location.pathname.match(/\/auction\/([^/]+)/);
    return match?.[1] || window.__currentAuctionId || localStorage.getItem('currentAuctionId') || null;
};

export const getAuctionApiPath = (path) => {
    const auctionId = getCurrentAuctionId();
    if (!auctionId || path.startsWith('/auction/') || path.startsWith('/super-admin/')) {
        return path;
    }
    return `/auction/${encodeURIComponent(auctionId)}${path}`;
};

export const getAuctionApiUrl = (path) => `${getApiUrl()}${getAuctionApiPath(path)}`;

export const getSocketUrl = (auctionId = null) => {
    const aid = auctionId || getCurrentAuctionId();
    const base = import.meta.env.MODE === 'production'
        ? 'https://ezauction.onrender.com'
        : '';
    if (aid) {
        return `${base}/auction/${aid}`;
    }
    return base || '/';
};

export const API_URL = getApiUrl();
