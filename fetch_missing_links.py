import os
import sys
import time
import queue
import random
import argparse
import threading
from datetime import datetime
from typing import Optional, List, Dict, Any
from colorama import Fore, Style, init
from DrissionPage import ChromiumPage, ChromiumOptions
import firestore_db

if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
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
            safe_msg = str(msg).encode(sys.stdout.encoding or 'utf-8', errors='replace').decode(sys.stdout.encoding or 'utf-8')
            safe_obj = str(obj).encode(sys.stdout.encoding or 'utf-8', errors='replace').decode(sys.stdout.encoding or 'utf-8')
            print(f"{self.colors['lightblack']}[{self.timestamp()}] {self.colors['lightblue']}INFO {self.colors['lightblack']}• {self.colors['white']}{safe_msg} {self.colors['lightblue']}{safe_obj}{self.colors['reset']}")

    def success(self, msg, obj=""):
        with self.lock:
            safe_msg = str(msg).encode(sys.stdout.encoding or 'utf-8', errors='replace').decode(sys.stdout.encoding or 'utf-8')
            safe_obj = str(obj).encode(sys.stdout.encoding or 'utf-8', errors='replace').decode(sys.stdout.encoding or 'utf-8')
            print(f"{self.colors['lightblack']}[{self.timestamp()}] {self.colors['lightgreen']}SUCC {self.colors['lightblack']}• {self.colors['white']}{safe_msg} {self.colors['lightgreen']}{safe_obj}{self.colors['reset']}")

    def error(self, msg, obj=""):
        with self.lock:
            safe_msg = str(msg).encode(sys.stdout.encoding or 'utf-8', errors='replace').decode(sys.stdout.encoding or 'utf-8')
            safe_obj = str(obj).encode(sys.stdout.encoding or 'utf-8', errors='replace').decode(sys.stdout.encoding or 'utf-8')
            print(f"{self.colors['lightblack']}[{self.timestamp()}] {self.colors['lightred']}ERRR {self.colors['lightblack']}• {self.colors['white']}{safe_msg} {self.colors['lightred']}{safe_obj}{self.colors['reset']}")

    def warning(self, msg, obj=""):
        with self.lock:
            safe_msg = str(msg).encode(sys.stdout.encoding or 'utf-8', errors='replace').decode(sys.stdout.encoding or 'utf-8')
            safe_obj = str(obj).encode(sys.stdout.encoding or 'utf-8', errors='replace').decode(sys.stdout.encoding or 'utf-8')
            print(f"{self.colors['lightblack']}[{self.timestamp()}] {self.colors['lightyellow']}WARN {self.colors['lightblack']}• {self.colors['white']}{safe_msg} {self.colors['lightyellow']}{safe_obj}{self.colors['reset']}")


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


