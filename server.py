import os
import sys
import uuid
import threading
import concurrent.futures
import tempfile
from flask import Flask, request, jsonify, send_from_directory, Response
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

app = Flask(__name__, static_folder='static')
CORS(app, resources={r"/*": {"origins": "*"}})

@app.after_request
def add_cors_headers(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Requested-With'
    return response

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

@app.route('/')
def index():
    return send_from_directory('static', 'index.html')

@app.route('/<path:path>')
def static_files(path):
    return send_from_directory('static', path)

FALLBACK_SVG = """<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400" viewBox="0 0 300 400">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#141724"/>
      <stop offset="100%" stop-color="#0a0b10"/>
    </linearGradient>
    <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#8a2be2"/>
      <stop offset="100%" stop-color="#00f2fe"/>
    </linearGradient>
  </defs>
  <rect width="300" height="400" fill="url(#bg)" rx="12"/>
  <rect x="2" y="2" width="296" height="396" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="2" rx="10"/>
  <circle cx="150" cy="170" r="45" fill="rgba(138,43,226,0.15)" stroke="url(#accent)" stroke-width="3"/>
  <polygon points="140,152 168,170 140,188" fill="#00f2fe"/>
  <text x="150" y="250" font-family="system-ui, sans-serif" font-size="16" font-weight="bold" fill="#ffffff" text-anchor="middle">FITGIRL REPACK</text>
  <text x="150" y="275" font-family="system-ui, sans-serif" font-size="12" fill="#8c96a8" text-anchor="middle">Cover Image</text>
</svg>"""

def proxy_image(img_url):
    if not img_url:
        return Response(FALLBACK_SVG, mimetype='image/svg+xml')
    if img_url.startswith('//'):
        img_url = 'https:' + img_url
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Referer': 'https://fitgirl-repacks.site/'
        }
        res = fitgirl_scraper.scraper.get(img_url, headers=headers, timeout=12)
        if res.status_code == 200 and len(res.content) > 100:
            content_type = res.headers.get('Content-Type', 'image/jpeg')
            return Response(res.content, mimetype=content_type)
    except Exception as e:
        print(f"Proxy error fetching {img_url}: {e}")
    return Response(FALLBACK_SVG, mimetype='image/svg+xml')

@app.route('/api/image_proxy', methods=['GET'])
def api_image_proxy():
    img_url = request.args.get('url', '').strip()
    return proxy_image(img_url)

@app.route('/api/game_cover', methods=['GET'])
def api_game_cover():
    game_url = request.args.get('url', '').strip()
    if not game_url:
        return Response(FALLBACK_SVG, mimetype='image/svg+xml')
    cover_proxy_url = fitgirl_scraper.get_game_cover_url(game_url)
    if cover_proxy_url and '/api/image_proxy?url=' in cover_proxy_url:
        img_url = cover_proxy_url.split('/api/image_proxy?url=', 1)[1]
        return proxy_image(img_url)
    return Response(FALLBACK_SVG, mimetype='image/svg+xml')

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

def _enrich_game_with_db_status(item):
    """Adds resolved status, slug, and direct_links info from database to a game dict."""
    url = item.get('url', '')
    slug = item.get('slug')
    if not slug and url:
        slug = url.rstrip('/').split('/')[-1]
    item['slug'] = slug
    
    db_game = firestore_db.get_game_by_slug(slug)
    if db_game:
        item['resolved'] = bool(db_game.get('resolved') and db_game.get('direct_links'))
        item['direct_links_count'] = len(db_game.get('direct_links', []))
        item['parts_count'] = db_game.get('parts_count') or len(db_game.get('fuckingfast_links', []))
    else:
        item['resolved'] = False
        item['direct_links_count'] = 0
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
    else:
        results = fitgirl_scraper.search_games(query)
    
    # Automatically queue all searched games to be ingested into Firestore in the background!
    _queue_auto_ingest(results)
    
    enriched = [_enrich_game_with_db_status(g) for g in results]
    return jsonify({'success': True, 'results': enriched})

@app.route('/api/game', methods=['GET'])
def api_game():
    game_url = request.args.get('url', '').strip()
    game_slug = request.args.get('slug', '').strip()
    
    if not game_url and not game_slug:
        return jsonify({'success': False, 'error': 'Missing url or slug parameter'}), 400

    # 1. Check database for existing game by slug
    if not game_slug and game_url:
        cleaned = game_url.rstrip('/')
        game_slug = cleaned.split('/')[-1]

    if game_slug:
        db_game = firestore_db.get_game_by_slug(game_slug)
        if db_game:
            # Normalize cover image URL
            cov = db_game.get('cover')
            if not cov or cov == 'None':
                db_game['cover'] = f"/api/game_cover?url={db_game.get('url', game_url)}"
            elif cov.startswith('http') and not cov.startswith('/api/image_proxy') and not cov.startswith('/api/game_cover'):
                db_game['cover'] = f"/api/image_proxy?url={cov}"
                
            if db_game.get('fuckingfast_links') and len(db_game['fuckingfast_links']) > 0:
                return jsonify({'success': True, 'game': db_game})

    # 2. If not found in DB or missing raw links, scrape from FitGirl and store raw fuckingfast links in DB!
    if game_url:
        details = fitgirl_scraper.get_game_details(game_url)
        if details:
            if not game_slug:
                game_slug = game_url.rstrip('/').split('/')[-1]
            details['slug'] = game_slug
            if 'resolved' not in details:
                details['resolved'] = False
            if 'direct_links' not in details:
                details['direct_links'] = []
            
            cov = details.get('cover')
            if not cov or cov == 'None':
                details['cover'] = f"/api/game_cover?url={game_url}"
            elif cov.startswith('http') and not cov.startswith('/api/image_proxy') and not cov.startswith('/api/game_cover'):
                details['cover'] = f"/api/image_proxy?url={cov}"
            
            # Save raw fuckingfast links into Firestore so user can resolve them with the script later
            firestore_db.upsert_game(details)
            return jsonify({'success': True, 'game': details})
            
    return jsonify({'success': False, 'error': 'Could not fetch game details'}), 404

@app.route('/api/db_stats', methods=['GET'])
def api_db_stats():
    """Returns overview of Firestore database status."""
    is_connected = firestore_db.is_firestore_connected()
    all_games = firestore_db.get_all_popular_games(page=1, per_page=500)
    items = all_games.get('items', [])
    total = len(items)
    resolved = sum(1 for g in items if g.get('resolved') and g.get('direct_links'))
    return jsonify({
        'firestore_connected': is_connected,
        'total_games': total,
        'resolved_games': resolved,
        'pending_games': max(0, total - resolved)
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

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 7860))
    print(f"Starting FitGirl Game Library & Downloader Server on http://0.0.0.0:{port}")
    app.run(host='0.0.0.0', port=port)
