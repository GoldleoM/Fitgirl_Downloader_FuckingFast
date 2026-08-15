import React from 'react';
import { Zap, Clock, HardDrive, CheckCircle2, Eye, ExternalLink, Flame } from 'lucide-react';
import { formatCoverUrl } from '../utils/api';

export default function GameCard({ game, onSelect, style }) {
    const isResolved = game.resolved;
    const isRequested = !isResolved && Boolean(game.requested);
    
    let badgeClass = 'badge-unavailable';
    let badgeIcon = <Clock size={12} />;
    let badgeText = 'Links Pending';

    if (isResolved) {
        badgeClass = 'badge-available';
        badgeIcon = <CheckCircle2 size={12} />;
        badgeText = '1-Click Ready';
    } else if (isRequested) {
        badgeClass = 'badge-priority';
        badgeIcon = <Flame size={12} />;
        badgeText = 'Priority Queued';
    }

    const btnText = isResolved ? 'Instant Download' : (isRequested ? 'Priority In Queue' : 'View Details');
    const btnIcon = isResolved ? <Zap size={14} /> : (isRequested ? <Flame size={14} /> : <Eye size={14} />);

    const coverUrl = formatCoverUrl(game.cover);

    const handleCardClick = (e) => {
        if (e.target.closest('.btn-fitgirl')) return;
        onSelect(game);
    };

    return (
        <article className="game-card" onClick={handleCardClick} style={style}>
            <div className="card-poster-wrap">
                <img
                    className="card-poster"
                    src={coverUrl}
                    alt={game.title}
                    loading="lazy"
                    onError={(e) => { e.target.onerror = null; e.target.src = '/placeholder.svg'; }}
                />
                <div className="card-poster-vignette"></div>
            </div>
            <div className="card-content">
                <h3 className="card-title" title={game.title}>
                    {game.title}
                </h3>
                <div className="card-meta-row">
                    <span className="card-date">
                        <HardDrive size={13} className="text-neon" />
                        {game.repack_size || 'Repack'}
                    </span>
                    <span className={`badge-status ${badgeClass}`}>
                        {badgeIcon}
                        <span>{badgeText}</span>
                    </span>
                </div>
                <div className="card-footer">
                    <button
                        className={`btn-get ${isResolved ? 'btn-instant' : 'btn-details'}`}
                        onClick={() => onSelect(game)}
                    >
                        {btnIcon}
                        <span>{btnText}</span>
                    </button>
                    {game.url && (
                        <a
                            href={game.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn-fitgirl"
                            title="Open original FitGirl post"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <ExternalLink size={12} />
                            <span>FitGirl</span>
                        </a>
                    )}
                </div>
            </div>
        </article>
    );
}
