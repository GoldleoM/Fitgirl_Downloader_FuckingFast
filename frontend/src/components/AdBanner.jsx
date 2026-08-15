import React, { useEffect, useRef } from 'react';
import { MONETIZATION_CONFIG } from '../data/monetizationConfig';
import { Sparkles, ExternalLink } from 'lucide-react';

export default function AdBanner({ className = "" }) {
    const { adBanners, vpn } = MONETIZATION_CONFIG;
    const bannerSlotRef = useRef(null);

    useEffect(() => {
        if (adBanners.showAdsterra && adBanners.adsterraInvokeUrl && bannerSlotRef.current) {
            // Clear previous scripts if any to prevent duplicate execution
            bannerSlotRef.current.innerHTML = '';

            const containerDiv = document.createElement('div');
            containerDiv.id = `container-${adBanners.adsterraZoneId}`;
            bannerSlotRef.current.appendChild(containerDiv);

            const script = document.createElement('script');
            script.type = 'text/javascript';
            script.src = adBanners.adsterraInvokeUrl;
            script.async = true;
            script.setAttribute('data-cfasync', 'false');
            bannerSlotRef.current.appendChild(script);
        }
    }, [adBanners.showAdsterra, adBanners.adsterraZoneId, adBanners.adsterraInvokeUrl]);

    if (!adBanners || !adBanners.enabled) return null;

    // If Adsterra is active, render native ad container
    if (adBanners.showAdsterra && adBanners.adsterraZoneId) {
        return (
            <div className={`ad-container-wrapper ${className}`}>
                <div className="ad-label-pill">SPONSORED</div>
                <div className="ad-slot-frame" ref={bannerSlotRef}>
                    <div id={`container-${adBanners.adsterraZoneId}`}></div>
                </div>
            </div>
        );
    }

    // Fallback: High-converting VPN speed booster card
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
