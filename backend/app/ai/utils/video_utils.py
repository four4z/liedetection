import os
import cv2
import json
import shutil
import numpy as np
import requests
import torch
import torchvision.transforms as T
from PIL import Image
import moviepy.editor as mp
from numpy.linalg import norm
from collections import defaultdict
from facenet_pytorch import InceptionResnetV1
from app.ai.config import TEMP_JSONS, TEMP_FRAMES

# --- FaceNet model — loaded once, placed on GPU when available ---
_facenet_device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
_facenet_model  = InceptionResnetV1(pretrained='vggface2').eval().to(_facenet_device)
_facenet_transform = T.Compose([
    T.Resize((160, 160)),
    T.ToTensor(),
    T.Normalize([0.5, 0.5, 0.5], [0.5, 0.5, 0.5])
])
# Batch size for the GPU forward pass inside each subclip.
# Conservative default: OpenPose also occupies VRAM, so keep headroom.
_EMBED_BATCH_SIZE = 32

# --- Image Extraction Configuration ---
FACE_SIZE        = (112, 112)       # model input — do not change
ARM_SIZE         = (112, 112)       # model input — do not change
UPPER_BODY_SIZE  = (224, 224)       # display thumbnail only
PADDING               = 30
HAND_EXTENSION        = 60
MISSING_WRIST_EXTENSION = 80
CONFIDENCE_THRESHOLD  = 0.01

# --- Tracking Configuration ---
EMBED_SIMILARITY_THRESHOLD = 0.70
MAX_SAMPLES_PER_PERSON     = 15
NEW_SAMPLE_THRESHOLD       = 0.90

# OpenPose Body_25/COCO indices
RIGHT_ARM_INDICES       = [2, 3, 4]
LEFT_ARM_INDICES        = [5, 6, 7]
HEAD_POSE_INDICES       = [0, 15, 16, 17, 18]

# --- Persistent identity state (module-level, survives across subclips) ---
_known_identities: dict      = {}
_person_appearance_log: dict = {}
_current_segment_index: int  = 0


def reset_identity_bank():
    """Call ONCE at the start of each new video before any subclip processing."""
    global _known_identities, _person_appearance_log, _current_segment_index
    _known_identities      = {}
    _person_appearance_log = {}
    _current_segment_index = 0


def advance_segment():
    """Call ONCE at the start of each api.py segment iteration."""
    global _current_segment_index
    _current_segment_index += 1


def clear_gpu_cache():
    """
    Release the GPU memory held by FaceNet tensors so OpenPose
    (or any other CUDA consumer) has maximum VRAM for the next segment.
    Call from api.py immediately after extract_and_crop_roi() returns.
    """
    if torch.cuda.is_available():
        torch.cuda.empty_cache()


# ==========================================
# FILE FETCHING & VIDEO CLIPPING
# ==========================================

def download_video(url, output_path):
    print(f"Downloading video from {url}...")
    with requests.get(url, stream=True) as r:
        r.raise_for_status()
        with open(output_path, 'wb') as f:
            for chunk in r.iter_content(chunk_size=8192):
                f.write(chunk)
    return output_path


def create_subclip(video_path, temp_subclip_path, start_sec, end_sec):
    with mp.VideoFileClip(video_path) as video:
        subclip = video.subclip(start_sec, end_sec)
        subclip.write_videofile(temp_subclip_path, codec="libx264",
                                audio=False, logger=None)


# ==========================================
# ROI & BBOX MATH HELPERS
# ==========================================

def make_bbox_square(x_min, y_min, x_max, y_max, img_w, img_h):
    bw = x_max - x_min
    bh = y_max - y_min
    size = max(bw, bh)
    cx = x_min + bw // 2
    cy = y_min + bh // 2
    new_x_min = cx - size // 2
    new_x_max = new_x_min + size
    new_y_min = cy - size // 2
    new_y_max = new_y_min + size

    if new_x_min < 0:
        new_x_max += abs(new_x_min); new_x_min = 0
    if new_x_max > img_w:
        new_x_min -= (new_x_max - img_w); new_x_max = img_w
    if new_y_min < 0:
        new_y_max += abs(new_y_min); new_y_min = 0
    if new_y_max > img_h:
        new_y_min -= (new_y_max - img_h); new_y_max = img_h

    return (max(0, int(new_x_min)), max(0, int(new_y_min)),
            min(img_w, int(new_x_max)), min(img_h, int(new_y_max)))


