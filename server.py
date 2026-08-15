import os
import sys
import uuid
import time
import socket
import ipaddress
import threading
import concurrent.futures
import tempfile
import urllib.parse
import requests
from flask import Flask, request, jsonify, send_from_directory, Response, make_response, redirect
from flask_cors import CORS
import fitgirl_scraper
import fdm_bridge
import firestore_db

if sys.platform == "win32":
    try:
        if hasattr(sys.stdout, "reconfigure"):
            sys.stdout.reconfigure(encoding="utf-8")
        if hasattr(sys.stderr, "reconfigure"):
            sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

# Vercel's filesystem is read-only except /tmp
TMP_DIR = os.getenv('TMP_DIR', tempfile.gettempdir())
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DIST_DIR = os.path.join(BASE_DIR, 'frontend', 'dist')
STATIC_DIR = os.path.join(BASE_DIR, 'static')

app = Flask(__name__, static_folder=DIST_DIR if os.path.exists(DIST_DIR) else STATIC_DIR)
CORS(app, resources={r"/*": {"origins": "*"}})

# In-memory LRU image cache for ultra-fast, reliable 0ms cover loading
IMAGE_CACHE = {}

# In-memory IP rate limiter to protect backend against DDoS and scraping attacks
RATE_LIMIT_STORE = {}
RATE_LIMIT_LOCK = threading.Lock()
MAX_REQUESTS_PER_MINUTE = 150


def _normalized_url_set(urls):
    """Return a comparable, duplicate-free set of submitted URLs."""
    if not isinstance(urls, list):
        return None
    normalized = set()
    for url in urls:
        if not isinstance(url, str) or not url.strip():
            return None
        normalized.add(url.strip())
    return normalized or None


def _is_expected_direct_link(url):
    """Limit community submissions to direct links from the expected host."""
    try:
        parsed = urllib.parse.urlparse(url)
        host = (parsed.hostname or '').lower()
        return (
            parsed.scheme == 'https'
            and host in {'dl.fuckingfast.co', 'fuckingfast.co'}
            and parsed.path.startswith('/dl/')
        )
    except (TypeError, ValueError):
        return False

def is_safe_proxy_url(url: str) -> bool:
    """Blocks SSRF attacks by preventing access to localhost, internal networks, and cloud metadata."""
    if not url or len(url) > 1000:
        return False
    try:
        parsed = urllib.parse.urlparse(url)
        if parsed.scheme not in ('http', 'https'):
            return False
        hostname = parsed.hostname
        if not hostname:
            return False
        hostname_lower = hostname.lower()
        # Block localhost, loopback, and cloud metadata hostnames
        if hostname_lower in ('localhost', '127.0.0.1', '0.0.0.0', '::1', 'metadata.google.internal', 'instance-data'):
            return False
        # Resolve IP to check for private or link-local ranges
        try:
            ip = socket.gethostbyname(hostname)
            ip_obj = ipaddress.ip_address(ip)
            if ip_obj.is_private or ip_obj.is_loopback or ip_obj.is_reserved or ip_obj.is_link_local:
                return False
        except Exception:
            return False
        return True
    except Exception:
        return False

@app.before_request
def check_rate_limit():
    """Anti-DDoS & abuse rate limiter per client IP."""
    if not request.path.startswith('/api/'):
        return None
        
    client_ip = request.headers.get('X-Forwarded-For', request.remote_addr or '127.0.0.1').split(',')[0].strip()
    now = time.time()
    
    with RATE_LIMIT_LOCK:
        history = RATE_LIMIT_STORE.get(client_ip, [])
        valid_history = [t for t in history if now - t < 60]
        
        if len(valid_history) >= MAX_REQUESTS_PER_MINUTE:
            return jsonify({
                'success': False,
                'error': 'Too many requests. Please slow down.'
            }), 429
            
        valid_history.append(now)
        RATE_LIMIT_STORE[client_ip] = valid_history
        
        if len(RATE_LIMIT_STORE) > 2000:
            for ip in list(RATE_LIMIT_STORE.keys())[:500]:
                if not RATE_LIMIT_STORE[ip] or now - RATE_LIMIT_STORE[ip][-1] > 120:
                    RATE_LIMIT_STORE.pop(ip, None)

@app.after_request
def apply_security_headers(response):
    """Hardened HTTP security and CORS headers."""
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Requested-With'
    
    # OWASP Recommended Security Headers
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'DENY'
    response.headers['X-XSS-Protection'] = '1; mode=block'
    response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
    response.headers['Permissions-Policy'] = 'geolocation=(), camera=(), microphone=()'
    return response

