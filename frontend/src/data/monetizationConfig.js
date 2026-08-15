/**
 * Centralized Monetization & Affiliate Configuration
 * Update your links and ad parameters here anytime.
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

    // 2. Creator Tip Jar & Donations
    donations: {
        enabled: true,
        buyMeACoffeeUrl: "https://buymeacoffee.com/goldleom",
        kofiUrl: "https://ko-fi.com/goldleom"
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
