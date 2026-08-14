import os
import json
import time
from datetime import datetime
from typing import List, Dict, Optional, Any

_db = None
_is_firebase_initialized = False
LOCAL_DB_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'games_db.json')

SERVICE_ACCOUNT_CANDIDATES = [
    os.path.join(os.path.dirname(os.path.abspath(__file__)), 'serviceAccountKey.json'),
    os.path.join(os.path.dirname(os.path.abspath(__file__)), 'firebase-key.json'),
    os.path.join(os.path.dirname(os.path.abspath(__file__)), 'firebase', 'serviceAccount.json'),
    os.path.join(os.path.dirname(os.path.abspath(__file__)), 'link-sync-project', 'backend', 'firebase', 'serviceAccount.json'),
    os.path.join(os.path.dirname(os.path.abspath(__file__)), 'serviceAccount.json'),
]


def _find_service_account_path() -> Optional[str]:
    """Check environment variables and common filesystem paths for service account JSON."""
    env_path = os.environ.get('GOOGLE_APPLICATION_CREDENTIALS') or os.environ.get('FIREBASE_SERVICE_ACCOUNT')
    if env_path and os.path.exists(env_path):
        return env_path

    for candidate in SERVICE_ACCOUNT_CANDIDATES:
        if os.path.exists(candidate):
            # Verify it is not the placeholder sample file
            try:
                with open(candidate, 'r', encoding='utf-8') as f:
                    content = f.read()
                    if 'YOUR_PRIVATE_KEY' not in content and 'your-project-id' not in content:
                        return candidate
            except Exception:
                pass
    return None


import json
import base64
import threading

_init_lock = threading.Lock()

def _get_firebase_credentials():
    """Resolves Firebase Admin credentials from env vars (JSON/base64 string) or local file."""
    from firebase_admin import credentials

    # 1. Check environment variables for inline JSON string or base64 string (Vercel / Cloud)
    for env_var in ['FIREBASE_SERVICE_ACCOUNT', 'FIREBASE_SERVICE_ACCOUNT_JSON', 'FIREBASE_CONFIG', 'GOOGLE_CREDENTIALS_JSON', 'GOOGLE_APPLICATION_CREDENTIALS_JSON']:
        raw = os.environ.get(env_var, '').strip()
        if raw:
            # Check raw JSON
            if (raw.startswith('{') and raw.endswith('}')) or (raw.startswith('"') and raw.endswith('"')):
                try:
                    if raw.startswith('"') and raw.endswith('"'):
                        raw = json.loads(raw)
                    data = json.loads(raw) if isinstance(raw, str) else raw
                    if isinstance(data, dict) and data.get('type') == 'service_account':
                        return credentials.Certificate(data)
                except Exception:
                    pass
            # Check base64 encoded JSON
            try:
                decoded = base64.b64decode(raw).decode('utf-8')
                if decoded.startswith('{') and decoded.endswith('}'):
                    data = json.loads(decoded)
                    if isinstance(data, dict) and data.get('type') == 'service_account':
                        return credentials.Certificate(data)
            except Exception:
                pass

    # 2. Check filesystem path
    sa_path = _find_service_account_path()
    if sa_path:
        return credentials.Certificate(sa_path)

    return None


def init_firestore():
    """Initializes Firestore connection or returns None if credentials are not yet configured."""
    global _db, _is_firebase_initialized
    if _is_firebase_initialized and _db is not None:
        return _db

    with _init_lock:
        if _is_firebase_initialized and _db is not None:
            return _db

        try:
            import firebase_admin
            from firebase_admin import firestore

            cred = _get_firebase_credentials()
            if cred:
                if not firebase_admin._apps:
                    firebase_admin.initialize_app(cred)
                _db = firestore.client()
                _is_firebase_initialized = True
                print("[Firestore] Connected successfully to Firestore database.")
                return _db
            else:
                # Try default credentials if on GCP / Cloud environment
                if not firebase_admin._apps:
                    try:
                        firebase_admin.initialize_app()
                        _db = firestore.client()
                        _is_firebase_initialized = True
                        print("[Firestore] Connected via default environment credentials.")
                        return _db
                    except Exception:
                        pass
        except Exception as e:
            # If app already initialized, fetch client
            try:
                from firebase_admin import firestore
                _db = firestore.client()
                _is_firebase_initialized = True
                return _db
            except Exception:
                print(f"[Firestore] Firebase Admin not initialized: {e}")

    return _db


def is_firestore_connected() -> bool:
    """Returns True if live Firestore connection is active."""
    return init_firestore() is not None


