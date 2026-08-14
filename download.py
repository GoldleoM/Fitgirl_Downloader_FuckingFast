import os
import sys
import re
import argparse
import subprocess
from datetime import datetime

# Optional enhanced HTTP client for modern TLS / Cloudflare bypass
try:
    from curl_cffi import requests as cffi_requests
    HAS_CURL_CFFI = True
except ImportError:
    HAS_CURL_CFFI = False

import cloudscraper
import requests
from bs4 import BeautifulSoup
from colorama import Fore, Style, init

init(autoreset=True)

if sys.platform == "win32":
    try:
        if hasattr(sys.stdout, "reconfigure"):
            sys.stdout.reconfigure(encoding="utf-8")
        if hasattr(sys.stderr, "reconfigure"):
            sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

# --- Path Configuration ---
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

parser = argparse.ArgumentParser(description="FuckingFast link resolver")
parser.add_argument('--temp-dir', default=None,
                    help='Writable directory for input.txt / download_links.txt (default: script/current directory)')
args = parser.parse_args()

if args.temp_dir:
    BASE_DIR = os.path.abspath(args.temp_dir)
    INPUT_PATH = os.path.join(BASE_DIR, 'input.txt')
    OUTPUT_PATH = os.path.join(BASE_DIR, 'download_links.txt')
else:
    # Offline / local CLI mode: use input.txt and download_links.txt in the same folder
    BASE_DIR = SCRIPT_DIR
    if os.path.exists(os.path.abspath('input.txt')):
        INPUT_PATH = os.path.abspath('input.txt')
        OUTPUT_PATH = os.path.abspath('download_links.txt')
    else:
        INPUT_PATH = os.path.join(SCRIPT_DIR, 'input.txt')
        OUTPUT_PATH = os.path.join(SCRIPT_DIR, 'download_links.txt')


class console:
    def __init__(self) -> None:
        self.colors = {
            "green": Fore.GREEN, "red": Fore.RED, "yellow": Fore.YELLOW, "blue": Fore.BLUE,
            "magenta": Fore.MAGENTA, "cyan": Fore.CYAN, "white": Fore.WHITE, "black": Fore.BLACK,
            "reset": Style.RESET_ALL, "lightblack": Fore.LIGHTBLACK_EX, "lightred": Fore.LIGHTRED_EX,
            "lightgreen": Fore.LIGHTGREEN_EX, "lightyellow": Fore.LIGHTYELLOW_EX,
            "lightblue": Fore.LIGHTBLUE_EX, "lightmagenta": Fore.LIGHTMAGENTA_EX,
            "lightcyan": Fore.LIGHTCYAN_EX, "lightwhite": Fore.LIGHTWHITE_EX
        }

    def clear(self):
        if sys.stdout.isatty():
            os.system("cls" if os.name == "nt" else "clear")

    def timestamp(self):
        return datetime.now().strftime("%H:%M:%S")

    def info(self, msg, obj=""):
        obj_str = f" : {self.colors['lightblue']}{obj}" if obj else ""
        print(f"{self.colors['lightblack']}{self.timestamp()} » {self.colors['lightblue']}INFO {self.colors['lightblack']}• {self.colors['white']}{msg}{obj_str}{self.colors['white']} {self.colors['reset']}")

    def success(self, msg, obj=""):
        obj_str = f" : {self.colors['lightgreen']}{obj}" if obj else ""
        print(f"{self.colors['lightblack']}{self.timestamp()} » {self.colors['lightgreen']}SUCC {self.colors['lightblack']}• {self.colors['white']}{msg}{obj_str}{self.colors['white']} {self.colors['reset']}")

    def error(self, msg, obj=""):
        obj_str = f" : {self.colors['lightred']}{obj}" if obj else ""
        print(f"{self.colors['lightblack']}{self.timestamp()} » {self.colors['lightred']}ERRR {self.colors['lightblack']}• {self.colors['white']}{msg}{obj_str}{self.colors['white']} {self.colors['reset']}")

    def warning(self, msg, obj=""):
        obj_str = f" : {self.colors['lightyellow']}{obj}" if obj else ""
        print(f"{self.colors['lightblack']}{self.timestamp()} » {self.colors['lightyellow']}WARN {self.colors['lightblack']}• {self.colors['white']}{msg}{obj_str}{self.colors['white']} {self.colors['reset']}")