def pad_to_square_fallback(img, pad_color=(0, 0, 0)):
    h, w = img.shape[:2]
    if h == w: return img
    max_dim = max(h, w)
    top    = (max_dim - h) // 2
    bottom = max_dim - h - top
    left   = (max_dim - w) // 2
    right  = max_dim - w - left
    return cv2.copyMakeBorder(img, top, bottom, left, right,
                               cv2.BORDER_CONSTANT, value=pad_color)


def get_body_part_roi(frame, target_size,
                      main_kpts=None, pose_kpts=None,
                      indices=None, is_face=False):
    valid_x, valid_y = [], []
    h, w, _ = frame.shape
    wrist_found  = False
    is_right_arm = indices and (4 in indices)
    is_left_arm  = indices and (7 in indices)

    if is_face:
        if main_kpts:
            for i in range(0, len(main_kpts), 3):
                if main_kpts[i+2] > CONFIDENCE_THRESHOLD:
                    valid_x.append(main_kpts[i]); valid_y.append(main_kpts[i+1])
        if pose_kpts:
            for idx in HEAD_POSE_INDICES:
                if (idx*3+2) < len(pose_kpts) and pose_kpts[idx*3+2] > CONFIDENCE_THRESHOLD:
                    valid_x.append(pose_kpts[idx*3]); valid_y.append(pose_kpts[idx*3+1])
    else:
        if main_kpts and indices:
            for idx in indices:
                if (idx*3+2) < len(main_kpts) and main_kpts[idx*3+2] > CONFIDENCE_THRESHOLD:
                    px, py = main_kpts[idx*3], main_kpts[idx*3+1]
                    valid_x.append(px); valid_y.append(py)
                    if idx in [4, 7]:
                        valid_x.extend([px - HAND_EXTENSION, px + HAND_EXTENSION])
                        valid_y.extend([py - HAND_EXTENSION, py + HAND_EXTENSION])
                        wrist_found = True

    if not valid_x or not valid_y:
        return np.zeros((target_size[1], target_size[0], 3), dtype=np.uint8)

    x_min, x_max = min(valid_x), max(valid_x)
    y_min, y_max = min(valid_y), max(valid_y)

    if not is_face and not wrist_found:
        if is_right_arm:
            x_min -= MISSING_WRIST_EXTENSION; y_max += MISSING_WRIST_EXTENSION
        elif is_left_arm:
            x_max += MISSING_WRIST_EXTENSION; y_max += MISSING_WRIST_EXTENSION

    x_min -= PADDING; y_min -= PADDING
    x_max += PADDING; y_max += PADDING
    x_min, y_min, x_max, y_max = make_bbox_square(x_min, y_min, x_max, y_max, w, h)

    if x_max <= x_min or y_max <= y_min:
        return np.zeros((target_size[1], target_size[0], 3), dtype=np.uint8)
    roi = frame[y_min:y_max, x_min:x_max]
    if roi.size == 0:
        return np.zeros((target_size[1], target_size[0], 3), dtype=np.uint8)

    return cv2.resize(pad_to_square_fallback(roi), target_size)


