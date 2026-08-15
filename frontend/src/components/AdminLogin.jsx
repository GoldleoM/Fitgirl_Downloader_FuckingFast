import React, { useState } from 'react';
import { X, ShieldCheck, Loader2, Eye, EyeOff } from 'lucide-react';

export default function AdminLogin({ isOpen, onClose, onLogin, error, setError }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!email.trim() || !password.trim()) return;
        setIsSubmitting(true);
        const ok = await onLogin(email.trim(), password);
        setIsSubmitting(false);
        if (ok) {
            setEmail('');
            setPassword('');
            onClose();
        }
    };

    const handleClose = () => {
        setEmail('');
        setPassword('');
        setError('');
        onClose();
    };

    return (
        <div className="admin-login-overlay" onClick={handleClose}>
            <div className="admin-login-card" onClick={(e) => e.stopPropagation()}>
                <button className="admin-login-close" onClick={handleClose}>
                    <X size={18} />
                </button>

                <div className="admin-login-header">
                    <div className="admin-shield-icon">
                        <ShieldCheck size={28} />
                    </div>
                    <h3>Admin Access</h3>
                    <p>Authorized personnel only</p>
                </div>

                <form onSubmit={handleSubmit} className="admin-login-form">
                    <div className="admin-input-group">
                        <label htmlFor="admin-email">Email</label>
                        <input
                            id="admin-email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="admin@email.com"
                            autoComplete="email"
                            disabled={isSubmitting}
                        />
                    </div>

                    <div className="admin-input-group">
                        <label htmlFor="admin-password">Password</label>
                        <div className="admin-password-wrapper">
                            <input
                                id="admin-password"
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                autoComplete="current-password"
                                disabled={isSubmitting}
                            />
                            <button
                                type="button"
                                className="admin-password-toggle"
                                onClick={() => setShowPassword(!showPassword)}
                                tabIndex={-1}
                            >
                                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                    </div>

                    {error && (
                        <div className="admin-error-msg">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        className="admin-submit-btn"
                        disabled={isSubmitting || !email.trim() || !password.trim()}
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 size={16} className="animate-spin" />
                                <span>Authenticating...</span>
                            </>
                        ) : (
                            <>
                                <ShieldCheck size={16} />
                                <span>Sign In</span>
                            </>
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
}
