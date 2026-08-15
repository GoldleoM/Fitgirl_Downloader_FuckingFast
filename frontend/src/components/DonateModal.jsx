import React from 'react';
import { X, Heart, Coffee, Shield, Sparkles, ExternalLink } from 'lucide-react';
import { MONETIZATION_CONFIG } from '../data/monetizationConfig';

export default function DonateModal({ isOpen, onClose }) {
    const { donations } = MONETIZATION_CONFIG;

    if (!isOpen || !donations.enabled) return null;

    return (
        <div className="drawer-overlay" onClick={onClose}>
            <div className="donate-modal-content" onClick={(e) => e.stopPropagation()}>
                {/* Close Button */}
                <button className="btn-close-modal" onClick={onClose} title="Close">
                    <X size={18} />
                </button>

                {/* Modal Header */}
                <div className="donate-header">
                    <div className="donate-icon-glow">
                        <Heart size={26} className="text-pink fill-pink" />
                    </div>
                    <div className="donate-header-text">
                        <h3>Support FitBoy PRO</h3>
                        <p>Help keep our high-speed cloud link resolvers online, fast, and 100% free for everyone.</p>
                    </div>
                </div>

                {/* Creator Support Buttons */}
                <div className="donate-fiat-list">
                    {donations.buyMeACoffeeUrl && (
                        <a
                            href={donations.buyMeACoffeeUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="donate-fiat-card bmac-card"
                        >
                            <div className="donate-card-left">
                                <div className="donate-btn-icon-box bmac-box">
                                    <Coffee size={22} />
                                </div>
                                <div className="donate-btn-info">
                                    <span className="donate-btn-title">Buy Me a Coffee</span>
                                    <span className="donate-btn-desc">Quick one-time tip via card or PayPal</span>
                                </div>
                            </div>
                            <ExternalLink size={16} className="opacity-70" />
                        </a>
                    )}

                    {donations.kofiUrl && (
                        <a
                            href={donations.kofiUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="donate-fiat-card kofi-card"
                        >
                            <div className="donate-card-left">
                                <div className="donate-btn-icon-box kofi-box">
                                    <Sparkles size={22} />
                                </div>
                                <div className="donate-btn-info">
                                    <span className="donate-btn-title">Tip on Ko-fi</span>
                                    <span className="donate-btn-desc">Support the project on Ko-fi</span>
                                </div>
                            </div>
                            <ExternalLink size={16} className="opacity-70" />
                        </a>
                    )}
                </div>

                {/* Footer Note */}
                <div className="donate-footer-note">
                    <Shield size={14} className="text-cyan flex-shrink-0" />
                    <span>Every contribution directly supports our dedicated cloud link crawlers and server infrastructure. Thank you!</span>
                </div>
            </div>
        </div>
    );
}