@app.route('/api/image_proxy', methods=['GET'])
def api_image_proxy():
    image_url = request.args.get('url', '').strip()
    if not image_url or image_url == 'None' or not is_safe_proxy_url(image_url):
        return redirect('/placeholder.svg')

    # Check cache first
    if image_url in IMAGE_CACHE:
        cached_data, content_type = IMAGE_CACHE[image_url]
        response = make_response(cached_data)
        response.headers['Content-Type'] = content_type
        response.headers['Cache-Control'] = 'public, max-age=604800, immutable'
        return response

    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Referer': 'https://fitgirl-repacks.site/',
            'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
        }
        resp = requests.get(image_url, headers=headers, timeout=6, stream=True)
        if resp.status_code == 200:
            content_type = resp.headers.get('Content-Type', 'image/jpeg')
            content = resp.content
            # Guard against decompression bomb (max 15MB)
            if len(content) <= 15 * 1024 * 1024:
                if len(IMAGE_CACHE) > 500:
                    IMAGE_CACHE.pop(next(iter(IMAGE_CACHE)))
                IMAGE_CACHE[image_url] = (content, content_type)
                
                response = make_response(content)
                response.headers['Content-Type'] = content_type
                response.headers['Cache-Control'] = 'public, max-age=604800, immutable'
                return response
    except Exception:
        pass

    return redirect('/placeholder.svg')

@app.route('/api/game_cover', methods=['GET'])
def api_game_cover():
    game_url = request.args.get('url', '').strip()
    if not game_url or not is_safe_proxy_url(game_url):
        return redirect('/placeholder.svg')

    try:
        details = fitgirl_scraper.get_game_details(game_url)
        if details and details.get('cover') and details['cover'] != 'None':
            cover = details['cover']
            if cover.startswith('http') and is_safe_proxy_url(cover):
                return redirect(f"/api/image_proxy?url={urllib.parse.quote(cover)}")
    except Exception:
        pass

    return redirect('/placeholder.svg')

# Background job registry
jobs = {}

def get_extracted_links_count():
    output_file = os.path.join(TMP_DIR, 'download_links.txt')
    if os.path.exists(output_file):
        try:
            with open(output_file, 'r', encoding='utf-8') as f:
                return len([line for line in f if line.strip()])
        except Exception:
            pass
    return 0

def get_extracted_links():
    output_file = os.path.join(TMP_DIR, 'download_links.txt')
    if os.path.exists(output_file):
        try:
            with open(output_file, 'r', encoding='utf-8') as f:
                return [line.strip() for line in f if line.strip()]
        except Exception:
            pass
    return []

class DownloadJob:
    def __init__(self, job_id, game_title, links):
        self.job_id = job_id
        self.game_title = game_title
        self.links = links
        self.total_parts = len(links)
        self.processed_count = 0
        self.current_part_name = ""
        self.status = "pending" # pending, running, completed, failed
        self.logs = []
        self.result = None

    def add_log(self, msg):
        import re
        clean_msg = re.sub(r'\x1b\[[0-9;]*[a-zA-Z]', '', str(msg)).strip()
        if not clean_msg:
            return
            
        if "Processing" in clean_msg:
            parts = clean_msg.split("Processing")
            if len(parts) > 1:
                target = parts[1].strip(" :")
                match = re.search(r'fuckingfast\.co/(?:f/)?([a-zA-Z0-9_-]+)', target)
                if match:
                    self.current_part_name = f"Part ({match.group(1)[:12]})"
                else:
                    self.current_part_name = target[:30]
            self.logs.append(f"Resolving {self.current_part_name}...")
        elif "Found download URL" in clean_msg:
            count = get_extracted_links_count()
            self.processed_count = max(self.processed_count, count)
            self.logs.append(f"Extracted part {self.processed_count} of {self.total_parts}")
        elif any(k in clean_msg for k in ["Starting", "Saved", "Copied", "Pipeline", "Finished", "Error"]):
            self.logs.append(f"> {clean_msg}")

    def run(self):
        self.status = "running"
        self.add_log(f"Starting extraction for '{self.game_title}' ({self.total_parts} parts)")
        try:
            res = fdm_bridge.run_download_pipeline(self.links, log_callback=self.add_log)
            self.result = res
            self.status = "completed" if res.get('status') == 'success' else "failed"
            if self.status == "completed":
                self.processed_count = self.total_parts
        except Exception as e:
            self.add_log(f"Error in download process: {e}")
            self.status = "failed"



# Background auto-ingestion worker for automatic database expansion on searches
_auto_ingest_executor = concurrent.futures.ThreadPoolExecutor(max_workers=3)

def _auto_ingest_single_game(game_url, raw_title=""):
    """Fetches details & fuckingfast links for an un-cached game and saves to DB."""
    if not game_url:
        return
    try:
        slug = game_url.rstrip('/').split('/')[-1]
        existing = firestore_db.get_game_by_slug(slug)
        if existing and existing.get('fuckingfast_links') and len(existing['fuckingfast_links']) > 0:
            return  # Already stored with all raw links

        details = fitgirl_scraper.get_game_details(game_url)
        if details and details.get('fuckingfast_links'):
            details['slug'] = slug
            if not existing:
                details['resolved'] = False
                details['direct_links'] = []
            else:
                details['resolved'] = existing.get('resolved', False)
                details['direct_links'] = existing.get('direct_links', [])
            
            firestore_db.upsert_game(details)
            print(f"[AutoIngest] Stored '{details.get('title', slug)}' with {len(details['fuckingfast_links'])} parts in Firestore!")
    except Exception as e:
        print(f"[AutoIngest] Error for {game_url}: {e}")

