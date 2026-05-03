"use client";
import React, { useState, useRef, useEffect } from "react";
import { Icon } from "@iconify/react";
import { videosApi } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";

export default function Main() {
    const [file, setFile] = useState<File | null>(null);
    const [videoTitle, setVideoTitle] = useState("");
    const [videoUrl, setVideoUrl] = useState<string | undefined>(undefined);
    const [dragActive, setDragActive] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const recordingStreamRef = useRef<MediaStream | null>(null);
    const videoPreviewRef = useRef<HTMLVideoElement | null>(null);
    const log = (...args: any[]) => console.debug("[Recorder]", ...args);
    const { token } = useAuth();
    const router = useRouter();

    const getDefaultTitle = (name: string) => name.replace(/\.[^/.]+$/, "");

    const handleFile = (selectedFile: File) => {

        if (videoUrl) {
            URL.revokeObjectURL(videoUrl);
        }

        const allowedTypes = ["video/mp4", "video/webm", "video/ogg", "video/quicktime"];

        if (!allowedTypes.includes(selectedFile.type)) {
            alert("รองรับเฉพาะไฟล์วิดีโอ (.mp4, .webm, .ogg, .mov) เท่านั้น");
            return;
        }

        setFile(selectedFile);
        setVideoTitle(getDefaultTitle(selectedFile.name));
        const url = URL.createObjectURL(selectedFile);
        setVideoUrl(url);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            handleFile(e.target.files[0]);
        }
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setDragActive(false);

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFile(e.dataTransfer.files[0]);
        }
    };

