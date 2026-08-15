import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    Download,
    X,
    Check,
    AlertTriangle,
    Loader2,
    Copy,
    FileDown,
    Globe,
    Terminal,
    HardDrive,
    Layers,
    Info,
    Zap,
    CheckCircle2,
    ExternalLink,
    HelpCircle,
    FolderCheck,
    Menu,
    ClipboardList
} from 'lucide-react';
import { apiFetch } from '../utils/api';
import VpnBanner from './VpnBanner';

export default function DownloadDrawer({ isOpen, jobData, onClose }) {
    const [progressPercent, setProgressPercent] = useState(0);
    const [statusText, setStatusText] = useState('Initializing extraction pipeline...');
    const [currentPartInfo, setCurrentPartInfo] = useState('');
    const [logs, setLogs] = useState([]);
    const [downloadStatus, setDownloadStatus] = useState('running'); // 'running' | 'success' | 'failed'
    const [extractedLinks, setExtractedLinks] = useState([]);
    const [activeGuideTab, setActiveGuideTab] = useState('fdm');
    const [copied, setCopied] = useState(false);

    const pollTimerRef = useRef(null);
    const logsBoxRef = useRef(null);
    const activeJobIdRef = useRef(null);

    const appendLog = useCallback((text, type = 'info') => {
        const time = new Date().toLocaleTimeString();
        setLogs(prev => [...prev, { time, text, type }]);
    }, []);

    // Instant zero-cost scroll to bottom (avoids smooth-scroll layout thrashing)
    useEffect(() => {
        if (logsBoxRef.current) {
            logsBoxRef.current.scrollTop = logsBoxRef.current.scrollHeight;
        }
    }, [logs]);

    // Download Links Pipeline execution
    useEffect(() => {
        if (!isOpen || !jobData) {
            setProgressPercent(0);
            setStatusText('Initializing...');
            setCurrentPartInfo('');
            setLogs([]);
            setDownloadStatus('running');
            setExtractedLinks([]);
            activeJobIdRef.current = null;
            if (pollTimerRef.current) clearInterval(pollTimerRef.current);
            return;
        }

        // Avoid re-running pipeline if already initialized for this exact job
        const jobKey = `${jobData.slug || jobData.url || jobData.title}`;
        if (activeJobIdRef.current === jobKey) return;
        activeJobIdRef.current = jobKey;

        let isCancelled = false;

        const startJob = async () => {
            appendLog(`Target: "${jobData.title}"`, 'info');
            appendLog(`Connecting to verified direct mirrors...`, 'info');

            // Direct Links already available (1-Click Ready)
            if (jobData.links && jobData.links.length > 0 && jobData.links[0].includes('fuckingfast.co/dl/')) {
                setProgressPercent(100);
                setStatusText('Direct links ready!');
                setDownloadStatus('success');
                setExtractedLinks(jobData.links);
                setCurrentPartInfo(`All ${jobData.links.length} parts ready for high-speed download`);
                appendLog(`Successfully retrieved ${jobData.links.length} verified direct links from cache!`, 'succ');

                // Client-side auto-clipboard copy
                try {
                    await navigator.clipboard.writeText(jobData.links.join('\n'));
                    appendLog('Auto-copied all direct links to your clipboard!', 'succ');
                } catch (_) {}
                return;
            }

            // Start extraction via API if needed
            try {
                const startRes = await apiFetch('/api/extract_links', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        game_url: jobData.url,
                        slug: jobData.slug,
                        auto_copy: true
                    })
                });
                const startData = await startRes.json();

                if (!startData.success) {
                    if (!isCancelled) {
                        setDownloadStatus('failed');
                        setStatusText('Extraction failed');
                        appendLog(`Error: ${startData.error || 'Failed to start extraction'}`, 'err');
                    }
                    return;
                }

                // If synchronously finished
                if (startData.status === 'completed' && startData.direct_links) {
                    if (!isCancelled) {
                        setProgressPercent(100);
                        setStatusText('Extraction complete!');
                        setDownloadStatus('success');
                        setExtractedLinks(startData.direct_links);
                        setCurrentPartInfo(`${startData.direct_links.length} parts extracted`);
                        appendLog(`Successfully extracted ${startData.direct_links.length} direct links!`, 'succ');

                        // Copy to clipboard
                        try {
                            await navigator.clipboard.writeText(startData.direct_links.join('\n'));
                            appendLog('Copied direct links to clipboard!', 'succ');
                        } catch (_) {}
                    }
                    return;
                }

                // Poll job progress
                const jobId = startData.job_id;
                appendLog(`Background extractor worker started (ID: ${jobId})`, 'info');

                pollTimerRef.current = setInterval(async () => {
                    try {
                        const statusRes = await apiFetch(`/api/job_status/${jobId}`);
                        const sData = await statusRes.json();

                        if (isCancelled || !sData.success) return;

                        const job = sData.job;
                        const pct = job.total_parts > 0 ? Math.round((job.completed_parts / job.total_parts) * 100) : 10;
                        setProgressPercent(pct);
                        setStatusText(job.message || 'Extracting links...');
                        if (job.current_part) {
                            setCurrentPartInfo(`Part ${job.completed_parts}/${job.total_parts}: ${job.current_part}`);
                        }

                        if (job.status === 'completed') {
                            clearInterval(pollTimerRef.current);
                            setProgressPercent(100);
                            setDownloadStatus('success');
                            setStatusText('Extraction complete!');
                            setExtractedLinks(job.direct_links || []);
                            appendLog(`Extraction successful! Total: ${job.direct_links?.length || 0} direct links`, 'succ');

                            try {
                                if (job.direct_links?.length > 0) {
                                    await navigator.clipboard.writeText(job.direct_links.join('\n'));
                                    appendLog('Auto-copied direct links to clipboard!', 'succ');
                                }
                            } catch (_) {}
                        } else if (job.status === 'failed') {
                            clearInterval(pollTimerRef.current);
                            setDownloadStatus('failed');
                            setStatusText('Extraction encountered an issue');
                            appendLog(`Extraction error: ${job.error || 'Unknown error'}`, 'err');
                        }
                    } catch (err) {
                        appendLog(`Network polling error: ${err.message}`, 'err');
                    }
                }, 1200);

            } catch (err) {
                if (!isCancelled) {
                    setDownloadStatus('failed');
                    setStatusText('Extraction request failed');
                    appendLog(`Request error: ${err.message}`, 'err');
                }
            }
        };

        startJob();

        return () => {
            isCancelled = true;
            if (pollTimerRef.current) clearInterval(pollTimerRef.current);
        };
    }, [isOpen, jobData, appendLog]);

    if (!isOpen || !jobData) return null;

    const handleCopyAll = async () => {
        if (!extractedLinks || extractedLinks.length === 0) return;
        try {
            await navigator.clipboard.writeText(extractedLinks.join('\n'));
            setCopied(true);
            setTimeout(() => setCopied(false), 2500);
        } catch (_) {}
    };

    const handleDownloadTxt = () => {
        if (!extractedLinks || extractedLinks.length === 0) return;
        const blob = new Blob([extractedLinks.join('\n')], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `download_links_${jobData.slug || 'game'}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleBatchBrowserDownload = () => {
        if (!extractedLinks || extractedLinks.length === 0) return;
        extractedLinks.forEach((link, idx) => {
            setTimeout(() => {
                const iframe = document.createElement('iframe');
                iframe.style.display = 'none';
                iframe.src = link;
                document.body.appendChild(iframe);
                setTimeout(() => document.body.removeChild(iframe), 60000);
            }, idx * 1200);
        });
        appendLog(`Queued all ${extractedLinks.length} parts for in-browser download!`, 'succ');
    };

    return (
        <div className="drawer-overlay" onClick={onClose}>
            <div className="drawer-content" onClick={(e) => e.stopPropagation()}>
                <button className="close-btn" onClick={onClose} title="Close HUD">
                    <X size={18} />
                </button>

                <div className="drawer-header">
                    <div className="drawer-title">
                        <div className="drawer-header-icon">
                            <Zap size={24} className="icon-pulse text-neon" />
                        </div>
                        <div>
                            <h3 id="drawerGameTitle">{jobData.title}</h3>
                            <span className="drawer-subtitle" id="drawerStatusText">{statusText}</span>
                        </div>
                    </div>
                </div>

                {/* Progress Banner */}
                <div className="progress-stats-banner">
                    <div className="stats-row">
                        <span className="progress-counter-text" id="drawerProgressCounter">
                            {downloadStatus === 'running' ? 'Connecting to Direct Mirror Gateway...' : downloadStatus === 'success' ? 'All Direct Links Ready!' : 'Extraction Stopped'}
                        </span>
                        <span className="percent-badge" id="drawerProgressPercent">{progressPercent}%</span>
                    </div>
                    <div className="progress-bar-container">
                        <div
                            className="progress-bar"
                            id="drawerProgressBar"
                            style={{ width: `${progressPercent}%` }}
                        ></div>
                    </div>
                    <div className="current-part-text" id="drawerCurrentPart">
                        <HardDrive size={13} className="text-neon" />
                        <span>{currentPartInfo || 'Ready for multi-part download'}</span>
                    </div>
                </div>

                {/* Monospace Live Terminal Logs */}
                <div className="activity-logs-box" id="drawerLogsBox" ref={logsBoxRef}>
                    {logs.map((log, i) => (
                        <div key={i} className={`log-line ${log.type === 'succ' ? 'succ' : log.type === 'err' ? 'err' : ''}`}>
                            <span style={{ opacity: 0.5, marginRight: '6px' }}>[{log.time}]</span>
                            {log.text}
                        </div>
                    ))}
                </div>

                {/* Action Buttons Hub */}
                <div className="drawer-actions">
                    <button
                        className="hub-btn-primary"
                        disabled={extractedLinks.length === 0}
                        onClick={handleCopyAll}
                        title="Copy all direct links to clipboard"
                    >
                        {copied ? <Check size={18} /> : <Copy size={18} />}
                        <span>{copied ? 'Copied to Clipboard!' : `Copy All Links (${extractedLinks.length} Parts)`}</span>
                    </button>

                    <button
                        className="hub-btn-secondary"
                        disabled={extractedLinks.length === 0}
                        onClick={handleDownloadTxt}
                        title="Save download_links.txt to your PC"
                    >
                        <FileDown size={16} />
                        <span>Save .txt File</span>
                    </button>

                    <button
                        className="hub-btn-secondary"
                        disabled={extractedLinks.length === 0}
                        onClick={handleBatchBrowserDownload}
                        title="Download all parts directly through your browser"
                    >
                        <Globe size={16} />
                        <span>Browser Batch Download</span>
                    </button>
                </div>

                {/* VPN Security & Speed Tip Banner */}
                <VpnBanner compact={true} />

                {/* Batch Downloader Guides */}
                <div className="guide-card">
                    <div className="guide-header">
                        <HelpCircle size={18} className="text-neon" />
                        <span>How to Batch Download All Parts (Recommended):</span>
                    </div>

                    <div className="guide-tabs">
                        <button
                            className={`guide-tab ${activeGuideTab === 'fdm' ? 'active' : ''}`}
                            onClick={() => setActiveGuideTab('fdm')}
                        >
                            <Zap size={14} /> Free Download Manager (Batch Guide)
                        </button>
                        <button
                            className={`guide-tab ${activeGuideTab === 'jdownloader' ? 'active' : ''}`}
                            onClick={() => setActiveGuideTab('jdownloader')}
                        >
                            JDownloader 2
                        </button>
                        <button
                            className={`guide-tab ${activeGuideTab === 'idm' ? 'active' : ''}`}
                            onClick={() => setActiveGuideTab('idm')}
                        >
                            Internet Download Manager (IDM)
                        </button>
                        <button
                            className={`guide-tab ${activeGuideTab === 'browser' ? 'active' : ''}`}
                            onClick={() => setActiveGuideTab('browser')}
                        >
                            Browser Direct
                        </button>
                        <button
                            className={`guide-tab ${activeGuideTab === 'aria2' ? 'active' : ''}`}
                            onClick={() => setActiveGuideTab('aria2')}
                        >
                            aria2c CLI
                        </button>
                    </div>

                    {/* FDM Batch Guide */}
                    {activeGuideTab === 'fdm' && (
                        <div className="guide-panel active">
                            <div className="fdm-visual-steps-grid">
                                <div className="fdm-step-card">
                                    <div className="fdm-step-header">
                                        <span className="step-pill">Step 1</span>
                                        <h4>Open FDM Main Menu</h4>
                                    </div>
                                    <p className="fdm-step-desc">
                                        Click <strong>&ldquo;Copy All Links&rdquo;</strong> above. In Free Download Manager, click the <strong>Main Menu</strong> (three lines icon <span className="menu-icon-symbol">&equiv;</span> in top-right).
                                    </p>
                                    <div className="fdm-img-wrapper">
                                        <img
                                            src="/images/fdm_step1.png"
                                            alt="Click Main Menu (three lines) in FDM"
                                            loading="lazy"
                                            onError={(e) => {
                                                if (!e.target.dataset.tried) {
                                                    e.target.dataset.tried = "true";
                                                    e.target.src = "/fdm_step1.png";
                                                }
                                            }}
                                        />
                                    </div>
                                </div>

                                <div className="fdm-step-card">
                                    <div className="fdm-step-header">
                                        <span className="step-pill">Step 2</span>
                                        <h4>Paste URLs from Clipboard</h4>
                                    </div>
                                    <p className="fdm-step-desc">
                                        In the menu, click <strong>&ldquo;Paste urls from clipboard&rdquo;</strong> to automatically add all {extractedLinks.length} parts into a batch download queue!
                                    </p>
                                    <div className="fdm-img-wrapper">
                                        <img
                                            src="/images/fdm_step2.png"
                                            alt="Click Paste urls from clipboard in FDM"
                                            loading="lazy"
                                            onError={(e) => {
                                                if (!e.target.dataset.tried) {
                                                    e.target.dataset.tried = "true";
                                                    e.target.src = "/fdm_step2.png";
                                                }
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="guide-tips-banner">
                                <FolderCheck size={18} className="text-neon" />
                                <span><strong>Golden Rule:</strong> Make sure all parts download into the <u>exact same folder</u>. Once all parts finish downloading, run <code>setup.exe</code> to install the game!</span>
                            </div>

                            <div className="downloader-download-link">
                                <span>Don&rsquo;t have Free Download Manager? </span>
                                <a href="https://www.freedownloadmanager.org/download.htm" target="_blank" rel="noopener noreferrer">
                                    Download FDM for Free (Windows / Mac) <ExternalLink size={12} />
                                </a>
                            </div>
                        </div>
                    )}

                    {/* JDownloader 2 Guide */}
                    {activeGuideTab === 'jdownloader' && (
                        <div className="guide-panel active">
                            <div className="easy-steps-grid">
                                <div className="easy-step-box">
                                    <div className="easy-step-num">1</div>
                                    <div className="easy-step-content">
                                        <h5>Copy All Links</h5>
                                        <p>Click the glowing <strong>&ldquo;Copy All Links&rdquo;</strong> button above.</p>
                                    </div>
                                </div>
                                <div className="easy-step-box">
                                    <div className="easy-step-num">2</div>
                                    <div className="easy-step-content">
                                        <h5>Automatic LinkGrabber</h5>
                                        <p>Open JDownloader 2. Its <strong>LinkGrabber</strong> tab will automatically detect all {extractedLinks.length} parts from your clipboard.</p>
                                    </div>
                                </div>
                                <div className="easy-step-box">
                                    <div className="easy-step-num">3</div>
                                    <div className="easy-step-content">
                                        <h5>Start All Downloads</h5>
                                        <p>Click <strong>&ldquo;Start All Downloads&rdquo;</strong> in the bottom-right corner to download all parts simultaneously.</p>
                                    </div>
                                </div>
                            </div>

                            <div className="downloader-download-link">
                                <span>Don&rsquo;t have JDownloader 2? </span>
                                <a href="https://jdownloader.org/download/index" target="_blank" rel="noopener noreferrer">
                                    Download JDownloader 2 <ExternalLink size={12} />
                                </a>
                            </div>
                        </div>
                    )}

                    {/* IDM Guide */}
                    {activeGuideTab === 'idm' && (
                        <div className="guide-panel active">
                            <div className="easy-steps-grid">
                                <div className="easy-step-box">
                                    <div className="easy-step-num">1</div>
                                    <div className="easy-step-content">
                                        <h5>Copy Links or Save .txt</h5>
                                        <p>Click <strong>&ldquo;Copy All Links&rdquo;</strong> or <strong>&ldquo;Save .txt File&rdquo;</strong> above.</p>
                                    </div>
                                </div>
                                <div className="easy-step-box">
                                    <div className="easy-step-num">2</div>
                                    <div className="easy-step-content">
                                        <h5>Add Batch in IDM</h5>
                                        <p>In IDM, click top menu: <strong>Tasks &gt; Add batch download from clipboard</strong> (or <strong>Tasks &gt; Import &gt; From text file</strong>).</p>
                                    </div>
                                </div>
                                <div className="easy-step-box">
                                    <div className="easy-step-num">3</div>
                                    <div className="easy-step-content">
                                        <h5>Select All &amp; Start</h5>
                                        <p>Click <strong>Select All</strong>, choose your destination folder, and click <strong>OK</strong> to start multi-part downloading.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Browser Batch Guide */}
                    {activeGuideTab === 'browser' && (
                        <div className="guide-panel active">
                            <div className="easy-steps-grid">
                                <div className="easy-step-box">
                                    <div className="easy-step-num">1</div>
                                    <div className="easy-step-content">
                                        <h5>Click &ldquo;Browser Batch Download&rdquo;</h5>
                                        <p>Click the <strong>Browser Batch Download</strong> button above. No extra app needed.</p>
                                    </div>
                                </div>
                                <div className="easy-step-box">
                                    <div className="easy-step-num">2</div>
                                    <div className="easy-step-content">
                                        <h5>Allow Multiple Downloads</h5>
                                        <p>If your browser prompts <em>&ldquo;Allow this site to download multiple files?&rdquo;</em>, click <strong>Allow</strong>.</p>
                                    </div>
                                </div>
                                <div className="easy-step-box">
                                    <div className="easy-step-num">3</div>
                                    <div className="easy-step-content">
                                        <h5>All Parts in Downloads</h5>
                                        <p>All {extractedLinks.length} parts will download sequentially into your default <strong>Downloads</strong> folder.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* aria2c CLI Guide */}
                    {activeGuideTab === 'aria2' && (
                        <div className="guide-panel active">
                            <div className="guide-text-box">
                                <h4 className="guide-section-title">Multi-Connection aria2c Command:</h4>
                                <p style={{ fontSize: '0.85rem', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>
                                    1. Click <strong>&ldquo;Save .txt File&rdquo;</strong> to save <code>download_links.txt</code> in your desired folder.<br />
                                    2. Open your terminal in that folder and run:
                                </p>
                                <code className="code-block">
                                    aria2c -i download_links.txt -j 4 -x 16 -s 16
                                </code>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
