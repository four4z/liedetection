export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface ApiTokenResponse {
    access_token: string;
    token_type: string;
}

export interface ApiUser {
    id: string;
    username: string;
    email: string;
    authProvider: string;
    avatarUrl?: string | null;
    createdAt: string;
}

export interface ApiVideoAnalysisResult {
    isLieDetected: boolean | null;
    confidenceScore: number | null;
    status: "pending" | "processing" | "completed" | "failed";
    analyzedAt?: string | null;
}

export interface ApiVideo {
    id: string;
    userId?: string | null;
    videoUrl: string;
    title?: string | null;
    durationSeconds?: number | null;
    uploadedAt: string;
    isAnonymous: boolean;
    isClaimed: boolean;
    analysisResult?: ApiVideoAnalysisResult | null;
}

export interface ApiVideoUploadResponse {
    id: string;
    videoUrl: string;
    title: string;
    uploadedAt: string;
    isAnonymous: boolean;
    sessionToken?: string | null;
}

export interface ApiHistoryLog {
    id: string;
    userId: string;
    videoId: string;
    viewedAt: string;
}

export interface TimeWarpPoint {
    id: string;
    timestamp: number;
    confidence: number;
    label: string;
    partsIndicate?: "arms" | "face";
    thumbnail?: string;
}

interface RequestOptions {
    method?: "GET" | "POST" | "DELETE" | "PATCH" | "PUT";
    token?: string | null;
    body?: unknown;
}

const toErrorMessage = (detail: unknown, fallback: string) => {
    if (typeof detail === "string" && detail.trim()) {
        return detail;
    }

    if (Array.isArray(detail)) {
        const messages = detail
            .map((item) => {
                if (typeof item === "string") {
                    return item;
                }

                if (item && typeof item === "object") {
                    const msg = (item as { msg?: unknown }).msg;
                    if (typeof msg === "string" && msg.trim()) {
                        return msg;
                    }
                }

                return "";
            })
            .filter(Boolean)
            .join(", ");

        if (messages) {
            return messages;
        }
    }

    if (detail && typeof detail === "object") {
        const msg = (detail as { message?: unknown }).message;
        if (typeof msg === "string" && msg.trim()) {
            return msg;
        }
    }

    return fallback;
};

const apiRequest = async <T>(path: string, options: RequestOptions = {}): Promise<T> => {
    const headers: HeadersInit = {
        "Content-Type": "application/json",
    };

    if (options.token) {
        headers.Authorization = `Bearer ${options.token}`;
    }

    const response = await fetch(`${API_BASE_URL}${path}`, {
        method: options.method || "GET",
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
    });

    const contentType = response.headers.get("content-type") || "";
    const payload = contentType.includes("application/json")
        ? await response.json()
        : null;

    if (!response.ok) {
        const detail = payload && typeof payload === "object" ? (payload as { detail?: unknown }).detail : null;
        throw new Error(toErrorMessage(detail, `Request failed (${response.status})`));
    }

    return payload as T;
};

export const authApi = {
    login: (email: string, password: string) =>
        apiRequest<ApiTokenResponse>("/api/auth/login", {
            method: "POST",
            body: { email, password },
        }),

    register: (email: string, username: string, password: string) =>
        apiRequest<ApiTokenResponse>("/api/auth/register", {
            method: "POST",
            body: { email, username, password },
        }),

    me: (token: string) =>
        apiRequest<ApiUser>("/api/auth/me", {
            token,
        }),
};

export const videosApi = {
    listMine: (token: string, skip = 0, limit = 20) =>
        apiRequest<ApiVideo[]>(`/api/videos/?skip=${skip}&limit=${limit}`, {
            token,
        }),

    getById: (videoId: string, token?: string | null) =>
        apiRequest<ApiVideo>(`/api/videos/${videoId}`, {
            token,
        }),

    uploadLink: (videoUrl: string, title?: string, token?: string | null) =>
        apiRequest<ApiVideoUploadResponse>("/api/videos/upload", {
            method: "POST",
            token,
            body: { videoUrl, title },
        }),

    triggerAnalysis: (videoId: string) =>
        apiRequest<{ message: string; videoId: string; status: string }>(`/api/videos/${videoId}/analyze`, {
            method: "POST",
        }),

    claimAnonymous: (token: string, sessionToken: string) =>
        apiRequest<{ message: string; claimedCount: number }>(
            `/api/videos/claim?session_token=${encodeURIComponent(sessionToken)}`,
            {
                method: "POST",
                token,
            }
        ),
};

export const historyApi = {
    list: (token: string, skip = 0, limit = 50) =>
        apiRequest<ApiHistoryLog[]>(`/api/history/?skip=${skip}&limit=${limit}`, {
            token,
        }),

    clear: (token: string) =>
        apiRequest<{ message: string }>("/api/history/clear", {
            method: "DELETE",
            token,
        }),
};

export const buildTimeWarpPoints = (video: ApiVideo): TimeWarpPoint[] => {
    const result = video.analysisResult;

    if (!result || result.status !== "completed" || result.confidenceScore === null || result.confidenceScore === undefined) {
        return [];
    }

    const duration = typeof video.durationSeconds === "number" && Number.isFinite(video.durationSeconds)
        ? Math.max(video.durationSeconds, 1)
        : 1;

    return [
        {
            id: `analysis-${video.id}`,
            timestamp: Math.max(0, duration / 2),
            confidence: Math.max(0, Math.min(1, result.confidenceScore / 100)),
            label: result.isLieDetected ? "Lie" : "Truth",
        },
    ];
};