# --- Local JSON Fallback DB Helper ---
def _load_local_db() -> Dict[str, Any]:
    if os.path.exists(LOCAL_DB_FILE):
        try:
            with open(LOCAL_DB_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception:
            return {'games': {}}
    return {'games': {}}


def _save_local_db(data: Dict[str, Any]):
    try:
        with open(LOCAL_DB_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
    except Exception as e:
        print(f"[LocalDB] Error saving local database: {e}")


# --- Public Database Operations ---

def upsert_game(game_data: Dict[str, Any]) -> bool:
    """
    Upserts a game document into Firestore ('games' collection) keyed by slug.
    Also saves to local JSON database for offline cache / fallback.
    """
    slug = game_data.get('slug')
    if not slug:
        title = game_data.get('title', 'game')
        slug = title.lower().replace(' ', '-').replace(':', '').replace('/', '')
        game_data['slug'] = slug

    # Always ensure timestamp and defaults
    now_iso = datetime.utcnow().isoformat() + 'Z'
    game_data['updated_at'] = now_iso
    if 'created_at' not in game_data:
        game_data['created_at'] = now_iso
    if 'resolved' not in game_data:
        game_data['resolved'] = bool(game_data.get('direct_links'))
    if 'direct_links' not in game_data:
        game_data['direct_links'] = []
    if 'parts_count' not in game_data:
        game_data['parts_count'] = len(game_data.get('fuckingfast_links', []))

    # 1. Update local database cache
    local_data = _load_local_db()
    existing = local_data['games'].get(slug, {})
    # Preserve existing resolved direct_links if new data doesn't have them
    if existing.get('resolved') and not game_data.get('direct_links'):
        game_data['direct_links'] = existing.get('direct_links', [])
        game_data['resolved'] = True
    local_data['games'][slug] = {**existing, **game_data}
    _save_local_db(local_data)

    # 2. Update Firestore if connected
    db = init_firestore()
    if db:
        try:
            doc_ref = db.collection('games').document(slug)
            doc_ref.set(game_data, merge=True)
            return True
        except Exception as e:
            print(f"[Firestore] Error upserting '{slug}': {e}")
            return False

    return True


def get_game_by_slug(slug: str) -> Optional[Dict[str, Any]]:
    """Retrieves a single game by its unique slug."""
    db = init_firestore()
    if db:
        try:
            doc = db.collection('games').document(slug).get()
            if doc.exists:
                return doc.to_dict()
        except Exception as e:
            print(f"[Firestore] Error getting game '{slug}': {e}")

    # Fallback to local DB
    local_data = _load_local_db()
    return local_data.get('games', {}).get(slug)


def get_unresolved_games(limit: Optional[int] = None) -> List[Dict[str, Any]]:
    """
    Returns games that have 'fuckingfast_links' but 'resolved' is False or 'direct_links' is empty.
    """
    unresolved = []
    db = init_firestore()
    if db:
        try:
            query = db.collection('games').where('resolved', '==', False)
            if limit:
                query = query.limit(limit)
            docs = query.stream()
            for doc in docs:
                data = doc.to_dict()
                if data.get('fuckingfast_links'):
                    unresolved.append(data)
            if unresolved:
                return unresolved
        except Exception as e:
            print(f"[Firestore] Error querying unresolved games: {e}")

    # Fallback to local DB
    local_data = _load_local_db()
    for slug, game in local_data.get('games', {}).items():
        if (not game.get('resolved') or not game.get('direct_links')) and game.get('fuckingfast_links'):
            unresolved.append(game)
            if limit and len(unresolved) >= limit:
                break

    return unresolved


def update_game_links(slug: str, direct_links: List[str]) -> bool:
    """
    Updates the direct download links for a game and sets resolved = True.
    """
    now_iso = datetime.utcnow().isoformat() + 'Z'
    update_payload = {
        'direct_links': direct_links,
        'resolved': True if direct_links else False,
        'resolved_at': now_iso,
        'updated_at': now_iso,
        'parts_count': len(direct_links)
    }

    # 1. Update local DB
    local_data = _load_local_db()
    if slug in local_data.get('games', {}):
        local_data['games'][slug].update(update_payload)
        _save_local_db(local_data)

    # 2. Update Firestore
    db = init_firestore()
    if db:
        try:
            doc_ref = db.collection('games').document(slug)
            doc_ref.update(update_payload)
            return True
        except Exception as e:
            print(f"[Firestore] Error updating links for '{slug}': {e}")
            return False

    return True


def get_all_popular_games(page: int = 1, per_page: int = 16) -> Dict[str, Any]:
    """
    Returns paginated popular games list sorted by rank/date.
    """
    games_list = []
    db = init_firestore()
    if db:
        try:
            docs = db.collection('games').order_by('rank').stream()
            for doc in docs:
                games_list.append(doc.to_dict())
        except Exception as e:
            print(f"[Firestore] Error fetching popular games: {e}")

    if not games_list:
        local_data = _load_local_db()
        games_list = list(local_data.get('games', {}).values())
        # Sort by rank if present, otherwise by title
        games_list.sort(key=lambda x: (x.get('rank', 9999), x.get('title', '')))

    import math
    total_items = len(games_list)
    total_pages = math.ceil(total_items / per_page) if total_items > 0 else 1
    page = max(1, min(page, total_pages))

    start = (page - 1) * per_page
    end = start + per_page
    items = games_list[start:end]

    return {
        'items': items,
        'page': page,
        'per_page': per_page,
        'total_pages': total_pages,
        'total_items': total_items
    }


def sync_local_to_firestore() -> int:
    """Syncs all games from local JSON database to Firestore."""
    db = init_firestore()
    if not db:
        print("[Sync] Firestore not connected. Please provide serviceAccountKey.json.")
        return 0

    local_data = _load_local_db()
    games = local_data.get('games', {})
    count = 0
    for slug, game_data in games.items():
        try:
            db.collection('games').document(slug).set(game_data, merge=True)
            count += 1
        except Exception as e:
            print(f"[Sync] Failed to sync '{slug}': {e}")
    print(f"[Sync] Successfully uploaded {count} games to Firestore!")
    return count


# --- Fuzzy Search Engine ---

import difflib

GAME_ALIASES = {
    'gta': 'grand theft auto',
    'gta5': 'grand theft auto 5',
    'gta v': 'grand theft auto v',
    'rdr': 'red dead redemption',
    'rdr2': 'red dead redemption 2',
    'cod': 'call of duty',
    'nfs': 'need for speed',
    'ac': 'assassins creed',
    'gow': 'god of war',
    're': 'resident evil',
    're4': 'resident evil 4',
    're2': 'resident evil 2',
    're3': 'resident evil 3',
    'spiderman': 'spider man',
    'spider-man': 'spider man',
    'cyber punk': 'cyberpunk',
    'witcher 3': 'the witcher 3',
    'witcher3': 'the witcher 3',
    'wukong': 'black myth wukong'
}

COMMON_TYPOS = {
    'assasins': 'assassins',
    'assasin': 'assassin',
    'asassins': 'assassins',
    'asassin': 'assassin',
    'crede': 'creed',
    'ciberpunk': 'cyberpunk',
    'cyperpunk': 'cyberpunk',
    'spidrman': 'spiderman',
    'reddead': 'red dead',
    'reedemption': 'redemption',
    'redemtion': 'redemption',
    'resedent': 'resident',
    'residentevil': 'resident evil'
}

def normalize_search_text(text: str) -> str:
    if not text:
        return ""
    text = text.lower()
    for char in ["'", '"', '’', '`', '-', '_', ':', ';', ',', '.', '!', '?', '(', ')', '[', ']', '/']:
        text = text.replace(char, ' ')
    return ' '.join(text.split())

def expand_search_query(query: str) -> List[str]:
    q_norm = normalize_search_text(query)
    words = q_norm.split()
    corrected_words = [COMMON_TYPOS.get(w, w) for w in words]
    corrected_q = ' '.join(corrected_words)
    
    candidates = [q_norm, corrected_q]
    
    for k, v in GAME_ALIASES.items():
        if k == q_norm or k == corrected_q:
            candidates.append(v)
        elif k in words or k in corrected_words:
            candidates.append(q_norm.replace(k, v))
            candidates.append(corrected_q.replace(k, v))
            
    return list(dict.fromkeys(candidates))

def compute_game_similarity(query: str, title: str) -> float:
    t_norm = normalize_search_text(title)
    if not t_norm:
        return 0.0
        
    queries = expand_search_query(query)
    best_score = 0.0
    
    for q in queries:
        if q in t_norm:
            best_score = max(best_score, 1.0)
            continue
            
        q_words = q.split()
        t_words = t_norm.split()
        
        if not q_words or not t_words:
            continue
            
        word_scores = []
        for qw in q_words:
            best_w = max([difflib.SequenceMatcher(None, qw, tw).ratio() for tw in t_words] + [0])
            word_scores.append(best_w)
            
        avg_score = sum(word_scores) / len(word_scores)
        seq_score = difflib.SequenceMatcher(None, q, t_norm).ratio()
        best_score = max(best_score, avg_score, seq_score)
        
    return best_score


_GAMES_MEMORY_CACHE = []
_GAMES_CACHE_TIME = 0

def get_all_cached_games() -> List[Dict[str, Any]]:
    """Retrieves all games from Firestore (cached in RAM for 60s) or fallback local DB."""
    global _GAMES_MEMORY_CACHE, _GAMES_CACHE_TIME
    now = time.time()
    if _GAMES_MEMORY_CACHE and (now - _GAMES_CACHE_TIME < 60):
        return _GAMES_MEMORY_CACHE

    games_list = []
    db = init_firestore()
    if db:
        try:
            docs = db.collection('games').stream()
            for doc in docs:
                games_list.append(doc.to_dict())
        except Exception as e:
            print(f"[Firestore] Error fetching all games: {e}")

    if not games_list:
        local_data = _load_local_db()
        games_list = list(local_data.get('games', {}).values())

    if games_list:
        _GAMES_MEMORY_CACHE = games_list
        _GAMES_CACHE_TIME = now

    return games_list


def fuzzy_search_games(query: str, limit: int = 24, threshold: float = 0.55) -> List[Dict[str, Any]]:
    """
    Performs fuzzy search across all stored games with typo-tolerance and alias resolution.
    """
    if not query:
        return []

    all_games = get_all_cached_games()
    scored = []

    for game in all_games:
        title = game.get('title', '')
        score = compute_game_similarity(query, title)
        if score >= threshold:
            scored.append((score, game))

    # Sort descending by similarity score, then by rank
    scored.sort(key=lambda x: (x[0], -x[1].get('rank', 9999)), reverse=True)
    return [game for score, game in scored[:limit]]

