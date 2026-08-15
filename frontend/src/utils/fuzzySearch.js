import { CLIENT_ALIASES, CLIENT_TYPOS } from '../data/clientAliases.js';

export function normalizeClientText(str) {
    if (!str) return '';
    return str.toLowerCase()
              .replace(/['"’`\-_:;,\.!?\(\)\[\]/]/g, ' ')
              .replace(/\s+/g, ' ')
              .trim();
}

export function clientSimilarity(s1, s2) {
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

export function computeClientGameSimilarity(query, title) {
    const qNorm = normalizeClientText(query);
    const tNorm = normalizeClientText(title);
    if (!qNorm || !tNorm) return 0.0;
    if (tNorm.includes(qNorm)) return 1.0;

    const qWords = qNorm.split(' ').map(w => (CLIENT_TYPOS && CLIENT_TYPOS[w]) || w);
    const expandedQ = qWords.join(' ');
    const queryVariants = [qNorm, expandedQ];

    for (const [alias, full] of Object.entries(CLIENT_ALIASES || {})) {
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

export function getInstantLocalSuggestions(query, localGamesIndex = []) {
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
