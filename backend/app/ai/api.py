import os
import math
import shutil
import numpy as np
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import JSONResponse

# Import Configurations & Utilities
from app.ai.config import TEMP_SUBCLIP, TEMP_ROOT, TEMP_FRAMES
from app.ai.utils.file_utils import setup_temp_dirs, cleanup_temp_dirs, final_cleanup
from app.ai.utils.audio_utils import get_audio_timestamps
from app.ai.utils.video_utils import create_subclip, extract_and_crop_roi, download_video, reset_identity_bank, advance_segment, clear_gpu_cache
from app.ai.utils.openpose_utils import run_openpose
from app.ai.inference.predictor import load_model_and_config, infer_segment

router = APIRouter()

# --- Lazy-loaded model globals ---
_global_model = None
_global_config = None


def _ensure_model_loaded():
    """Load model once on first inference call, then cache globally."""
    global _global_model, _global_config
    if _global_model is None or _global_config is None:
        print("Lazy-loading PyTorch models into memory...")
        _global_model, _global_config = load_model_and_config(
            manual_seq_len=None, manual_threshold=None
        )
        print("Models successfully loaded and ready for inference.")


@router.post("/analyze-video")
async def analyze_video(
    file: UploadFile = File(None),
    video_url: str = Form(None)
):
    _ensure_model_loaded()

    setup_temp_dirs()
    reset_identity_bank()  # wipe identity state from any previous video

    # Hardcode a safe, space-free filename for FFmpeg
    temp_video_path = os.path.join(TEMP_ROOT, "target_video.mp4")

    try:
        if video_url:
            download_video(video_url, temp_video_path)
        elif file:
            ext = Path(file.filename).suffix.lower()
            if ext not in ('.mp4', '.avi', '.mov', '.webm'):
                raise HTTPException(status_code=400, detail="Invalid file type. Allowed: .mp4, .avi, .mov, .webm")

            file_bytes = await file.read()

            if ext == '.webm':
                # Save as .webm first, then transcode to .mp4 for pipeline compatibility
                import moviepy.editor as _mp
                temp_webm = temp_video_path.replace('.mp4', '.webm')
                with open(temp_webm, "wb") as f:
                    f.write(file_bytes)
                print(f"[api] Transcoding uploaded .webm → .mp4…")
                with _mp.VideoFileClip(temp_webm) as clip:
                    clip.write_videofile(temp_video_path, codec="libx264",
                                         audio_codec="aac", logger=None)
                os.remove(temp_webm)
            else:
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
        threshold = _global_config['SIGMOID_THRESHOLD']

        def format_conf(p, thresh):
            display_p = p if p > thresh else (1.0 - p)
            return round(display_p, 4)

        def fmt_ts(sec):
            """Convert seconds to HH:MM:SS string."""
            total = int(math.floor(sec))
            h, m, s = total // 3600, (total % 3600) // 60, total % 60
            return f"{h:02d}:{m:02d}:{s:02d}"

        for start_sec, end_sec in segments:
            advance_segment()  # increment segment counter for appearance logging
            cleanup_temp_dirs()

            create_subclip(temp_video_path, TEMP_SUBCLIP, start_sec, end_sec)
            run_openpose(TEMP_SUBCLIP)
            valid_frames = extract_and_crop_roi(TEMP_SUBCLIP)
            clear_gpu_cache()  # release FaceNet VRAM before next OpenPose run

            if valid_frames == 0:
                continue

            result = infer_segment(_global_model, _global_config)

            if result is not None:
                segment_strongest_probs.append(result["strongest_confidence_score"])

                segment_data = {
                    "timestamp":                        f"{fmt_ts(start_sec)}–{fmt_ts(end_sec)}",
                    "face_confidence_score":            format_conf(result["face_confidence_score"], threshold),
                    "face_verdict":                     result["face_verdict"],
                    "arms_confidence_score":            format_conf(result["arms_confidence_score"], threshold),
                    "arms_verdict":                     result["arms_verdict"],
                    "average_confidence_score_segment": format_conf(result["average_confidence_score_segment"], threshold),
                    "verdict":                          result["verdict"],
                    "parts_indicate":                   result["parts_indicate"],
                    "average_based_verdict":            result["average_based_verdict"],
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