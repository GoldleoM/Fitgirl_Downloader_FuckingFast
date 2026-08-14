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
    'gta3': 'grand theft auto 3',
    'gta 3': 'grand theft auto 3',
    'gta vc': 'grand theft auto vice city',
    'gtavc': 'grand theft auto vice city',
    'vice city': 'grand theft auto vice city',
    'gta sa': 'grand theft auto san andreas',
    'gtasa': 'grand theft auto san andreas',
    'san andreas': 'grand theft auto san andreas',
    'gta4': 'grand theft auto 4',
    'gta 4': 'grand theft auto 4',
    'gta iv': 'grand theft auto 4',
    'gta5': 'grand theft auto 5',
    'gta 5': 'grand theft auto 5',
    'gta v': 'grand theft auto v',
    'gtav': 'grand theft auto v',
    'gta online': 'grand theft auto online',
    'rdr': 'red dead redemption',
    'rdr1': 'red dead redemption',
    'rdr 1': 'red dead redemption',
    'rdr2': 'red dead redemption 2',
    'rdr 2': 'red dead redemption 2',
    'rdr ii': 'red dead redemption 2',
    'reddead': 'red dead redemption',
    'red dead': 'red dead redemption',
    'cod': 'call of duty',
    'cod mw': 'call of duty modern warfare',
    'mw': 'call of duty modern warfare',
    'mw2': 'call of duty modern warfare 2',
    'mw 2': 'call of duty modern warfare 2',
    'mw3': 'call of duty modern warfare 3',
    'mw 3': 'call of duty modern warfare 3',
    'mw2019': 'call of duty modern warfare',
    'cod mw2': 'call of duty modern warfare 2',
    'cod mw3': 'call of duty modern warfare 3',
    'black ops': 'call of duty black ops',
    'bo': 'call of duty black ops',
    'bo2': 'call of duty black ops 2',
    'bo3': 'call of duty black ops 3',
    'bo4': 'call of duty black ops 4',
    'cold war': 'call of duty black ops cold war',
    'cod cw': 'call of duty black ops cold war',
    'cod ww2': 'call of duty wwii',
    'ww2': 'call of duty wwii',
    'warzone': 'call of duty warzone',
    'cod warzone': 'call of duty warzone',
    'cod mobile': 'call of duty mobile',
    'codm': 'call of duty mobile',
    'ac': 'assassins creed',
    'assassins': 'assassins creed',
    'assassin': 'assassins creed',
    'assassins creed': 'assassins creed',
    'ac1': 'assassins creed',
    'ac2': 'assassins creed 2',
    'ac 2': 'assassins creed 2',
    'brotherhood': 'assassins creed brotherhood',
    'ac brotherhood': 'assassins creed brotherhood',
    'revelations': 'assassins creed revelations',
    'ac revelations': 'assassins creed revelations',
    'ac3': 'assassins creed 3',
    'ac 3': 'assassins creed 3',
    'black flag': 'assassins creed iv black flag',
    'ac4': 'assassins creed iv black flag',
    'ac 4': 'assassins creed iv black flag',
    'rogue': 'assassins creed rogue',
    'unity': 'assassins creed unity',
    'syndicate': 'assassins creed syndicate',
    'origins': 'assassins creed origins',
    'odyssey': 'assassins creed odyssey',
    'valhalla': 'assassins creed valhalla',
    'mirage': 'assassins creed mirage',
    'shadows': 'assassins creed shadows',
    'gow': 'god of war',
    'godofwar': 'god of war',
    'gow 2018': 'god of war',
    'gow ragnarok': 'god of war ragnarok',
    'ragnarok': 'god of war ragnarok',
    'gof': 'god of war',
    're': 'resident evil',
    'res evil': 'resident evil',
    'resident evil': 'resident evil',
    're2': 'resident evil 2',
    're 2': 'resident evil 2',
    're2 remake': 'resident evil 2',
    're3': 'resident evil 3',
    're 3': 'resident evil 3',
    're3 remake': 'resident evil 3',
    're4': 'resident evil 4',
    're 4': 'resident evil 4',
    're4 remake': 'resident evil 4 remake',
    're5': 'resident evil 5',
    're 5': 'resident evil 5',
    're6': 'resident evil 6',
    're 6': 'resident evil 6',
    're7': 'resident evil 7 biohazard',
    're 7': 'resident evil 7 biohazard',
    'biohazard': 'resident evil 7 biohazard',
    're8': 'resident evil village',
    're 8': 'resident evil village',
    'village': 'resident evil village',
    'revillage': 'resident evil village',
    'resident evil 9': 'resident evil requiem',
    're requiem': 'resident evil requiem',
    'spiderman': 'spider man',
    'spider man': 'spider man',
    'spidey': 'spider man',
    'sm': 'spider man',
    'spiderman remastered': 'marvels spider man remastered',
    'spider man remastered': 'marvels spider man remastered',
    'spiderman miles morales': 'marvels spider man miles morales',
    'miles morales': 'marvels spider man miles morales',
    'spiderman 2': 'marvels spider man 2',
    'spider man 2': 'marvels spider man 2',
    'marvel rivals': 'marvel rivals',
    'mcu': 'marvel games',
    'cyberpunk': 'cyberpunk 2077',
    'cyber punk': 'cyberpunk 2077',
    'cp2077': 'cyberpunk 2077',
    'cp 2077': 'cyberpunk 2077',
    '2077': 'cyberpunk 2077',
    'cyberpunk phantom liberty': 'cyberpunk 2077 phantom liberty',
    'phantom liberty': 'cyberpunk 2077 phantom liberty',
    'witcher': 'the witcher',
    'witcher 1': 'the witcher',
    'witcher 2': 'the witcher 2 assassins of kings',
    'witcher 3': 'the witcher 3',
    'witcher3': 'the witcher 3',
    'tw3': 'the witcher 3',
    'w3': 'the witcher 3',
    'wild hunt': 'the witcher 3 wild hunt',
    'wukong': 'black myth wukong',
    'black myth': 'black myth wukong',
    'bmw': 'black myth wukong',
    'elden': 'elden ring',
    'er': 'elden ring',
    'eldenring': 'elden ring',
    'elden ring dlc': 'elden ring shadow of the erdtree',
    'shadow of erdtree': 'elden ring shadow of the erdtree',
    'sote': 'elden ring shadow of the erdtree',
    'ds': 'dark souls',
    'ds1': 'dark souls',
    'ds2': 'dark souls 2',
    'ds3': 'dark souls 3',
    'dark souls 3': 'dark souls iii',
    'demon souls': 'demon souls',
    'demons souls': 'demon souls',
    'bloodborne': 'bloodborne',
    'mafia': 'mafia',
    'mafia 2': 'mafia ii',
    'mafia 3': 'mafia iii',
    'watch dogs': 'watch dogs',
    'watchdogs': 'watch dogs',
    'wd': 'watch dogs',
    'wd2': 'watch dogs 2',
    'watch dogs 2': 'watch dogs 2',
    'legion': 'watch dogs legion',
    'saints row': 'saints row',
    'sr3': 'saints row the third',
    'sr4': 'saints row iv',
    'sleeping dogs': 'sleeping dogs',
    'just cause': 'just cause',
    'jc2': 'just cause 2',
    'jc3': 'just cause 3',
    'jc4': 'just cause 4',
    'farcry': 'far cry',
    'far cry': 'far cry',
    'fc3': 'far cry 3',
    'fc4': 'far cry 4',
    'fc5': 'far cry 5',
    'fc6': 'far cry 6',
    'farcry 3': 'far cry 3',
    'farcry 4': 'far cry 4',
    'farcry 5': 'far cry 5',
    'farcry 6': 'far cry 6',
    'nfs': 'need for speed',
    'needforspeed': 'need for speed',
    'nfs mw': 'need for speed most wanted',
    'nfs most wanted': 'need for speed most wanted',
    'most wanted': 'need for speed most wanted',
    'nfs carbon': 'need for speed carbon',
    'carbon': 'need for speed carbon',
    'nfs underground': 'need for speed underground',
    'nfs u2': 'need for speed underground 2',
    'underground 2': 'need for speed underground 2',
    'nfs hot pursuit': 'need for speed hot pursuit',
    'nfs rivals': 'need for speed rivals',
    'nfs heat': 'need for speed heat',
    'nfs unbound': 'need for speed unbound',
    'unbound': 'need for speed unbound',
    'fifa': 'ea sports fifa',
    'fifa 23': 'ea sports fifa 23',
    'fifa 24': 'ea sports fc 24',
    'fc24': 'ea sports fc 24',
    'fc 24': 'ea sports fc 24',
    'fc25': 'ea sports fc 25',
    'fc 25': 'ea sports fc 25',
    'fc26': 'ea sports fc 26',
    'fc 26': 'ea sports fc 26',
    'f1': 'formula 1',
    'f1 24': 'f1 24',
    'f1 25': 'f1 25',
    'f1 26': 'f1 26',
    'madden': 'madden nfl',
    'nba 2k': 'nba 2k',
    '2k': 'nba 2k',
    'bf': 'battlefield',
    'bf1': 'battlefield 1',
    'bf2': 'battlefield 2',
    'bf3': 'battlefield 3',
    'bf4': 'battlefield 4',
    'bf5': 'battlefield v',
    'bfv': 'battlefield v',
    'bf2042': 'battlefield 2042',
    '2042': 'battlefield 2042',
    'valo': 'valorant',
    'val': 'valorant',
    'valarante': 'valorant',
    'league': 'league of legends',
    'lol': 'league of legends',
    'tft': 'teamfight tactics',
    'lor': 'legends of runeterra',
    'cs': 'counter strike',
    'csgo': 'counter strike global offensive',
    'cs go': 'counter strike global offensive',
    'cs2': 'counter strike 2',
    'cs 2': 'counter strike 2',
    'counterstrike': 'counter strike',
    'counter strike': 'counter strike',
    'mc': 'minecraft',
    'minecraft java': 'minecraft java edition',
    'minecraft bedrock': 'minecraft bedrock edition',
    'mc java': 'minecraft java edition',
    'mc bedrock': 'minecraft bedrock edition',
    'minecraft dungeons': 'minecraft dungeons',
    'minecraft legends': 'minecraft legends',
    'fn': 'fortnite',
    'fort': 'fortnite',
    'fortnite br': 'fortnite battle royale',
    'rocket league': 'rocket league',
    'rl': 'rocket league',
    'fall guys': 'fall guys',
    'fallguys': 'fall guys',
    'silent hill': 'silent hill',
    'sh2': 'silent hill 2',
    'silent hill 2': 'silent hill 2',
    'dead space': 'dead space',
    'deadspace': 'dead space',
    'ds remake': 'dead space remake',
    'outlast': 'outlast',
    'outlast 2': 'outlast 2',
    'amnesia': 'amnesia',
    'alan wake': 'alan wake',
    'alan wake 2': 'alan wake 2',
    'aw2': 'alan wake 2',
    'little nightmares': 'little nightmares',
    'ln2': 'little nightmares 2',
    'phasmophobia': 'phasmophobia',
    'phasmo': 'phasmophobia',
    'skyrim': 'the elder scrolls v skyrim',
    'tes': 'the elder scrolls',
    'tes5': 'the elder scrolls v skyrim',
    'eso': 'the elder scrolls online',
    'fallout': 'fallout',
    'fo3': 'fallout 3',
    'fo4': 'fallout 4',
    'fallout 4': 'fallout 4',
    'fo76': 'fallout 76',
    'fallout 76': 'fallout 76',
    'starfield': 'starfield',
    'subnautica': 'subnautica',
    'subnautica 2': 'subnautica 2',
    'raft': 'raft',
    'rust': 'rust',
    'ark': 'ark survival evolved',
    'ark survival': 'ark survival evolved',
    'ark 2': 'ark 2',
    'sons of the forest': 'sons of the forest',
    'sotf': 'sons of the forest',
    'the forest': 'the forest',
    'dayz': 'dayz',
    '7 days': '7 days to die',
    '7dtd': '7 days to die',
    'dont starve': 'dont starve',
    'dst': 'dont starve together',
    'valheim': 'valheim',
    'terraria': 'terraria',
    'project zomboid': 'project zomboid',
    'pz': 'project zomboid',
    'bg3': 'baldurs gate 3',
    'bg 3': 'baldurs gate 3',
    'baldurs gate': 'baldurs gate',
    'divinity': 'divinity original sin',
    'dos2': 'divinity original sin 2',
    'persona 5': 'persona 5 royal',
    'p5r': 'persona 5 royal',
    'persona': 'persona',
    'ff': 'final fantasy',
    'ff7': 'final fantasy vii',
    'ff7 remake': 'final fantasy vii remake',
    'ff7 rebirth': 'final fantasy vii rebirth',
    'ff16': 'final fantasy xvi',
    'final fantasy 16': 'final fantasy xvi',
    'kingdom hearts': 'kingdom hearts',
    'dragon age': 'dragon age',
    'dragon age veilguard': 'dragon age the veilguard',
    'mass effect': 'mass effect',
    'me1': 'mass effect',
    'me2': 'mass effect 2',
    'me3': 'mass effect 3',
    'division': 'tom clancys the division',
    'division 2': 'tom clancys the division 2',
    'td2': 'tom clancys the division 2',
    'rainbow six': 'rainbow six siege',
    'r6': 'rainbow six siege',
    'r6s': 'rainbow six siege',
    'siege': 'rainbow six siege',
    'ghost recon': 'tom clancys ghost recon',
    'wildlands': 'tom clancys ghost recon wildlands',
    'breakpoint': 'tom clancys ghost recon breakpoint',
    'horizon': 'horizon zero dawn',
    'hzd': 'horizon zero dawn',
    'hfw': 'horizon forbidden west',
    'forbidden west': 'horizon forbidden west',
    'days gone': 'days gone',
    'uncharted': 'uncharted legacy of thieves collection',
    'tlou': 'the last of us',
    'tlou1': 'the last of us part 1',
    'tlou2': 'the last of us part 2',
    'last of us': 'the last of us',
    'ghost of tsushima': 'ghost of tsushima',
    'got': 'ghost of tsushima',
    'returnal': 'returnal',
    'helldivers': 'helldivers 2',
    'hd2': 'helldivers 2',
    'pes': 'pro evolution soccer',
    'efootball': 'efootball',
    'wwe': 'wwe 2k',
    'wwe 2k24': 'wwe 2k24',
    'wwe 2k25': 'wwe 2k25',
    'wwe 2k26': 'wwe 2k26',
    'forza': 'forza horizon',
    'fh': 'forza horizon',
    'fh4': 'forza horizon 4',
    'fh5': 'forza horizon 5',
    'fh6': 'forza horizon 6',
    'forza 4': 'forza horizon 4',
    'forza 5': 'forza horizon 5',
    'forza 6': 'forza horizon 6',
    'forza motorsport': 'forza motorsport',
    'assetto corsa': 'assetto corsa',
    'ac competizione': 'assetto corsa competizione',
    'acc': 'assetto corsa competizione',
    'beamng': 'beamng drive',
    'beamng drive': 'beamng drive',
    'dirt': 'dirt',
    'dirt rally': 'dirt rally',
    'dirt 5': 'dirt 5',
    'grid': 'grid',
    'the crew': 'the crew',
    'crew 2': 'the crew 2',
    'crew motorfest': 'the crew motorfest',
    'doom': 'doom',
    'doom eternal': 'doom eternal',
    'doom 2016': 'doom',
    'doom dark ages': 'doom the dark ages',
    'quake': 'quake',
    'halo': 'halo',
    'halo infinite': 'halo infinite',
    'titanfall': 'titanfall',
    'titanfall 2': 'titanfall 2',
    'tf2': 'titanfall 2',
    'apex': 'apex legends',
    'apex legends': 'apex legends',
    'overwatch': 'overwatch 2',
    'ow2': 'overwatch 2',
    'destiny': 'destiny 2',
    'd2': 'destiny 2',
    'battlebit': 'battlebit remastered',
    'zombies': 'call of duty zombies',
    'cod zombies': 'call of duty zombies',
    'bo zombies': 'call of duty black ops zombies',
    'dying light': 'dying light',
    'dl1': 'dying light',
    'dl2': 'dying light 2',
    'dead island': 'dead island',
    'dead island 2': 'dead island 2',
    'hades': 'hades',
    'hades 2': 'hades ii',
    'hollow knight': 'hollow knight',
    'hk': 'hollow knight',
    'silksong': 'hollow knight silksong',
    'cuphead': 'cuphead',
    'celeste': 'celeste',
    'undertale': 'undertale',
    'deltarune': 'deltarune',
    'among us': 'among us',
    'amogus': 'among us',
    'lethal company': 'lethal company',
    'lethal': 'lethal company',
    'content warning': 'content warning',
    'balatro': 'balatro',
    'stardew': 'stardew valley',
    'stardew valley': 'stardew valley',
    'sims': 'the sims',
    'sims 4': 'the sims 4',
    'ts4': 'the sims 4',
    'cities skylines': 'cities skylines',
    'planet zoo': 'planet zoo',
    'planet coaster': 'planet coaster',
    'football manager': 'football manager',
    'fm': 'football manager',
    'age of empires': 'age of empires',
    'aoe': 'age of empires',
    'aoe2': 'age of empires ii',
    'aoe4': 'age of empires iv',
    'civilization': 'sid meiers civilization',
    'civ': 'sid meiers civilization',
    'civ 6': 'sid meiers civilization vi',
    'civ6': 'sid meiers civilization vi',
    'total war': 'total war',
    'tw': 'total war',
    'starcraft': 'starcraft',
    'sc2': 'starcraft ii',
    'it takes two': 'it takes two',
    'itt': 'it takes two',
    'a way out': 'a way out',
    'way out': 'a way out',
    'grounded': 'grounded',
    'deep rock': 'deep rock galactic',
    'drg': 'deep rock galactic',
    'palworld': 'palworld',
    'pal world': 'palworld',
    'soma': 'soma',
    'visage': 'visage',
    'mortuary assistant': 'the mortuary assistant',
    'fnaf': 'five nights at freddys',
    'five nights': 'five nights at freddys',
    'fnaf 2': 'five nights at freddys 2',
    'fnaf 3': 'five nights at freddys 3',
    'fnaf 4': 'five nights at freddys 4',
    'dbz': 'dragon ball z',
    'dragon ball': 'dragon ball',
    'sparking zero': 'dragon ball sparking zero',
    'db sparking': 'dragon ball sparking zero',
    'naruto': 'naruto',
    'storm': 'naruto ultimate ninja storm',
    'one piece': 'one piece',
    'tekken': 'tekken',
    'tekken 8': 'tekken 8',
    'street fighter': 'street fighter',
    'sf6': 'street fighter 6',
    'mk': 'mortal kombat',
    'mk1': 'mortal kombat 1',
    'mortal kombat 11': 'mortal kombat 11',
    'guilty gear': 'guilty gear strive',
    'stellar blade': 'stellar blade',
    'stellarblade': 'stellar blade',
    'lies of p': 'lies of p',
    'lop': 'lies of p',
    'lords of the fallen': 'lords of the fallen',
    'lotf': 'lords of the fallen',
    'dragons dogma': 'dragons dogma 2',
    'dd2': 'dragons dogma 2',
    'monster hunter': 'monster hunter',
    'mh': 'monster hunter',
    'mh world': 'monster hunter world',
    'mhw': 'monster hunter world',
    'mh rise': 'monster hunter rise',
    'mhr': 'monster hunter rise',
    'monster hunter wilds': 'monster hunter wilds',
    'mh wilds': 'monster hunter wilds',
    'metaphor': 'metaphor refantazio',
    'black ops 6': 'call of duty black ops 6',
    'bo6': 'call of duty black ops 6',
    'cod bo6': 'call of duty black ops 6',
    'black ops 7': 'call of duty black ops 7',
    'bo7': 'call of duty black ops 7',
    'cod bo7': 'call of duty black ops 7',
    'arc raiders': 'arc raiders',
    'arc': 'arc raiders',
    'the finals': 'the finals',
    'finals': 'the finals',
    'deadlock': 'deadlock',
    'delta force': 'delta force',
    'deltaforce': 'delta force',
    'marathon': 'marathon',
    'kingmakers': 'kingmakers',
    'schedule 1': 'schedule 1',
    'portal': 'portal',
    'portal 2': 'portal 2',
    'hl': 'half life',
    'half life': 'half life',
    'hl2': 'half life 2',
    'hl alyx': 'half life alyx',
    'alyx': 'half life alyx',
    'left 4 dead': 'left 4 dead',
    'l4d': 'left 4 dead',
    'l4d2': 'left 4 dead 2',
    'team fortress': 'team fortress 2',
    'garrys mod': 'garrys mod',
    'gmod': 'garrys mod',
    'wow': 'world of warcraft',
    'world of warcraft': 'world of warcraft',
    'ffxiv': 'final fantasy xiv',
    'ff14': 'final fantasy xiv',
    'lost ark': 'lost ark',
    'new world': 'new world',
    'runescape': 'runescape',
    'rs3': 'runescape',
    'poe': 'path of exile',
    'poe2': 'path of exile 2',
    'path of exile': 'path of exile',
    'diablo': 'diablo',
    'diablo 2': 'diablo ii',
    'd2': 'diablo ii',
    'diablo 3': 'diablo iii',
    'd3': 'diablo iii',
    'diablo 4': 'diablo iv',
    'd4': 'diablo iv',
    'minecraft': 'minecraft',
    'rimworld': 'rimworld',
    'factorio': 'factorio',
    'satisfactory': 'satisfactory',
    'astroneer': 'astroneer',
    'empyrion': 'empyrion galactic survival',
    'green hell': 'green hell',
    'stranded deep': 'stranded deep',
    'conan exiles': 'conan exiles',
    'conan': 'conan exiles',
    'baldurs gate 3': 'baldurs gate 3',
    'cyberpunk 2077': 'cyberpunk 2077',
    'the last of us': 'the last of us',
    'horizon zero dawn': 'horizon zero dawn',
    'god of war': 'god of war',
    'elden ring': 'elden ring',
    'red dead redemption 2': 'red dead redemption 2',
    'grand theft auto 5': 'grand theft auto 5',
    'the witcher 3': 'the witcher 3',
    'hogwarts': 'hogwarts legacy',
    'hogwarts legacy': 'hogwarts legacy',
    'kingdom come': 'kingdom come deliverance',
    'kcd': 'kingdom come deliverance',
    'kcd2': 'kingdom come deliverance 2',
    'ac shadows': 'assassins creed shadows',
    'assassins creed shadows': 'assassins creed shadows'
}

