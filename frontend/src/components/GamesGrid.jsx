import React from 'react';
import { Gamepad2 } from 'lucide-react';
import GameCard from './GameCard';

export default function GamesGrid({ games, isLoading, onSelectGame }) {
    if (isLoading) {
        return (
            <div className="skeleton-grid">
                {Array.from({ length: 8 }).map((_, idx) => (
                    <div key={idx} className="skeleton-card">
                        <div className="skeleton-thumb shimmer"></div>
                        <div className="skeleton-line title shimmer"></div>
                        <div className="skeleton-line subtitle shimmer"></div>
                        <div className="skeleton-line btn shimmer"></div>
                    </div>
                ))}
            </div>
        );
    }

    if (!games || games.length === 0) {
        return (
            <div style={{ textAlign: 'center', padding: '4rem 1rem', color: 'var(--text-muted)' }}>
                <Gamepad2 size={42} style={{ marginBottom: '1rem', opacity: 0.5, color: 'var(--neon-cyan)' }} />
                <h3>No repacks found matching your search or filters</h3>
                <p style={{ marginTop: '0.5rem', fontSize: '0.9rem' }}>Try clearing your active filters or searching for another title.</p>
            </div>
        );
    }

    return (
        <section className="games-grid" id="gamesGrid">
            {games.map((game, idx) => (
                <GameCard
                    key={game.slug || game.url || idx}
                    game={game}
                    onSelect={onSelectGame}
                    style={{ animationDelay: `${Math.min(idx * 35, 500)}ms` }}
                />
            ))}
        </section>
    );
}
