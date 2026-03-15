"use client";

import React, { useState, useRef, useEffect } from "react";
import { Icon } from "@iconify/react";
import { TimeWarpPoint } from "../data/mockData";
import Image from "next/image";


interface TimewarpTimelineProps {
    videoDuration: number;
    videoRef?: React.RefObject<HTMLVideoElement | null>;
    onPointClick?: (timestamp: number) => void;
    points?: TimeWarpPoint[];
}

export default function TimewarpTimeline({
    videoDuration,
    videoRef,
    onPointClick,
    points,
}: TimewarpTimelineProps) {
    const [timeWarpPoints, setTimeWarpPoints] = useState<TimeWarpPoint[]>(points || []);
    const [draggingPointId, setDraggingPointId] = useState<string | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [thumbnails, setThumbnails] = useState<Record<string, string>>({});

    useEffect(() => {
        setTimeWarpPoints(points || []);
    }, [points]);

    useEffect(() => {
        if (videoRef?.current && timeWarpPoints.length) {
            generateThumbnails(timeWarpPoints);
        }
    }, [videoRef, timeWarpPoints]);

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

    const getConfidenceTextColor = (confidence: number) => {
        if (confidence >= 0.8) return "text-red-400";
        if (confidence >= 0.6) return "text-yellow-400";
        return "text-green-400";
    };

    const getConfidenceColor = (confidence: number) => {
        if (confidence >= 0.8) return "bg-red-500";
        if (confidence >= 0.6) return "bg-green-500";
        return "text-green-500";
    };

    const getConfidenceBgColor = (confidence: number) => {
        if (confidence >= 0.8) return "bg-red-500/20 ";
        if (confidence >= 0.6) return "bg-yellow-500/20 ";
        return "bg-green-500/20 border-green-500/50";
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
    return (
        <div
            className="w-full h-full border border-greay-custom rounded-lg p-4 flex flex-col bg-greay-custom/50"
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
        >

            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Icon icon="mdi:clock-outline" width="20" height="20" />
                Timewarp Points
            </h3>

            <div className="flex-1 overflow-y-auto pr-2 space-y-2 custom-scroll">
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
                            className={` p-2 rounded-lg transition-all cursor-pointer ${getConfidenceBgColor(
                                point.confidence
                            )} hover:bg-gray-700/50 `}
                        >

                            <div className="flex justify-between ">
                                <div className="flex gap-2">
                                    {thumbnails[point.id] && (
                                        <Image
                                            src={thumbnails[point.id]}
                                            alt={`Frame at ${formatTime(point.timestamp)}`}
                                            className=" object-cover rounded"
                                            width={100}
                                            height={48}
                                        />
                                    )}
                                    <div className="text-xs text-gray-400 font-mono">
                                        {formatTime(point.timestamp)}
                                    </div>
                                </div>


                                <div className="flex justify-end items-start">
                                    <div className="flex justify-center items-center gap-1">
                                        <div className="text-[10px] text-gray-500 font-semibold">
                                        {Math.round(point.confidence * 100)}%
                                    </div>
                                    <div
                                        className={` w-3 h-3 rounded-full bg-black/40 ${getConfidenceColor(
                                            point.confidence
                                        )}`}
                                    >
                                    </div>
                                    </div>
                                    
                                </div>
                            </div>

                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