const handleDeleteVideo = () => {
    log("handleDeleteVideo called");
    if (videoUrl) {
        URL.revokeObjectURL(videoUrl);
    }

    if (recordedUrl) {
        URL.revokeObjectURL(recordedUrl);
    }

    if (streamRef.current) {
        log("Stopping preview stream tracks", streamRef.current.id, streamRef.current.getTracks().map(t => ({ id: t.id, kind: t.kind })) );
        streamRef.current.getTracks().forEach(track => track.stop());
    }

    if (recordingStreamRef.current) {
        log("Stopping recordingStream tracks", recordingStreamRef.current.id, recordingStreamRef.current.getTracks().map(t => ({ id: t.id, kind: t.kind })) );
        recordingStreamRef.current.getTracks().forEach(track => track.stop());
    }

    mediaRecorderRef.current = null;
    streamRef.current = null;
    recordingStreamRef.current = null;

    setFile(null);
    setVideoUrl(undefined);
    setRecordedUrl(null);
    setIsRecording(false);
    setIsAnalyzing(false);
    setVideoTitle("");
};



    const handleStartAnalysis = async () => {
        if (!file) return;

        setIsAnalyzing(true);
        try {
            // Step 1: Upload video to S3
            console.log("Uploading video to S3:", file.name);
            const formData = new FormData();
            formData.append("file", file);

            const uploadResponse = await fetch("/api/upload", {
                method: "POST",
                body: formData,
            });

            if (!uploadResponse.ok) {
                const error = await uploadResponse.json();
                throw new Error(error.error || "Failed to upload video to S3");
            }

            const uploadData = await uploadResponse.json();
            const s3VideoUrl = uploadData.videoUrl;

            console.log("Video uploaded to S3:", s3VideoUrl);

            // Step 2: Submit video URL to backend and trigger analysis.
            const resolvedTitle = videoTitle.trim() || getDefaultTitle(file.name);
            const backendData = await videosApi.uploadLink(s3VideoUrl, resolvedTitle, token);
            await videosApi.triggerAnalysis(backendData.id);

            console.log("Video submission successful:", backendData);
            alert("วิดีโอถูกส่งและเริ่มวิเคราะห์แล้ว");

            // clean up local resources and navigate to the new video's detail page
            handleDeleteVideo();
            router.push(`/video/${backendData.id}`);
            
        } catch (error) {
            console.error("Error analyzing video:", error);
            alert(`เกิดข้อผิดพลาด: ${error instanceof Error ? error.message : "Unknown error"}`);
        } finally {
            setIsAnalyzing(false);
        }
    };

    const startRecording = async () => {
        try {

            setVideoUrl(undefined);
            setRecordedUrl(null);
            setVideoTitle("");

            const stream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true,
            });

            streamRef.current = stream;
            log("getUserMedia -> stream", stream.id, stream.getTracks().map(t => ({ id: t.id, kind: t.kind })) );

            // Ensure the preview element is mounted before assigning srcObject.
            // We set `isRecording` here so the preview <video> renders and then wait one frame.
            setIsRecording(true);
            await new Promise(requestAnimationFrame);

            if (videoPreviewRef.current) {
                // ensure video element is ready for autoplay and inline playback
                videoPreviewRef.current.muted = true;
                videoPreviewRef.current.playsInline = true;
                try {
                    videoPreviewRef.current.srcObject = stream;
                    log("Assigned preview.srcObject", { previewRef: !!videoPreviewRef.current, streamId: stream.id });
                    await videoPreviewRef.current.play();
                    log("preview.play() succeeded");
                } catch (playErr) {
                    console.warn("Preview play() failed:", playErr);
                }
            } else {
                log("Warning: preview element not found after mounting");
            }

            // Clone the stream for recording so the preview and recorder use separate tracks.
            // This avoids browser/hardware encoder conflicts that can black out the preview.
            const recordingStream = stream.clone();
            recordingStreamRef.current = recordingStream;
            log("Recording stream cloned", recordingStream.id, recordingStream.getTracks().map(t => ({ id: t.id, kind: t.kind })) );

            const mediaRecorder = new MediaRecorder(recordingStream);
            mediaRecorderRef.current = mediaRecorder;

            log("MediaRecorder created", { state: mediaRecorder.state, mimeType: (mediaRecorder as any).mimeType });

            const chunks: Blob[] = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data && event.data.size > 0) {
                    chunks.push(event.data);
                }
            };

            mediaRecorder.onstop = async () => {
                try {
                    const blob = new Blob(chunks, { type: "video/webm" });
                    const url = URL.createObjectURL(blob);

                    // ensure metadata is loaded so duration is available
                    const tmp = document.createElement("video");
                    tmp.preload = "metadata";
                    tmp.muted = true;
                    tmp.playsInline = true;
                    tmp.src = url;

                    await new Promise<void>((resolve, reject) => {
                        const onLoaded = () => {
                            cleanup();
                            resolve();
                        };
                        const onError = (e: any) => {
                            cleanup();
                            reject(e);
                        };
                        function cleanup() {
                            tmp.onloadedmetadata = null;
                            tmp.onerror = null;
                        }
                        tmp.onloadedmetadata = onLoaded;
                        tmp.onerror = onError;
                    }).catch((e) => {
                        console.warn("Failed to load recorded metadata:", e);
                    });

                    const file = new File([blob], "recorded-video.webm", {
                        type: "video/webm",
                    });

                    setFile(file);
                    setVideoTitle("recorded-video");
                    setVideoUrl(url);
                    setRecordedUrl(url);
                } finally {
                    setIsRecording(false);

                    // stop cloned recording stream tracks
                    if (recordingStreamRef.current) {
                        recordingStreamRef.current.getTracks().forEach(track => track.stop());
                        recordingStreamRef.current = null;
                    }

                    // stop original preview stream if present
                    if (streamRef.current) {
                        streamRef.current.getTracks().forEach(track => track.stop());
                    }

                    if (videoPreviewRef.current) {
                        videoPreviewRef.current.srcObject = null;
                    }
                }
            };

            // start without a timeslice so we get one blob on stop (avoids partial/streamed blobs)
            mediaRecorder.start();
            setIsRecording(true);

            console.log("Recording started");

        } catch (error) {
            console.error(error);
            alert("ไม่สามารถเข้าถึงกล้องได้");
        }
    };

const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.stop();
    }
};

