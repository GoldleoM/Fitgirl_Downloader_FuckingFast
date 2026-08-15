// Normalize API base URL (remove any trailing slashes)
const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? ""
    : "https://fitboy-backend.vercel.app".replace(/\/+$/, "");

function formatApiUrl(path) {
    if (!path) return '';
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return API_BASE ? `${API_BASE}${cleanPath}` : cleanPath;
}

function formatCoverUrl(url) {
    if (!url || url === 'None') return '/static/images/placeholder.svg';
    if (url.startsWith('/api/')) return formatApiUrl(url);
    if (url.startsWith('/static/')) return formatApiUrl(url);
    return url;
}

// All fetch calls route through formatApiUrl for clean, redirect-free requests
function apiFetch(path, options = {}) {
    return fetch(formatApiUrl(path), options);
}

function initApp() {
    const gamesGrid = document.getElementById('gamesGrid');
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchBtn');
    const catalogTitle = document.getElementById('catalogTitle');

    // Modals
    const gameModal = document.getElementById('gameModal');
    const closeModal = document.getElementById('closeModal');
    const modalBody = document.getElementById('modalBody');

    // Drawer
    const downloadDrawer = document.getElementById('downloadDrawer');
    const closeDrawer = document.getElementById('closeDrawer');
    const drawerGameTitle = document.getElementById('drawerGameTitle');
    const drawerStatusText = document.getElementById('drawerStatusText');
    const progressBar = document.getElementById('progressBar');
    const progressCounter = document.getElementById('progressCounter');
    const progressPercentBadge = document.getElementById('progressPercentBadge');
    const currentPartText = document.getElementById('currentPartText');
    const terminalLogs = document.getElementById('terminalLogs');
    const copyClipboardBtn = document.getElementById('copyClipboardBtn');
    const downloadTxtBtn = document.getElementById('downloadTxtBtn');
    const browserBatchBtn = document.getElementById('browserBatchBtn');

    let currentJobId = null;
    let pollInterval = null;
    let extractedLinksCache = [];

    const btnPopular = document.getElementById('btnPopular');
    const btnLatest = document.getElementById('btnLatest');
    const searchSuggestions = document.getElementById('searchSuggestions');

    // In-Memory Client-Side Games Index for 0ms Instant Suggestions
    let localGamesIndex = [];

    const CLIENT_ALIASES = {
        // ============================================================
        // GRAND THEFT AUTO
        // ============================================================
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

        // ============================================================
        // RED DEAD REDEMPTION
        // ============================================================
        'rdr': 'red dead redemption',
        'rdr1': 'red dead redemption',
        'rdr 1': 'red dead redemption',
        'rdr2': 'red dead redemption 2',
        'rdr 2': 'red dead redemption 2',
        'rdr ii': 'red dead redemption 2',
        'reddead': 'red dead redemption',
        'red dead': 'red dead redemption',

        // ============================================================
        // CALL OF DUTY
        // ============================================================
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

        // ============================================================
        // ASSASSIN'S CREED
        // ============================================================
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

        // ============================================================
        // GOD OF WAR
        // ============================================================
        'gow': 'god of war',
        'godofwar': 'god of war',
        'gow 2018': 'god of war',
        'gow ragnarok': 'god of war ragnarok',
        'ragnarok': 'god of war ragnarok',
        'gof': 'god of war',

        // ============================================================
        // RESIDENT EVIL
        // ============================================================
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

        // ============================================================
        // MARVEL / SPIDER-MAN
        // ============================================================
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

        // ============================================================
        // CYBERPUNK
        // ============================================================
        'cyberpunk': 'cyberpunk 2077',
        'cyber punk': 'cyberpunk 2077',
        'cp2077': 'cyberpunk 2077',
        'cp 2077': 'cyberpunk 2077',
        '2077': 'cyberpunk 2077',
        'cyberpunk phantom liberty': 'cyberpunk 2077 phantom liberty',
        'phantom liberty': 'cyberpunk 2077 phantom liberty',

        // ============================================================
        // THE WITCHER
        // ============================================================
        'witcher': 'the witcher',
        'witcher 1': 'the witcher',
        'witcher 2': 'the witcher 2 assassins of kings',
        'witcher 3': 'the witcher 3',
        'witcher3': 'the witcher 3',
        'tw3': 'the witcher 3',
        'w3': 'the witcher 3',
        'wild hunt': 'the witcher 3 wild hunt',

        // ============================================================
        // BLACK MYTH WUKONG
        // ============================================================
        'wukong': 'black myth wukong',
        'black myth': 'black myth wukong',
        'bmw': 'black myth wukong',

        // ============================================================
        // ELDEN RING / SOULS
        // ============================================================
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

        // ============================================================
        // GTA-LIKE / OPEN WORLD
        // ============================================================
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

        // ============================================================
        // FAR CRY
        // ============================================================
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

        // ============================================================
        // NEED FOR SPEED
        // ============================================================
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

        // ============================================================
        // EA SPORTS / FOOTBALL
        // ============================================================
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

        // ============================================================
        // BATTLEFIELD
        // ============================================================
        'bf': 'battlefield',
        'bf1': 'battlefield 1',
        'bf2': 'battlefield 2',
        'bf3': 'battlefield 3',
        'bf4': 'battlefield 4',
        'bf5': 'battlefield v',
        'bfv': 'battlefield v',
        'bf2042': 'battlefield 2042',
        '2042': 'battlefield 2042',

        // ============================================================
        // VALORANT / RIOT
        // ============================================================
        'valo': 'valorant',
        'val': 'valorant',
        'valarante': 'valorant',
        'league': 'league of legends',
        'lol': 'league of legends',
        'tft': 'teamfight tactics',
        'lor': 'legends of runeterra',

        // ============================================================
        // COUNTER STRIKE
        // ============================================================
        'cs': 'counter strike',
        'csgo': 'counter strike global offensive',
        'cs go': 'counter strike global offensive',
        'cs2': 'counter strike 2',
        'cs 2': 'counter strike 2',
        'counterstrike': 'counter strike',
        'counter strike': 'counter strike',

        // ============================================================
        // MINECRAFT
        // ============================================================
        'mc': 'minecraft',
        'minecraft java': 'minecraft java edition',
        'minecraft bedrock': 'minecraft bedrock edition',
        'mc java': 'minecraft java edition',
        'mc bedrock': 'minecraft bedrock edition',
        'minecraft dungeons': 'minecraft dungeons',
        'minecraft legends': 'minecraft legends',

        // ============================================================
        // FORTNITE / EPIC
        // ============================================================
        'fn': 'fortnite',
        'fort': 'fortnite',
        'fortnite br': 'fortnite battle royale',
        'rocket league': 'rocket league',
        'rl': 'rocket league',
        'fall guys': 'fall guys',
        'fallguys': 'fall guys',

        // ============================================================
        // GTA / ROCKSTAR RELATED
        // ============================================================
        'rdr online': 'red dead online',
        'rockstar launcher': 'rockstar games launcher',

        // ============================================================
        // HORROR
        // ============================================================
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

        // ============================================================
        // BETHESDA
        // ============================================================
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

        // ============================================================
        // SURVIVAL
        // ============================================================
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

        // ============================================================
        // RPG
        // ============================================================
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

        // ============================================================
        // UBISOFT
        // ============================================================
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

        // ============================================================
        // SONY / PLAYSTATION PC
        // ============================================================
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

        // ============================================================
        // SOCCER / SPORTS
        // ============================================================
        'pes': 'pro evolution soccer',
        'efootball': 'efootball',
        'wwe': 'wwe 2k',
        'wwe 2k24': 'wwe 2k24',
        'wwe 2k25': 'wwe 2k25',
        'wwe 2k26': 'wwe 2k26',

        // ============================================================
        // RACING
        // ============================================================
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

        // ============================================================
        // FPS
        // ============================================================
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

        // ============================================================
        // ZOMBIES
        // ============================================================
        'zombies': 'call of duty zombies',
        'cod zombies': 'call of duty zombies',
        'bo zombies': 'call of duty black ops zombies',
        'dying light': 'dying light',
        'dl1': 'dying light',
        'dl2': 'dying light 2',
        'dying light 2': 'dying light 2',
        'dead island': 'dead island',
        'dead island 2': 'dead island 2',

        // ============================================================
        // INDIE / POPULAR
        // ============================================================
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

        // ============================================================
        // SIMULATION
        // ============================================================
        'sims': 'the sims',
        'sims 4': 'the sims 4',
        'ts4': 'the sims 4',
        'cities skylines': 'cities skylines',
        'c:s': 'cities skylines',
        'planet zoo': 'planet zoo',
        'planet coaster': 'planet coaster',
        'football manager': 'football manager',
        'fm': 'football manager',

        // ============================================================
        // STRATEGY
        // ============================================================
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

        // ============================================================
        // CO-OP
        // ============================================================
        'it takes two': 'it takes two',
        'itt': 'it takes two',
        'a way out': 'a way out',
        'way out': 'a way out',
        'grounded': 'grounded',
        'deep rock': 'deep rock galactic',
        'drg': 'deep rock galactic',
        'palworld': 'palworld',
        'pal world': 'palworld',
        'lethal company': 'lethal company',

        // ============================================================
        // HORROR / PSYCHOLOGICAL
        // ============================================================
        'soma': 'soma',
        'visage': 'visage',
        'mortuary assistant': 'the mortuary assistant',
        'fnaf': 'five nights at freddys',
        'five nights': 'five nights at freddys',
        'fnaf 2': 'five nights at freddys 2',
        'fnaf 3': 'five nights at freddys 3',
        'fnaf 4': 'five nights at freddys 4',

        // ============================================================
        // ANIME / JRPG
        // ============================================================
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

        // ============================================================
        // POPULAR CURRENT / RECENT PC GAMES
        // ============================================================
        'wukong': 'black myth wukong',
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
        'mh wild': 'monster hunter wilds',
        'metaphor': 'metaphor refantazio',
        'metaphor refantazio': 'metaphor refantazio',
        'palworld': 'palworld',
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

        // ============================================================
        // CLASSICS
        // ============================================================
        'portal': 'portal',
        'portal 2': 'portal 2',
        'hl': 'half life',
        'half life': 'half life',
        'hl2': 'half life 2',
        'half life 2': 'half life 2',
        'hl alyx': 'half life alyx',
        'alyx': 'half life alyx',
        'left 4 dead': 'left 4 dead',
        'l4d': 'left 4 dead',
        'l4d2': 'left 4 dead 2',
        'team fortress': 'team fortress 2',
        'tf2': 'team fortress 2',
        'garrys mod': 'garrys mod',
        'gmod': 'garrys mod',
        'terraria': 'terraria',

        // ============================================================
        // ONLINE / MMO
        // ============================================================
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

        // ============================================================
        // SURVIVAL / BUILDING
        // ============================================================
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

        // ============================================================
        // OTHER MAJOR TITLES
        // ============================================================
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
        'kingdom come deliverance 2': 'kingdom come deliverance 2',
        'ac shadows': 'assassins creed shadows',
        'assassins creed shadows': 'assassins creed shadows'
    };

    const CLIENT_TYPOS = {
        // ============================================================
        // ASSASSIN'S CREED
        // ============================================================
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

        // ============================================================
        // CREED / COMMON WORD TYPOS
        // ============================================================
        'crede': 'creed',
        'credd': 'creed',
        'creed': 'creed',
        'creeed': 'creed',
        'creeddd': 'creed',

        // ============================================================
        // CYBERPUNK
        // ============================================================
        'ciberpunk': 'cyberpunk',
        'cyperpunk': 'cyberpunk',
        'cyberpuk': 'cyberpunk',
        'cyberpnk': 'cyberpunk',
        'cyberpunkk': 'cyberpunk',
        'cyberpunk 2077': 'cyberpunk 2077',
        'cyberpunk2077': 'cyberpunk 2077',
        'cyber punck': 'cyberpunk',
        'cyber punc': 'cyberpunk',

        // ============================================================
        // SPIDER-MAN
        // ============================================================
        'spidrman': 'spiderman',
        'spideman': 'spiderman',
        'spiderman': 'spiderman',
        'spiderma': 'spiderman',
        'spidermam': 'spiderman',
        'spidermen': 'spiderman',
        'spider man': 'spiderman',
        'spider-man': 'spiderman',
        'spidermaan': 'spiderman',
        'spidermaaan': 'spiderman',
        'spiderman2': 'spiderman 2',
        'spider man 2': 'spiderman 2',

        // ============================================================
        // RED DEAD
        // ============================================================
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

        // ============================================================
        // RESIDENT EVIL
        // ============================================================
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

        // ============================================================
        // GOD OF WAR
        // ============================================================
        'godofwar': 'god of war',
        'god of warr': 'god of war',
        'god of wa': 'god of war',
        'godof warr': 'god of war',
        'god of war ragnarok': 'god of war ragnarok',
        'god of war ragnaok': 'god of war ragnarok',
        'god of war ragnorok': 'god of war ragnarok',
        'god of war ragnarock': 'god of war ragnarok',

        // ============================================================
        // WITCHER
        // ============================================================
        'witcherr': 'witcher',
        'witcher': 'witcher',
        'wicher': 'witcher',
        'witcher 3': 'witcher 3',
        'witcher3': 'witcher 3',
        'witcher 33': 'witcher 3',
        'witcher wildhunt': 'witcher wild hunt',
        'wildhunt': 'wild hunt',
        'wild hunt': 'wild hunt',

        // ============================================================
        // GRAND THEFT AUTO
        // ============================================================
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

        // ============================================================
        // CALL OF DUTY
        // ============================================================
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

        // ============================================================
        // CYBERPUNK / WUKONG
        // ============================================================
        'wukongg': 'wukong',
        'wukong': 'wukong',
        'black myth wukong': 'black myth wukong',
        'black myth wukongg': 'black myth wukong',
        'blackmyth': 'black myth',
        'blackmythwukong': 'black myth wukong',

        // ============================================================
        // ELDEN RING
        // ============================================================
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

        // ============================================================
        // MINECRAFT
        // ============================================================
        'minecrft': 'minecraft',
        'minecaft': 'minecraft',
        'minecreft': 'minecraft',
        'minecraf': 'minecraft',
        'mine craft': 'minecraft',
        'minecraftt': 'minecraft',
        'minecraft java': 'minecraft java',
        'minecraft bedrock': 'minecraft bedrock',

        // ============================================================
        // VALORANT
        // ============================================================
        'valroant': 'valorant',
        'valorent': 'valorant',
        'valornt': 'valorant',
        'valorant': 'valorant',
        'valornat': 'valorant',
        'valoranttt': 'valorant',
        'valorentt': 'valorant',
        'valarant': 'valorant',
        'valarante': 'valorant',

        // ============================================================
        // COUNTER STRIKE
        // ============================================================
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

        // ============================================================
        // FORZA
        // ============================================================
        'forzza': 'forza',
        'forzaa': 'forza',
        'forrza': 'forza',
        'forza horizn': 'forza horizon',
        'forza horzion': 'forza horizon',
        'forza horizon': 'forza horizon',
        'forza horizon 5': 'forza horizon 5',
        'forza horizon 6': 'forza horizon 6',

        // ============================================================
        // NEED FOR SPEED
        // ============================================================
        'needforspeed': 'need for speed',
        'need for speeed': 'need for speed',
        'need for spedd': 'need for speed',
        'need for spead': 'need for speed',
        'needforspead': 'need for speed',
        'need for speed most wanted': 'need for speed most wanted',
        'need for speed heat': 'need for speed heat',
        'need for speed unbound': 'need for speed unbound',

        // ============================================================
        // FORTNITE
        // ============================================================
        'fortnitee': 'fortnite',
        'fortn ite': 'fortnite',
        'fortnate': 'fortnite',
        'fortnit': 'fortnite',
        'fornite': 'fortnite',
        'fortnitee': 'fortnite',
        'fortnite battle royale': 'fortnite battle royale',

        // ============================================================
        // MISC COMMON TYPOS
        // ============================================================
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
        'horizon zero dawnn': 'horizon zero dawn',
        'horizon forbidden west': 'horizon forbidden west',
        'horizon forbiden west': 'horizon forbidden west',

        'battelfield': 'battlefield',
        'battlefeild': 'battlefield',
        'battlefieldd': 'battlefield',
        'battle field': 'battlefield',

        'rainbow six seige': 'rainbow six siege',
        'rainbow six siege': 'rainbow six siege',
        'rainbowsix': 'rainbow six',
        'rainbow six sieg': 'rainbow six siege',

        'pubg': 'pubg battlegrounds',
        'pubg pc': 'pubg battlegrounds',
        'pubgmobile': 'pubg mobile',
        'playerunknowns': 'pubg battlegrounds',

        'apex legen': 'apex legends',
        'apex legend': 'apex legends',
        'apexlegends': 'apex legends',

        'overwath': 'overwatch',
        'overwatchh': 'overwatch',
        'overwatch 2': 'overwatch 2',

        'dead by daylight': 'dead by daylight',
        'deadbydaylight': 'dead by daylight',
        'dead by day light': 'dead by daylight',

        'amongus': 'among us',
        'amoung us': 'among us',
        'among uss': 'among us',

        'terrariaa': 'terraria',
        'terarria': 'terraria',
        'teraria': 'terraria',

        'stardew vally': 'stardew valley',
        'stardew vallley': 'stardew valley',
        'stardewvalley': 'stardew valley',

        'hollow knightt': 'hollow knight',
        'hollow knigt': 'hollow knight',
        'hollowknight': 'hollow knight',

        'silksongg': 'hollow knight silksong',
        'hollow knight silksong': 'hollow knight silksong',

        'liesofp': 'lies of p',
        'lies of p': 'lies of p',
        'lies of pp': 'lies of p',

        'dragons dogma': 'dragons dogma 2',
        'dragons dogma 22': 'dragons dogma 2',
        'dragons dogma ii': 'dragons dogma 2',

        'monster hunter': 'monster hunter',
        'monster hunter wilds': 'monster hunter wilds',
        'monster hunter wild': 'monster hunter wilds',
        'monsterhunter': 'monster hunter',

        'kingdom come': 'kingdom come deliverance',
        'kingdom come delivarance': 'kingdom come deliverance',
        'kingdom come deliverence': 'kingdom come deliverance',
        'kingdom come deliverance': 'kingdom come deliverance',

        'schedule1': 'schedule 1',
        'schedual 1': 'schedule 1',
        'scheduel 1': 'schedule 1',

        'arcraiders': 'arc raiders',
        'arc raider': 'arc raiders',
        'arc raiderss': 'arc raiders',

        'deltaforce': 'delta force',
        'delta forc': 'delta force',
        'delta forca': 'delta force',

        'maraton': 'marathon',
        'marathonn': 'marathon',

        'deadlok': 'deadlock',
        'deadlockk': 'deadlock',

        'thefinals': 'the finals',
        'the final': 'the finals',
        'finals': 'the finals'
    };

    function normalizeClientText(str) {
        if (!str) return '';
        return str.toLowerCase()
                  .replace(/['"’`\-_:;,\.!?\(\)\[\]/]/g, ' ')
                  .replace(/\s+/g, ' ')
                  .trim();
    }

    function clientSimilarity(s1, s2) {
        if (s1 === s2) return 1.0;
        if (!s1 || !s2) return 0.0;
        if (s1.includes(s2) || s2.includes(s1)) return 0.92;
        
        const l1 = s1.length, l2 = s2.length;
        const maxLen = Math.max(l1, l2);
        if (maxLen === 0) return 1.0;
        
        const matrix = [];
        for (let i = 0; i <= l1; i++) matrix[i] = [i];
        for (let j = 0; j <= l2; j++) matrix[0][j] = j;
        for (let i = 1; i <= l1; i++) {
            for (let j = 1; j <= l2; j++) {
                const cost = s1.charAt(i - 1) === s2.charAt(j - 1) ? 0 : 1;
                matrix[i][j] = Math.min(
                    matrix[i - 1][j] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j - 1] + cost
                );
            }
        }
        return (maxLen - matrix[l1][l2]) / maxLen;
    }

    function computeClientGameSimilarity(query, title) {
        const qNorm = normalizeClientText(query);
        const tNorm = normalizeClientText(title);
        if (!qNorm || !tNorm) return 0.0;
        if (tNorm.includes(qNorm)) return 1.0;

        const qWords = qNorm.split(' ').map(w => CLIENT_TYPOS[w] || w);
        const expandedQ = qWords.join(' ');
        const queryVariants = [qNorm, expandedQ];

        for (const [alias, full] of Object.entries(CLIENT_ALIASES)) {
            if (expandedQ.includes(alias) || qNorm === alias) {
                queryVariants.push(expandedQ.replace(alias, full));
            }
        }

        const tWords = tNorm.split(' ');
        let maxScore = 0.0;

        for (const qVariant of queryVariants) {
            if (tNorm.includes(qVariant)) {
                return 1.0;
            }
            const words = qVariant.split(' ');
            let wordScoresSum = 0;
            for (const qw of words) {
                let bestWordScore = 0;
                for (const tw of tWords) {
                    const sim = clientSimilarity(qw, tw);
                    if (sim > bestWordScore) bestWordScore = sim;
                }
                wordScoresSum += bestWordScore;
            }
            const avgScore = wordScoresSum / words.length;
            if (avgScore > maxScore) maxScore = avgScore;
        }

        return maxScore;
    }

    function getInstantLocalSuggestions(query) {
        if (!query || query.length < 2 || !localGamesIndex || localGamesIndex.length === 0) {
            return [];
        }

        const scored = [];
        for (const game of localGamesIndex) {
            const score = computeClientGameSimilarity(query, game.title);
            if (score >= 0.45) {
                scored.push({
                    ...game,
                    _score: score + (game.resolved ? 0.05 : 0.0)
                });
            }
        }

        scored.sort((a, b) => b._score - a._score);
        return scored.slice(0, 8);
    }

    // Preload index in background on startup
    async function prewarmLocalGamesIndex() {
        try {
            const res = await apiFetch('/api/popular?page=1&per_page=150');
            const data = await res.json();
            if (data.success && data.results && data.results.length > 0) {
                data.results.forEach(g => {
                    const existingIdx = localGamesIndex.findIndex(existing => (existing.slug && existing.slug === g.slug) || existing.url === g.url);
                    if (existingIdx >= 0) {
                        localGamesIndex[existingIdx] = { ...localGamesIndex[existingIdx], ...g };
                    } else {
                        localGamesIndex.push(g);
                    }
                });
                // If filters are active, re-apply with fully populated 150-game catalog
                if (isFilterActive) {
                    applyActiveFilters(1);
                }
            }
        } catch (_) {}
    }
    prewarmLocalGamesIndex();

    // Live Search Suggestions State
    let suggestDebounceTimer = null;
    let activeSuggestionIdx = -1;
    let currentSuggestionsList = [];

    function hideSuggestions() {
        if (searchSuggestions) {
            searchSuggestions.classList.add('hidden');
            searchSuggestions.style.display = 'none';
            searchSuggestions.innerHTML = '';
        }
        activeSuggestionIdx = -1;
        currentSuggestionsList = [];
    }

    function updateActiveSuggestion(items) {
        items.forEach((it, idx) => {
            if (idx === activeSuggestionIdx) {
                it.classList.add('active');
                it.scrollIntoView({ block: 'nearest' });
            } else {
                it.classList.remove('active');
            }
        });
    }

    function selectSuggestion(item) {
        hideSuggestions();
        if (searchInput) searchInput.value = item.title;
        openGameModal(item.url, item.slug, item.cover);
    }

    async function fetchRemoteSuggestionsFallback(query) {
        if (!query || query.length < 2) return;
        try {
            const res = await apiFetch(`/api/suggest?q=${encodeURIComponent(query)}`);
            const data = await res.json();
            if (data.success && data.suggestions && data.suggestions.length > 0) {
                // Merge into local cache
                data.suggestions.forEach(g => {
                    if (!localGamesIndex.some(existing => (existing.slug && existing.slug === g.slug) || existing.url === g.url)) {
                        localGamesIndex.push(g);
                    }
                });
                if (searchInput && searchInput.value.trim().toLowerCase() === query.toLowerCase()) {
                    const freshResults = getInstantLocalSuggestions(query);
                    if (freshResults.length > 0) {
                        currentSuggestionsList = freshResults;
                        renderSuggestions(freshResults, query);
                    }
                }
            }
        } catch (_) {}
    }

    function renderSuggestions(suggestions, query) {
        if (!searchSuggestions || !suggestions || suggestions.length === 0) {
            hideSuggestions();
            return;
        }
        activeSuggestionIdx = -1;

        searchSuggestions.innerHTML = suggestions.map((item, idx) => {
            const isResolved = item.resolved;
            const badgeClass = isResolved ? 'available' : 'unavailable';
            const badgeText = isResolved ? '<i class="fa-solid fa-bolt"></i> 1-Click Ready' : '<i class="fa-solid fa-cloud"></i> Repack';
            const coverUrl = formatCoverUrl(item.cover);
            
            return `
            <div class="suggestion-item" data-index="${idx}" data-url="${item.url}" data-slug="${item.slug}">
                <img class="suggestion-thumb" src="${coverUrl}" alt="${item.title}" onerror="this.onerror=null; this.src='/static/images/placeholder.svg';">
                <div class="suggestion-info">
                    <div class="suggestion-title" title="${item.title}">${item.title}</div>
                    <div class="suggestion-meta">
                        <span><i class="fa-solid fa-hard-drive"></i> ${item.repack_size || 'N/A'}</span>
                        <span><i class="fa-solid fa-layer-group"></i> ${item.parts_count || (item.fuckingfast_links ? item.fuckingfast_links.length : 0)} Parts</span>
                    </div>
                </div>
                <span class="suggestion-badge ${badgeClass}">${badgeText}</span>
            </div>
            `;
        }).join('') + `
        <div class="suggestion-footer-tip">
            <span><i class="fa-solid fa-keyboard"></i> Use ↑↓ to navigate</span>
            <span>Press <strong>Enter ↵</strong> to search all</span>
        </div>
        `;

        searchSuggestions.style.display = 'block';
        searchSuggestions.classList.remove('hidden');

        // Add click listeners to items
        searchSuggestions.querySelectorAll('.suggestion-item').forEach(el => {
            el.addEventListener('click', () => {
                const idx = parseInt(el.getAttribute('data-index'), 10);
                if (currentSuggestionsList[idx]) {
                    selectSuggestion(currentSuggestionsList[idx]);
                }
            });
        });
    }

    // Initialize hidden state
    hideSuggestions();

    const searchClearBtn = document.getElementById('searchClearBtn');

    function updateSearchClearBtn() {
        if (!searchClearBtn || !searchInput) return;
        if (searchInput.value.trim().length > 0) {
            searchClearBtn.classList.remove('hidden');
        } else {
            searchClearBtn.classList.add('hidden');
        }
    }

    if (searchClearBtn) {
        searchClearBtn.addEventListener('click', () => {
            if (searchInput) {
                searchInput.value = '';
                searchInput.focus();
            }
            updateSearchClearBtn();
            hideSuggestions();
            if (isFilterActive) {
                applyActiveFilters(1);
            } else if (currentMode === 'latest') {
                loadCatalog(1);
            } else {
                loadPopular(1);
            }
        });
    }

    // Global keyboard shortcut for search (Ctrl+K / Cmd+K or /)
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
            e.preventDefault();
            if (searchInput) {
                searchInput.focus();
                searchInput.select();
            }
        } else if (e.key === '/' && document.activeElement !== searchInput && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
            e.preventDefault();
            if (searchInput) {
                searchInput.focus();
                searchInput.select();
            }
        }
    });

    // Search Input Event Listeners
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            updateSearchClearBtn();
            const val = e.target.value.trim();
            if (val.length < 2) {
                hideSuggestions();
                return;
            }

            // 1. Instant 0ms In-Browser Fuzzy Suggestions
            const instantResults = getInstantLocalSuggestions(val);
            if (instantResults.length > 0) {
                currentSuggestionsList = instantResults;
                renderSuggestions(instantResults, val);
            }

            // 2. Debounced remote background fallback if few local results
            if (suggestDebounceTimer) clearTimeout(suggestDebounceTimer);
            if (instantResults.length < 4 && val.length >= 3) {
                suggestDebounceTimer = setTimeout(() => {
                    fetchRemoteSuggestionsFallback(val);
                }, 300);
            }
        });

        searchInput.addEventListener('keydown', (e) => {
            const isHidden = !searchSuggestions || searchSuggestions.classList.contains('hidden');
            
            if (e.key === 'ArrowDown' && !isHidden) {
                e.preventDefault();
                const items = searchSuggestions.querySelectorAll('.suggestion-item');
                if (items.length > 0) {
                    activeSuggestionIdx = (activeSuggestionIdx + 1) % items.length;
                    updateActiveSuggestion(items);
                }
            } else if (e.key === 'ArrowUp' && !isHidden) {
                e.preventDefault();
                const items = searchSuggestions.querySelectorAll('.suggestion-item');
                if (items.length > 0) {
                    activeSuggestionIdx = (activeSuggestionIdx - 1 + items.length) % items.length;
                    updateActiveSuggestion(items);
                }
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (!isHidden && activeSuggestionIdx >= 0 && currentSuggestionsList[activeSuggestionIdx]) {
                    selectSuggestion(currentSuggestionsList[activeSuggestionIdx]);
                } else {
                    hideSuggestions();
                    handleSearch();
                }
            } else if (e.key === 'Escape') {
                hideSuggestions();
            }
        });
    }

    // Dismiss suggestions on click outside
    document.addEventListener('click', (e) => {
        if (searchInput && searchSuggestions && !searchInput.contains(e.target) && !searchSuggestions.contains(e.target)) {
            hideSuggestions();
        }
    });

    // Brand Logo Click -> Navigate Home (Popular Repacks Page 1)
    const brandLogo = document.getElementById('brandLogo') || document.querySelector('.logo-container');
    if (brandLogo) {
        brandLogo.addEventListener('click', () => {
            if (searchInput) {
                searchInput.value = '';
                updateSearchClearBtn();
            }
            hideSuggestions();
            if (btnPopular) btnPopular.classList.add('active');
            if (btnLatest) btnLatest.classList.remove('active');
            if (gameModal) gameModal.classList.add('hidden');
            if (downloadDrawer) downloadDrawer.classList.add('hidden');
            if (pollInterval) clearInterval(pollInterval);
            loadPopular(1);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    // Filter toggle listeners
    if (btnPopular) {
        btnPopular.addEventListener('click', () => {
            btnPopular.classList.add('active');
            if (btnLatest) btnLatest.classList.remove('active');
            loadPopular();
        });
    }

    if (btnLatest) {
        btnLatest.addEventListener('click', () => {
            btnLatest.classList.add('active');
            if (btnPopular) btnPopular.classList.remove('active');
            loadCatalog();
        });
    }

    // ============================================================
    // CATEGORY & SUB-FILTER ENGINE
    // ============================================================
    const GENRE_KEYWORDS = {
        action: ['action', 'shooter', 'fps', 'combat', 'war', 'battle', 'sniper', 'doom', 'crisis', 'stealth', 'assassin', 'strike', 'gun', 'kill', 'fight', 'soldier', 'duty'],
        rpg: ['rpg', 'role playing', 'open world', 'witcher', 'elder scrolls', 'skyrim', 'souls', 'elden', 'baldurs', 'cyberpunk', 'fantasy', 'dragon', 'horizon', 'quest', 'fallout', 'starfield', 'persona', 'final fantasy', 'tales'],
        horror: ['horror', 'resident evil', 'silent hill', 'dead', 'survival', 'zombie', 'scary', 'amnesia', 'outlast', 'ghost', 'evil', 'fear', 'nightmare', 'phasmophobia', 'mortuary', 'soma', 'visage', 'fnaf'],
        racing: ['racing', 'race', 'car', 'drive', 'speed', 'forza', 'nfs', 'dirt', 'rally', 'motorsport', 'beamng', 'fifa', 'nba', 'wwe', 'pes', 'football', 'sports', 'f1', 'crew', 'assetto', 'grid'],
        strategy: ['strategy', 'sim', 'simulation', 'manager', 'rts', 'civilization', 'empires', 'warcraft', 'starcraft', 'total war', 'tactics', 'tycoon', 'city', 'cities', 'crusader', 'age of', 'command'],
        indie: ['indie', 'platformer', 'rogue', 'pixel', 'co-op', 'coop', 'puzzle', 'hades', 'hollow', 'stardew', 'cuphead', 'celeste', 'lethal', 'craft', 'undertale', 'balatro', 'terraria', 'binding', 'palworld'],
        anime: ['anime', 'jrpg', 'dragon ball', 'naruto', 'one piece', 'persona', 'final fantasy', 'genshin', 'sekiro', 'wukong', 'storm', 'tales', 'atelier', 'ys ', 'sword art', 'guilty gear', 'tekken', 'street fighter']
    };

    const activeCategoryFilters = {
        genre: 'all',
        mode: 'all',
        size: 'all',
        status: 'all'
    };

    let isFilterActive = false;
    let currentFilteredGames = [];

    function parseSizeInGB(game) {
        if (!game) return 0;
        const sizeStr = (typeof game === 'string') ? game : ((game.repack_size && game.repack_size !== 'N/A') ? game.repack_size : '');
        const titleStr = (typeof game === 'object' && game.title) ? game.title : '';
        const excerptStr = (typeof game === 'object' && game.excerpt) ? game.excerpt : '';
        const combined = `${sizeStr} ${titleStr} ${excerptStr}`.toLowerCase();

        // 1. Look for GB patterns (e.g., "from 77.3 gb", "36.1 gb", "58.3/58.7 gb", "4 gb")
        const gbMatch = combined.match(/(?:from\s*)?([\d\.]+)\s*(?:\/[\d\.]+)?\s*gb/i);
        if (gbMatch) {
            const val = parseFloat(gbMatch[1]);
            if (!isNaN(val) && val > 0) return val;
        }

        // 2. Look for MB patterns (e.g., "348 mb")
        const mbMatch = combined.match(/(?:from\s*)?([\d\.]+)\s*(?:\/[\d\.]+)?\s*mb/i);
        if (mbMatch) {
            const val = parseFloat(mbMatch[1]);
            if (!isNaN(val) && val > 0) return val / 1024.0;
        }

        return 0;
    }

    function matchesCategoryFilters(game) {
        const titleLower = (game.title || '').toLowerCase();
        const excerptLower = (game.excerpt || '').toLowerCase();
        const combined = `${titleLower} ${excerptLower}`;

        // 1. Genre Filter
        if (activeCategoryFilters.genre !== 'all') {
            const kws = GENRE_KEYWORDS[activeCategoryFilters.genre] || [];
            const match = kws.some(kw => combined.includes(kw));
            if (!match) return false;
        }

        // 2. Mode Filter (offline / online)
        if (activeCategoryFilters.mode === 'online') {
            const onlineKws = ['multiplayer', 'online', 'co-op', 'coop', 'mp with bots', 'pvp', 'lan', 'server'];
            if (!onlineKws.some(kw => combined.includes(kw))) return false;
        }

        // 3. Size Filter
        if (activeCategoryFilters.size !== 'all') {
            const gb = parseSizeInGB(game);
            if (gb <= 0) return false;
            if (activeCategoryFilters.size === 'under5' && gb >= 5.0) return false;
            if (activeCategoryFilters.size === '5to20' && (gb < 5.0 || gb >= 20.0)) return false;
            if (activeCategoryFilters.size === '20to50' && (gb < 20.0 || gb >= 50.0)) return false;
            if (activeCategoryFilters.size === 'over50' && gb < 50.0) return false;
        }

        // 4. Status Filter (1-Click Ready)
        if (activeCategoryFilters.status === 'ready') {
            const isReady = game.resolved && ((game.direct_links && game.direct_links.length > 0) || (game.direct_links_count && game.direct_links_count > 0));
            if (!isReady) return false;
        }

        return true;
    }

    function applyActiveFilters(page = 1) {
        const isAnyActive = (activeCategoryFilters.genre !== 'all' || activeCategoryFilters.mode !== 'all' || activeCategoryFilters.size !== 'all' || activeCategoryFilters.status !== 'all');
        isFilterActive = isAnyActive;

        const btnClear = document.getElementById('btnClearFilters');
        const summaryBar = document.getElementById('filterSummaryBar');
        const summaryText = document.getElementById('filterSummaryText');

        if (btnClear) btnClear.classList.toggle('hidden', !isAnyActive);

        if (!isAnyActive) {
            if (summaryBar) summaryBar.classList.add('hidden');
            if (currentMode === 'popular') return loadPopular(page);
            return loadCatalog(page);
        }

        const sourceList = localGamesIndex.length > 0 ? localGamesIndex : [];
        const filtered = sourceList.filter(matchesCategoryFilters);
        currentFilteredGames = filtered;

        if (summaryBar && summaryText) {
            summaryBar.classList.remove('hidden');
            const genreLabel = activeCategoryFilters.genre !== 'all' ? activeCategoryFilters.genre.toUpperCase() : 'ALL';
            summaryText.innerHTML = `<span><i class="fa-solid fa-filter"></i> Category: <strong>${genreLabel}</strong> (${filtered.length} repacks matching active filters)</span>`;
        }

        const perPage = 16;
        const totalPages = Math.ceil(filtered.length / perPage) || 1;
        const p = Math.max(1, Math.min(page, totalPages));
        const startIdx = (p - 1) * perPage;
        const pageItems = filtered.slice(startIdx, startIdx + perPage);

        catalogTitle.innerHTML = `<i class="fa-solid fa-layer-group"></i> Filtered Repacks (${filtered.length} found)`;
        renderGames(pageItems);
        renderPagination(p, totalPages);
    }

    // Category Chips Event Listeners
    document.querySelectorAll('.category-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            document.querySelectorAll('.category-chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            activeCategoryFilters.genre = chip.getAttribute('data-genre') || 'all';
            applyActiveFilters(1);
        });
    });

    // Sub-Filter Pills Event Listeners
    const bindPillGroup = (groupId, stateKey, dataAttr) => {
        const group = document.getElementById(groupId);
        if (!group) return;
        group.querySelectorAll('.filter-pill').forEach(pill => {
            pill.addEventListener('click', () => {
                group.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
                pill.classList.add('active');
                activeCategoryFilters[stateKey] = pill.getAttribute(dataAttr) || 'all';
                applyActiveFilters(1);
            });
        });
    };

    bindPillGroup('filterModeGroup', 'mode', 'data-mode');
    bindPillGroup('filterSizeGroup', 'size', 'data-size');
    bindPillGroup('filterStatusGroup', 'status', 'data-status');

    // Reset Filters Listener
    const btnClearFilters = document.getElementById('btnClearFilters');
    if (btnClearFilters) {
        btnClearFilters.addEventListener('click', () => {
            activeCategoryFilters.genre = 'all';
            activeCategoryFilters.mode = 'all';
            activeCategoryFilters.size = 'all';
            activeCategoryFilters.status = 'all';

            document.querySelectorAll('.category-chip').forEach(c => c.classList.toggle('active', c.getAttribute('data-genre') === 'all'));
            document.querySelectorAll('#filterModeGroup .filter-pill').forEach(p => p.classList.toggle('active', p.getAttribute('data-mode') === 'all'));
            document.querySelectorAll('#filterSizeGroup .filter-pill').forEach(p => p.classList.toggle('active', p.getAttribute('data-size') === 'all'));
            document.querySelectorAll('#filterStatusGroup .filter-pill').forEach(p => p.classList.toggle('active', p.getAttribute('data-status') === 'all'));

            applyActiveFilters(1);
        });
    }

    if (searchBtn) searchBtn.addEventListener('click', () => {
        hideSuggestions();
        handleSearch();
    });

    if (closeModal) closeModal.addEventListener('click', () => {
        if (gameModal) gameModal.classList.add('hidden');
    });

    if (closeDrawer) closeDrawer.addEventListener('click', () => {
        if (downloadDrawer) downloadDrawer.classList.add('hidden');
        if (pollInterval) clearInterval(pollInterval);
    });

    // Guide Tab Switching
    document.querySelectorAll('.guide-tab').forEach(tabBtn => {
        tabBtn.addEventListener('click', () => {
            document.querySelectorAll('.guide-tab').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));

            tabBtn.classList.add('active');
            const targetTab = tabBtn.getAttribute('data-tab');
            const contentElem = document.getElementById(`tab-${targetTab}`);
            if (contentElem) contentElem.classList.remove('hidden');
        });
    });

    // --- Copy URLs: client-side clipboard via navigator.clipboard ---
    copyClipboardBtn.addEventListener('click', async () => {
        if (extractedLinksCache && extractedLinksCache.length > 0) {
            // Use cached links directly — works everywhere including Vercel
            const linksText = extractedLinksCache.join('\n');
            try {
                await navigator.clipboard.writeText(linksText);
                const origText = copyClipboardBtn.innerHTML;
                copyClipboardBtn.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
                copyClipboardBtn.style.background = 'var(--gradient-purple)';
                setTimeout(() => {
                    copyClipboardBtn.innerHTML = origText;
                    copyClipboardBtn.style.background = '';
                }, 2500);
                alert(`📋 ${extractedLinksCache.length} direct URLs copied to Clipboard!\n\nYou can now paste them into FDM, JDownloader 2, IDM, or Motrix.`);
                return;
            } catch (clipErr) {
                // Fallback: try server-side copy (local server only)
                console.warn('navigator.clipboard failed, trying server fallback:', clipErr);
            }
        }

        // Fallback: try server endpoint (works on local server with Windows clip)
        try {
            const res = await apiFetch('/api/copy_clipboard', { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                // If server returned links, also cache them
                if (data.links && data.links.length > 0) {
                    extractedLinksCache = data.links;
                    // Try client-side clipboard with the returned links
                    try {
                        await navigator.clipboard.writeText(data.links.join('\n'));
                    } catch (_) { /* server already copied via clip */ }
                }
                const origText = copyClipboardBtn.innerHTML;
                copyClipboardBtn.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
                copyClipboardBtn.style.background = 'var(--gradient-purple)';
                setTimeout(() => {
                    copyClipboardBtn.innerHTML = origText;
                    copyClipboardBtn.style.background = '';
                }, 2500);
                alert('📋 Direct URLs copied to Clipboard!\n\nYou can now paste them into FDM, JDownloader 2, IDM, or Motrix.');
            } else {
                alert('Error: ' + data.error);
            }
        } catch (e) {
            alert('Failed to copy to clipboard');
        }
    });

    // --- Save links.txt: client-side Blob download ---
    downloadTxtBtn.addEventListener('click', () => {
        if (extractedLinksCache && extractedLinksCache.length > 0) {
            // Generate file client-side from cached links
            const blob = new Blob([extractedLinksCache.join('\n')], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'download_links.txt';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } else {
            // Fallback: try server endpoint (local server with file)
            window.open(`${API_BASE}/api/download_txt`, '_blank');
        }
    });

    browserBatchBtn.addEventListener('click', () => {
        if (!extractedLinksCache || extractedLinksCache.length === 0) {
            alert('No links available to download.');
            return;
        }

        const total = extractedLinksCache.length;
        const msg = `Starting download of all ${total} parts directly in your browser.\n\n` +
            `IMPORTANT: If Chrome/Edge shows a prompt asking "Allow downloading multiple files?", click ALLOW so all parts download!`;

        if (confirm(msg)) {
            const origText = browserBatchBtn.innerHTML;
            browserBatchBtn.disabled = true;

            extractedLinksCache.forEach((link, idx) => {
                setTimeout(() => {
                    browserBatchBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Downloading (${idx + 1}/${total})...`;

                    const iframe = document.createElement('iframe');
                    iframe.style.display = 'none';
                    iframe.src = link;
                    document.body.appendChild(iframe);

                    setTimeout(() => {
                        try { document.body.removeChild(iframe); } catch (e) { }
                    }, 45000);

                    if (idx === total - 1) {
                        setTimeout(() => {
                            browserBatchBtn.innerHTML = '<i class="fa-solid fa-check"></i> All Started!';
                            browserBatchBtn.style.background = 'var(--gradient-purple)';
                            setTimeout(() => {
                                browserBatchBtn.disabled = false;
                                browserBatchBtn.innerHTML = origText;
                                browserBatchBtn.style.background = '';
                            }, 4000);
                        }, 1000);
                    }
                }, idx * 1200); // 1.2s delay between parts to avoid browser throttling
            });
        }
    });

    const paginationContainer = document.getElementById('paginationContainer');
    const prevPageBtn = document.getElementById('prevPageBtn');
    const nextPageBtn = document.getElementById('nextPageBtn');
    const pageNumbers = document.getElementById('pageNumbers');

    let currentMode = 'popular';
    let currentPage = 1;
    let totalPages = 1;

    if (prevPageBtn) {
        prevPageBtn.addEventListener('click', () => {
            if (currentPage > 1) goToPage(currentPage - 1);
        });
    }

    if (nextPageBtn) {
        nextPageBtn.addEventListener('click', () => {
            if (currentPage < totalPages) goToPage(currentPage + 1);
        });
    }

    function goToPage(p) {
        if (isFilterActive) {
            applyActiveFilters(p);
        } else if (currentMode === 'popular') {
            loadPopular(p);
        } else if (currentMode === 'latest') {
            loadCatalog(p);
        }
        window.scrollTo({ top: gamesGrid.offsetTop - 100, behavior: 'smooth' });
    }

    function renderPagination(page, maxPages) {
        currentPage = page;
        totalPages = maxPages;

        if (!paginationContainer) return;

        if (totalPages <= 1) {
            paginationContainer.classList.add('hidden');
            return;
        }

        paginationContainer.classList.remove('hidden');
        if (prevPageBtn) prevPageBtn.disabled = (currentPage <= 1);
        if (nextPageBtn) nextPageBtn.disabled = (currentPage >= totalPages);

        let btnsHtml = '';
        let startP = Math.max(1, currentPage - 2);
        let endP = Math.min(totalPages, startP + 4);
        if (endP - startP < 4) {
            startP = Math.max(1, endP - 4);
        }

        for (let i = startP; i <= endP; i++) {
            const activeClass = i === currentPage ? 'active' : '';
            btnsHtml += `<button class="page-num-btn ${activeClass}" data-page="${i}">${i}</button>`;
        }
        if (pageNumbers) pageNumbers.innerHTML = btnsHtml;

        document.querySelectorAll('.page-num-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const p = parseInt(btn.getAttribute('data-page'));
                goToPage(p);
            });
        });
    }

    function renderSkeletonsHtml(count = 8) {
        return `
            <div class="skeleton-grid">
                ${Array.from({ length: count }).map(() => `
                    <div class="skeleton-card">
                        <div class="skeleton-thumb shimmer"></div>
                        <div class="skeleton-line title shimmer"></div>
                        <div class="skeleton-line subtitle shimmer"></div>
                        <div class="skeleton-line btn shimmer"></div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    async function loadPopular(page = 1, isRetry = false) {
        currentMode = 'popular';
        if (btnPopular) btnPopular.classList.add('active');
        if (btnLatest) btnLatest.classList.remove('active');

        catalogTitle.innerHTML = `<i class="fa-solid fa-fire text-neon"></i> Top Repacks of the Year (Page ${page})`;
        gamesGrid.innerHTML = renderSkeletonsHtml(8);
        try {
            const res = await apiFetch(`/api/popular?page=${page}&per_page=16`);
            const data = await res.json();
            if (data.success && data.results && data.results.length > 0) {
                // Ingest into local instant index
                data.results.forEach(g => {
                    const existingIdx = localGamesIndex.findIndex(existing => (existing.slug && existing.slug === g.slug) || existing.url === g.url);
                    if (existingIdx >= 0) {
                        localGamesIndex[existingIdx] = { ...localGamesIndex[existingIdx], ...g };
                    } else {
                        localGamesIndex.push(g);
                    }
                });
                renderGames(data.results);
                renderPagination(data.page, data.total_pages);
            } else if (!isRetry) {
                setTimeout(() => loadPopular(page, true), 1200);
            } else {
                renderGames(data.results || []);
            }
        } catch (e) {
            if (!isRetry) {
                setTimeout(() => loadPopular(page, true), 1200);
            } else {
                gamesGrid.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: var(--accent-danger);">Failed to load popular repacks.</p>`;
            }
        }
    }

    async function loadCatalog(page = 1) {
        currentMode = 'latest';
        if (btnLatest) btnLatest.classList.add('active');
        if (btnPopular) btnPopular.classList.remove('active');

        catalogTitle.innerHTML = `<i class="fa-solid fa-clock text-neon"></i> Latest Repacks (Page ${page})`;
        gamesGrid.innerHTML = renderSkeletonsHtml(8);
        try {
            const res = await apiFetch(`/api/catalog?page=${page}`);
            const data = await res.json();
            if (data.success) {
                renderGames(data.catalog);
                renderPagination(page, 10);
            }
        } catch (e) {
            gamesGrid.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: var(--accent-danger);">Failed to load catalog from server.</p>`;
        }
    }

    async function handleSearch() {
        const query = searchInput.value.trim();
        if (!query) {
            if (currentMode === 'latest') return loadCatalog(1);
            return loadPopular(1);
        }

        if (paginationContainer) paginationContainer.classList.add('hidden');
        catalogTitle.innerHTML = `<i class="fa-solid fa-magnifying-glass text-neon"></i> Search Results for "${query}"`;
        gamesGrid.innerHTML = renderSkeletonsHtml(8);

        try {
            const res = await apiFetch(`/api/search?q=${encodeURIComponent(query)}`);
            const data = await res.json();
            if (data.success) {
                renderGames(data.results);
            }
        } catch (e) {
            gamesGrid.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: var(--accent-danger);">Search request failed.</p>`;
        }
    }

    function renderGames(games) {
        if (!games || games.length === 0) {
            gamesGrid.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted);">No repacks found matching your search.</p>`;
            return;
        }

        gamesGrid.innerHTML = games.map(game => {
            const isResolved = game.resolved && ((game.direct_links && game.direct_links.length > 0) || (game.direct_links_count && game.direct_links_count > 0));
            const statusBadge = isResolved
                ? `<span class="badge-status badge-available"><i class="fa-solid fa-circle-check"></i> Links Available</span>`
                : `<span class="badge-status badge-unavailable"><i class="fa-solid fa-clock"></i> Links Not Available</span>`;

            const parsedGb = parseSizeInGB(game);
            let sizeDisplay = '';
            if (game.repack_size && game.repack_size !== 'N/A') {
                sizeDisplay = `<i class="fa-solid fa-hard-drive"></i> ${game.repack_size}`;
            } else if (parsedGb > 0) {
                sizeDisplay = `<i class="fa-solid fa-hard-drive"></i> ${parsedGb.toFixed(1)} GB`;
            } else {
                sizeDisplay = `<i class="fa-solid fa-calendar-day"></i> ${game.date || 'FitGirl Repack'}`;
            }

            return `
            <div class="game-card" data-url="${game.url}" data-slug="${game.slug || ''}">
                <img class="card-poster" src="${formatCoverUrl(game.cover)}" alt="${game.title}" loading="lazy" onerror="this.onerror=null; this.src='/static/images/placeholder.svg';">
                <div class="card-content">
                    <h3 class="card-title">${game.title}</h3>
                    <div class="card-meta-row">
                        <span class="card-date" title="Repack Details">${sizeDisplay}</span>
                        ${statusBadge}
                    </div>
                    <div class="card-footer">
                        <button class="btn-get"><i class="fa-solid ${isResolved ? 'fa-bolt' : 'fa-eye'}"></i> ${isResolved ? 'Instant Download' : 'View Repack'}</button>
                        <a href="${game.url}" target="_blank" rel="noopener noreferrer" class="btn-fitgirl" onclick="event.stopPropagation()">
                            <i class="fa-solid fa-arrow-up-right-from-square"></i> FitGirl
                        </a>
                    </div>
                </div>
            </div>
            `;
        }).join('');

        // Add event listeners to cards
        document.querySelectorAll('.game-card').forEach(card => {
            card.addEventListener('click', () => {
                const gameUrl = card.getAttribute('data-url');
                const gameSlug = card.getAttribute('data-slug');
                const cardImg = card.querySelector('.card-poster')?.getAttribute('src') || '';
                openGameModal(gameUrl, gameSlug, cardImg);
            });
        });
    }

    async function openGameModal(gameUrl, gameSlug = '', cardPosterSrc = '') {
        gameModal.classList.remove('hidden');

        // Show initial loading modal using the already-loaded card poster for zero flicker
        const initialPoster = formatCoverUrl(cardPosterSrc || `/api/game_cover?url=${encodeURIComponent(gameUrl)}`);
        modalBody.innerHTML = `
            <div class="loading-spinner">
                <div class="spinner"></div>
                <p>Loading game details & mirrors from database...</p>
            </div>
        `;

        try {
            const queryParam = gameSlug ? `slug=${encodeURIComponent(gameSlug)}` : `url=${encodeURIComponent(gameUrl)}`;
            const res = await apiFetch(`/api/game?${queryParam}`);
            const data = await res.json();
            if (data.success && data.game) {
                const g = data.game;

                // Sync full game details into localGamesIndex
                const existingIdx = localGamesIndex.findIndex(item => (item.slug && item.slug === g.slug) || item.url === g.url);
                if (existingIdx >= 0) {
                    localGamesIndex[existingIdx] = { ...localGamesIndex[existingIdx], ...g };
                } else {
                    localGamesIndex.push(g);
                }

                const isResolved = g.resolved && g.direct_links && g.direct_links.length > 0;
                const partsCount = (g.direct_links && g.direct_links.length > 0) ? g.direct_links.length : (g.parts_count || (g.fuckingfast_links ? g.fuckingfast_links.length : 0));

                let finalCover = g.cover || cardPosterSrc;
                if (!finalCover || finalCover === 'None') {
                    finalCover = `/api/game_cover?url=${encodeURIComponent(g.url || gameUrl)}`;
                } else if (finalCover.startsWith('http') && !finalCover.startsWith('/api/image_proxy') && !finalCover.startsWith('/api/game_cover') && finalCover.indexOf('vercel.app/api/') === -1) {
                    finalCover = `/api/image_proxy?url=${encodeURIComponent(finalCover)}`;
                }
                finalCover = formatCoverUrl(finalCover);

                const alertBox = isResolved ? `
                    <div class="status-alert-box available">
                        <i class="fa-solid fa-circle-check"></i>
                        <div>
                            <strong>Direct Download Links Available in Database!</strong>
                            <p>All ${partsCount} direct download parts are pre-extracted in Firestore. Click below for instant 1-click download with zero wait time.</p>
                        </div>
                    </div>
                ` : `
                    <div class="status-alert-box unavailable">
                        <i class="fa-solid fa-cloud-arrow-down"></i>
                        <div>
                            <strong>Direct 1-Click Links Not Cached in Cloud Yet</strong>
                            <p>Copy the raw part links below and extract direct links in seconds on your PC using the standalone <strong>FitBoy Local Link Extractor (.exe)</strong> (zero dependencies / no installation).</p>
                        </div>
                    </div>
                `;

                modalBody.innerHTML = `
                    <div class="modal-detail-grid">
                        <div>
                            <img class="modal-poster" src="${finalCover}" alt="${g.title}" onerror="if(this.src.indexOf('/api/game_cover')===-1){this.src='/api/game_cover?url=${encodeURIComponent(g.url || gameUrl)}';}else{this.onerror=null;this.src='/static/images/placeholder.svg';}">
                        </div>
                        <div class="modal-info">
                            <h2>${g.title}</h2>
                            <div class="tags-row">
                                <span class="tag-badge"><i class="fa-solid fa-hard-drive"></i> Repack Size: ${g.repack_size || 'N/A'}</span>
                                <span class="tag-badge"><i class="fa-solid fa-layer-group"></i> ${partsCount} Parts in Database</span>
                                ${isResolved ? `<span class="tag-badge" style="background:rgba(0,255,135,0.15); color:#00ff87; border:1px solid rgba(0,255,135,0.4);"><i class="fa-solid fa-bolt"></i> Links Available</span>` : `<span class="tag-badge" style="background:rgba(255,170,0,0.12); color:#ffaa00; border:1px solid rgba(255,170,0,0.3);"><i class="fa-solid fa-clock"></i> Links Not Available</span>`}
                            </div>
                            
                            ${alertBox}

                            <ul class="features-list">
                                ${g.features && g.features.length > 0
                        ? g.features.map(f => `<li>${f}</li>`).join('')
                        : '<li>Verified lossless FitBoy Repack</li><li>Fast installation and MD5 integrity verification</li>'}
                            </ul>

                            <div class="modal-actions-row">
                                ${isResolved ? `
                                    <button id="startDownloadBtn" class="btn-primary glow-btn" data-url="${g.url}" data-slug="${g.slug || ''}" data-title="${g.title}">
                                        <i class="fa-solid fa-bolt"></i> Instant 1-Click Download (${partsCount} Direct Parts)
                                    </button>
                                ` : `
                                    <button id="copyRawLinksBtn" class="btn-primary glow-btn" data-title="${g.title}">
                                        <i class="fa-solid fa-copy"></i> Copy Raw FuckingFast Links (${partsCount} Parts)
                                    </button>
                                    <a href="https://github.com/GoldleoM/Fitgirl_Local_Link_Extractor/releases/download/v1.0.1/FitGirl_Link_Extractor.exe" target="_blank" rel="noopener noreferrer" class="btn-accent-download">
                                        <i class="fa-solid fa-download"></i> Download Local Extractor (.exe)
                                    </a>
                                `}
                                <a href="${g.url}" target="_blank" rel="noopener noreferrer" class="btn-secondary btn-fitgirl-modal">
                                    <i class="fa-solid fa-arrow-up-right-from-square"></i> FitGirl Page
                                </a>
                            </div>
                        </div>
                    </div>
                `;

                // Handle copy raw links button
                const copyRawBtn = document.getElementById('copyRawLinksBtn');
                if (copyRawBtn && g.fuckingfast_links && g.fuckingfast_links.length > 0) {
                    copyRawBtn.addEventListener('click', async () => {
                        try {
                            await navigator.clipboard.writeText(g.fuckingfast_links.join('\n'));
                            const orig = copyRawBtn.innerHTML;
                            copyRawBtn.innerHTML = '<i class="fa-solid fa-check"></i> Copied to Clipboard!';
                            copyRawBtn.style.background = 'var(--gradient-purple)';
                            setTimeout(() => {
                                copyRawBtn.innerHTML = orig;
                                copyRawBtn.style.background = '';
                            }, 2500);
                            alert(`📋 ${g.fuckingfast_links.length} FuckingFast links copied to clipboard!\n\nPaste them into the FitBoy Local Link Extractor (.exe) to instantly generate download_links.txt locally!`);
                        } catch (e) {
                            alert(`Could not copy to clipboard: ${e.message}`);
                        }
                    });
                }

                // Handle start download button
                const startBtn = document.getElementById('startDownloadBtn');
                if (startBtn) {
                    startBtn.addEventListener('click', (e) => {
                        const title = e.currentTarget.getAttribute('data-title');
                        const url = e.currentTarget.getAttribute('data-url');
                        const slug = e.currentTarget.getAttribute('data-slug');
                        startDownloadProcess(title, url, g.fuckingfast_links, slug);
                    });
                }
            } else {
                modalBody.innerHTML = `<p style="color: red; text-align: center;">Could not load game details.</p>`;
            }
        } catch (e) {
            modalBody.innerHTML = `<p style="color: red; text-align: center;">Network error while fetching game details.</p>`;
        }
    }

    async function startDownloadProcess(title, gameUrl, links, gameSlug = '') {
        gameModal.classList.add('hidden');
        downloadDrawer.classList.remove('hidden');
        drawerGameTitle.innerText = title;
        drawerStatusText.innerText = "Loading download links...";

        const total = links ? links.length : 0;
        progressBar.style.width = "0%";
        progressCounter.innerText = `0 / ${total} Parts Extracted`;
        progressPercentBadge.innerText = "0%";
        currentPartText.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Checking database & resolving links...`;
        terminalLogs.innerHTML = `<div class="log-line text-muted">> Fetching direct links for '${title}'...</div>`;

        copyClipboardBtn.disabled = true;
        downloadTxtBtn.disabled = true;
        browserBatchBtn.disabled = true;
        extractedLinksCache = [];

        try {
            const res = await apiFetch('/api/extract_links', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    game_title: title,
                    game_url: gameUrl,
                    slug: gameSlug,
                    links: links
                })
            });
            const data = await res.json();

            if (data.success || (data.direct_links && data.direct_links.length > 0)) {
                const extCount = data.extracted_count || data.direct_links.length;
                extractedLinksCache = data.direct_links;

                // Update UI to completed state
                drawerStatusText.innerText = `Completed! ${extCount} direct links ready.`;
                progressBar.style.width = "100%";
                progressPercentBadge.innerText = "100%";
                progressCounter.innerText = `${extCount} / ${total} Parts Extracted`;
                currentPartText.innerHTML = `<i class="fa-solid fa-check" style="color: #00ff87;"></i> All ${extCount} parts successfully extracted!`;

                // Render logs
                if (data.logs && data.logs.length > 0) {
                    terminalLogs.innerHTML = data.logs.map(l => {
                        const isSucc = l.includes('Extracted part') || l.includes('✔') || l.includes('Pipeline finished');
                        return `<div class="log-line ${isSucc ? 'succ' : ''}">${l}</div>`;
                    }).join('');
                }

                copyClipboardBtn.disabled = false;
                downloadTxtBtn.disabled = false;
                browserBatchBtn.disabled = false;

                // Auto-copy to clipboard
                try {
                    await navigator.clipboard.writeText(extractedLinksCache.join('\n'));
                    terminalLogs.innerHTML += `<div class="log-line succ">> 📋 All ${extCount} direct links automatically copied to Clipboard!</div>`;
                    terminalLogs.innerHTML += `<div class="log-line" style="color: #00f2fe;">> 💡 Use FDM, JDownloader 2, IDM, or click "Save links.txt" / "Download in Browser"</div>`;
                } catch (clipErr) {
                    terminalLogs.innerHTML += `<div class="log-line">> Links ready. Click "Copy URLs" to copy to clipboard.</div>`;
                }

                terminalLogs.scrollTop = terminalLogs.scrollHeight;
            } else {
                drawerStatusText.innerText = "Extraction failed: " + (data.error || 'Unknown error');
                currentPartText.innerHTML = `<i class="fa-solid fa-triangle-exclamation" style="color: red;"></i> ${data.error || 'Could not extract download links.'}`;

                if (data.logs && data.logs.length > 0) {
                    terminalLogs.innerHTML = data.logs.map(l =>
                        `<div class="log-line">${l}</div>`
                    ).join('');
                }
            }
        } catch (e) {
            drawerStatusText.innerText = "Network error during extraction";
            currentPartText.innerHTML = `<i class="fa-solid fa-triangle-exclamation" style="color: red;"></i> Request failed. Check your connection and try again.`;
            terminalLogs.innerHTML += `<div class="log-line" style="color: red;">> Error: ${e.message}</div>`;
        }
    }

    // Trigger initial load after all functions are defined
    loadPopular();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}
