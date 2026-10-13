export const getApiUrl = () => {
    // Always use relative path.
    // In dev: Vite proxy handles it -> localhost:4000
    // In prod: Vercel rewrite handles it -> onrender.com
    return '/api';
};

export const getSocketUrl = (auctionId = null) => {
    const aid = auctionId || window.location.pathname.match(/\/auction\/([^/]+)/)?.[1] || null;
    const base = import.meta.env.MODE === 'production'
        ? 'https://ezauction.onrender.com'
        : '';
    if (aid) {
        return `${base}/auction/${aid}`;
    }
    return base || '/';
};

export const API_URL = getApiUrl();
