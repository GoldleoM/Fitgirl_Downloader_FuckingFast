import re
import cloudscraper
import concurrent.futures
from bs4 import BeautifulSoup

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5'
}

scraper = cloudscraper.create_scraper()

RAM_COVER_CACHE = {}

BAD_IMAGE_KEYWORDS = ['torrent-stats', 'fg_updates', 'cropped-icon', 'hit-counter', 'paypal', 'donate', 'flag', 'avatar']

def extract_cover_url(container):
    """Extract and format cover image URL with proxy support."""
    if not container:
        return None
        
    img_elems = container.find_all('img')
    if not img_elems:
        return None
        
    selected_src = None
    for img in img_elems:
        src = img.get('src') or img.get('data-src') or img.get('data-lazy-src')
        if not src and img.get('srcset'):
            src = img['srcset'].split(',')[0].split(' ')[0]
            
        if not src or src.startswith('data:'):
            continue
            
        if any(bad in src.lower() for bad in BAD_IMAGE_KEYWORDS):
            continue
            
        img_classes = img.get('class', [])
        if isinstance(img_classes, list):
            img_classes_str = ' '.join(img_classes)
        else:
            img_classes_str = str(img_classes)
            
        if 'alignleft' in img_classes_str or 'wplp_thumb' in img_classes_str or any(h in src for h in ['imageban', 'fastpic', 'riotpixels']):
            selected_src = src
            break
            
        if not selected_src:
            selected_src = src

    if not selected_src:
        return None
        
    if selected_src.startswith('//'):
        selected_src = 'https:' + selected_src

    return f"/api/image_proxy?url={selected_src}"


def get_game_cover_url(game_url):
    """Resolve and cache cover image URL in RAM for a given game page."""
    if not game_url:
        return None
    if game_url in RAM_COVER_CACHE:
        return RAM_COVER_CACHE[game_url]
        
    try:
        res = scraper.get(game_url, headers=HEADERS, timeout=8)
        if res.status_code == 200:
            soup = BeautifulSoup(res.text, 'html.parser')
            content = soup.find('div', class_='entry-content') or soup
            cover = extract_cover_url(content)
            if cover:
                RAM_COVER_CACHE[game_url] = cover
                return cover
    except Exception as e:
        print(f"Error resolving cover for {game_url}: {e}")
    return None


NON_GAME_KEYWORDS = [
    'digest', 'updates digest', 'updates-digest', 'updates list', 'updates-list',
    'upcoming repacks', 'upcoming', 'faq', 'troubleshooting', 'repacks-troubleshooting',
    'donate', 'contact', 'my-bookmarks'
]

def is_non_game_post(title, url):
    title_lower = title.lower()
    url_lower = url.lower()
    for kw in NON_GAME_KEYWORDS:
        if kw in title_lower or kw in url_lower:
            return True
    return False


def _scrape_fitgirl_search(query_str: str) -> list:
    """Helper to scrape a single search query on FitGirl WordPress site."""
    search_url = f"https://fitgirl-repacks.site/?s={query_str.replace(' ', '+')}"
    try:
        res = scraper.get(search_url, headers=HEADERS, timeout=15)
        if res.status_code != 200:
            return []
            
        soup = BeautifulSoup(res.text, 'html.parser')
        articles = soup.find_all('article')
        
        results = []
        for article in articles:
            title_elem = article.find('h1', class_='entry-title')
            if not title_elem or not title_elem.find('a'):
                continue
                
            title = title_elem.text.strip()
            url = title_elem.find('a')['href']
            
            # Skip non-game posts like 'Updates Digest', 'Upcoming Repacks', 'FAQ', etc.
            if is_non_game_post(title, url):
                continue
                
            cover = RAM_COVER_CACHE.get(url) or extract_cover_url(article)
            
            date_elem = article.find('time', class_='entry-date')
            date = date_elem.text.strip() if date_elem else ""
            
            excerpt_elem = article.find('div', class_='entry-summary') or article.find('div', class_='entry-content')
            excerpt = excerpt_elem.text.strip()[:200] if excerpt_elem else ""
            
            results.append({
                'title': title,
                'url': url,
                'cover': cover,
                'date': date,
                'excerpt': excerpt
            })
        for item in results:
            if not item['cover']:
                item['cover'] = f"/api/game_cover?url={item['url']}"

        return results
    except Exception as e:
        print(f"Scraper error in _scrape_fitgirl_search for '{query_str}': {e}")
        return []