// Cleanup on unmount: stop any open streams and recording.
useEffect(() => {
    return () => {
        try {
            if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
                mediaRecorderRef.current.stop();
            }

            if (recordingStreamRef.current) {
                recordingStreamRef.current.getTracks().forEach(t => t.stop());
                recordingStreamRef.current = null;
            }

            if (streamRef.current) {
                streamRef.current.getTracks().forEach(t => t.stop());
                streamRef.current = null;
            }
        } catch (e) {
            // ignore cleanup errors
        }
    };
}, []);

    return (
        <div className="min-h-screen p-8 text-white   ">
            <div className="max-w-4xl mx-auto">
                {isRecording && (
                    <div className="mb-6 bg-linear-to-r from-gray-900 to-black rounded-2xl overflow-hidden ring-1 ring-white/5">
                        <video
                            ref={videoPreviewRef}
                            autoPlay
                            muted
                            playsInline
                            className="w-full max-h-96 object-cover"
                        />
                    </div>
                )}
                {/* Video Upload Area */}
                {!videoUrl && !recordedUrl ? (
                    <div
                        onDragOver={(e) => {
                            e.preventDefault();
                            setDragActive(true);
                        }}
                        onDragLeave={() => setDragActive(false)}
                        onDrop={handleDrop}
                        className={`w-full rounded-2xl border-2 border-dashed
                        transition-all duration-300
                        ${dragActive ? "border-slate-700 bg-slate-800" : "border-slate-600 bg-slate-900"}
                        p-12 flex flex-col items-center gap-6 cursor-pointer`}
                    >
                        {/* Icon */}
                        <div className="p-6 rounded-2xl bg-slate-700">
                            <Icon
                                icon="mdi:video-outline"
                                width="40"
                                height="40"
                                className="shrink-0"
                            />
                        </div>

                        {/* Text */}
                        <p className="text-slate-300 text-center text-lg">
                            Drag and drop your video here, or
                        </p>

                        {/* Upload Buttons */}
                        <div className="flex gap-4">
                            <label className="cursor-pointer inline-flex items-center gap-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-100 px-5 py-2 rounded-md font-semibold shadow-sm transition focus:outline-none focus:ring-2 focus:ring-sky-500">
                                <span>Choose Video File</span>
                                <input
                                    type="file"
                                    accept="video/*"
                                    onChange={handleFileChange}
                                    className="hidden"
                                />
                            </label>

                            {!isRecording ? (
                                <button
                                    onClick={startRecording}
                                    className="bg-rose-600 hover:bg-rose-700 text-white px-6 py-2 rounded-md font-semibold shadow-md transition"
                                >
                                    <Icon icon="mdi:video-plus" width="20" height="20" className="inline mr-2" />
                                    Record Video
                                </button>
                            ) : (
                                <button
                                    onClick={stopRecording}
                                    className="bg-rose-600 hover:bg-rose-700 text-white px-6 py-2 rounded-md font-semibold shadow-md transition"
                                >
                                    <Icon icon="mdi:stop-circle" width="20" height="20" className="inline mr-2" />
                                    Stop Recording
                                </button>
                            )}
                        </div>

                        <p className="text-sm text-slate-400">
                            Supports .mp4, .webm, .ogg, and .mov formats
                        </p>
                    </div>
                ) : (
                    /* Video Display Area */
                    <div className="space-y-6">
                        {/* Video Player */}
                        <div className="bg-black rounded-2xl overflow-hidden">
                            <video
                                src={videoUrl || recordedUrl || undefined}
                                controls
                                className="w-full h-auto max-h-96"
                            />
                        </div>

                        {/* Video Info and Action Buttons */}
                        <div className="bg-greay-custom rounded-2xl p-6">
                            <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                                <div className="flex-1">
                                    {/* <h2 className="text-xl font-semibold mb-2">
                                        {videoTitle || file?.name}
                                    </h2> */}
                                    <div className="mb-3">
                                        <label className="mb-1 block text-sm text-slate-300">Video title</label>
                                        <input
                                            type="text"
                                            value={videoTitle}
                                            onChange={(e) => setVideoTitle(e.target.value)}
                                            placeholder="ตั้งชื่อวิดีโอก่อนส่งออก"
                                            className="w-full md:max-w-md rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
                                        />
                                    </div>
                                    {file && (
                                        <p className="text-slate-400 text-sm">
                                            ขนาดไฟล์: {(file.size / (1024 * 1024)).toFixed(2)} MB
                                        </p>
                                    )}
                                </div>
                                <div className="flex flex-wrap flex-col gap-3">
                                    <div className="text-center">ยืนยันการตรวจสอบ?</div>
                                    <div className="flex gap-4">
                                        <button
                                            onClick={handleStartAnalysis}
                                            disabled={isAnalyzing}
                                            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white disabled:bg-gray-600 disabled:cursor-not-allowed px-4 py-2 rounded-md font-semibold shadow transition"
                                        >
                                            <Icon
                                                icon="mdi:check-circle-outline"
                                                width="20"
                                                height="20"
                                            />
                                            {isAnalyzing ? "กำลังประมวลผล..." : "ตกลง"}
                                        </button>

                                        {/* Cancel/Remove */}
                                        <button
                                            onClick={handleDeleteVideo}
                                            disabled={isAnalyzing}
                                            className="flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white disabled:bg-gray-600 disabled:cursor-not-allowed px-4 py-2 rounded-md font-semibold shadow transition"
                                        >
                                            <Icon
                                                icon="mdi:close-circle-outline"
                                                width="20"
                                                height="20"
                                            />
                                            ยกเลิก
                                        </button>
                                    </div>
                                </div>

                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}