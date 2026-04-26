"use client";
import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import TimewarpTimeline from "../../component/TimewarpTimeline";
import {
    ApiVideo,
    TimeWarpPoint,
    buildTimeWarpPoints,
    formatConfidencePercent,
    getVideoTitle,
    videosApi,
} from "@/lib/api";
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
            setVideoUrl(data.video_url);
            if (!silent) {
                setError(null);
            }
        } catch (err) {
            if (!silent) {
                setError(err instanceof Error ? err.message : "An error occurred");
            }
        } finally {
            if (!silent) {
                setLoading(false);
            }
        }
    }, [videoId, token]);

    useEffect(() => {
        if (videoId && !authLoading) {
            void fetchVideoDetail(false);
        }
    }, [videoId, authLoading, fetchVideoDetail]);

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString("th-TH", {
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
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
                    <p className="text-white text-lg mb-4">{error || "Video not found"}</p>
                    <button
                        onClick={() => router.push("/list")}
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
            <div className="flex items-center gap-4 mb-6">
                <button
                    onClick={() => router.push("/list")}
                    className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
                >
                    <Icon icon="mdi:arrow-left" width="20" height="20" />
                    Back
                </button>
                <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                    {getVideoTitle(video)}
                </h2>
            </div>

            <div className="mb-2 grid grid-cols-1 gap-6 lg:grid-cols-7 lg:grid-rows-7 lg:h-195">
                <div className="lg:[grid-area:1/1/6/6] rounded-lg w-full h-full">
                    {videoUrl ? (
                        <div className="h-full w-full bg-black rounded-lg overflow-hidden">
                            <video
                                ref={videoRef}
                                controls
                                className="w-full h-full object-contain"
                                src={videoUrl}
                                poster={video.thumbnail_url || undefined}
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
                        <div className="space-y-6">
                            <div className="grid gap-4 md:grid-cols-3">
                                <div className="rounded-lg border border-gray-700 bg-black/20 p-4">
                                    <p className="text-sm text-gray-400">Video name</p>
                                    <p className="mt-2 text-white font-medium">{video.video}</p>
                                </div>
                                <div className="rounded-lg border border-gray-700 bg-black/20 p-4">
                                    <p className="text-sm text-gray-400">User id</p>
                                    <p className="mt-2 text-white font-medium break-all">{video.user_id || "-"}</p>
                                </div>
                                <div className="rounded-lg border border-gray-700 bg-black/20 p-4">
                                    <p className="text-sm text-gray-400">Video duration</p>
                                    <p className="mt-2 text-white font-medium">{video.video_duration || "-"}</p>
                                </div>
                            </div>

                            <div className="grid gap-4 md:grid-cols-3">
                                <div className="rounded-lg border border-gray-700 bg-black/20 p-4">
                                    <p className="text-sm text-gray-400">Final verdict</p>
                                    <p className={`mt-2 font-semibold ${video.summary?.final_verdict === "LIE" ? "text-red-400" : "text-green-400"}`}>
                                        {video.summary?.final_verdict || "-"}
                                    </p>
                                </div>
                                <div className="rounded-lg border border-gray-700 bg-black/20 p-4">
                                    <p className="text-sm text-gray-400">Average confidence</p>
                                    <p className="mt-2 text-white font-medium">
                                        {video.summary ? formatConfidencePercent(video.summary.average_confidence_score) : "-"}
                                    </p>
                                </div>
                                <div className="rounded-lg border border-gray-700 bg-black/20 p-4">
                                    <p className="text-sm text-gray-400">Segments analyzed</p>
                                    <p className="mt-2 text-white font-medium">{video.summary?.total_segments_analyzed ?? video.segments.length}</p>
                                </div>
                            </div>

                            <div className="rounded-lg border border-gray-700 bg-black/20 p-4">
                                <p className="text-sm text-gray-400">Uploaded at</p>
                                <p className="mt-2 text-white font-medium">{formatDate(video.uploaded_at)}</p>
                            </div>

                            <div>
                                <h4 className="text-md font-semibold text-white mb-3">Segments</h4>
                                <div className="space-y-3">
                                    {video.segments.length === 0 ? (
                                        <div className="text-center py-8 text-gray-400">
                                            <Icon icon="mdi:timeline-clock-outline" width="32" height="32" className="mx-auto mb-2" />
                                            <p>No segment data available</p>
                                        </div>
                                    ) : (
                                        video.segments.map((segment, index) => (
                                            <div key={`${segment.timestamp}-${index}`} className="rounded-lg border border-gray-700 bg-black/20 p-4">
                                                <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
                                                    {segment.face_image_b64 && (
                                                        <img
                                                            src={`data:image/jpeg;base64,${segment.face_image_b64}`}
                                                            alt={segment.timestamp}
                                                            className="w-full max-w-40 rounded-md border border-gray-700 object-cover"
                                                        />
                                                    )}
                                                    <div className="flex-1 space-y-2">
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <span className="rounded-full bg-gray-800 px-2 py-1 text-xs text-gray-200">{segment.timestamp}</span>
                                                            <span className={`rounded-full px-2 py-1 text-xs font-semibold ${segment.verdict === "LIE" ? "bg-red-500/20 text-red-300" : "bg-green-500/20 text-green-300"}`}>
                                                                {segment.verdict}
                                                            </span>
                                                            <span className="rounded-full bg-gray-800 px-2 py-1 text-xs text-gray-200">
                                                                Parts: {segment.parts_indicate}
                                                            </span>
                                                        </div>

                                                        <div className="grid gap-2 sm:grid-cols-2">
                                                            <p className="text-sm text-gray-300">Face: {formatConfidencePercent(segment.face_confidence_score)} / {segment.face_verdict}</p>
                                                            <p className="text-sm text-gray-300">Arms: {formatConfidencePercent(segment.arms_confidence_score)} / {segment.arms_verdict}</p>
                                                            <p className="text-sm text-gray-300">Average: {formatConfidencePercent(segment.average_confidence_score_segment)}</p>
                                                            <p className="text-sm text-gray-300">Based verdict: {segment.average_based_verdict}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="mt-6 flex gap-4">
                <button
                    onClick={() => router.push("/list")}
                    className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                    Back to list
                </button>

                <button
                    onClick={() => fetchVideoDetail(false)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                    Refresh
                </button>
            </div>
        </div>
    );
}
