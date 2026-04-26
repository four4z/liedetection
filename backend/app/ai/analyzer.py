"""
Lie Detection Analyzer using MediaPipe Pose

Signal → score mapping:
  face_confidence_score  ← hand-to-face proximity  (closer hand = higher lie score)
  arms_confidence_score  ← arm / wrist fidget level (more movement = higher lie score)

Each 5-second window of the video becomes one SegmentResult.
A representative frame from the middle of the window is saved as a
base64-encoded JPEG in face_image_b64.

Note: This is for research/entertainment purposes only.
Lie detection through body language is not scientifically reliable.
"""

import cv2
import base64
import numpy as np
import mediapipe as mp
from datetime import datetime, timedelta
from bson import ObjectId
import tempfile
import os

from app.database.connection import get_videos_collection, get_gridfs


# ---------------------------------------------------------------------------
# MediaPipe initialisation
# ---------------------------------------------------------------------------

mp_pose = mp.solutions.pose

# Thresholds
FACE_LIE_THRESHOLD = 0.50   # face_confidence_score >= this → LIE
ARMS_LIE_THRESHOLD = 0.50   # arms_confidence_score >= this → LIE
FINAL_LIE_THRESHOLD = 0.60  # summary average >= this → final verdict LIE
SEGMENT_SECONDS = 5         # seconds per segment window


# ---------------------------------------------------------------------------
# Helper utilities
# ---------------------------------------------------------------------------

def _seconds_to_hms(seconds: float) -> str:
    """Convert float seconds → 'HH:MM:SS' string."""
    td = timedelta(seconds=int(seconds))
    total_s = int(td.total_seconds())
    h = total_s // 3600
    m = (total_s % 3600) // 60
    s = total_s % 60
    return f"{h:02d}:{m:02d}:{s:02d}"


def _frame_to_b64(frame) -> str:
    """Encode an OpenCV BGR frame as a base64 JPEG string."""
    success, buffer = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 70])
    if not success:
        return ""
    return base64.b64encode(buffer).decode("utf-8")


def _score_to_verdict(score: float, threshold: float) -> str:
    return "LIE" if score >= threshold else "TRUTH"


def _build_segment(
    seg_index: int,
    fps: float,
    frames_data: list,       # list of (frame, landmarks_or_None)
    segment_seconds: int,
) -> dict:
    """
    Build one segment dict from a window of frame data.

    frames_data: list of (frame_bgr, landmarks_dict | None)
    """
    start_sec = seg_index * segment_seconds
    end_sec = start_sec + segment_seconds
    timestamp = f"{_seconds_to_hms(start_sec)}–{_seconds_to_hms(end_sec)}"

    valid = [(f, lm) for f, lm in frames_data if lm is not None]

    # --- face_confidence_score -------------------------------------------
    # hand-to-face distance: small distance → high score (normalised 0–1)
    # raw distance is in normalised image coords (0–1); we invert & clamp.
    if valid:
        h2f_distances = []
        for _, lm in valid:
            nose = np.array(lm["nose"])
            lw = np.array(lm["left_wrist"])
            rw = np.array(lm["right_wrist"])
            dist = min(np.linalg.norm(nose - lw), np.linalg.norm(nose - rw))
            h2f_distances.append(dist)
        avg_dist = np.mean(h2f_distances)
        # dist ≈ 0  →  score 1.0 (hand on face)
        # dist ≈ 0.5+ → score 0.0
        face_score = float(np.clip(1.0 - (avg_dist / 0.5), 0.0, 1.0))
    else:
        face_score = 0.0

    # --- arms_confidence_score -------------------------------------------
    # wrist movement across consecutive frames in the segment
    arm_movements = []
    for i in range(1, len(valid)):
        _, prev_lm = valid[i - 1]
        _, curr_lm = valid[i]
        lw_move = np.linalg.norm(
            np.array(curr_lm["left_wrist"]) - np.array(prev_lm["left_wrist"])
        )
        rw_move = np.linalg.norm(
            np.array(curr_lm["right_wrist"]) - np.array(prev_lm["right_wrist"])
        )
        arm_movements.append((lw_move + rw_move) / 2)

    if arm_movements:
        avg_arm_move = float(np.mean(arm_movements))
        # typical fidget ~0.02; cap at 0.10 for normalisation
        arms_score = float(np.clip(avg_arm_move / 0.10, 0.0, 1.0))
    else:
        arms_score = 0.0

    # --- derived fields --------------------------------------------------
    face_verdict = _score_to_verdict(face_score, FACE_LIE_THRESHOLD)
    arms_verdict = _score_to_verdict(arms_score, ARMS_LIE_THRESHOLD)
    avg_score = round((face_score + arms_score) / 2, 4)

    # Verdict driven by whichever score is higher
    if face_score >= arms_score:
        verdict = face_verdict
        parts_indicate = "face"
    else:
        verdict = arms_verdict
        parts_indicate = "arms"

    average_based_verdict = _score_to_verdict(avg_score, FACE_LIE_THRESHOLD)

    # --- representative face image (middle frame of segment) -------------
    face_image_b64 = ""
    if frames_data:
        mid_idx = len(frames_data) // 2
        mid_frame, _ = frames_data[mid_idx]
        if mid_frame is not None:
            face_image_b64 = _frame_to_b64(mid_frame)

    return {
        "timestamp": timestamp,
        "face_confidence_score": round(face_score, 4),
        "face_verdict": face_verdict,
        "arms_confidence_score": round(arms_score, 4),
        "arms_verdict": arms_verdict,
        "average_confidence_score_segment": avg_score,
        "verdict": verdict,
        "parts_indicate": parts_indicate,
        "average_based_verdict": average_based_verdict,
        "face_image_b64": face_image_b64,
    }


