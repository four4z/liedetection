"use client";

import React, { useState, useRef, useEffect } from "react";
import { Icon } from "@iconify/react";
import { TimeWarpPoint, formatConfidencePercent } from "@/lib/api";

type FilterType = "all" | "lie" | "truth";

interface TimewarpTimelineProps {
    onPointClick?: (timestamp: number) => void;
    points?: TimeWarpPoint[];
}

export default function TimewarpTimeline({
    onPointClick,
    points,
}: TimewarpTimelineProps) {
    const timeWarpPoints = points || [];
    const [activeFilter, setActiveFilter] = useState<FilterType>("all");
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const filterPopupRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                filterPopupRef.current &&
                !filterPopupRef.current.contains(event.target as Node)
            ) {
                setIsFilterOpen(false);
            }
        };

        if (isFilterOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isFilterOpen]);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, "0")}`;
    };

    const getPointTimestampLabel = (point: TimeWarpPoint) =>
        point.timestampLabel || formatTime(point.timestamp);

    const getConfidenceColor = (confidence: number) => {
        if (confidence >= 0.8) return "bg-red-500";
        if (confidence >= 0.6) return "bg-green-500";
        return "text-green-500";
    };

    const getPointFilterType = (point: TimeWarpPoint): Exclude<FilterType, "all"> => {
        const normalizedLabel = point.label.trim().toLowerCase();

        if (
            normalizedLabel.includes("lie") ||
            normalizedLabel.includes("โกหก")
        ) {
            return "lie";
        }

        if (
            normalizedLabel.includes("truth") ||
            normalizedLabel.includes("จริง")
        ) {
            return "truth";
        }

        // Fallback for older/mock labels that do not include verdict text.
        return point.confidence >= 0.8 ? "lie" : "truth";
    };

    const filteredTimeWarpPoints =
        activeFilter === "all"
            ? timeWarpPoints
            : timeWarpPoints.filter(
                (point) => getPointFilterType(point) === activeFilter
            );

    const handlePointClick = (timestamp: number) => {
        onPointClick?.(timestamp);
    };
    return (
        <div
            className="w-full h-full border border-greay-custom rounded-lg p-4 overflow-auto flex flex-col bg-greay-custom/50"
        >

            <div className="mb-4 flex items-center justify-between relative" ref={filterPopupRef}>
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    <Icon icon="mdi:clock-outline" width="20" height="20" />
                    Timewarp Points
                </h3>

                <button
                    type="button"
                    onClick={() => setIsFilterOpen((prev) => !prev)}
                    className="flex items-center gap-2 rounded-lg border border-gray-600 px-2.5 py-1.5 text-xs text-gray-200 hover:bg-gray-700/60 transition-colors"
                >
                    <Icon icon="mdi:filter-variant" width="16" height="16" />
                    {activeFilter === "all" && "All"}
                    {activeFilter === "lie" && "Lie"}
                    {activeFilter === "truth" && "Truth"}
                </button>

                {isFilterOpen && (
                    <div className="absolute right-0 top-11 z-20 w-44 rounded-lg border border-gray-700 bg-[#111827] p-2 shadow-xl">
                        <button
                            type="button"
                            onClick={() => {
                                setActiveFilter("all");
                                setIsFilterOpen(false);
                            }}
                            className="w-full px-2 py-1.5 rounded-md text-left text-sm text-gray-100 hover:bg-gray-700/60 flex items-center justify-between"
                        >
                            <span className="flex items-center gap-2">
                                <Icon icon="mdi:format-list-bulleted" width="16" height="16" />
                                All
                            </span>
                            {activeFilter === "all" && <Icon icon="mdi:check" width="16" height="16" className="text-blue-400" />}
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setActiveFilter("lie");
                                setIsFilterOpen(false);
                            }}
                            className="w-full px-2 py-1.5 rounded-md text-left text-sm text-gray-100 hover:bg-gray-700/60 flex items-center justify-between"
                        >
                            <span className="flex items-center gap-2">
                                <Icon icon="mdi:alert-circle" width="16" height="16" className="text-red-400" />
                                Lie
                            </span>
                            {activeFilter === "lie" && <Icon icon="mdi:check" width="16" height="16" className="text-blue-400" />}
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setActiveFilter("truth");
                                setIsFilterOpen(false);
                            }}
                            className="w-full px-2 py-1.5 rounded-md text-left text-sm text-gray-100 hover:bg-gray-700/60 flex items-center justify-between"
                        >
                            <span className="flex items-center gap-2">
                                <Icon icon="mdi:check-circle" width="16" height="16" className="text-green-400" />
                                Truth
                            </span>
                            {activeFilter === "truth" && <Icon icon="mdi:check" width="16" height="16" className="text-blue-400" />}
                        </button>
                    </div>
                )}
            </div>

            <div className="flex-1 pr-2 space-y-2 custom-scroll">
                {filteredTimeWarpPoints.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400">
                        <Icon
                            icon="mdi:clock-alert-outline"
                            width="32"
                            height="32"
                            className="mb-2"
                        />
                        <p className="text-sm">
                            {activeFilter === "all"
                                ? "ไม่พบ Timewarp Points"
                                : "ไม่พบข้อมูลในฟิลเตอร์นี้"}
                        </p>
                    </div>
                ) : (
                    filteredTimeWarpPoints.map((point) => (
                        <div
                            key={point.id}
                            onClick={() => handlePointClick(point.timestamp)}
                            className="rounded-lg border border-gray-700 bg-black/20 p-4 transition-all cursor-pointer hover:bg-gray-700/50"
                        >

                            <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
                                <div className="flex gap-2">
                                    <img
                                        src={point.thumbnail || "/img/noimg.jpg"}
                                        alt={`Frame at ${getPointTimestampLabel(point)}`}
                                        className="w-25 h-18 object-cover rounded-md border border-gray-700"
                                        onError={(event) => {
                                            event.currentTarget.onerror = null;
                                            event.currentTarget.src = "/img/noimg.jpg";
                                        }}
                                    />
                                </div>

                                <div className="flex-1 space-y-2">


                                    <div className="grid gap-2 sm:grid-cols-2">
                                        <p className="text-xs text-gray-300">
                                            Face: {formatConfidencePercent(point.faceConfidenceScore ?? point.confidence)} / {point.faceVerdict || point.label}
                                        </p>
                                        <p className="text-xs text-gray-300">
                                            Arms: {formatConfidencePercent(point.armsConfidenceScore ?? point.confidence)} / {point.armsVerdict || point.label}
                                        </p>
                                        <p className="text-xs text-gray-300">
                                            Average: {formatConfidencePercent(point.averageConfidenceScoreSegment ?? point.confidence)}
                                        </p>
                                        <p className="text-xs text-gray-300">
                                            verdict: {point.averageBasedVerdict || point.label}
                                        </p>
                                    </div>

                                    <div className="flex justify-between items-center">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="rounded-full bg-gray-800 px-2 py-1 text-xs text-gray-200 font-mono">
                                                {getPointTimestampLabel(point)}
                                            </span>
                                            <span
                                                className={`rounded-full px-2 py-1 text-[10px] font-semibold ${getPointFilterType(point) === "lie"
                                                        ? "bg-red-500/20 text-red-300"
                                                        : "bg-green-500/20 text-green-300"
                                                    }`}
                                            >
                                                {getPointFilterType(point).toUpperCase()}
                                            </span>
                                            {point.partsIndicate && (
                                                <span className="rounded-full bg-gray-800 px-2 py-1 text-[10px] text-gray-200 uppercase tracking-wide">
                                                    Parts: {point.partsIndicate}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex justify-center items-center gap-1">
                                            <div className="text-[10px] text-gray-500 font-semibold">
                                                {Math.round(point.confidence * 100)}%
                                            </div>
                                            <div
                                                className={`w-3 h-3 rounded-full bg-black/40 ${getConfidenceColor(
                                                    point.confidence
                                                )}`}
                                            >
                                            </div>
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
