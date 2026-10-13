import React, { useState, useEffect } from 'react';
import {
    Bell, Pin, AlertTriangle, CheckCircle, Info, Calendar, RefreshCw, X, Clock, Eye, Search
} from 'lucide-react';
import { noticeAPI } from '../services/api';
import Header from '../components/Header';
import './AdminNoticeBoard.css'; // Reuse the premium styles

export default function NoticeBoard() {
    const [notices, setNotices] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedNotice, setSelectedNotice] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState('ALL');

    useEffect(() => {
        fetchNotices();
    }, []);

    const fetchNotices = async () => {
        setLoading(true);
        try {
            const res = await noticeAPI.getActiveNotices();
            setNotices(Array.isArray(res.data) ? res.data : []);
        } catch (e) {
            console.error('Failed to fetch notices');
        } finally {
            setTimeout(() => setLoading(false), 400);
        }
    };

    const getCategoryClass = (category) => {
        const cat = category?.toLowerCase() || 'general';
        if (cat === 'general') return 'category-general';
        if (cat === 'announcement') return 'category-announcement';
        if (cat === 'policy') return 'category-policy';
        if (cat === 'event') return 'category-event';
        if (cat === 'maintenance') return 'category-maintenance';
        if (cat === 'urgent' || cat === 'security') return 'category-urgent';
        return 'category-general';
    };

    const filteredNotices = notices.filter(n => {
        const matchesTab = activeTab === 'ALL' ||
            (activeTab === 'PINNED' && n.pinned) ||
            (activeTab === 'URGENT' && n.priority === 'URGENT');

        const matchesSearch = n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            n.content.toLowerCase().includes(searchQuery.toLowerCase());

        return matchesTab && matchesSearch;
    });

    return (
        <div className="main-content notice-board-wrapper">
            <Header title="Notice Board" subtitle="Stay updated with the latest company announcements" />
            
            <div className="notice-board-container">

            {/* Simple Stats for Employees */}
            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-header">
                        <span className="stat-title">Active Notices</span>
                        <div className="stat-icon-wrapper bg-blue-50">
                            <Bell size={24} className="text-blue-600" />
                        </div>
                    </div>
                    <div className="stat-value">{notices.length}</div>
                </div>
                <div className="stat-card">
                    <div className="stat-header">
                        <span className="stat-title">Important</span>
                        <div className="stat-icon-wrapper bg-indigo-50">
                            <Pin size={24} className="text-indigo-600" />
                        </div>
                    </div>
                    <div className="stat-value text-indigo-600">{notices.filter(n => n.pinned).length}</div>
                </div>
            </div>

            {/* Controls for Employees */}
            <div className="control-row">
                <div className="controls-left">
                    <div className="search-wrapper">
                        <input
                            type="text"
                            className="search-input"
                            placeholder="Filter announcements..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <div className="tabs-wrapper">
                        {['ALL', 'PINNED', 'URGENT'].map(tab => (
                            <button
                                key={tab}
                                className={`filter-tab ${activeTab === tab ? 'active' : ''}`}
                                onClick={() => setActiveTab(tab)}
                            >
                                {tab.charAt(0) + tab.slice(1).toLowerCase()}
                            </button>
                        ))}
                    </div>
                </div>
                <button className="create-btn" onClick={fetchNotices} disabled={loading}>
                    <RefreshCw size={18} className={loading ? 'animate-spin' : ''} /> Refresh Board
                </button>
            </div>

            {/* Notice Grid */}
            {loading ? (
                <div className="flex flex-col items-center justify-center p-12" style={{ minHeight: '180px' }}>
                    <RefreshCw className="animate-spin text-primary" size={64} />
                    <p className="mt-6 text-slate-500 font-bold tracking-tight">Updating Notice Board...</p>
                </div>
            ) : filteredNotices.length > 0 ? (
                <div className="notices-grid">
                    {filteredNotices.map((notice, index) => (
                        <div
                            key={notice.id}
                            className={`notice-card ${notice.pinned ? 'pinned' : ''}`}
                            onClick={() => setSelectedNotice(notice)}
                            style={{ animationDelay: `${index * 0.05}s`, cursor: 'pointer' }}
                        >
                            <div className="card-header">
                                <span className={`card-category ${getCategoryClass(notice.category)}`}>
                                    {notice.category?.replace('_', ' ') || 'General'}
                                </span>
                                <div className={`priority-badge ${
                                    notice.priority === 'URGENT' ? 'text-rose-600' : 
                                    notice.priority === 'HIGH' ? 'text-orange-500' : 'text-slate-400'
                                }`}>
                                    {notice.priority}
                                </div>
                            </div>
                            <h3 className="card-title">{notice.title}</h3>
                            <p className="card-content">{notice.content}</p>
                            <div className="card-footer">
                                <div className="card-date">
                                    <Calendar size={16} />
                                    <span>{new Date(notice.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                </div>
                                <div className="card-actions">
                                    <div className="action-btn" title="View Full Notice">
                                        <Eye size={18} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="empty-state">
                    <div className="empty-icon">
                        <Bell size={64} />
                    </div>
                    <h3 className="empty-title">All caught up!</h3>
                    <p className="empty-subtitle">
                        {searchQuery ? 
                            `No results for "${searchQuery}" in your announcements.` : 
                            "There are no active notices for you at the moment."
                        }
                    </p>
                </div>
            )}

            </div>

            {/* View Modal */}
            {selectedNotice && (
                <div className="modal-overlay" onClick={() => setSelectedNotice(null)}>
                    <div className="modal-container" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <div className="flex flex-col">
                                <div className="flex items-center gap-3">
                                    <h3 className="modal-title">{selectedNotice.title}</h3>
                                    {selectedNotice.pinned && <Pin size={20} className="text-primary" fill="currentColor" />}
                                </div>
                                <div className="flex gap-2 mt-2">
                                    <span className={`card-category ${getCategoryClass(selectedNotice.category)}`}>
                                        {selectedNotice.category?.replace('_', ' ') || 'General'}
                                    </span>
                                </div>
                            </div>
                            <button className="action-btn" onClick={() => setSelectedNotice(null)}>
                                <X size={24} />
                            </button>
                        </div>
                        <div className="modal-body">
                            <div className="view-notice-content">
                                {selectedNotice.content}
                            </div>
                            
                            <div className="view-modal-info">
                                <div className="info-item">
                                    <Calendar size={18} className="text-primary" />
                                    <span>Posted on {new Date(selectedNotice.createdAt).toLocaleDateString(undefined, { 
                                        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
                                    })}</span>
                                </div>
                                {selectedNotice.expiresAt && (
                                    <div className="info-item">
                                        <Clock size={18} className="text-rose-500" />
                                        <span>Available until {new Date(selectedNotice.expiresAt).toLocaleDateString()}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button 
                                className="create-btn" 
                                style={{ width: '100%' }}
                                onClick={() => setSelectedNotice(null)}
                            >
                                Understood
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