# ---------------------------------------------------------------------------
# Core analyser class
# ---------------------------------------------------------------------------

class LieDetectionAnalyzer:
    """Analyse video by grouping frames into N-second segments."""

    def __init__(self, segment_seconds: int = SEGMENT_SECONDS):
        self.segment_seconds = segment_seconds
        self.pose = mp_pose.Pose(
            static_image_mode=False,
            model_complexity=1,
            smooth_landmarks=True,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5,
        )

    def _extract_landmarks(self, frame) -> dict | None:
        """Run MediaPipe Pose on one frame; return key-point dict or None."""
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = self.pose.process(rgb)
        if not results.pose_landmarks:
            return None
        lm = results.pose_landmarks.landmark
        return {
            "nose":            (lm[mp_pose.PoseLandmark.NOSE].x,            lm[mp_pose.PoseLandmark.NOSE].y),
            "left_shoulder":   (lm[mp_pose.PoseLandmark.LEFT_SHOULDER].x,   lm[mp_pose.PoseLandmark.LEFT_SHOULDER].y),
            "right_shoulder":  (lm[mp_pose.PoseLandmark.RIGHT_SHOULDER].x,  lm[mp_pose.PoseLandmark.RIGHT_SHOULDER].y),
            "left_wrist":      (lm[mp_pose.PoseLandmark.LEFT_WRIST].x,      lm[mp_pose.PoseLandmark.LEFT_WRIST].y),
            "right_wrist":     (lm[mp_pose.PoseLandmark.RIGHT_WRIST].x,     lm[mp_pose.PoseLandmark.RIGHT_WRIST].y),
            "left_hip":        (lm[mp_pose.PoseLandmark.LEFT_HIP].x,        lm[mp_pose.PoseLandmark.LEFT_HIP].y),
            "right_hip":       (lm[mp_pose.PoseLandmark.RIGHT_HIP].x,       lm[mp_pose.PoseLandmark.RIGHT_HIP].y),
        }

    def analyze_video_file(self, video_path: str) -> dict:
        """
        Analyse the video and return:
        {
          "segments": [...],
          "summary": {...},
          "video_duration": "HH:MM:SS"
        }
        """
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            return {"error": "Could not open video file"}

        fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        duration_sec = total_frames / fps

        frames_per_segment = int(fps * self.segment_seconds)
        # Sample ~5 frames per second
        sample_interval = max(1, int(fps / 5))

        segments = []
        seg_index = 0
        current_seg_frames = []  # list of (frame_bgr, landmarks | None)
        frame_count = 0

        while True:
            ret, frame = cap.read()
            if not ret:
                break

            if frame_count % sample_interval == 0:
                landmarks = self._extract_landmarks(frame)
                current_seg_frames.append((frame.copy(), landmarks))

            frame_count += 1

            # When we've collected enough frames for one segment, process it
            if frame_count > 0 and frame_count % frames_per_segment == 0:
                seg = _build_segment(seg_index, fps, current_seg_frames, self.segment_seconds)
                segments.append(seg)
                seg_index += 1
                current_seg_frames = []

        cap.release()

        # Handle any remaining frames as a final (shorter) segment
        if current_seg_frames:
            seg = _build_segment(seg_index, fps, current_seg_frames, self.segment_seconds)
            segments.append(seg)

        # Build summary
        if segments:
            avg_conf = float(np.mean([s["average_confidence_score_segment"] for s in segments]))
            final_verdict = "LIE" if avg_conf >= FINAL_LIE_THRESHOLD else "TRUTH"
        else:
            avg_conf = 0.0
            final_verdict = "TRUTH"

        summary = {
            "average_confidence_score": round(avg_conf, 4),
            "final_verdict": final_verdict,
            "total_segments_analyzed": len(segments),
        }

        return {
            "segments": segments,
            "summary": summary,
            "video_duration": _seconds_to_hms(duration_sec),
        }

    def close(self):
        self.pose.close()


# ---------------------------------------------------------------------------
# Background task called by the API
# ---------------------------------------------------------------------------

async def analyze_video(video_id: str):
    """Background task: download video → analyse → write results to MongoDB."""
    videos = get_videos_collection()
    gridfs = get_gridfs()

    try:
        video = await videos.find_one({"_id": ObjectId(video_id)})
        if not video:
            return

        # Download video from GridFS to a temp file
        grid_out = await gridfs.open_download_stream(ObjectId(video["filePath"]))
        video_data = await grid_out.read()

        with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as tmp:
            tmp.write(video_data)
            temp_path = tmp.name

        # Run analysis
        analyzer = LieDetectionAnalyzer()
        result = analyzer.analyze_video_file(temp_path)
        analyzer.close()

        os.unlink(temp_path)

        if "error" in result:
            raise RuntimeError(result["error"])

        # Persist results
        await videos.update_one(
            {"_id": ObjectId(video_id)},
            {"$set": {
                "video_duration": result["video_duration"],
                "segments": result["segments"],
                "summary": result["summary"],
                "analysis_status": "completed",
            }}
        )

    except Exception as e:
        await videos.update_one(
            {"_id": ObjectId(video_id)},
            {"$set": {"analysis_status": "failed"}}
        )
        print(f"Analysis failed for video {video_id}: {e}")
