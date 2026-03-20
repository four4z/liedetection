import os
import json
import torch
import numpy as np
import cv2
from PIL import Image
import torchvision.transforms as transforms
import sys

# Ensure models_structure can be imported
sys.path.append(os.path.join(os.path.dirname(os.path.dirname(__file__)), 'models_structure'))

# Import the newly refactored dynamic models
from models import DynamicFaceLSTM, DynamicArmsLSTM, ModalityFeatureExtractor, MultimodalPipeline
from config import FACE_MODEL_CONFIG_PATH, FACE_MODEL_WEIGHT_PATH, ARMS_MODEL_WEIGHT_PATH, DEVICE, TEMP_FRAMES


def load_model_and_config(manual_seq_len=None, manual_threshold=None):
    """Instantiates the dynamic PyTorch models, allows manual config overrides, and loads weights."""
    with open(FACE_MODEL_CONFIG_PATH, 'r') as f:
        config = json.load(f)

    seq_len = manual_seq_len if manual_seq_len is not None else config.get('SEQ_LEN', 20)
    threshold = manual_threshold if manual_threshold is not None else config.get('SIGMOID_THRESHOLD', 0.5)

    updated_config = {
        'SEQ_LEN': seq_len,
        'SIGMOID_THRESHOLD': threshold
    }

    print(f"Loaded Config: SEQ_LEN={seq_len}, THRESHOLD={threshold}")

    # ---------------------------------------------------------
    # FIX: FACE MODEL KEY MAPPING
    # ---------------------------------------------------------
    face_net = DynamicFaceLSTM(extractor=ModalityFeatureExtractor(), feature_dim=576, hidden_dim=256, num_layers=2)

    # 1. Load the raw dictionary from the .pth file
    raw_face_state_dict = torch.load(FACE_MODEL_WEIGHT_PATH, map_location=DEVICE)

    # 2. Translate old 'conv_block' keys to new 'extractor.conv_blocks' keys
    mapped_face_state_dict = {}
    for key, value in raw_face_state_dict.items():
        new_key = key.replace("conv_block.", "extractor.conv_blocks.")
        mapped_face_state_dict[new_key] = value

    # 3. Load the mapped dictionary
    face_net.load_state_dict(mapped_face_state_dict)
    # ---------------------------------------------------------

    # The Arms model already used 'extractor' in its old format, so it loads normally
    arms_net = DynamicArmsLSTM(extractor=ModalityFeatureExtractor(), feature_dim=576, hidden_dim=256, num_layers=2)
    arms_net.load_state_dict(torch.load(ARMS_MODEL_WEIGHT_PATH, map_location=DEVICE))

    # Merge into Pipeline
    model = MultimodalPipeline(face_net=face_net, arms_net=arms_net)
    model.to(DEVICE)
    model.eval()

    return model, updated_config


def infer_segment(model, config):
    """Processes face and arm frames to generate part-based verdicts and probabilities."""
    seq_len = config['SEQ_LEN']
    threshold = config['SIGMOID_THRESHOLD']

    # Define sub-directories (Assuming video_utils.py extracts them here)
    face_dir  = os.path.join(TEMP_FRAMES, "face")
    l_arm_dir = os.path.join(TEMP_FRAMES, "l_arm")
    r_arm_dir = os.path.join(TEMP_FRAMES, "r_arm")

    if not os.path.exists(face_dir):
        return None

    frames = sorted([f for f in os.listdir(face_dir) if f.endswith('.jpg')])
    if len(frames) == 0:
        return None

    # Linspace Sampling
    target_indices = np.linspace(0, len(frames) - 1, num=seq_len)
    target_indices = np.around(target_indices).astype(int)

    transform = transforms.Compose([
        transforms.Resize((112, 112)),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
    ])

    faces, l_arms, r_arms = [], [], []
    black_tensor = transform(Image.new('RGB', (112, 112), color='black'))

    for i in target_indices:
        base_name = frames[i]
        clean_name = base_name.replace("_face.jpg", "")

        f_path = os.path.join(face_dir,  clean_name + "_face.jpg")
        l_path = os.path.join(l_arm_dir, clean_name + "_l_arm.jpg")
        r_path = os.path.join(r_arm_dir, clean_name + "_r_arm.jpg")

        if os.path.exists(f_path): faces.append(transform(Image.open(f_path).convert('RGB')))
        else: faces.append(black_tensor.clone())

        if os.path.exists(l_path): l_arms.append(transform(Image.open(l_path).convert('RGB')))
        else: l_arms.append(black_tensor.clone())

        if os.path.exists(r_path): r_arms.append(transform(Image.open(r_path).convert('RGB')))
        else: r_arms.append(black_tensor.clone())

    face_tensor   = torch.stack(faces).unsqueeze(0).to(DEVICE)
    l_arm_tensor  = torch.stack(l_arms).unsqueeze(0).to(DEVICE)
    r_arm_tensor  = torch.stack(r_arms).unsqueeze(0).to(DEVICE)

    # Run Inference
    with torch.no_grad():
        face_logits, arms_logits = model(face_tensor, l_arm_tensor, r_arm_tensor)
        face_prob  = torch.sigmoid(face_logits).item()
        arms_prob  = torch.sigmoid(arms_logits).item()

    # --- Verdict Logic ---
    avg_prob = (face_prob + arms_prob) / 2.0

    # The strongest probability is the one furthest from the configured threshold
    if abs(face_prob - threshold) >= abs(arms_prob - threshold):
        strongest_prob  = face_prob
        parts_indicate  = "face"
    else:
        strongest_prob  = arms_prob
        parts_indicate  = "arms"

    return {
        "face_confidence_score":          face_prob,
        "face_verdict":                   "LIE" if face_prob > threshold else "TRUTH",
        "arms_confidence_score":          arms_prob,
        "arms_verdict":                   "LIE" if arms_prob > threshold else "TRUTH",
        "average_confidence_score_segment": avg_prob,
        "verdict":                        "LIE" if strongest_prob > threshold else "TRUTH",
        "parts_indicate":                 parts_indicate,
        "average_based_verdict":          "LIE" if avg_prob > threshold else "TRUTH",
        "strongest_confidence_score":     strongest_prob,
    }