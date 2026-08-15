import React from 'react';
import { ExternalLink, ArrowUp, Zap, Code2, ShieldCheck, Heart } from 'lucide-react';

export default function Footer({ onNavigateHome, onOpenDonate }) {
    const currentYear = new Date().getFullYear();
    const githubUser = "GoldleoM";
    const githubProfileUrl = `https://github.com/${githubUser}`;
    const githubRepoUrl = `https://github.com/${githubUser}/Fitgirl_Downloader_FuckingFast`;

    const scrollToTop = () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    return (
        <footer className="app-footer">
            <div className="footer-glow-divider"></div>
            
            <div className="footer-content">
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
                        <button
                            onClick={onOpenDonate}
                            className="footer-btn profile-btn"
                            title="Tip & Support the Project"
                            style={{ borderColor: 'rgba(255, 0, 127, 0.35)', color: '#ff4099', background: 'rgba(255, 0, 127, 0.08)' }}
                        >
                            <Heart size={15} className="fill-current" />
                            <span>Tip Jar</span>
                        </button>

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
                        <ShieldCheck size={14} className="inline-icon text-cyan" />
                        <span>FitBoy PRO is an open-source utility designed for automated repack link extraction and cloud-cached 1-click FDM batch downloading. All trademarks, artwork, and game titles are property of their respective owners.</span>
                    </p>
                </div>

                {/* Bottom Row: Copyright & Creator info */}
                <div className="footer-bottom-row">
                    <div className="footer-copyright">
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
