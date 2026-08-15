import React, { useEffect, useRef } from 'react';
import { MONETIZATION_CONFIG } from '../data/monetizationConfig';
import { ShieldAlert, ExternalLink, Sparkles } from 'lucide-react';

export default function AdBanner({ type = "banner", className = "" }) {
    const { adBanners, vpn } = MONETIZATION_CONFIG;
    const adContainerRef = useRef(null);

    if (!adBanners || !adBanners.enabled) return null;

    // If third-party ad networks (Adsterra / A-Ads) are active:
    if (adBanners.showAdsterra && adBanners.adsterraZoneId) {
        return (
            <div className={`ad-container-wrapper ${className}`} ref={adContainerRef}>
                <div className="ad-label-pill">SPONSORED</div>
                <div className="ad-slot-frame">
                    {/* The ad script or iframe goes here */}
                    <div id={`adsterra-zone-${adBanners.adsterraZoneId}`}></div>
                </div>
            </div>
        );
    }

    // Default Fallback: High-converting internal booster card
    return (
        <div className={`ad-promo-container ${className}`}>
            <div className="ad-promo-card">
                <div className="ad-promo-left">
                    <span className="ad-badge-pro">
                        <Sparkles size={13} />
                        <span>REPACK ACCELERATOR</span>
                    </span>
                    <h4>Supercharge Your Repack Downloads</h4>
                    <p>Prevent your Internet Provider from throttling large multi-gigabyte repack files.</p>
                </div>
                <a
                    href={vpn.affiliateUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ad-promo-btn"
                >
                    <span>Get VPN Speed Shield</span>
                    <ExternalLink size={14} />
                </a>
            </div>
        </div>
    );
}
