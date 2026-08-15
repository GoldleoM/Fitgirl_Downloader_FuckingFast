import React from 'react';
import { HardDrive, Gamepad2, ExternalLink, Sparkles, ShoppingBag } from 'lucide-react';
import { MONETIZATION_CONFIG } from '../data/monetizationConfig';

export default function VpnBanner({ compact = false }) {
    const deals = MONETIZATION_CONFIG.hardwareDeals || MONETIZATION_CONFIG.vpn;

    if (!deals || !deals.enabled) return null;

    if (compact) {
        return (
            <div className="vpn-compact-banner">
                <div className="vpn-compact-left">
                    <HardDrive size={16} className="text-cyan flex-shrink-0" />
                    <span className="vpn-compact-text">
                        <strong>Low Disk Space?</strong> Grab High-Speed 1TB/2TB NVMe SSDs & PC Gamepads.
                    </span>
                </div>
                <a
                    href={deals.affiliateUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="vpn-compact-btn"
                >
                    <ShoppingBag size={13} />
                    <span>{deals.buttonText || "View Deals"}</span>
                    <span className="vpn-mini-badge">{deals.dealBadge.split(' ')[0]}</span>
                    <ExternalLink size={12} />
                </a>
            </div>
        );
    }

    return (
        <div className="vpn-card-banner">
            <div className="vpn-glow-border"></div>
            
            <div className="vpn-content-wrapper">
                <div className="vpn-header-row">
                    <div className="vpn-badge-group">
                        <span className="vpn-pill-highlight">
                            <Gamepad2 size={13} className="fill-current" />
                            <span>GAMING HARDWARE & STORAGE DEALS</span>
                        </span>
                        <span className="vpn-deal-pill">
                            <Sparkles size={12} />
                            <span>{deals.dealBadge}</span>
                        </span>
                    </div>
                </div>

                <div className="vpn-body-row">
                    <div className="vpn-info-col">
                        <h4 className="vpn-title">{deals.title}</h4>
                        <p className="vpn-tagline">{deals.tagline}</p>
                    </div>

                    <div className="vpn-action-col">
                        <a
                            href={deals.affiliateUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="vpn-cta-btn"
                            title="Browse Best PC Gaming Storage Deals"
                        >
                            <HardDrive size={18} />
                            <span>{deals.buttonText || "Browse Gaming SSDs & Gear"}</span>
                            <ExternalLink size={14} className="opacity-70" />
                        </a>
                        <span className="vpn-subtext">Exclusive Discounted Prices • Verified Stores</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
