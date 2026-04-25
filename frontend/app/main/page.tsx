"use client";
import React, { useState, useRef } from "react";
import { Icon } from "@iconify/react";
import { videosApi } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function Main() {
    const [file, setFile] = useState<File | null>(null);
    const [videoUrl, setVideoUrl] = useState<string | undefined>(undefined);
    const [dragActive, setDragActive] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const videoPreviewRef = useRef<HTMLVideoElement | null>(null);
    const { token } = useAuth();

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
    if (videoUrl) {
        URL.revokeObjectURL(videoUrl);
    }

    if (recordedUrl) {
        URL.revokeObjectURL(recordedUrl);
    }

    if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
    }

    mediaRecorderRef.current = null;
    streamRef.current = null;

    setFile(null);
    setVideoUrl(undefined);
    setRecordedUrl(null);
    setIsRecording(false);
    setIsAnalyzing(false);
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
            const backendData = await videosApi.uploadLink(s3VideoUrl, file.name, token);
            await videosApi.triggerAnalysis(backendData.id);

            console.log("Video submission successful:", backendData);
            alert("วิดีโอถูกส่งและเริ่มวิเคราะห์แล้ว");

            handleDeleteVideo();
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

            const stream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true,
            });

            streamRef.current = stream;

            if (videoPreviewRef.current) {
                videoPreviewRef.current.srcObject = stream;
                await videoPreviewRef.current.play();
            }

            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;

            const chunks: Blob[] = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    chunks.push(event.data);
                }
            };

            mediaRecorder.onstop = () => {

                const blob = new Blob(chunks, { type: "video/webm" });
                const url = URL.createObjectURL(blob);

                const file = new File([blob], "recorded-video.webm", {
                    type: "video/webm",
                });

                setFile(file);
                setVideoUrl(url);

                setRecordedUrl(url);

                setIsRecording(false);

                // stop stream หลัง record เสร็จ
                if (streamRef.current) {
                    streamRef.current.getTracks().forEach(track => track.stop());
                }

                if (videoPreviewRef.current) {
                    videoPreviewRef.current.srcObject = null;
                }
            };

            mediaRecorder.start(1000);
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

    return (
        <div className="min-h-screen p-8 text-white   ">
            <div className="max-w-4xl mx-auto">
                {isRecording && (
                    <div className="mb-6 bg-black rounded-2xl overflow-hidden">
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
                            <label className="cursor-pointer bg-slate-700 hover:bg-blue-950 px-6 py-2 rounded-lg font-semibold transition">
                                Choose Video File
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
                                    className="bg-red-600 hover:bg-red-700 px-6 py-2 rounded-lg font-semibold transition"
                                >
                                    <Icon icon="mdi:video-plus" width="20" height="20" className="inline mr-2" />
                                    Record Video
                                </button>
                            ) : (
                                <button
                                    onClick={stopRecording}
                                    className="bg-red-800 hover:bg-red-900 px-6 py-2 rounded-lg font-semibold transition"
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
                                    <h2 className="text-xl font-semibold mb-2">
                                        {file?.name}
                                    </h2>
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
                                            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed px-4 py-2 rounded-lg font-semibold transition"
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
                                            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed px-4 py-2 rounded-lg font-semibold transition"
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