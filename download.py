import os
import sys
import time
from colorama import Fore, Style, init
from DrissionPage import ChromiumPage, ChromiumOptions

if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

init(autoreset=True)


class Console:
    def __init__(self) -> None:
        self.colors = {
            "green": Fore.GREEN, "red": Fore.RED, "yellow": Fore.YELLOW, "blue": Fore.BLUE,
            "magenta": Fore.MAGENTA, "cyan": Fore.CYAN, "white": Fore.WHITE, "reset": Style.RESET_ALL,
            "lightblack": Fore.LIGHTBLACK_EX, "lightgreen": Fore.LIGHTGREEN_EX, "lightcyan": Fore.LIGHTCYAN_EX,
            "lightblue": Fore.LIGHTBLUE_EX, "lightyellow": Fore.LIGHTYELLOW_EX, "lightred": Fore.LIGHTRED_EX
        }

    def clear(self):
        os.system("cls" if os.name == "nt" else "clear")

    def timestamp(self):
        return time.strftime("%H:%M:%S")

    def info(self, msg, obj=""):
        print(f"{self.colors['lightblack']}[{self.timestamp()}] {self.colors['lightblue']}INFO {self.colors['lightblack']}• {self.colors['white']}{msg} {self.colors['lightblue']}{obj}{self.colors['reset']}")

    def success(self, msg, obj=""):
        print(f"{self.colors['lightblack']}[{self.timestamp()}] {self.colors['lightgreen']}SUCC {self.colors['lightblack']}• {self.colors['white']}{msg} {self.colors['lightgreen']}{obj}{self.colors['reset']}")

    def error(self, msg, obj=""):
        print(f"{self.colors['lightblack']}[{self.timestamp()}] {self.colors['lightred']}ERRR {self.colors['lightblack']}• {self.colors['white']}{msg} {self.colors['lightred']}{obj}{self.colors['reset']}")

    def warning(self, msg, obj=""):
        print(f"{self.colors['lightblack']}[{self.timestamp()}] {self.colors['lightyellow']}WARN {self.colors['lightblack']}• {self.colors['white']}{msg} {self.colors['lightyellow']}{obj}{self.colors['reset']}")


log = Console()
log.clear()


def find_browser_path():
    candidates = [
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        os.path.expandvars(r"%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"),
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe",
    ]
    for p in candidates:
        if os.path.isfile(p):
            return p
    return None


input_path = "input.txt"
output_path = "download_links.txt"

try:
    with open(input_path, 'r', encoding="utf-8") as f:
        raw_lines = f.readlines()
except FileNotFoundError:
    log.error("Input file not found", input_path)
    raw_lines = []

links = []
for line in raw_lines:
    line = line.strip()
    if line.startswith("- ") or line.startswith("* "):
        line = line[2:].strip()
    if line.startswith("http://") or line.startswith("https://"):
        links.append(line)

total_links = len(links)
log.info(f"Loaded {total_links} links from {input_path}")

if not links:
    log.error("No valid URLs found. Exiting.")
    sys.exit(0)

# Clear existing output file
with open(output_path, "w", encoding="utf-8") as f:
    pass

def check_for_rate_limit(tab_instance, status_code: int = 200, response_text: str = "") -> bool:
    if status_code in (429, 503):
        return True
    try:
        page_text = (tab_instance.text or "").lower()
        page_html = (tab_instance.html or "").lower()
    except Exception:
        page_text, page_html = "", ""

    combined = f"{page_text} {page_html} {response_text.lower()}"
    rate_limit_keywords = [
        "error 1015", "rate limited", "you are being rate limited", "too many requests",
        "please try again later", "please wait a few minutes", "retry-after"
    ]
    return any(kw in combined for kw in rate_limit_keywords)

browser_path = find_browser_path()
opts = ChromiumOptions()
if browser_path:
    opts.set_browser_path(browser_path)

log.info("🚀 Launching Chromium Engine...")
page = ChromiumPage(opts)

