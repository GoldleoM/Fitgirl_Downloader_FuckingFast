import React from 'react';
import {
    Shapes,
    Crosshair,
    Sparkles,
    Ghost,
    Car,
    Swords,
    Puzzle,
    Flame,
    Network,
    User,
    Users,
    HardDrive,
    Zap,
    RotateCcw,
    Filter
} from 'lucide-react';

const GENRE_CHIPS = [
    { id: 'all', label: 'All Games', icon: Shapes },
    { id: 'action', label: 'Action & Shooter', icon: Crosshair },
    { id: 'rpg', label: 'RPG & Open World', icon: Sparkles },
    { id: 'horror', label: 'Horror & Survival', icon: Ghost },
    { id: 'racing', label: 'Racing & Sports', icon: Car },
    { id: 'strategy', label: 'Strategy & Sim', icon: Swords },
    { id: 'indie', label: 'Indie & Co-Op', icon: Puzzle },
    { id: 'anime', label: 'Anime & JRPG', icon: Flame }
];

export default function CategoryFilters({
    filters,
    setFilters,
    filteredCount,
    onReset
}) {
    const isAnyFilterActive = filters.genre !== 'all' || filters.mode !== 'all' || filters.size !== 'all' || filters.status !== 'all';

    return (
        <section className="category-section">
            {/* Genre Capsules Scroll Carousel */}
            <div className="category-chips-scroll-container">
                <div className="category-chips-wrapper">
                    {GENRE_CHIPS.map(chip => {
                        const IconComponent = chip.icon;
                        const isActive = filters.genre === chip.id;
                        return (
                            <button
                                key={chip.id}
                                className={`category-chip ${isActive ? 'active' : ''}`}
                                onClick={() => setFilters(prev => ({ ...prev, genre: chip.id }))}
                            >
                                <IconComponent size={14} />
                                {chip.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Sub-Filters Control Bar */}
            <div className="filter-controls-bar">
                <div className="filter-group">
                    <span className="filter-group-title"><Network size={13} /> Mode:</span>
                    <div className="pill-group">
                        <button
                            className={`filter-pill ${filters.mode === 'all' ? 'active' : ''}`}
                            onClick={() => setFilters(prev => ({ ...prev, mode: 'all' }))}
                        >
                            All
                        </button>
                        <button
                            className={`filter-pill ${filters.mode === 'offline' ? 'active' : ''}`}
                            onClick={() => setFilters(prev => ({ ...prev, mode: 'offline' }))}
                        >
                            <User size={12} /> Story / Offline
                        </button>
                        <button
                            className={`filter-pill ${filters.mode === 'online' ? 'active' : ''}`}
                            onClick={() => setFilters(prev => ({ ...prev, mode: 'online' }))}
                        >
                            <Users size={12} /> Online / Co-Op
                        </button>
                    </div>
                </div>

                <div className="filter-group">
                    <span className="filter-group-title"><HardDrive size={13} /> Size:</span>
                    <div className="pill-group">
                        <button
                            className={`filter-pill ${filters.size === 'all' ? 'active' : ''}`}
                            onClick={() => setFilters(prev => ({ ...prev, size: 'all' }))}
                        >
                            Any Size
                        </button>
                        <button
                            className={`filter-pill ${filters.size === 'under5' ? 'active' : ''}`}
                            onClick={() => setFilters(prev => ({ ...prev, size: 'under5' }))}
                        >
                            &lt; 5 GB
                        </button>
                        <button
                            className={`filter-pill ${filters.size === '5to20' ? 'active' : ''}`}
                            onClick={() => setFilters(prev => ({ ...prev, size: '5to20' }))}
                        >
                            5 – 20 GB
                        </button>
                        <button
                            className={`filter-pill ${filters.size === '20to50' ? 'active' : ''}`}
                            onClick={() => setFilters(prev => ({ ...prev, size: '20to50' }))}
                        >
                            20 – 50 GB
                        </button>
                        <button
                            className={`filter-pill ${filters.size === 'over50' ? 'active' : ''}`}
                            onClick={() => setFilters(prev => ({ ...prev, size: 'over50' }))}
                        >
                            50+ GB
                        </button>
                    </div>
                </div>

                <div className="filter-group">
                    <span className="filter-group-title"><Zap size={13} /> Status:</span>
                    <div className="pill-group">
                        <button
                            className={`filter-pill ${filters.status === 'all' ? 'active' : ''}`}
                            onClick={() => setFilters(prev => ({ ...prev, status: 'all' }))}
                        >
                            All
                        </button>
                        <button
                            className={`filter-pill pill-ready ${filters.status === 'ready' ? 'active' : ''}`}
                            onClick={() => setFilters(prev => ({ ...prev, status: 'ready' }))}
                        >
                            <Zap size={12} /> 1-Click Ready
                        </button>
                    </div>
                </div>

                {isAnyFilterActive && (
                    <button className="btn-clear-filters" onClick={onReset} title="Clear all active filters">
                        <RotateCcw size={12} /> Reset
                    </button>
                )}
            </div>

            {isAnyFilterActive && (
                <div className="filter-results-summary">
                    <span>
                        <Filter size={13} /> Category: <strong>{filters.genre.toUpperCase()}</strong> ({filteredCount} repacks matching active filters)
                    </span>
                </div>
            )}
        </section>
    );
}
