"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Icon } from "@iconify/react";
import { useAuth } from "@/lib/auth";
import { ApiHistoryLog, ApiVideo, historyApi, videosApi } from "@/lib/api";
import VideoList from "../../component/VideoList";

const PAGE_SIZE = 20;

export default function HistoryPage() {
    const { token, isLoading: authLoading } = useAuth();
    const [logs, setLogs] = useState<ApiHistoryLog[]>([]);
    const [historyVideos, setHistoryVideos] = useState<ApiVideo[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isClearing, setIsClearing] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(false);

    const mapLogsToVideos = useCallback(async (items: ApiHistoryLog[]) => {
        if (!token) {
            setHistoryVideos([]);
            return;
        }

        const allVideos = await videosApi.listMine(token, 0, 200);
        const videoById = new Map(allVideos.map((video) => [video.id, video]));

        const firstSeenViewedAt = new Map<string, string>();
        for (const item of items) {
            if (!firstSeenViewedAt.has(item.videoId)) {
                firstSeenViewedAt.set(item.videoId, item.viewedAt);
            }
        }

        const mapped = Array.from(firstSeenViewedAt.entries())
            .map(([videoId, viewedAt]) => {
                const video = videoById.get(videoId);
                if (!video) {
                    return null;
                }

                return {
                    ...video,
                    // Keep card layout identical to list page while showing last viewed time in subtitle.
                    uploaded_at: viewedAt,
                } as ApiVideo;
            })
            .filter((video): video is ApiVideo => video !== null);

        setHistoryVideos(mapped);
    }, [token]);

    const loadHistory = useCallback(async (skip = 0, append = false) => {
        try {
            if (append) {
                setIsLoadingMore(true);
            } else {
                setLoading(true);
            }

            if (!token) {
                setLogs([]);
                setHistoryVideos([]);
                setHasMore(false);
                return;
            }

            const data = await historyApi.list(token, skip, PAGE_SIZE);

            if (append) {
                setLogs((prev) => {
                    const nextLogs = [...prev, ...data];
                    void mapLogsToVideos(nextLogs);
                    return nextLogs;
                });
            } else {
                setLogs(data);
                await mapLogsToVideos(data);
            }

            setHasMore(data.length === PAGE_SIZE);
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load history");
        } finally {
            if (append) {
                setIsLoadingMore(false);
            } else {
                setLoading(false);
            }
        }
    }, [token, mapLogsToVideos]);

    useEffect(() => {
        if (!authLoading && token) {
            loadHistory(0, false);
        }
    }, [authLoading, token]);

    const handleLoadMore = async () => {
        if (!token || isLoadingMore || !hasMore) {
            return;
        }

        await loadHistory(logs.length, true);
    };

    const handleClear = async () => {
        if (!token) {
            return;
        }

        if (!window.confirm("ยืนยันการล้างประวัติทั้งหมด?")) {
            return;
        }

        try {
            setIsClearing(true);
            await historyApi.clear(token);
            await loadHistory(0, false);
        } catch (err) {
            alert(err instanceof Error ? err.message : "Failed to clear history");
        } finally {
            setIsClearing(false);
        }
    };

    return (
        <div className="p-3 sm:p-4 md:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4 ">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-white">History</h1>
                    <p className="text-gray-400 text-sm">ประวัติการเปิดวิดีโอของบัญชีนี้</p>
                </div>
                <button
                    onClick={handleClear}
                    disabled={!token || logs.length === 0 || isClearing}
                    className="w-full sm:w-auto px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
                >
                    <Icon icon="mdi:trash" width="24" height="24" />
                </button>
            </div>

            {loading && (
                <div className="flex justify-center items-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
                    <span className="ml-2 text-white">กำลังโหลด...</span>
                </div>
            )}

            {!loading && error && (
                <div className="text-center py-12">
                    <Icon icon="mdi:alert-circle" width="44" height="44" className="mx-auto text-red-400 mb-2" />
                    <p className="text-white">เกิดข้อผิดพลาด: {error}</p>
                    <button
                        onClick={() => loadHistory(0, false)}
                        className="mt-4 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                    >
                        ลองใหม่
                    </button>
                </div>
            )}

            {!loading && !error && !token && (
                <div className="text-center py-12">
                    <Icon icon="mdi:account-lock" width="44" height="44" className="mx-auto text-gray-400 mb-2" />
                    <p className="text-white mb-2">ต้องเข้าสู่ระบบก่อน</p>
                    <Link href="/Login" className="text-blue-400 hover:underline">ไปหน้าเข้าสู่ระบบ</Link>
                </div>
            )}

            {!loading && !error && token && logs.length === 0 && (
                <div className="text-center py-12">
                    <Icon icon="mdi:history" width="44" height="44" className="mx-auto text-gray-400 mb-2" />
                    <p className="text-white">ยังไม่มีประวัติการดูวิดีโอ</p>
                </div>
            )}

            {!loading && !error && token && logs.length > 0 && (
                <div className="space-y-6">
                    <div className="rounded-xl p-3 sm:p-4 ">
                        <VideoList
                            videos={historyVideos}
                            variant="stack"
                            compact
                            showSearch={false}
                            hasMore={hasMore}
                            isLoadingMore={isLoadingMore}
                            onLoadMore={handleLoadMore}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}