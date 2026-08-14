import os
import sys
import time
import argparse
import concurrent.futures
from colorama import Fore, Style, init
import fitgirl_scraper
import firestore_db

if sys.platform == "win32":
    try:
        if hasattr(sys.stdout, "reconfigure"):
            sys.stdout.reconfigure(encoding="utf-8")
        if hasattr(sys.stderr, "reconfigure"):
            sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

init(autoreset=True)

class Console:
    def __init__(self):
        self.colors = {
            "green": Fore.GREEN, "red": Fore.RED, "yellow": Fore.YELLOW, "blue": Fore.BLUE,
            "magenta": Fore.MAGENTA, "cyan": Fore.CYAN, "white": Fore.WHITE, "reset": Style.RESET_ALL,
            "lightblack": Fore.LIGHTBLACK_EX, "lightgreen": Fore.LIGHTGREEN_EX, "lightcyan": Fore.LIGHTCYAN_EX
        }

    def log(self, tag, color, msg, extra=""):
        extra_str = f" : {self.colors['white']}{extra}" if extra else ""
        print(f"{self.colors['lightblack']}[{time.strftime('%H:%M:%S')}] {color}{tag}{self.colors['reset']} • {msg}{extra_str}")

    def info(self, msg, extra=""):
        self.log("INFO", self.colors["cyan"], msg, extra)

    def success(self, msg, extra=""):
        self.log("SUCCESS", self.colors["green"], msg, extra)

    def warn(self, msg, extra=""):
        self.log("WARN", self.colors["yellow"], msg, extra)

    def error(self, msg, extra=""):
        self.log("ERROR", self.colors["red"], msg, extra)


log = Console()


def generate_slug_from_url(url: str, title: str) -> str:
    """Extract clean URL slug or build from title."""
    cleaned = url.rstrip('/')
    slug = cleaned.split('/')[-1]
    if not slug or slug.isdigit() or len(slug) < 3:
        slug = title.lower().strip()
        slug = ''.join(c if c.isalnum() else '-' for c in slug)
        slug = '-'.join(filter(None, slug.split('-')))
    return slug


def fetch_and_save_game(item: dict, rank: int) -> dict:
    """Fetch complete details and FuckingFast links for a single game and save to DB."""
    url = item['url']
    raw_title = item['title']
    slug = generate_slug_from_url(url, raw_title)

    # Check if already in DB with fuckingfast_links to avoid redundant scrapes
    existing = firestore_db.get_game_by_slug(slug)
    if existing and existing.get('fuckingfast_links') and len(existing['fuckingfast_links']) > 0:
        existing['rank'] = rank
        firestore_db.upsert_game(existing)
        return {
            'status': 'skipped',
            'title': existing.get('title', raw_title),
            'slug': slug,
            'parts_count': len(existing.get('fuckingfast_links', []))
        }

    details = fitgirl_scraper.get_game_details(url)
    if not details:
        return {'status': 'error', 'title': raw_title, 'slug': slug, 'error': 'Could not fetch page details'}

    game_title = details.get('title') or raw_title
    fuckingfast_links = details.get('fuckingfast_links') or []
    cover = details.get('cover') or item.get('cover')

    game_doc = {
        'title': game_title,
        'slug': slug,
        'url': url,
        'cover': cover,
        'repack_size': details.get('repack_size', 'N/A'),
        'original_size': details.get('original_size', 'N/A'),
        'features': details.get('features', []),
        'fuckingfast_links': fuckingfast_links,
        'parts_count': len(fuckingfast_links),
        'resolved': bool(existing.get('direct_links')) if existing else False,
        'direct_links': existing.get('direct_links', []) if existing else [],
        'rank': rank,
        'date': item.get('date', '🔥 Top Repack of the Year')
    }

    firestore_db.upsert_game(game_doc)
    return {
        'status': 'saved',
        'title': game_title,
        'slug': slug,
        'parts_count': len(fuckingfast_links)
    }


def main():
    parser = argparse.ArgumentParser(description="Populate Database with Top 150 Popular Games from FitGirl")
    parser.add_argument('--limit', type=int, default=150, help='Maximum number of games to scrape (default: 150)')
    parser.add_argument('--workers', type=int, default=5, help='Number of parallel scraping threads (default: 5)')
    args = parser.parse_args()

    print(f"\n{Fore.CYAN}{Style.BRIGHT}=== 🎮 FitGirl Database Populator (Top {args.limit} Games) ==={Style.RESET_ALL}\n")

    if firestore_db.is_firestore_connected():
        log.success("Firestore connection active!", "Targeting remote Firestore collection 'games'")
    else:
        log.warn("Firestore serviceAccountKey.json not found.", "Saving locally to 'games_db.json' (will auto-sync to Firestore when key is provided).")

    log.info("Fetching Top 150 Popular Repacks list from FitGirl...")
    popular_items = fitgirl_scraper._fetch_all_popular_repacks(max_results=args.limit)

    if not popular_items:
        log.error("Failed to retrieve popular repacks list from FitGirl site.")
        return

    total_found = len(popular_items)
    log.success(f"Found {total_found} popular games to process.")

    saved_count = 0
    skipped_count = 0
    error_count = 0

    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as executor:
        future_to_game = {
            executor.submit(fetch_and_save_game, item, idx + 1): (idx + 1, item)
            for idx, item in enumerate(popular_items)
        }

        for future in concurrent.futures.as_completed(future_to_game):
            rank, item = future_to_game[future]
            try:
                res = future.result()
                if res['status'] == 'saved':
                    saved_count += 1
                    log.success(f"[{rank}/{total_found}] Saved: {res['title']}", f"({res['parts_count']} parts, slug: {res['slug']})")
                elif res['status'] == 'skipped':
                    skipped_count += 1
                    log.info(f"[{rank}/{total_found}] Already cached: {res['title']}", f"({res['parts_count']} parts)")
                else:
                    error_count += 1
                    log.error(f"[{rank}/{total_found}] Failed: {res['title']}", res.get('error', 'Unknown error'))
            except Exception as e:
                error_count += 1
                log.error(f"[{rank}/{total_found}] Error processing {item.get('title')}", str(e))

    print(f"\n{Fore.GREEN}{Style.BRIGHT}=== ✅ Database Population Complete ==={Style.RESET_ALL}")
    print(f"Total Processed: {total_found}")
    print(f"Newly Saved:     {saved_count}")
    print(f"Already Present: {skipped_count}")
    print(f"Errors:          {error_count}\n")


if __name__ == '__main__':
    main()
