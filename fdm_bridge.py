import os
import sys
import subprocess
import time
import re
import tempfile

# Vercel's filesystem is read-only except /tmp
TMP_DIR = os.getenv('TMP_DIR', tempfile.gettempdir())

FDM_PATHS = [
    r"C:\Program Files\SoftDeluxe\Free Download Manager\fdm.exe",
    r"C:\Program Files (x86)\SoftDeluxe\Free Download Manager\fdm.exe",
    os.path.expandvars(r"%LOCALAPPDATA%\Programs\Free Download Manager\fdm.exe"),
    r"C:\Program Files\Free Download Manager\fdm.exe"
]

def get_fdm_path():
    """Find location of FDM executable on Windows."""
    for path in FDM_PATHS:
        if os.path.exists(path):
            return path
    return None

def prepare_input_file(links, input_file=None):
    """Format and write fuckingfast links into input.txt for download.py."""
    if input_file is None:
        input_file = os.path.join(TMP_DIR, 'input.txt')
    with open(input_file, 'w', encoding='utf-8') as f:
        for link in links:
            link = link.strip()
            if not link.startswith("- "):
                link = f"- {link}"
            f.write(link + "\n")

def run_download_pipeline(links, log_callback=None):
    """
    Executes the download workflow:
    1. Prepares input.txt with raw links
    2. Runs unchanged download.py in an isolated subprocess
    3. Reads resulting download_links.txt
    4. Launches Free Download Manager with direct download links
    """
    if not links:
        return {'status': 'error', 'message': 'No links provided'}

    # 1. Prepare input.txt in writable temp dir
    temp_input = os.path.join(TMP_DIR, 'input.txt')
    prepare_input_file(links, input_file=temp_input)
    if log_callback:
        log_callback(f"Saved {len(links)} links to {temp_input}")

    # Clear previous download_links.txt
    output_file = os.path.join(TMP_DIR, 'download_links.txt')
    if os.path.exists(output_file):
        open(output_file, 'w', encoding='utf-8').close()

    # 2. Spawn download.py as child process, passing temp dir
    cmd = [sys.executable, 'download.py', '--temp-dir', TMP_DIR]
    if log_callback:
        log_callback("Starting download.py processing pipeline...")

    process = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
        encoding='utf-8',
        errors='replace'
    )

    log_history = []
    for line in iter(process.stdout.readline, ''):
        # Strip ANSI escape codes (colorama formatting)
        clean_line = re.sub(r'\x1b\[[0-9;]*[a-zA-Z]', '', line).strip()
        if clean_line:
            log_history.append(clean_line)
            if log_callback:
                log_callback(clean_line)

    process.wait()

    # 3. Read generated direct download links
    direct_links = []
    if os.path.exists(output_file):
        with open(output_file, 'r', encoding='utf-8') as f:
            direct_links = [line.strip() for line in f if line.strip()]

    # Copy links to Windows clipboard for FDM 'Paste urls from clipboard'
    clipboard_copied = False
    if direct_links:
        try:
            links_blob = "\n".join(direct_links)
            p = subprocess.Popen(['clip'], stdin=subprocess.PIPE, close_fds=True)
            p.communicate(input=links_blob.encode('utf-8'))
            clipboard_copied = True
            if log_callback:
                log_callback(f"📋 Copied {len(direct_links)} direct URLs to Windows Clipboard!")
        except Exception as e:
            if log_callback:
                log_callback(f"Could not copy to clipboard: {e}")

    if log_callback:
        log_callback(f"Pipeline finished! Extracted {len(direct_links)} direct download links.")

    return {
        'status': 'success',
        'extracted_count': len(direct_links),
        'direct_links': direct_links,
        'clipboard_copied': clipboard_copied,
        'logs': log_history
    }

if __name__ == '__main__':
    print("Testing FDM Bridge...")
    fdm = get_fdm_path()
    print("FDM Executable:", fdm)
