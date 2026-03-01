"use client";
import React, { useState } from "react";
import { Icon } from "@iconify/react";

export default function MainPage() {
    const [file, setFile] = useState<File | null>(null);
    const [videoUrl, setVideoUrl] = useState<string | null>(null);
    const [dragActive, setDragActive] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    const handleFile = (selectedFile: File) => {
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
        setFile(null);
        if (videoUrl) {
            URL.revokeObjectURL(videoUrl);
        }
        setVideoUrl(null);
        setIsAnalyzing(false);
    };

    const handleStartAnalysis = async () => {
        if (!file) return;

        setIsAnalyzing(true);
        try {
            // TODO: ส่งวิดีโอไปยัง backend API
            console.log("Starting analysis for:", file.name);
            // const formData = new FormData();
            // formData.append("video", file);
            // const response = await fetch("/api/analyze", {
            //     method: "POST",
            //     body: formData,
            // });
        } catch (error) {
            console.error("Error analyzing video:", error);
            alert("เกิดข้อผิดพลาดในการวิเคราะห์วิดีโอ");
        } finally {
            setIsAnalyzing(false);
        }
    };

    return (
        <div className="min-h-screen p-8 text-white   ">
            <div className="max-w-4xl mx-auto">
               
                {/* Video Upload Area */}
                {!videoUrl ? (
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

                        {/* Upload Button */}
                        <label className="cursor-pointer bg-slate-700 hover:bg-blue-950 px-6 py-2 rounded-lg font-semibold transition">
                            Choose Video File
                            <input
                                type="file"
                                accept="video/*"
                                onChange={handleFileChange}
                                className="hidden"
                            />
                        </label>

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
                                src={videoUrl}
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
                                    <p className="text-slate-400 text-sm">
                                        ขนาดไฟล์: {(file!.size / (1024 * 1024)).toFixed(2)} MB
                                    </p>
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