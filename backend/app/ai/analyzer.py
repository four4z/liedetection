"""
analyzer.py — Async background task for lie-detection video analysis.

Called by `backend/app/api/videos.py` via BackgroundTasks:
    background_tasks.add_task(analyze_video, video_id)

Pipeline:
  1. Load video document from MongoDB.
  2. Download the video from `video_url`.
  3. Compute video duration (HH:MM:SS).
  4. Extract a thumbnail frame and upload it to AWS S3 → thumbnail_url.
  5. Run Silero-VAD segmentation → OpenPose → FaceNet → LSTM inference.
  6. Build new-format result JSON (no face_image_b64, no raw_timestamp).
  7. Persist result back to the videos collection and set analysis_status.
"""

import os
import math
import numpy as np
import boto3
import requests as _requests
import moviepy.editor as mp
from datetime import datetime, timezone
from pathlib import Path
from bson import ObjectId
from dotenv import load_dotenv

# ---- Load AWS credentials from database/.env ----
_env_path = Path(__file__).parent.parent / "database" / ".env"
load_dotenv(dotenv_path=_env_path)

AWS_ACCESS_KEY        = os.getenv("AWS_ACCESS_KEY")
AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY")
AWS_BUCKET_NAME       = os.getenv("AWS_BUCKET_NAME")
AWS_BUCKET_REGION     = os.getenv("AWS_BUCKET_REGION", "ap-southeast-2")

# ---- AI pipeline imports ----
from app.ai.config import TEMP_SUBCLIP, TEMP_ROOT, TEMP_FRAMES
from app.ai.utils.file_utils import setup_temp_dirs, cleanup_temp_dirs, final_cleanup
from app.ai.utils.audio_utils import get_audio_timestamps
from app.ai.utils.video_utils import (
    create_subclip, extract_and_crop_roi, download_video,
    reset_identity_bank, advance_segment, clear_gpu_cache,
)
from app.ai.utils.openpose_utils import run_openpose
from app.ai.inference.predictor import load_model_and_config, infer_segment

# ---- Database ----
from app.database.connection import get_videos_collection

# ---- Lazy-loaded model globals (shared with api.py if loaded first) ----
_global_model  = None
_global_config = None


def _ensure_model_loaded():
    """Load model once on first call, then cache globally."""
    global _global_model, _global_config
    if _global_model is None or _global_config is None:
        print("[analyzer] Lazy-loading PyTorch models into memory…")
        _global_model, _global_config = load_model_and_config(
            manual_seq_len=None, manual_threshold=None
        )
        print("[analyzer] Models loaded and ready.")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

# Formats supported natively through the pipeline.
# WebM is handled by downloading first then transcoding to MP4.
_WEBM_EXTENSIONS = {".webm"}


def _seconds_to_hhmmss(total_seconds: float) -> str:
    """Convert a float number of seconds to 'HH:MM:SS' string."""
    total_seconds = int(math.floor(total_seconds))
    h = total_seconds // 3600
    m = (total_seconds % 3600) // 60
    s = total_seconds % 60
    return f"{h:02d}:{m:02d}:{s:02d}"


def _format_timestamp_range(start_sec: float, end_sec: float) -> str:
    """Return a readable segment range like '00:00:05–00:00:10'."""
    return f"{_seconds_to_hhmmss(start_sec)}–{_seconds_to_hhmmss(end_sec)}"


def _format_conf(p: float, thresh: float) -> float:
    """Display confidence: show distance from whichever side of the threshold we're on."""
    display_p = p if p > thresh else (1.0 - p)
    return round(display_p, 4)


def _get_video_duration(video_path: str) -> str:
    """Return video duration as 'HH:MM:SS' using moviepy."""
    with mp.VideoFileClip(video_path) as clip:
        return _seconds_to_hhmmss(clip.duration)


def _is_webm_url(url: str) -> bool:
    """Return True if the URL path ends with .webm (case-insensitive)."""
    from urllib.parse import urlparse
    path = urlparse(url).path
    return Path(path).suffix.lower() in _WEBM_EXTENSIONS


def _download_video_raw(url: str, dest_path: str) -> None:
    """
    Stream-download a video URL to *dest_path*.
    Preserves whatever container the server sends — no extension coercion.
    """
    print(f"[analyzer] Downloading video from {url}…")
    with _requests.get(url, stream=True, timeout=120) as r:
        r.raise_for_status()
        with open(dest_path, "wb") as f:
            for chunk in r.iter_content(chunk_size=65536):
                f.write(chunk)


