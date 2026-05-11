import os
import asyncio
import subprocess
from app.ai.config import OPENPOSE_EXE, OPENPOSE_DIR, TEMP_JSONS

# Global semaphore: strictly 1 concurrent OpenPose process at a time (GPU VRAM)
_openpose_semaphore = asyncio.Semaphore(1)

def run_openpose(subclip_path):
    """Triggers the OpenPose executable via subprocess.

    OpenPose requires the working directory to be the app/ai root so that
    its relative model paths (models/, bin/, etc.) resolve correctly.
    This function temporarily changes cwd to OPENPOSE_DIR, runs the
    process, then restores the original working directory.
    """
    # Use absolute path for TEMP_JSONS — it's already absolute from config,
    # but resolve here explicitly in case the caller supplies a relative path.
    abs_json_out  = os.path.abspath(TEMP_JSONS)
    abs_video_in  = os.path.abspath(subclip_path)

    command = [
        OPENPOSE_EXE,
        "--video", abs_video_in,
        # "--face",   # uncomment to enable OpenPose face keypoints
        "--write_json", abs_json_out,
        # With Face Model, recommended -1x128 for 6 GB GPU
        "--net_resolution", "-1x176",
        "--display",     "0",
        "--render_pose", "0",
    ]

    original_dir = os.getcwd()
    try:
        os.chdir(OPENPOSE_DIR)
        subprocess.run(command, shell=True, check=True,
                       stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT)
    except subprocess.CalledProcessError as e:
        print(f"OpenPose error: {e}")
    finally:
        os.chdir(original_dir)


async def run_openpose_async(subclip_path: str) -> None:
    """Async wrapper that runs OpenPose in a background thread.

    Uses an asyncio.Semaphore(1) to guarantee that at most one OpenPose
    process is active globally — preventing GPU VRAM exhaustion.
    Other FastAPI endpoints remain responsive while waiting.
    """
    async with _openpose_semaphore:
        await asyncio.to_thread(run_openpose, subclip_path)