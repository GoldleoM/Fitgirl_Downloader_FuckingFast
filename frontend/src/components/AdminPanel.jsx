import React from 'react';
import { X, LogOut, ShieldCheck } from 'lucide-react';

export default function AdminPanel({ isOpen, onClose, adminUser, onLogout }) {
    if (!isOpen || !adminUser) return null;

    return (
        <div className="admin-panel-overlay" onClick={onClose}>
            <div className="admin-panel-container" onClick={(e) => e.stopPropagation()}>
                <div className="admin-panel-header">
                    <div className="admin-panel-title-group">
                        <ShieldCheck size={22} className="text-neon" />
                        <div>
                            <h2>Admin Panel</h2>
                            <span className="admin-email-tag">{adminUser.email}</span>
                        </div>
                    </div>
                    <div className="admin-header-actions">
                        <button className="admin-logout-btn" onClick={onLogout} title="Sign Out">
                            <LogOut size={16} />
                            <span>Logout</span>
                        </button>
                        <button className="admin-panel-close" onClick={onClose}>
                            <X size={20} />
                        </button>
                    </div>
                </div>

                <div className="admin-panel-content">
                    <div className="admin-empty-state">
                        <ShieldCheck size={36} className="text-neon" />
                        <span>Admin panel coming soon.</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
