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
    ChevronLeft,
    ChevronRight,
    Sparkles,
    Image as ImageIcon,
    BookOpen,
    Building2,
    Languages,
    Tag,
    Cpu,
    Flame,
    Loader2,
    Monitor,
    ShieldAlert
} from 'lucide-react';
import { apiFetch, formatCoverUrl } from '../utils/api';
import { isAdultGame } from '../data/genreKeywords';
import { POPULAR_CATALOG } from '../data/popularCatalog';

export default function GameModal({ isOpen, game, onClose, onStartDownload, onGameUpdate }) {
    const [fullGameData, setFullGameData] = useState(null);
    const [copied, setCopied] = useState(false);
    const [showRawLinks, setShowRawLinks] = useState(false);
    const [activeScreenshotIdx, setActiveScreenshotIdx] = useState(0);
    const [isLightboxOpen, setIsLightboxOpen] = useState(false);
    const [isRequesting, setIsRequesting] = useState(false);
    const [requestSuccess, setRequestSuccess] = useState(false);
    const [specTab, setSpecTab] = useState('minimum');

    useEffect(() => {
        if (!isOpen || !game) {
            setFullGameData(null);
            setCopied(false);
            setShowRawLinks(false);
            setActiveScreenshotIdx(0);
            setIsLightboxOpen(false);
            setIsRequesting(false);
            setRequestSuccess(false);
            return;
        }

        // 1. Instant 0ms lookup from pre-warmed rich catalog containing full Steam PC specs
        const cached = POPULAR_CATALOG && POPULAR_CATALOG.find(g => 
            (game.slug && g.slug === game.slug) || 
            (game.url && g.url === game.url) || 
            (game.title && g.title.toLowerCase() === game.title.toLowerCase())
        );
        if (cached) {
            setFullGameData(cached);
        }

        let isMounted = true;
        const fetchDetails = async () => {
            try {
                const param = game.slug ? `slug=${encodeURIComponent(game.slug)}` : `url=${encodeURIComponent(game.url)}`;
                const res = await apiFetch(`/api/game?${param}`);
                const data = await res.json();
                if (isMounted && data.success && data.game) {
                    setFullGameData(prev => {
                        const baseReqs = cached?.requirements || prev?.requirements || {};
                        const incomingReqs = data.game.requirements || {};
                        const mergedReqs = {
                            ...baseReqs,
                            ...incomingReqs,
                            minimum: (incomingReqs.minimum?.graphics || incomingReqs.minimum?.processor) ? incomingReqs.minimum : (baseReqs.minimum || {}),
                            recommended: (incomingReqs.recommended?.graphics || incomingReqs.recommended?.processor) ? incomingReqs.recommended : (baseReqs.recommended || {})
                        };
                        return {
                            ...(cached || {}),
                            ...(prev || {}),
                            ...data.game,
                            requirements: mergedReqs
                        };
                    });
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
                if (isLightboxOpen) {
                    setIsLightboxOpen(false);
                } else {
                    onClose();
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, isLightboxOpen, onClose]);

    if (!isOpen || !game) return null;

    const activeGame = fullGameData || game;
    const isResolved = activeGame.resolved;
    const directLinks = activeGame.direct_links || [];
    const directCount = directLinks.length || activeGame.direct_links_count || 0;
    const rawLinks = activeGame.fuckingfast_links || [];
    const partsCount = activeGame.parts_count || rawLinks.length || directCount;
    const repackSize = activeGame.repack_size || 'Repack';
    const originalSize = activeGame.original_size || '';
    const coverUrl = formatCoverUrl(activeGame.cover);
    const screenshots = (activeGame.screenshots || []).map(formatCoverUrl).filter(Boolean);
    const description = activeGame.description || '';
    const genres = activeGame.genres || '';
    const companies = activeGame.companies || '';
    const languages = activeGame.languages || '';
    const features = activeGame.features || [];
    const requirements = activeGame.requirements || {};

    const isRequested = activeGame.requested || requestSuccess;
    const requestCount = (activeGame.request_count || 0) + (requestSuccess && !activeGame.requested ? 1 : 0);

    const handleRequestGame = async () => {
        if (isRequesting || isRequested) return;
        setIsRequesting(true);
        try {
            const res = await apiFetch('/api/request_game', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    slug: activeGame.slug,
                    title: activeGame.title,
                    url: activeGame.url
                })
            });
            const data = await res.json();
            if (data.success) {
                setRequestSuccess(true);
                const updatedGame = {
                    ...activeGame,
                    requested: true,
                    request_count: (activeGame.request_count || 0) + 1
                };
                setFullGameData(updatedGame);
                if (onGameUpdate) {
                    onGameUpdate(updatedGame);
                }
            }
        } catch (err) {
            console.error('Request failed:', err);
        } finally {
            setIsRequesting(false);
        }
    };

    const handleCopyRawLinks = async () => {
        if (!rawLinks || rawLinks.length === 0) return;
        try {
            await navigator.clipboard.writeText(rawLinks.join('\n'));
            setCopied(true);
            setTimeout(() => setCopied(false), 2500);
        } catch (_) {}
    };

    const nextScreenshot = () => {
        if (screenshots.length > 0) {
            setActiveScreenshotIdx((prev) => (prev + 1) % screenshots.length);
        }
    };

    const prevScreenshot = () => {
        if (screenshots.length > 0) {
            setActiveScreenshotIdx((prev) => (prev - 1 + screenshots.length) % screenshots.length);
        }
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
                    {/* Left Column: 3D Poster & Quick Specs */}
                    <div className="hub-poster-column">
                        <div className="hub-poster-card">
                            <img
                                className="hub-poster-img"
                                src={coverUrl}
                                alt={activeGame.title}
                                referrerPolicy="no-referrer"
                                onError={(e) => { e.target.onerror = null; e.target.src = '/placeholder.svg'; }}
                            />
                            <div className="hub-poster-glow"></div>
                        </div>

                        <div className="hub-specs-grid">
                            <div className="hub-spec-item">
                                <span className="spec-label"><HardDrive size={12} className="text-neon" /> Repack Size</span>
                                <span className="spec-val highlight-emerald">{repackSize}</span>
                            </div>
                            {originalSize && originalSize !== 'N/A' && (
                                <div className="hub-spec-item">
                                    <span className="spec-label"><Layers size={12} /> Original Size</span>
                                    <span className="spec-val strike-muted">{originalSize}</span>
                                </div>
                            )}
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

                    {/* Right Column: Details, Screenshots, Description & Actions */}
                    <div className="hub-details-column">
                        {/* Title & Badges Header */}
                        <div className="hub-header-group">
                            <div className="hub-badges-row">
                                {isResolved ? (
                                    <span className="hub-badge-pill available">
                                        <Zap size={12} />
                                        <span>1-Click Ready</span>
                                    </span>
                                ) : isRequested ? (
                                    <span className="hub-badge-pill priority">
                                        <Flame size={12} />
                                        <span>Priority Queued</span>
                                    </span>
                                ) : (
                                    <span className="hub-badge-pill pending">
                                        <Clock size={12} />
                                        <span>Links Pending</span>
                                    </span>
                                )}
                                {isAdultGame(activeGame) && (
                                    <span className="hub-badge-pill adult-badge" title="Mature 18+ Content">
                                        <ShieldAlert size={12} />
                                        <span>🔞 18+ Adult</span>
                                    </span>
                                )}
                                <span className="hub-badge-pill neutral">
                                    <Sparkles size={12} />
                                    <span>FitGirl Repack</span>
                                </span>
                            </div>

                            <h1 className="hub-game-title">{activeGame.title}</h1>

                            {/* Tags & Developer Info Row */}
                            {(genres || companies) && (
                                <div className="hub-meta-tags-row">
                                    {companies && (
                                        <span className="hub-meta-pill" title="Developer / Publisher">
                                            <Building2 size={12} className="text-cyan" />
                                            <span>{companies}</span>
                                        </span>
                                    )}
                                    {genres && (
                                        <span className="hub-meta-pill" title="Genres / Tags">
                                            <Tag size={12} className="text-purple" />
                                            <span>{genres}</span>
                                        </span>
                                    )}
                                    {languages && (
                                        <span className="hub-meta-pill" title="Supported Languages">
                                            <Languages size={12} className="text-pink" />
                                            <span>{languages}</span>
                                        </span>
                                    )}
                                </div>
                            )}
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
                        ) : isRequested ? (
                            <div className="hub-status-banner priority">
                                <div className="hub-status-icon">
                                    <Flame size={22} className="text-amber" />
                                </div>
                                <div className="hub-status-text">
                                    <h4>🎯 In Priority Link Resolution Queue</h4>
                                    <p>This game has been placed into the high-priority queue ({requestCount} request{requestCount !== 1 ? 's' : ''}). The automated scraper is scheduled to extract these direct download links first!</p>
                                </div>
                            </div>
                        ) : (
                            <div className="hub-status-banner pending">
                                <div className="hub-status-icon">
                                    <AlertTriangle size={22} />
                                </div>
                                <div className="hub-status-text">
                                    <h4>Direct Links Not Cached in Cloud Vault</h4>
                                    <p>Direct links are not cached in the cloud database yet. Click <strong>Request Direct Links</strong> to prioritize this game, or download the <strong>Local EXE Extractor</strong> to resolve immediately on your PC.</p>
                                </div>
                            </div>
                        )}

                        {/* Gameplay Screenshots Gallery */}
                        {screenshots.length > 0 && (
                            <div className="hub-section screenshots-section">
                                <div className="hub-section-header-row">
                                    <h4 className="hub-section-title">
                                        <ImageIcon size={15} className="text-neon" />
                                        <span>Gameplay Screenshots ({screenshots.length})</span>
                                    </h4>
                                    <span className="screenshots-counter">{activeScreenshotIdx + 1} / {screenshots.length}</span>
                                </div>

                                <div className="screenshot-main-viewport">
                                    <img
                                        src={screenshots[activeScreenshotIdx]}
                                        alt={`${activeGame.title} screenshot ${activeScreenshotIdx + 1}`}
                                        className="screenshot-main-img"
                                        referrerPolicy="no-referrer"
                                        onClick={() => setIsLightboxOpen(true)}
                                        title="Click to expand"
                                        onError={(e) => { e.target.style.display = 'none'; }}
                                    />
                                    {screenshots.length > 1 && (
                                        <>
                                            <button className="screenshot-nav-btn prev" onClick={prevScreenshot} title="Previous Screenshot">
                                                <ChevronLeft size={20} />
                                            </button>
                                            <button className="screenshot-nav-btn next" onClick={nextScreenshot} title="Next Screenshot">
                                                <ChevronRight size={20} />
                                            </button>
                                        </>
                                    )}
                                </div>

                                {screenshots.length > 1 && (
                                    <div className="screenshot-thumbnails-strip">
                                        {screenshots.map((s, idx) => (
                                            <button
                                                key={idx}
                                                className={`screenshot-thumb-btn ${idx === activeScreenshotIdx ? 'active' : ''}`}
                                                onClick={() => setActiveScreenshotIdx(idx)}
                                            >
                                                <img src={s} alt={`Thumb ${idx + 1}`} referrerPolicy="no-referrer" onError={(e) => { e.target.style.display = 'none'; }} />
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Game Description & Overview */}
                        {description && (
                            <div className="hub-section description-section">
                                <h4 className="hub-section-title">
                                    <BookOpen size={15} className="text-cyan" />
                                    <span>About the Game</span>
                                </h4>
                                <div className="hub-description-box">
                                    <p className="hub-description-text">{description}</p>
                                </div>
                            </div>
                        )}

                        {/* Repack Highlights */}
                        <div className="hub-section">
                            <h4 className="hub-section-title">Repack Features</h4>
                            <ul className="hub-feature-list">
                                {features.length > 0 ? (
                                    features.map((feat, idx) => <li key={idx}>{feat}</li>)
                                ) : (
                                    <>
                                        <li>Multi-part archive hosted on ultra-fast FuckingFast CDN mirrors</li>
                                        <li>100% Lossless &amp; MD5 Perfect: identical to original game files after install</li>
                                        <li>Seamless batch import for Free Download Manager, JDownloader 2, and IDM</li>
                                        <li>Auto-clipboard copy &amp; <code>download_links.txt</code> export</li>
                                    </>
                                )}
                            </ul>
                        </div>

                        {/* Official PC System Requirements 2-Column Board (Minimum & Recommended) */}
                        {(requirements.minimum?.graphics || requirements.recommended?.graphics || requirements.minimum?.processor || requirements.recommended?.processor || requirements.ram || requirements.hdd) && (
                            <div className="hub-section steam-specs-board">
                                <div className="steam-specs-header">
                                    <h4 className="steam-specs-title">SYSTEM REQUIREMENTS</h4>
                                </div>

                                <div className="steam-specs-columns-grid">
                                    {/* Left Column: MINIMUM */}
                                    <div className="steam-specs-col">
                                        <h5 className="specs-col-heading">MINIMUM:</h5>
                                        <ul className="specs-entries-list">
                                            {requirements.minimum?.os && (
                                                <li><strong>OS:</strong> <span>{requirements.minimum.os}</span></li>
                                            )}
                                            {requirements.minimum?.processor && (
                                                <li><strong>Processor:</strong> <span>{requirements.minimum.processor}</span></li>
                                            )}
                                            {requirements.minimum?.memory && (
                                                <li><strong>Memory:</strong> <span>{requirements.minimum.memory}</span></li>
                                            )}
                                            {requirements.minimum?.graphics && (
                                                <li><strong>Graphics:</strong> <span>{requirements.minimum.graphics}</span></li>
                                            )}
                                            {requirements.minimum?.directx && (
                                                <li><strong>DirectX:</strong> <span>{requirements.minimum.directx}</span></li>
                                            )}
                                            {requirements.minimum?.storage && (
                                                <li><strong>Storage:</strong> <span>{requirements.minimum.storage}</span></li>
                                            )}
                                            {requirements.minimum?.['sound card'] && (
                                                <li><strong>Sound Card:</strong> <span>{requirements.minimum['sound card']}</span></li>
                                            )}
                                            {requirements.minimum?.['additional notes'] && (
                                                <li><strong>Additional Notes:</strong> <span>{requirements.minimum['additional notes']}</span></li>
                                            )}
                                            {!requirements.minimum?.graphics && requirements.ram && (
                                                <li><strong>Memory:</strong> <span>{requirements.ram}</span></li>
                                            )}
                                            {!requirements.minimum?.graphics && requirements.hdd && (
                                                <li><strong>Storage:</strong> <span>{requirements.hdd}</span></li>
                                            )}
                                        </ul>
                                    </div>

                                    {/* Right Column: RECOMMENDED */}
                                    <div className="steam-specs-col">
                                        <h5 className="specs-col-heading">RECOMMENDED:</h5>
                                        <ul className="specs-entries-list">
                                            {requirements.recommended?.os && (
                                                <li><strong>OS:</strong> <span>{requirements.recommended.os}</span></li>
                                            )}
                                            {requirements.recommended?.processor && (
                                                <li><strong>Processor:</strong> <span>{requirements.recommended.processor}</span></li>
                                            )}
                                            {requirements.recommended?.memory && (
                                                <li><strong>Memory:</strong> <span>{requirements.recommended.memory}</span></li>
                                            )}
                                            {requirements.recommended?.graphics && (
                                                <li><strong>Graphics:</strong> <span>{requirements.recommended.graphics}</span></li>
                                            )}
                                            {requirements.recommended?.directx && (
                                                <li><strong>DirectX:</strong> <span>{requirements.recommended.directx}</span></li>
                                            )}
                                            {requirements.recommended?.storage && (
                                                <li><strong>Storage:</strong> <span>{requirements.recommended.storage}</span></li>
                                            )}
                                            {requirements.recommended?.['sound card'] && (
                                                <li><strong>Sound Card:</strong> <span>{requirements.recommended['sound card']}</span></li>
                                            )}
                                            {requirements.recommended?.['additional notes'] && (
                                                <li><strong>Additional Notes:</strong> <span>{requirements.recommended['additional notes']}</span></li>
                                            )}
                                            {!requirements.recommended?.graphics && requirements.ram && (
                                                <li><strong>Memory:</strong> <span>{requirements.ram}</span></li>
                                            )}
                                            {!requirements.recommended?.graphics && requirements.hdd && (
                                                <li><strong>Storage:</strong> <span>{requirements.hdd}</span></li>
                                            )}
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        )}

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
                            ) : isRequested ? (
                                <button
                                    className="hub-btn-priority-active"
                                    disabled
                                    title="This game is in the high priority resolution queue"
                                >
                                    <Flame size={18} />
                                    <span>In Priority Queue ({requestCount} Request{requestCount !== 1 ? 's' : ''})</span>
                                </button>
                            ) : (
                                <button
                                    className="hub-btn-request"
                                    onClick={handleRequestGame}
                                    disabled={isRequesting}
                                    title="Queue this game into the automated link extractor priority queue"
                                >
                                    {isRequesting ? <Loader2 size={18} className="animate-spin" /> : <Flame size={18} />}
                                    <span>{isRequesting ? 'Adding to Priority Queue...' : '🎯 Request Direct Links (Priority)'}</span>
                                </button>
                            )}

                            {!isResolved && (
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

            {/* Full-Screen Lightbox for Screenshots */}
            {isLightboxOpen && screenshots.length > 0 && (
                <div className="lightbox-overlay" onClick={() => setIsLightboxOpen(false)}>
                    <button className="lightbox-close-btn" onClick={() => setIsLightboxOpen(false)}>
                        <X size={24} />
                    </button>
                    <img
                        src={screenshots[activeScreenshotIdx]}
                        alt="Enlarged screenshot"
                        className="lightbox-img"
                        referrerPolicy="no-referrer"
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            )}
        </div>
    );
}
