import React, { useState, useRef, useCallback } from 'react';
import { ExternalLink, ArrowUp, Zap, Code2, ShieldCheck, Heart, Gamepad2, Download, HelpCircle, ChevronDown, ChevronUp, Cpu, Server, Sparkles } from 'lucide-react';

export default function Footer({ onNavigateHome, onAdminTrigger }) {
    const currentYear = new Date().getFullYear();
    const githubUser = "GoldleoM";
    const githubProfileUrl = `https://github.com/${githubUser}`;
    const githubRepoUrl = `https://github.com/${githubUser}/Fitgirl_Downloader_FuckingFast`;

    const [openFaqIndex, setOpenFaqIndex] = useState(null);
    const clickCountRef = useRef(0);
    const clickTimerRef = useRef(null);

    const handleCopyrightClick = useCallback(() => {
        clickCountRef.current += 1;
        if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
        if (clickCountRef.current >= 7) {
            clickCountRef.current = 0;
            if (onAdminTrigger) onAdminTrigger();
            return;
        }
        clickTimerRef.current = setTimeout(() => {
            clickCountRef.current = 0;
        }, 2000);
    }, [onAdminTrigger]);


    const toggleFaq = (idx) => {
        setOpenFaqIndex(openFaqIndex === idx ? null : idx);
    };

    const scrollToTop = () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const faqs = [
        {
            q: "What is FitBoy PRO & how does it speed up downloads?",
            a: "FitBoy PRO is a high-speed cloud indexer that automates link extraction from repack releases. Instead of manually clicking through hundreds of ad links, FitBoy PRO resolves ultra-fast multi-part mirror links (FuckingFast CDN) in 1 click, allowing you to batch download with Free Download Manager (FDM) at maximum gigabit connection speed."
        },
        {
            q: "How do I import all game parts into Free Download Manager (FDM)?",
            a: "1. Click '1-Click FDM Batch Download' or 'Copy All Direct Links'.\n2. Open Free Download Manager on your PC.\n3. Click the main menu (three horizontal lines ☰ in the top-right corner).\n4. Select 'Paste urls from clipboard' — FDM will queue and accelerate all parts simultaneously!"
        },
        {
            q: "Are the downloaded game files authentic and lossless?",
            a: "Yes! All archives are verified repack releases featuring 100% lossless MD5 perfect file integrity. Once extracted and installed, game files are bit-for-bit identical to original releases."
        },
        {
            q: "What download managers and operating systems are supported?",
            a: "FitBoy PRO generates universal direct URLs compatible with Free Download Manager (FDM), JDownloader 2, Internet Download Manager (IDM), aria2c, and curl across Windows, Linux, and macOS."
        }
    ];

    return (
        <footer className="app-footer">
            <div className="footer-glow-divider"></div>
            
            <div className="footer-content">
                {/* SEO Knowledge & Gamer FAQ Hub */}
                <div className="footer-seo-hub">
                    <div className="seo-hub-header">
                        <div className="seo-badge-pill">
                            <Sparkles size={13} className="text-neon" />
                            <span>GAMER GUIDE & KNOWLEDGE BASE</span>
                        </div>
                        <h3 className="seo-hub-title">Frequently Asked Questions & Download Optimization</h3>
                        <p className="seo-hub-sub">Everything you need to know about high-speed 1-click repack downloading, FDM batch queues, and direct mirror mirrors.</p>
                    </div>

                    <div className="seo-faq-grid">
                        {faqs.map((faq, idx) => {
                            const isOpen = openFaqIndex === idx;
                            return (
                                <div key={idx} className={`seo-faq-card ${isOpen ? 'open' : ''}`}>
                                    <button 
                                        className="seo-faq-question" 
                                        onClick={() => toggleFaq(idx)}
                                        aria-expanded={isOpen}
                                    >
                                        <div className="faq-q-left">
                                            <HelpCircle size={16} className="text-cyan flex-shrink-0" />
                                            <span>{faq.q}</span>
                                        </div>
                                        {isOpen ? <ChevronUp size={16} className="text-muted" /> : <ChevronDown size={16} className="text-muted" />}
                                    </button>
                                    {isOpen && (
                                        <div className="seo-faq-answer">
                                            <p>{faq.a}</p>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* SEO Feature Tags / Keyword Cloud */}
                    <div className="seo-tags-cluster">
                        <span className="seo-tag"><Gamepad2 size={12} /> FitGirl Repacks Vault</span>
                        <span className="seo-tag"><Download size={12} /> 1-Click FDM Batch Downloader</span>
                        <span className="seo-tag"><Cpu size={12} /> Lossless MD5 Perfect</span>
                        <span className="seo-tag"><Server size={12} /> FuckingFast Direct Mirrors</span>
                        <span className="seo-tag"><Zap size={12} /> 0ms Cloud Link Cache</span>
                        <span className="seo-tag"><ShieldCheck size={12} /> Zero Adware & 100% Free</span>
                    </div>
                </div>

                {/* Top Row: Brand & Quick Action Buttons */}
                <div className="footer-top-row">
                    <div className="footer-brand" onClick={onNavigateHome} title="Return to Home">
                        <div className="footer-logo-icon">
                            <Zap size={18} className="text-white fill-white" />
                        </div>
                        <div className="footer-brand-text">
                            <span className="brand-title">FIT<span className="highlight">BOY</span> <span className="brand-badge">PRO</span></span>
                            <span className="brand-sub">HIGH-SPEED REPACK VAULT</span>
                        </div>
                    </div>

                    <div className="footer-links-group">
                        <a
                            href={githubRepoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="footer-btn github-btn"
                            title="View Source on GitHub"
                        >
                            <i className="fa-brands fa-github text-sm"></i>
                            <span>GitHub Repository</span>
                            <ExternalLink size={12} className="opacity-70" />
                        </a>

                        <a
                            href={githubProfileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="footer-btn profile-btn"
                            title="View Developer GitHub Profile"
                        >
                            <Code2 size={16} />
                            <span>@{githubUser}</span>
                        </a>

                        <button 
                            onClick={scrollToTop}
                            className="footer-btn back-to-top-btn"
                            title="Back to Top"
                        >
                            <ArrowUp size={16} />
                            <span>Top</span>
                        </button>
                    </div>
                </div>

                {/* Middle Row: Disclaimer & Security note */}
                <div className="footer-middle-row">
                    <p className="footer-disclaimer">
                        <ShieldCheck size={14} className="inline-icon text-cyan flex-shrink-0" />
                        <span>FitBoy PRO is an open-source indexer & download utility designed for automated repack link extraction and cloud-cached 1-click FDM batch downloading. All trademarks, artwork, and game titles are property of their respective owners.</span>
                    </p>
                </div>

                {/* Bottom Row: Copyright & Creator info */}
                <div className="footer-bottom-row">
                    <div className="footer-copyright" onClick={handleCopyrightClick} style={{ cursor: 'default', userSelect: 'none' }}>
                        <span>© {currentYear} <strong>FitBoy PRO</strong>. Released under open-source license.</span>
                    </div>

                    <div className="footer-author">
                        <span>Designed & Developed with <Heart size={12} className="text-red inline-block fill-red" style={{ color: '#ef4444', fill: '#ef4444', display: 'inline', verticalAlign: 'middle', margin: '0 2px' }} /> by{' '}
                            <a 
                                href={githubProfileUrl} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="footer-author-link"
                            >
                                <i className="fa-brands fa-github"></i>
                                <strong>{githubUser}</strong>
                            </a>
                        </span>
                    </div>
                </div>
            </div>
        </footer>
    );
}
