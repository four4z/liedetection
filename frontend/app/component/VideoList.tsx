"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import { mockVideos, VideoItem } from "../data/mockData";

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

    const formatFileSize = (bytes: number) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {videos.map((video) => (
                    <div
                        key={video.id}
                        onClick={() => handleVideoClick(video.id)}
                        className="bg-gray-800 rounded-lg p-4 cursor-pointer hover:bg-gray-700 transition-colors border border-gray-700 hover:border-gray-600"
                    >
                        <div className="flex items-start justify-between mb-3">
                            <div className="flex-1 min-w-0">
                                <h3 className="text-white font-medium truncate text-sm mb-1">
                                    {video.originalFilename}
                                </h3>
                                <p className="text-gray-400 text-xs">
                                    {formatDate(video.uploadedAt)}
                                </p>
                            </div>
                            <div className="ml-2">
                                <Icon icon="mdi:chevron-right" width="20" height="20" className="text-gray-400" />
                            </div>
                        </div>

                        <div className="space-y-2 text-xs">
                            <div className="flex justify-between">
                                <span className="text-gray-400">ขนาดไฟล์:</span>
                                <span className="text-white">{formatFileSize(video.fileSize)}</span>
                            </div>

                            {video.durationSeconds && (
                                <div className="flex justify-between">
                                    <span className="text-gray-400">ความยาว:</span>
                                    <span className="text-white">{Math.round(video.durationSeconds)} วินาที</span>
                                </div>
                            )}

                            <div className="flex justify-between items-center">
                                <span className="text-gray-400">สถานะ:</span>
                                <span className={`font-medium ${getStatusColor(video.analysisResult?.status || 'pending')}`}>
                                    {getStatusText(video.analysisResult?.status || 'pending')}
                                </span>
                            </div>

                            {video.analysisResult?.status === 'completed' && (
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-400">ผลการวิเคราะห์:</span>
                                    <span className={`font-medium ${video.analysisResult.isLieDetected ? 'text-red-400' : 'text-green-400'}`}>
                                        {video.analysisResult.isLieDetected ? 'ตรวจพบการโกหก' : 'ไม่พบการโกหก'}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
