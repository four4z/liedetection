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

# Import the new temporal model classes
from app.ai.models_structure.models import (
    DeceptionTemporalModel, ArmsTemporalModel, MultimodalPipeline,
)
from app.ai.config import (
    FACE_MODEL_CONFIG_PATH, FACE_MODEL_WEIGHT_PATH,
    ARMS_MODEL_CONFIG_PATH, ARMS_MODEL_WEIGHT_PATH,
    DEVICE, TEMP_FRAMES,
)
from app.ai.utils.video_utils import clear_gpu_cache


def _build_model_from_config(config: dict, weight_path: str):
    """
    Instantiate the correct model class based on the JSON config's MODALITY field,
    mapping CNN and HEAD keys to class constructor arguments.

    Returns the loaded model on DEVICE in eval mode.
    """
    modality   = config["MODALITY"]
    cnn_name   = config.get("CNN", "resnet18")
    head_type  = config.get("HEAD", "lstm")
    seq_len    = config.get("SEQ_LEN", 30)
    freeze_cnn = config.get("FREEZE_CNN", False)

    print(f"[predictor] Building model: MODALITY={modality}, CNN={cnn_name}, "
          f"HEAD={head_type}, SEQ_LEN={seq_len}")

    if modality == "face":
        model = DeceptionTemporalModel(
            cnn_name=cnn_name,
            head_type=head_type,
            seq_len=seq_len,
            freeze_cnn=freeze_cnn,
            pretrained=True,
        )
    elif modality == "arms_early_fusion":
        model = ArmsTemporalModel(
            cnn_name=cnn_name,
            head_type=head_type,
            seq_len=seq_len,
            freeze_cnn=freeze_cnn,
            pretrained=True,
        )
    else:
        raise ValueError(f"[predictor] Unknown MODALITY in config: {modality}")

    # Load weights — use strict=False to tolerate minor key mismatches
    # from older checkpoint formats
    state_dict = torch.load(weight_path, map_location=DEVICE)
    model.load_state_dict(state_dict, strict=False)
    model.to(DEVICE)
    model.eval()

    print(f"[predictor] Loaded weights from {weight_path}")
    return model


def load_model_and_config(manual_seq_len=None, manual_threshold=None):
    """
    Read both face and arms JSON configs, instantiate the correct model
    classes via _build_model_from_config, and wrap them in MultimodalPipeline.
    """
    # ---- Face config ----
    with open(FACE_MODEL_CONFIG_PATH, 'r') as f:
        face_config = json.load(f)

    # ---- Arms config ----
    with open(ARMS_MODEL_CONFIG_PATH, 'r') as f:
        arms_config = json.load(f)

    # Merge into a pipeline-level config dict
    seq_len   = manual_seq_len if manual_seq_len is not None else face_config.get('SEQ_LEN', 30)
    threshold = manual_threshold if manual_threshold is not None else face_config.get('SIGMOID_THRESHOLD', 0.5)
    input_dim = face_config.get('INPUT_DIM', 224)

    pipeline_config = {
        'SEQ_LEN':            seq_len,
        'SIGMOID_THRESHOLD':  threshold,
        'INPUT_DIM':          input_dim,
    }

    print(f"[predictor] Pipeline config: SEQ_LEN={seq_len}, "
          f"THRESHOLD={threshold}, INPUT_DIM={input_dim}")

    # ---- Build models ----
    face_net = _build_model_from_config(face_config, FACE_MODEL_WEIGHT_PATH)
    arms_net = _build_model_from_config(arms_config, ARMS_MODEL_WEIGHT_PATH)

    # Merge into Pipeline
    model = MultimodalPipeline(face_net=face_net, arms_net=arms_net)
    model.to(DEVICE)
    model.eval()

    return model, pipeline_config


def infer_segment(model, config):
    """Processes face and arm frames to generate part-based verdicts and probabilities."""
    seq_len   = config['SEQ_LEN']
    threshold = config['SIGMOID_THRESHOLD']
    input_dim = config.get('INPUT_DIM', 224)

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
        transforms.Resize((input_dim, input_dim)),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
    ])

    faces, l_arms, r_arms = [], [], []
    black_tensor = transform(Image.new('RGB', (input_dim, input_dim), color='black'))

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

    # Explicitly free GPU tensors to prevent VRAM leaks
    del face_tensor, l_arm_tensor, r_arm_tensor, face_logits, arms_logits

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