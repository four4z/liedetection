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

export interface ApiVideoSegment {
    timestamp: string;
    face_confidence_score: number;
    face_verdict: "TRUTH" | "LIE";
    arms_confidence_score: number;
    arms_verdict: "TRUTH" | "LIE";
    average_confidence_score_segment: number;
    verdict: "TRUTH" | "LIE";
    parts_indicate: "arms" | "face";
    average_based_verdict: "TRUTH" | "LIE";
    face_image_b64: string;
}

export interface ApiVideoSummary {
    average_confidence_score: number;
    final_verdict: "LIE" | "TRUTH";
    total_segments_analyzed: number;
}

export interface ApiVideo {
    id?: string;
    user_id: string | null;
    video: string;
    video_url: string;
    thumbnail_url: string | null;
    uploaded_at: string;
    video_duration: string | null;
    segments: ApiVideoSegment[];
    summary: ApiVideoSummary | null;
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
    faceConfidenceScore?: number;
    faceVerdict?: "TRUTH" | "LIE";
    armsConfidenceScore?: number;
    armsVerdict?: "TRUTH" | "LIE";
    averageConfidenceScoreSegment?: number;
    averageBasedVerdict?: "TRUTH" | "LIE";
}

const normalizeConfidence = (score: number | null | undefined) => {
    if (typeof score !== "number" || !Number.isFinite(score)) {
        return 0;
    }

    if (score > 1) {
        return Math.max(0, Math.min(1, score / 100));
    }

    return Math.max(0, Math.min(1, score));
};

const parseTimestampToSeconds = (timestamp: string) => {
    const head = timestamp.split("-")[0]?.trim() || timestamp.trim();

    if (!head) {
        return 0;
    }

    if (head.includes(":")) {
        const parts = head.split(":").map((part) => Number(part.trim()));

        if (parts.every((part) => Number.isFinite(part))) {
            if (parts.length === 3) {
                return parts[0] * 3600 + parts[1] * 60 + parts[2];
            }

            if (parts.length === 2) {
                return parts[0] * 60 + parts[1];
            }
        }
    }

    const numeric = Number(head);
    if (Number.isFinite(numeric)) {
        return numeric;
    }

    const parsed = Number.parseFloat(head);
    return Number.isFinite(parsed) ? parsed : 0;
};

export const formatConfidencePercent = (score: number | null | undefined) => {
    const normalized = normalizeConfidence(score);
    return `${(normalized * 100).toFixed(1)}%`;
};

export const getVideoTitle = (video: ApiVideo) => video.video || "Untitled video";

export const getVideoThumbnail = (video: ApiVideo) => video.thumbnail_url || null;

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
    if (!video.segments || video.segments.length === 0) {
        return [];
    }

    return video.segments.map((segment, index) => ({
        id: `segment-${index + 1}`,
        timestamp: parseTimestampToSeconds(segment.timestamp),
        confidence: normalizeConfidence(segment.average_confidence_score_segment),
        label: segment.verdict,
        partsIndicate: segment.parts_indicate,
        thumbnail: segment.face_image_b64
            ? `data:image/jpeg;base64,${segment.face_image_b64}`
            : video.thumbnail_url || undefined,
        faceConfidenceScore: segment.face_confidence_score,
        faceVerdict: segment.face_verdict,
        armsConfidenceScore: segment.arms_confidence_score,
        armsVerdict: segment.arms_verdict,
        averageConfidenceScoreSegment: segment.average_confidence_score_segment,
        averageBasedVerdict: segment.average_based_verdict,
    }));
};
