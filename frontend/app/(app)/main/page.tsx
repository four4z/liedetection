"use client";
import React, { useState, useRef, useEffect } from "react";
import { Icon } from "@iconify/react";
import { videosApi } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface MediaDeviceInfo {
    deviceId: string;
    label: string;
}

export default function Main() {
    const [file, setFile] = useState<File | null>(null);
    const [videoTitle, setVideoTitle] = useState("");
    const [videoUrl, setVideoUrl] = useState<string | undefined>(undefined);
    const [dragActive, setDragActive] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
    const [showCameraModal, setShowCameraModal] = useState(false);
    const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
    const [selectedCameraId, setSelectedCameraId] = useState<string>("");
    const [audioLevel, setAudioLevel] = useState(0);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const recordingStreamRef = useRef<MediaStream | null>(null);
    const videoPreviewRef = useRef<HTMLVideoElement | null>(null);
    const cameraPreviewRef = useRef<HTMLVideoElement | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const animationFrameRef = useRef<number | null>(null);
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
            toast.error("รองรับเฉพาะไฟล์วิดีโอ (.mp4, .webm, .ogg, .mov) เท่านั้น");
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
            // Step 1: Ask the app for a presigned S3 upload URL.
            console.log("Requesting presigned upload URL for:", file.name);
            const uploadData = await videosApi.getUploadUrl(file.name, file.type);

            // Step 2: Upload the file directly from the browser to S3.
            const formData = new FormData();
            Object.entries(uploadData.fields).forEach(([key, value]) => {
                formData.append(key, value);
            });
            formData.append("file", file);

            const uploadResponse = await fetch(uploadData.uploadUrl, {
                method: "POST",
                body: formData,
            });

            if (!uploadResponse.ok) {
                throw new Error(`Failed to upload video to S3 (${uploadResponse.status})`);
            }

            console.log("Video uploaded to S3:", uploadData.videoUrl);

            // Step 3: Submit video URL to backend and trigger analysis.
            const resolvedTitle = videoTitle.trim() || getDefaultTitle(file.name);
            const backendData = await videosApi.uploadLink(uploadData.videoUrl, resolvedTitle, token);
            await videosApi.triggerAnalysis(backendData.id, token);

            console.log("Video submission successful:", backendData);
            toast.success("วิดีโอถูกส่งและเริ่มวิเคราะห์แล้ว");

            // clean up local resources and navigate to the new video's detail page
            handleDeleteVideo();
            router.push(`/video/${backendData.id}`);
            
        } catch (error) {
            console.error("Error analyzing video:", error);
            toast.error(`เกิดข้อผิดพลาด: ${error instanceof Error ? error.message : "Unknown error"}`);
        } finally {
            setIsAnalyzing(false);
        }
    };

    const enumerateCameras = async () => {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoDevices = devices.filter(device => device.kind === 'videoinput');
            
            if (videoDevices.length === 0) {
                toast.error("ไม่พบกล้องบนอุปกรณ์นี้");
                return;
            }

            const cameras: MediaDeviceInfo[] = videoDevices.map(device => ({
                deviceId: device.deviceId,
                label: device.label || `Camera ${videoDevices.indexOf(device) + 1}`,
            }));

            setAvailableCameras(cameras);
            setSelectedCameraId(cameras[0].deviceId);
            setShowCameraModal(true);
        } catch (error) {
            console.error("Error enumerating cameras:", error);
            toast.error("ไม่สามารถค้นหากล้องได้");
        }
    };

    const startAudioLevelMonitoring = (stream: MediaStream) => {
        try {
            if (!audioContextRef.current) {
                audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
            }
            const audioContext = audioContextRef.current;

            if (!analyserRef.current) {
                analyserRef.current = audioContext.createAnalyser();
            }
            const analyser = analyserRef.current;
            analyser.fftSize = 256;

            const source = audioContext.createMediaStreamSource(stream);
            source.connect(analyser);

            const dataArray = new Uint8Array(analyser.frequencyBinCount);

            const updateLevel = () => {
                analyser.getByteFrequencyData(dataArray);
                const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
                setAudioLevel(average);
                animationFrameRef.current = requestAnimationFrame(updateLevel);
            };

            updateLevel();
        } catch (error) {
            console.error("Error setting up audio monitoring:", error);
        }
    };

    const stopAudioLevelMonitoring = () => {
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
        }
        setAudioLevel(0);
    };

    const startRecording = async (cameraId?: string) => {
        try {

            setVideoUrl(undefined);
            setRecordedUrl(null);
            setVideoTitle("");
            setShowCameraModal(false);

            const constraints: any = {
                video: cameraId ? { deviceId: { exact: cameraId } } : true,
                audio: true,
            };

            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            
            // Start audio level monitoring
            startAudioLevelMonitoring(stream);

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
            toast.error("ไม่สามารถเข้าถึงกล้องได้");
        }
    };

const stopRecording = () => {
    stopAudioLevelMonitoring();
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.stop();
    }
};