def search_games(query, max_results=16):
    """Search games on FitGirl Repacks by keyword with typo-correction, alias fallback, and popular repacks index."""
    if not query:
        return get_catalog()

    results = []

    # 1. Check in-memory Top Popular Repacks list (fastest, zero-latency response)
    pop_items = get_all_popular_repacks()
    if pop_items:
        try:
            import firestore_db
            for item in pop_items:
                sim = firestore_db.compute_game_similarity(query, item.get('title', ''))
                if sim >= 0.60:
                    results.append(item)
        except Exception:
            pass

    # 2. Scrape WordPress for query
    web_res = _scrape_fitgirl_search(query)
    results.extend(web_res)

    # 3. If no web results, try typo-corrected / alias expansions on WordPress
    if not web_res:
        try:
            import firestore_db
            alt_queries = firestore_db.expand_search_query(query)
            for alt in alt_queries:
                if alt != query.lower().strip():
                    alt_res = _scrape_fitgirl_search(alt)
                    if alt_res:
                        results.extend(alt_res)
                        break
        except Exception:
            pass

    # Deduplicate results by URL
    seen_urls = set()
    deduped = []
    for item in results:
        u = item.get('url')
        if u and u not in seen_urls:
            seen_urls.add(u)
            deduped.append(item)

    return deduped[:max_results]

def get_catalog(page=1, max_results=16):
    """Get latest game repacks from homepage with instant non-blocking response."""
    url = f"https://fitgirl-repacks.site/page/{page}/" if page > 1 else "https://fitgirl-repacks.site/"
    try:
        res = scraper.get(url, headers=HEADERS, timeout=15)
        if res.status_code != 200:
            return []
            
        soup = BeautifulSoup(res.text, 'html.parser')
        articles = soup.find_all('article')
        
        catalog = []
        for article in articles:
            title_elem = article.find('h1', class_='entry-title')
            if not title_elem or not title_elem.find('a'):
                continue
                
            title = title_elem.text.strip()
            game_url = title_elem.find('a')['href']
            
            # Filter out non-game posts like 'Updates Digest', 'Upcoming Repacks', etc.
            if is_non_game_post(title, game_url):
                continue
                
            cover = RAM_COVER_CACHE.get(game_url) or extract_cover_url(article) or f"/api/game_cover?url={game_url}"
            
            date_elem = article.find('time', class_='entry-date')
            date = date_elem.text.strip() if date_elem else ""
            
            catalog.append({
                'title': title,
                'url': game_url,
                'cover': cover,
                'date': date
            })
            if len(catalog) >= max_results:
                break

        return catalog
    except Exception as e:
        print(f"Scraper error in get_catalog: {e}")
        return []

POPULAR_REPACKS_CACHE = []

def _fetch_all_popular_repacks(max_results=150):
    """Fetch Top 150 Repacks of the Year from https://fitgirl-repacks.site/popular-repacks-of-the-year/"""
    url = "https://fitgirl-repacks.site/popular-repacks-of-the-year/"
    for attempt in range(2):
        try:
            res = scraper.get(url, headers=HEADERS, timeout=20)
            if res.status_code != 200:
                continue
                
            soup = BeautifulSoup(res.text, 'html.parser')
            raw_links = soup.find_all('a', href=True)
            
            seen = set()
            games = []
            for a in raw_links:
                href = a['href']
                if not href.startswith('https://fitgirl-repacks.site/'):
                    continue
                    
                slug = href.replace('https://fitgirl-repacks.site/', '').strip('/')
                if not slug or any(k in slug for k in [
                    'page', 'category', 'tag', 'popular', 'pop-repacks', 'all-my-repacks',
                    'pink-paw', 'hypervisor', 'updates', 'faq', 'donations', 'contacts',
                    'memecoin', 'feed', 'emulated', 'troubleshooting', '202', '201'
                ]):
                    continue
                    
                if href in seen:
                    continue
                seen.add(href)
                
                title = a.text.strip()
                if not title or len(title) < 3:
                    words = slug.split('-')
                    title = ' '.join(w.capitalize() for w in words)
                    
                cover = RAM_COVER_CACHE.get(href) or extract_cover_url(a)
                
                games.append({
                    'title': title,
                    'url': href,
                    'cover': cover,
                    'date': '🔥 Top Repack of the Year'
                })
                if len(games) >= max_results:
                    break

            if games:
                return games
        except Exception as e:
            print(f"Attempt {attempt+1} error in _fetch_all_popular_repacks: {e}")
    return []

def prewarm_popular_cache():
    global POPULAR_REPACKS_CACHE
    if not POPULAR_REPACKS_CACHE:
        print("Pre-warming Popular Repacks Cache in background...")
        POPULAR_REPACKS_CACHE = _fetch_all_popular_repacks(max_results=150)
        print(f"Pre-warmed {len(POPULAR_REPACKS_CACHE)} Popular Repacks!")

