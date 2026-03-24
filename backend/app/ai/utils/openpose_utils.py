import subprocess
from config import OPENPOSE_EXE, TEMP_JSONS

def run_openpose(subclip_path):
    """Triggers the OpenPose executable via subprocess."""
    command = [
        OPENPOSE_EXE,
        "--video", subclip_path,
        # # Comments out if use only frames for AI
        # "--face",
        "--write_json", TEMP_JSONS,
        # Can adjust the resolution higher for keypoints detection accuracy if ignore face models.
        # With Face Model, Recommended at -1x128 for 6GB GPU
        "--net_resolution", "-1x176", 
        "--display", "0",
        "--render_pose", "0",
    ]
    try:
        subprocess.run(command, shell=True, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT)
    except subprocess.CalledProcessError as e:
        print(f"OpenPose error: {e}")