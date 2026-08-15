/**
 * Centralized Monetization & Affiliate Configuration
 * Update your links, wallet addresses, and ad parameters here anytime.
 */

export const MONETIZATION_CONFIG = {
    // 1. VPN Affiliate (Surfshark / NordVPN / PIA)
    vpn: {
        enabled: true,
        title: "Bypass ISP Speed Limits & Shield Your Downloads",
        tagline: "Gamers recommend using a high-speed VPN for unthrottled gigabit downloads and zero logging.",
        dealBadge: "82% OFF + 3 MONTHS FREE",
        // Replace with your affiliate / referral link:
        affiliateUrl: "https://surfshark.club/friend/goldleom", 
        providerName: "Surfshark VPN",
    },

    // 2. Creator Crypto Tip Jar & Donations
    donations: {
        enabled: true,
        buyMeACoffeeUrl: "https://buymeacoffee.com/goldleom",
        kofiUrl: "https://ko-fi.com/goldleom",
        cryptoWallets: [
            {
                currency: "USDT (TRC20)",
                symbol: "USDT",
                address: "TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE", // Replace with your TRC20 address
                network: "TRON (TRC20 - Low Fee)",
                color: "#26a17b"
            },
            {
                currency: "Bitcoin (BTC)",
                symbol: "BTC",
                address: "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh", // Replace with your BTC address
                network: "Bitcoin Native",
                color: "#f7931a"
            },
            {
                currency: "Ethereum (ETH / USDT ERC20)",
                symbol: "ETH",
                address: "0x71C7656EC7ab88b098defB751B7401B5f6d8976F", // Replace with your EVM address
                network: "Ethereum / Polygon / Arbitrum",
                color: "#627eea"
            },
            {
                currency: "Solana (SOL)",
                symbol: "SOL",
                address: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU", // Replace with your Solana address
                network: "Solana Network",
                color: "#14f195"
            }
        ]
    },

    // 3. Ad Network Banner (Adsterra / A-Ads)
    adBanners: {
        enabled: true,
        showAdsterra: true,
        adsterraZoneId: "e4b957e6ecb9a8adfcfdb4dfdb92ec13",
        adsterraInvokeUrl: "https://pl30857228.effectivecpmnetwork.com/e4b957e6ecb9a8adfcfdb4dfdb92ec13/invoke.js",
        aAdsZoneId: ""
    }
};
