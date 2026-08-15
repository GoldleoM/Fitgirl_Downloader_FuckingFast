export function parseSizeInGB(game) {
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
