import os
import math
import torch
import moviepy.editor as mp
from silero_vad import load_silero_vad, read_audio, get_speech_timestamps
from app.ai.config import TEMP_AUDIO

# VAD Post-processing thresholds
MERGE_GAP_MS = 400   # ms: merge consecutive segments whose gap is less than this
MIN_SPEECH_MS = 500  # ms: drop segments shorter than this


def get_audio_timestamps(video_path, max_chunk_duration=60.0):
    """Extracts audio via Silero VAD and outputs vocal timestamps."""
    print(f"\n--- Extracting Audio & VAD ---")
    try:
        with mp.VideoFileClip(video_path) as video:
            video_duration = video.duration
            if video.audio is None:
                print("[audio] No audio track found — skipping processing.")
                return []

            video.audio.write_audiofile(TEMP_AUDIO, logger=None)

        # Load Silero VAD model
        model = load_silero_vad()
        audio = read_audio(TEMP_AUDIO, sampling_rate=16000)

        raw_timestamps = get_speech_timestamps(audio, model, sampling_rate=16000)
        # raw_timestamps: list of dicts with 'start' and 'end' in samples at 16000 Hz
        raw_segments = [(ts['start'] / 16000.0, ts['end'] / 16000.0) for ts in raw_timestamps]

        # --- Post-processing: merge gaps < MERGE_GAP_MS ---
        merge_gap_sec = MERGE_GAP_MS / 1000.0
        merged = []
        for seg in raw_segments:
            if merged and (seg[0] - merged[-1][1]) < merge_gap_sec:
                merged[-1] = (merged[-1][0], seg[1])
            else:
                merged.append(list(seg))

        # --- Post-processing: drop segments shorter than MIN_SPEECH_MS ---
        min_dur_sec = MIN_SPEECH_MS / 1000.0
        filtered = [(s[0], s[1]) for s in merged if (s[1] - s[0]) >= min_dur_sec]

        # --- Split long segments to max_chunk_duration ---
        final_segments = []
        for start, end in filtered:
            duration = end - start
            if duration > max_chunk_duration:
                num_chunks = math.ceil(duration / max_chunk_duration)
                chunk_size = duration / num_chunks
                for i in range(num_chunks):
                    final_segments.append((start + i * chunk_size, start + (i + 1) * chunk_size))
            else:
                final_segments.append((start, end))

        if os.path.exists(TEMP_AUDIO):
            os.remove(TEMP_AUDIO)

        print(f"[audio] Found {len(final_segments)} speech segments.")
        return final_segments

    except Exception as e:
        print(f"[audio] Audio processing failed: {e}. Returning 0 segments.")
        return []