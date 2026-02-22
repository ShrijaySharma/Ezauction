export const getApiUrl = () => {
    // Always use relative path. 
    // In dev: Vite proxy handles it -> localhost:4000
    // In prod: Vercel rewrite handles it -> onrender.com
    return '/api';
};

export const getSocketUrl = () => {
    if (import.meta.env.MODE === 'production') {
        return 'https://ezauction.onrender.com';
    }
    return '/';
};

export const API_URL = getApiUrl();
