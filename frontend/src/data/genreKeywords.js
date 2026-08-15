export const GENRE_KEYWORDS = {
    action: ['action', 'shooter', 'fps', 'combat', 'war', 'battle', 'sniper', 'doom', 'crisis', 'stealth', 'assassin', 'strike', 'gun', 'kill', 'fight', 'soldier', 'duty'],
    rpg: ['rpg', 'role playing', 'open world', 'witcher', 'elder scrolls', 'skyrim', 'souls', 'elden', 'baldurs', 'cyberpunk', 'fantasy', 'dragon', 'horizon', 'quest', 'fallout', 'starfield', 'persona', 'final fantasy', 'tales'],
    horror: ['horror', 'resident evil', 'silent hill', 'dead', 'survival', 'zombie', 'scary', 'amnesia', 'outlast', 'ghost', 'evil', 'fear', 'nightmare', 'phasmophobia', 'mortuary', 'soma', 'visage', 'fnaf'],
    racing: ['racing', 'race', 'car', 'drive', 'speed', 'forza', 'nfs', 'dirt', 'rally', 'motorsport', 'beamng', 'fifa', 'nba', 'wwe', 'pes', 'football', 'sports', 'f1', 'crew', 'assetto', 'grid'],
    strategy: ['strategy', 'sim', 'simulation', 'manager', 'rts', 'civilization', 'empires', 'warcraft', 'starcraft', 'total war', 'tactics', 'tycoon', 'city', 'cities', 'crusader', 'age of', 'command'],
    indie: ['indie', 'platformer', 'rogue', 'pixel', 'co-op', 'coop', 'puzzle', 'hades', 'hollow', 'stardew', 'cuphead', 'celeste', 'lethal', 'craft', 'undertale', 'balatro', 'terraria', 'binding', 'palworld'],
    anime: ['anime', 'jrpg', 'dragon ball', 'naruto', 'one piece', 'persona', 'final fantasy', 'genshin', 'sekiro', 'wukong', 'storm', 'tales', 'atelier', 'ys ', 'sword art', 'guilty gear', 'tekken', 'street fighter'],
    adult: ['adult', 'erotic', 'hentai', 'nudity', 'sexual content', 'nsfw', 'ecchi', '18+', 'lewd', 'succubus', 'subverse', 'h-game', 'waifu', 'dating sim', 'being a dik', 'lust', 'honey select', 'house party', 'koikatsu', 'treasure of nadia', 'freshwomen', 'freshwoman', 'harem', 'porn', 'uncensored', 'milf', 'fetish', 'sensual']
};

export const ADULT_KEYWORDS = GENRE_KEYWORDS.adult;

export function isAdultGame(game) {
    if (!game) return false;
    const title = (game.title || '').toLowerCase();
    const genres = (game.genres || '').toLowerCase();
    const excerpt = (game.excerpt || '').toLowerCase();
    const slug = (game.slug || '').toLowerCase();
    const combined = `${title} ${genres} ${excerpt} ${slug}`;
    return ADULT_KEYWORDS.some(kw => combined.includes(kw));
}
