import { getBearerToken, getToken } from "./token";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export const authFetch = async (
    input: RequestInfo | URL,
    init: RequestInit = {}
): Promise<Response> => {
    const bearerToken = getBearerToken();
    const headers = new Headers(init.headers ?? {});

    if (bearerToken) {
        headers.set("Authorization", bearerToken);
    }

    return fetch(input, {
        ...init,
        headers,
    });
};

export const checkTokenValid = async (): Promise<boolean> => {
    if (!getToken()) return false;

    try {
        const res = await authFetch(`${API_BASE_URL}/api/auth/me`);
        return res.ok;
    } catch {
        return false;
    }
};