def _transcode_to_mp4(src_path: str, dst_path: str) -> None:
    """
    Re-encode *src_path* (any moviepy-readable container, e.g. .webm)
    to a plain H.264/AAC .mp4 at *dst_path*.
    The source file is removed after a successful transcode.
    """
    print(f"[analyzer] Transcoding {Path(src_path).suffix} → .mp4 …")
    with mp.VideoFileClip(src_path) as clip:
        clip.write_videofile(
            dst_path,
            codec="libx264",
            audio_codec="aac",
            logger=None,
        )
    os.remove(src_path)
    print(f"[analyzer] Transcode complete → {dst_path}")


def _extract_thumbnail_frame(video_path: str) -> bytes | None:
    """
    Extract a single frame from the middle of the video and return it as
    JPEG bytes.  Returns None if extraction fails.
    """
    try:
        with mp.VideoFileClip(video_path) as clip:
            mid_time = clip.duration / 2.0
            frame = clip.get_frame(mid_time)   # numpy (H, W, 3) RGB uint8
        import cv2
        bgr = cv2.cvtColor(frame, cv2.COLOR_RGB2BGR)
        success, buf = cv2.imencode(".jpg", bgr, [cv2.IMWRITE_JPEG_QUALITY, 85])
        return buf.tobytes() if success else None
    except Exception as e:
        print(f"[analyzer] Thumbnail extraction failed: {e}")
        return None


def _upload_thumbnail_to_s3(jpeg_bytes: bytes, object_key: str) -> str | None:
    """
    Upload JPEG bytes to S3 and return the public HTTPS URL.
    Returns None on failure.
    """
    try:
        s3 = boto3.client(
            "s3",
            region_name=AWS_BUCKET_REGION,
            aws_access_key_id=AWS_ACCESS_KEY,
            aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
        )
        s3.put_object(
            Bucket=AWS_BUCKET_NAME,
            Key=object_key,
            Body=jpeg_bytes,
            ContentType="image/jpeg",
        )
        url = f"https://{AWS_BUCKET_NAME}.s3.{AWS_BUCKET_REGION}.amazonaws.com/{object_key}"
        print(f"[analyzer] Thumbnail uploaded → {url}")
        return url
    except Exception as e:
        print(f"[analyzer] S3 upload failed: {e}")
        return None


# ---------------------------------------------------------------------------
# Main pipeline
# ---------------------------------------------------------------------------

