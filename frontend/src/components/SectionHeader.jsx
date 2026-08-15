import React from 'react';
import { Flame, Clock } from 'lucide-react';

export default function SectionHeader({ title, currentMode, onSwitchMode, isSearching }) {
    return (
        <div className="section-header">
            <div className="section-title-wrap">
                <h2 id="catalogTitle">{title}</h2>
            </div>
            {!isSearching && (
                <div className="catalog-filters">
                    <button
                        className={`filter-btn ${currentMode === 'popular' ? 'active' : ''}`}
                        onClick={() => onSwitchMode('popular')}
                    >
                        <Flame size={15} />
                        <span>Top Repacks</span>
                    </button>
                    <button
                        className={`filter-btn ${currentMode === 'latest' ? 'active' : ''}`}
                        onClick={() => onSwitchMode('latest')}
                    >
                        <Clock size={15} />
                        <span>Latest Releases</span>
                    </button>
                </div>
            )}
        </div>
    );
}
