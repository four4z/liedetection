"""
For running proof of concept video processing.
"""

import os
import torch

# Hardware
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# Target Data
TARGET_VIDEO = r"VideoRLTRetry\trial_lie_054.mp4"
OPENPOSE_EXE = r"bin\OpenPoseDemo.exe"

# Model Paths
# MODEL_CONFIG_PATH = r"Project_Directory/model_results/CustomCNN/CustomCNNLarge/model_config.json"
# MODEL_WEIGHT_PATH = r"Project_Directory/model_results/CustomCNN/CustomCNNLarge/best_cnn_loss.pth"

FACE_MODEL_CONFIG_PATH = r"models_structure/weights/MobileNetV3SmallFaceOnlyLSTM V3/model_config.json"
FACE_MODEL_WEIGHT_PATH = r"models_structure/weights/MobileNetV3SmallFaceOnlyLSTM V3/best_cnn_loss.pth"


ARMS_MODEL_CONFIG_PATH = r"models_structure/weights/MobileNetV3SmallArmsOnlyLSTM V3/model_config.json"
ARMS_MODEL_WEIGHT_PATH = r"models_structure/weights/MobileNetV3SmallArmsOnlyLSTM V3/best_arms_loss.pth"

# Temporary Directories
TEMP_ROOT = r"temp_processing"
TEMP_AUDIO = os.path.join(TEMP_ROOT, "temp_audio.wav")
TEMP_SUBCLIP = os.path.join(TEMP_ROOT, "temp_subclip.mp4")
TEMP_JSONS = os.path.join(TEMP_ROOT, "temp_jsons")
TEMP_FRAMES = os.path.join(TEMP_ROOT, "temp_frames")