def _queue_auto_ingest(games_list):
    """Queue games in background thread pool to store their FuckingFast links."""
    if not games_list:
        return
    for g in games_list:
        url = g.get('url')
        if url:
            _auto_ingest_executor.submit(_auto_ingest_single_game, url, g.get('title', ''))

def _generate_slug(url: str, title: str = '') -> str:
    cleaned = (url or '').rstrip('/')
    slug = cleaned.split('/')[-1]
    if not slug or slug.isdigit() or len(slug) < 3:
        slug = (title or '').lower().strip()
        slug = ''.join(c if c.isalnum() else '-' for c in slug)
        slug = '-'.join(filter(None, slug.split('-')))
    return slug

def _enrich_game_with_db_status(item):
    """Adds resolved status, slug, direct_links info, and action hints from database to a game dict."""
    url = item.get('url', '')
    slug = item.get('slug')
    if not slug and url:
        slug = _generate_slug(url, item.get('title', ''))
    item['slug'] = slug
    
    db_game = firestore_db.get_game_by_slug(slug)
    firestore_status = firestore_db.get_firestore_status()
    
    if db_game:
        direct_links = db_game.get('direct_links', [])
        has_direct_links = bool(direct_links and len(direct_links) > 0)
        is_resolved = bool(db_game.get('resolved') and has_direct_links)
        
        item['resolved'] = is_resolved
        item['direct_links'] = direct_links
        item['direct_links_count'] = len(direct_links)
        item['parts_count'] = db_game.get('parts_count') or len(db_game.get('fuckingfast_links', []))
        item['repack_size'] = db_game.get('repack_size') or item.get('repack_size', 'N/A')
        item['original_size'] = db_game.get('original_size') or item.get('original_size', 'N/A')
        item['genres'] = db_game.get('genres') or item.get('genres', '')
        item['requested'] = bool(db_game.get('requested', False))
        item['request_count'] = db_game.get('request_count', 0)
        item['requested_at'] = db_game.get('requested_at')
        if db_game.get('cover') and db_game['cover'] != 'None':
            item['cover'] = db_game['cover']
    else:
        item['resolved'] = False
        item['direct_links'] = []
        item['direct_links_count'] = 0
        item['parts_count'] = 0
        item['repack_size'] = item.get('repack_size', 'N/A')
        item['requested'] = False
        item['request_count'] = 0
        item['requested_at'] = None

    if not item.get('cover') or item['cover'] == 'None':
        if url:
            item['cover'] = f"/api/game_cover?url={urllib.parse.quote(url)}"
        else:
            item['cover'] = '/placeholder.svg'

    # Add quota status and explicit action hints for frontend
    item['database_quota_exceeded'] = firestore_status['quota_exceeded']
    item['database_status_message'] = firestore_status['message']
    
    has_direct_links = bool(item.get('direct_links') and len(item.get('direct_links', [])) > 0)
    is_resolved = bool(item.get('resolved') and has_direct_links)
    
    if is_resolved:
        item['available_action'] = 'download'
        item['action_message'] = 'Direct links available - download via local downloader'
    else:
        item['available_action'] = 'priority_queue'
        if firestore_status['quota_exceeded']:
            item['action_message'] = firestore_status['message']
        else:
            item['action_message'] = 'Click to request priority link extraction'
    
    return item

@app.route('/api/catalog', methods=['GET'])
def api_catalog():
    page = request.args.get('page', 1, type=int)
    catalog = fitgirl_scraper.get_catalog(page=page, max_results=16)
    
    # Auto-ingest catalog page games in background into Firestore!
    _queue_auto_ingest(catalog)
    
    enriched = [_enrich_game_with_db_status(g) for g in catalog]
    return jsonify({'success': True, 'catalog': enriched, 'page': page})

@app.route('/api/popular', methods=['GET'])
def api_popular():
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 16, type=int)
    
    # 1. Fetch full 150 Popular Repacks catalog (paginated into 10 pages)
    res = fitgirl_scraper.get_popular_repacks(page=page, per_page=per_page)
    items = res.get('items', [])
    
    # 2. Auto-ingest any un-cached games in background into Firestore
    _queue_auto_ingest(items)
    
    # 3. Enrich each game on this page with live Firestore database status
    enriched = [_enrich_game_with_db_status(g) for g in items]
    
    return jsonify({
        'success': True,
        'results': enriched,
        'page': res.get('page', page),
        'per_page': res.get('per_page', per_page),
        'total_pages': res.get('total_pages', 10),
        'total_items': res.get('total_items', 150)
    })