extracted_count = 0
start_time = time.time()
rate_limited = False

try:
    for idx, link in enumerate(links, start=1):
        t0 = time.time()
        log.info(f"[{idx:03d}/{total_links:03d}] Navigating ->", link)

        try:
            page.get(link)
        except Exception as e:
            log.error(f"[{idx:03d}/{total_links:03d}] Request failed:", str(e))
            continue

        if check_for_rate_limit(page):
            log.warning(f"⚠️ RATE LIMIT DETECTED on Link #{idx} -> Exiting immediately!")
            rate_limited = True
            break

        btn = page.ele('text:DOWNLOAD', timeout=15)
        if not btn:
            if check_for_rate_limit(page):
                log.warning(f"⚠️ Rate limit / challenge block on Link #{idx} -> Exiting immediately!")
                rate_limited = True
                break
            log.error(f"[{idx:03d}/{total_links:03d}] Download button not found:", link)
            continue

        active = False
        for _ in range(30):
            try:
                style = btn.attr('style')
                if not style or ('opacity' not in style and '0.5' not in style):
                    active = True
                    break
            except Exception:
                pass
            time.sleep(0.5)

        download_url = None
        if active:
            file_id = link.split('/')[-1].split('#')[0]
            js = f'''
                var xhr = new XMLHttpRequest();
                xhr.open('POST', '/f/{file_id}/go', false);
                xhr.setRequestHeader('HX-Request', 'true');
                xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
                try {{
                    xhr.send('cf-turnstile-response=' + encodeURIComponent(window.turnstileToken || ''));
                    return {{
                        status: xhr.status,
                        redirect: xhr.getResponseHeader('hx-redirect'),
                        body: xhr.responseText ? xhr.responseText.substring(0, 300) : ''
                    }};
                }} catch (e) {{
                    return {{ status: -1, error: e.toString() }};
                }}
            '''
            try:
                xhr_res = page.run_js(js)
                status_code = xhr_res.get('status', 0) if isinstance(xhr_res, dict) else 200
                body_text = xhr_res.get('body', '') if isinstance(xhr_res, dict) else ''
                download_url = xhr_res.get('redirect') if isinstance(xhr_res, dict) else xhr_res

                if check_for_rate_limit(page, status_code=status_code, response_text=body_text):
                    log.warning(f"⚠️ Rate limit detected on XHR (HTTP {status_code}) -> Exiting immediately!")
                    rate_limited = True
                    break
            except Exception as e:
                log.warning(f"[{idx:03d}/{total_links:03d}] XHR error:", str(e))

        elapsed = time.time() - t0
        if download_url and isinstance(download_url, str) and (download_url.startswith("http://") or download_url.startswith("https://")):
            extracted_count += 1
            with open(output_path, "a", encoding="utf-8") as f:
                f.write(download_url + "\n")
            log.success(f"[{idx:03d}/{total_links:03d}] Extracted in {elapsed:.1f}s ->", download_url)
        else:
            log.error(f"[{idx:03d}/{total_links:03d}] Failed after {elapsed:.1f}s:", link)

        time.sleep(0.3)

except KeyboardInterrupt:
    log.warning("\n[STOPPED] Stopped by user.")
finally:
    try:
        page.quit()
    except Exception:
        pass

total_elapsed = time.time() - start_time
log.info("=" * 65)
if rate_limited:
    log.warning("🛑 STOPPED EARLY: Rate limit detected!")
    log.success(f"💾 All links extracted up to this point are safely written to: {output_path} ({extracted_count}/{total_links} links in {total_elapsed:.1f}s).")
    log.info("💡 You can run `python download.py` again later whenever you want to continue.")
else:
    log.success(f"⚡ COMPLETE! Extracted {extracted_count}/{total_links} links in {total_elapsed:.1f}s.")
    log.success(f"📁 Output file: {output_path}")
log.info("=" * 65)