COMMON_TYPOS = {
    'assasins': 'assassins',
    'assasin': 'assassin',
    'assasins creed': 'assassins creed',
    'assasin creed': 'assassins creed',
    'assasins credd': 'assassins creed',
    'assassins credd': 'assassins creed',
    'assassins crred': 'assassins creed',
    'asassins': 'assassins',
    'asassin': 'assassin',
    'asassins creed': 'assassins creed',
    'assasinscreed': 'assassins creed',
    'assasincreed': 'assassins creed',
    'assasins creed odysey': 'assassins creed odyssey',
    'assasins creed odysee': 'assassins creed odyssey',
    'assassins creed vallhalla': 'assassins creed valhalla',
    'assassins creed valhala': 'assassins creed valhalla',
    'assassins creed mirage': 'assassins creed mirage',
    'crede': 'creed',
    'credd': 'creed',
    'creed': 'creed',
    'creeed': 'creed',
    'creeddd': 'creed',
    'ciberpunk': 'cyberpunk',
    'cyperpunk': 'cyberpunk',
    'cyberpuk': 'cyberpunk',
    'cyberpnk': 'cyberpunk',
    'cyberpunkk': 'cyberpunk',
    'cyberpunk 2077': 'cyberpunk 2077',
    'cyberpunk2077': 'cyberpunk 2077',
    'cyber punck': 'cyberpunk',
    'cyber punc': 'cyberpunk',
    'spidrman': 'spiderman',
    'spideman': 'spiderman',
    'spiderma': 'spiderman',
    'spidermam': 'spiderman',
    'spidermen': 'spiderman',
    'spider man': 'spiderman',
    'spider-man': 'spiderman',
    'spidermaan': 'spiderman',
    'spidermaaan': 'spiderman',
    'spiderman2': 'spiderman 2',
    'spider man 2': 'spiderman 2',
    'reddead': 'red dead',
    'reddeead': 'red dead',
    'redddead': 'red dead',
    'red ded': 'red dead',
    'reddeed': 'red dead',
    'red dead redemption': 'red dead redemption',
    'red dead redemtion': 'red dead redemption',
    'red dead redemptionn': 'red dead redemption',
    'red dead redeption': 'red dead redemption',
    'red dead redepmtion': 'red dead redemption',
    'red dead redemption 2': 'red dead redemption 2',
    'red dead redemptionn 2': 'red dead redemption 2',
    'rdr2': 'rdr2',
    'rdr 2': 'rdr2',
    'resedent': 'resident',
    'residant': 'resident',
    'resdent': 'resident',
    'residen': 'resident',
    'resident evill': 'resident evil',
    'resident evel': 'resident evil',
    'resident evil': 'resident evil',
    'resident evil 4': 'resident evil 4',
    'resident evil 4 remake': 'resident evil 4 remake',
    'res evil': 'resident evil',
    'resevil': 'resident evil',
    'residentevil': 'resident evil',
    'resident evile': 'resident evil',
    'resident evil village': 'resident evil village',
    'resident evil villlage': 'resident evil village',
    'godofwar': 'god of war',
    'god of warr': 'god of war',
    'god of wa': 'god of war',
    'godof warr': 'god of war',
    'god of war ragnarok': 'god of war ragnarok',
    'god of war ragnaok': 'god of war ragnarok',
    'god of war ragnorok': 'god of war ragnarok',
    'god of war ragnarock': 'god of war ragnarok',
    'witcherr': 'witcher',
    'witcher': 'witcher',
    'wicher': 'witcher',
    'witcher 3': 'witcher 3',
    'witcher3': 'witcher 3',
    'witcher 33': 'witcher 3',
    'witcher wildhunt': 'witcher wild hunt',
    'wildhunt': 'wild hunt',
    'wild hunt': 'wild hunt',
    'grand theft auto': 'grand theft auto',
    'grandtheftauto': 'grand theft auto',
    'grand thift auto': 'grand theft auto',
    'grand theft atuto': 'grand theft auto',
    'grand theft autoo': 'grand theft auto',
    'grand thefta auto': 'grand theft auto',
    'gta': 'gta',
    'gtaa': 'gta',
    'gtav': 'gta v',
    'gta v': 'gta v',
    'gta5': 'gta5',
    'gta 5': 'gta5',
    'gta iv': 'gta4',
    'gta 4': 'gta4',
    'gtasa': 'gtasa',
    'gta sa': 'gtasa',
    'cal of duty': 'call of duty',
    'call od duty': 'call of duty',
    'call of dudy': 'call of duty',
    'call of dutty': 'call of duty',
    'callofduty': 'call of duty',
    'call of duy': 'call of duty',
    'call of dut': 'call of duty',
    'calofduty': 'call of duty',
    'blackops': 'black ops',
    'black opss': 'black ops',
    'black op': 'black ops',
    'warzonee': 'warzone',
    'warzne': 'warzone',
    'wukongg': 'wukong',
    'wukong': 'wukong',
    'black myth wukong': 'black myth wukong',
    'black myth wukongg': 'black myth wukong',
    'blackmyth': 'black myth',
    'blackmythwukong': 'black myth wukong',
    'eldenring': 'elden ring',
    'elden rign': 'elden ring',
    'elden rng': 'elden ring',
    'elden rin': 'elden ring',
    'eldenn ring': 'elden ring',
    'eldan ring': 'elden ring',
    'elden ringg': 'elden ring',
    'elden ring shadow': 'elden ring shadow of the erdtree',
    'shadow of the erdtree': 'shadow of the erdtree',
    'shadow of erd tree': 'shadow of the erdtree',
    'shadow of erdtree': 'shadow of the erdtree',
    'minecrft': 'minecraft',
    'minecaft': 'minecraft',
    'minecreft': 'minecraft',
    'minecraf': 'minecraft',
    'mine craft': 'minecraft',
    'minecraftt': 'minecraft',
    'valroant': 'valorant',
    'valorent': 'valorant',
    'valornt': 'valorant',
    'valorant': 'valorant',
    'valornat': 'valorant',
    'valorentt': 'valorant',
    'valarant': 'valorant',
    'valarante': 'valorant',
    'counterstrike': 'counter strike',
    'counter strikee': 'counter strike',
    'counter strik': 'counter strike',
    'counter stike': 'counter strike',
    'counter stik': 'counter strike',
    'countr strike': 'counter strike',
    'couter strike': 'counter strike',
    'counterstrike 2': 'counter strike 2',
    'counter strke 2': 'counter strike 2',
    'csgo': 'csgo',
    'cs 2': 'cs2',
    'cs2': 'cs2',
    'forzza': 'forza',
    'forzaa': 'forza',
    'forrza': 'forza',
    'forza horizn': 'forza horizon',
    'forza horzion': 'forza horizon',
    'forza horizon': 'forza horizon',
    'forza horizon 5': 'forza horizon 5',
    'forza horizon 6': 'forza horizon 6',
    'needforspeed': 'need for speed',
    'need for speeed': 'need for speed',
    'need for spedd': 'need for speed',
    'need for spead': 'need for speed',
    'needforspead': 'need for speed',
    'need for speed most wanted': 'need for speed most wanted',
    'need for speed heat': 'need for speed heat',
    'need for speed unbound': 'need for speed unbound',
    'fortnitee': 'fortnite',
    'fortn ite': 'fortnite',
    'fortnate': 'fortnite',
    'fortnit': 'fortnite',
    'fornite': 'fortnite',
    'hogwarts': 'hogwarts legacy',
    'hogwart': 'hogwarts legacy',
    'hogwards': 'hogwarts legacy',
    'hogwats': 'hogwarts legacy',
    'balder gate': 'baldurs gate',
    'baldurs gate': 'baldurs gate',
    'baldurs gate 3': 'baldurs gate 3',
    'baldursgate': 'baldurs gate',
    'palword': 'palworld',
    'palwold': 'palworld',
    'palwolrd': 'palworld',
    'pal world': 'palworld',
    'phasmophbia': 'phasmophobia',
    'phasmophobia': 'phasmophobia',
    'phasmaphobia': 'phasmophobia',
    'helldivers': 'helldivers 2',
    'helldiver': 'helldivers 2',
    'helldiver2': 'helldivers 2',
    'dying lite': 'dying light',
    'dying ligth': 'dying light',
    'dyinglight': 'dying light',
    'horizon zero dawn': 'horizon zero dawn',
    'horizon forbidden west': 'horizon forbidden west',
    'battelfield': 'battlefield',
    'battlefeild': 'battlefield',
    'battlefieldd': 'battlefield',
    'battle field': 'battlefield',
    'rainbow six seige': 'rainbow six siege',
    'rainbow six siege': 'rainbow six siege',
    'rainbowsix': 'rainbow six',
    'pubg': 'pubg battlegrounds',
    'pubg pc': 'pubg battlegrounds',
    'apex legen': 'apex legends',
    'apex legend': 'apex legends',
    'apexlegends': 'apex legends',
    'overwath': 'overwatch',
    'overwatchh': 'overwatch',
    'overwatch 2': 'overwatch 2',
    'dead by daylight': 'dead by daylight',
    'deadbydaylight': 'dead by daylight',
    'amongus': 'among us',
    'amoung us': 'among us',
    'terrariaa': 'terraria',
    'terarria': 'terraria',
    'stardew vally': 'stardew valley',
    'stardew vallley': 'stardew valley',
    'stardewvalley': 'stardew valley',
    'hollow knightt': 'hollow knight',
    'hollow knigt': 'hollow knight',
    'hollowknight': 'hollow knight',
    'silksongg': 'hollow knight silksong',
    'liesofp': 'lies of p',
    'lies of p': 'lies of p',
    'dragons dogma': 'dragons dogma 2',
    'monster hunter': 'monster hunter',
    'monster hunter wilds': 'monster hunter wilds',
    'monsterhunter': 'monster hunter',
    'kingdom come': 'kingdom come deliverance',
    'kingdom come delivarance': 'kingdom come deliverance',
    'schedule1': 'schedule 1',
    'arcraiders': 'arc raiders',
    'deltaforce': 'delta force',
    'maraton': 'marathon',
    'deadlok': 'deadlock',
    'thefinals': 'the finals',
    'finals': 'the finals'
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