@app.route('/api/search', methods=['GET'])
def api_search():
    query = request.args.get('q', '').strip()
    if not query:
        results = fitgirl_scraper.get_catalog()
        _queue_auto_ingest(results)
        enriched = [_enrich_game_with_db_status(g) for g in results]
        return jsonify({'success': True, 'results': enriched})

    # 1. Query Firestore / local database using fuzzy matching engine
    db_fuzzy_results = firestore_db.fuzzy_search_games(query, limit=20, threshold=0.55)

    # 2. Query FitGirl WordPress scraper (with typo-correction fallback)
    web_results = fitgirl_scraper.search_games(query, max_results=16)

    # 3. Automatically queue any web results to be auto-ingested into Firestore
    _queue_auto_ingest(web_results)

    # 4. Merge and deduplicate by slug or URL
    merged = []
    seen_slugs = set()
    seen_urls = set()

    for g in db_fuzzy_results:
        slug = g.get('slug')
        url = g.get('url')
        if slug:
            seen_slugs.add(slug)
        if url:
            seen_urls.add(url)
        merged.append(g)

    for g in web_results:
        u = g.get('url', '')
        s = _generate_slug(u, g.get('title', ''))
        if s not in seen_slugs and u not in seen_urls:
            seen_slugs.add(s)
            seen_urls.add(u)
            merged.append(g)

    # 5. Enrich with live Firestore direct links status
    enriched = [_enrich_game_with_db_status(g) for g in merged]

    # 6. Rank all results by fuzzy similarity score
    def get_score(item):
        title = item.get('title', '')
        sim = firestore_db.compute_game_similarity(query, title)
        # Boost games that already have direct links in DB
        boost = 0.05 if item.get('resolved') else 0.0
        return sim + boost

    enriched.sort(key=get_score, reverse=True)

    return jsonify({'success': True, 'results': enriched[:24], 'query': query})

@app.route('/api/suggest', methods=['GET'])
def api_suggest():
    query = request.args.get('q', '').strip()
    if not query or len(query) < 2:
        return jsonify({'success': True, 'suggestions': []})

    # 1. Fast fuzzy search against database and memory cache
    suggestions = firestore_db.fuzzy_search_games(query, limit=8, threshold=0.45)
    
    # 2. If fewer than 4 suggestions, also check popular repacks in RAM
    if len(suggestions) < 6:
        pop_items = fitgirl_scraper.get_all_popular_repacks()
        seen_slugs = {s.get('slug') for s in suggestions if s.get('slug')}
        for item in pop_items:
            slug = _generate_slug(item.get('url', ''), item.get('title', ''))
            if slug not in seen_slugs:
                sim = firestore_db.compute_game_similarity(query, item.get('title', ''))
                if sim >= 0.50:
                    item['slug'] = slug
                    suggestions.append(item)
                    seen_slugs.add(slug)
            if len(suggestions) >= 8:
                break

    # 3. Enrich items with direct links status
    enriched = [_enrich_game_with_db_status(g) for g in suggestions[:8]]
    
    # 4. Format clean, lightweight response
    results = []
    for g in enriched:
        cov = g.get('cover')
        if not cov or cov == 'None':
            cov = f"/api/game_cover?url={g.get('url', '')}"
        elif cov.startswith('http') and not cov.startswith('/api/image_proxy') and not cov.startswith('/api/game_cover'):
            cov = f"/api/image_proxy?url={cov}"
            
        results.append({
            'title': g.get('title', 'Unknown Game'),
            'slug': g.get('slug', ''),
            'url': g.get('url', ''),
            'cover': cov,
            'repack_size': g.get('repack_size', 'N/A'),
            'resolved': bool(g.get('resolved')),
            'parts_count': g.get('parts_count', 0),
            'direct_links_count': g.get('direct_links_count', 0),
            'available_action': g.get('available_action', 'priority_queue'),
            'action_message': g.get('action_message', ''),
            'database_quota_exceeded': g.get('database_quota_exceeded', False)
        })

    return jsonify({'success': True, 'suggestions': results, 'query': query})

