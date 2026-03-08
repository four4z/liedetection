"use client";

import React, { useState, useRef, useEffect } from "react";
import { Icon } from "@iconify/react";

interface TimeWarpPoint {
    id: string;
    timestamp: number; // in seconds
    confidence: number; // 0-1
    label: string;
    thumbnail?: string; // base64 or image URL
}

interface TimewarpTimelineProps {
    videoDuration: number; // in seconds
    videoRef?: React.RefObject<HTMLVideoElement>;
    onPointClick?: (timestamp: number) => void;
}

export default function TimewarpTimeline({
    videoDuration,
    videoRef,
    onPointClick,
}: TimewarpTimelineProps) {
    const [timeWarpPoints, setTimeWarpPoints] = useState<TimeWarpPoint[]>([]);
    const [draggingPointId, setDraggingPointId] = useState<string | null>(null);
    const [hoveredPointId, setHoveredPointId] = useState<string | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [thumbnails, setThumbnails] = useState<Record<string, string>>({});

    // Mock data - Replace with actual API call to backend
    useEffect(() => {
        const mockPoints: TimeWarpPoint[] = [
            {
                id: "point-1",
                timestamp: 5,
                confidence: 0.85,
                label: "สงสัย",
            },
            {
                id: "point-2",
                timestamp: 15,
                confidence: 0.72,
                label: "เครียด",
            },
            {
                id: "point-3",
                timestamp: 28,
                confidence: 0.91,
                label: "โกหก",
            },
            {
                id: "point-4",
                timestamp: 42,
                confidence: 0.65,
                label: "ปกติ",
            },
        ];
        setTimeWarpPoints(mockPoints);

        // Generate thumbnails from video
        if (videoRef?.current) {
            generateThumbnails(mockPoints);
        }
    }, [videoRef]);

    const generateThumbnails = async (points: TimeWarpPoint[]) => {
        const video = videoRef?.current;
        if (!video) return;

        const newThumbnails: Record<string, string> = {};

        for (const point of points) {
            try {
                // Set video to specific timestamp
                video.currentTime = point.timestamp;

                // Wait for the frame to be ready
                await new Promise((resolve) => {
                    const onCanPlay = () => {
                        video.removeEventListener("canplay", onCanPlay);
                        resolve(null);
                    };
                    video.addEventListener("canplay", onCanPlay, { once: true });

                    // Timeout fallback
                    setTimeout(resolve, 500);
                });

                // Capture frame to canvas
                const canvas = document.createElement("canvas");
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                const ctx = canvas.getContext("2d");

                if (ctx) {
                    ctx.drawImage(video, 0, 0);
                    const thumbnail = canvas.toDataURL("image/jpeg", 0.7);
                    newThumbnails[point.id] = thumbnail;
                }
            } catch (error) {
                console.error(`Failed to generate thumbnail for point ${point.id}:`, error);
            }
        }

        setThumbnails(newThumbnails);

        // Reset video time to beginning
        if (video) {
            video.currentTime = 0;
        }
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, "0")}`;
    };

    const getConfidenceColor = (confidence: number) => {
        if (confidence >= 0.8) return "text-red-500";
        if (confidence >= 0.6) return "text-yellow-500";
        return "text-green-500";
    };

    const getConfidenceBgColor = (confidence: number) => {
        if (confidence >= 0.8) return "bg-red-500/20 border-red-500/50";
        if (confidence >= 0.6) return "bg-yellow-500/20 border-yellow-500/50";
        return "bg-green-500/20 border-green-500/50";
    };

    const handlePointMouseDown = (
        e: React.MouseEvent,
        pointId: string
    ) => {
        e.preventDefault();
        setDraggingPointId(pointId);
    };

    const handleMouseUp = () => {
        setDraggingPointId(null);
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!draggingPointId || !containerRef.current) return;

        const rect = containerRef.current.getBoundingClientRect();
        const percentage = (e.clientX - rect.left) / rect.width;
        const newTimestamp = Math.max(
            0,
            Math.min(videoDuration, percentage * videoDuration)
        );

        setTimeWarpPoints((prev) =>
            prev.map((point) =>
                point.id === draggingPointId
                    ? { ...point, timestamp: newTimestamp }
                    : point
            )
        );
    };

    const handlePointClick = (timestamp: number) => {
        if (videoRef?.current) {
            videoRef.current.currentTime = timestamp;
        }
        onPointClick?.(timestamp);
    };

    const getPointPosition = (timestamp: number) => {
        return (timestamp / videoDuration) * 100;
    };

    return (
        <div
            className="w-full h-full border border-greay-custom rounded-lg p-4 flex flex-col bg-greay-custom/50"
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
        >
            {/* Header */}
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Icon icon="mdi:clock-outline" width="20" height="20" />
                Timewarp Points
            </h3>

            {/* Timeline Container */}
            <div
                ref={containerRef}
                className="relative h-16 bg-black/40 border border-greay-custom rounded-lg mb-6 cursor-pointer overflow-hidden group"
            >
                {/* Timeline background */}
                <div className="absolute inset-0 flex items-center">
                    <div className="w-full h-1 bg-gray-700 rounded-full"></div>
                </div>

                {/* Time markers */}
                <div className="absolute inset-0 flex items-center justify-between px-2 text-[10px] text-gray-500 pointer-events-none">
                    <span>0s</span>
                    <span>{Math.floor(videoDuration / 2)}s</span>
                    <span>{Math.floor(videoDuration)}s</span>
                </div>

                {/* Points */}
                {timeWarpPoints.map((point) => (
                    <div
                        key={point.id}
                        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 group/point cursor-grab active:cursor-grabbing"
                        style={{ left: `${getPointPosition(point.timestamp)}%` }}
                        onMouseDown={(e) => handlePointMouseDown(e, point.id)}
                    >
                        {/* Point dot */}
                        <div
                            onClick={() => handlePointClick(point.timestamp)}
                            onMouseEnter={() => setHoveredPointId(point.id)}
                            onMouseLeave={() => setHoveredPointId(null)}
                            className={`w-3 h-3 rounded-full border-2 transform transition-all duration-200 ${getConfidenceBgColor(
                                point.confidence
                            )} ${hoveredPointId === point.id ? "scale-125" : "scale-100"
                                } cursor-pointer`}
                        ></div>

                        {/* Tooltip/Preview */}
                        {hoveredPointId === point.id && (
                            <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 z-50">
                                <div className="bg-black border border-gray-600 rounded-lg p-2 shadow-lg min-w-max">
                                    {/* Thumbnail */}
                                    {thumbnails[point.id] && (
                                        <img
                                            src={thumbnails[point.id]}
                                            alt={`Frame at ${formatTime(
                                                point.timestamp
                                            )}`}
                                            className="w-32 h-20 object-cover rounded mb-2"
                                        />
                                    )}

                                    {/* Info */}
                                    <div className="text-xs space-y-1">
                                        <div className="text-gray-300">
                                            <span className="font-medium">
                                                {formatTime(point.timestamp)}
                                            </span>
                                        </div>
                                        <div className="text-gray-400">
                                            {point.label}
                                        </div>
                                        <div
                                            className={`font-medium ${getConfidenceColor(
                                                point.confidence
                                            )}`}
                                        >
                                            Confidence: {(point.confidence * 100).toFixed(0)}%
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Points List */}
            <div className="flex-1 overflow-y-auto pr-2 space-y-2">
                {timeWarpPoints.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400">
                        <Icon
                            icon="mdi:clock-alert-outline"
                            width="32"
                            height="32"
                            className="mb-2"
                        />
                        <p className="text-sm">ไม่พบ Timewarp Points</p>
                    </div>
                ) : (
                    timeWarpPoints.map((point) => (
                        <div
                            key={point.id}
                            onClick={() => handlePointClick(point.timestamp)}
                            className={`p-2 rounded-lg border transition-all cursor-pointer ${getConfidenceBgColor(
                                point.confidence
                            )} hover:scale-105 hover:shadow-lg`}
                        >
                            <div className="flex justify-between items-start">
                                <div className="flex-1 min-w-0">
                                    <div className="text-xs text-gray-400 font-mono">
                                        {formatTime(point.timestamp)}
                                    </div>
                                    <div className="text-sm text-white font-medium truncate">
                                        {point.label}
                                    </div>
                                </div>
                                <div
                                    className={`text-[10px] font-bold ml-2 px-2 py-1 rounded bg-black/40 ${getConfidenceColor(
                                        point.confidence
                                    )}`}
                                >
                                    {(point.confidence * 100).toFixed(0)}%
                                </div>
                            </div>

                            {/* Thumbnail preview in list */}
                            {thumbnails[point.id] && (
                                <img
                                    src={thumbnails[point.id]}
                                    alt={`Frame at ${formatTime(point.timestamp)}`}
                                    className="w-full h-12 object-cover rounded mt-2"
                                />
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
