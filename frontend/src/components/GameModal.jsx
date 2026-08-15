import React, { useState, useEffect } from 'react';
import {
    X,
    HardDrive,
    Layers,
    Zap,
    Clock,
    CheckCircle2,
    AlertTriangle,
    Download,
    Copy,
    Check,
    ExternalLink,
    ShieldCheck,
    Server,
    FileText,
    ChevronDown,
    ChevronUp,
    Sparkles
} from 'lucide-react';
import { apiFetch, formatCoverUrl } from '../utils/api';

export default function GameModal({ isOpen, game, onClose, onStartDownload, onGameUpdate }) {
    const [fullGameData, setFullGameData] = useState(null);
    const [copied, setCopied] = useState(false);
    const [showRawLinks, setShowRawLinks] = useState(false);

    useEffect(() => {
        if (!isOpen || !game) {
            setFullGameData(null);
            setCopied(false);
            setShowRawLinks(false);
            return;
        }

        let isMounted = true;
        const fetchDetails = async () => {
            try {
                const param = game.slug ? `slug=${encodeURIComponent(game.slug)}` : `url=${encodeURIComponent(game.url)}`;
                const res = await apiFetch(`/api/game?${param}`);
                const data = await res.json();
                if (isMounted && data.success && data.game) {
                    setFullGameData(data.game);
                    if (onGameUpdate) {
                        onGameUpdate(data.game);
                    }
                }
            } catch (_) {}
        };

        fetchDetails();
        return () => { isMounted = false; };
    }, [isOpen, game]);

    // Handle Escape key to close modal
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen || !game) return null;

    const activeGame = fullGameData || game;
    const isResolved = activeGame.resolved;
    const directLinks = activeGame.direct_links || [];
    const directCount = directLinks.length || activeGame.direct_links_count || 0;
    const rawLinks = activeGame.fuckingfast_links || [];
    const partsCount = activeGame.parts_count || rawLinks.length || directCount;
    const repackSize = activeGame.repack_size || 'Repack';
    const coverUrl = formatCoverUrl(activeGame.cover);

    const handleCopyRawLinks = async () => {
        if (!rawLinks || rawLinks.length === 0) return;
        try {
            await navigator.clipboard.writeText(rawLinks.join('\n'));
            setCopied(true);
            setTimeout(() => setCopied(false), 2500);
        } catch (_) {}
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="game-hub-modal" onClick={(e) => e.stopPropagation()}>
                {/* Cinematic Ambient Backdrop */}
                <div
                    className="modal-ambient-backdrop"
                    style={{ backgroundImage: `url(${coverUrl})` }}
                >
                    <div className="modal-ambient-gradient"></div>
                </div>

                {/* Close Button */}
                <button className="hub-close-btn" onClick={onClose} title="Close (Esc)">
                    <X size={18} />
                </button>

                <div className="hub-modal-content">
                    {/* Left Column: 3D Poster & Quick Stats */}
                    <div className="hub-poster-column">
                        <div className="hub-poster-card">
                            <img
                                className="hub-poster-img"
                                src={coverUrl}
                                alt={activeGame.title}
                                onError={(e) => { e.target.onerror = null; e.target.src = '/placeholder.svg'; }}
                            />
                            <div className="hub-poster-glow"></div>
                        </div>

                        <div className="hub-specs-grid">
                            <div className="hub-spec-item">
                                <span className="spec-label"><HardDrive size={12} className="text-neon" /> Repack Size</span>
                                <span className="spec-val">{repackSize}</span>
                            </div>
                            <div className="hub-spec-item">
                                <span className="spec-label"><Layers size={12} /> Total Parts</span>
                                <span className="spec-val">{partsCount} Parts</span>
                            </div>
                            <div className="hub-spec-item">
                                <span className="spec-label"><Server size={12} /> Mirror Host</span>
                                <span className="spec-val">FuckingFast</span>
                            </div>
                            <div className="hub-spec-item">
                                <span className="spec-label"><ShieldCheck size={12} style={{ color: 'var(--neon-emerald)' }} /> Integrity</span>
                                <span className="spec-val">Lossless MD5</span>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Title, Alerts, Features & Actions Hub */}
                    <div className="hub-details-column">
                        {/* Title & Badges Header */}
                        <div className="hub-header-group">
                            <div className="hub-badges-row">
                                {isResolved ? (
                                    <span className="hub-badge-pill available">
                                        <Zap size={12} />
                                        <span>1-Click Ready</span>
                                    </span>
                                ) : (
                                    <span className="hub-badge-pill pending">
                                        <Clock size={12} />
                                        <span>Cloud Pending</span>
                                    </span>
                                )}
                                <span className="hub-badge-pill neutral">
                                    <Sparkles size={12} />
                                    <span>FitGirl Repack</span>
                                </span>
                            </div>

                            <h1 className="hub-game-title">{activeGame.title}</h1>
                        </div>

                        {/* Status Alert Banner */}
                        {isResolved ? (
                            <div className="hub-status-banner available">
                                <div className="hub-status-icon">
                                    <CheckCircle2 size={22} />
                                </div>
                                <div className="hub-status-text">
                                    <h4>1-Click Instant Download Ready</h4>
                                    <p>Direct download links ({directCount} parts) are verified in the cloud database. Download instantly with full multithreaded speed.</p>
                                </div>
                            </div>
                        ) : (
                            <div className="hub-status-banner pending">
                                <div className="hub-status-icon">
                                    <AlertTriangle size={22} />
                                </div>
                                <div className="hub-status-text">
                                    <h4>Direct Links Not Cached in Cloud Vault</h4>
                                    <p>Direct links are not cached in the cloud database yet. Download the standalone <strong>Local EXE Extractor</strong> to resolve all links instantly on your PC.</p>
                                </div>
                            </div>
                        )}

                        {/* Repack Highlights */}
                        <div className="hub-section">
                            <h4 className="hub-section-title">Repack Features</h4>
                            <ul className="hub-feature-list">
                                <li>Multi-part archive hosted on ultra-fast FuckingFast CDN mirrors</li>
                                <li>100% Lossless &amp; MD5 Perfect: identical to original game files after install</li>
                                <li>Seamless batch import for Free Download Manager, JDownloader 2, and IDM</li>
                                <li>Auto-clipboard copy &amp; <code>download_links.txt</code> export</li>
                            </ul>
                        </div>

                        {/* Action Buttons Hub */}
                        <div className="hub-actions-container">
                            {isResolved ? (
                                <button
                                    className="hub-btn-primary"
                                    onClick={() => onStartDownload(activeGame.title, activeGame.url, directLinks, activeGame.slug)}
                                >
                                    <Download size={18} />
                                    <span>1-Click Download ({directCount} Parts)</span>
                                </button>
                            ) : (
                                <a
                                    href="https://github.com/GoldleoM/Fitgirl_Local_Link_Extractor/releases/download/v1.0.1/FitGirl_Link_Extractor.exe"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="hub-btn-primary"
                                    title="Download Standalone Windows .EXE Link Extractor"
                                >
                                    <Download size={18} />
                                    <span>Download Local EXE Extractor</span>
                                </a>
                            )}

                            {rawLinks.length > 0 && (
                                <button className="hub-btn-secondary" onClick={handleCopyRawLinks}>
                                    {copied ? <Check size={16} style={{ color: 'var(--neon-emerald)' }} /> : <Copy size={16} />}
                                    <span>{copied ? 'Copied to Clipboard!' : `Copy Raw Links (${rawLinks.length})`}</span>
                                </button>
                            )}

                            {isResolved && (
                                <a
                                    href="https://github.com/GoldleoM/Fitgirl_Local_Link_Extractor/releases/download/v1.0.1/FitGirl_Link_Extractor.exe"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="hub-btn-secondary"
                                    title="Download Standalone Windows .EXE Link Extractor"
                                >
                                    <Download size={15} />
                                    <span>Local EXE</span>
                                </a>
                            )}

                            {activeGame.url && (
                                <a
                                    href={activeGame.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="hub-btn-secondary"
                                    title="View original FitGirl Repacks release post"
                                >
                                    <ExternalLink size={15} />
                                    <span>FitGirl Site</span>
                                </a>
                            )}
                        </div>

                        {/* Optional Raw Mirror Links Viewer */}
                        {rawLinks.length > 0 && (
                            <div className="hub-raw-links-section">
                                <button
                                    className="hub-toggle-links-btn"
                                    onClick={() => setShowRawLinks(!showRawLinks)}
                                >
                                    <FileText size={14} />
                                    <span>{showRawLinks ? 'Hide Raw Mirror Links' : `View ${rawLinks.length} Raw Mirror Links`}</span>
                                    {showRawLinks ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                </button>

                                {showRawLinks && (
                                    <div className="hub-links-drawer">
                                        {rawLinks.map((link, idx) => (
                                            <div key={idx} className="raw-link-row">
                                                <span className="link-num">#{idx + 1}</span>
                                                <a href={link} target="_blank" rel="noopener noreferrer" className="link-url">
                                                    {link}
                                                </a>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
