import subprocess
from config import OPENPOSE_EXE, TEMP_JSONS

def run_openpose(subclip_path):
    """Triggers the OpenPose executable via subprocess."""
    command = [
        OPENPOSE_EXE,
        "--video", subclip_path,
        "--face",
        "--write_json", TEMP_JSONS,
        "--net_resolution", "-1x128", 
        "--display", "0",
        "--render_pose", "0",
    ]
    try:
        subprocess.run(command, shell=True, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT)
    except subprocess.CalledProcessError as e:
        print(f"OpenPose error: {e}")