@app.route('/api/game', methods=['GET'])
def api_game():
    game_url = request.args.get('url', '').strip()
    game_slug = request.args.get('slug', '').strip()
    
    if not game_url and not game_slug:
        return jsonify({'success': False, 'error': 'Missing url or slug parameter'}), 400

    if not game_slug and game_url:
        cleaned = game_url.rstrip('/')
        game_slug = cleaned.split('/')[-1]

    target_url = game_url or (f"https://fitgirl-repacks.site/{game_slug}/" if game_slug else None)

    # 1. Check database for existing game by slug
    db_game = firestore_db.get_game_by_slug(game_slug) if game_slug else None
    firestore_status = firestore_db.get_firestore_status()

    def game_response(game):
        # This is intentionally per-response rather than persisted on the game:
        # Firestore's daily quota resets, while game availability does not.
        game = dict(game)
        game['database_quota_exceeded'] = firestore_status['quota_exceeded']
        game['database_status_message'] = firestore_status['message']
        
        # Explicit action hint for frontend:
        # - "download": Game has direct links, show local downloader
        # - "priority_queue": Game needs links, show priority queue button
        has_direct_links = bool(game.get('direct_links') and len(game.get('direct_links', [])) > 0)
        is_resolved = bool(game.get('resolved') and has_direct_links)
        
        if is_resolved:
            game['available_action'] = 'download'
            game['action_message'] = 'Direct links available - download via local downloader'
        else:
            game['available_action'] = 'priority_queue'
            if firestore_status['quota_exceeded']:
                game['action_message'] = firestore_status['message']  # "Database quota exceeded. Please try cloud links again tomorrow."
            else:
                game['action_message'] = 'Click to request priority link extraction'
        
        return jsonify({'success': True, 'game': game})

    # Check if db_game already has rich data (description & screenshots)
    has_rich_data = bool(db_game and (db_game.get('description') or (db_game.get('screenshots') and len(db_game['screenshots']) > 0)))

    if db_game and has_rich_data and db_game.get('fuckingfast_links') and len(db_game['fuckingfast_links']) > 0:
        cov = db_game.get('cover')
        if not cov or cov == 'None':
            db_game['cover'] = f"/api/game_cover?url={db_game.get('url', target_url)}"
        elif cov.startswith('http') and not cov.startswith('/api/image_proxy') and not cov.startswith('/api/game_cover'):
            db_game['cover'] = f"/api/image_proxy?url={cov}"
        return game_response(db_game)

    # 2. Scrape full rich details (screenshots, description, requirements, accurate features)
    if target_url:
        details = fitgirl_scraper.get_game_details(target_url)
        if details:
            if not game_slug:
                game_slug = target_url.rstrip('/').split('/')[-1]
            details['slug'] = game_slug
            
            # Preserve existing direct links and resolution status from DB
            if db_game:
                details['resolved'] = db_game.get('resolved', False)
                details['direct_links'] = db_game.get('direct_links', [])
                details['requested'] = db_game.get('requested', False)
                details['request_count'] = db_game.get('request_count', 0)
                # If scraped links are empty but db has them, preserve db links
                if not details.get('fuckingfast_links') and db_game.get('fuckingfast_links'):
                    details['fuckingfast_links'] = db_game.get('fuckingfast_links')
            else:
                details['resolved'] = False
                details['direct_links'] = []
            
            cov = details.get('cover')
            if not cov or cov == 'None':
                details['cover'] = f"/api/game_cover?url={target_url}"
            elif cov.startswith('http') and not cov.startswith('/api/image_proxy') and not cov.startswith('/api/game_cover'):
                details['cover'] = f"/api/image_proxy?url={cov}"
            
            # Save enriched details into Firestore
            try:
                firestore_db.upsert_game(details)
            except Exception as e:
                print(f"[api_game] Error saving enriched game to Firestore: {e}")
                
            return game_response(details)

    # Fallback to existing db_game if scrape failed
    if db_game:
        return game_response(db_game)
            
    return jsonify({'success': False, 'error': 'Could not fetch game details'}), 404

@app.route('/api/request_game', methods=['POST'])
def api_request_game():
    """Queues an unresolved game into the high-priority resolution queue."""
    data = request.json or {}
    game_slug = (data.get('slug') or '').strip()
    game_url = (data.get('url') or data.get('game_url') or '').strip()
    game_title = (data.get('title') or data.get('game_title') or '').strip()

    if not game_slug and game_url:
        game_slug = _generate_slug(game_url, game_title)
    if not game_slug and game_title:
        game_slug = _generate_slug('', game_title)

    if not game_slug:
        return jsonify({'success': False, 'error': 'Missing game slug or title/URL'}), 400

    # If game details or raw links aren't cached yet, fetch them from FitGirl
    existing = firestore_db.get_game_by_slug(game_slug)
    if existing:
        raw_parts = existing.get('fuckingfast_links') or []
        direct_parts = existing.get('direct_links') or []
        is_fully_resolved = bool(
            existing.get('resolved')
            and direct_parts
            and (not raw_parts or len(direct_parts) >= len(raw_parts))
        )
        if is_fully_resolved:
            return jsonify({
                'success': False,
                'error': 'Direct links are already available for this game.',
                'reason': 'already_resolved',
                'database_quota_exceeded': firestore_db.get_firestore_status()['quota_exceeded']
            }), 409

    if (not existing or not existing.get('fuckingfast_links')) and game_url:
        try:
            details = fitgirl_scraper.get_game_details(game_url)
            if details and details.get('fuckingfast_links'):
                details['slug'] = game_slug
                details['resolved'] = False
                details['direct_links'] = []
                firestore_db.upsert_game(details)
        except Exception as e:
            print(f"[RequestGame] Error scraping details for {game_url}: {e}")

    result = firestore_db.request_game(game_slug, title=game_title, url=game_url)
    return jsonify({
        'success': True,
        'message': f"'{result.get('title', game_slug)}' added to priority extraction queue!",
        'data': result,
        'database_quota_exceeded': firestore_db.get_firestore_status()['quota_exceeded']
    })

