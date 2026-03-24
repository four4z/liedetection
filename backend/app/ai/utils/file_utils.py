import os
import shutil
from app.ai.config import TEMP_ROOT, TEMP_JSONS, TEMP_FRAMES, TEMP_SUBCLIP

def setup_temp_dirs():
    """Creates temporary directories for fresh processing."""
    os.makedirs(TEMP_ROOT, exist_ok=True)
    os.makedirs(TEMP_JSONS, exist_ok=True)
    os.makedirs(TEMP_FRAMES, exist_ok=True)

def cleanup_temp_dirs():
    """Deletes temporary files and folders to free up space between segments."""
    shutil.rmtree(TEMP_JSONS, ignore_errors=True)
    shutil.rmtree(TEMP_FRAMES, ignore_errors=True)
    if os.path.exists(TEMP_SUBCLIP):
        os.remove(TEMP_SUBCLIP)
    os.makedirs(TEMP_JSONS, exist_ok=True)
    os.makedirs(TEMP_FRAMES, exist_ok=True)

def final_cleanup():
    """Removes the entire temp directory at the end of the script."""
    shutil.rmtree(TEMP_ROOT, ignore_errors=True)