try:
    concurrent.futures.ThreadPoolExecutor(max_workers=1).submit(prewarm_popular_cache)
except Exception:
    pass

def get_all_popular_repacks():
    """Returns the complete list of 150 popular repacks from RAM cache."""
    global POPULAR_REPACKS_CACHE
    if not POPULAR_REPACKS_CACHE:
        POPULAR_REPACKS_CACHE = _fetch_all_popular_repacks(max_results=150)
    return POPULAR_REPACKS_CACHE or []

def get_popular_repacks(page=1, per_page=16):
    """Get paginated popular repacks (16 per page) with instant non-blocking response."""
    import math
    global POPULAR_REPACKS_CACHE
    if not POPULAR_REPACKS_CACHE:
        POPULAR_REPACKS_CACHE = _fetch_all_popular_repacks(max_results=150)
        
    total_items = len(POPULAR_REPACKS_CACHE)
    total_pages = math.ceil(total_items / per_page) if total_items > 0 else 1
    page = max(1, min(page, total_pages))
    
    start_idx = (page - 1) * per_page
    end_idx = start_idx + per_page
    page_items = POPULAR_REPACKS_CACHE[start_idx:end_idx]
    
    # Assign lazy proxy cover URL for instant non-blocking response
    results = []
    for g in page_items:
        cover_url = g.get('cover') or f"/api/game_cover?url={g['url']}"
        results.append({
            'title': g['title'],
            'url': g['url'],
            'cover': cover_url,
            'date': g['date']
        })
            
    return {
        'items': results,
        'page': page,
        'per_page': per_page,
        'total_pages': total_pages,
        'total_items': total_items
    }