// Manage camera preview while the selection modal is open
useEffect(() => {
    let previewStream: MediaStream | null = null;

    const startPreview = async () => {
        try {
            if (!showCameraModal) return;

            const deviceId = selectedCameraId || (availableCameras[0] && availableCameras[0].deviceId) || undefined;
            const constraints: any = {
                video: deviceId ? { deviceId: { exact: deviceId } } : true,
                audio: false,
            };

            previewStream = await navigator.mediaDevices.getUserMedia(constraints);
            if (cameraPreviewRef.current) {
                cameraPreviewRef.current.muted = true;
                cameraPreviewRef.current.playsInline = true;
                cameraPreviewRef.current.srcObject = previewStream;
                try { await cameraPreviewRef.current.play(); } catch { /* ignore */ }
            }
        } catch (err) {
            console.warn('Camera preview unavailable', err);
        }
    };

    if (showCameraModal) {
        startPreview();
    }

    return () => {
        if (previewStream) {
            previewStream.getTracks().forEach(t => t.stop());
            previewStream = null;
        }
        if (cameraPreviewRef.current) {
            try { cameraPreviewRef.current.srcObject = null; } catch {}
        }
    };
}, [showCameraModal, selectedCameraId, availableCameras]);

// Cleanup on unmount: stop any open streams and recording.
useEffect(() => {
    return () => {
        try {
            stopAudioLevelMonitoring();
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

            if (audioContextRef.current) {
                audioContextRef.current.close();
                audioContextRef.current = null;
            }
        } catch (e) {
            // ignore cleanup errors
        }
    };
}, []);

    return (
        <div className="min-h-screen  p-8 text-white">
            <div className="max-w-5xl mx-auto">
                {/* Recording Preview */}
                {isRecording && (
                    <div className="mb-6 bg-linear-to-r from-gray-900 to-black rounded-2xl overflow-hidden ring-1 ring-white/5">
                        <video
                            ref={videoPreviewRef}
                            autoPlay
                            muted
                            playsInline
                            className="w-full max-h-96 object-cover bg-black"
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
                        ${isRecording ? "border-transparent bg-transparent" : dragActive ? "border-slate-600 bg-slate-800/60" : "border-slate-700 bg-slate-900/40"}
                        p-12 flex flex-col items-center gap-6 cursor-pointer`}
                    >
                        {isRecording ? (
                            <div className="flex flex-col items-center justify-center gap-5 py-10">
                                <div className="relative flex items-center justify-center">
                                    <span className="absolute h-20 w-20 rounded-full bg-rose-500/25 animate-ping" />
                                    <span className="absolute h-24 w-24 rounded-full border border-rose-400/20" />
                                    <button
                                        onClick={stopRecording}
                                        aria-label="Stop recording"
                                        className="relative cursor-pointer flex h-20 w-20 items-center justify-center rounded-full bg-rose-600 text-white shadow-[0_0_0_8px_rgba(244,63,94,0.12)] transition-transform duration-200 hover:scale-105 active:scale-95"
                                    >
                                        <Icon icon="mdi:stop" width="34" height="34" />
                                    </button>
                                </div>
                                <div className="text-center">
                                    <p className="text-xl font-semibold text-slate-100">Recording...</p>
                                    <p className="mt-1 text-sm text-slate-400">กดปุ่มวงกลมเพื่อหยุดอัด</p>
                                    
                                    {/* Microphone Audio Indicator */}
                                    <div className="mt-6 flex flex-col items-center gap-3">
                                        <div className="flex items-center justify-center gap-1">
                                            {[...Array(5)].map((_, i) => (
                                                <div
                                                    key={i}
                                                    className="w-1.5 rounded-full bg-green-500 transition-all duration-75"
                                                    style={{
                                                        height: `${Math.max(8, (audioLevel / 255) * 32 * (1 - i * 0.15))}px`,
                                                        opacity: audioLevel > 10 ? 1 : 0.4,
                                                    }}
                                                />
                                            ))}
                                        </div>
                                        <div className="flex items-center gap-2 mt-2">
                                            <Icon
                                                icon="mdi:microphone"
                                                width="20"
                                                height="20"
                                                className={audioLevel > 20 ? "text-green-400" : "text-slate-400"}
                                            />
                                            <span className="text-xs font-medium text-slate-300">
                                                {audioLevel > 20 ? "เสียงที่ตรวจพบ" : "รอเสียง..."}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <>
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

                                    <button
                                        onClick={enumerateCameras}
                                        className="bg-rose-600 hover:bg-rose-700 text-white px-6 py-2 cursor-pointer rounded-md font-semibold shadow-md transition"
                                    >
                                        <Icon icon="mdi:video-plus" width="20" height="20" className="inline mr-2" />
                                        Record Video
                                    </button>
                                </div>

                                <p className="text-sm text-slate-400">
                                    Supports .mp4, .webm, .ogg, and .mov formats
                                </p>
                            </>
                        )}
                    </div>
                ) : (
                    /* Video Display Area */
                    <div className="w-full max-w-4xl aspect-video">
                        {/* Main Video Panel */}
                        <div className="flex flex-col gap-4">
                            {/* Video Player */}
                            <div className="rounded-2xl border border-slate-700/50 overflow-hidden bg-black">
                                <video
                                    src={videoUrl || recordedUrl || undefined}
                                    controls
                                    className="w-full h-auto max-h-96"
                                />
                            </div>

                            {/* Status Strip */}
                            <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-slate-900/50 border border-slate-700/30">
                                <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
                                <p className="text-xs text-slate-400 ">ไฟล์วิดีโอ mp4, webm, ogg, mov</p>
                                <span className="ml-auto text-xs text-slate-500 font-mono">
                                    {file ? (file.size / (1024 * 1024)).toFixed(2) + " MB" : "—"}
                                </span>
                            </div>

                            {/* Title and Confirm */}
                            <div className="rounded-xl border border-slate-700/50 bg-slate-900/30 p-5 space-y-4">
                                <div>
                                    <label className="mb-2 block text-sm font-medium text-slate-300">Video title</label>
                                    <input
                                        type="text"
                                        value={videoTitle}
                                        onChange={(e) => setVideoTitle(e.target.value)}
                                        placeholder="ตั้งชื่อวิดีโอก่อนส่งออก"
                                        className="w-full rounded-lg border border-slate-700 bg-slate-900/60 px-4 py-2.5 text-white placeholder:text-slate-500 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 outline-none transition"
                                    />
                                </div>
                                <div className="flex items-end justify-between gap-4">
                                    <div className="text-sm font-medium text-slate-300"></div>
                                    <div className="flex gap-2.5">
                                        <button
                                            onClick={handleStartAnalysis}
                                            disabled={isAnalyzing}
                                            className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm transition disabled:cursor-not-allowed disabled:bg-gray-600"
                                        >
                                            <Icon icon="mdi:check-circle-outline" width="16" height="16" />
                                            {isAnalyzing ? "กำลังประมวลผล..." : "ตกลง"}
                                        </button>
                                        <button
                                            onClick={handleDeleteVideo}
                                            disabled={isAnalyzing}
                                            className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold text-sm transition disabled:cursor-not-allowed disabled:bg-gray-600"
                                        >
                                            <Icon icon="mdi:close-circle-outline" width="16" height="16" />
                                            ยกเลิก
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>


                    </div>
                )}

            {/* Camera Selection Modal */}
            {showCameraModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="rounded-2xl  bg-greay-custom p-6 shadow-2xl max-w-3xl w-full mx-4">
                        <div className="mb-6">
                            <h2 className="text-xl font-bold text-white mb-2">เลือกกล้อง</h2>
                            <p className="text-sm text-slate-400">เลือกกล้องที่คุณต้องการใช้ในการบันทึก</p>
                        </div>

                            {/* Camera Selection with Preview */}
                            <div className="mb-6 flex gap-6">
                                <div className="w-1/2 bg-black/60 rounded-lg p-2 flex items-center justify-center">
                                    <video ref={cameraPreviewRef} className="w-full h-48 object-cover rounded-md bg-black" />
                                </div>

                                <div className="w-1/2 space-y-2">
                                    {availableCameras.length > 0 ? (
                                        availableCameras.map((camera) => (
                                            <label key={camera.deviceId} className={`flex items-center gap-3 p-3 rounded-lg bg-black/30 cursor-pointer hover:bg-black/20 transition ${selectedCameraId===camera.deviceId? 'ring-2 ring-blue-400':''}`}>
                                                <input
                                                    type="radio"
                                                    name="camera"
                                                    value={camera.deviceId}
                                                    checked={selectedCameraId === camera.deviceId}
                                                    onChange={(e) => setSelectedCameraId(e.target.value)}
                                                    className="w-4 h-4"
                                                />
                                                <span className="text-sm text-slate-200">{camera.label}</span>
                                            </label>
                                        ))
                                    ) : (
                                        <p className="text-sm text-slate-400">ไม่พบกล้องที่ใช้ได้</p>
                                    )}
                                </div>
                            </div>

                        {/* Confirmation Message */}
                        <div className="mb-6 p-3 rounded-lg bg-black/30 ">
                            <p className="text-xs text-slate-300">
                                <Icon icon="mdi:information-outline" className="inline mr-2" width="16" height="16" />
                                เมื่อคุณคลิก "เริ่มบันทึก" การบันทึกวิดีโอจะเริ่มต้นขึ้น
                            </p>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex  gap-3">
                            <button
                                onClick={() => setShowCameraModal(false)}
                                className="flex-1 px-4 py-2.5 rounded-lg  bg-gray-700/50 hover:bg-gray-700 text-slate-200 font-semibold text-sm transition"
                            >
                                ยกเลิก
                            </button>
                            <button
                                onClick={() => startRecording(selectedCameraId)}
                                disabled={!selectedCameraId}
                                className="flex-1 px-4 py-2.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold text-sm transition disabled:bg-gray-600 disabled:cursor-not-allowed"
                            >
                                <Icon icon="mdi:record-circle" className="inline mr-2" width="16" height="16" />
                                เริ่มบันทึก
                            </button>
                        </div>
                    </div>
                </div>
            )}
            </div>
        </div>
    );
}