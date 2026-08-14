import os
import sys
import time
import queue
import argparse
import threading
from datetime import datetime
from typing import Optional, List, Dict, Any
from colorama import Fore, Style, init
from DrissionPage import ChromiumPage, ChromiumOptions
import firestore_db

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
        self.lock = threading.Lock()

    def clear(self):
        os.system("cls" if os.name == "nt" else "clear")

    def timestamp(self):
        return datetime.now().strftime("%H:%M:%S")

    def info(self, msg, obj=""):
        with self.lock:
            print(f"{self.colors['lightblack']}[{self.timestamp()}] {self.colors['lightblue']}INFO {self.colors['lightblack']}• {self.colors['white']}{msg} {self.colors['lightblue']}{obj}{self.colors['reset']}")

    def success(self, msg, obj=""):
        with self.lock:
            print(f"{self.colors['lightblack']}[{self.timestamp()}] {self.colors['lightgreen']}SUCC {self.colors['lightblack']}• {self.colors['white']}{msg} {self.colors['lightgreen']}{obj}{self.colors['reset']}")

    def error(self, msg, obj=""):
        with self.lock:
            print(f"{self.colors['lightblack']}[{self.timestamp()}] {self.colors['lightred']}ERRR {self.colors['lightblack']}• {self.colors['white']}{msg} {self.colors['lightred']}{obj}{self.colors['reset']}")

    def warning(self, msg, obj=""):
        with self.lock:
            print(f"{self.colors['lightblack']}[{self.timestamp()}] {self.colors['lightyellow']}WARN {self.colors['lightblack']}• {self.colors['white']}{msg} {self.colors['lightyellow']}{obj}{self.colors['reset']}")


log = Console()


def find_browser_path() -> Optional[str]:
    """Finds an installed Chromium browser executable."""
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