def get_upper_body_roi(frame, pose_kpts, face_kpts):
    """Extracts a 224×224 upper-body thumbnail (head → wrists). Not fed into models."""
    valid_x, valid_y = [], []
    h, w = frame.shape[:2]

    if face_kpts:
        for i in range(0, len(face_kpts), 3):
            if i + 2 < len(face_kpts) and face_kpts[i+2] > CONFIDENCE_THRESHOLD:
                valid_x.append(face_kpts[i]); valid_y.append(face_kpts[i+1])

    if pose_kpts:
        for idx in range(8):
            base = idx * 3
            if base + 2 < len(pose_kpts) and pose_kpts[base+2] > CONFIDENCE_THRESHOLD:
                valid_x.append(pose_kpts[base]); valid_y.append(pose_kpts[base+1])

    if not valid_x or not valid_y:
        return np.zeros((UPPER_BODY_SIZE[1], UPPER_BODY_SIZE[0], 3), dtype=np.uint8)

    x_min = min(valid_x) - 80;  x_max = max(valid_x) + 80
    y_min = min(valid_y) - 60;  y_max = max(valid_y) + 60
    x_min, y_min, x_max, y_max = make_bbox_square(x_min, y_min, x_max, y_max, w, h)

    if x_max <= x_min or y_max <= y_min:
        return np.zeros((UPPER_BODY_SIZE[1], UPPER_BODY_SIZE[0], 3), dtype=np.uint8)
    roi = frame[y_min:y_max, x_min:x_max]
    if roi.size == 0:
        return np.zeros((UPPER_BODY_SIZE[1], UPPER_BODY_SIZE[0], 3), dtype=np.uint8)

    return cv2.resize(pad_to_square_fallback(roi), UPPER_BODY_SIZE)


# ==========================================
# BATCHED IDENTITY TRACKING (FaceNet512 GPU)
# ==========================================

def _embed_batch(face_rois_bgr):
    """
    Runs FaceNet512 on a list of BGR face ROIs in batches of _EMBED_BATCH_SIZE.
    Returns a parallel list of L2-normalised float32 embeddings (or None per entry).
    All GPU tensors are released after this call.
    """
    n = len(face_rois_bgr)
    results = [None] * n
    if n == 0:
        return results

    tensors       = []
    valid_indices = []

    for i, roi in enumerate(face_rois_bgr):
        if not np.any(roi):
            continue
        try:
            rgb = cv2.cvtColor(roi, cv2.COLOR_BGR2RGB)
            tensors.append(_facenet_transform(Image.fromarray(rgb)))
            valid_indices.append(i)
        except Exception:
            pass

    if not tensors:
        return results

    # Process in sub-batches to respect VRAM budget
    for start in range(0, len(tensors), _EMBED_BATCH_SIZE):
        end        = start + _EMBED_BATCH_SIZE
        sub_t      = tensors[start:end]
        sub_idx    = valid_indices[start:end]
        batch      = torch.stack(sub_t).to(_facenet_device)   # (B, 3, 160, 160) on GPU
        with torch.no_grad():
            embs = _facenet_model(batch).cpu().numpy().astype(np.float32)  # back to CPU
        del batch   # free GPU tensor immediately after each sub-batch

        for j, i in enumerate(sub_idx):
            emb = embs[j]
            n_emb = norm(emb)
            results[i] = emb / (n_emb + 1e-6) if n_emb > 0 else None

    return results


# Thin single-sample wrapper kept for any external callers
def extract_face_embedding(face_roi_bgr):
    return _embed_batch([face_roi_bgr])[0]


def match_identity_multi_sample(face_embedding, known_identities):
    """
    Matches an L2-normalised FaceNet512 embedding against all known identity banks.
    Returns (person_id, best_similarity).
    """
    if face_embedding is None:
        return f"Person_{len(known_identities) + 1}", 1.0

    best_id, best_sim = None, -1.0
    for pid, samples in known_identities.items():
        for s in samples:
            sim = float(np.dot(face_embedding, s))
            if sim > best_sim:
                best_sim = sim
                best_id  = pid

    if best_sim >= EMBED_SIMILARITY_THRESHOLD:
        return best_id, best_sim
    return f"Person_{len(known_identities) + 1}", 1.0


# ==========================================
# MAIN EXTRACTION LOGIC (3-phase batched)
# ==========================================