async def analyze_video(video_id: str):
    """
    Full lie-detection analysis pipeline for a single video.

    Intended to be called as a FastAPI BackgroundTask:
        background_tasks.add_task(analyze_video, video_id)

    On completion the videos MongoDB document is updated with:
      - segments          (new format, no face_image_b64)
      - summary
      - thumbnail_url     (S3 URL)
      - video_duration    (HH:MM:SS)
      - analysis_status   "completed" | "failed"
    """
    videos = get_videos_collection()

    # ------------------------------------------------------------------
    # 1. Fetch video document
    # ------------------------------------------------------------------
    try:
        video_doc = await videos.find_one({"_id": ObjectId(video_id)})
    except Exception as e:
        print(f"[analyzer] Could not fetch video {video_id}: {e}")
        return

    if not video_doc:
        print(f"[analyzer] Video {video_id} not found in database.")
        return

    video_url   = video_doc.get("video_url", "")
    video_name  = video_doc.get("video", video_url.rsplit("/", 1)[-1])
    user_id     = video_doc.get("user_id")
    uploaded_at = video_doc.get("uploaded_at", datetime.now(timezone.utc))

    # Always process with .mp4 extension so OpenPose / FFmpeg are happy.
    temp_video_path = os.path.join(TEMP_ROOT, f"target_{video_id}.mp4")

    try:
        _ensure_model_loaded()
        setup_temp_dirs()
        reset_identity_bank()

        # ------------------------------------------------------------------
        # 2. Download video (with WebM → MP4 transcoding when needed)
        # ------------------------------------------------------------------
        if not video_url:
            raise ValueError("video_url is empty — cannot download video.")

        if _is_webm_url(video_url):
            # Download to a .webm temp file, then transcode to .mp4
            temp_webm_path = os.path.join(TEMP_ROOT, f"target_{video_id}.webm")
            _download_video_raw(video_url, temp_webm_path)
            _transcode_to_mp4(temp_webm_path, temp_video_path)
        else:
            download_video(video_url, temp_video_path)

        # ------------------------------------------------------------------
        # 3. Video duration
        # ------------------------------------------------------------------
        video_duration = _get_video_duration(temp_video_path)
        print(f"[analyzer] Video duration: {video_duration}")

        # ------------------------------------------------------------------
        # 4. Thumbnail → S3
        # ------------------------------------------------------------------
        thumbnail_url = video_doc.get("thumbnail_url")   # keep existing if present
        jpeg_bytes = _extract_thumbnail_frame(temp_video_path)
        if jpeg_bytes:
            object_key = f"thumbnails/{video_id}.jpg"
            uploaded = _upload_thumbnail_to_s3(jpeg_bytes, object_key)
            if uploaded:
                thumbnail_url = uploaded

        # ------------------------------------------------------------------
        # 5. Segment detection & inference
        # ------------------------------------------------------------------
        segments_raw   = get_audio_timestamps(temp_video_path)
        threshold      = _global_config["SIGMOID_THRESHOLD"]
        segment_list   = []
        strongest_probs = []

        for start_sec, end_sec in segments_raw:
            advance_segment()
            cleanup_temp_dirs()

            create_subclip(temp_video_path, TEMP_SUBCLIP, start_sec, end_sec)
            run_openpose(TEMP_SUBCLIP)
            valid_frames = extract_and_crop_roi(TEMP_SUBCLIP)
            clear_gpu_cache()

            if valid_frames == 0:
                continue

            result = infer_segment(_global_model, _global_config)
            if result is None:
                continue

            strongest_probs.append(result["strongest_confidence_score"])

            segment_data = {
                "timestamp":                        _format_timestamp_range(start_sec, end_sec),
                "face_confidence_score":            _format_conf(result["face_confidence_score"], threshold),
                "face_verdict":                     result["face_verdict"],
                "arms_confidence_score":            _format_conf(result["arms_confidence_score"], threshold),
                "arms_verdict":                     result["arms_verdict"],
                "average_confidence_score_segment": _format_conf(result["average_confidence_score_segment"], threshold),
                "verdict":                          result["verdict"],
                "parts_indicate":                   result["parts_indicate"],
                "average_based_verdict":            result["average_based_verdict"],
            }
            segment_list.append(segment_data)

        # ------------------------------------------------------------------
        # 6. Build summary
        # ------------------------------------------------------------------
        if strongest_probs:
            avg_prob       = float(np.mean(strongest_probs))
            final_verdict  = "LIE" if avg_prob >= threshold else "TRUTH"
            display_avg    = avg_prob if final_verdict == "LIE" else (1.0 - avg_prob)
            summary = {
                "average_confidence_score": round(display_avg, 4),
                "final_verdict":            final_verdict,
                "total_segments_analyzed":  len(strongest_probs),
            }
        else:
            summary = {
                "average_confidence_score": 0.0,
                "final_verdict":            "TRUTH",
                "total_segments_analyzed":  0,
            }

        # ------------------------------------------------------------------
        # 7. Persist to MongoDB
        # ------------------------------------------------------------------
        update_payload = {
            "segments":         segment_list,
            "summary":          summary,
            "thumbnail_url":    thumbnail_url,
            "video_duration":   video_duration,
            "analysis_status":  "completed",
        }

        await videos.update_one(
            {"_id": ObjectId(video_id)},
            {"$set": update_payload}
        )
        print(f"[analyzer] Analysis complete for video {video_id}. "
              f"Verdict: {summary.get('final_verdict')} | "
              f"Segments: {summary.get('total_segments_analyzed')}")

    except Exception as e:
        print(f"[analyzer] Pipeline error for video {video_id}: {e}")
        try:
            await videos.update_one(
                {"_id": ObjectId(video_id)},
                {"$set": {"analysis_status": "failed"}}
            )
        except Exception:
            pass

    finally:
        final_cleanup()
        if os.path.exists(temp_video_path):
            try:
                os.remove(temp_video_path)
            except Exception:
                pass
