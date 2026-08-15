import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Navbar from './components/Navbar';
import HeroBanner from './components/HeroBanner';
import SectionHeader from './components/SectionHeader';
import CategoryFilters from './components/CategoryFilters';
import GamesGrid from './components/GamesGrid';
import Pagination from './components/Pagination';
import GameModal from './components/GameModal';
import DownloadDrawer from './components/DownloadDrawer';
import Footer from './components/Footer';

import { apiFetch } from './utils/api';
import { getInstantLocalSuggestions } from './utils/fuzzySearch';
import { parseSizeInGB } from './utils/parser';
import { GENRE_KEYWORDS } from './data/genreKeywords';

export default function App() {
    // In-memory catalog index for 0ms instant fuzzy suggestions & local filtering
    const [localGamesIndex, setLocalGamesIndex] = useState([]);

    // View & Navigation State
    const [currentMode, setCurrentMode] = useState('popular'); // 'popular' | 'latest'
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [catalogGames, setCatalogGames] = useState([]);
    const [searchResults, setSearchResults] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    // Search State
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [suggestions, setSuggestions] = useState([]);
    const [isSuggestionsOpen, setIsSuggestionsOpen] = useState(false);
    const [activeSuggestionIdx, setActiveSuggestionIdx] = useState(-1);
    const suggestDebounceRef = useRef(null);

    // Filter State
    const [filters, setFilters] = useState({
        genre: 'all',
        mode: 'all',
        size: 'all',
        status: 'all'
    });
    const [filterPage, setFilterPage] = useState(1);

    // Modals & Drawers
    const [selectedGameModal, setSelectedGameModal] = useState(null);
    const [activeJobDrawer, setActiveJobDrawer] = useState(null);

    const isAnyFilterActive = filters.genre !== 'all' || filters.mode !== 'all' || filters.size !== 'all' || filters.status !== 'all';

    // 1. Ingest games into local index helper (without triggering fetch loops)
    const ingestGamesIntoIndex = useCallback((newGames) => {
        if (!newGames || newGames.length === 0) return;
        setLocalGamesIndex(prev => {
            let hasNew = false;
            const copy = [...prev];
            newGames.forEach(g => {
                const idx = copy.findIndex(existing => (existing.slug && existing.slug === g.slug) || existing.url === g.url);
                if (idx >= 0) {
                    copy[idx] = { ...copy[idx], ...g };
                } else {
                    hasNew = true;
                    copy.push(g);
                }
            });
            return hasNew ? copy : prev;
        });
    }, []);

    // 2. Pre-warm local catalog index (150 games) on mount & check for deep linked game
    useEffect(() => {
        let isMounted = true;
        const prewarm = async () => {
            try {
                const res = await apiFetch('/api/popular?page=1&per_page=150');
                const data = await res.json();
                if (isMounted && data.success && data.results && data.results.length > 0) {
                    ingestGamesIntoIndex(data.results);
                    
                    // Check if URL has ?game=slug or ?game=title
                    const params = new URLSearchParams(window.location.search);
                    const gameQuery = params.get('game');
                    if (gameQuery) {
                        const target = data.results.find(g => (g.slug && g.slug.toLowerCase() === gameQuery.toLowerCase()) || (g.title && g.title.toLowerCase().includes(gameQuery.toLowerCase())));
                        if (target) {
                            setSelectedGameModal(target);
                        } else {
                            // Fetch via search
                            const searchRes = await apiFetch(`/api/search?q=${encodeURIComponent(gameQuery)}`);
                            const searchData = await searchRes.json();
                            if (isMounted && searchData.success && searchData.results && searchData.results.length > 0) {
                                setSelectedGameModal(searchData.results[0]);
                            }
                        }
                    }
                }
            } catch (_) {}
        };
        prewarm();
        return () => { isMounted = false; };
    }, [ingestGamesIntoIndex]);

    // 2b. Sync URL & SEO Title with Selected Game Modal
    useEffect(() => {
        if (selectedGameModal) {
            document.title = `${selectedGameModal.title} — PC Requirements, Overview & Download | FitBoy PRO`;
            const currentUrl = new URL(window.location);
            const gameParam = selectedGameModal.slug || encodeURIComponent(selectedGameModal.title);
            if (currentUrl.searchParams.get('game') !== gameParam) {
                currentUrl.searchParams.set('game', gameParam);
                window.history.pushState({ game: gameParam }, '', currentUrl);
            }
        } else {
            document.title = 'FitBoy PRO — PC Game Library, Game Search & Download Tools';
            const currentUrl = new URL(window.location);
            if (currentUrl.searchParams.has('game')) {
                currentUrl.searchParams.delete('game');
                window.history.pushState({}, '', currentUrl.pathname + (currentUrl.search ? currentUrl.search : ''));
            }
        }
    }, [selectedGameModal]);

    // 2c. Support browser back/forward history for game modals
    useEffect(() => {
        const handlePopState = () => {
            const params = new URLSearchParams(window.location.search);
            const gameQuery = params.get('game');
            if (!gameQuery) {
                setSelectedGameModal(null);
            }
        };
        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, []);

    // 3. Filter evaluator
    const matchesFilters = useCallback((game) => {
        const titleLower = (game.title || '').toLowerCase();
        const excerptLower = (game.excerpt || '').toLowerCase();
        const combined = `${titleLower} ${excerptLower}`;

        // Genre
        if (filters.genre !== 'all') {
            const kws = GENRE_KEYWORDS[filters.genre] || [];
            const match = kws.some(kw => combined.includes(kw));
            if (!match) return false;
        }

        // Mode
        if (filters.mode === 'online') {
            const onlineKws = ['multiplayer', 'online', 'co-op', 'coop', 'mp with bots', 'pvp', 'lan', 'server'];
            if (!onlineKws.some(kw => combined.includes(kw))) return false;
        }

        // Size
        if (filters.size !== 'all') {
            const gb = parseSizeInGB(game);
            if (gb <= 0) return false;
            if (filters.size === 'under5' && gb >= 5.0) return false;
            if (filters.size === '5to20' && (gb < 5.0 || gb >= 20.0)) return false;
            if (filters.size === '20to50' && (gb < 20.0 || gb >= 50.0)) return false;
            if (filters.size === 'over50' && gb < 50.0) return false;
        }

        // Status (1-Click Ready)
        if (filters.status === 'ready') {
            const isReady = game.resolved && ((game.direct_links && game.direct_links.length > 0) || (game.direct_links_count && game.direct_links_count > 0));
            if (!isReady) return false;
        }

        return true;
    }, [filters]);

    // 4. Filtered games calculation
    const allFilteredGames = useMemo(() => {
        if (!isAnyFilterActive) return [];
        return localGamesIndex.filter(matchesFilters);
    }, [isAnyFilterActive, localGamesIndex, matchesFilters]);

    // Reset filter page when filters change
    useEffect(() => {
        setFilterPage(1);
    }, [filters]);

    // 5. Load Catalog (Popular or Latest)
    const loadCatalogData = useCallback(async (mode, page = 1) => {
        setIsLoading(true);
        try {
            if (mode === 'popular') {
                const res = await apiFetch(`/api/popular?page=${page}&per_page=16`);
                const data = await res.json();
                if (data.success && data.results) {
                    setCatalogGames(data.results);
                    setCurrentPage(data.page || page);
                    setTotalPages(data.total_pages || 1);
                    ingestGamesIntoIndex(data.results);
                } else {
                    setCatalogGames([]);
                }
            } else {
                const res = await apiFetch(`/api/catalog?page=${page}`);
                const data = await res.json();
                if (data.success && data.catalog) {
                    setCatalogGames(data.catalog);
                    setCurrentPage(page);
                    setTotalPages(10);
                    ingestGamesIntoIndex(data.catalog);
                } else {
                    setCatalogGames([]);
                }
            }
        } catch (err) {
            setCatalogGames([]);
        } finally {
            setIsLoading(false);
        }
    }, [ingestGamesIntoIndex]);

    // Initial Mount - load popular page 1
    useEffect(() => {
        loadCatalogData('popular', 1);
    }, [loadCatalogData]);

    // Handle Search Execution
    const handleSearch = useCallback(async (query) => {
        const trimmed = (query || '').trim();
        if (!trimmed) {
            setIsSearching(false);
            setSearchResults([]);
            return;
        }

        setIsSearching(true);
        setIsLoading(true);
        try {
            const res = await apiFetch(`/api/search?q=${encodeURIComponent(trimmed)}`);
            const data = await res.json();
            if (data.success && data.results) {
                setSearchResults(data.results);
                ingestGamesIntoIndex(data.results);
            } else {
                setSearchResults([]);
            }
        } catch (err) {
            setSearchResults([]);
        } finally {
            setIsLoading(false);
        }
    }, [ingestGamesIntoIndex]);

    // Handle Live Search Input for Suggestions
    useEffect(() => {
        const val = searchQuery.trim();
        if (val.length < 2) {
            setSuggestions([]);
            setIsSuggestionsOpen(false);
            return;
        }

        // 1. Instant local 0ms fuzzy suggestions
        const instantResults = getInstantLocalSuggestions(val, localGamesIndex);
        if (instantResults.length > 0) {
            setSuggestions(instantResults);
            setIsSuggestionsOpen(true);
            setActiveSuggestionIdx(-1);
        }

        // 2. Debounced remote background fallback if few local matches
        if (suggestDebounceRef.current) clearTimeout(suggestDebounceRef.current);
        if (instantResults.length < 4 && val.length >= 3) {
            suggestDebounceRef.current = setTimeout(async () => {
                try {
                    const res = await apiFetch(`/api/suggest?q=${encodeURIComponent(val)}`);
                    const data = await res.json();
                    if (data.success && data.suggestions && data.suggestions.length > 0) {
                        ingestGamesIntoIndex(data.suggestions);
                        const updated = getInstantLocalSuggestions(val, [...localGamesIndex, ...data.suggestions]);
                        if (updated.length > 0) {
                            setSuggestions(updated);
                            setIsSuggestionsOpen(true);
                        }
                    }
                } catch (_) {}
            }, 300);
        }
    }, [searchQuery, localGamesIndex, ingestGamesIntoIndex]);

    // Handle Suggestion Selection
    const handleSelectSuggestion = (item) => {
        setSearchQuery(item.title);
        setIsSuggestionsOpen(false);
        setSelectedGameModal(item);
    };

    // Navigation & Mode Switching
    const handleNavigateHome = () => {
        setSearchQuery('');
        setIsSearching(false);
        setSearchResults([]);
        setFilters({ genre: 'all', mode: 'all', size: 'all', status: 'all' });
        setCurrentMode('popular');
        loadCatalogData('popular', 1);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleSwitchMode = (mode) => {
        setCurrentMode(mode);
        setSearchQuery('');
        setIsSearching(false);
        setSearchResults([]);
        setFilters({ genre: 'all', mode: 'all', size: 'all', status: 'all' });
        loadCatalogData(mode, 1);
    };

    // Pagination Calculation
    const perPage = 16;
    const filterTotalPages = Math.ceil(allFilteredGames.length / perPage) || 1;

    const displayedGames = useMemo(() => {
        if (isSearching) {
            return searchResults;
        }
        if (isAnyFilterActive) {
            const startIdx = (filterPage - 1) * perPage;
            return allFilteredGames.slice(startIdx, startIdx + perPage);
        }
        return catalogGames;
    }, [isSearching, searchResults, isAnyFilterActive, allFilteredGames, filterPage, catalogGames]);

    const activeCurrentPage = isAnyFilterActive ? filterPage : currentPage;
    const activeTotalPages = isSearching ? 1 : (isAnyFilterActive ? filterTotalPages : totalPages);

    const handlePageChange = (page) => {
        if (isAnyFilterActive) {
            setFilterPage(page);
        } else if (!isSearching) {
            loadCatalogData(currentMode, page);
        }
        window.scrollTo({ top: 400, behavior: 'smooth' });
    };

    // Section Title Generator
    const sectionTitle = useMemo(() => {
        if (isSearching) {
            return <><i className="fa-solid fa-magnifying-glass text-neon"></i> Search Results for &ldquo;{searchQuery}&rdquo;</>;
        }
        if (isAnyFilterActive) {
            return <><i className="fa-solid fa-layer-group text-neon"></i> Filtered Repacks ({allFilteredGames.length} found)</>;
        }
        if (currentMode === 'popular') {
            return <><i className="fa-solid fa-fire text-neon"></i> Top Repacks of the Year (Page {currentPage})</>;
        }
        return <><i className="fa-solid fa-clock text-neon"></i> Latest Releases (Page {currentPage})</>;
    }, [isSearching, searchQuery, isAnyFilterActive, allFilteredGames.length, currentMode, currentPage]);

    const handleStartDownload = (title, url, links, slug) => {
        setSelectedGameModal(null);
        setActiveJobDrawer({ title, url, links, slug });
    };

    const handleGameUpdate = useCallback((updatedGame) => {
        if (!updatedGame) return;
        setCatalogGames(prev => prev.map(g => (g.slug === updatedGame.slug || g.url === updatedGame.url) ? { ...g, ...updatedGame } : g));
        setSearchResults(prev => prev.map(g => (g.slug === updatedGame.slug || g.url === updatedGame.url) ? { ...g, ...updatedGame } : g));
        setLocalGamesIndex(prev => prev.map(g => (g.slug === updatedGame.slug || g.url === updatedGame.url) ? { ...g, ...updatedGame } : g));
    }, []);

    return (
        <div className="app-root">
            {/* Ambient Animated Mesh Glow */}
            <div className="glow-bg">
                <div className="ambient-orb orb-1"></div>
                <div className="ambient-orb orb-2"></div>
                <div className="ambient-orb orb-3"></div>
                <div className="ambient-grid-overlay"></div>
            </div>

            {/* Navbar */}
            <Navbar
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                onSearch={handleSearch}
                onNavigateHome={handleNavigateHome}
                suggestions={suggestions}
                isSuggestionsOpen={isSuggestionsOpen}
                activeSuggestionIdx={activeSuggestionIdx}
                onSelectSuggestion={handleSelectSuggestion}
                onCloseSuggestions={() => setIsSuggestionsOpen(false)}
            />

            {/* Main Content */}
            <main className="app-container">
                <HeroBanner />

                <SectionHeader
                    title={sectionTitle}
                    currentMode={currentMode}
                    onSwitchMode={handleSwitchMode}
                    isSearching={isSearching}
                />

                <CategoryFilters
                    filters={filters}
                    setFilters={setFilters}
                    filteredCount={allFilteredGames.length}
                    onReset={() => setFilters({ genre: 'all', mode: 'all', size: 'all', status: 'all' })}
                />

                <GamesGrid
                    games={displayedGames}
                    isLoading={isLoading}
                    onSelectGame={(game) => setSelectedGameModal(game)}
                />

                {!isSearching && (
                    <Pagination
                        currentPage={activeCurrentPage}
                        totalPages={activeTotalPages}
                        onPageChange={handlePageChange}
                    />
                )}
            </main>

            {/* Footer */}
            <Footer onNavigateHome={handleNavigateHome} />

            {/* Game Details Modal */}
            <GameModal
                isOpen={!!selectedGameModal}
                game={selectedGameModal}
                onClose={() => setSelectedGameModal(null)}
                onStartDownload={handleStartDownload}
                onGameUpdate={handleGameUpdate}
            />

            {/* Download Progress Drawer */}
            <DownloadDrawer
                isOpen={!!activeJobDrawer}
                jobData={activeJobDrawer}
                onClose={() => setActiveJobDrawer(null)}
            />
        </div>
    );
}