log = console()

HEADERS = {
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


def resolve_fuckingfast_url(link, session=None):
    """
    Attempts multiple methods to resolve direct download link from a fuckingfast URL.
    Returns (download_url, error_message).
    """
    clean_url = link.strip()
    if clean_url.startswith("- ") or clean_url.startswith("* "):
        clean_url = clean_url[2:].strip()

    # Extract base URL without fragment
    match_url = re.search(r'(https?://fuckingfast\.co/[^\s#]+)', clean_url)
    target_url = match_url.group(1) if match_url else clean_url

    # Extract file id
    match_id = re.search(r'fuckingfast\.co/(?:f/)?([a-zA-Z0-9]+)', target_url)
    file_id = match_id.group(1) if match_id else None

    html_text = None
    used_session = session

    get_headers = HEADERS.copy()
    get_headers['Referer'] = 'https://fitgirl-repacks.site/'

    # 1. Fetch HTML page
    if HAS_CURL_CFFI:
        try:
            if not isinstance(used_session, cffi_requests.Session):
                used_session = cffi_requests.Session(impersonate="chrome")
            res = used_session.get(target_url, headers=get_headers, timeout=20)
            if res.status_code == 200:
                html_text = res.text
        except Exception:
            pass

    if not html_text:
        try:
            scraper = cloudscraper.create_scraper(
                browser={'browser': 'chrome', 'platform': 'windows', 'desktop': True},
                delay=2
            )
            res = scraper.get(target_url, headers=get_headers, timeout=20)
            if res.status_code == 200:
                html_text = res.text
                used_session = scraper
        except Exception:
            pass

    if not html_text:
        try:
            res = requests.get(target_url, headers=get_headers, timeout=20)
            if res.status_code == 200:
                html_text = res.text
                used_session = requests
        except Exception:
            pass

    if not html_text:
        return None, "Failed to load page (network error or blocked by Cloudflare)"

    soup = BeautifulSoup(html_text, 'html.parser')
    download_url = None

    # Method 1: HTMX hx-post button
    btn = soup.find(attrs={'hx-post': True})
    go_url = None
    if btn and btn.get('hx-post'):
        go_path = btn['hx-post']
        go_url = 'https://fuckingfast.co' + go_path if go_path.startswith('/') else go_path
    elif file_id:
        go_url = f"https://fuckingfast.co/f/{file_id}/go"

    if go_url and used_session:
        post_headers = HEADERS.copy()
        post_headers['HX-Request'] = 'true'
        post_headers['HX-Current-URL'] = target_url
        post_headers['Referer'] = target_url
        post_headers['Origin'] = 'https://fuckingfast.co'
        post_headers['Sec-Fetch-Site'] = 'same-origin'
        post_headers['Sec-Fetch-Mode'] = 'cors'
        post_headers['Sec-Fetch-Dest'] = 'empty'
        try:
            res_go = used_session.post(go_url, headers=post_headers, timeout=15)
            download_url = (res_go.headers.get('HX-Redirect') or 
                            res_go.headers.get('Hx-Redirect') or 
                            res_go.headers.get('hx-redirect') or 
                            res_go.headers.get('Location') or 
                            res_go.headers.get('location'))
            if not download_url and res_go.text:
                match_direct = re.search(r'(https?://dl\.fuckingfast\.co/dl/[^\s"\'<>]+)', res_go.text)
                if match_direct:
                    download_url = match_direct.group(1)
        except Exception:
            pass

    # Method 2: Direct link in HTML
    if not download_url:
        dl_a = soup.find('a', href=re.compile(r'https?://dl\.fuckingfast\.co/dl/'))
        if dl_a:
            download_url = dl_a['href']

    # Method 3: Regex search in script tags
    if not download_url:
        for script in soup.find_all('script'):
            if script.text:
                if "window.open" in script.text:
                    matches = re.findall(r'window\.open\(["\']' + r"(https?://[^\s\"'\)]+)", script.text)
                    if matches:
                        download_url = matches[-1]
                        break
                match_direct = re.search(r'(https?://dl\.fuckingfast\.co/dl/[^\s"\'<>]+)', script.text)
                if match_direct:
                    download_url = match_direct.group(1)
                    break

    if download_url:
        return download_url, None
    return None, "Download URL could not be extracted (Turnstile challenge or missing link)"


def remove_link(processed_link, input_file):
    """Removes the processed link from input.txt safely."""
    try:
        if not os.path.exists(input_file):
            return
        with open(input_file, 'r', encoding="utf-8") as f:
            lines = f.readlines()

        clean_target = processed_link.strip()
        new_lines = []
        removed = False
        for line in lines:
            raw = line.strip()
            clean = raw
            if clean.startswith("- ") or clean.startswith("* "):
                clean = clean[2:].strip()
            if not removed and (clean == clean_target or clean_target in clean):
                removed = True
                continue
            new_lines.append(line)

        with open(input_file, 'w', encoding="utf-8") as f:
            f.writelines(new_lines)
    except Exception as e:
        log.warning("Could not remove link from input file", str(e))


def copy_to_clipboard(text):
    """Copies text to system clipboard (Windows, macOS, Linux)."""
    try:
        if os.name == 'nt':
            p = subprocess.Popen(['clip'], stdin=subprocess.PIPE, close_fds=True)
            p.communicate(input=text.encode('utf-8'))
            return True
        elif sys.platform == 'darwin':
            p = subprocess.Popen(['pbcopy'], stdin=subprocess.PIPE, close_fds=True)
            p.communicate(input=text.encode('utf-8'))
            return True
        else:
            p = subprocess.Popen(['xclip', '-selection', 'clipboard'], stdin=subprocess.PIPE, close_fds=True)
            p.communicate(input=text.encode('utf-8'))
            return True
    except Exception:
        return False


def main():
    log.clear()

    # Check if input.txt exists
    if not os.path.exists(INPUT_PATH):
        try:
            with open(INPUT_PATH, 'w', encoding='utf-8') as f:
                pass
            log.warning("Created empty input.txt", INPUT_PATH)
            log.info("Please paste your FuckingFast links into input.txt and run again.")
        except Exception as e:
            log.error("Could not create input file", str(e))
        return

    # Read input links
    try:
        with open(INPUT_PATH, 'r', encoding="utf-8") as f:
            lines = f.readlines()
    except Exception as e:
        log.error("Could not read input file", str(e))
        return

    links = []
    for line in lines:
        raw = line.strip()
        if not raw:
            continue
        if raw.startswith("- ") or raw.startswith("* "):
            raw = raw[2:].strip()
        if raw.startswith("http://") or raw.startswith("https://"):
            links.append(raw)

    if not links:
        log.warning("No links found in input file", INPUT_PATH)
        log.info("Add links to input.txt (one per line, starting with https://fuckingfast.co/...)")
        return

    log.info("Found links to process", len(links))
    log.info("Input file", INPUT_PATH)
    log.info("Output file", OUTPUT_PATH)

    session = None
    if HAS_CURL_CFFI:
        try:
            session = cffi_requests.Session(impersonate="chrome")
        except Exception:
            session = None

    success_count = 0
    extracted_urls = []

    for i, link in enumerate(links):
        log.info(f"Processing ({i+1}/{len(links)})", link)
        download_url, error = resolve_fuckingfast_url(link, session=session)

        if not download_url:
            log.error("Failed to resolve", f"{link} ({error})")
            continue

        log.success("Found download URL", download_url)
        extracted_urls.append(download_url)
        success_count += 1

        # Write to output file immediately
        try:
            with open(OUTPUT_PATH, "a", encoding="utf-8") as f:
                f.write(download_url + "\n")
        except Exception as e:
            log.error("Failed writing to output file", str(e))

        # Remove processed link from input file
        remove_link(link, INPUT_PATH)

    if extracted_urls:
        log.success("Extraction finished!", f"{success_count}/{len(links)} links saved to {OUTPUT_PATH}")
        clipboard_text = "\n".join(extracted_urls)
        if copy_to_clipboard(clipboard_text):
            log.success("Clipboard", f"{len(extracted_urls)} direct links copied to clipboard for FDM!")
    else:
        log.error("Completed", f"0/{len(links)} links could be extracted.")


if __name__ == '__main__':
    main()
