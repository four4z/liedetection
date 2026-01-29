const API_URL = 'http://localhost:8000/api';

// Helper to get auth header
const getAuthHeader = () => {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
};

// Generic fetch wrapper
async function fetchAPI(endpoint, options = {}) {
    const response = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...getAuthHeader(),
            ...options.headers,
        },
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'An error occurred' }));
        throw new Error(error.detail || 'Request failed');
    }

    return response.json();
}

// Auth Service
export const authService = {
    register: (username, email, password) =>
        fetchAPI('/auth/register', {
            method: 'POST',
            body: JSON.stringify({ username, email, password }),
        }),

    login: (email, password) =>
        fetchAPI('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
        }),

    googleAuth: (credential) =>
        fetchAPI('/auth/google', {
            method: 'POST',
            body: JSON.stringify({ credential }),
        }),

    getMe: () => fetchAPI('/auth/me'),
};

// Video Service
export const videoService = {
    upload: async (file) => {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(`${API_URL}/videos/upload`, {
            method: 'POST',
            headers: getAuthHeader(),
            body: formData,
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ detail: 'Upload failed' }));
            throw new Error(error.detail);
        }

        return response.json();
    },

    getVideo: (videoId) => fetchAPI(`/videos/${videoId}`),

    analyze: (videoId) =>
        fetchAPI(`/videos/${videoId}/analyze`, { method: 'POST' }),

    getUserVideos: (skip = 0, limit = 20) =>
        fetchAPI(`/videos/?skip=${skip}&limit=${limit}`),

    claimVideos: (sessionToken) =>
        fetchAPI('/videos/claim', {
            method: 'POST',
            body: JSON.stringify({ session_token: sessionToken }),
        }),

    getStreamUrl: (videoId) => `${API_URL}/videos/${videoId}/stream`,
};

// History Service
export const historyService = {
    getHistory: (skip = 0, limit = 50) =>
        fetchAPI(`/history/?skip=${skip}&limit=${limit}`),

    clearHistory: () =>
        fetchAPI('/history/clear', { method: 'DELETE' }),
};
