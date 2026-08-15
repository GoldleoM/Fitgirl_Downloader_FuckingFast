import cloudscraper
import requests
import json
import re
import os
import concurrent.futures
from bs4 import BeautifulSoup
import urllib.parse
import fitgirl_scraper
import firestore_db

scraper = cloudscraper.create_scraper()

def fetch_steam_specs_for_title(title):
    clean_name = re.sub(r'\(.*?\)|\[.*?\]|v\d+.*|Digital Deluxe.*|Ultimate Edition.*|\+.*|Repack.*|#\d+.*', '', title).strip()
    try:
        st_res = requests.get(f"https://store.steampowered.com/api/storesearch/?term={urllib.parse.quote(clean_name)}&l=english&cc=US", timeout=4)
        if st_res.status_code == 200:
            items = st_res.json().get('items', [])
            if items:
                app_id = items[0]['id']
                d_res = requests.get(f"https://store.steampowered.com/api/appdetails?appids={app_id}&l=english", timeout=4)
                if d_res.status_code == 200:
                    data = d_res.json().get(str(app_id), {}).get('data', {})
                    pc_reqs = data.get('pc_requirements', {})
                    if isinstance(pc_reqs, dict):
                        def parse_steam_block(html_str):
                            if not html_str: return {}
                            soup = BeautifulSoup(html_str, 'html.parser')
                            specs = {}
                            for li in soup.find_all('li'):
                                text = li.get_text().strip()
                                if ':' in text:
                                    k, v = text.split(':', 1)
                                    v = re.sub(r'\(MORE DETAILS HERE\)', '', v, flags=re.I).strip()
                                    specs[k.strip().lower()] = v
                            if not specs:
                                text = soup.get_text()
                                for k in ['os', 'processor', 'memory', 'graphics', 'directx', 'storage', 'additional notes']:
                                    m = re.search(rf'{k}\s*:\s*([^\n\r<]+)', text, re.I)
                                    if m: specs[k] = m.group(1).strip()
                            return specs
                            
                        min_specs = parse_steam_block(pc_reqs.get('minimum', ''))
                        rec_specs = parse_steam_block(pc_reqs.get('recommended', ''))
                        return min_specs, rec_specs
    except Exception as e:
        pass
    return {}, {}

# Fetch 150 popular games from fitgirl_scraper
pop_items = fitgirl_scraper.get_all_popular_repacks()
print(f"Loaded {len(pop_items)} popular games.")

enriched_games = []

def process_game(item):
    title = item.get('title', '')
    url = item.get('url', '')
    slug = url.rstrip('/').split('/')[-1]
    
    # Check Firestore first
    db_game = firestore_db.get_game_by_slug(slug) or {}
    
    # Check if we already have Steam specs
    min_specs = db_game.get('requirements', {}).get('minimum', {})
    rec_specs = db_game.get('requirements', {}).get('recommended', {})
    
    if not min_specs or not min_specs.get('graphics'):
        min_specs, rec_specs = fetch_steam_specs_for_title(title)
        
    reqs = db_game.get('requirements') or {}
    if min_specs: reqs['minimum'] = min_specs
    if rec_specs: reqs['recommended'] = rec_specs
    
    # Screenshots
    screenshots = db_game.get('screenshots') or item.get('screenshots') or []
    description = db_game.get('description') or item.get('description') or ''
    cover = db_game.get('cover') or item.get('cover') or ''
    
    if cover and cover.startswith('http') and not cover.startswith('/api/image_proxy'):
        pass # Direct CDN
        
    game_obj = {
        'title': title,
        'url': url,
        'slug': slug,
        'cover': cover,
        'screenshots': screenshots,
        'description': description,
        'genres': db_game.get('genres') or item.get('genres') or '',
        'companies': db_game.get('companies') or item.get('companies') or '',
        'languages': db_game.get('languages') or item.get('languages') or '',
        'repack_size': db_game.get('repack_size') or item.get('repack_size') or '',
        'original_size': db_game.get('original_size') or item.get('original_size') or '',
        'features': db_game.get('features') or [],
        'requirements': reqs,
        'fuckingfast_links': db_game.get('fuckingfast_links') or [],
        'parts_count': len(db_game.get('fuckingfast_links') or []),
        'resolved': db_game.get('resolved', False),
        'direct_links': db_game.get('direct_links') or [],
        'requested': db_game.get('requested', False),
        'request_count': db_game.get('request_count', 0)
    }
    return game_obj

print("Enriching popular games with Steam PC requirements in parallel...")
with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
    results = list(executor.map(process_game, pop_items))
    enriched_games = [r for r in results if r]

print(f"Enriched {len(enriched_games)} games!")

# Write to static frontend file and public JSON
out_js = os.path.join('frontend', 'src', 'data', 'popularCatalog.js')
with open(out_js, 'w', encoding='utf-8') as f:
    f.write(f"export const POPULAR_CATALOG = {json.dumps(enriched_games, indent=2, ensure_ascii=False)};\n")

out_json = os.path.join('frontend', 'public', 'popular_catalog.json')
with open(out_json, 'w', encoding='utf-8') as f:
    json.dump(enriched_games, f, indent=2, ensure_ascii=False)

print("Saved popularCatalog.js and popular_catalog.json successfully!")
