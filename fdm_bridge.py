import os
import sys
import subprocess
import time
import re
import tempfile
import cloudscraper
from bs4 import BeautifulSoup

# Vercel's filesystem is read-only except /tmp
TMP_DIR = os.getenv('TMP_DIR', tempfile.gettempdir())

# Shared scraper instance for in-process resolution
_resolver_scraper = None

def _get_resolver_scraper(force_new=False):
    global _resolver_scraper
    if _resolver_scraper is None or force_new:
        _resolver_scraper = cloudscraper.create_scraper(
            browser={
                'browser': 'chrome',
                'platform': 'windows',
                'desktop': True
            },
            delay=2
        )
    return _resolver_scraper

RESOLVE_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Ch-Ua': '"Chromium";v="126", "Google Chrome";v="126", "Not-A.Brand";v="8"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"Windows"',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Cache-Control': 'max-age=0'
}

def resolve_single_link(link, retry_count=0):
    """Resolve a single FuckingFast link to its direct download URL. Returns (link, direct_url_or_None, error_or_None)."""
    scraper = _get_resolver_scraper(force_new=(retry_count > 0))
    link = link.strip()
    
    get_headers = RESOLVE_HEADERS.copy()
    get_headers['Referer'] = 'https://fitgirl-repacks.site/'
    
    try:
        response = scraper.get(link, headers=get_headers, timeout=25)
    except Exception as e:
        if retry_count < 2:
            import time
            time.sleep(1 + retry_count)
            return resolve_single_link(link, retry_count + 1)
        return (link, None, f"Request failed: {e}")
    
    if response.status_code == 403:
        if retry_count < 2:
            import time
            time.sleep(2 + retry_count)
            return resolve_single_link(link, retry_count + 1)
        return (link, None, f"Blocked by Cloudflare (403). Datacenter IPs may be blocked.")
    
    if response.status_code != 200:
        return (link, None, f"Bad status: {response.status_code}")
    
    download_url = None
    soup = BeautifulSoup(response.text, 'html.parser')

    # Method 1: HTMX hx-post button
    btn = soup.find(attrs={'hx-post': True})
    if btn and btn.get('hx-post'):
        go_path = btn['hx-post']
        go_url = 'https://fuckingfast.co' + go_path if go_path.startswith('/') else go_path
        post_headers = RESOLVE_HEADERS.copy()
        post_headers['HX-Request'] = 'true'
        post_headers['HX-Current-URL'] = link
        post_headers['Referer'] = link
        post_headers['Origin'] = 'https://fuckingfast.co'
        post_headers['Sec-Fetch-Site'] = 'same-origin'
        post_headers['Sec-Fetch-Mode'] = 'cors'
        post_headers['Sec-Fetch-Dest'] = 'empty'
        try:
            res_go = scraper.post(go_url, headers=post_headers, timeout=15)
            download_url = res_go.headers.get('HX-Redirect') or res_go.headers.get('Hx-Redirect') or res_go.headers.get('hx-redirect')
        except Exception:
            pass

    # Method 2: Direct POST to /f/{file_id}/go
    if not download_url:
        match_id = re.search(r'fuckingfast\.co/(?:f/)?([a-zA-Z0-9]+)', link)
        if match_id:
            file_id = match_id.group(1)
            go_url = f"https://fuckingfast.co/f/{file_id}/go"
            post_headers = RESOLVE_HEADERS.copy()
            post_headers['HX-Request'] = 'true'
            post_headers['HX-Current-URL'] = link
            post_headers['Referer'] = link
            post_headers['Origin'] = 'https://fuckingfast.co'
            post_headers['Sec-Fetch-Site'] = 'same-origin'
            post_headers['Sec-Fetch-Mode'] = 'cors'
            post_headers['Sec-Fetch-Dest'] = 'empty'
            try:
                res_go = scraper.post(go_url, headers=post_headers, timeout=15)
                download_url = res_go.headers.get('HX-Redirect') or res_go.headers.get('Hx-Redirect') or res_go.headers.get('hx-redirect')
            except Exception:
                pass

    # Method 3: Legacy window.open in script tags
    if not download_url:
        script_tags = soup.find_all('script')
        for script in script_tags:
            if script.text and "window.open" in script.text:
                matches = re.findall(r'window\.open\(["\']' + r"(https?://[^\s\"'\)]+)", script.text)
                if matches:
                    download_url = matches[-1]
                    break

    if download_url:
        return (link, download_url, None)
    return (link, None, "Download URL not found")


def resolve_links_sync(links, log_callback=None):
    """
    Resolve FuckingFast links synchronously in-process.
    No subprocess, no file I/O, no threads — works in Vercel serverless.
    Returns dict with status, direct_links list, and logs.
    """
    if not links:
        return {'status': 'error', 'message': 'No links provided', 'direct_links': [], 'extracted_count': 0}

    direct_links = []
    logs = []
    total = len(links)

    if log_callback:
        log_callback(f"Starting extraction for {total} FuckingFast links...")

    for i, link in enumerate(links):
        link = link.strip()
        if not link:
            continue
            
        short_id = re.search(r'fuckingfast\.co/(?:f/)?([a-zA-Z0-9_-]+)', link)
        part_name = f"Part ({short_id.group(1)[:12]})" if short_id else link[:30]
        
        if log_callback:
            log_callback(f"Resolving {part_name}... ({i+1}/{total})")
        
        _, direct_url, error = resolve_single_link(link)
        
        if direct_url:
            direct_links.append(direct_url)
            msg = f"Extracted part {len(direct_links)} of {total}"
            logs.append(msg)
            if log_callback:
                log_callback(msg)
        else:
            msg = f"Failed to resolve {part_name}: {error}"
            logs.append(msg)
            if log_callback:
                log_callback(msg)

    if log_callback:
        log_callback(f"Pipeline finished! Extracted {len(direct_links)} of {total} direct download links.")

    return {
        'status': 'success' if direct_links else 'error',
        'extracted_count': len(direct_links),
        'direct_links': direct_links,
        'clipboard_copied': False,
        'logs': logs
    }

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
    script_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'download.py')
    cmd = [sys.executable, script_path, '--temp-dir', TMP_DIR]
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
