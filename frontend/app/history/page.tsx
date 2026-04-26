"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Icon } from "@iconify/react";
import { useAuth } from "@/lib/auth";
import { ApiHistoryLog, historyApi } from "@/lib/api";

const PAGE_SIZE = 20;

const formatDateTime = (value: string) => {
    return new Date(value).toLocaleDateString("th-TH", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
};

export default function HistoryPage() {
    const { token, isLoading: authLoading } = useAuth();
    const [logs, setLogs] = useState<ApiHistoryLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isClearing, setIsClearing] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(false);

    const loadHistory = useCallback(async (skip = 0, append = false) => {
        try {
            if (append) {
                setIsLoadingMore(true);
            } else {
                setLoading(true);
            }

            if (!token) {
                setLogs([]);
                setHasMore(false);
                return;
            }

            const data = await historyApi.list(token, skip, PAGE_SIZE);
            setLogs((prev) => (append ? [...prev, ...data] : data));
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
    }, [token]);

    useEffect(() => {
        if (!authLoading) {
            loadHistory(0, false);
        }
    }, [authLoading, loadHistory]);

    const handleLoadMore = async () => {
        if (!token || isLoadingMore || !hasMore) {
            return;
        }

        await loadHistory(logs.length, true);
    };

    const groupedByDay = useMemo(() => {
        return logs.reduce<Record<string, ApiHistoryLog[]>>((acc, item) => {
            const dayKey = new Date(item.viewedAt).toLocaleDateString("th-TH", {
                year: "numeric",
                month: "long",
                day: "numeric",
            });

            if (!acc[dayKey]) {
                acc[dayKey] = [];
            }
            acc[dayKey].push(item);
            return acc;
        }, {});
    }, [logs]);

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
                    {Object.entries(groupedByDay).map(([day, items]) => (
                        <section key={day} className="bg-greay-custom rounded-xl p-3 sm:p-4">
                            <h2 className="text-white font-semibold mb-3">{day}</h2>
                            <div className="space-y-2">
                                {items.map((item) => (
                                    <Link
                                        key={item.id}
                                        href={`/video/${item.videoId}`}
                                        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 rounded-lg px-3 py-2 bg-slate-800 hover:bg-slate-700 transition-colors"
                                    >
                                        <div className="flex items-center gap-3">
                                            <Icon icon="mdi:play-circle-outline" width="20" height="20" className="text-gray-300" />
                                            <span className="text-white text-sm break-all">Video ID: {item.videoId}</span>
                                        </div>
                                        <span className="text-gray-400 text-xs">{formatDateTime(item.viewedAt)}</span>
                                    </Link>
                                ))}
                            </div>
                        </section>
                    ))}

                    <div className="flex justify-center">
                        {hasMore ? (
                            <button
                                onClick={handleLoadMore}
                                disabled={isLoadingMore}
                                className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
                            >
                                {isLoadingMore ? "กำลังโหลด..." : "โหลดเพิ่ม"}
                            </button>
                        ) : (
                            <span className="text-sm text-gray-400">แสดงครบทั้งหมดแล้ว</span>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
