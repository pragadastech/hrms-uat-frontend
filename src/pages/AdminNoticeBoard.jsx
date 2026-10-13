import React, { useState, useEffect, useRef } from 'react';
import {
    Bell, Pin, AlertTriangle, Info, CheckCircle, XCircle,
    Plus, Edit2, Trash2, Eye, RefreshCw, Calendar, Search, Filter, MoreVertical, X,
    ExternalLink, MapPin, Hash, Trash, Check, Clock, ChevronRight, ChevronDown
} from 'lucide-react';
import { noticeAPI } from '../services/api';
import Header from '../components/Header';
import './AdminNoticeBoard.css';

const formatSelectLabel = (value) =>
    value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, ' ');

function NoticeFormSelect({ value, onChange, options, id, 'aria-label': ariaLabel }) {
    const [open, setOpen] = useState(false);
    const rootRef = useRef(null);

    useEffect(() => {
        if (!open) return undefined;
        const onPointerDown = (e) => {
            if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
        };
        const onKeyDown = (e) => {
            if (e.key === 'Escape') setOpen(false);
        };
        document.addEventListener('mousedown', onPointerDown);
        document.addEventListener('keydown', onKeyDown);
        return () => {
            document.removeEventListener('mousedown', onPointerDown);
            document.removeEventListener('keydown', onKeyDown);
        };
    }, [open]);

    const selectedLabel = formatSelectLabel(value);

    return (
        <div className="notice-custom-select" ref={rootRef}>
            <button
                type="button"
                id={id}
                className="form-select notice-custom-select-trigger"
                aria-label={ariaLabel}
                aria-haspopup="listbox"
                aria-expanded={open}
                onClick={() => setOpen((prev) => !prev)}
            >
                <span>{selectedLabel}</span>
                <ChevronDown size={18} className={`notice-custom-select-chevron${open ? ' is-open' : ''}`} aria-hidden />
            </button>
            {open && (
                <ul className="notice-custom-select-menu" role="listbox" aria-labelledby={id}>
                    {options.map((opt) => {
                        const isSelected = opt === value;
                        return (
                            <li key={opt} role="presentation">
                                <button
                                    type="button"
                                    role="option"
                                    aria-selected={isSelected}
                                    className={isSelected ? 'is-selected' : ''}
                                    onClick={() => {
                                        onChange(opt);
                                        setOpen(false);
                                    }}
                                >
                                    {formatSelectLabel(opt)}
                                </button>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}

export default function AdminNoticeBoard() {
    const [notices, setNotices] = useState([]);
    const [stats, setStats] = useState({ total: 0, active: 0, pinned: 0, urgent: 0 });
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('ALL');
    const [searchQuery, setSearchQuery] = useState('');

    // Modal States
    const [showModal, setShowModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [selectedNotice, setSelectedNotice] = useState(null);
    const [showViewModal, setShowViewModal] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        title: '', content: '', category: 'GENERAL', priority: 'NORMAL',
        pinned: false, active: true, expiresAt: ''
    });

    const categories = ['GENERAL', 'ANNOUNCEMENT', 'POLICY', 'EVENT', 'MAINTENANCE', 'SECURITY', 'OTHER'];
    const priorities = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [noticesRes, statsRes] = await Promise.all([
                noticeAPI.getAllNotices(),
                noticeAPI.getNoticeStatistics()
            ]);
            setNotices(Array.isArray(noticesRes.data) ? noticesRes.data : []);
            const s = statsRes.data || {};
            setStats({
                total: s.totalNotices || 0,
                active: s.activeNotices || 0,
                pinned: s.pinnedNotices || 0,
                urgent: s.urgentNotices || 0
            });
        } catch (e) {
            console.error('Failed to fetch notices', e);
        } finally {
            setTimeout(() => setLoading(false), 300); // Small delay for smoother transition
        }
    };

    const filteredNotices = notices.filter(n => {
        const matchesTab = activeTab === 'ALL' ||
            (activeTab === 'ACTIVE' && n.active) ||
            (activeTab === 'PINNED' && n.pinned) ||
            (activeTab === 'URGENT' && n.priority === 'URGENT') ||
            (activeTab === 'INACTIVE' && !n.active);

        const matchesSearch = n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            n.content.toLowerCase().includes(searchQuery.toLowerCase());

        return matchesTab && matchesSearch;
    });

    const handleEdit = (notice) => {
        setSelectedNotice(notice);
        setIsEditing(true);
        let expiry = '';
        if (notice.expiresAt) {
            try {
                const d = new Date(notice.expiresAt);
                expiry = new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
            } catch (e) { }
        }
        setFormData({
            title: notice.title,
            content: notice.content,
            category: notice.category,
            priority: notice.priority,
            pinned: notice.pinned || false,
            active: notice.active !== undefined ? notice.active : true,
            expiresAt: expiry
        });
        setShowModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const payload = { ...formData };
            
            // Safer date conversion
            if (payload.expiresAt && payload.expiresAt.trim() !== '') {
                const dateObj = new Date(payload.expiresAt);
                if (!isNaN(dateObj.getTime())) {
                    payload.expiresAt = dateObj.toISOString();
                } else {
                    delete payload.expiresAt; // Remove if invalid
                }
            } else {
                delete payload.expiresAt; // Ensure it's not an empty string
            }

            if (isEditing && selectedNotice) {
                await noticeAPI.updateNotice(selectedNotice.id, payload);
            } else {
                await noticeAPI.createNotice(payload);
            }
            setShowModal(false);
            fetchData();
        } catch (err) {
            console.error('Notice operation failed:', err);
            // Show more helpful error message if available
            const errorMsg = err.response?.data?.message || err.message || 'Operation failed';
            alert(`Failed to ${isEditing ? 'update' : 'create'} notice: ${errorMsg}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure you want to delete this notice?')) {
            try {
                await noticeAPI.deleteNotice(id);
                fetchData();
            } catch (e) { alert('Failed to delete notice'); }
        }
    };

    const togglePin = async (id) => {
        try { await noticeAPI.togglePinNotice(id); fetchData(); } catch (e) { }
    };

    const getCategoryClass = (category) => {
        const cat = category.toLowerCase();
        if (cat === 'general') return 'category-general';
        if (cat === 'announcement') return 'category-announcement';
        if (cat === 'policy') return 'category-policy';
        if (cat === 'event') return 'category-event';
        if (cat === 'maintenance') return 'category-maintenance';
        if (cat === 'urgent' || cat === 'security') return 'category-urgent';
        return 'category-general';
    };

    return (
        <div className="main-content notice-board-wrapper">
            <Header 
                title="Notice Board" 
                subtitle="Publish and manage organization announcements with ease" 
            />
            
            <div className="notice-board-container">

            {/* Stats Grid */}
            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-header">
                        <span className="stat-title">Total Notices</span>
                        <div className="stat-icon-wrapper bg-blue-50">
                            <Bell size={24} className="text-blue-600" />
                        </div>
                    </div>
                    <div className="stat-value">{stats.total}</div>
                </div>
                <div className="stat-card">
                    <div className="stat-header">
                        <span className="stat-title">Active Now</span>
                        <div className="stat-icon-wrapper bg-emerald-50">
                            <CheckCircle size={24} className="text-emerald-600" />
                        </div>
                    </div>
                    <div className="stat-value text-emerald-600">{stats.active}</div>
                </div>
                <div className="stat-card">
                    <div className="stat-header">
                        <span className="stat-title">Important</span>
                        <div className="stat-icon-wrapper bg-indigo-50">
                            <Pin size={24} className="text-indigo-600" />
                        </div>
                    </div>
                    <div className="stat-value text-indigo-600">{stats.pinned}</div>
                </div>
                <div className="stat-card">
                    <div className="stat-header">
                        <span className="stat-title">Urgent Tasks</span>
                        <div className="stat-icon-wrapper bg-rose-50">
                            <AlertTriangle size={24} className="text-rose-600" />
                        </div>
                    </div>
                    <div className="stat-value text-rose-600">{stats.urgent}</div>
                </div>
            </div>

            {/* Filters and Search Row */}
            <div className="control-row">
                <div className="controls-left">
                    <div className="search-wrapper">
                        <input
                            type="text"
                            className="search-input"
                            placeholder="Search notices by title or content..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <div className="tabs-wrapper">
                        {['ALL', 'ACTIVE', 'PINNED', 'URGENT', 'INACTIVE'].map(tab => (
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
                <button className="create-btn" onClick={() => {
                    setIsEditing(false);
                    setFormData({ title: '', content: '', category: 'GENERAL', priority: 'NORMAL', pinned: false, active: true, expiresAt: '' });
                    setShowModal(true);
                }}>
                    <Plus size={20} /> Create New Notice
                </button>
            </div>

            {/* Notices View */}
            {loading ? (
                <div className="flex flex-col items-center justify-center p-12" style={{ minHeight: '180px' }}>
                    <div className="relative">
                        <RefreshCw className="animate-spin text-primary" size={64} />
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-4 h-4 bg-primary rounded-full animate-pulse"></div>
                        </div>
                    </div>
                    <p className="mt-6 text-slate-500 font-bold tracking-tight">Syncing Notice Board...</p>
                </div>
            ) : filteredNotices.length > 0 ? (
                <div className="notices-grid">
                    {filteredNotices.map((notice, index) => (
                        <div 
                            key={notice.id} 
                            className={`notice-card ${notice.pinned ? 'pinned' : ''}`}
                            style={{ animationDelay: `${index * 0.05}s` }}
                        >
                            <div className="card-header">
                                <span className={`card-category ${getCategoryClass(notice.category)}`}>
                                    {notice.category.replace('_', ' ')}
                                </span>
                                <div className={`priority-badge ${
                                    notice.priority === 'URGENT' ? 'text-rose-600' : 
                                    notice.priority === 'HIGH' ? 'text-orange-500' : 'text-slate-400'
                                }`}>
                                    {notice.priority === 'URGENT' && <AlertTriangle size={14} />}
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
                                    <button className="action-btn" title="View Details" onClick={() => { setSelectedNotice(notice); setShowViewModal(true); }}>
                                        <Eye size={18} />
                                    </button>
                                    <button className="action-btn" title="Edit Notice" onClick={() => handleEdit(notice)}>
                                        <Edit2 size={18} />
                                    </button>
                                    <button 
                                        className={`action-btn pin ${notice.pinned ? 'active' : ''}`} 
                                        title={notice.pinned ? "Unpin Notice" : "Pin Notice"} 
                                        onClick={() => togglePin(notice.id)}
                                    >
                                        <Pin size={18} fill={notice.pinned ? 'currentColor' : 'none'} />
                                    </button>
                                    <button className="action-btn delete" title="Remove" onClick={() => handleDelete(notice.id)}>
                                        <Trash2 size={18} />
                                    </button>
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
                    <h3 className="empty-title">No announcements found</h3>
                    <p className="empty-subtitle">
                        {searchQuery ? 
                            `We couldn't find any notices matching "${searchQuery}". Try a different keyword.` : 
                            "Your notice board is currently empty. Start by publishing your first announcement to the organization."
                        }
                    </p>
                    {!searchQuery && (
                        <button className="create-btn mt-8" onClick={() => {
                            setIsEditing(false);
                            setFormData({ title: '', content: '', category: 'GENERAL', priority: 'NORMAL', pinned: false, active: true, expiresAt: '' });
                            setShowModal(true);
                        }}>
                            <Plus size={20} /> Create Your First Notice
                        </button>
                    )}
                </div>
            )}

            </div>

            {/* Create/Edit Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={(e) => e.target.className === 'modal-overlay' && setShowModal(false)}>
                    <div className="modal-container">
                        <div className="modal-header">
                            <h3 className="modal-title">
                                {isEditing ? 'Update Notice' : 'Publish New Notice'}
                            </h3>
                            <button className="action-btn" onClick={() => setShowModal(false)}>
                                <X size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
                            <div className="modal-body">
                                <div className="form-grid">
                                    <div className="form-group">
                                        <label className="form-label">Notice Title</label>
                                        <input
                                            type="text"
                                            className="form-input"
                                            placeholder="e.g. Annual Company Offsite 2024"
                                            required
                                            value={formData.title}
                                            onChange={e => setFormData({ ...formData, title: e.target.value })}
                                        />
                                    </div>

                                    <div className="form-grid form-grid-2cols">
                                        <div className="form-group">
                                            <label className="form-label" htmlFor="notice-category">Category</label>
                                            <NoticeFormSelect
                                                id="notice-category"
                                                aria-label="Category"
                                                value={formData.category}
                                                options={categories}
                                                onChange={(category) => setFormData({ ...formData, category })}
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label" htmlFor="notice-priority">Priority Level</label>
                                            <NoticeFormSelect
                                                id="notice-priority"
                                                aria-label="Priority level"
                                                value={formData.priority}
                                                options={priorities}
                                                onChange={(priority) => setFormData({ ...formData, priority })}
                                            />
                                        </div>
                                    </div>

                                    <div className="form-group">
                                        <label className="form-label">Detailed Content</label>
                                        <textarea
                                            className="form-textarea"
                                            placeholder="Write your announcement details here..."
                                            required
                                            value={formData.content}
                                            onChange={e => setFormData({ ...formData, content: e.target.value })}
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label className="form-label">Expiration Date (Optional)</label>
                                        <input
                                            type="datetime-local"
                                            className="form-input"
                                            value={formData.expiresAt}
                                            onChange={e => setFormData({ ...formData, expiresAt: e.target.value })}
                                        />
                                    </div>

                                    <div className="checkbox-row">
                                        <label className="checkbox-label">
                                            <input
                                                type="checkbox"
                                                className="checkbox-input"
                                                checked={formData.pinned}
                                                onChange={e => setFormData({ ...formData, pinned: e.target.checked })}
                                            />
                                            <span>Pin to important</span>
                                        </label>
                                        <label className="checkbox-label">
                                            <input
                                                type="checkbox"
                                                className="checkbox-input"
                                                checked={formData.active}
                                                onChange={e => setFormData({ ...formData, active: e.target.checked })}
                                            />
                                            <span>Immediate Visibility</span>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            <div className="modal-footer">
                                <button
                                    type="button"
                                    className="filter-tab"
                                    style={{ flex: 1, padding: '14px', border: '1.5px solid var(--border)' }}
                                    onClick={() => setShowModal(false)}
                                >
                                    Discard
                                </button>
                                <button
                                    type="submit"
                                    className="create-btn"
                                    style={{ flex: 1.5 }}
                                    disabled={isSubmitting}
                                >
                                    {isSubmitting ? (
                                        <>
                                            <RefreshCw size={18} className="animate-spin" />
                                            {isEditing ? 'Saving...' : 'Publishing...'}
                                        </>
                                    ) : (
                                        isEditing ? 'Save Changes' : 'Publish Notice'
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* View Modal */}
            {showViewModal && selectedNotice && (
                <div className="modal-overlay" onClick={(e) => e.target.className === 'modal-overlay' && setShowViewModal(false)}>
                    <div className="modal-container">
                        <div className="modal-header">
                            <div className="flex flex-col">
                                <div className="flex items-center gap-3">
                                    <h3 className="modal-title">{selectedNotice.title}</h3>
                                    {selectedNotice.pinned && <Pin size={20} className="text-primary" fill="currentColor" />}
                                </div>
                                <div className="flex gap-2 mt-2">
                                    <span className={`card-category ${getCategoryClass(selectedNotice.category)}`}>
                                        {selectedNotice.category.replace('_', ' ')}
                                    </span>
                                    <span className={`card-category ${selectedNotice.priority === 'URGENT' ? 'category-urgent' : 'category-general'}`}>
                                        {selectedNotice.priority}
                                    </span>
                                </div>
                            </div>
                            <button className="action-btn" onClick={() => setShowViewModal(false)}>
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
                                        <span>Expires on {new Date(selectedNotice.expiresAt).toLocaleDateString()}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button 
                                className="create-btn" 
                                style={{ width: '100%' }}
                                onClick={() => setShowViewModal(false)}
                            >
                                Done
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
