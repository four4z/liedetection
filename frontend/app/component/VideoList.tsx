"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import { mockVideos, VideoItem } from "../data/mockData";
import Image from "next/image";

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
    const router = useRouter();

    useEffect(() => {
        if (!propVideos) {
            fetchVideos();
        }
    }, [propVideos]);

    const fetchVideos = async () => {
        try {
            setLoading(true);

            // Simulate API delay
            setTimeout(() => {
                setVideos(mockVideos);
                setLoading(false);
            }, 1000);

            /*
            // Real API call - commented out for development
            const response = await fetch('/api/videos', {
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error('Failed to fetch videos');
            }

            const data = await response.json();
            setVideos(data);
            */
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
        } finally {
            // setLoading(false); // Commented out because setTimeout handles this
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

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-white">รายการวิดีโอ</h2>
                <span className="text-gray-400 text-sm">ทั้งหมด {videos.length} รายการ</span>
            </div>
            <div>
                <input
                    type="text"
                    placeholder="ค้นหาวิดีโอ..."
                    className="w-full p-2 bg-gray-700 text-white rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {videos.map((video) => (
                    <div
                        key={video.id}
                        onClick={() => handleVideoClick(video.id)}
                        className="bg-gray-800 rounded-lg p-4 cursor-pointer hover:bg-gray-700 transition-colors border border-gray-700 hover:border-gray-600"
                    >
                        <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                                {video.thumbnailUrl ? (
                                    <Image
                                        src={video.thumbnailUrl}
                                        alt="Video Thumbnail"
                                        width={320}
                                        height={180}
                                        className="rounded-md mb-3 object-cover w-full h-40"
                                    />
                                ) : (
                                    <div className="rounded-md mb-3 w-full h-40 bg-red-300 flex items-center justify-center text-gray-400 text-sm">
                                        No Thumbnail
                                    </div>
                                )}
                                <div className="flex justify-between flex-col" >
                                    <h3 className="text-white font-medium truncate text-sm mb-1">
                                        {video.originalFilename}
                                    </h3>
                                    <p className="item-end text-gray-400 text-xs">
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
