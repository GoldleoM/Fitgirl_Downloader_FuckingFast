import React, { useEffect, useState } from 'react';

export default function MaintenanceScreen() {
    const [timeRemaining, setTimeRemaining] = useState(0);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        let mounted = true;
        let intervalId = null;

        const fetchStatus = async () => {
            try {
                // Fetch from static JSON file (works on Firebase Hosting)
                const res = await fetch('/maintenance.json', { cache: 'no-store' });
                if (!res.ok) {
                    if (mounted) {
                        setTimeRemaining(0);
                        setLoaded(true);
                    }
                    return;
                }
                const data = await res.json();
                if (mounted && data.active) {
                    const endTime = new Date(data.end_time).getTime();
                    const now = Date.now();
                    const remaining = Math.max(0, Math.ceil((endTime - now) / 1000));
                    if (remaining > 0) {
                        setTimeRemaining(remaining);
                    } else {
                        window.location.reload();
                    }
                } else if (mounted) {
                    setTimeRemaining(0);
                }
            } catch (e) {
                console.error('Maintenance check failed:', e);
                if (mounted) setTimeRemaining(0);
            } finally {
                if (mounted) setLoaded(true);
            }
        };

        fetchStatus();
        
        // Update every second
        intervalId = setInterval(() => {
            setTimeRemaining(prev => {
                if (prev <= 1) {
                    window.location.reload();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => {
            mounted = false;
            if (intervalId) clearInterval(intervalId);
        };
    }, []);

    if (!loaded) {
        return (
            <div className="maintenance-loader">
                <div className="loader-ring"></div>
            </div>
        );
    }

    if (timeRemaining <= 0) {
        return null;
    }

    const days = Math.floor(timeRemaining / 86400);
    const hours = Math.floor((timeRemaining % 86400) / 3600);
    const minutes = Math.floor((timeRemaining % 3600) / 60);
    const seconds = timeRemaining % 60;

    const pad = (n) => String(n).padStart(2, '0');

    return (
        <div className="doomsday-maintenance-screen" role="main" aria-live="polite">
            {/* Cinematic Background with Emerald Glow & Vignette */}
            <div className="doomsday-bg">
                <div className="doomsday-bg-image" style={{ backgroundImage: "url('/doomsday_bg.jpg')" }}></div>
                <div className="doomsday-overlay"></div>
                <div className="doomsday-mist mist-1"></div>
                <div className="doomsday-mist mist-2"></div>
                <div className="doomsday-vignette"></div>
                <div className="cinematic-letterbox-top"></div>
                <div className="cinematic-letterbox-bottom"></div>
            </div>

            {/* Central Cinematic Content */}
            <div className="doomsday-content">
                {/* Countdown Display */}
                <div 
                    className="doomsday-timer" 
                    aria-label={`Time remaining: ${days} days, ${hours} hours, ${minutes} minutes, ${seconds} seconds`}
                >
                    <div className="timer-segment">
                        <span className="timer-digit">{pad(days)}</span>
                        <span className="timer-label">DAYS</span>
                    </div>
                    <span className="timer-separator" aria-hidden="true">:</span>
                    
                    <div className="timer-segment">
                        <span className="timer-digit">{pad(hours)}</span>
                        <span className="timer-label">HOURS</span>
                    </div>
                    <span className="timer-separator" aria-hidden="true">:</span>
                    
                    <div className="timer-segment">
                        <span className="timer-digit">{pad(minutes)}</span>
                        <span className="timer-label">MINUTES</span>
                    </div>
                    <span className="timer-separator" aria-hidden="true">:</span>
                    
                    <div className="timer-segment">
                        <span className="timer-digit">{pad(seconds)}</span>
                        <span className="timer-label">SECONDS</span>
                    </div>
                </div>

                {/* Subtitle / Cinematic Tag */}
                <div className="doomsday-footer-tag">
                    <div className="cinematic-badge">
                        <span>FITBOY WILL RETURN IN AVENGERS DOOMSDAY</span>
                    </div>
                    <div className="cinematic-credit">
                        <span className="marvel-logo">MARVEL</span>
                        <span className="credit-text">© 2026 MARVEL</span>
                    </div>
                </div>
            </div>
        </div>
    );
}