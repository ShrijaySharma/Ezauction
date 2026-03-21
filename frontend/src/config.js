export const getApiUrl = () => {
    if (import.meta.env.MODE === 'production') {
        return 'https://ezauction.onrender.com/api';
    }
    return '/api'; // Dev: Vite proxy handles it
};

export const getSocketUrl = () => {
    if (import.meta.env.MODE === 'production') {
        return 'https://ezauction.onrender.com';
    }
    return '/';
};

export const API_URL = getApiUrl();
