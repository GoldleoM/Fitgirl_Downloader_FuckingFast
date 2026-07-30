import os
import uuid
import threading
import tempfile
from flask import Flask, request, jsonify, send_from_directory, Response
from flask_cors import CORS
import fitgirl_scraper
import fdm_bridge

# Vercel's filesystem is read-only except /tmp
TMP_DIR = os.getenv('TMP_DIR', tempfile.gettempdir())

app = Flask(__name__, static_folder='static')
CORS(app)

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
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Referer': 'https://fitgirl-repacks.site/'
        }
        res = fitgirl_scraper.scraper.get(img_url, headers=headers, timeout=10)
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

@app.route('/api/catalog', methods=['GET'])
def api_catalog():
    page = request.args.get('page', 1, type=int)
    catalog = fitgirl_scraper.get_catalog(page=page, max_results=16)
    return jsonify({'success': True, 'catalog': catalog, 'page': page})

@app.route('/api/popular', methods=['GET'])
def api_popular():
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 16, type=int)
    res = fitgirl_scraper.get_popular_repacks(page=page, per_page=per_page)
    return jsonify({
        'success': True,
        'results': res['items'],
        'page': res['page'],
        'per_page': res['per_page'],
        'total_pages': res['total_pages'],
        'total_items': res['total_items']
    })

@app.route('/api/search', methods=['GET'])
def api_search():
    query = request.args.get('q', '').strip()
    if not query:
        return jsonify({'success': True, 'results': fitgirl_scraper.get_catalog()})
    results = fitgirl_scraper.search_games(query)
    return jsonify({'success': True, 'results': results})

@app.route('/api/game', methods=['GET'])
def api_game():
    game_url = request.args.get('url', '').strip()
    if not game_url:
        return jsonify({'success': False, 'error': 'Missing url parameter'}), 400
        
    details = fitgirl_scraper.get_game_details(game_url)
    if not details:
        return jsonify({'success': False, 'error': 'Could not fetch game details'}), 404
        
    return jsonify({'success': True, 'game': details})

@app.route('/api/start_download', methods=['POST'])
def api_start_download():
    data = request.json or {}
    game_title = data.get('game_title', 'Unknown Game')
    links = data.get('links', [])
    
    if not links:
        game_url = data.get('game_url')
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
    if not os.path.exists(output_file):
        return jsonify({'success': False, 'error': 'No download_links.txt file exists yet'}), 404
    return send_from_directory(os.path.dirname(output_file), os.path.basename(output_file), as_attachment=True)

@app.route('/api/copy_clipboard', methods=['POST'])
def api_copy_clipboard():
    output_file = os.path.join(TMP_DIR, 'download_links.txt')
    if not os.path.exists(output_file):
        return jsonify({'success': False, 'error': 'No download_links.txt file exists yet'}), 400
        
    try:
        with open(output_file, 'r', encoding='utf-8') as f:
            content = f.read().strip()
        if not content:
            return jsonify({'success': False, 'error': 'download_links.txt is empty'}), 400
            
        import subprocess
        p = subprocess.Popen(['clip'], stdin=subprocess.PIPE, close_fds=True)
        p.communicate(input=content.encode('utf-8'))
        return jsonify({'success': True, 'message': 'Copied links to Windows Clipboard'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 7860))
    print(f"Starting FitGirl Game Library & Downloader Server on http://0.0.0.0:{port}")
    app.run(host='0.0.0.0', port=port)
