import React from 'react';
import { Zap, Gamepad2, Bolt, Cpu } from 'lucide-react';

export default function HeroBanner() {
    return (
        <section className="hero-banner">
            <div className="hero-content">
                <div className="hero-tag-pill">
                    <span className="tag-glow-dot"></span>
                    <Zap size={13} className="text-neon" />
                    <span>ULTRA-FAST MULTI-PART DOWNLOADS</span>
                </div>
                <h1 className="hero-heading">
                    Explore Repacks. Instant Direct Links. <br className="hero-br" />
                    Powered by <span className="gradient-text">FitBoy Vault</span>.
                </h1>
                <p className="hero-description">
                    Zero-wait 1-click cloud-extracted direct download links for top repack releases, with seamless batch support for FDM, JDownloader 2, IDM, and aria2c.
                </p>
            </div>

            <div className="hero-stats">
                <div className="stat-card">
                    <div className="stat-icon-box cyan">
                        <Gamepad2 size={20} />
                    </div>
                    <div className="stat-text-group">
                        <span className="stat-num" id="statGames">3,200+</span>
                        <span className="stat-label">Verified Repacks</span>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon-box purple">
                        <Bolt size={20} />
                    </div>
                    <div className="stat-text-group">
                        <span className="stat-num">FuckingFast</span>
                        <span className="stat-label">Direct Mirror Host</span>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon-box emerald">
                        <Cpu size={20} />
                    </div>
                    <div className="stat-text-group">
                        <span className="stat-num">0ms Cache</span>
                        <span className="stat-label">Instant Cloud Links</span>
                    </div>
                </div>
            </div>
        </section>
    );
}
