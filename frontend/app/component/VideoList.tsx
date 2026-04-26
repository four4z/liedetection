"use client";
import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import { useAuth } from "@/lib/auth";
import { ApiVideo, getVideoThumbnail, getVideoTitle, videosApi } from "@/lib/api";

interface VideoListProps {
    videos?: ApiVideo[];
    onVideoClick?: (videoId: string) => void;
}

export default function VideoList({ videos: propVideos, onVideoClick }: VideoListProps) {
    const [videos, setVideos] = useState<ApiVideo[]>(propVideos || []);
    const [loading, setLoading] = useState(!propVideos);
    const [error, setError] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [searchTerm, setSearchTerm] = useState('');
    const itemsPerPage = 6;
    const router = useRouter();
    const { token, isLoading: authLoading } = useAuth();

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
        setCurrentPage(1); // Reset to first page when searching
    };

    const filteredVideos = videos.filter(video =>
        getVideoTitle(video).toLowerCase().includes(searchTerm.toLowerCase())
    );

    const fetchVideos = useCallback(async () => {
        try {
            setLoading(true);
            if (!token) {
                setVideos([]);
                return;
            }

            const data = await videosApi.listMine(token);
            setVideos(data);
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
        } finally {
            setLoading(false);
        }
    }, [token]);

    useEffect(() => {
        if (!authLoading && !propVideos) {
            fetchVideos();
        }
    }, [propVideos, authLoading, fetchVideos]);

    const handleVideoClick = (videoId: string) => {
        if (onVideoClick) {
            onVideoClick(videoId);
        } else {
            router.push(`/video/${videoId}`);
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('th-TH', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                <span className="ml-2 text-white">กำลังโหลด...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-center py-12">
                <div className="text-red-400 mb-4">
                    <Icon icon="mdi:alert-circle" width="48" height="48" />
                </div>
                <p className="text-white">เกิดข้อผิดพลาด: {error}</p>
                <button
                    onClick={fetchVideos}
                    className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                    ลองใหม่
                </button>
            </div>
        );
    }

    if (videos.length === 0) {
        return (
            <div className="text-center py-12">
                <div className="text-gray-400 mb-4">
                    <Icon icon="mdi:video-off" width="48" height="48" />
                </div>
                <p className="text-white text-lg">ยังไม่มีวิดีโอ</p>
                <p className="text-gray-400">{token ? 'อัปโหลดวิดีโอเพื่อเริ่มการวิเคราะห์' : 'กรุณาเข้าสู่ระบบเพื่อดูรายการวิดีโอของคุณ'}</p>
            </div>
        );
    }

    if (filteredVideos.length === 0 && searchTerm) {
        return (
            <div className="space-y-4">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl sm:text-2xl font-bold text-white">รายการวิดีโอ</h2>
                </div>
                <div>
                    <input
                        type="text"
                        placeholder="ค้นหาวิดีโอ..."
                        value={searchTerm}
                        onChange={handleSearch}
                        className="w-full p-2 text-white rounded-md border border-greay-custom focus:outline-none focus:ring-2 focus:ring-gray-700" />
                </div>
                <div className="text-center py-12">
                    <div className="text-gray-400 mb-4">
                        <Icon icon="mdi:magnify" width="48" height="48" />
                    </div>
                    <p className="text-white text-lg">ไม่พบวิดีโอที่ค้นหา</p>
                    <p className="text-gray-400">ลองค้นหาด้วยคำอื่น</p>
                </div>
            </div>
        );
    }

    // pagination calculations
    const totalPages = Math.ceil(filteredVideos.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginatedVideos = filteredVideos.slice(startIndex, startIndex + itemsPerPage);

    const changePage = (page: number) => {
        if (page < 1 || page > totalPages) return;
        setCurrentPage(page);
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl sm:text-2xl font-bold text-white">รายการวิดีโอ</h2>

            </div>
            <div>
                <input
                    type="text"
                    placeholder="ค้นหาวิดีโอ..."
                    value={searchTerm}
                    onChange={handleSearch}
                    className="w-full p-2 text-white rounded-md border border-greay-custom focus:outline-none focus:ring-2 focus:ring-gray-700" />
            </div>
            <div className="flex justify-end items-center">
                {/* pagination navigation */}

                <div className="flex flex-wrap justify-end items-center mt-4 sm:mt-6 gap-2">
                    <button
                        onClick={() => changePage(currentPage - 1)}
                        disabled={currentPage === 1}
                        className="px-2 sm:px-3 py-1 text-white rounded border border-greay-custom disabled:opacity-50"
                    >
                        <Icon icon="ooui:next-rtl" width="20" height="20" />
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                        <button
                            key={page}
                            onClick={() => changePage(page)}
                            className={`min-w-8 px-2 sm:px-3 py-1 rounded text-sm ${page === currentPage ? 'bg-gray-700 text-white' : 'bg-greay-custom text-white hover:bg-gray-600'}`}
                        >{page}</button>
                    ))}
                    <button
                        onClick={() => changePage(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        className="px-2 sm:px-3 py-1 text-white rounded border border-greay-custom disabled:opacity-50"
                    >
                        <Icon icon="ooui:next-ltr" width="20" height="20" />
                    </button>
                </div>

                {/* <span className="flex  justify-end text-gray-400 text-sm text-end pt-3">ทั้งหมด {videos.length} รายการ</span> */}
            </div>

            <div className="grid gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-3">
                {paginatedVideos.map((video) => (
                    <div
                        key={video.id || video.video_url}
                        onClick={() => handleVideoClick(video.id || video.video_url)}
                        className=""
                    >
                        <div className="group relative rounded-lg p-2 sm:p-4 cursor-pointer">

                            {/* Background effect */}
                            <div className="absolute inset-0 
                                bg-slate-700 rounded-2xl
                                opacity-0 group-hover:opacity-100
                                scale-95 group-hover:scale-100
                                origin-center
                                transition-all duration-500 ease-in-out" />

                            {/* Content */}
                            <div className="relative z-10">
                                <div className="relative w-full aspect-video rounded-md overflow-hidden">
                                    {getVideoThumbnail(video) ? (
                                        <img
                                            src={getVideoThumbnail(video) || ""}
                                            alt={getVideoTitle(video)}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <video
                                            src={video.video_url}
                                            className="w-full h-full object-cover"
                                            muted
                                            playsInline
                                            preload="metadata"
                                        />
                                    )}

                                </div>

                                <div className="w-full pt-3">
                                    <h3 className="text-white font-medium truncate text-sm mb-1">
                                        {getVideoTitle(video)}
                                    </h3>
                                    <p className="text-gray-400 text-xs">
                                        {formatDate(video.uploaded_at)}
                                    </p>
                                </div>

                            </div>
                        </div>

                    </div>
                ))}

            </div>



        </div>
    );
}
