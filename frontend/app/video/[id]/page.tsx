"use client";
import React, { useState, useEffect, useRef, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import { getMockVideoById, AnalysisResult, TimeWarpPoint } from "../../data/mockData";
import TimewarpTimeline from "../../component/TimewarpTimeline";

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
    timeWarpPoints?: TimeWarpPoint[];
}

export default function VideoDetailPage() {
    const params = useParams();
    const router = useRouter();
    const videoId = params.id as string;
    const videoRef = useRef<HTMLVideoElement>(null);

    const [video, setVideo] = useState<VideoDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [videoUrl, setVideoUrl] = useState<string | null>(null);
    const [isEditingName, setIsEditingName] = useState(false);
    const [newFilename, setNewFilename] = useState('');

    const timewarpPoints = useMemo<TimeWarpPoint[]>(() => {
        const segments = video?.analysisResult?.segments;

        if (segments && segments.length > 0) {
            return segments.map((segment, index) => {
                const [start] = segment.raw_timestamp.split("-");
                const parsedStart = Number.parseFloat(start);

                return {
                    id: `segment-${index + 1}`,
                    timestamp: Number.isFinite(parsedStart) ? parsedStart : index * 3,
                    confidence: segment.average_confidence_score_segment,
                    label: segment.verdict === "LIE" ? "โกหก" : "จริง",
                    partsIndicate: segment.parts_indicate,
                    thumbnail: segment.face_image_b64
                        ? `data:image/jpeg;base64,${segment.face_image_b64}`
                        : undefined,
                };
            });
        }

        return video?.timeWarpPoints || [];
    }, [video]);

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
                    setVideoUrl(videoData.videoPath || `/video-${videoId}.mp4`);
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

    const handleEditName = () => {
        setNewFilename(video?.originalFilename || '');
        setIsEditingName(true);
    };

    const handleSaveName = async () => {
        // TODO: Implement API call to update video name
        if (video) {
            setVideo({ ...video, originalFilename: newFilename });
        }
        setIsEditingName(false);
    };

    const handleCancelEdit = () => {
        setIsEditingName(false);
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
                <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                    {video.originalFilename}
                    <button
                        onClick={handleEditName}
                        className="text-gray-400 hover:text-white transition-colors"
                        title="แก้ไขชื่อวิดีโอ"
                    >
                        <Icon icon="mdi:pencil" width="16" height="16" />
                    </button>
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
                                เบราว์เซอร์ของคุณไม่รองรับการเล่นวิดีโอ
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
                                <p className="text-gray-400">ไม่สามารถโหลดวิดีโอได้</p>
                            </div>
                        </div>
                    )}
                </div>

                <div className="lg:[grid-area:1/6/8/8] min-h-75 lg:min-h-0 h-full">
                    <TimewarpTimeline
                        videoDuration={video?.durationSeconds || 60}
                        videoRef={videoRef}
                        points={timewarpPoints}
                        onPointClick={(timestamp) => {
                            console.log(`Clicked timewarp point at ${timestamp}s`);
                        }}
                    />
                </div>

                <div className="lg:[grid-area:6/1/8/6]">
                    <div className="bg-greay-custom rounded-lg p-6 w-full h-full overflow-auto">

                    {video.analysisResult ? (
                        <div className="grid md:grid-cols-2 gap-6 space-y-4">
                            {/* Summary Section */}
                            <div className="">
                                <h4 className="text-md font-semibold text-white mb-3">สรุปผลการวิเคราะห์</h4>
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-400">ผลการตรวจจับ:</span>
                                        <span className={`font-medium text-lg ${video.analysisResult?.summary?.final_verdict === 'LIE' ? 'text-red-400' : 'text-green-400'}`}>
                                            {video.analysisResult?.summary?.final_verdict === 'LIE' ? 'ตรวจพบการโกหก' : 'ไม่พบการโกหก'}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-400">ความเชื่อมั่นเฉลี่ย:</span>
                                        <span className="text-white font-medium">
                                            {video.analysisResult?.summary?.average_confidence_score ? (video.analysisResult.summary.average_confidence_score * 100).toFixed(1) : '0.0'}%
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-400">จำนวนช่วงที่วิเคราะห์:</span>
                                        <span className="text-white font-medium">
                                            {video.analysisResult?.summary?.total_segments_analyzed || 0} ช่วง
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Segments Section */}
                            <div className="">
                                <h4 className="text-md font-semibold text-white mb-3">รายละเอียดแต่ละช่วง</h4>
                                <div className="space-y-2">
                                    {video.analysisResult?.segments?.map((segment, index) => (
                                        <div key={index} className="flex justify-between items-center bg-gray-600 rounded p-2">
                                            <div className="flex-1">
                                                <span className="text-gray-300 text-sm">ช่วงเวลา: {segment.timestamp}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className={`text-sm font-medium ${segment.verdict === 'LIE' ? 'text-red-400' : 'text-green-400'}`}>
                                                    {segment.verdict === 'LIE' ? 'โกหก' : 'จริง'}
                                                </span>
                                                <span className="text-gray-400 text-sm">
                                                    ({(segment.average_confidence_score_segment * 100).toFixed(1)}%)
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-8">
                            <Icon icon="mdi:brain" width="32" height="32" className="text-gray-400 mb-2" />
                            <p className="text-gray-400">ยังไม่ได้วิเคราะห์</p>
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
                    กลับไปยังรายการ
                </button>

            </div>
            
            {/* Edit Name Modal */}
            {isEditingName && (
                <div className="fixed inset-0 bg-black-custom flex items-center justify-center z-50">
                    <div className="bg-gray-800 rounded-lg p-6 w-96 max-w-md">
                        <h3 className="text-lg font-semibold text-white mb-4">แก้ไขชื่อวิดีโอ</h3>
                        <input
                            type="text"
                            value={newFilename}
                            onChange={(e) => setNewFilename(e.target.value)}
                            className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="ชื่อวิดีโอใหม่"
                            autoFocus
                        />
                        <div className="flex gap-2 justify-end">
                            <button
                                onClick={handleCancelEdit}
                                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                            >
                                ยกเลิก
                            </button>
                            <button
                                onClick={handleSaveName}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                            >
                                บันทึก
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
        </div>
    );
}
