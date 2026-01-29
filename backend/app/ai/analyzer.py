"""
Lie Detection Analyzer using MediaPipe Pose

This module analyzes video frames for body language patterns
that may indicate deception based on pose estimation.

Note: This is for research/entertainment purposes only.
Lie detection through body language is not scientifically reliable.
"""

import cv2
import numpy as np
import mediapipe as mp
from datetime import datetime
from bson import ObjectId
import io
import tempfile
import os

from app.database.connection import get_videos_collection, get_gridfs


# Initialize MediaPipe Pose
mp_pose = mp.solutions.pose
mp_drawing = mp.solutions.drawing_utils


class LieDetectionAnalyzer:
    """Analyze video for potential deception indicators"""
    
    def __init__(self):
        self.pose = mp_pose.Pose(
            static_image_mode=False,
            model_complexity=1,
            smooth_landmarks=True,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5
        )
        
        # Movement thresholds
        self.fidget_threshold = 0.02
        self.posture_change_threshold = 0.05
    
    def analyze_frame(self, frame) -> dict:
        """Analyze a single frame for pose landmarks"""
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = self.pose.process(rgb_frame)
        
        if not results.pose_landmarks:
            return None
        
        landmarks = results.pose_landmarks.landmark
        
        # Extract key points
        return {
            "nose": (landmarks[mp_pose.PoseLandmark.NOSE].x, landmarks[mp_pose.PoseLandmark.NOSE].y),
            "left_shoulder": (landmarks[mp_pose.PoseLandmark.LEFT_SHOULDER].x, landmarks[mp_pose.PoseLandmark.LEFT_SHOULDER].y),
            "right_shoulder": (landmarks[mp_pose.PoseLandmark.RIGHT_SHOULDER].x, landmarks[mp_pose.PoseLandmark.RIGHT_SHOULDER].y),
            "left_wrist": (landmarks[mp_pose.PoseLandmark.LEFT_WRIST].x, landmarks[mp_pose.PoseLandmark.LEFT_WRIST].y),
            "right_wrist": (landmarks[mp_pose.PoseLandmark.RIGHT_WRIST].x, landmarks[mp_pose.PoseLandmark.RIGHT_WRIST].y),
            "left_hip": (landmarks[mp_pose.PoseLandmark.LEFT_HIP].x, landmarks[mp_pose.PoseLandmark.LEFT_HIP].y),
            "right_hip": (landmarks[mp_pose.PoseLandmark.RIGHT_HIP].x, landmarks[mp_pose.PoseLandmark.RIGHT_HIP].y),
        }
    
    def calculate_movement(self, prev_landmarks: dict, curr_landmarks: dict) -> float:
        """Calculate total movement between frames"""
        if not prev_landmarks or not curr_landmarks:
            return 0.0
        
        total_movement = 0.0
        for key in prev_landmarks:
            if key in curr_landmarks:
                prev = prev_landmarks[key]
                curr = curr_landmarks[key]
                movement = np.sqrt((curr[0] - prev[0])**2 + (curr[1] - prev[1])**2)
                total_movement += movement
        
        return total_movement
    
    def calculate_hand_to_face_distance(self, landmarks: dict) -> float:
        """Calculate distance between hands and face (touching face indicator)"""
        if not landmarks:
            return 1.0  # Max distance
        
        nose = np.array(landmarks["nose"])
        left_wrist = np.array(landmarks["left_wrist"])
        right_wrist = np.array(landmarks["right_wrist"])
        
        left_dist = np.linalg.norm(nose - left_wrist)
        right_dist = np.linalg.norm(nose - right_wrist)
        
        return min(left_dist, right_dist)
    
    def analyze_video_file(self, video_path: str) -> dict:
        """Analyze entire video file"""
        cap = cv2.VideoCapture(video_path)
        
        if not cap.isOpened():
            return {"error": "Could not open video file"}
        
        fps = cap.get(cv2.CAP_PROP_FPS)
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        duration = total_frames / fps if fps > 0 else 0
        
        # Sample every Nth frame
        sample_rate = max(1, int(fps / 5))  # 5 samples per second
        
        prev_landmarks = None
        movements = []
        hand_face_distances = []
        posture_changes = []
        
        frame_count = 0
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            
            if frame_count % sample_rate == 0:
                landmarks = self.analyze_frame(frame)
                
                if landmarks:
                    # Calculate movement
                    movement = self.calculate_movement(prev_landmarks, landmarks)
                    movements.append(movement)
                    
                    # Calculate hand-to-face distance
                    h2f_dist = self.calculate_hand_to_face_distance(landmarks)
                    hand_face_distances.append(h2f_dist)
                    
                    # Track posture changes (shoulder position)
                    if prev_landmarks:
                        shoulder_diff = abs(
                            landmarks["left_shoulder"][1] - prev_landmarks["left_shoulder"][1]
                        ) + abs(
                            landmarks["right_shoulder"][1] - prev_landmarks["right_shoulder"][1]
                        )
                        posture_changes.append(shoulder_diff)
                    
                    prev_landmarks = landmarks
            
            frame_count += 1
        
        cap.release()
        
        # Calculate indicators
        avg_movement = np.mean(movements) if movements else 0
        high_movement_ratio = sum(1 for m in movements if m > self.fidget_threshold) / len(movements) if movements else 0
        
        avg_h2f_distance = np.mean(hand_face_distances) if hand_face_distances else 1
        face_touch_ratio = sum(1 for d in hand_face_distances if d < 0.15) / len(hand_face_distances) if hand_face_distances else 0
        
        avg_posture_change = np.mean(posture_changes) if posture_changes else 0
        
        # Calculate confidence score (0-100)
        # Higher movement, more face touching, more posture changes = higher lie probability
        movement_score = min(high_movement_ratio * 100, 40)  # Max 40 points
        face_touch_score = face_touch_ratio * 30  # Max 30 points
        posture_score = min(avg_posture_change * 200, 30)  # Max 30 points
        
        confidence_score = movement_score + face_touch_score + posture_score
        confidence_score = min(max(confidence_score, 0), 100)
        
        # Determine if lie detected (threshold: 50%)
        is_lie_detected = confidence_score >= 50
        
        return {
            "isLieDetected": is_lie_detected,
            "confidenceScore": round(confidence_score, 2),
            "duration": duration,
            "framesAnalyzed": len(movements),
            "indicators": {
                "fidgetLevel": round(high_movement_ratio * 100, 2),
                "faceTouchLevel": round(face_touch_ratio * 100, 2),
                "postureChangeLevel": round(avg_posture_change * 100, 2)
            }
        }
    
    def close(self):
        self.pose.close()


