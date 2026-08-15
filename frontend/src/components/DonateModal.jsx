import React, { useState } from 'react';
import { X, Copy, Check, Heart, Coffee, Shield, Sparkles, ExternalLink } from 'lucide-react';
import { MONETIZATION_CONFIG } from '../data/monetizationConfig';

export default function DonateModal({ isOpen, onClose }) {
    const [copiedSymbol, setCopiedSymbol] = useState(null);
    const { donations } = MONETIZATION_CONFIG;

    if (!isOpen || !donations.enabled) return null;

    const handleCopy = (symbol, address) => {
        navigator.clipboard.writeText(address);
        setCopiedSymbol(symbol);
        setTimeout(() => {
            setCopiedSymbol(null);
        }, 2000);
    };

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

                {/* Fiat / Creator Options */}
                {(donations.buyMeACoffeeUrl || donations.kofiUrl) && (
                    <div className="donate-fiat-row">
                        {donations.buyMeACoffeeUrl && (
                            <a
                                href={donations.buyMeACoffeeUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="donate-fiat-btn bmac-btn"
                            >
                                <Coffee size={18} />
                                <span>Buy Me a Coffee</span>
                                <ExternalLink size={14} className="opacity-60" />
                            </a>
                        )}
                        {donations.kofiUrl && (
                            <a
                                href={donations.kofiUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="donate-fiat-btn kofi-btn"
                            >
                                <Sparkles size={18} />
                                <span>Tip on Ko-fi</span>
                                <ExternalLink size={14} className="opacity-60" />
                            </a>
                        )}
                    </div>
                )}

                <div className="donate-crypto-divider">
                    <span>Or Donate via Crypto</span>
                </div>

                {/* Crypto Wallets Grid */}
                <div className="crypto-wallets-list">
                    {donations.cryptoWallets.map((wallet) => {
                        const isCopied = copiedSymbol === wallet.symbol;
                        return (
                            <div key={wallet.symbol} className="crypto-wallet-card">
                                <div className="crypto-card-top">
                                    <div className="crypto-name-group">
                                        <span className="crypto-badge" style={{ backgroundColor: `${wallet.color}22`, borderColor: `${wallet.color}55`, color: wallet.color }}>
                                            {wallet.symbol}
                                        </span>
                                        <div className="crypto-title-info">
                                            <span className="crypto-title">{wallet.currency}</span>
                                            <span className="crypto-network">{wallet.network}</span>
                                        </div>
                                    </div>
                                    <button
                                        className={`btn-copy-address ${isCopied ? 'copied' : ''}`}
                                        onClick={() => handleCopy(wallet.symbol, wallet.address)}
                                        title="Copy wallet address"
                                    >
                                        {isCopied ? (
                                            <>
                                                <Check size={14} />
                                                <span>Copied!</span>
                                            </>
                                        ) : (
                                            <>
                                                <Copy size={14} />
                                                <span>Copy</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                                <div className="crypto-address-box">
                                    <code>{wallet.address}</code>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Footer Note */}
                <div className="donate-footer-note">
                    <Shield size={14} className="text-cyan" />
                    <span>Every contribution directly supports our dedicated cloud link crawlers and resolver infrastructure. Thank you!</span>
                </div>
            </div>
        </div>
    );
}
