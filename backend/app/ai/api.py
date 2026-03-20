import os
import shutil
import numpy as np
import base64
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import JSONResponse

# Import Configurations & Utilities
from config import TEMP_SUBCLIP, TEMP_ROOT, TEMP_FRAMES
from utils.file_utils import setup_temp_dirs, cleanup_temp_dirs, final_cleanup
from utils.audio_utils import get_audio_timestamps
from utils.video_utils import create_subclip, extract_and_crop_roi, download_video, reset_identity_bank, advance_segment, clear_gpu_cache
from utils.openpose_utils import run_openpose
from inference.predictor import load_model_and_config, infer_segment

app = FastAPI(title="Deception Detection API", description="Multimodal Face & Arms Inference")

global_model = None
global_config = None

@app.on_event("startup")
def startup_event():
    global global_model, global_config
    print("Starting API Server: Loading PyTorch Models into memory...")
    global_model, global_config = load_model_and_config(manual_seq_len=None, manual_threshold=None)
    print("Models successfully loaded and ready for inference.")

@app.post("/analyze-video")
async def analyze_video(
    file: UploadFile = File(None),
    video_url: str = Form(None)
):
    setup_temp_dirs()
    reset_identity_bank()  # wipe identity state from any previous video

    # Hardcode a safe, space-free filename for FFmpeg
    temp_video_path = os.path.join(TEMP_ROOT, "target_video.mp4")

    try:
        if video_url:
            download_video(video_url, temp_video_path)
        elif file:
            if not file.filename.lower().endswith(('.mp4', '.avi', '.mov')):
                raise HTTPException(status_code=400, detail="Invalid file type. Please upload a video.")

            file_bytes = await file.read()
            with open(temp_video_path, "wb") as f:
                f.write(file_bytes)
        else:
            raise HTTPException(status_code=400, detail="Provide either a file or a video URL")

        video_source_name = video_url if video_url else file.filename

        segments = get_audio_timestamps(temp_video_path)

        json_report = {
            "video": video_source_name,
            "segments": [],
            "summary": {}
        }

        segment_strongest_probs = []
        threshold = global_config['SIGMOID_THRESHOLD']

        def format_conf(p, thresh):
            display_p = p if p > thresh else (1.0 - p)
            return round(display_p, 4)

        for start_sec, end_sec in segments:
            advance_segment()  # increment segment counter for appearance logging
            cleanup_temp_dirs()

            create_subclip(temp_video_path, TEMP_SUBCLIP, start_sec, end_sec)
            run_openpose(TEMP_SUBCLIP)
            valid_frames = extract_and_crop_roi(TEMP_SUBCLIP)
            clear_gpu_cache()  # release FaceNet VRAM before next OpenPose run

            if valid_frames == 0:
                continue

            result = infer_segment(global_model, global_config)

            if result is not None:
                segment_strongest_probs.append(result["strongest_confidence_score"])

                # GRAB A REPRESENTATIVE UPPER-BODY FRAME AND ENCODE TO BASE64
                face_b64 = None
                upper_dir = os.path.join(TEMP_FRAMES, "upper")
                if os.path.exists(upper_dir):
                    upper_frames = sorted([f for f in os.listdir(upper_dir) if f.endswith('.jpg')])
                    if upper_frames:
                        mid_idx = len(upper_frames) // 2
                        frame_path = os.path.join(upper_dir, upper_frames[mid_idx])
                        with open(frame_path, "rb") as img_file:
                            face_b64 = base64.b64encode(img_file.read()).decode('utf-8')

                segment_data = {
                    "timestamp":                       f"{start_sec:.2f}",
                    "raw_timestamp":                   round(float(start_sec), 3),
                    "face_confidence_score":           format_conf(result["face_confidence_score"], threshold),
                    "face_verdict":                    result["face_verdict"],
                    "arms_confidence_score":           format_conf(result["arms_confidence_score"], threshold),
                    "arms_verdict":                    result["arms_verdict"],
                    "average_confidence_score_segment": format_conf(result["average_confidence_score_segment"], threshold),
                    "verdict":                         result["verdict"],
                    "parts_indicate":                  result["parts_indicate"],
                    "average_based_verdict":           result["average_based_verdict"],
                    "face_image_b64":                  face_b64,
                }
                json_report["segments"].append(segment_data)

        if segment_strongest_probs:
            avg_prob = np.mean(segment_strongest_probs)
            final_verdict = "LIE" if avg_prob > threshold else "TRUTH"
            display_avg_prob = float(avg_prob if final_verdict == "LIE" else (1.0 - avg_prob))

            json_report["summary"] = {
                "average_confidence_score":   round(display_avg_prob, 4),
                "final_verdict":              final_verdict,
                "total_segments_analyzed":    len(segment_strongest_probs)
            }
        else:
            json_report["summary"] = {"error": "Could not analyze any valid segments."}

    except Exception as e:
        final_cleanup()
        raise HTTPException(status_code=500, detail=str(e))

    finally:
        final_cleanup()
        if os.path.exists(temp_video_path):
            try:
                os.remove(temp_video_path)
            except:
                pass

    return JSONResponse(content=json_report)