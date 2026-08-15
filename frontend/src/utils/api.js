// Normalize API base URL
const DEFAULT_VERCEL_BACKEND = "https://fitboy-backend.vercel.app";

// Support custom env var VITE_BACKEND_URL or default to Vercel production backend
const REMOTE_BACKEND = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_BACKEND_URL)
    ? import.meta.env.VITE_BACKEND_URL
    : DEFAULT_VERCEL_BACKEND;

export const API_BASE = (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'))
    ? "" // Local dev server uses Vite proxy / Flask local routes
    : REMOTE_BACKEND.replace(/\/+$/, ""); // Production (Firebase Hosting -> Vercel Backend)

export function formatApiUrl(path) {
    if (!path) return '';
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return API_BASE ? `${API_BASE}${cleanPath}` : cleanPath;
}

export function formatCoverUrl(url) {
    if (!url || url === 'None' || url === 'null') return '/placeholder.svg';

    // If it's wrapped in an image proxy parameter, unwrap to direct CDN URL
    if (typeof url === 'string' && url.includes('/api/image_proxy?url=')) {
        const match = url.match(/[?&]url=([^&]+)/);
        if (match) {
            return decodeURIComponent(match[1]).replace('http://', 'https://');
        }
    }

    if (url.startsWith('http://') || url.startsWith('https://')) {
        return url.replace('http://', 'https://');
    }

    if (url.startsWith('/static/')) return formatApiUrl(url);
    if (url.startsWith('/api/')) return formatApiUrl(url);
    return url;
}

export function apiFetch(path, options = {}) {
    return fetch(formatApiUrl(path), options);
}