async def analyze_video(video_id: str):
    """Background task to analyze a video"""
    videos = get_videos_collection()
    gridfs = get_gridfs()
    
    try:
        # Get video document
        video = await videos.find_one({"_id": ObjectId(video_id)})
        if not video:
            return
        
        # Download video from GridFS to temp file
        grid_out = await gridfs.open_download_stream(ObjectId(video["filePath"]))
        video_data = await grid_out.read()
        
        # Save to temp file
        with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as temp_file:
            temp_file.write(video_data)
            temp_path = temp_file.name
        
        # Analyze video
        analyzer = LieDetectionAnalyzer()
        result = analyzer.analyze_video_file(temp_path)
        analyzer.close()
        
        # Clean up temp file
        os.unlink(temp_path)
        
        # Update video document with results
        await videos.update_one(
            {"_id": ObjectId(video_id)},
            {"$set": {
                "durationSeconds": result.get("duration"),
                "analysisResult_isLieDetected": result["isLieDetected"],
                "analysisResult_confidenceScore": result["confidenceScore"],
                "analysisResult_status": "completed",
                "analysisResult_analyzedAt": datetime.utcnow()
            }}
        )
        
    except Exception as e:
        # Mark as failed
        await videos.update_one(
            {"_id": ObjectId(video_id)},
            {"$set": {
                "analysisResult_status": "failed",
                "analysisResult_analyzedAt": datetime.utcnow()
            }}
        )
        print(f"Analysis failed for video {video_id}: {str(e)}")