@app.route('/api/priority_queue', methods=['GET'])
def api_priority_queue():
    """Returns currently pending priority requested games."""
    limit = request.args.get('limit', 50, type=int)
    priority_games = firestore_db.get_priority_requested_games(limit=limit)
    enriched = [_enrich_game_with_db_status(g) for g in priority_games]
    return jsonify({
        'success': True,
        'count': len(enriched),
        'games': enriched
    })

@app.route('/api/db_stats', methods=['GET'])
def api_db_stats():
    """Returns overview of Firestore database status."""
    is_connected = firestore_db.is_firestore_connected()
    all_games = firestore_db.get_all_popular_games(page=1, per_page=500)
    items = all_games.get('items', [])
    total = len(items)
    resolved = sum(1 for g in items if g.get('resolved') and g.get('direct_links'))
    priority_list = firestore_db.get_priority_requested_games()
    return jsonify({
        'firestore_connected': is_connected,
        'total_games': total,
        'resolved_games': resolved,
        'pending_games': max(0, total - resolved),
        'priority_queue_count': len(priority_list)
    })

@app.route('/api/start_download', methods=['POST'])
def api_start_download():
    data = request.json or {}
    game_title = data.get('game_title', 'Unknown Game')
    game_slug = data.get('slug')
    links = data.get('links', [])
    game_url = data.get('game_url')

    # If slug or game_url is provided, check if direct links already exist in DB!
    if not game_slug and game_url:
        cleaned = game_url.rstrip('/')
        game_slug = cleaned.split('/')[-1]

    if game_slug:
        db_game = firestore_db.get_game_by_slug(game_slug)
        if db_game and db_game.get('resolved') and db_game.get('direct_links'):
            # Instant 0-second delivery! No browser spinning required!
            direct_links = db_game['direct_links']
            return jsonify({
                'success': True,
                'instant': True,
                'job_id': 'pre-resolved',
                'game_title': db_game.get('title', game_title),
                'total_parts': len(direct_links),
                'direct_links': direct_links
            })
    
    if not links:
        if game_url:
            details = fitgirl_scraper.get_game_details(game_url)
            if details:
                links = details.get('fuckingfast_links', [])
                game_title = details.get('title', game_title)
                
    if not links:
        return jsonify({'success': False, 'error': 'No FuckingFast links found for this game'}), 400
        
    # Clear previous download_links.txt to reset part counter
    output_file = os.path.join(TMP_DIR, 'download_links.txt')
    try:
        open(output_file, 'w', encoding='utf-8').close()
    except Exception:
        pass

    job_id = str(uuid.uuid4())
    job = DownloadJob(job_id, game_title, links)
    jobs[job_id] = job
    
    # Run job in background thread
    thread = threading.Thread(target=job.run, daemon=True)
    thread.start()
    
    return jsonify({
        'success': True,
        'job_id': job_id,
        'game_title': game_title,
        'total_parts': len(links)
    })

@app.route('/api/extract_links', methods=['POST'])
def api_extract_links():
    """Returns pre-extracted direct links from database instantly, or resolves via bridge."""
    data = request.json or {}
    game_title = data.get('game_title', 'Unknown Game')
    game_slug = data.get('slug')
    game_url = data.get('game_url')
    links = data.get('links', [])

    # 1. Check if already resolved in Firestore / Database!
    if not game_slug and game_url:
        cleaned = game_url.rstrip('/')
        game_slug = cleaned.split('/')[-1]

    if game_slug:
        db_game = firestore_db.get_game_by_slug(game_slug)
        if db_game and db_game.get('resolved') and db_game.get('direct_links'):
            direct_links = db_game['direct_links']
            return jsonify({
                'success': True,
                'instant': True,
                'game_title': db_game.get('title', game_title),
                'total_parts': len(direct_links),
                'extracted_count': len(direct_links),
                'direct_links': direct_links,
                'logs': [
                    f"> ⚡ Found pre-extracted direct links in Database for '{db_game.get('title', game_title)}'!",
                    f"> 🚀 Instantly loaded all {len(direct_links)} direct download links in 0.01 seconds!"
                ]
            })

    if not links:
        if game_url:
            details = fitgirl_scraper.get_game_details(game_url)
            if details:
                links = details.get('fuckingfast_links', [])
                game_title = details.get('title', game_title)
    
    if not links:
        return jsonify({'success': False, 'error': 'No FuckingFast links found for this game'}), 400
    
    result = fdm_bridge.resolve_links_sync(links)
    
    return jsonify({
        'success': result['status'] == 'success',
        'game_title': game_title,
        'total_parts': len(links),
        'extracted_count': result['extracted_count'],
        'direct_links': result['direct_links'],
        'logs': result.get('logs', [])
    })