class HighSpeedGameResolver:
    """Rate-limit immune link resolver with global barrier cooldown, jitter pacing, and smart partial completion."""

    def __init__(
        self,
        max_concurrency: int = 1,
        request_delay: float = 0.8,
        cooldown_seconds: float = 60.0,
        visible: bool = False
    ):
        self.max_concurrency = max(1, max_concurrency)
        self.request_delay = request_delay
        self.cooldown_seconds = cooldown_seconds
        self.visible = visible

        self.page_load_timeout = 16
        self.turnstile_timeout = 22
        self.max_retries = 4

        self.browser_path = find_browser_path()
        self.page: Optional[ChromiumPage] = None
        self.tab_pool = []

        self.rate_limited = False
        self.rate_limit_source = ""
        self.stop_event = threading.Event()
        
        # Global synchronized cooldown barrier across all workers
        self.cooldown_lock = threading.Lock()
        self.is_cooling_down = False
        self.cooldown_until = 0.0

    def start(self):
        opts = ChromiumOptions()
        if self.browser_path:
            opts.set_browser_path(self.browser_path)

        if self.visible:
            opts.set_argument('--window-position=50,50')
            opts.set_argument('--window-size=1440,900')
            opts.set_argument('--start-maximized')

        mode_str = "Visible Browser Window" if self.visible else "Stealth Background Browser"
        log.info(f"🚀 Initializing Resolver ({self.max_concurrency} tab(s) | {self.request_delay}s safe pace | Mode: {mode_str})...")
        self.page = ChromiumPage(opts)

        # Pre-create worker tab pool
        self.tab_pool = [self.page.latest_tab]
        while len(self.tab_pool) < self.max_concurrency:
            self.tab_pool.append(self.page.new_tab())
            time.sleep(0.2)

    def stop(self):
        self.stop_event.set()
        if self.page:
            try:
                self.page.quit()
            except Exception:
                pass
            self.page = None
            self.tab_pool = []

    def check_for_rate_limit(self, tab_instance, status_code: int = 200, response_text: str = "") -> bool:
        if status_code in (429, 503, 504, 529):
            return True
        try:
            page_html = (tab_instance.html or "").lower()
        except Exception:
            page_html = ""

        combined = f"{page_html} {response_text.lower()}"
        rate_limit_keywords = [
            "rate limited", "error 1015", "you are being rate limited", "too many requests",
            "please try again later", "please wait a few minutes", "retry-after"
        ]
        return any(kw in combined for kw in rate_limit_keywords)

    def trigger_global_cooldown(self, source: str):
        """Pauses ALL workers together until the rate limit window expires."""
        with self.cooldown_lock:
            now = time.time()
            if now < self.cooldown_until:
                # Cooldown already active from another thread
                return

            self.cooldown_until = now + self.cooldown_seconds + random.uniform(3.0, 8.0)
            wait_time = int(self.cooldown_until - now)
            log.warning(f"🛑 Server Rate Limit Detected [{source}]! Entering {wait_time}s global cooldown...")

            while time.time() < self.cooldown_until:
                if self.stop_event.is_set():
                    return
                remaining = int(self.cooldown_until - time.time())
                if remaining > 0 and remaining % 15 == 0:
                    log.info(f"⏳ Cooling down... {remaining}s remaining before resuming queue.")
                time.sleep(1.0)

            log.success("🎉 Cooldown complete! Resuming link resolution queue...")

    def wait_if_in_cooldown(self):
        """Worker checks if global cooldown is in effect and pauses until clear."""
        while time.time() < self.cooldown_until:
            if self.stop_event.is_set():
                return
            time.sleep(0.5)

    def resolve_game(self, raw_links: List[str], game_title: str, existing_direct_links: Optional[List[str]] = None) -> List[str]:
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

        # Reconstruct state with any existing verified direct links
        merged_results: List[Optional[str]] = [None] * total_parts
        if existing_direct_links:
            for i, direct_url in enumerate(existing_direct_links):
                if i < total_parts and direct_url and direct_url.startswith("http") and ("/dl/" in direct_url or "dl.fuckingfast.co" in direct_url):
                    merged_results[i] = direct_url

        cached_count = sum(1 for u in merged_results if u is not None)
        needed_count = total_parts - cached_count

        if needed_count == 0:
            log.success(f"[{game_title}] All {total_parts} parts already cached in database!")
            return [u for u in merged_results if u]

        if cached_count > 0:
            log.info(f"[{game_title}] ⚡ Resuming: {cached_count}/{total_parts} parts already direct. Fetching remaining {needed_count} parts...")

        links_queue = queue.Queue()
        for idx, link in enumerate(clean_links, start=1):
            if merged_results[idx - 1] is None:
                links_queue.put((idx, link, 0))  # (index, url, retry_count)

        pool_size = min(self.max_concurrency, max(1, needed_count))
        active_tabs = self.tab_pool[:pool_size]

        results_lock = threading.Lock()
        start_time_game = time.time()

        def worker_thread(worker_id: int, tab):
            while not self.stop_event.is_set():
                self.wait_if_in_cooldown()

                try:
                    idx, link, retries = links_queue.get_nowait()
                except queue.Empty:
                    break

                file_id = link.split('/')[-1].split('#')[0]
                retry_msg = f" (Retry {retries}/{self.max_retries})" if retries > 0 else ""
                log.info(f"[{idx:03d}/{total_parts:03d}] [T#{worker_id:02d}] Fetching ->", f"{link}{retry_msg}")
                start_t = time.time()

                try:
                    # Safe spacing between requests with human jitter
                    if self.request_delay > 0:
                        time.sleep(self.request_delay + random.uniform(0.1, 0.4))

                    tab.get(link)

                    if self.check_for_rate_limit(tab):
                        self.trigger_global_cooldown(f"Part #{idx} navigation ({link})")
                        if retries < self.max_retries:
                            links_queue.put((idx, link, retries + 1))
                        continue

                    # Button check with 10s timeout
                    btn = tab.ele('text:DOWNLOAD', timeout=10)
                    if not btn:
                        if self.check_for_rate_limit(tab):
                            self.trigger_global_cooldown(f"Part #{idx} button check ({link})")
                            if retries < self.max_retries:
                                links_queue.put((idx, link, retries + 1))
                            continue

                        if retries < self.max_retries:
                            log.warning(f"[{idx:03d}/{total_parts:03d}] [T#{worker_id:02d}] Button missing, retrying...", link)
                            links_queue.put((idx, link, retries + 1))
                        else:
                            log.error(f"[{idx:03d}/{total_parts:03d}] [T#{worker_id:02d}] Download button not found:", link)
                        continue

                    # Rapid 100ms Turnstile state check
                    active = False
                    for _ in range(40):
                        if self.stop_event.is_set():
                            break
                        try:
                            style = btn.attr('style')
                            if not style or ('opacity' not in style and '0.5' not in style):
                                active = True
                                break
                        except Exception:
                            pass
                        time.sleep(0.1)

                    if self.stop_event.is_set():
                        break

                    if not active:
                        if self.check_for_rate_limit(tab):
                            self.trigger_global_cooldown(f"Part #{idx} Turnstile ({link})")
                            if retries < self.max_retries:
                                links_queue.put((idx, link, retries + 1))
                            continue

                        if retries < self.max_retries:
                            links_queue.put((idx, link, retries + 1))
                        else:
                            log.warning(f"[{idx:03d}/{total_parts:03d}] [T#{worker_id:02d}] Turnstile timeout for", link)
                        continue

                    # Short pause before extraction POST
                    time.sleep(0.15)

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
                                body: xhr.responseText ? xhr.responseText.substring(0, 200) : ''
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
                        self.trigger_global_cooldown(f"Part #{idx} XHR HTTP {status_code} ({link})")
                        if retries < self.max_retries:
                            links_queue.put((idx, link, retries + 1))
                        continue

                    elapsed_ms = (time.time() - start_t) * 1000

                    if dl_url and isinstance(dl_url, str) and (dl_url.startswith("http://") or dl_url.startswith("https://")):
                        with results_lock:
                            merged_results[idx - 1] = dl_url
                        log.success(f"[{idx:03d}/{total_parts:03d}] [T#{worker_id:02d}] Extracted in {elapsed_ms:.0f}ms ->", dl_url[:75] + "...")
                    else:
                        if retries < self.max_retries:
                            log.warning(f"[{idx:03d}/{total_parts:03d}] Empty response, retrying...", link)
                            links_queue.put((idx, link, retries + 1))
                        else:
                            log.warning(f"[{idx:03d}/{total_parts:03d}] [T#{worker_id:02d}] Empty URL for", link)

                except Exception as e:
                    if retries < self.max_retries:
                        links_queue.put((idx, link, retries + 1))
                    else:
                        log.error(f"[{idx:03d}/{total_parts:03d}] [T#{worker_id:02d}] Error:", str(e))
                finally:
                    links_queue.task_done()

        threads = []
        for w_id, w_tab in enumerate(active_tabs, start=1):
            t = threading.Thread(target=worker_thread, args=(w_id, w_tab), daemon=True)
            threads.append(t)
            t.start()
            if len(active_tabs) > 1:
                time.sleep(0.5)

        try:
            while not links_queue.empty() or any(t.is_alive() for t in threads):
                if self.stop_event.is_set():
                    break
                time.sleep(0.2)
        except KeyboardInterrupt:
            log.warning("\n[INTERRUPTED] Stopping game workers...")
            self.stop_event.set()

        ordered_direct_links = [url for url in merged_results if url]

        total_elapsed = time.time() - start_time_game
        avg_ms = (total_elapsed / needed_count) * 1000 if needed_count else 0
        if len(ordered_direct_links) == total_parts:
            log.success(f"⚡ COMPLETE! {len(ordered_direct_links)}/{total_parts} links active ({needed_count} newly extracted in {total_elapsed:.1f}s, {avg_ms:.0f}ms avg/link with {pool_size} tab(s)).")
        elif ordered_direct_links:
            log.warning(f"⚠️ PARTIAL! {len(ordered_direct_links)}/{total_parts} links active ({cached_count} existing + {len(ordered_direct_links) - cached_count} new).")

        return ordered_direct_links


