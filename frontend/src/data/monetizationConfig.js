/**
 * Centralized Monetization & Affiliate Configuration
 * Update your links and ad parameters here anytime.
 */

export const MONETIZATION_CONFIG = {
    // 1. Gaming Hardware & Storage Affiliate (CouponDunia / Amazon / Flipkart)
    hardwareDeals: {
        enabled: true,
        title: "Running Out of Space for Repacks? Upgrade Storage",
        tagline: "High-speed 1TB/2TB NVMe SSDs & PC gaming controllers on major discounts.",
        dealBadge: "UP TO 60% OFF DEALS",
        // Paste your generated CouponDunia link here:
        affiliateUrl: "https://www.amazon.in/s?k=nvme+ssd+1tb+gaming",
        buttonText: "Browse Gaming SSDs & Gear",
        providerName: "Gaming Deals",
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