class ParallelGameResolver:
    """Multi-tab parallel processor with immediate graceful exit on rate limit detection."""

    def __init__(self, max_concurrency: int = 8, visible: bool = False):
        self.max_concurrency = max_concurrency
        self.visible = visible
        self.inter_request_delay = 0.20
        self.page_load_timeout = 16
        self.turnstile_timeout = 20
        self.micro_poll_interval = 0.02
        self.max_retries = 3

        self.browser_path = find_browser_path()
        self.page: Optional[ChromiumPage] = None
        self.worker_tabs = []

        self.rate_limited = False
        self.rate_limit_source = ""
        self.stop_event = threading.Event()

    def start(self):
        opts = ChromiumOptions()
        if self.browser_path:
            opts.set_browser_path(self.browser_path)

        if not self.visible:
            opts.set_argument('--window-position=-32000,-32000')
            opts.set_argument('--window-size=1280,800')
        else:
            opts.set_argument('--window-position=50,50')
            opts.set_argument('--window-size=1440,900')
            opts.set_argument('--start-maximized')

        opts.set_argument('--blink-settings=imagesEnabled=false')
        opts.set_argument('--disable-gpu')
        opts.set_argument('--disable-extensions')
        opts.set_argument('--disable-notifications')
        opts.set_argument('--mute-audio')
        opts.set_load_mode('eager')

        mode_str = "Visible Debug Window" if self.visible else "Invisible Stealth (Off-Screen)"
        log.info(f"🚀 Initializing Parallel Chromium Engine ({self.max_concurrency} max tabs | Mode: {mode_str})...")
        self.page = ChromiumPage(opts)

    def stop(self):
        self.stop_event.set()
        if self.page:
            try:
                self.page.quit()
            except Exception:
                pass
            self.page = None

    def check_for_rate_limit(self, tab_instance, status_code: int = 200, response_text: str = "") -> bool:
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

    def trigger_rate_limit_exit(self, source: str):
        """Immediately flag rate limit and halt worker processing."""
        self.rate_limited = True
        self.rate_limit_source = source
        self.stop_event.set()

    def resolve_game(self, raw_links: List[str], game_title: str) -> List[str]:
        if self.rate_limited or self.stop_event.is_set():
            return []

        clean_links = []
        for line in raw_links:
            l = line.strip()
            if l.startswith("- ") or l.startswith("* "):
                l = l[2:].strip()
            if l.startswith("http://") or l.startswith("https://"):
                clean_links.append(l)

        total_parts = len(clean_links)
        if not clean_links:
            return []

        pool_size = min(self.max_concurrency, total_parts)

        # Warm up session on master tab first
        log.info(f"[{game_title}] 🔥 Warming up Cloudflare session clearance on tab 1...")
        try:
            self.page.latest_tab.get(clean_links[0], retry=1, timeout=self.page_load_timeout)
            
            if self.check_for_rate_limit(self.page.latest_tab):
                self.trigger_rate_limit_exit(f"Warmup page on {game_title}")
                return []

            warm_btn = self.page.latest_tab.ele('text:DOWNLOAD', timeout=8)
            if warm_btn:
                for _ in range(100):
                    if self.stop_event.is_set():
                        break
                    style = warm_btn.attr('style')
                    if not style or ('opacity' not in style and '0.5' not in style):
                        break
                    time.sleep(0.05)
            log.success(f"[{game_title}] Session warmed up! Launching {pool_size} parallel tabs...")
        except Exception as e:
            log.warning("Warmup notice:", str(e))

        if self.rate_limited or self.stop_event.is_set():
            return []

        # Ensure worker tabs match pool size
        worker_tabs = [self.page.latest_tab]
        while len(worker_tabs) < pool_size:
            worker_tabs.append(self.page.new_tab())

        links_queue = queue.Queue()
        for item in enumerate(clean_links, start=1):
            links_queue.put((*item, 0))  # (index, url, retry_count)

        extracted_results = []
        results_lock = threading.Lock()
        start_time_game = time.time()

        def worker_thread(worker_id: int, tab):
            while not self.stop_event.is_set():
                try:
                    idx, link, retries = links_queue.get_nowait()
                except queue.Empty:
                    break

                file_id = link.split('/')[-1].split('#')[0]
                retry_msg = f" (Retry {retries}/{self.max_retries})" if retries > 0 else ""
                log.info(f"[{idx:03d}/{total_parts:03d}] [T#{worker_id:02d}] Navigating ->", f"{link}{retry_msg}")
                start_t = time.time()

                try:
                    time.sleep(self.inter_request_delay)
                    tab.get(link, retry=1, timeout=self.page_load_timeout)

                    if self.check_for_rate_limit(tab):
                        log.warning(f"⚠️ Rate limit detected on Part #{idx} -> Triggering immediate exit!")
                        self.trigger_rate_limit_exit(f"Part #{idx} navigation ({link})")
                        links_queue.task_done()
                        break

                    btn = tab.ele('text:DOWNLOAD', timeout=self.page_load_timeout)
                    if not btn:
                        if self.check_for_rate_limit(tab):
                            log.warning(f"⚠️ Rate limit / challenge block detected on Part #{idx} -> Triggering immediate exit!")
                            self.trigger_rate_limit_exit(f"Part #{idx} button check ({link})")
                            links_queue.task_done()
                            break

                        if retries < self.max_retries:
                            backoff = 1.5 * (retries + 1)
                            log.warning(f"[{idx:03d}/{total_parts:03d}] [T#{worker_id:02d}] Button missing, retrying in {backoff:.1f}s...", link)
                            time.sleep(backoff)
                            links_queue.put((idx, link, retries + 1))
                        else:
                            log.error(f"[{idx:03d}/{total_parts:03d}] [T#{worker_id:02d}] Download button not found:", link)
                        continue

                    active = False
                    for _ in range(int(self.turnstile_timeout / self.micro_poll_interval)):
                        if self.stop_event.is_set():
                            break
                        try:
                            style = btn.attr('style')
                            if not style or ('opacity' not in style and '0.5' not in style):
                                active = True
                                break
                        except Exception:
                            pass
                        time.sleep(self.micro_poll_interval)

                    if self.stop_event.is_set():
                        break

                    if not active:
                        if self.check_for_rate_limit(tab):
                            log.warning(f"⚠️ Rate limit / Turnstile block detected on Part #{idx} -> Triggering immediate exit!")
                            self.trigger_rate_limit_exit(f"Part #{idx} Turnstile ({link})")
                            links_queue.task_done()
                            break

                        if retries < self.max_retries:
                            backoff = 2.0 * (retries + 1)
                            log.warning(f"[{idx:03d}/{total_parts:03d}] [T#{worker_id:02d}] Turnstile slow, retry backoff {backoff:.1f}s...", link)
                            time.sleep(backoff)
                            links_queue.put((idx, link, retries + 1))
                        else:
                            log.warning(f"[{idx:03d}/{total_parts:03d}] [T#{worker_id:02d}] Turnstile timeout for", link)
                        continue

                    js_extract = f'''
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

                    xhr_res = tab.run_js(js_extract)
                    status_code = xhr_res.get('status', 0) if isinstance(xhr_res, dict) else 200
                    body_text = xhr_res.get('body', '') if isinstance(xhr_res, dict) else ''
                    dl_url = xhr_res.get('redirect') if isinstance(xhr_res, dict) else xhr_res

                    if self.check_for_rate_limit(tab, status_code=status_code, response_text=body_text):
                        log.warning(f"⚠️ Rate limit detected on XHR (HTTP {status_code}) for Part #{idx} -> Triggering immediate exit!")
                        self.trigger_rate_limit_exit(f"Part #{idx} XHR HTTP {status_code} ({link})")
                        links_queue.task_done()
                        break

                    elapsed_ms = (time.time() - start_t) * 1000

                    if dl_url and isinstance(dl_url, str) and (dl_url.startswith("http://") or dl_url.startswith("https://")):
                        with results_lock:
                            extracted_results.append((idx, dl_url))
                        log.success(f"[{idx:03d}/{total_parts:03d}] [T#{worker_id:02d}] Extracted in {elapsed_ms:.0f}ms ->", dl_url)
                    else:
                        if retries < self.max_retries:
                            log.warning(f"[{idx:03d}/{total_parts:03d}] Empty XHR response, retrying...", link)
                            time.sleep(1.5)
                            links_queue.put((idx, link, retries + 1))
                        else:
                            log.warning(f"[{idx:03d}/{total_parts:03d}] [T#{worker_id:02d}] Empty URL for", link)

                except Exception as e:
                    if retries < self.max_retries:
                        time.sleep(1.5)
                        links_queue.put((idx, link, retries + 1))
                    else:
                        log.error(f"[{idx:03d}/{total_parts:03d}] [T#{worker_id:02d}] Error:", str(e))
                finally:
                    links_queue.task_done()

        # Start worker threads with stagger
        threads = []
        for w_id, w_tab in enumerate(worker_tabs, start=1):
            t = threading.Thread(target=worker_thread, args=(w_id, w_tab), daemon=True)
            threads.append(t)
            t.start()
            time.sleep(0.15)

        try:
            while not links_queue.empty() or any(t.is_alive() for t in threads):
                if self.stop_event.is_set():
                    break
                time.sleep(0.2)
        except KeyboardInterrupt:
            log.warning("\n[INTERRUPTED] Stopping game workers...")
            self.stop_event.set()

        # Sort strictly in numerical part order
        extracted_results.sort(key=lambda x: x[0])
        ordered_direct_links = [url for _, url in extracted_results]

        # Close extra tabs for clean state on next game
        for extra_tab in worker_tabs[1:]:
            try:
                extra_tab.close()
            except Exception:
                pass

        total_elapsed = time.time() - start_time_game
        avg_ms = (total_elapsed / total_parts) * 1000 if total_parts else 0
        log.success(f"⚡ COMPLETE! {len(ordered_direct_links)}/{total_parts} links extracted in {total_elapsed:.3f}s ({avg_ms:.0f}ms avg/link).")

        return ordered_direct_links


def run_crawler(limit: Optional[int] = None, slug: Optional[str] = None, concurrency: int = 8, visible: bool = False):
    log.clear()
    log.info("🔥 ===================================================================")
    log.info("🚀 FITGIRL PARALLEL LINK RESOLVER (FIRESTORE ENGINE)")
    log.info("🔥 ===================================================================")

    db = firestore_db.init_firestore()
    if not firestore_db.is_firestore_connected():
        log.warning("Firestore not connected. Will read/write to local games_db.json fallback.")

    unresolved_games = []
    if slug:
        game = firestore_db.get_game_by_slug(slug)
        if not game:
            log.error(f"Game with slug '{slug}' not found in database.")
            return
        if game.get('resolved') and game.get('direct_links'):
            log.info(f"Game '{game.get('title')}' is already resolved with {len(game['direct_links'])} links.")
        unresolved_games = [game]
    else:
        unresolved_games = firestore_db.get_unresolved_games(limit=limit)

    if not unresolved_games:
        log.success("🎉 All games in the database already have direct download links! Nothing to resolve.")
        return

    total_games = len(unresolved_games)
    total_parts_all = sum(len(g.get('fuckingfast_links', [])) for g in unresolved_games)
    log.info(f"Found {total_games} unresolved games ({total_parts_all} total parts) waiting in queue.")

    resolver = ParallelGameResolver(max_concurrency=concurrency, visible=visible)
    resolver.start()

    resolved_count = 0
    start_all = time.time()

    try:
        for idx, game in enumerate(unresolved_games, start=1):
            if resolver.rate_limited:
                break

            title = game.get('title', 'Unknown Game')
            game_slug = game.get('slug')
            raw_links: List[str] = game.get('fuckingfast_links', [])

            if not raw_links:
                log.warning(f"[{idx}/{total_games}] Skipping '{title}'", "No links found in doc.")
                continue

            total_parts = len(raw_links)
            log.info("-" * 65)
            log.info(f"🎮 [{idx}/{total_games}] Processing: '{title}' ({total_parts} parts)")
            log.info("-" * 65)

            direct_links = resolver.resolve_game(raw_links, game_title=title)

            if direct_links:
                firestore_db.update_game_links(game_slug, direct_links)
                resolved_count += 1
                log.success(f"💾 Updated '{title}' in Firestore ({len(direct_links)}/{total_parts} direct parts active)!\n")
            else:
                if resolver.rate_limited:
                    log.warning(f"⚠️ Halting processing on '{title}' due to rate limit detection.\n")
                    break
                else:
                    log.error(f"❌ Failed to extract direct links for '{title}'.\n")

            time.sleep(1.0)

    except KeyboardInterrupt:
        log.warning("\n[STOPPED] Crawler interrupted by user.")
    finally:
        resolver.stop()

    total_elapsed = time.time() - start_all
    log.info("=" * 65)
    if resolver.rate_limited:
        log.warning(f"🛑 STOPPED DUE TO RATE LIMIT: [{resolver.rate_limit_source}]")
        log.success(f"💾 All progress before the rate limit is safely saved in Firestore ({resolved_count}/{total_games} games resolved in {total_elapsed:.1f}s).")
        log.info("💡 You can simply run `python fetch_missing_links.py` again later whenever you want to resume!")
    else:
        log.success(f"🏁 RESOLUTION COMPLETE! Successfully processed {resolved_count}/{total_games} games in {total_elapsed:.1f}s.")
    log.info("=" * 65)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="High-Speed Parallel DrissionPage Link Resolver for Firestore")
    parser.add_argument("--slug", type=str, default=None, help="Resolve only a specific game by slug")
    parser.add_argument("--limit", type=int, default=None, help="Maximum number of unresolved games to process")
    parser.add_argument("--concurrency", type=int, default=8, help="Number of parallel tabs (default: 8)")
    parser.add_argument("--visible", action="store_true", help="Show browser window for debugging")
    args = parser.parse_args()

    run_crawler(limit=args.limit, slug=args.slug, concurrency=args.concurrency, visible=args.visible)