def pull_queue(limit: Optional[int] = None, priority_only: bool = False, file_path: Optional[str] = None):
    log.info("📥 Pulling unresolved & priority games from Firestore into local queue...")
    count = firestore_db.save_resolution_queue_locally(file_path=file_path, limit=limit, priority_only=priority_only)
    target = file_path or firestore_db.QUEUE_FILE
    log.success(f"💾 Successfully saved {count} game(s) to '{os.path.basename(target)}'!")
    log.info(f"💡 You can now resolve links locally using: python fetch_missing_links.py --local")
    return count


def push_queue(file_path: Optional[str] = None):
    target = file_path or firestore_db.QUEUE_FILE
    log.info(f"📤 Reading resolved games from local queue '{os.path.basename(target)}'...")
    games = firestore_db.load_resolution_queue_locally(file_path=target)
    
    # Filter games that have resolved direct links
    resolved_games = [g for g in games if g.get('direct_links') and len(g['direct_links']) > 0]
    
    if not resolved_games:
        log.warning("No resolved games with direct links found in local queue to push.")
        return
        
    log.info(f"🚀 Batch updating {len(resolved_games)} game(s) in Firestore...")
    stats = firestore_db.batch_update_game_links(resolved_games)
    log.success(f"🏁 Batch Push Complete! Updated: {stats['updated']} | Failed: {stats['failed']}")