def extract_and_crop_roi(subclip_path):
    """
    Phase 1 — Read all frames, extract all ROIs into RAM.
    Phase 2 — Single batched GPU forward pass for all face embeddings.
    Phase 3 — Identity matching + staging save (CPU only).
    GPU cache is NOT cleared here; call clear_gpu_cache() from api.py
    after this function returns so OpenPose gets maximum VRAM next round.
    """
    global _known_identities, _person_appearance_log, _current_segment_index

    staging_dir = os.path.join(TEMP_FRAMES, "staging")
    os.makedirs(staging_dir, exist_ok=True)

    # ---- Phase 1: Collect -----------------------------------------------
    # collected[i] = (frame_idx, face_kpts, pose_kpts,
    #                 face_roi, l_arm_roi, r_arm_roi, upper_roi)
    collected      = []
    face_rois_buf  = []   # parallel list of face ROIs for Phase 2

    cap = cv2.VideoCapture(subclip_path)
    frame_idx = 0

    while True:
        ret, frame = cap.read()
        if not ret: break

        json_path = os.path.join(TEMP_JSONS,
                                 f"temp_subclip_{frame_idx:012d}_keypoints.json")
        if os.path.exists(json_path):
            with open(json_path, 'r', encoding='utf-8') as f:
                try:    data = json.load(f)
                except: data = {}

            for person in data.get("people", []):
                pose_kpts = person.get("pose_keypoints_2d", [])
                face_kpts = person.get("face_keypoints_2d", [])

                face_roi = get_body_part_roi(
                    frame, FACE_SIZE,
                    main_kpts=face_kpts, pose_kpts=pose_kpts, is_face=True
                )
                if not np.any(face_roi):
                    continue

                l_arm_roi = get_body_part_roi(
                    frame, ARM_SIZE, main_kpts=pose_kpts, indices=LEFT_ARM_INDICES
                )
                r_arm_roi = get_body_part_roi(
                    frame, ARM_SIZE, main_kpts=pose_kpts, indices=RIGHT_ARM_INDICES
                )
                upper_roi = get_upper_body_roi(frame, pose_kpts, face_kpts)

                collected.append(
                    (frame_idx, face_kpts, pose_kpts,
                     face_roi, l_arm_roi, r_arm_roi, upper_roi)
                )
                face_rois_buf.append(face_roi)

        frame_idx += 1
    cap.release()

    if not collected:
        shutil.rmtree(staging_dir, ignore_errors=True)
        return 0

    # ---- Phase 2: Batch embed (all at once, GPU) -------------------------
    embeddings = _embed_batch(face_rois_buf)

    # ---- Phase 3: Identity match + staging save (CPU) -------------------
    person_frame_counts = defaultdict(int)

    for (fi, face_kpts, pose_kpts,
         face_roi, l_arm_roi, r_arm_roi, upper_roi), embedding in zip(collected, embeddings):

        person_id, best_sim = match_identity_multi_sample(embedding, _known_identities)

        is_new = person_id not in _known_identities
        if is_new:
            _known_identities[person_id] = []

        if len(_known_identities[person_id]) < MAX_SAMPLES_PER_PERSON:
            if is_new or best_sim < NEW_SAMPLE_THRESHOLD:
                if embedding is not None:
                    _known_identities[person_id].append(embedding)

        person_frame_counts[person_id] += 1

        p_face_dir  = os.path.join(staging_dir, person_id, "face")
        p_l_arm_dir = os.path.join(staging_dir, person_id, "l_arm")
        p_r_arm_dir = os.path.join(staging_dir, person_id, "r_arm")
        p_upper_dir = os.path.join(staging_dir, person_id, "upper")
        os.makedirs(p_face_dir,  exist_ok=True)
        os.makedirs(p_l_arm_dir, exist_ok=True)
        os.makedirs(p_r_arm_dir, exist_ok=True)
        os.makedirs(p_upper_dir, exist_ok=True)

        base_name = f"frame_{fi:06d}"
        cv2.imwrite(os.path.join(p_face_dir,  f"{base_name}_face.jpg"),  face_roi)
        cv2.imwrite(os.path.join(p_l_arm_dir, f"{base_name}_l_arm.jpg"), l_arm_roi)
        cv2.imwrite(os.path.join(p_r_arm_dir, f"{base_name}_r_arm.jpg"), r_arm_roi)
        cv2.imwrite(os.path.join(p_upper_dir, f"{base_name}_upper.jpg"), upper_roi,
                    [cv2.IMWRITE_JPEG_QUALITY, 90])

    # ---------------------------------------------------------
    # IDENTIFY THE MAIN SPEAKER & PROMOTE THEIR FRAMES
    # ---------------------------------------------------------
    # Helper: compute average FaceNet embedding cosine distance between
    # consecutive sampled face frames (stride=5, always includes the last
    # frame).  High distance → face is visibly changing (mouth movement,
    # expressions) → strong proxy for the active speaker.
    def _compute_avg_embedding_diff(pid):
        face_dir = os.path.join(staging_dir, pid, "face")
        if not os.path.isdir(face_dir):
            return 0.0

        all_frames = sorted([f for f in os.listdir(face_dir) if f.endswith(".jpg")])
        if len(all_frames) < 2:
            return 0.0

        # Stride-5 indices, always appending the very last frame index
        stride = 5
        indices = list(range(0, len(all_frames), stride))
        if (len(all_frames) - 1) not in indices:
            indices.append(len(all_frames) - 1)

        sampled_paths = [os.path.join(face_dir, all_frames[i]) for i in indices]

        # Load as BGR ROIs
        rois = []
        for path in sampled_paths:
            img = cv2.imread(path)
            rois.append(img if img is not None else np.zeros((112, 112, 3), dtype=np.uint8))

        # Batch embed via existing FaceNet pipeline
        embeddings = _embed_batch(rois)

        # Average cosine distance between consecutive valid embedding pairs
        dists = []
        for i in range(len(embeddings) - 1):
            e1, e2 = embeddings[i], embeddings[i + 1]
            if e1 is None or e2 is None:
                continue
            cosine_sim = float(np.dot(e1, e2))   # both are L2-normalised
            dists.append(1.0 - cosine_sim)        # distance: 0 = identical, 2 = opposite

        return float(np.mean(dists)) if dists else 0.0

    if len(person_frame_counts) == 1:
        # Only one person — no need to compare
        main_person_id = next(iter(person_frame_counts))
    else:
        # Score = frame_count × avg_embedding_cosine_distance
        # Rewards people who appear often AND whose face embeddings change
        # across frames (mouth movement, expressions → active speaker).
        motion_scores = {
            pid: person_frame_counts[pid] * _compute_avg_embedding_diff(pid)
            for pid in person_frame_counts
        }
        print(f"  -> Speaker candidate scores (frames × motion): "
              + ", ".join(f"{pid}={s:.2f}" for pid, s in motion_scores.items()))

        if all(v == 0.0 for v in motion_scores.values()):
            # Fallback: every candidate is static — revert to raw frame count
            print("  -> All motion scores zero; falling back to raw frame count.")
            main_person_id = max(person_frame_counts, key=person_frame_counts.get)
        else:
            main_person_id = max(motion_scores, key=motion_scores.get)

    total_valid_frames = person_frame_counts[main_person_id]
    print(f"  -> Identified {main_person_id} as the main speaker ({total_valid_frames} frames).")

    # Log appearance
    if main_person_id not in _person_appearance_log:
        _person_appearance_log[main_person_id] = []
    _person_appearance_log[main_person_id].append({
        "segment_index": _current_segment_index,
        "frame_count":   total_valid_frames
    })

    # Promote staging → final destinations
    final_face_dir  = os.path.join(TEMP_FRAMES, "face")
    final_l_arm_dir = os.path.join(TEMP_FRAMES, "l_arm")
    final_r_arm_dir = os.path.join(TEMP_FRAMES, "r_arm")
    final_upper_dir = os.path.join(TEMP_FRAMES, "upper")

    shutil.rmtree(final_face_dir,  ignore_errors=True)
    shutil.rmtree(final_l_arm_dir, ignore_errors=True)
    shutil.rmtree(final_r_arm_dir, ignore_errors=True)
    shutil.rmtree(final_upper_dir, ignore_errors=True)

    shutil.move(os.path.join(staging_dir, main_person_id, "face"),  final_face_dir)
    shutil.move(os.path.join(staging_dir, main_person_id, "l_arm"), final_l_arm_dir)
    shutil.move(os.path.join(staging_dir, main_person_id, "r_arm"), final_r_arm_dir)
    shutil.move(os.path.join(staging_dir, main_person_id, "upper"), final_upper_dir)

    shutil.rmtree(staging_dir, ignore_errors=True)

    return total_valid_frames