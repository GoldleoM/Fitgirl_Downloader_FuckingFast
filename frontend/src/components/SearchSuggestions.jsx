import React from 'react';
import { HardDrive, Layers, Zap, Cloud, Keyboard } from 'lucide-react';
import { formatCoverUrl } from '../utils/api';

export default function SearchSuggestions({ suggestions, activeIdx, onSelect }) {
    return (
        <div className="search-suggestions" id="searchSuggestions">
            {suggestions.map((item, idx) => {
                const isResolved = item.resolved;
                const badgeClass = isResolved ? 'available' : 'unavailable';
                const badgeText = isResolved ? '1-Click Ready' : 'Repack';
                const coverUrl = formatCoverUrl(item.cover);
                const isActive = idx === activeIdx;

                return (
                    <div
                        key={item.slug || item.url || idx}
                        className={`suggestion-item ${isActive ? 'active' : ''}`}
                        onClick={() => onSelect(item)}
                    >
                        <img
                            className="suggestion-thumb"
                            src={coverUrl}
                            alt={item.title}
                            onError={(e) => { e.target.onerror = null; e.target.src = '/placeholder.svg'; }}
                        />
                        <div className="suggestion-info">
                            <div className="suggestion-title" title={item.title}>
                                {item.title}
                            </div>
                            <div className="suggestion-meta">
                                <span><HardDrive size={12} /> {item.repack_size || 'N/A'}</span>
                                <span><Layers size={12} /> {item.parts_count || (item.fuckingfast_links ? item.fuckingfast_links.length : 0)} Parts</span>
                            </div>
                        </div>
                        <span className={`suggestion-badge ${badgeClass}`}>
                            {isResolved ? <Zap size={11} /> : <Cloud size={11} />}
                            {badgeText}
                        </span>
                    </div>
                );
            })}
            <div className="suggestion-footer-tip">
                <span><Keyboard size={12} /> Use ↑↓ to navigate</span>
                <span>Press <strong>Enter ↵</strong> to search all</span>
            </div>
        </div>
    );
}