def run_crawler(
    limit: Optional[int] = None,
    slug: Optional[str] = None,
    priority_only: bool = False,
    concurrency: int = 1,
    delay: float = 1.2,
    cooldown: float = 60.0,
    visible: bool = False,
    local_mode: bool = False,
    batch_sync: bool = False,
    queue_file: Optional[str] = None
):
    log.clear()
    log.info("🔥 ===================================================================")
    log.info("🚀 FITGIRL SAFE LINK RESOLVER (RATE-LIMIT IMMUNE)")
    log.info("🔥 ===================================================================")

    if batch_sync:
        pull_queue(limit=limit, priority_only=priority_only, file_path=queue_file)
        local_mode = True

    games_to_resolve = []

    if slug:
        if local_mode:
            all_local = firestore_db.load_resolution_queue_locally(file_path=queue_file)
            games_to_resolve = [g for g in all_local if g.get('slug') == slug]
        else:
            game = firestore_db.get_game_by_slug(slug)
            if not game:
                log.error(f"Game with slug '{slug}' not found in database.")
                return
            if game.get('resolved') and game.get('direct_links') and len(game.get('direct_links', [])) >= len(game.get('fuckingfast_links', [])):
                log.info(f"Game '{game.get('title')}' is already 100% resolved with {len(game['direct_links'])} links.")
            games_to_resolve = [game]
    elif local_mode:
        log.info("📂 LOCAL MODE: Reading resolution queue from local JSON file...")
        games_to_resolve = firestore_db.load_resolution_queue_locally(file_path=queue_file)
        if priority_only:
            games_to_resolve = [g for g in games_to_resolve if g.get('_is_priority')]
        if limit:
            games_to_resolve = games_to_resolve[:limit]
    else:
        # Fetch all priority-requested and unresolved games in a SINGLE read pass from Firestore
        games_to_resolve = firestore_db.get_resolution_queue(limit=limit, priority_only=priority_only)
        
    priority_games = [g for g in games_to_resolve if g.get('_is_priority')]
    if priority_games:
        log.info(f"🎯 PRIORITY QUEUE ACTIVE: Found {len(priority_games)} user-requested game(s) awaiting links!")
        for idx, pg in enumerate(priority_games, 1):
            req_count = pg.get('request_count', 1)
            log.info(f"   {idx}. ⚡ {pg.get('title', 'Unknown')} ({req_count} request{'s' if req_count != 1 else ''})")
    elif not priority_only and games_to_resolve:
        log.info("🎯 Reading games from catalog...")

    if not games_to_resolve:
        if priority_only:
            log.success("🎉 Priority request queue is empty! No requested games waiting for links.")
        else:
            log.success("🎉 All games in the queue already have direct download links! Nothing to resolve.")
        return

    total_games = len(games_to_resolve)
    priority_count = sum(1 for g in games_to_resolve if g.get('_is_priority'))
    total_parts_all = sum(len(g.get('fuckingfast_links', [])) for g in games_to_resolve)
    
    mode_banner = " [LOCAL OFFLINE QUEUE]" if local_mode else " [LIVE FIRESTORE]"
    if priority_count > 0:
        log.info(f"📋 Total Resolution Queue{mode_banner}: {total_games} games ({priority_count} PRIORITY REQUESTS, {total_games - priority_count} standard | {total_parts_all} total parts)")
    else:
        log.info(f"📋 Total Resolution Queue{mode_banner}: {total_games} unresolved/partial games ({total_parts_all} total parts)")
    log.info(f"Safe Config: Concurrency={concurrency} Tab(s) | Pace={delay}s Delay | Auto-Cooldown={cooldown}s")

    resolver = HighSpeedGameResolver(
        max_concurrency=concurrency,
        request_delay=delay,
        cooldown_seconds=cooldown,
        visible=visible
    )
    resolver.start()

    resolved_count = 0
    start_all = time.time()

    try:
        for idx, game in enumerate(games_to_resolve, start=1):
            if resolver.rate_limited or resolver.stop_event.is_set():
                break

            title = game.get('title', 'Unknown Game')
            game_slug = game.get('slug')
            raw_links: List[str] = game.get('fuckingfast_links', [])
            existing_dl: List[str] = game.get('direct_links', [])
            is_priority = game.get('_is_priority', False)
            req_count = game.get('request_count', 1)

            if not raw_links:
                game_url = game.get('url')
                if game_url:
                    log.info(f"[{idx}/{total_games}] Fetching FitGirl page for raw links ->", game_url)
                    try:
                        import fitgirl_scraper
                        details = fitgirl_scraper.get_game_details(game_url)
                        if details and details.get('fuckingfast_links'):
                            raw_links = details['fuckingfast_links']
                            game['fuckingfast_links'] = raw_links
                            game['parts_count'] = len(raw_links)
                            firestore_db.upsert_game({**game, 'fuckingfast_links': raw_links})
                    except Exception as fe:
                        log.warning(f"Could not auto-fetch raw links for '{title}': {fe}")
                        
            if not raw_links:
                log.warning(f"[{idx}/{total_games}] Skipping '{title}'", "No links found in doc.")
                continue

            total_parts = len(raw_links)
            cached_parts = len(existing_dl) if existing_dl else 0
            needed_parts = max(0, total_parts - cached_parts)
            part_info = f"({total_parts} parts | {cached_parts} cached, {needed_parts} to resolve)" if cached_parts > 0 else f"({total_parts} parts)"
            
            prio_tag = f" 🎯 [PRIORITY REQUEST x{req_count}]" if is_priority else ""
            log.info("-" * 65)
            log.info(f"🎮 [{idx}/{total_games}]{prio_tag} Processing: '{title}' {part_info}")
            log.info("-" * 65)

            direct_links = resolver.resolve_game(raw_links, game_title=title, existing_direct_links=existing_dl)

            if direct_links and len(direct_links) == total_parts:
                resolved_count += 1
                game['resolved'] = True
                game['direct_links'] = direct_links
                game['requested'] = False
                game['_is_priority'] = False
                game.pop('requested_at', None)
                game.pop('request_count', None)
                if local_mode:
                    firestore_db.update_local_queue_game(game_slug, direct_links, total_parts=total_parts, file_path=queue_file)
                    log.success(f"💾 Saved to local queue ({len(direct_links)}/{total_parts} direct parts active)!\n")
                else:
                    firestore_db.update_game_links(game_slug, direct_links, total_parts=total_parts)
                    log.success(f"💾 Updated '{title}' in Firestore ({len(direct_links)}/{total_parts} direct parts active)!\n")
            elif direct_links:
                if local_mode:
                    firestore_db.update_local_queue_game(game_slug, direct_links, total_parts=total_parts, file_path=queue_file)
                    log.warning(f"💾 Saved partial progress to local queue ({len(direct_links)}/{total_parts} parts)!\n")
                else:
                    firestore_db.update_game_links(game_slug, direct_links, total_parts=total_parts)
                    log.warning(f"💾 Saved progress for '{title}' in Firestore ({len(direct_links)}/{total_parts} parts)!\n")
            else:
                if resolver.rate_limited:
                    log.warning(f"⚠️ Halting processing on '{title}' due to rate limit.\n")
                    break
                else:
                    log.error(f"❌ Failed to extract direct links for '{title}'.\n")

            time.sleep(1.5 + random.uniform(0.3, 0.8))

    except (KeyboardInterrupt, SystemExit):
        log.warning("\n🛑 [STOPPED] Crawler interrupted by user / signal.")
        resolver.stop_event.set()
    except Exception as e:
        log.error(f"❌ Unexpected error in crawler: {e}")
    finally:
        resolver.stop()
        
        # If running batch-sync, ensure all newly resolved games in local queue are pushed to Firestore on exit
        if batch_sync:
            log.info("📤 Script stopping: Auto-syncing all resolved games from local queue to Firestore...")
            try:
                push_queue(file_path=queue_file)
            except Exception as pe:
                log.error(f"Failed to auto-push queue to Firestore on exit: {pe}")

    total_elapsed = time.time() - start_all
    log.info("=" * 65)
    if resolver.rate_limited:
        log.warning(f"🛑 STOPPED: [{resolver.rate_limit_source}]")
        location = "local queue" if local_mode else "Firestore"
        log.success(f"💾 All progress is safely saved in {location} ({resolved_count}/{total_games} games resolved in {total_elapsed:.1f}s).")
    else:
        log.success(f"🏁 RESOLUTION COMPLETE! Successfully processed {resolved_count}/{total_games} games in {total_elapsed:.1f}s.")
    log.info("=" * 65)