def get_game_details(game_url):
    """Fetch full details, screenshots, description, system requirements, and direct links for a game page."""
    try:
        res = scraper.get(game_url, headers=HEADERS, timeout=20)
        if res.status_code != 200:
            return None
            
        try:
            soup = BeautifulSoup(res.text, 'lxml')
        except Exception:
            soup = BeautifulSoup(res.text, 'html.parser')
            
        content = soup.find('div', class_='entry-content') or soup
        
        # 1. Title
        title_elem = soup.find('h1', class_='entry-title')
        title = title_elem.text.strip() if title_elem else "Unknown Game"
        
        # 2. Cover image
        cover = extract_cover_url(content)
        
        # 3. Screenshots (RiotPixels, ImageBan, FastPic, etc.)
        BAD_KEYWORDS = ['torrent-stats', 'fg_updates', 'cropped-icon', 'hit-counter', 'paypal', 'donate', 'flag', 'avatar']
        raw_screenshots = []
        for img in content.find_all('img'):
            src = img.get('src') or img.get('data-src') or img.get('data-lazy-src')
            if not src or any(b in src.lower() for b in BAD_KEYWORDS):
                continue
            if src.startswith('//'):
                src = 'https:' + src
            if any(h in src.lower() for h in ['riotpixels', 'imageban', 'fastpic', 'pixhost', 'imagetwist', 'postimg']):
                high_res = src.replace('.240p.jpg', '.720p.jpg').replace('http://', 'https://')
                if high_res != cover and high_res not in raw_screenshots:
                    raw_screenshots.append(high_res)
                    
        # Also check <a> tags for riotpixels screenshot links
        for a in content.find_all('a', href=True):
            href = a['href']
            if 'riotpixels.com' in href and '/screenshots/' in href:
                img = a.find('img')
                if img:
                    src = img.get('src') or img.get('data-src')
                    if src:
                        high_res = src.replace('.240p.jpg', '.720p.jpg').replace('http://', 'https://')
                        if high_res != cover and high_res not in raw_screenshots:
                            raw_screenshots.append(high_res)
                            
        screenshots = [f"/api/image_proxy?url={s}" for s in raw_screenshots[:8]]

        # 4. Metadata (Genres, Companies, Languages, Sizes)
        full_text = content.text
        features = []
        repack_size = "N/A"
        original_size = "N/A"
        genres = ""
        companies = ""
        languages = ""
        
        match_repack = re.search(r'Repack Size:\s*([^,\n]+)', full_text, re.IGNORECASE)
        if match_repack:
            repack_size = match_repack.group(1).strip()
            
        match_orig = re.search(r'Original Size:\s*([^,\n]+)', full_text, re.IGNORECASE)
        if match_orig:
            original_size = match_orig.group(1).strip()

        m_gen = re.search(r'Genres?/Tags?:\s*([^\n\r]+)', full_text, re.IGNORECASE)
        if m_gen:
            genres = m_gen.group(1).strip()

        m_comp = re.search(r'Companies:\s*([^\n\r]+)', full_text, re.IGNORECASE)
        if m_comp:
            companies = m_comp.group(1).strip()

        m_lang = re.search(r'Languages:\s*([^\n\r]+)', full_text, re.IGNORECASE)
        if m_lang:
            languages = m_lang.group(1).strip()
            
        # 5. Extract Repack Features (ul list or section block)
        for ul in content.find_all('ul'):
            lis = [li.text.strip() for li in ul.find_all('li') if li.text.strip()]
            if any('lossless' in li.lower() or 'md5 perfect' in li.lower() or 'selective download' in li.lower() or 'installation takes' in li.lower() for li in lis):
                features = lis
                break
                
        if not features:
            m_feat = re.search(r'Repack Features\s*[\n\r]+(.*?)(?=Game Description|Game Features|Screenshots|Download Mirrors|Discussion|$)', full_text, re.DOTALL | re.IGNORECASE)
            if m_feat:
                raw_lines = [l.strip().lstrip('•-–* ') for l in m_feat.group(1).split('\n') if len(l.strip()) > 10]
                features = raw_lines[:12]

        # 6. Extract Game Description / Story Overview
        description = ""
        
        # Strategy A: Check Shortcodes Ultimate spoiler blocks (e.g. <div class="su-spoiler-title">Game Description</div>)
        for spoiler in content.find_all('div', class_='su-spoiler'):
            title_div = spoiler.find('div', class_='su-spoiler-title')
            content_div = spoiler.find('div', class_='su-spoiler-content')
            if title_div and 'game description' in title_div.text.lower() and content_div:
                description = content_div.text.strip()
                break

        # Strategy B: Traverse siblings after "Game Description" heading
        if not description:
            desc_header = None
            for h in content.find_all(['h3', 'p', 'strong']):
                if 'game description' in h.text.lower():
                    desc_header = h
                    break
            if desc_header:
                curr = desc_header.parent if desc_header.name == 'strong' else desc_header
                desc_paras = []
                for sib in curr.find_next_siblings():
                    t = sib.text.strip()
                    if any(stop in t.lower() for stop in ['game features', 'repack features', 'download mirrors', 'if you like what i do', 'post navigation']):
                        break
                    if len(t) > 25 and not any(k in t for k in ['Genres/Tags:', 'Companies:', 'Languages:', 'Original Size:', 'Repack Size:']):
                        if t not in desc_paras:
                            desc_paras.append(t)
                    if len(desc_paras) >= 5:
                        break
                if desc_paras:
                    description = '\n\n'.join(desc_paras)

        # 7. Extract System Requirements (RAM, HDD space, Install time)
        reqs = {}
        m_ram = re.search(r'At least\s*([0-9]+\s*GB[^,\n\r]+RAM[^\.\n\r]*)', full_text, re.I)
        if m_ram:
            reqs['ram'] = m_ram.group(1).strip()
        m_hdd = re.search(r'HDD space[^:]*:\s*([^\.\n\r]+)', full_text, re.I)
        if m_hdd:
            reqs['hdd'] = m_hdd.group(1).strip()
        m_time = re.search(r'Installation takes\s*([^\.\n\r]+)', full_text, re.I)
        if m_time:
            reqs['install_time'] = m_time.group(1).strip()

        # 8. Extract FuckingFast links across entire document (including spoiler accordions)
        fuckingfast_links = []
        all_a = content.find_all('a', href=True)
        for a in all_a:
            href = a['href']
            if 'fuckingfast.co' in href:
                if href not in fuckingfast_links:
                    fuckingfast_links.append(href)
                        
        return {
            'title': title,
            'url': game_url,
            'cover': cover,
            'screenshots': screenshots,
            'description': description,
            'genres': genres,
            'companies': companies,
            'languages': languages,
            'repack_size': repack_size,
            'original_size': original_size,
            'features': features,
            'requirements': reqs,
            'fuckingfast_links': fuckingfast_links,
            'parts_count': len(fuckingfast_links)
        }
    except Exception as e:
        print(f"Scraper error in get_game_details: {e}")
        return None

if __name__ == '__main__':
    print("Testing FitGirl Scraper...")
    results = search_games("God of War")
    print(f"Found {len(results)} search results.")
    if results:
        print("First result:", results[0]['title'])
        details = get_game_details(results[0]['url'])
        if details:
            print(f"Extracted {len(details['fuckingfast_links'])} FuckingFast links!")
