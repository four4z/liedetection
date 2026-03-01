"use client";
import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import { getMockVideoById, VideoItem } from "../../data/mockData";

interface AnalysisResult {
    isLieDetected: boolean;
    confidenceScore: number;
    status: string;
    analyzedAt?: string;
}

interface VideoDetail {
    id: string;
    userId?: string;
    originalFilename: string;
    durationSeconds?: number;
    fileSize: number;
    uploadedAt: string;
    isAnonymous: boolean;
    isClaimed: boolean;
    analysisResult?: AnalysisResult;
    videoPath?: string;
}

export default function VideoDetailPage() {
    const params = useParams();
    const router = useRouter();
    const videoId = params.id as string;

    const [video, setVideo] = useState<VideoDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [videoUrl, setVideoUrl] = useState<string | null>(null);

    useEffect(() => {
        if (videoId) {
            fetchVideoDetail();
        }
    }, [videoId]);

    const fetchVideoDetail = async () => {
        try {
            setLoading(true);

            // Simulate API delay
            setTimeout(() => {
                const videoData = getMockVideoById(videoId);
                if (videoData) {
                    setVideo(videoData as VideoDetail);
                    // Use videoPath from mock data
                    setVideoUrl(videoData.videoPath || `/videos/video-${videoId}.mp4`);
                } else {
                    throw new Error('ไม่พบวิดีโอนี้');
                }
                setLoading(false);
            }, 1000);

            /*
            // Real API call - commented out for development
            const response = await fetch(`/api/videos/${videoId}`, {
                credentials: 'include'
            });

            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error('ไม่พบวิดีโอนี้');
                }
                throw new Error('Failed to fetch video detail');
            }

            const data = await response.json();
            setVideo(data);

            // Fetch video stream URL
            const streamResponse = await fetch(`/api/videos/${videoId}/stream`, {
                credentials: 'include'
            });

            if (streamResponse.ok) {
                setVideoUrl(streamResponse.url);
            }
            */
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
        } finally {
            // setLoading(false); // Commented out because setTimeout handles this
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
            month: 'long',
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

    const getConfidenceColor = (score: number) => {
        if (score >= 0.8) return 'text-red-500';
        if (score >= 0.6) return 'text-yellow-500';
        return 'text-green-500';
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center min-h-screen">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                <span className="ml-2 text-white">กำลังโหลด...</span>
            </div>
        );
    }

    if (error || !video) {
        return (
            <div className="p-6">
                <div className="text-center py-12">
                    <div className="text-red-400 mb-4">
                        <Icon icon="mdi:alert-circle" width="48" height="48" />
                    </div>
                    <p className="text-white text-lg mb-4">{error || 'ไม่พบวิดีโอ'}</p>
                    <button
                        onClick={() => router.push('/list')}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        กลับไปยังรายการ
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto p-6 w-full">
            {/* Header */}
            <div className="flex items-center gap-4 mb-6">
                <button
                    onClick={() => router.push('/list')}
                    className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
                >
                    <Icon icon="mdi:arrow-left" width="20" height="20" />
                    Back
                </button>
                <h2 className="text-xl font-semibold text-white">
                    {video.originalFilename}
                </h2>

            </div>

            {/* Video Player */}
            <div className="flex gap-6 items-stretch mb-2">

                {/* Left : Video Section */}
                <div className="flex-1">
                    <div className="rounded-lg mb-4">

                        {videoUrl ? (
                            <div className="h-125 bg-black rounded-lg overflow-hidden ">
                                <video
                                    controls
                                    className="w-full h-full object-contain"
                                    src={videoUrl}
                                    poster="/api/placeholder/640/360"
                                >
                                    เบราว์เซอร์ของคุณไม่รองรับการเล่นวิดีโอ
                                </video>
                            </div>
                        ) : (
                            <div className="h-125 bg-gray-700 rounded-lg flex items-center justify-center">
                                <div className="text-center">
                                    <Icon
                                        icon="mdi:video-off"
                                        width="48"
                                        height="48"
                                        className="text-gray-400 mb-2"
                                    />
                                    <p className="text-gray-400">ไม่สามารถโหลดวิดีโอได้</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right : Log Section */}
                <div className="w-96 h-125 border border-greay-custom rounded-lg p-3 flex flex-col">
                    <h3 className="text-lg font-semibold text-white mb-4">Responce Log</h3>
                    <div className="overflow-y-auto pr-2 flex-1">


                        <div className="bg-greay-custom p-3 mb-2 rounded-lg text-gray-300  ">
                            <div className="flex justify-between">
                                <div className="text-[9px] shrink-0 mb-1">00.00-00.10</div>
                                <div className="text-[9px] ">red</div>
                            </div>
                            <div className="text-xs wrap-break-word">
                                Hello wouldsssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssss
                            </div>
                        </div>


                    </div>
                </div>
            </div>


            {/* Video Information */}
            <div className="grid md:grid-cols-2 gap-6">
                {/* Basic Information */}
                <div className="bg-gray-800 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <Icon icon="mdi:information" width="20" height="20" />
                        ข้อมูลพื้นฐาน
                    </h3>

                    <div className="space-y-3">
                        <div className="flex justify-between">
                            <span className="text-gray-400">ชื่อไฟล์:</span>
                            <span className="text-white text-right">{video.originalFilename}</span>
                        </div>

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

                        <div className="flex justify-between">
                            <span className="text-gray-400">วันที่อัปโหลด:</span>
                            <span className="text-white text-right">{formatDate(video.uploadedAt)}</span>
                        </div>

                        <div className="flex justify-between">
                            <span className="text-gray-400">โหมด:</span>
                            <span className="text-white">
                                {video.isAnonymous ? 'ไม่ระบุตัวตน' : 'ระบุตัวตน'}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Analysis Results */}
                <div className="bg-gray-800 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <Icon icon="mdi:brain" width="20" height="20" />
                        ผลการวิเคราะห์
                    </h3>

                    {video.analysisResult ? (
                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <span className="text-gray-400">สถานะ:</span>
                                <span className={`font-medium ${getStatusColor(video.analysisResult.status)}`}>
                                    {getStatusText(video.analysisResult.status)}
                                </span>
                            </div>

                            {video.analysisResult.status === 'completed' && (
                                <>
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-400">ผลการตรวจจับ:</span>
                                        <span className={`font-medium text-lg ${video.analysisResult.isLieDetected ? 'text-red-400' : 'text-green-400'
                                            }`}>
                                            {video.analysisResult.isLieDetected ? 'ตรวจพบการโกหก' : 'ไม่พบการโกหก'}
                                        </span>
                                    </div>

                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-400">ความเชื่อมั่น:</span>
                                        <span className={`font-medium ${getConfidenceColor(video.analysisResult.confidenceScore)}`}>
                                            {(video.analysisResult.confidenceScore * 100).toFixed(1)}%
                                        </span>
                                    </div>

                                    <div className="mt-4">
                                        <div className="w-full bg-gray-700 rounded-full h-3">
                                            <div
                                                className={`h-3 rounded-full transition-all duration-300 ${video.analysisResult.isLieDetected ? 'bg-red-500' : 'bg-green-500'
                                                    }`}
                                                style={{ width: `${video.analysisResult.confidenceScore * 100}%` }}
                                            ></div>
                                        </div>
                                        <div className="flex justify-between text-xs text-gray-400 mt-1">
                                            <span>0%</span>
                                            <span>50%</span>
                                            <span>100%</span>
                                        </div>
                                    </div>
                                </>
                            )}

                            {video.analysisResult.analyzedAt && (
                                <div className="flex justify-between">
                                    <span className="text-gray-400">วันที่วิเคราะห์:</span>
                                    <span className="text-white text-right text-sm">
                                        {formatDate(video.analysisResult.analyzedAt)}
                                    </span>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="text-center py-8">
                            <Icon icon="mdi:brain" width="32" height="32" className="text-gray-400 mb-2" />
                            <p className="text-gray-400">ยังไม่ได้วิเคราะห์</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Actions */}
            <div className="mt-6 flex gap-4">
                <button
                    onClick={() => router.push('/list')}
                    className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                    กลับไปยังรายการ
                </button>

                {video.analysisResult?.status === 'completed' && (
                    <button
                        onClick={() => {/* TODO: Implement download or share functionality */ }}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        ดาวน์โหลดรายงาน
                    </button>
                )}
            </div>
        </div>
    );
}