if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Rate-Limit Immune Link Resolver for Firestore (Priority Queue Enabled)")
    parser.add_argument("--slug", type=str, default=None, help="Resolve only a specific game by slug")
    parser.add_argument("--limit", type=int, default=None, help="Maximum number of unresolved games to process")
    parser.add_argument("--priority-only", action="store_true", help="Process ONLY user-requested priority games")
    parser.add_argument("--concurrency", type=int, default=1, help="Number of tabs (default: 1 for maximum rate-limit immunity)")
    parser.add_argument("--delay", type=float, default=1.2, help="Safe delay between requests in seconds (default: 1.2s)")
    parser.add_argument("--cooldown", type=float, default=60.0, help="Cooldown sleep in seconds when rate limited (default: 60.0s)")
    parser.add_argument("--visible", action="store_true", help="Show browser window for debugging")
    
    # Local batching commands & flags
    parser.add_argument("--pull", action="store_true", help="Pull unresolved and priority games from Firestore into local resolution_queue.json and exit")
    parser.add_argument("--push", action="store_true", help="Push all resolved games from local resolution_queue.json to Firestore in batch and exit")
    parser.add_argument("--local", action="store_true", help="Run link resolution completely offline using local resolution_queue.json")
    parser.add_argument("--batch-sync", action="store_true", help="Full workflow: Pull once -> resolve locally -> push all together in batch")
    parser.add_argument("--queue-file", type=str, default=None, help="Custom path for local resolution queue JSON file")
    
    args = parser.parse_args()

    if args.pull:
        pull_queue(limit=args.limit, priority_only=args.priority_only, file_path=args.queue_file)
    elif args.push:
        push_queue(file_path=args.queue_file)
    else:
        run_crawler(
            limit=args.limit,
            slug=args.slug,
            priority_only=args.priority_only,
            concurrency=args.concurrency,
            delay=args.delay,
            cooldown=args.cooldown,
            visible=args.visible,
            local_mode=args.local,
            batch_sync=args.batch_sync,
            queue_file=args.queue_file
        )