@app.route('/api/community-link-results', methods=['POST'])
def community_link_results():
    """Accept a completed local extraction and save it against its exact DB game."""
    body = request.get_json(silent=True) or {}
    source_links = _normalized_url_set(body.get('source_links'))
    direct_links = body.get('direct_links')

    if not source_links or not isinstance(direct_links, list):
        return jsonify({'success': False, 'error': 'source_links and direct_links are required.'}), 400
    if len(source_links) != len(body.get('source_links', [])):
        return jsonify({'success': False, 'error': 'Duplicate source links are not accepted.'}), 400
    if len(direct_links) != len(source_links) or len(set(direct_links)) != len(direct_links):
        return jsonify({'success': False, 'error': 'Every source part needs one unique direct link.'}), 400
    if not all(isinstance(url, str) and _is_expected_direct_link(url) for url in direct_links):
        return jsonify({'success': False, 'error': 'One or more direct links are invalid.'}), 400

    matches = []
    for game in firestore_db.get_all_cached_games():
        game_sources = _normalized_url_set(game.get('fuckingfast_links', []))
        if game_sources == source_links:
            matches.append(game)

    if len(matches) != 1:
        message = 'No matching game was found for these source links.' if not matches else 'Source links match more than one game.'
        return jsonify({'success': False, 'error': message}), 404 if not matches else 409

    game = matches[0]
    slug = game.get('slug')
    if not slug:
        return jsonify({'success': False, 'error': 'Matched game has no database identifier.'}), 500

    if not firestore_db.update_game_links(slug, direct_links, total_parts=len(source_links)):
        return jsonify({'success': False, 'error': 'Could not update the game database.'}), 503

    return jsonify({
        'success': True,
        'slug': slug,
        'game_title': game.get('title', slug),
        'saved_links': len(direct_links),
    })

@app.route('/api/job_status/<job_id>', methods=['GET'])
def api_job_status(job_id):
    job = jobs.get(job_id)
    
    if not job:
        # Fallback for server restart or completed job fallback
        direct_links = get_extracted_links()
        if direct_links:
            return jsonify({
                'success': True,
                'job_id': job_id,
                'game_title': 'Extracted Game Links',
                'status': 'completed',
                'total_parts': len(direct_links),
                'processed_count': len(direct_links),
                'progress_percent': 100.0,
                'current_part_name': 'All parts ready',
                'logs': [f"> Server synchronized {len(direct_links)} extracted links"],
                'result': {
                    'status': 'success',
                    'extracted_count': len(direct_links),
                    'direct_links': direct_links,
                    'clipboard_copied': True
                }
            })
        return jsonify({'success': False, 'error': 'Job not found'}), 404
        
    extracted_count = get_extracted_links_count()
    processed_count = max(job.processed_count, extracted_count)
    if job.status == 'completed':
        processed_count = job.total_parts if job.total_parts > 0 else extracted_count
        
    progress_percent = 0.0
    if job.total_parts > 0:
        progress_percent = min(100.0, round((processed_count / job.total_parts) * 100, 1))
    if job.status == 'completed':
        progress_percent = 100.0

    return jsonify({
        'success': True,
        'job_id': job.job_id,
        'game_title': job.game_title,
        'status': job.status,
        'total_parts': job.total_parts,
        'processed_count': processed_count,
        'progress_percent': progress_percent,
        'current_part_name': job.current_part_name,
        'logs': job.logs[-25:],
        'result': job.result or {
            'status': 'success' if job.status == 'completed' else 'running',
            'extracted_count': processed_count,
            'direct_links': get_extracted_links(),
            'clipboard_copied': True
        }
    })

@app.route('/api/download_txt', methods=['GET'])
def api_download_txt():
    output_file = os.path.join(TMP_DIR, 'download_links.txt')
    if os.path.exists(output_file):
        return send_from_directory(os.path.dirname(output_file), os.path.basename(output_file), as_attachment=True)
    # Fallback: return links as JSON for client-side file generation
    return jsonify({'success': False, 'error': 'No download_links.txt file exists yet. Use /api/extract_links and generate the file client-side.'}), 404

