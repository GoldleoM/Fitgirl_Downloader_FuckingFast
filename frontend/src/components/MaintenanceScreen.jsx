import React, { useEffect, useState } from 'react';

export default function MaintenanceScreen() {
    const [timeRemaining, setTimeRemaining] = useState(0);
    const [message, setMessage] = useState('Website will be back in {time_remaining}');
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        let mounted = true;
        let intervalId = null;

        const fetchStatus = async () => {
            try {
                // Fetch from static JSON file (works on Firebase Hosting)
                const res = await fetch('/maintenance.json', { cache: 'no-store' });
                if (!res.ok) {
                    // No maintenance file = no maintenance
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
                        setMessage(data.message || 'Website will be back in {time_remaining}');
                    } else {
                        // Expired - reload to check again
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
                    // Time's up - reload page to check if maintenance ended
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

    const formatTime = (seconds) => {
        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    if (!loaded) {
        return (
            <div className="maintenance-loader">
                <div className="loader-ring"></div>
            </div>
        );
    }

    if (timeRemaining <= 0) {
        return null; // Parent will handle showing normal site
    }

    const displayMessage = message.replace('{time_remaining}', formatTime(timeRemaining));

    return (
        <div className="maintenance-screen" role="main" aria-live="polite">
            <div className="maintenance-bg">
                <div className="ambient-orb orb-1"></div>
                <div className="ambient-orb orb-2"></div>
                <div className="ambient-orb orb-3"></div>
                <div className="grid-overlay"></div>
            </div>
            
            <div className="maintenance-content">
                <div className="maintenance-icon" aria-hidden="true">
                    <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                    </svg>
                </div>
                
                <h1 className="maintenance-title">MAINTENANCE MODE</h1>
                
                <div className="maintenance-timer" aria-label={`Time remaining: ${formatTime(timeRemaining)}`}>
                    <span className="timer-value">{formatTime(timeRemaining)}</span>
                    <span className="timer-label">HOURS : MINUTES : SECONDS</span>
                </div>
                
                <p className="maintenance-message">{displayMessage}</p>
                
                <div className="maintenance-progress" role="progressbar" aria-valuenow={0} aria-valuemin={0} aria-valuemax={100}>
                    <div className="progress-bar" style={{ width: '0%' }}></div>
                </div>
            </div>
        </div>
    );
}