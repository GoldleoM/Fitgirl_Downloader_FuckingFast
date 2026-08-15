import React from 'react';
import { ShieldCheck, Zap, ExternalLink, Sparkles } from 'lucide-react';
import { MONETIZATION_CONFIG } from '../data/monetizationConfig';

export default function VpnBanner({ compact = false }) {
    const { vpn } = MONETIZATION_CONFIG;

    if (!vpn || !vpn.enabled) return null;

    if (compact) {
        return (
            <div className="vpn-compact-banner">
                <div className="vpn-compact-left">
                    <ShieldCheck size={16} className="text-cyan flex-shrink-0" />
                    <span className="vpn-compact-text">
                        <strong>ISP Throttling Warning:</strong> Uncap download speeds & encrypt traffic.
                    </span>
                </div>
                <a
                    href={vpn.affiliateUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="vpn-compact-btn"
                >
                    <span>Get {vpn.providerName}</span>
                    <span className="vpn-mini-badge">{vpn.dealBadge.split('+')[0].trim()}</span>
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
                            <Zap size={12} className="fill-current" />
                            <span>SPEED BOOST & PRIVACY</span>
                        </span>
                        <span className="vpn-deal-pill">
                            <Sparkles size={12} />
                            <span>{vpn.dealBadge}</span>
                        </span>
                    </div>
                </div>

                <div className="vpn-body-row">
                    <div className="vpn-info-col">
                        <h4 className="vpn-title">{vpn.title}</h4>
                        <p className="vpn-tagline">{vpn.tagline}</p>
                    </div>

                    <div className="vpn-action-col">
                        <a
                            href={vpn.affiliateUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="vpn-cta-btn"
                            title="Get Surfshark VPN with Exclusive Discount"
                        >
                            <ShieldCheck size={18} />
                            <span>Protect & Speed Up Downloads</span>
                            <ExternalLink size={14} className="opacity-70" />
                        </a>
                        <span className="vpn-subtext">30-Day Money-Back Guarantee • 0 Logs</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
