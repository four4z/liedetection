"use client";
import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import TimewarpTimeline from "../../../component/TimewarpTimeline";
import RenameModal from "../../../component/RenameModal";
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
    const pendingSeekRef = useRef<number | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const { token, isLoading: authLoading } = useAuth();

    const [video, setVideo] = useState<ApiVideo | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [videoUrl, setVideoUrl] = useState<string | null>(null);
    const [showRenameModal, setShowRenameModal] = useState(false);
    const [showActionMenu, setShowActionMenu] = useState(false);
    const [isRenaming, setIsRenaming] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const timewarpPoints = useMemo<TimeWarpPoint[]>(() => {
        if (!video) {
            return [];
        }

        return buildTimeWarpPoints(video);
    }, [video]);

    const seekVideoToTimestamp = useCallback((timestamp: number) => {
        const videoElement = videoRef.current;

        if (!videoElement) {
            return;
        }

        const seek = () => {
            const safeTimestamp = Math.max(0, timestamp);

            try {
                if (typeof videoElement.fastSeek === "function") {
                    videoElement.fastSeek(safeTimestamp);
                } else {
                    videoElement.currentTime = safeTimestamp;
                }
            } catch {
                videoElement.currentTime = safeTimestamp;
            }
        };

        if (videoElement.readyState < HTMLMediaElement.HAVE_METADATA) {
            pendingSeekRef.current = timestamp;
            return;
        }

        pendingSeekRef.current = null;
        seek();
    }, []);

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

    useEffect(() => {
        const videoElement = videoRef.current;

        if (!videoElement) {
            return;
        }

        const handleLoadedMetadata = () => {
            if (pendingSeekRef.current === null) {
                return;
            }

            const timestamp = pendingSeekRef.current;
            pendingSeekRef.current = null;

            if (typeof videoElement.fastSeek === "function") {
                videoElement.fastSeek(Math.max(0, timestamp));
            } else {
                videoElement.currentTime = Math.max(0, timestamp);
            }
        };

        videoElement.addEventListener("loadedmetadata", handleLoadedMetadata);

        return () => {
            videoElement.removeEventListener("loadedmetadata", handleLoadedMetadata);
        };
    }, [videoUrl]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setShowActionMenu(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    const handleRename = async (newTitle: string) => {
        if (!token) {
            console.error("No token available");
            return;
        }

        try {
            setIsRenaming(true);
            await videosApi.rename(videoId, newTitle, token);
            setVideo((prev) =>
                prev ? { ...prev, video: newTitle } : null
            );
            setShowRenameModal(false);
        } catch (err) {
            throw err;
        } finally {
            setIsRenaming(false);
        }
    };

    const handleDelete = async () => {
        if (!token || !window.confirm("Are you sure you want to delete this video? This action cannot be undone.")) {
            return;
        }

        try {
            setIsDeleting(true);
            await videosApi.delete(videoId, token);
            router.push("/list");
        } catch (err) {
            console.error("Failed to delete video:", err);
            setError(err instanceof Error ? err.message : "Failed to delete video");
            setIsDeleting(false);
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
        <div className="mx-auto w-full">
            {/* Header Bar */}
            <div className="flex items-center h-13 px-5 bg-[#1a1a1a] border-b border-[#2a2a2a] gap-3">
                {/* Back Button */}
                <button
                    onClick={() => router.push("/list")}
                    className="flex items-center gap-1.5 text-gray-500 hover:text-gray-300 transition-colors whitespace-nowrap text-sm"
                >
                    <Icon icon="mdi:arrow-left" width="18" height="18" />
                    <span className="font-normal">Back</span>
                </button>

                {/* Vertical Divider */}
                <div className="w-px h-6 bg-[#2a2a2a]" />

                {/* Title (flex-grow) */}
                <div className="flex items-center gap-2 flex-1 min-w-0">
                    <h1 className="text-lg font-medium text-white truncate">
                        {getVideoTitle(video)}
                    </h1>
                    {/* 3-dot Action Menu */}
                    <div ref={menuRef} className="relative">
                        <button
                            onClick={() => setShowActionMenu((prev) => !prev)}
                            disabled={isDeleting || isRenaming}
                            className="flex items-center justify-center w-8 h-8 rounded  text-gray-400 hover:text-gray-200 transition-colors disabled:opacity-50"
                            title="More actions"
                        >
                            <Icon icon="mdi:dots-vertical" width="18" height="18" />
                        </button>

                        {showActionMenu && (
                            <div className="absolute left-0 top-10 z-30 w-40 rounded-md border border-[#2a2a2a] bg-[#111111] shadow-lg overflow-hidden">
                                <button
                                    onClick={() => {
                                        setShowActionMenu(false);
                                        setShowRenameModal(true);
                                    }}
                                    disabled={isRenaming || isDeleting}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-200 hover:bg-[#1e1e1e] transition-colors disabled:opacity-50"
                                >
                                    <Icon icon="mdi:pencil" width="16" height="16" />
                                    <span>Rename</span>
                                </button>
                                <button
                                    onClick={() => {
                                        setShowActionMenu(false);
                                        void handleDelete();
                                    }}
                                    disabled={isDeleting || isRenaming}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-900/20 transition-colors disabled:opacity-50"
                                >
                                    <Icon icon="mdi:trash" width="16" height="16" />
                                    <span>{isDeleting ? "Deleting..." : "Delete"}</span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Date & Time Badge */}
                <div className="flex items-center gap-2 px-3 py-1.5 rounded border border-[#2a2a2a] bg-black/30 text-gray-500 text-m  whitespace-nowrap">
                    <Icon icon="mdi:calendar" width="18" height="18" />
                    <span className="font-normal">
                        {new Date(video.uploaded_at).toLocaleDateString("th-TH", {
                            day: "numeric",
                            month: "short",
                            year: "2-digit",
                        })}
                        {" · "}
                        {new Date(video.uploaded_at).toLocaleTimeString("th-TH", {
                            hour: "2-digit",
                            minute: "2-digit",
                        })}
                    </span>
                </div>



            </div>

            {/* Content Area */}
            <div className="p-6 w-full">

                <div className="mb-2 grid grid-cols-1 gap-6 lg:grid-cols-7 lg:grid-rows-7 lg:h-195">
                    <div className="lg:[grid-area:1/1/6/6] rounded-lg w-full h-full">
                        {videoUrl ? (
                            <div className="h-full w-full bg-black rounded-lg overflow-hidden">
                                <video
                                    ref={videoRef}
                                    controls
                                    controlsList="nodownload"
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
                            onPointClick={seekVideoToTimestamp}
                        />
                    </div>


                    <div className="lg:[grid-area:6/1/8/6] space-y-6">

                        {/* 🔹 Container 1: Summary */}
                        <div className=" rounded-lg w-full">
                            <div className="grid gap-4 md:grid-cols-3">
                                <div className="rounded-lg border border-gray-700 bg-black/20 p-4">
                                    <p className="text-sm text-gray-400">Final Verdict</p>
                                    <p className={`mt-2 font-semibold ${video.summary?.final_verdict === "LIE"
                                        ? "text-red-400"
                                        : "text-green-400"
                                        }`}>
                                        {video.summary?.final_verdict || "-"}
                                    </p>
                                </div>

                                <div className="rounded-lg border border-gray-700 bg-black/20 p-4">
                                    <p className="text-sm text-gray-400">Average Confidence</p>
                                    <p className="mt-2 text-white font-medium">
                                        {video.summary
                                            ? formatConfidencePercent(video.summary.average_confidence_score)
                                            : "-"}
                                    </p>
                                </div>

                                <div className="rounded-lg border border-gray-700 bg-black/20 p-4">
                                    <p className="text-sm text-gray-400">Segments Analyzed</p>
                                    <p className="mt-2 text-white font-medium">
                                        {video.summary?.total_segments_analyzed ?? video.segments.length}
                                    </p>
                                </div>


                            </div>
                        </div>

                    </div>
                </div>
            </div>

            <RenameModal
                isOpen={showRenameModal}
                currentTitle={getVideoTitle(video)}
                onClose={() => setShowRenameModal(false)}
                onConfirm={handleRename}
                isLoading={isRenaming}
            />
        </div>
    );
}