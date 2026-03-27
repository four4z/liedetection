"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import { authFetch } from "../tokens/authFetch";
import Image from "next/image";

interface VideoItem {
    id: string;
    originalFilename: string;
    fileSize: number;
    uploadedAt: string;
    status?: string;
    videoPath?: string;
}

interface AnalysisResult {
    isLieDetected: boolean;
    confidenceScore: number;
    status: string;
    analyzedAt?: string;
}

interface VideoListProps {
    videos?: VideoItem[];
    onVideoClick?: (videoId: string) => void;
}

export default function VideoList({ videos: propVideos, onVideoClick }: VideoListProps) {
    const [videos, setVideos] = useState<VideoItem[]>(propVideos || []);
    const [loading, setLoading] = useState(!propVideos);
    const [error, setError] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [searchTerm, setSearchTerm] = useState('');
    const itemsPerPage = 6;
    const router = useRouter();

    useEffect(() => {
        if (!propVideos) {
            fetchVideos();
        }
    }, [propVideos]);

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
        setCurrentPage(1); // Reset to first page when searching
    };

    const filteredVideos = videos.filter(video =>
        video.originalFilename.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const fetchVideos = async () => {
        try {
            setLoading(true);
            const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
            
            const response = await authFetch(`${API_BASE_URL}/api/videos`);

            if (!response.ok) {
                throw new Error('Failed to fetch videos');
            }

            const data = await response.json();
            setVideos(data);
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
        } finally {
            setLoading(false);
        }
    };

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

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'completed':
                return 'text-green-400';
            case 'processing':
                return 'text-yellow-400';
            case 'failed':
                return 'text-red-400';
            default:
                return 'text-gray-400';
        }
    };

    const getStatusText = (status: string) => {
        switch (status) {
            case 'completed':
                return 'เสร็จสิ้น';
            case 'processing':
                return 'กำลังประมวลผล';
            case 'failed':
                return 'ล้มเหลว';
            default:
                return 'รอดำเนินการ';
        }
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
                <p className="text-gray-400">อัปโหลดวิดีโอเพื่อเริ่มการวิเคราะห์</p>
            </div>
        );
    }

    if (filteredVideos.length === 0 && searchTerm) {
        return (
            <div className="space-y-4">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-white">รายการวิดีโอ</h2>
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
                <h2 className="text-2xl font-bold text-white">รายการวิดีโอ</h2>

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

                <div className="flex justify-center items-center mt-6 space-x-2">
                    <button
                        onClick={() => changePage(currentPage - 1)}
                        disabled={currentPage === 1}
                        className="px-3 py-1  text-white rounded disabled:opacity-50"
                    >
                        <Icon icon="ooui:next-rtl" width="20" height="20" />
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                        <button
                            key={page}
                            onClick={() => changePage(page)}
                            className={`px-3 py-1 rounded ${page === currentPage ? 'bg-gray-700 text-white' : 'bg-greay-custom  text-white hover:bg-gray-600'}`}
                        >{page}</button>
                    ))}
                    <button
                        onClick={() => changePage(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        className="px-3 py-1  text-white rounded disabled:opacity-50"
                    >
                        <Icon icon="ooui:next-ltr" width="20" height="20" />
                    </button>
                </div>

                {/* <span className="flex  justify-end text-gray-400 text-sm text-end pt-3">ทั้งหมด {videos.length} รายการ</span> */}
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 ">
                {paginatedVideos.map((video) => (
                    <div
                        key={video.id}
                        onClick={() => handleVideoClick(video.id)}
                        className=" "
                    >
                        <div className="group relative rounded-lg p-4 cursor-pointer">

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

                                    <video
                                        src={video.videoPath}
                                        className="w-full h-full object-cover"
                                    />

                                </div>

                                <div className="w-full pt-3">
                                    <h3 className="text-white font-medium truncate text-sm mb-1">
                                        {video.originalFilename}
                                    </h3>
                                    <p className="text-gray-400 text-xs">
                                        {formatDate(video.uploadedAt)}
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
