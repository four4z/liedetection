const TOKEN_KEY = "token";

const canUseStorage = (): boolean => typeof window !== "undefined";

export const getToken = (): string | null => {
    if (!canUseStorage()) return null;
    return localStorage.getItem(TOKEN_KEY);
};

export const setToken = (token: string): void => {
    if (!canUseStorage()) return;
    localStorage.setItem(TOKEN_KEY, token);
};

export const clearToken = (): void => {
    if (!canUseStorage()) return;
    localStorage.removeItem(TOKEN_KEY);
};

export const getBearerToken = (): string | null => {
    const token = getToken();
    return token ? `Bearer ${token}` : null;
};
