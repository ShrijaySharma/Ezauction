export const getApiUrl = () => {
    if (import.meta.env.VITE_API_URL) {
        return import.meta.env.VITE_API_URL;
    }
    const host = window.location.hostname;
    // If running on localhost, assume backend is on port 4000
    // If running in production (not localhost), this fallback might be wrong if not set, 
    // but better to default to same host relative path or just fail?
    // Use a safer default for non-localhost if needed, but for now keeps existing logic
    // just centralized.
    return `http://${host}:4000/api`;
};

export const API_URL = getApiUrl();
