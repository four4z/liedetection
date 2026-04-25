"use client";
import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import TimewarpTimeline from "../../component/TimewarpTimeline";
import { buildTimeWarpPoints, ApiVideo, TimeWarpPoint, videosApi } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function VideoDetailPage() {
    const params = useParams();
    const router = useRouter();
    const videoId = params.id as string;
    const videoRef = useRef<HTMLVideoElement>(null);
    const { token, isLoading: authLoading } = useAuth();

    const [video, setVideo] = useState<ApiVideo | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [videoUrl, setVideoUrl] = useState<string | null>(null);
    const [isTriggeringAnalysis, setIsTriggeringAnalysis] = useState(false);
    const [isAutoRefreshing, setIsAutoRefreshing] = useState(false);

    const timewarpPoints = useMemo<TimeWarpPoint[]>(() => {
        if (!video) {
            return [];
        }

        return buildTimeWarpPoints(video);
    }, [video]);

    const fetchVideoDetail = useCallback(async (silent = false) => {
        try {
            if (!silent) {
                setLoading(true);
            }

            const data = await videosApi.getById(videoId, token);
            setVideo(data);
            setVideoUrl(data.videoUrl);
            if (!silent) {
                setError(null);
            }
        } catch (err) {
            if (!silent) {
                setError(err instanceof Error ? err.message : 'An error occurred');
            }
        } finally {
            if (!silent) {
                setLoading(false);
            }
        }
    }, [videoId, token]);

    useEffect(() => {
        if (videoId && !authLoading) {
            fetchVideoDetail(false);
        }
    }, [videoId, authLoading, fetchVideoDetail]);

    useEffect(() => {
        const isProcessing = video?.analysisResult?.status === "processing";

        if (!isProcessing) {
            setIsAutoRefreshing(false);
            return;
        }

        setIsAutoRefreshing(true);
        const intervalId = window.setInterval(() => {
            void fetchVideoDetail(true);
        }, 5000);

        return () => {
            window.clearInterval(intervalId);
            setIsAutoRefreshing(false);
        };
    }, [video?.analysisResult?.status, fetchVideoDetail]);

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('th-TH', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const triggerAnalysis = async () => {
        if (!video) {
            return;
        }

        try {
            setIsTriggeringAnalysis(true);
            await videosApi.triggerAnalysis(video.id);
            await fetchVideoDetail();
            alert('เริ่มการวิเคราะห์เรียบร้อยแล้ว');
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Failed to trigger analysis');
        } finally {
            setIsTriggeringAnalysis(false);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center min-h-screen">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                <span className="ml-2 text-white">Loading...</span>
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
                    <p className="text-white text-lg mb-4">{error || 'Video not found'}</p>
                    <button
                        onClick={() => router.push('/list')}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        Back to list
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
                <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                    {video.title || 'Untitled video'}
                </h2>
            </div>

            {/* Bento Grid */}
            <div className="mb-2 grid grid-cols-1 gap-6 lg:grid-cols-7 lg:grid-rows-7 lg:h-195">
                <div className="lg:[grid-area:1/1/6/6] rounded-lg w-full h-full">
                    {videoUrl ? (
                        <div className="h-full w-full bg-black rounded-lg overflow-hidden">
                            <video
                                ref={videoRef}
                                controls
                                className="w-full h-full object-contain"
                                src={videoUrl}
                                poster="/api/placeholder/640/360"
                            >
                                Your browser does not support video playback.
                            </video>
                        </div>
                    ) : (
                        <div className="h-full w-full bg-gray-700 rounded-lg flex items-center justify-center">
                            <div className="text-center">
                                <Icon
                                    icon="mdi:video-off"
                                    width="48"
                                    height="48"
                                    className="text-gray-400 mb-2"
                                />
                                <p className="text-gray-400">Unable to load video.</p>
                            </div>
                        </div>
                    )}
                </div>

                <div className="lg:[grid-area:1/6/8/8] min-h-75 lg:min-h-0 h-full">
                    <TimewarpTimeline
                        points={timewarpPoints}
                        onPointClick={(timestamp) => {
                            if (videoRef.current) {
                                videoRef.current.currentTime = timestamp;
                            }
                        }}
                    />
                </div>

                <div className="lg:[grid-area:6/1/8/6]">
                    <div className="bg-greay-custom rounded-lg p-6 w-full h-full overflow-auto">

                    {video.analysisResult ? (
                        <div className="grid md:grid-cols-2 gap-6 space-y-4">
                            {/* Summary Section */}
                            <div className="">
                                <h4 className="text-md font-semibold text-white mb-3">Analysis Summary</h4>
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-400">Status:</span>
                                        <span className={`font-medium text-lg ${
                                            video.analysisResult.status === 'completed'
                                                ? 'text-green-400'
                                                : video.analysisResult.status === 'processing'
                                                ? 'text-yellow-400'
                                                : video.analysisResult.status === 'failed'
                                                ? 'text-red-400'
                                                : 'text-gray-300'
                                        }`}>
                                            {video.analysisResult.status}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-400">Detection result:</span>
                                        <span className="text-white font-medium">
                                            {video.analysisResult.isLieDetected === null
                                                ? '-'
                                                : video.analysisResult.isLieDetected
                                                ? 'Lie detected'
                                                : 'No lie detected'}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-400">Confidence:</span>
                                        <span className="text-white font-medium">
                                            {video.analysisResult.confidenceScore === null ? '-' : `${video.analysisResult.confidenceScore.toFixed(2)}%`}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-400">Uploaded at:</span>
                                        <span className="text-white font-medium">{formatDate(video.uploadedAt)}</span>
                                    </div>
                                    {video.analysisResult.analyzedAt && (
                                        <div className="flex justify-between items-center">
                                            <span className="text-gray-400">Analyzed at:</span>
                                            <span className="text-white font-medium">{formatDate(video.analysisResult.analyzedAt)}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-8">
                            <Icon icon="mdi:brain" width="32" height="32" className="text-gray-400 mb-2" />
                            <p className="text-gray-400">Not analyzed yet</p>
                        </div>
                    )}
                    </div>
                </div>
            </div>

            {/* Actions */}
            <div className="mt-6 flex gap-4">
                <button
                    onClick={() => router.push('/list')}
                    className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                    Back to list
                </button>

                <button
                    onClick={() => fetchVideoDetail(false)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                    Refresh status
                </button>

                <button
                    onClick={triggerAnalysis}
                    disabled={isTriggeringAnalysis || video.analysisResult?.status === 'processing'}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed"
                >
                    {isTriggeringAnalysis ? 'Starting analysis...' : 'Analyze now'}
                </button>

                {isAutoRefreshing && (
                    <span className="text-sm text-yellow-300 self-center">Auto-refreshing every 5s</span>
                )}

            </div>
            
        </div>
    );
}
