import React, { useRef, useEffect } from 'react';
import { Zap, Search, X, ArrowRight, Database, Heart } from 'lucide-react';
import SearchSuggestions from './SearchSuggestions';

export default function Navbar({
    searchQuery,
    setSearchQuery,
    onSearch,
    onNavigateHome,
    suggestions,
    isSuggestionsOpen,
    activeSuggestionIdx,
    onSelectSuggestion,
    onCloseSuggestions,
    onOpenDonate
}) {
    const searchInputRef = useRef(null);
    const searchBoxRef = useRef(null);

    // Global keyboard shortcut (Ctrl+K or /)
    useEffect(() => {
        const handleKeyDown = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                searchInputRef.current?.focus();
                searchInputRef.current?.select();
            } else if (e.key === '/' && document.activeElement !== searchInputRef.current && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
                e.preventDefault();
                searchInputRef.current?.focus();
                searchInputRef.current?.select();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Dismiss suggestions on click outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (searchBoxRef.current && !searchBoxRef.current.contains(e.target)) {
                onCloseSuggestions();
            }
        };

        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, [onCloseSuggestions]);

    const handleClear = () => {
        setSearchQuery('');
        onCloseSuggestions();
        onNavigateHome();
        searchInputRef.current?.focus();
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (isSuggestionsOpen && activeSuggestionIdx >= 0 && suggestions[activeSuggestionIdx]) {
                onSelectSuggestion(suggestions[activeSuggestionIdx]);
            } else {
                onCloseSuggestions();
                onSearch(searchQuery);
            }
        } else if (e.key === 'Escape') {
            onCloseSuggestions();
        }
    };

    return (
        <header className="navbar">
            <div className="logo-container" onClick={onNavigateHome} title="Back to Popular Repacks (Home)">
                <div className="logo-icon-wrapper">
                    <div className="logo-icon">
                        <Zap size={22} className="text-white fill-white" />
                    </div>
                    <span className="logo-pulse"></span>
                </div>
                <div className="logo-text">
                    <span className="brand-title">FIT<span className="highlight">BOY</span> <span className="brand-badge">PRO</span></span>
                    <span className="brand-sub">HIGH-SPEED REPACK VAULT</span>
                </div>
            </div>

            {/* Command-Bar Style Search Box */}
            <div className="search-box" ref={searchBoxRef}>
                <Search className="search-icon" size={17} />
                <input
                    ref={searchInputRef}
                    type="text"
                    id="searchInput"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Search repacks... (e.g. Wukong, Cyberpunk, GTA V, Elden Ring)"
                    autoComplete="off"
                    spellCheck="false"
                />
                <div className="search-actions">
                    {searchQuery.trim().length > 0 && (
                        <button className="search-clear-btn" onClick={handleClear} title="Clear search">
                            <X size={14} />
                        </button>
                    )}
                    <kbd className="search-shortcut-hint" title="Press Ctrl+K or / to search">Ctrl K</kbd>
                    <button className="btn-search" onClick={() => { onCloseSuggestions(); onSearch(searchQuery); }}>
                        <span>Search</span>
                        <ArrowRight size={14} />
                    </button>
                </div>

                {isSuggestionsOpen && suggestions.length > 0 && (
                    <SearchSuggestions
                        suggestions={suggestions}
                        activeIdx={activeSuggestionIdx}
                        onSelect={onSelectSuggestion}
                    />
                )}
            </div>

            {/* Status Badges, Support Button & GitHub Link */}
            <div className="nav-status-group">
                <button
                    className="nav-support-btn"
                    onClick={onOpenDonate}
                    title="Support FitBoy PRO & Cloud Infrastructure"
                >
                    <Heart size={14} className="fill-current" />
                    <span>Support</span>
                </button>

                <div className="fdm-status-badge">
                    <div className="status-pulse-dot"></div>
                    <Database size={13} />
                    <span>Cloud Vault Ready</span>
                </div>
                <a
                    href="https://github.com/GoldleoM/Fitgirl_Downloader_FuckingFast"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="nav-github-link"
                    title="View GitHub Repository & Source"
                >
                    <i className="fa-brands fa-github"></i>
                    <span>GitHub</span>
                </a>
            </div>
        </header>
    );
}