@app.route('/api/copy_clipboard', methods=['POST'])
def api_copy_clipboard():
    """Returns links as JSON. Client-side JS handles clipboard via navigator.clipboard."""
    output_file = os.path.join(TMP_DIR, 'download_links.txt')
    
    # Try reading from file first (works for local server + background job flow)
    if os.path.exists(output_file):
        try:
            with open(output_file, 'r', encoding='utf-8') as f:
                content = f.read().strip()
            if content:
                links = [line.strip() for line in content.split('\n') if line.strip()]
                # Try Windows clipboard (local only, will fail on Vercel)
                try:
                    import subprocess
                    p = subprocess.Popen(['clip'], stdin=subprocess.PIPE, close_fds=True)
                    p.communicate(input=content.encode('utf-8'))
                    return jsonify({'success': True, 'message': 'Copied links to Windows Clipboard', 'links': links})
                except Exception:
                    # Not on Windows or clip not available (Vercel) — return links for client-side copy
                    return jsonify({'success': True, 'message': 'Links ready for clipboard', 'links': links})
        except Exception:
            pass
    
    return jsonify({'success': False, 'error': 'No links available. Extract links first.'}), 400

# ============================================================================
#  ADMIN API ENDPOINTS
# ============================================================================

@app.route('/api/admin/stats')
def admin_stats():
    """Get overall platform statistics for admin dashboard."""
    try:
        db = firestore_db.get_db()
        if not db:
            return jsonify({'success': False, 'error': 'Database unavailable'}), 503

        # Count games
        games_ref = db.collection('games')
        all_games = list(games_ref.stream())
        total_games = len(all_games)

        resolved_games = 0
        total_links = 0
        for doc in all_games:
            data = doc.to_dict()
            links = data.get('direct_links', [])
            if links and len(links) > 0:
                resolved_games += 1
                total_links += len(links)

        # Count pending requests
        requests_ref = db.collection('game_requests')
        pending_requests = len(list(requests_ref.stream()))

        return jsonify({
            'success': True,
            'stats': {
                'total_games': total_games,
                'resolved_games': resolved_games,
                'pending_requests': pending_requests,
                'total_links': total_links
            }
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/admin/requests')
def admin_requests():
    """Get all pending game link requests."""
    try:
        db = firestore_db.get_db()
        if not db:
            return jsonify({'success': False, 'error': 'Database unavailable'}), 503

        requests_ref = db.collection('game_requests').order_by('request_count', direction='DESCENDING')
        docs = list(requests_ref.stream())
        results = []
        for doc in docs:
            data = doc.to_dict()
            data['id'] = doc.id
            results.append(data)

        return jsonify({'success': True, 'requests': results})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/admin/prioritize', methods=['POST'])
def admin_prioritize():
    """Move a game request to high priority in the resolution queue."""
    try:
        body = request.get_json(silent=True) or {}
        slug = body.get('slug', '')
        if not slug:
            return jsonify({'success': False, 'error': 'Missing slug'}), 400

        db = firestore_db.get_db()
        if not db:
            return jsonify({'success': False, 'error': 'Database unavailable'}), 503

        req_ref = db.collection('game_requests').document(slug)
        req_ref.set({'priority': True, 'prioritized_at': time.time()}, merge=True)
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/admin/dismiss-request', methods=['POST'])
def admin_dismiss_request():
    """Remove a game request from the queue."""
    try:
        body = request.get_json(silent=True) or {}
        slug = body.get('slug', '')
        if not slug:
            return jsonify({'success': False, 'error': 'Missing slug'}), 400

        db = firestore_db.get_db()
        if not db:
            return jsonify({'success': False, 'error': 'Database unavailable'}), 503

        db.collection('game_requests').document(slug).delete()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/admin/update-game', methods=['POST'])
def admin_update_game():
    """Update game metadata (title, genres, description)."""
    try:
        body = request.get_json(silent=True) or {}
        slug = body.get('slug', '')
        if not slug:
            return jsonify({'success': False, 'error': 'Missing slug'}), 400

        db = firestore_db.get_db()
        if not db:
            return jsonify({'success': False, 'error': 'Database unavailable'}), 503

        update_data = {}
        for field in ['title', 'genres', 'description']:
            if field in body:
                update_data[field] = body[field]

        if update_data:
            game_ref = db.collection('games').document(slug)
            game_ref.set(update_data, merge=True)

        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_spa(path):
    if path.startswith('api/'):
        return jsonify({'error': 'Endpoint not found'}), 404
        
    dist_file = os.path.join(DIST_DIR, path)
    if os.path.exists(dist_file) and not os.path.isdir(dist_file):
        return send_from_directory(DIST_DIR, path)
        
    static_file = os.path.join(STATIC_DIR, path)
    if os.path.exists(static_file) and not os.path.isdir(static_file):
        return send_from_directory(STATIC_DIR, path)
        
    if os.path.exists(os.path.join(DIST_DIR, 'index.html')):
        return send_from_directory(DIST_DIR, 'index.html')
    return send_from_directory(STATIC_DIR, 'index.html')

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 7860))
    print(f"Starting FitGirl Game Library & Downloader Server on http://0.0.0.0:{port}")
    app.run(host='0.0.0.0', port=port)
