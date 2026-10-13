import React, { useState, useEffect } from 'react';
import {
    Search, Plus, RefreshCw, Filter, Trash2, Edit2,
    UserPlus, CheckCircle, AlertTriangle, Monitor,
    Smartphone, HardDrive, Headphones, Briefcase, Package,
    ArrowRightLeft, History, Wrench, Ticket, ShieldAlert, LayoutDashboard, MoreVertical
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { adminAPI, locationsAPI } from '../services/api';
import { toast } from 'react-hot-toast';
import Header from '../components/Header';
import DatePicker from '../components/DatePicker';
import './AssetManagement.css';

function formatDate(value) {
    if (!value) return '—';
    const d = typeof value === 'string' ? new Date(value) : value;
    return isNaN(d.getTime()) ? value : d.toLocaleDateString();
}

const formatEventType = (type) => {
    switch (type) {
        case 'CREATED': return 'Asset Created';
        case 'UPDATED': return 'Asset Details Updated';
        case 'ASSIGNED': return 'Asset Assigned';
        case 'RETURNED': return 'Asset Returned';
        case 'TRANSFERRED': return 'Asset Transferred';
        case 'STATUS_CHANGED': return 'Status Changed';
        case 'MAINTENANCE_LOGGED': return 'Maintenance Logged';
        case 'TICKET_OPENED': return 'Support Ticket Opened';
        case 'TICKET_UPDATED': return 'Support Ticket Updated';
        case 'TICKET_CLOSED': return 'Support Ticket Closed';
        case 'WARRANTY_ALERT': return 'Warranty Alert';
        default: return type ? type.replace(/_/g, ' ') : 'Event';
    }
};

const getEventTypeStyle = (type) => {
    switch (type) {
        case 'CREATED': return { color: '#475569', bg: '#f1f5f9' };
        case 'UPDATED': return { color: '#475569', bg: '#f1f5f9' };
        case 'ASSIGNED': return { color: '#1d4ed8', bg: '#dbeafe' };
        case 'RETURNED': return { color: '#047857', bg: '#d1fae5' };
        case 'TRANSFERRED': return { color: '#7c3aed', bg: '#ede9fe' };
        case 'STATUS_CHANGED': return { color: '#0369a1', bg: '#e0f2fe' };
        case 'MAINTENANCE_LOGGED': return { color: '#b45309', bg: '#fef3c7' };
        case 'TICKET_OPENED': return { color: '#b91c1c', bg: '#fee2e2' };
        case 'TICKET_UPDATED': return { color: '#a21caf', bg: '#fdf4ff' };
        case 'TICKET_CLOSED': return { color: '#15803d', bg: '#dcfce7' };
        case 'WARRANTY_ALERT': return { color: '#c2410c', bg: '#ffedd5' };
        default: return { color: '#475569', bg: '#f1f5f9' };
    }
};

const assetTypes = [
    { value: 'LAPTOP', label: 'Laptop', icon: Monitor },
    { value: 'MOBILE', label: 'Mobile', icon: Smartphone },
    { value: 'TABLET', label: 'Tablet', icon: Smartphone },
    { value: 'MONITOR', label: 'Monitor', icon: Monitor },
    { value: 'KEYBOARD', label: 'Keyboard', icon: HardDrive },
    { value: 'MOUSE', label: 'Mouse', icon: HardDrive },
    { value: 'HEADPHONES', label: 'Headphones', icon: Headphones },
    { value: 'CHARGER', label: 'Charger', icon: HardDrive },
    { value: 'BAG', label: 'Bag/Case', icon: Briefcase },
    { value: 'OTHER', label: 'Other', icon: HardDrive },
];

const statusConfig = {
    AVAILABLE: { label: 'Available', color: '#059669', bg: '#D1FAE5' },
    ASSIGNED: { label: 'Assigned', color: '#2563EB', bg: '#DBEAFE' },
    MAINTENANCE: { label: 'Maintenance', color: '#D97706', bg: '#FEF3C7' },
    RETIRED: { label: 'Retired', color: '#6B7280', bg: '#F3F4F6' },
    LOST: { label: 'Lost', color: '#DC2626', bg: '#FEE2E2' },
    DAMAGED: { label: 'Damaged', color: '#DC2626', bg: '#FEE2E2' },
};

const ticketTypes = ['REPAIR', 'DAMAGE', 'LOST', 'REPLACEMENT', 'MAINTENANCE'];
const ticketStatuses = ['OPEN', 'IN_PROGRESS', 'WAITING_PARTS', 'RESOLVED', 'CLOSED', 'REJECTED'];

export default function AssetManagement() {
    const { user } = useAuth();
    const [assets, setAssets] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('inventory');
    const [showAddModal, setShowAddModal] = useState(false);
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [showTransferModal, setShowTransferModal] = useState(false);
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [showTicketModal, setShowTicketModal] = useState(false);
    const [showMaintenanceModal, setShowMaintenanceModal] = useState(false);
    const [showStatusModal, setShowStatusModal] = useState(false);
    const [statusFormValue, setStatusFormValue] = useState('');
    const [showReturnConfirmModal, setShowReturnConfirmModal] = useState(false);
    const [pendingReturnAssetId, setPendingReturnAssetId] = useState(null);
    const [selectedAsset, setSelectedAsset] = useState(null);
    const [filterType, setFilterType] = useState('ALL');
    const [filterStatus, setFilterStatus] = useState('ALL');
    const [searchTerm, setSearchTerm] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [locations, setLocations] = useState([]);
    
    // File upload and ticket closure states
    const [uploadingFile, setUploadingFile] = useState(false);
    const [returnImageUrl, setReturnImageUrl] = useState('');
    const [showCloseTicketModal, setShowCloseTicketModal] = useState(false);
    const [pendingTicket, setPendingTicket] = useState(null);
    const [pendingTicketStatus, setPendingTicketStatus] = useState('');
    const [ticketResolutionNotes, setTicketResolutionNotes] = useState('');
    const [ticketResolutionImageUrl, setTicketResolutionImageUrl] = useState('');

    const [dashboard, setDashboard] = useState(null);
    const [tickets, setTickets] = useState([]);
    const [maintenanceLogs, setMaintenanceLogs] = useState([]);
    const [history, setHistory] = useState([]);
    const [assetTickets, setAssetTickets] = useState([]);
    const [assetMaintenance, setAssetMaintenance] = useState([]);
    const [historyTab, setHistoryTab] = useState('lifecycle');
    const [activeDropdownId, setActiveDropdownId] = useState(null);
    const [transferData, setTransferData] = useState({ assetId: null, toEmployeeId: '', notes: '', location: '', imageUrl: '' });
    const [ticketForm, setTicketForm] = useState({
        assetId: null, ticketType: 'REPAIR', priority: 'MEDIUM', subject: '', description: '', imageUrl: '', taggedEmployeeId: '',
    });
    const [maintenanceForm, setMaintenanceForm] = useState({
        assetId: null, vendor: '', cost: '', maintenanceType: 'GENERAL', description: '',
        startedAt: '', completedAt: '', outcomeNotes: '', imageUrl: '', taggedEmployeeId: '',
    });

    const [formData, setFormData] = useState({
        assetId: '', assetName: '', assetType: '', brand: '', model: '',
        serialNumber: '', purchaseDate: '', warrantyExpiry: '', purchaseCost: '', currentValue: '',
        conditionNotes: '', location: '', quantity: 1, imageUrl: '',
        configuration: '', notes: '',
    });

    const [assignmentData, setAssignmentData] = useState({
        assetId: null, employeeId: '', notes: '', location: '',
    });

    useEffect(() => {
        fetchAssets();
        fetchEmployees();
        fetchLocations();
    }, []);

    useEffect(() => {
        if (activeTab === 'dashboard') fetchDashboard();
        if (activeTab === 'tickets') fetchTickets();
        if (activeTab === 'maintenance') fetchMaintenance();
    }, [activeTab]);

    useEffect(() => {
        const handleOutsideClick = () => setActiveDropdownId(null);
        window.addEventListener('click', handleOutsideClick);
        return () => window.removeEventListener('click', handleOutsideClick);
    }, []);

    const fetchAssets = async () => {
        try {
            setLoading(true);
            const response = await adminAPI.getAllAssets();
            setAssets(response.data || []);
        } catch (error) {
            console.error('Error fetching assets:', error);
            toast.error('Failed to load assets');
        } finally {
            setLoading(false);
        }
    };

    const fetchEmployees = async () => {
        try {
            const response = await adminAPI.getActiveEmployees();
            setEmployees(response.data || []);
        } catch (error) {
            console.error('Error fetching employees:', error);
        }
    };

    const fetchLocations = async () => {
        try {
            const response = await locationsAPI.list(0, 100);
            const locList = Array.isArray(response.data?.items) ? response.data.items : (Array.isArray(response.data) ? response.data : []);
            setLocations(locList);
        } catch (error) {
            console.error('Error fetching locations:', error);
        }
    };

    const fetchDashboard = async () => {
        try {
            const res = await adminAPI.getAssetDashboard();
            setDashboard(res.data || null);
        } catch (e) {
            toast.error('Failed to load asset dashboard');
        }
    };

    const fetchTickets = async () => {
        try {
            const res = await adminAPI.getAssetTickets();
            setTickets(Array.isArray(res.data) ? res.data : []);
        } catch (e) {
            toast.error('Failed to load tickets');
        }
    };

    const fetchMaintenance = async () => {
        try {
            const res = await adminAPI.getAssetMaintenance();
            setMaintenanceLogs(Array.isArray(res.data) ? res.data : []);
        } catch (e) {
            toast.error('Failed to load maintenance logs');
        }
    };

    const openHistory = async (asset) => {
        setSelectedAsset(asset);
        setShowHistoryModal(true);
        setHistoryTab('lifecycle');
        try {
            const [historyRes, ticketsRes, maintenanceRes] = await Promise.allSettled([
                adminAPI.getAssetHistory(asset.id),
                adminAPI.getAssetTicketsForAsset(asset.id),
                adminAPI.getAssetMaintenanceForAsset(asset.id)
            ]);
            setHistory(historyRes.status === 'fulfilled' && Array.isArray(historyRes.value?.data) ? historyRes.value.data : []);
            setAssetTickets(ticketsRes.status === 'fulfilled' && Array.isArray(ticketsRes.value?.data) ? ticketsRes.value.data : []);
            setAssetMaintenance(maintenanceRes.status === 'fulfilled' && Array.isArray(maintenanceRes.value?.data) ? maintenanceRes.value.data : []);
        } catch (e) {
            setHistory([]);
            setAssetTickets([]);
            setAssetMaintenance([]);
            toast.error('Failed to load asset details');
        }
    };

    const openTransfer = (asset) => {
        setTransferData({ assetId: asset.id, toEmployeeId: '', notes: '', location: asset.location || '' });
        setSelectedAsset(asset);
        setShowTransferModal(true);
        if (!employees || employees.length === 0) {
            fetchEmployees();
        }
    };

    const openTicket = (asset) => {
        setTicketForm({
            assetId: asset?.id || null,
            ticketType: 'REPAIR',
            priority: 'MEDIUM',
            subject: asset ? `${asset.assetName} issue` : '',
            description: '',
            taggedEmployeeId: '',
        });
        setSelectedAsset(asset || null);
        setShowTicketModal(true);
    };

    const openMaintenance = (asset) => {
        setMaintenanceForm({
            assetId: asset?.id || null,
            vendor: '', cost: '', maintenanceType: 'GENERAL', description: '',
            startedAt: '', completedAt: '', outcomeNotes: '', imageUrl: '',
            taggedEmployeeId: '',
        });
        setSelectedAsset(asset || null);
        setShowMaintenanceModal(true);
    };

    const handleFileChange = async (e, setUrlCallback) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) {
            toast.error('File size exceeds 5MB limit');
            return;
        }

        const allowedExtensions = ['.png', '.jpg', '.jpeg', '.webp', '.pdf'];
        const fileExt = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
        if (!allowedExtensions.includes(fileExt)) {
            toast.error('Unsupported file format. Only PDF, PNG, JPG, JPEG, WEBP are supported');
            return;
        }

        setUploadingFile(true);
        try {
            const res = await adminAPI.uploadAssetFile(file);
            if (res.data?.url) {
                setUrlCallback(res.data.url);
                toast.success('File uploaded successfully');
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'File upload failed');
        } finally {
            setUploadingFile(false);
        }
    };

    const handleTransfer = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            await adminAPI.transferAsset({
                assetId: transferData.assetId,
                toEmployeeId: Number(transferData.toEmployeeId),
                notes: transferData.notes || null,
                location: transferData.location || null,
                imageUrl: transferData.imageUrl || null,
            });
            toast.success('Asset transferred');
            setShowTransferModal(false);
            fetchAssets();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Transfer failed');
        } finally {
            setSubmitting(false);
        }
    };

    const handleCreateTicket = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            let desc = ticketForm.description || '';
            if (ticketForm.taggedEmployeeId) {
                const emp = employees.find(m => String(m.id || m.employeeId) === String(ticketForm.taggedEmployeeId));
                if (emp) {
                    const empName = `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || emp.employeeId;
                    desc = `[User: ${empName} (${emp.employeeId || 'NA'})] ${desc}`;
                }
            }
            await adminAPI.createAssetTicket({
                ...ticketForm,
                assetId: Number(ticketForm.assetId),
                description: desc || null,
                imageUrl: ticketForm.imageUrl || null,
            });
            toast.success('Ticket created');
            setShowTicketModal(false);
            if (activeTab === 'tickets') fetchTickets();
            fetchAssets();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to create ticket');
        } finally {
            setSubmitting(false);
        }
    };

    const handleUpdateTicketStatus = async (ticket, status) => {
        if (status === 'RESOLVED' || status === 'CLOSED') {
            setPendingTicket(ticket);
            setPendingTicketStatus(status);
            setTicketResolutionNotes('');
            setTicketResolutionImageUrl('');
            setShowCloseTicketModal(true);
            return;
        }
        try {
            await adminAPI.updateAssetTicket(ticket.id, { status });
            toast.success(`Ticket marked ${status}`);
            fetchTickets();
            fetchAssets();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Update failed');
        }
    };

    const handleAddMaintenance = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            let desc = maintenanceForm.description || '';
            if (maintenanceForm.taggedEmployeeId) {
                const emp = employees.find(m => String(m.id || m.employeeId) === String(maintenanceForm.taggedEmployeeId));
                if (emp) {
                    const empName = `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || emp.employeeId;
                    desc = `[User: ${empName} (${emp.employeeId || 'NA'})] ${desc}`;
                }
            }
            await adminAPI.addAssetMaintenance({
                assetId: Number(maintenanceForm.assetId),
                vendor: maintenanceForm.vendor || null,
                cost: maintenanceForm.cost ? Number(maintenanceForm.cost) : null,
                maintenanceType: maintenanceForm.maintenanceType || 'GENERAL',
                description: desc || null,
                outcomeNotes: maintenanceForm.outcomeNotes || null,
                startedAt: maintenanceForm.startedAt || null,
                completedAt: maintenanceForm.completedAt || null,
                imageUrl: maintenanceForm.imageUrl || null,
            });
            toast.success('Maintenance logged');
            setShowMaintenanceModal(false);
            if (activeTab === 'maintenance') fetchMaintenance();
            fetchAssets();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to log maintenance');
        } finally {
            setSubmitting(false);
        }
    };

    const handleStatusChange = async (asset, status) => {
        try {
            await adminAPI.updateAssetStatus(asset.id, { status });
            toast.success(`Status updated to ${status}`);
            fetchAssets();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Status update failed');
        }
    };

    const toDateInputValue = (dateObj) => {
        if (!(dateObj instanceof Date) || Number.isNaN(dateObj.getTime())) return '';
        return dateObj.toLocaleDateString('en-CA');
    };

    const prepareAssetData = (data) => {
        const toNum = (v) => (v === null || v === undefined || String(v).trim() === '') ? null : (typeof v === 'number' ? v : parseFloat(String(v)));
        return {
            assetName: data.assetName || null,
            assetType: data.assetType || null,
            brand: data.brand || null,
            model: data.model || null,
            serialNumber: data.serialNumber || null,
            purchaseDate: data.purchaseDate || null,
            warrantyExpiry: data.warrantyExpiry || null,
            purchaseCost: toNum(data.purchaseCost),
            currentValue: toNum(data.currentValue),
            conditionNotes: data.conditionNotes || null,
            location: data.location || null,
            imageUrl: data.imageUrl || null,
            configuration: data.configuration || null,
            notes: data.notes || null,
            ...(data.assetId ? { assetId: data.assetId } : {}),
        };
    };

    const handleCreateAsset = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const payload = { ...prepareAssetData(formData), quantity: parseInt(formData.quantity) || 1 };
            await adminAPI.createAsset(payload);
            toast.success('Asset created');
            setShowAddModal(false);
            resetForm();
            fetchAssets();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to create asset');
        } finally {
            setSubmitting(false);
        }
    };

    const handleUpdateAsset = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const payload = { ...prepareAssetData(formData), quantity: parseInt(formData.quantity) || 1 };
            await adminAPI.updateAsset(selectedAsset.id, payload);
            toast.success('Asset updated');
            setShowAddModal(false);
            setSelectedAsset(null);
            resetForm();
            fetchAssets();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to update asset');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteAsset = async (assetId) => {
        if (!window.confirm('Delete this asset? This cannot be undone.')) return;
        try {
            await adminAPI.deleteAsset(assetId);
            toast.success('Asset deleted');
            fetchAssets();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to delete asset');
        }
    };

    const handleAssignAsset = async (e) => {
        e.preventDefault();
        
        const asset = assets.find(a => a.id === assignmentData.assetId);
        if (asset && Array.isArray(asset.assignedEmployees)) {
            const alreadyAssigned = asset.assignedEmployees.some(emp => emp.employeeId === Number(assignmentData.employeeId));
            if (alreadyAssigned) {
                toast.error("This asset is already assigned to this employee");
                return;
            }
        }

        setSubmitting(true);
        try {
            await adminAPI.assignAsset({
                assetId: assignmentData.assetId,
                employeeId: Number(assignmentData.employeeId),
                notes: assignmentData.notes || undefined,
                location: assignmentData.location || undefined,
            });
            toast.success('Asset assigned');
            setShowAssignModal(false);
            resetAssignmentForm();
            fetchAssets();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to assign asset');
        } finally {
            setSubmitting(false);
        }
    };

    const handleReturnAsset = (assetId) => {
        setPendingReturnAssetId(assetId);
        setShowReturnConfirmModal(true);
    };

    const confirmReturnAsset = async () => {
        if (!pendingReturnAssetId) return;
        try {
            setSubmitting(true);
            await adminAPI.returnAsset(pendingReturnAssetId, returnImageUrl || null);
            toast.success('Asset returned');
            fetchAssets();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to return asset');
        } finally {
            setSubmitting(false);
            setShowReturnConfirmModal(false);
            setPendingReturnAssetId(null);
            setReturnImageUrl('');
        }
    };

    const openEditModal = (asset) => {
        setSelectedAsset(asset);
        setFormData({
            assetId: asset.assetId || '',
            assetName: asset.assetName || '',
            assetType: asset.assetType || '',
            brand: asset.brand || '',
            model: asset.model || '',
            serialNumber: asset.serialNumber || '',
            purchaseDate: asset.purchaseDate ? asset.purchaseDate.split('T')[0] : '',
            warrantyExpiry: asset.warrantyExpiry ? asset.warrantyExpiry.split('T')[0] : '',
            purchaseCost: asset.purchaseCost ?? '',
            currentValue: asset.currentValue ?? '',
            conditionNotes: asset.conditionNotes || '',
            location: asset.location || '',
            quantity: asset.quantity || 1,
            imageUrl: asset.imageUrl || '',
            configuration: asset.configuration || '',
            notes: asset.notes || '',
        });
        setShowAddModal(true);
    };

    const openAssignModal = (asset) => {
        setAssignmentData({ assetId: asset.id, employeeId: '', notes: '', location: asset.location || '' });
        setShowAssignModal(true);
        if (!employees || employees.length === 0) {
        fetchEmployees();
        }
    };

    const resetForm = () => {
        setFormData({
            assetId: '', assetName: '', assetType: '', brand: '', model: '',
            serialNumber: '', purchaseDate: '', warrantyExpiry: '', purchaseCost: '', currentValue: '',
            conditionNotes: '', location: '', quantity: 1, imageUrl: '',
            configuration: '', notes: '',
        });
    };

    const resetAssignmentForm = () => {
        setAssignmentData({ assetId: null, employeeId: '', notes: '', location: '' });
    };

    const filteredAssets = assets.filter(asset => {
        const matchType = filterType === 'ALL' || asset.assetType === filterType;
        const matchStatus = filterStatus === 'ALL' || asset.status === filterStatus;
        const term = searchTerm.toLowerCase();
        const matchSearch = !term || [asset.assetName, asset.brand, asset.model, asset.assetId].some(
            v => v && String(v).toLowerCase().includes(term)
        );
        return matchType && matchStatus && matchSearch;
    });

    const getStats = () => {
        let total = 0;
        let available = 0;
        let assigned = 0;
        let maintenance = 0;

        assets.forEach(a => {
            const qty = a.quantity || 1;
            const asg = a.assignedQuantity || 0;
            const unasg = Math.max(0, qty - asg);

            total += qty;
            assigned += asg;

            if (a.status === 'MAINTENANCE') {
                maintenance += unasg;
            } else if (!['DAMAGED', 'LOST', 'RETIRED'].includes(a.status)) {
                available += unasg;
            }
        });

        return { total, available, assigned, maintenance };
    };
    const stats = getStats();

    const getTypeIcon = (type) => {
        const t = assetTypes.find(x => x.value === type);
        return t ? t.icon : HardDrive;
    };

    return (
        <div className="main-content asset-page">
            <Header title="Asset Management" subtitle="Manage organization assets and assignments" />

            <div className="page-content">
                <div className="asset-header-bar">
                    <div>
                        <h1>Assets</h1>
                        <p className="asset-subtitle">Enterprise asset inventory, transfers, tickets, and maintenance</p>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button type="button" className="asset-cta" style={{ background: '#4f46e5' }} onClick={() => openTicket(null)}>
                            <Ticket size={18} /> New ticket
                        </button>
                        <button type="button" className="asset-cta" style={{ background: '#d97706' }} onClick={() => openMaintenance(null)}>
                            <Wrench size={18} /> Log maintenance
                        </button>
                    <button
                        type="button"
                        className="asset-cta"
                        onClick={() => { setSelectedAsset(null); resetForm(); setShowAddModal(true); }}
                    >
                        <Plus size={18} />
                        Add asset
                    </button>
                    </div>
                </div>

                <div style={{ display: 'flex', background: '#f1f5f9', padding: '4px', borderRadius: '12px', width: 'fit-content', marginBottom: '24px', flexWrap: 'wrap', gap: '4px' }}>
                    {[
                        { id: 'inventory', label: 'Inventory', icon: Package },
                        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
                        { id: 'tickets', label: 'Tickets', icon: Ticket },
                        { id: 'maintenance', label: 'Maintenance', icon: Wrench },
                    ].map((tab) => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                type="button"
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    padding: '8px 16px',
                                    borderRadius: '8px',
                                    border: 'none',
                                    background: isActive ? '#ffffff' : 'transparent',
                                    color: isActive ? '#0f172a' : '#64748b',
                                    fontWeight: isActive ? 700 : 500,
                                    fontSize: '13px',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)' : 'none'
                                }}
                                onClick={() => setActiveTab(tab.id)}
                            >
                                <Icon size={15} style={{ color: isActive ? '#4f46e5' : '#94a3b8' }} /> {tab.label}
                            </button>
                        );
                    })}
                </div>

                {activeTab === 'dashboard' && dashboard && (
                    <div className="asset-stats" style={{ marginBottom: 24 }}>
                        <div className="asset-stat-card stat-total">
                            <div className="stat-label">Total assets</div>
                            <div className="stat-value">{dashboard.totalAssets ?? 0}</div>
                        </div>
                        <div className="asset-stat-card stat-available">
                            <div className="stat-label">Open tickets</div>
                            <div className="stat-value">{dashboard.openTickets ?? 0}</div>
                        </div>
                        <div className="asset-stat-card stat-assigned">
                            <div className="stat-label">Warranty expiring (90d)</div>
                            <div className="stat-value">{dashboard.warrantyExpiringSoon ?? 0}</div>
                        </div>
                        <div className="asset-stat-card stat-maintenance">
                            <div className="stat-label">Warranty expired</div>
                            <div className="stat-value">{dashboard.warrantyExpired ?? 0}</div>
                        </div>
                        <div className="asset-stat-card">
                            <div className="stat-label">Inventory value</div>
                            <div className="stat-value" style={{ fontSize: 18 }}>
                                {dashboard.totalInventoryValue != null ? Number(dashboard.totalInventoryValue).toLocaleString() : '—'}
                            </div>
                        </div>
                        <div className="asset-stat-card">
                            <div className="stat-label">Maintenance due soon</div>
                            <div className="stat-value">{dashboard.maintenanceDueSoon ?? 0}</div>
                        </div>
                    </div>
                )}

                {activeTab === 'dashboard' && Array.isArray(dashboard?.expiringWarrantyAssets) && dashboard.expiringWarrantyAssets.length > 0 && (
                    <div className="asset-card" style={{ marginBottom: 24, padding: 16 }}>
                        <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                            <ShieldAlert size={18} /> Warranty expiry watchlist
                        </h3>
                        <div style={{ display: 'grid', gap: 8 }}>
                            {dashboard.expiringWarrantyAssets.slice(0, 10).map((a) => (
                                <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f3f4f6', paddingBottom: 6 }}>
                                    <span>{a.assetName} ({a.assetId})</span>
                                    <span style={{ color: '#b45309', fontWeight: 600 }}>{a.warrantyExpiry}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === 'dashboard' && (
                    <div style={{ marginTop: '24px', marginBottom: '24px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', margin: 0 }}>Org Asset Allocations (Employees with Assets)</h3>
                        </div>
                        {(() => {
                            const empMap = {};
                            assets.forEach(asset => {
                                const addAssetToEmp = (empId, empName, empCode) => {
                                    if (!empId) return;
                                    if (!empMap[empId]) {
                                        empMap[empId] = {
                                            id: empId,
                                            name: empName || 'Unknown Employee',
                                            employeeIdCode: empCode || 'N/A',
                                            assets: []
                                        };
                                    }
                                    const exists = empMap[empId].assets.some(a => a.id === asset.id);
                                    if (!exists) {
                                        empMap[empId].assets.push(asset);
                                    }
                                };

                                if (Array.isArray(asset.assignedEmployees) && asset.assignedEmployees.length > 0) {
                                    asset.assignedEmployees.forEach(emp => {
                                        addAssetToEmp(emp.employeeId, emp.employeeName, emp.employeeEmployeeId);
                                    });
                                } else if (asset.assignedToId || asset.assignedToName) {
                                    addAssetToEmp(asset.assignedToId, asset.assignedToName, asset.assignedToEmployeeId);
                                }
                            });
                            const employeesWithAssets = Object.values(empMap);

                            if (employeesWithAssets.length === 0) {
                                return (
                                    <div className="asset-empty" style={{ padding: '24px' }}>
                                        <h3>No assigned assets found</h3>
                                        <p>Assign assets to employees to see them grouped here.</p>
                                    </div>
                                );
                            }

                            return (
                                <div style={{ display: 'grid', gap: '16px' }}>
                                    {employeesWithAssets.map(emp => (
                                        <div key={emp.id || emp.name} className="asset-card" style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px' }}>
                                                <div className="avatar" style={{ background: '#4f46e5', color: '#fff', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: '14px' }}>
                                                    {emp.name.charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>{emp.name}</h4>
                                                    <span style={{ fontSize: '11px', color: '#64748b' }}>ID: {emp.employeeIdCode}</span>
                                                </div>
                                                <span style={{ marginLeft: 'auto', fontSize: '12px', fontWeight: 600, color: '#4f46e5', background: '#ede9fe', padding: '2px 10px', borderRadius: '12px' }}>
                                                    {emp.assets.length} {emp.assets.length === 1 ? 'Asset' : 'Assets'}
                                                </span>
                                            </div>
                                            <div style={{ display: 'grid', gap: '10px' }}>
                                                {emp.assets.map(asset => (
                                                    <div key={asset.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', flexWrap: 'wrap', gap: '8px' }}>
                                                        <div style={{ flex: 1, minWidth: '200px' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                <strong style={{ fontSize: '13px', color: '#1e293b' }}>{asset.assetName}</strong>
                                                                <span style={{ fontSize: '10px', fontWeight: 700, color: '#4f46e5', background: '#e0e7ff', padding: '1px 6px', borderRadius: '4px', textTransform: 'uppercase' }}>
                                                                    {asset.assetType}
                                                                </span>
                                                            </div>
                                                            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                                                                {[asset.brand, asset.model].filter(Boolean).join(' · ') || asset.assetId || '—'}
                                                                {asset.serialNumber && ` · Serial: ${asset.serialNumber}`}
                                                            </div>
                                                        </div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                            <span style={{ 
                                                                fontSize: '11px', 
                                                                fontWeight: 700, 
                                                                color: asset.status === 'ASSIGNED' ? '#15803d' : '#b45309', 
                                                                background: asset.status === 'ASSIGNED' ? '#dcfce7' : '#fef3c7', 
                                                                padding: '2px 8px', 
                                                                borderRadius: '999px' 
                                                            }}>
                                                                {asset.status}
                                                            </span>
                                                            <button
                                                                type="button"
                                                                className="asset-icon-btn"
                                                                onClick={() => openHistory(asset)}
                                                                title="View Asset History"
                                                                style={{
                                                                    display: 'inline-flex',
                                                                    alignItems: 'center',
                                                                    gap: '4px',
                                                                    background: '#ffffff',
                                                                    border: '1px solid #cbd5e1',
                                                                    borderRadius: '6px',
                                                                    padding: '4px 8px',
                                                                    fontSize: '11px',
                                                                    fontWeight: 600,
                                                                    color: '#475569',
                                                                    cursor: 'pointer',
                                                                    transition: 'all 0.2s'
                                                                }}
                                                                onMouseEnter={(e) => { e.currentTarget.style.background = '#f1f5f9'; }}
                                                                onMouseLeave={(e) => { e.currentTarget.style.background = '#ffffff'; }}
                                                            >
                                                                <History size={12} /> History
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            );
                        })()}
                    </div>
                )}

                {activeTab === 'tickets' && (
                    <div style={{ marginBottom: 24 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                            <h3>Asset tickets</h3>
                            <button type="button" className="asset-cta" onClick={() => openTicket(null)}><Plus size={16} /> Raise ticket</button>
                        </div>
                        {tickets.length === 0 ? (
                            <div className="asset-empty"><h3>No tickets</h3><p>Repair, damage, lost, replacement, and maintenance tickets appear here.</p></div>
                        ) : (
                            <div style={{ display: 'grid', gap: 10 }}>
                                {tickets.map((t) => (
                                    <div key={t.id} className="asset-card" style={{ padding: 14 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                                            <strong>{t.ticketNumber} · {t.ticketType}</strong>
                                            <span className="asset-card-status" style={{ background: '#FEF3C7', color: '#92400e' }}>{t.status}</span>
                                        </div>
                                        <div style={{ marginTop: 6 }}>{t.subject}</div>
                                        {t.description && <div style={{ fontSize: '13px', color: '#475569', marginTop: 4 }}>{t.description}</div>}
                                        <div className="asset-card-meta">{t.assetName} ({t.assetCode || t.assetId}) · Priority: {t.priority}</div>
                                        {t.imageUrl && (
                                            <div style={{ marginTop: '8px' }}>
                                                <span style={{ fontSize: '11px', color: '#64748b' }}>Attachment: </span>
                                                {t.imageUrl.toLowerCase().endsWith('.pdf') ? (
                                                    <a href={t.imageUrl} target="_blank" rel="noreferrer" style={{ fontSize: '12px', color: '#4f46e5', fontWeight: 600, textDecoration: 'underline' }}>View PDF</a>
                                                ) : (
                                                    <a href={t.imageUrl} target="_blank" rel="noreferrer">
                                                        <img src={t.imageUrl} alt="Ticket attachment" style={{ maxWidth: '100px', maxHeight: '100px', borderRadius: '6px', border: '1px solid #e2e8f0', display: 'block', marginTop: '4px' }} />
                                                    </a>
                                                )}
                                            </div>
                                        )}
                                        {t.resolutionNotes && (
                                            <div style={{ fontSize: '12px', color: '#15803d', background: '#dcfce7', padding: '8px 10px', borderRadius: '6px', marginTop: '8px' }}>
                                                Resolution: <strong>{t.resolutionNotes}</strong>
                                            </div>
                                        )}
                                        {t.resolutionImageUrl && (
                                            <div style={{ marginTop: '8px' }}>
                                                <span style={{ fontSize: '11px', color: '#15803d' }}>Resolution Attachment: </span>
                                                {t.resolutionImageUrl.toLowerCase().endsWith('.pdf') ? (
                                                    <a href={t.resolutionImageUrl} target="_blank" rel="noreferrer" style={{ fontSize: '12px', color: '#15803d', fontWeight: 600, textDecoration: 'underline' }}>View Resolution PDF</a>
                                                ) : (
                                                    <a href={t.resolutionImageUrl} target="_blank" rel="noreferrer">
                                                        <img src={t.resolutionImageUrl} alt="Resolution attachment" style={{ maxWidth: '100px', maxHeight: '100px', borderRadius: '6px', border: '1px solid #e2e8f0', display: 'block', marginTop: '4px' }} />
                                                    </a>
                                                )}
                                            </div>
                                        )}
                                        <div className="asset-card-actions" style={{ marginTop: 10 }}>
                                            {['IN_PROGRESS', 'RESOLVED', 'CLOSED'].filter((s) => s !== t.status).map((s) => (
                                                <button key={s} type="button" onClick={() => handleUpdateTicketStatus(t, s)}>{s.replace('_', ' ')}</button>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'maintenance' && (
                    <div style={{ marginBottom: 24 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                            <h3>Maintenance history</h3>
                            <button type="button" className="asset-cta" onClick={() => openMaintenance(null)}><Plus size={16} /> Log maintenance</button>
                        </div>
                        {maintenanceLogs.length === 0 ? (
                            <div className="asset-empty"><h3>No maintenance logs</h3><p>Vendor visits, repairs, and scheduled upkeep will show here.</p></div>
                        ) : (
                            <div style={{ display: 'grid', gap: 10 }}>
                                {maintenanceLogs.map((m) => (
                                    <div key={m.id} className="asset-card" style={{ padding: 14 }}>
                                        <strong>{m.assetName} ({m.assetCode})</strong>
                                        <div className="asset-card-meta">{m.maintenanceType} · Vendor: {m.vendor || '—'} · Cost: {m.cost ? `₹${m.cost}` : '—'}</div>
                                        <div style={{ marginTop: 6 }}>{m.description || '—'}</div>
                                        {m.outcomeNotes && (
                                            <div style={{ fontSize: '12px', color: '#334155', background: '#f8fafc', padding: '8px 10px', borderRadius: '6px', marginTop: '6px' }}>
                                                Outcome: <strong>{m.outcomeNotes}</strong>
                                            </div>
                                        )}
                                        {m.imageUrl && (
                                            <div style={{ marginTop: '8px' }}>
                                                <span style={{ fontSize: '11px', color: '#64748b' }}>Attachment: </span>
                                                {m.imageUrl.toLowerCase().endsWith('.pdf') ? (
                                                    <a href={m.imageUrl} target="_blank" rel="noreferrer" style={{ fontSize: '12px', color: '#4f46e5', fontWeight: 600, textDecoration: 'underline' }}>View PDF</a>
                                                ) : (
                                                    <a href={m.imageUrl} target="_blank" rel="noreferrer">
                                                        <img src={m.imageUrl} alt="Maintenance attachment" style={{ maxWidth: '100px', maxHeight: '100px', borderRadius: '6px', border: '1px solid #e2e8f0', display: 'block', marginTop: '4px' }} />
                                                    </a>
                                                )}
                                            </div>
                                        )}
                                        <div className="asset-card-meta" style={{ marginTop: 6 }}>Log added on: {formatDate(m.createdAt)} · Completed: {m.completedAt ? formatDate(m.completedAt) : '—'}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'inventory' && (
                <>
                <div className="asset-stats">
                    <div className="asset-stat-card stat-total">
                        <div className="stat-icon-wrap"><Monitor size={20} /></div>
                        <div className="stat-label">Total assets</div>
                        <div className="stat-value">{stats.total}</div>
                    </div>
                    <div className="asset-stat-card stat-available">
                        <div className="stat-icon-wrap"><CheckCircle size={20} /></div>
                        <div className="stat-label">Available</div>
                        <div className="stat-value">{stats.available}</div>
                    </div>
                    <div className="asset-stat-card stat-assigned">
                        <div className="stat-icon-wrap"><UserPlus size={20} /></div>
                        <div className="stat-label">Assigned</div>
                        <div className="stat-value">{stats.assigned}</div>
                    </div>
                    <div className="asset-stat-card stat-maintenance">
                        <div className="stat-icon-wrap"><AlertTriangle size={20} /></div>
                        <div className="stat-label">Maintenance</div>
                        <div className="stat-value">{stats.maintenance}</div>
                    </div>
                </div>

                <div className="asset-toolbar">
                    <div className="asset-search-wrap">
                        <Search size={18} />
                        <input
                            type="text"
                            placeholder="Search by name, brand, model, or ID..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{ paddingLeft: '42px' }}
                        />
                    </div>
                    <select
                        className="asset-filter-select"
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value)}
                        aria-label="Filter by type"
                    >
                        <option value="ALL">All types</option>
                        {assetTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                    <select
                        className="asset-filter-select"
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        aria-label="Filter by status"
                    >
                        <option value="ALL">All statuses</option>
                        {Object.entries(statusConfig).map(([value, { label }]) => (
                            <option key={value} value={value}>{label}</option>
                        ))}
                    </select>
                    <button type="button" className="asset-icon-btn" onClick={fetchAssets} title="Refresh">
                        <RefreshCw size={18} />
                    </button>
                </div>

                {loading ? (
                    <div className="asset-grid">
                        {[1, 2, 3, 4, 5, 6].map(i => (
                            <div key={i} className="asset-skeleton asset-skeleton-card" />
                        ))}
                    </div>
                ) : filteredAssets.length === 0 ? (
                    <div className="asset-empty">
                        <div className="asset-empty-icon"><Package size={28} /></div>
                        <h3>No assets found</h3>
                        <p>
                            {assets.length === 0
                                ? 'Add your first asset to start tracking equipment.'
                                : 'Try adjusting filters or search.'}
                        </p>
                        {assets.length === 0 && (
                            <button type="button" className="asset-cta" onClick={() => setShowAddModal(true)}>
                                <Plus size={18} /> Add asset
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="asset-grid">
                        {filteredAssets.map(asset => {
                            const TypeIcon = getTypeIcon(asset.assetType);
                            const status = statusConfig[asset.status] || statusConfig.AVAILABLE;
                            return (
                                <div key={asset.id} className="asset-card">
                                    <div className="asset-card-top">
                                        <div className="asset-card-icon">
                                            <TypeIcon size={24} />
                                        </div>
                                        <span className="asset-card-type-badge">{asset.assetType}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'flex-start', gap: '16px', width: '100%', marginBottom: '8px' }}>
                                        <div style={{ flex: 1 }}>
                                    <h3 className="asset-card-title">{asset.assetName || 'Unnamed asset'}</h3>
                                            <p className="asset-card-meta" style={{ margin: '2px 0 4px 0' }}>
                                        {[asset.brand, asset.model].filter(Boolean).join(' · ') || asset.assetId || '—'}
                                    </p>
                                            {asset.serialNumber && (
                                                <p className="asset-card-meta" style={{ margin: '0 0 6px 0', fontSize: '11.5px', color: '#64748b' }}>
                                                    Serial: <strong style={{ color: '#334155' }}>{asset.serialNumber}</strong>
                                                </p>
                                            )}
                                            {asset.configuration && (
                                                <p className="asset-card-meta" style={{ margin: '0 0 6px 0', fontSize: '11.5px', color: '#64748b' }}>
                                                    Configuration: <strong style={{ color: '#334155' }}>{asset.configuration}</strong>
                                                </p>
                                            )}
                                            {asset.notes && (
                                                <p className="asset-card-meta" style={{ margin: '0 0 6px 0', fontSize: '11.5px', color: '#64748b' }}>
                                                    Notes: <strong style={{ color: '#334155' }}>{asset.notes}</strong>
                                                </p>
                                            )}
                                            {asset.imageUrl && asset.imageUrl.toLowerCase().endsWith('.pdf') && (
                                                <div style={{ marginTop: '4px' }}>
                                                    <a href={asset.imageUrl} target="_blank" rel="noreferrer" style={{ fontSize: '11px', color: '#4f46e5', fontWeight: 600, textDecoration: 'underline' }}>View PDF Doc</a>
                                                </div>
                                            )}
                                        </div>
                                        {asset.imageUrl && !asset.imageUrl.toLowerCase().endsWith('.pdf') && (
                                            <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                                <a href={asset.imageUrl} target="_blank" rel="noreferrer" style={{ display: 'block', textDecoration: 'none' }}>
                                                    <img 
                                                        src={asset.imageUrl} 
                                                        alt="Asset preview" 
                                                        style={{ width: '80px', height: '80px', borderRadius: '8px', objectFit: 'cover', border: '1px solid #e2e8f0', display: 'block', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }} 
                                                    />
                                                </a>
                                                <a href={asset.imageUrl} target="_blank" rel="noreferrer" style={{ 
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    marginTop: '8px', 
                                                    padding: '5px 10px', 
                                                    borderRadius: '6px', 
                                                    background: '#4f46e5', 
                                                    color: '#ffffff', 
                                                    fontSize: '11px', 
                                                    fontWeight: 600, 
                                                    textAlign: 'center',
                                                    border: 'none',
                                                    textDecoration: 'none',
                                                    boxShadow: '0 2px 4px rgba(79, 70, 229, 0.15)',
                                                    transition: 'background-color 0.2s'
                                                }}>
                                                    View Image
                                                </a>
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                    <span
                                        className="asset-card-status"
                                            style={{ background: status.bg, color: status.color, display: 'inline-block', marginBottom: '8px' }}
                                    >
                                        {status.label}
                                    </span>
                                        {asset.quantity > 1 && (
                                            <div style={{ display: 'flex', gap: '12px', marginBottom: '10px', background: '#f8fafc', padding: '6px 12px', borderRadius: '6px', border: '1px dashed #cbd5e1', fontSize: '12px', color: '#475569', width: 'fit-content' }}>
                                                <span>Total: <strong>{asset.quantity}</strong></span>
                                                <span>Assigned: <strong style={{ color: '#10b981' }}>{asset.assignedQuantity ?? 0}</strong></span>
                                                <span>Available: <strong style={{ color: '#4f46e5' }}>{asset.availableQuantity ?? (asset.quantity - (asset.assignedQuantity ?? 0))}</strong></span>
                                            </div>
                                        )}
                                    {asset.assignedToName && (
                                            <div className="asset-card-assignee" style={{ margin: 0 }}>
                                            <span className="avatar">{asset.assignedToName.charAt(0)}</span>
                                            <span>{asset.assignedToName}</span>
                                        </div>
                                    )}
                                    </div>
                                    <div className="asset-card-actions" style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', gap: '8px', borderTop: '1px solid var(--asset-border)', paddingTop: '14px', height: '40px' }}>
                                         <div style={{ display: 'flex', gap: '8px', flex: 1, alignItems: 'center' }}>
                                        {asset.status === 'AVAILABLE' && (
                                            <button
                                                type="button"
                                                className="asset-action-assign"
                                                     style={{ flex: 1, background: '#4f46e5', color: '#fff', height: '40px', padding: '0 12px', borderRadius: '8px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', cursor: 'pointer', border: 'none', fontSize: '13px' }}
                                                onClick={() => openAssignModal(asset)}
                                            >
                                                     <UserPlus size={16} /> Assign
                                            </button>
                                        )}
                                        {asset.status === 'ASSIGNED' && (
                                                 <>
                                            <button
                                                type="button"
                                                className="asset-action-return"
                                                         style={{ flex: 1, background: '#f59e0b', color: '#fff', height: '40px', padding: '0 12px', borderRadius: '8px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', cursor: 'pointer', border: 'none', fontSize: '13px' }}
                                                onClick={() => handleReturnAsset(asset.id)}
                                            >
                                                         <RefreshCw size={16} /> Return
                                            </button>
                                                     <button 
                                                         type="button" 
                                                         style={{ flex: 1, background: '#10b981', color: '#fff', height: '40px', padding: '0 12px', borderRadius: '8px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', cursor: 'pointer', border: 'none', fontSize: '13px' }} 
                                                         onClick={() => openTransfer(asset)}
                                                     >
                                                         <ArrowRightLeft size={16} /> Transfer
                                                     </button>
                                                 </>
                                             )}
                                             {asset.status === 'MAINTENANCE' && (
                                                 <button
                                                     type="button"
                                                     style={{ flex: 1, background: '#ef4444', color: '#fff', height: '40px', padding: '0 12px', borderRadius: '8px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', cursor: 'pointer', border: 'none', fontSize: '13px' }}
                                                     onClick={() => handleReturnAsset(asset.id)}
                                                 >
                                                     <RefreshCw size={16} /> Complete
                                        </button>
                                             )}
                                         </div>
 
                                         <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                        <button
                                            type="button"
                                                 onClick={(e) => {
                                                     e.stopPropagation();
                                                     setActiveDropdownId(activeDropdownId === asset.id ? null : asset.id);
                                                 }}
                                                 style={{
                                                     background: '#f1f5f9',
                                                     border: 'none',
                                                     borderRadius: '8px',
                                                     width: '40px',
                                                     height: '40px',
                                                     display: 'flex',
                                                     alignItems: 'center',
                                                     justifyContent: 'center',
                                                     cursor: 'pointer',
                                                     color: '#475569',
                                                     transition: 'background-color 0.2s'
                                                 }}
                                                 onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e2e8f0'}
                                                 onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                                             >
                                                 <MoreVertical size={18} />
                                             </button>
                                             {activeDropdownId === asset.id && (
                                                 <div 
                                                     style={{
                                                         position: 'absolute',
                                                         bottom: '44px',
                                                         right: '0',
                                                         background: '#ffffff',
                                                         border: '1px solid #e2e8f0',
                                                         borderRadius: '12px',
                                                         boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                                                         width: '180px',
                                                         zIndex: 50,
                                                         padding: '6px',
                                                         display: 'flex',
                                                         flexDirection: 'column',
                                                         gap: '2px'
                                                     }}
                                                     onClick={(e) => e.stopPropagation()}
                                                 >
                                                     <button 
                                                         onClick={() => { openHistory(asset); setActiveDropdownId(null); }}
                                                         style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '8px 12px', background: 'transparent', border: 'none', borderRadius: '6px', textAlign: 'left', color: '#374151', cursor: 'pointer', fontSize: '13px' }}
                                                         onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                                                         onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                                     >
                                                         <History size={14} /> View History
                                                     </button>
                                                     <button 
                                                         onClick={() => { openTicket(asset); setActiveDropdownId(null); }}
                                                         style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '8px 12px', background: 'transparent', border: 'none', borderRadius: '6px', textAlign: 'left', color: '#374151', cursor: 'pointer', fontSize: '13px' }}
                                                         onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                                                         onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                                     >
                                                         <Ticket size={14} /> Raise Ticket
                                                     </button>
                                                     <button 
                                                         onClick={() => { openMaintenance(asset); setActiveDropdownId(null); }}
                                                         style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '8px 12px', background: 'transparent', border: 'none', borderRadius: '6px', textAlign: 'left', color: '#374151', cursor: 'pointer', fontSize: '13px' }}
                                                         onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                                                         onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                                     >
                                                         <Wrench size={14} /> Log Maintenance
                                                     </button>
                                                     <button 
                                                         onClick={() => { openEditModal(asset); setActiveDropdownId(null); }}
                                                         style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '8px 12px', background: 'transparent', border: 'none', borderRadius: '6px', textAlign: 'left', color: '#374151', cursor: 'pointer', fontSize: '13px' }}
                                                         onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                                                         onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                                     >
                                                         <Edit2 size={14} /> Edit Asset
                                                     </button>
                                                     <button 
                                                          onClick={() => { setSelectedAsset(asset); setStatusFormValue(asset.status); setShowStatusModal(true); setActiveDropdownId(null); }}
                                                          style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '8px 12px', background: 'transparent', border: 'none', borderRadius: '6px', textAlign: 'left', color: '#374151', cursor: 'pointer', fontSize: '13px' }}
                                                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                                                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                                      >
                                                          <RefreshCw size={14} /> Change Status
                                                      </button>

                                                     <button 
                                                         onClick={() => { handleDeleteAsset(asset.id); setActiveDropdownId(null); }}
                                                         style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '8px 12px', background: 'transparent', border: 'none', borderRadius: '6px', textAlign: 'left', color: '#ef4444', cursor: 'pointer', fontSize: '13px', borderTop: '1px solid #f1f5f9', marginTop: '4px' }}
                                                         onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fef2f2'}
                                                         onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                                     >
                                                         <Trash2 size={14} /> Delete Asset
                                        </button>
                                                 </div>
                                             )}
                                         </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
                </>
                )}
            </div>

            {/* Add/Edit Asset Modal */}
            {showAddModal && (
                <div className="asset-modal-overlay" onClick={() => !submitting && setShowAddModal(false)}>
                    <div className="asset-modal" onClick={e => e.stopPropagation()}>
                        <div className="asset-modal-header">
                            <h2>{selectedAsset ? 'Edit asset' : 'Add asset'}</h2>
                        </div>
                        <div className="asset-modal-body">
                            <form onSubmit={selectedAsset ? handleUpdateAsset : handleCreateAsset}>
                                <div className="asset-form-grid">
                                    <div className="asset-field">
                                        <label htmlFor="asset-form-name">Asset name *</label>
                                        <input
                                            id="asset-form-name"
                                            required
                                            placeholder="e.g. Dell Latitude 5520"
                                            value={formData.assetName}
                                            onChange={e => setFormData({ ...formData, assetName: e.target.value })}
                                        />
                                    </div>
                                    <div className="asset-field">
                                        <label htmlFor="asset-form-id">Asset ID (optional)</label>
                                        <input
                                            id="asset-form-id"
                                            placeholder="e.g. AST-001"
                                            value={formData.assetId}
                                            onChange={e => setFormData({ ...formData, assetId: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div className="asset-form-grid">
                                    <div className="asset-field">
                                        <label htmlFor="asset-form-type">Type *</label>
                                        <select
                                            id="asset-form-type"
                                            required
                                            value={formData.assetType}
                                            onChange={e => setFormData({ ...formData, assetType: e.target.value })}
                                        >
                                            <option value="">Select type</option>
                                            {assetTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                        </select>
                                    </div>
                                    <div className="asset-field">
                                        <label htmlFor="asset-form-brand">Brand *</label>
                                        <input
                                            id="asset-form-brand"
                                            required
                                            placeholder="e.g. Dell, HP"
                                            value={formData.brand}
                                            onChange={e => setFormData({ ...formData, brand: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div className="asset-form-grid">
                                    <div className="asset-field">
                                        <label htmlFor="asset-form-model">Model *</label>
                                        <input
                                            id="asset-form-model"
                                            required
                                            placeholder="e.g. Latitude 5520"
                                            value={formData.model}
                                            onChange={e => setFormData({ ...formData, model: e.target.value })}
                                        />
                                    </div>
                                    <div className="asset-field">
                                        <label htmlFor="asset-form-serial">Serial number *</label>
                                        <input
                                            id="asset-form-serial"
                                            required
                                            placeholder="e.g. SN123456"
                                            value={formData.serialNumber}
                                            onChange={e => setFormData({ ...formData, serialNumber: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div className="asset-form-grid">
                                    <div className="asset-field">
                                        <label htmlFor="asset-form-purchase">Purchase date</label>
                                        <DatePicker
                                            id="asset-form-purchase"
                                            value={formData.purchaseDate || ''}
                                            placeholderText="Select purchase date"
                                            onChange={(dateObj) => {
                                                setFormData({
                                                    ...formData,
                                                    purchaseDate: toDateInputValue(dateObj),
                                                });
                                            }}
                                        />
                                    </div>
                                    <div className="asset-field">
                                        <label htmlFor="asset-form-warranty">Warranty expiry</label>
                                        <DatePicker
                                            id="asset-form-warranty"
                                            value={formData.warrantyExpiry || ''}
                                            minDate={formData.purchaseDate || undefined}
                                            placeholderText="Select warranty expiry"
                                            onChange={(dateObj) => {
                                                setFormData({
                                                    ...formData,
                                                    warrantyExpiry: toDateInputValue(dateObj),
                                                });
                                            }}
                                        />
                                    </div>
                                    <div className="asset-field">
                                        <label htmlFor="asset-form-quantity">Quantity</label>
                                        <input
                                            id="asset-form-quantity"
                                            type="number"
                                            min={1}
                                            max={100}
                                            value={formData.quantity}
                                            onChange={e => setFormData({ ...formData, quantity: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div className="asset-form-grid" style={{ marginBottom: '12px' }}>
                                    <div className="asset-field">
                                        <label htmlFor="asset-form-config">Configuration (optional)</label>
                                        <textarea
                                            id="asset-form-config"
                                            placeholder="e.g. 16GB RAM, 512GB SSD"
                                            value={formData.configuration || ''}
                                            onChange={e => setFormData({ ...formData, configuration: e.target.value })}
                                            style={{ minHeight: '60px', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--asset-border)', outline: 'none' }}
                                        />
                                    </div>
                                    <div className="asset-field">
                                        <label htmlFor="asset-form-notes">Notes (optional)</label>
                                        <textarea
                                            id="asset-form-notes"
                                            placeholder="Any extra notes..."
                                            value={formData.notes || ''}
                                            onChange={e => setFormData({ ...formData, notes: e.target.value })}
                                            style={{ minHeight: '60px', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--asset-border)', outline: 'none' }}
                                        />
                                    </div>
                                </div>
                                <div className="asset-field" style={{ marginBottom: '16px' }}>
                                    <label>Upload Asset Photo / Invoice (Optional)</label>
                                    <input 
                                        type="file" 
                                        accept="image/*,application/pdf" 
                                        onChange={(e) => handleFileChange(e, (url) => setFormData(prev => ({ ...prev, imageUrl: url })))}
                                        disabled={uploadingFile}
                                    />
                                    {uploadingFile && <p style={{ fontSize: '12px', color: '#6366f1', margin: '4px 0 0 0' }}>Uploading...</p>}
                                    {formData.imageUrl && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                                            {!formData.imageUrl.toLowerCase().endsWith('.pdf') && (
                                                <img src={formData.imageUrl} alt="Preview" style={{ width: '40px', height: '40px', borderRadius: '4px', objectFit: 'cover', border: '1px solid #e2e8f0' }} />
                                            )}
                                            <span style={{ fontSize: '12px', color: '#10b981' }}>✓ Uploaded:</span>
                                            <a href={formData.imageUrl} target="_blank" rel="noreferrer" style={{ fontSize: '12px', color: '#10b981', textDecoration: 'underline', fontWeight: 600 }}>
                                                View {formData.imageUrl.toLowerCase().endsWith('.pdf') ? 'PDF' : 'Image'}
                                            </a>
                                        </div>
                                    )}
                                </div>
                                <div className="asset-modal-actions">
                                    <button type="button" className="asset-btn-secondary" onClick={() => setShowAddModal(false)}>
                                        Cancel
                                    </button>
                                    <button type="submit" className="asset-btn-primary" disabled={submitting || uploadingFile}>
                                        {submitting ? 'Saving…' : (selectedAsset ? 'Update' : 'Create')}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Assign Asset Modal */}
            {showAssignModal && (
                <div className="asset-modal-overlay" onClick={() => !submitting && setShowAssignModal(false)}>
                    <div className="asset-modal" onClick={e => e.stopPropagation()}>
                        <div className="asset-modal-header">
                            <h2>Assign asset</h2>
                        </div>
                        <div className="asset-modal-body">
                            {(() => {
                                const targetAsset = assets.find(a => a.id === assignmentData.assetId);
                                if (!targetAsset) return null;
                                return (
                                    <div style={{
                                        background: '#f8fafc',
                                        border: '1px solid #e2e8f0',
                                        borderRadius: '12px',
                                        padding: '12px 16px',
                                        marginBottom: '16px',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '6px'
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <strong style={{ color: '#0f172a', fontSize: '14px' }}>{targetAsset.assetName}</strong>
                                            <span style={{ fontSize: '11px', fontWeight: 700, color: '#4f46e5', background: '#ede9fe', padding: '2px 8px', borderRadius: '999px', textTransform: 'uppercase' }}>
                                                {targetAsset.assetType}
                                            </span>
                                        </div>
                                        <div style={{ fontSize: '12px', color: '#64748b' }}>
                                            <span>Brand: <strong>{targetAsset.brand || '—'}</strong></span>
                                            <span style={{ margin: '0 8px' }}>·</span>
                                            <span>Model: <strong>{targetAsset.model || '—'}</strong></span>
                                            {targetAsset.serialNumber && (
                                                <>
                                                    <span style={{ margin: '0 8px' }}>·</span>
                                                    <span>Serial: <strong>{targetAsset.serialNumber}</strong></span>
                                                </>
                                            )}
                                        </div>
                                        {targetAsset.quantity > 1 && (
                                            <div style={{ fontSize: '11px', color: '#059669', background: '#d1fae5', padding: '2px 8px', borderRadius: '4px', width: 'fit-content', marginTop: '2px', fontWeight: 600 }}>
                                                Available Units: {targetAsset.availableQuantity ?? (targetAsset.quantity - (targetAsset.assignedQuantity ?? 0))} / {targetAsset.quantity}
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}
                            <form onSubmit={handleAssignAsset}>
                                <div className="asset-field">
                                    <label htmlFor="assign-form-employee">Employee *</label>
                                    <select
                                        id="assign-form-employee"
                                        required
                                        value={assignmentData.employeeId}
                                        onChange={e => setAssignmentData({ ...assignmentData, employeeId: e.target.value })}
                                    >
                                        <option value="">Select employee</option>
                                        {employees.map(emp => (
                                            <option key={emp.id} value={emp.id}>
                                                {emp.firstName} {emp.lastName} ({emp.employeeId})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="asset-field">
                                    <label htmlFor="assign-form-location">Location</label>
                                    <input
                                        id="assign-form-location"
                                        list="office-locations"
                                        placeholder="Select location or enter custom (e.g. Desk 12)"
                                        value={assignmentData.location}
                                        onChange={e => setAssignmentData({ ...assignmentData, location: e.target.value })}
                                    />
                                    <datalist id="office-locations">
                                        {locations.map(loc => (
                                            <option key={loc.id} value={loc.locationName}>
                                                {loc.locationName} {loc.locationCode ? `(${loc.locationCode})` : ''}
                                            </option>
                                        ))}
                                    </datalist>
                                </div>
                                <div className="asset-field">
                                    <label htmlFor="assign-form-notes">Notes</label>
                                    <textarea
                                        id="assign-form-notes"
                                        placeholder="Optional notes"
                                        value={assignmentData.notes}
                                        onChange={e => setAssignmentData({ ...assignmentData, notes: e.target.value })}
                                    />
                                </div>
                                <div className="asset-modal-actions">
                                    <button type="button" className="asset-btn-secondary" onClick={() => setShowAssignModal(false)}>
                                        Cancel
                                    </button>
                                    <button type="submit" className="asset-btn-primary" disabled={submitting}>
                                        {submitting ? 'Assigning…' : 'Assign'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {showTransferModal && (
                <div className="asset-modal-overlay" onClick={() => !submitting && setShowTransferModal(false)}>
                    <div className="asset-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="asset-modal-header"><h2>Transfer asset</h2></div>
                        <div className="asset-modal-body">
                            <form onSubmit={handleTransfer}>
                                <p className="asset-card-meta" style={{ marginBottom: 12 }}>
                                    {selectedAsset?.assetName} ({selectedAsset?.assetId})
                                </p>
                                <div className="asset-field">
                                    <label>Transfer to *</label>
                                    <select required value={transferData.toEmployeeId} onChange={(e) => setTransferData({ ...transferData, toEmployeeId: e.target.value })}>
                                        <option value="">Select employee</option>
                                        {employees.map((emp) => (
                                            <option key={emp.id} value={emp.id}>
                                                {emp.firstName} {emp.lastName} ({emp.employeeId})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="asset-field">
                                    <label>Location</label>
                                    <input value={transferData.location} onChange={(e) => setTransferData({ ...transferData, location: e.target.value })} />
                                </div>
                                <div className="asset-field">
                                    <label>Notes</label>
                                    <textarea value={transferData.notes} onChange={(e) => setTransferData({ ...transferData, notes: e.target.value })} />
                                </div>
                                <div className="asset-field" style={{ marginBottom: '16px' }}>
                                    <label>Upload Transfer Document / Photo (Optional)</label>
                                    <input 
                                        type="file" 
                                        accept="image/*,application/pdf" 
                                        onChange={(e) => handleFileChange(e, (url) => setTransferData(prev => ({ ...prev, imageUrl: url })))}
                                        disabled={uploadingFile}
                                    />
                                    {uploadingFile && <p style={{ fontSize: '12px', color: '#6366f1', margin: '4px 0 0 0' }}>Uploading...</p>}
                                    {transferData.imageUrl && (
                                        <p style={{ fontSize: '12px', color: '#10b981', margin: '4px 0 0 0' }}>
                                            ✓ Uploaded: <a href={transferData.imageUrl} target="_blank" rel="noreferrer" style={{ textDecoration: 'underline' }}>View file</a>
                                        </p>
                                    )}
                                </div>
                                <div className="asset-modal-actions">
                                    <button type="button" className="asset-btn-secondary" onClick={() => setShowTransferModal(false)}>Cancel</button>
                                    <button type="submit" className="asset-btn-primary" disabled={submitting || uploadingFile}>{submitting ? 'Transferring…' : 'Transfer'}</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {showHistoryModal && (
                <div className="asset-modal-overlay" onClick={() => setShowHistoryModal(false)}>
                    <div className="asset-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 680 }}>
                        <div className="asset-modal-header"><h2>Asset history — {selectedAsset?.assetName}</h2></div>
                        <div className="asset-modal-body">
                            <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
                                <button 
                                    type="button" 
                                    onClick={() => setHistoryTab('lifecycle')} 
                                    style={{
                                        padding: '6px 12px',
                                        borderRadius: '6px',
                                        border: 'none',
                                        background: historyTab === 'lifecycle' ? '#4f46e5' : '#f1f5f9',
                                        color: historyTab === 'lifecycle' ? '#fff' : '#475569',
                                        fontWeight: 600,
                                        fontSize: '12px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Lifecycle & Assignments
                                </button>
                                <button 
                                    type="button" 
                                    onClick={() => setHistoryTab('tickets')} 
                                    style={{
                                        padding: '6px 12px',
                                        borderRadius: '6px',
                                        border: 'none',
                                        background: historyTab === 'tickets' ? '#4f46e5' : '#f1f5f9',
                                        color: historyTab === 'tickets' ? '#fff' : '#475569',
                                        fontWeight: 600,
                                        fontSize: '12px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Repairs & Issues ({assetTickets.length})
                                </button>
                                <button 
                                    type="button" 
                                    onClick={() => setHistoryTab('maintenance')} 
                                    style={{
                                        padding: '6px 12px',
                                        borderRadius: '6px',
                                        border: 'none',
                                        background: historyTab === 'maintenance' ? '#4f46e5' : '#f1f5f9',
                                        color: historyTab === 'maintenance' ? '#fff' : '#475569',
                                        fontWeight: 600,
                                        fontSize: '12px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Maintenance Logs ({assetMaintenance.length})
                                </button>
                            </div>

                            {historyTab === 'lifecycle' && (
                                history.length === 0 ? (
                                    <p style={{ color: '#64748b', textAlign: 'center', padding: '24px 0' }}>No history recorded yet.</p>
                                ) : (
                                    <div style={{ display: 'grid', gap: '12px', maxHeight: '350px', overflowY: 'auto' }}>
                                        {history.map((h) => {
                                            const badgeStyle = getEventTypeStyle(h.eventType);
                                            return (
                                                <div key={h.id} style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                                                        <span style={{ 
                                                            fontSize: '11px', 
                                                            fontWeight: 700, 
                                                            color: badgeStyle.color, 
                                                            background: badgeStyle.bg, 
                                                            padding: '2px 8px', 
                                                            borderRadius: '999px',
                                                            textTransform: 'uppercase',
                                                            display: 'inline-block'
                                                        }}>
                                                            {formatEventType(h.eventType)}
                                                        </span>
                                                        <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                                                            {formatDate(h.createdAt)}
                                                        </span>
                                                    </div>
                                                    <div style={{ fontSize: '13px', color: '#334155', marginTop: '6px', fontWeight: 500 }}>
                                                        {h.notes || `${h.fromStatus || ''} → ${h.toStatus || ''}`}
                                                    </div>
                                                    <div className="asset-card-meta" style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
                                                        Action by: <strong>{h.performedBy || 'System'}</strong>
                                                    </div>
                                                    {h.eventType === 'ASSIGNED' && h.toEmployeeName && (
                                                        <div className="asset-card-meta" style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', background: '#f8fafc', padding: '4px 8px', borderRadius: '4px', display: 'inline-block' }}>
                                                            Assigned to: <strong>{h.toEmployeeName}</strong>
                                                        </div>
                                                    )}
                                                    {h.eventType === 'RETURNED' && h.fromEmployeeName && (
                                                        <div className="asset-card-meta" style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', background: '#f8fafc', padding: '4px 8px', borderRadius: '4px', display: 'inline-block' }}>
                                                            Returned by: <strong>{h.fromEmployeeName}</strong>
                                                        </div>
                                                    )}
                                                    {h.eventType === 'TRANSFERRED' && (h.fromEmployeeName || h.toEmployeeName) && (
                                                        <div className="asset-card-meta" style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', background: '#f8fafc', padding: '4px 8px', borderRadius: '4px', display: 'inline-block' }}>
                                                            Transfer: <strong>{h.fromEmployeeName || 'None'}</strong> → <strong>{h.toEmployeeName || 'None'}</strong>
                                                        </div>
                                                    )}
                                                    {h.imageUrl && (
                                                        <div style={{ marginTop: '8px' }}>
                                                            <span style={{ fontSize: '11px', color: '#64748b' }}>Attachment: </span>
                                                            {h.imageUrl.toLowerCase().endsWith('.pdf') ? (
                                                                <a href={h.imageUrl} target="_blank" rel="noreferrer" style={{ fontSize: '12px', color: '#4f46e5', fontWeight: 600, textDecoration: 'underline' }}>View PDF</a>
                                                            ) : (
                                                                <a href={h.imageUrl} target="_blank" rel="noreferrer">
                                                                    <img src={h.imageUrl} alt="Event attachment" style={{ maxWidth: '100px', maxHeight: '100px', borderRadius: '6px', border: '1px solid #e2e8f0', display: 'block', marginTop: '4px' }} />
                                                                </a>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )
                            )}

                            {historyTab === 'tickets' && (
                                assetTickets.length === 0 ? (
                                    <p style={{ color: '#64748b', textAlign: 'center', padding: '24px 0' }}>No support tickets or repairs recorded.</p>
                                ) : (
                                    <div style={{ display: 'grid', gap: '12px', maxHeight: '350px', overflowY: 'auto' }}>
                                        {assetTickets.map((t) => (
                                            <div key={t.id} style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <span style={{ fontSize: '12px', fontWeight: 800, color: '#0f172a' }}>
                                                        {t.ticketNumber} · <span style={{ color: '#4f46e5' }}>{t.ticketType || 'REPAIR'}</span>
                                                    </span>
                                                    <span style={{ 
                                                        fontSize: '11px', 
                                                        fontWeight: 700, 
                                                        color: t.status === 'OPEN' ? '#b45309' : t.status === 'IN_PROGRESS' ? '#1e40af' : '#15803d', 
                                                        background: t.status === 'OPEN' ? '#fef3c7' : t.status === 'IN_PROGRESS' ? '#dbeafe' : '#dcfce7', 
                                                        padding: '2px 8px', 
                                                        borderRadius: '999px',
                                                        textTransform: 'uppercase'
                                                    }}>
                                                        {t.status || 'OPEN'}
                                                    </span>
                                                </div>
                                                <div style={{ fontWeight: 700, fontSize: '13px', color: '#334155', marginTop: '4px' }}>
                                                    {t.subject}
                                                </div>
                                                {t.description && (
                                                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                                                        {t.description}
                                                    </div>
                                                )}
                                                {t.imageUrl && (
                                                    <div style={{ marginTop: '6px' }}>
                                                        <span style={{ fontSize: '11px', color: '#64748b' }}>Attachment: </span>
                                                        {t.imageUrl.toLowerCase().endsWith('.pdf') ? (
                                                            <a href={t.imageUrl} target="_blank" rel="noreferrer" style={{ fontSize: '11px', color: '#4f46e5', fontWeight: 600, textDecoration: 'underline' }}>View PDF</a>
                                                        ) : (
                                                            <a href={t.imageUrl} target="_blank" rel="noreferrer">
                                                                <img src={t.imageUrl} alt="Ticket attachment" style={{ maxWidth: '80px', maxHeight: '80px', borderRadius: '4px', border: '1px solid #e2e8f0', display: 'block', marginTop: '2px' }} />
                                                            </a>
                                                        )}
                                                    </div>
                                                )}
                                                {t.resolutionNotes && (
                                                    <div style={{ fontSize: '11px', color: '#15803d', background: '#dcfce7', padding: '6px 10px', borderRadius: '6px', marginTop: '6px' }}>
                                                        Resolution: <strong>{t.resolutionNotes}</strong>
                                                    </div>
                                                )}
                                                {t.resolutionImageUrl && (
                                                    <div style={{ marginTop: '6px' }}>
                                                        <span style={{ fontSize: '11px', color: '#15803d' }}>Resolution Attachment: </span>
                                                        {t.resolutionImageUrl.toLowerCase().endsWith('.pdf') ? (
                                                            <a href={t.resolutionImageUrl} target="_blank" rel="noreferrer" style={{ fontSize: '11px', color: '#15803d', fontWeight: 600, textDecoration: 'underline' }}>View Resolution PDF</a>
                                                        ) : (
                                                            <a href={t.resolutionImageUrl} target="_blank" rel="noreferrer">
                                                                <img src={t.resolutionImageUrl} alt="Resolution attachment" style={{ maxWidth: '80px', maxHeight: '80px', borderRadius: '4px', border: '1px solid #e2e8f0', display: 'block', marginTop: '2px' }} />
                                                            </a>
                                                        )}
                                                    </div>
                                                )}
                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#94a3b8', marginTop: '6px' }}>
                                                    <span>Reported: <strong>{formatDate(t.reportedAt)}</strong></span>
                                                    {t.resolvedAt && <span>Resolved: <strong>{formatDate(t.resolvedAt)}</strong></span>}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )
                            )}

                            {historyTab === 'maintenance' && (
                                assetMaintenance.length === 0 ? (
                                    <p style={{ color: '#64748b', textAlign: 'center', padding: '24px 0' }}>No maintenance log history found.</p>
                                ) : (
                                    <div style={{ display: 'grid', gap: '12px', maxHeight: '350px', overflowY: 'auto' }}>
                                        {assetMaintenance.map((m) => (
                                            <div key={m.id} style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <strong style={{ color: '#0f172a' }}>{m.maintenanceType || 'GENERAL'}</strong>
                                                    <span style={{ fontSize: '12px', color: '#059669', background: '#d1fae5', padding: '2px 8px', borderRadius: '6px', fontWeight: 600 }}>
                                                        Cost: ₹{m.cost || '0.00'}
                                                    </span>
                                                </div>
                                                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                                                    {m.description || 'No description provided.'}
                                                </div>
                                                {m.outcomeNotes && (
                                                    <div style={{ fontSize: '11px', color: '#334155', background: '#f8fafc', padding: '6px 10px', borderRadius: '6px', marginTop: '6px' }}>
                                                        Outcome: <strong>{m.outcomeNotes}</strong>
                                                    </div>
                                                )}
                                                {m.imageUrl && (
                                                    <div style={{ marginTop: '8px' }}>
                                                        <span style={{ fontSize: '11px', color: '#64748b' }}>Attachment: </span>
                                                        {m.imageUrl.toLowerCase().endsWith('.pdf') ? (
                                                            <a href={m.imageUrl} target="_blank" rel="noreferrer" style={{ fontSize: '12px', color: '#4f46e5', fontWeight: 600, textDecoration: 'underline' }}>View PDF</a>
                                                        ) : (
                                                            <a href={m.imageUrl} target="_blank" rel="noreferrer">
                                                                <img src={m.imageUrl} alt="Maintenance attachment" style={{ maxWidth: '100px', maxHeight: '100px', borderRadius: '6px', border: '1px solid #e2e8f0', display: 'block', marginTop: '4px' }} />
                                                            </a>
                                                        )}
                                                    </div>
                                                )}
                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#94a3b8', marginTop: '6px' }}>
                                                    <span>Log added on: <strong>{formatDate(m.createdAt)}</strong></span>
                                                    {m.completedAt && <span>Completed: <strong>{formatDate(m.completedAt)}</strong></span>}
                                                </div>
                                                {m.vendor && (
                                                    <div style={{ fontSize: '11px', color: '#475569', marginTop: '4px' }}>
                                                        Vendor: <strong>{m.vendor}</strong>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )
                            )}

                            <div className="asset-modal-actions">
                                <button type="button" className="asset-btn-secondary" onClick={() => setShowHistoryModal(false)}>Close</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showTicketModal && (
                <div className="asset-modal-overlay" onClick={() => !submitting && setShowTicketModal(false)}>
                    <div className="asset-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="asset-modal-header"><h2>Asset ticket</h2></div>
                        <div className="asset-modal-body">
                            <form onSubmit={handleCreateTicket}>
                                <div className="asset-field">
                                    <label>Asset *</label>
                                    <select required value={ticketForm.assetId || ''} onChange={(e) => setTicketForm({ ...ticketForm, assetId: e.target.value })}>
                                        <option value="">Select asset</option>
                                        {assets.map((a) => (
                                            <option key={a.id} value={a.id}>{a.assetName} ({a.assetId})</option>
                                        ))}
                                    </select>
                                </div>
                                {(() => {
                                    const currentAsset = selectedAsset || assets.find(a => Number(a.id) === Number(ticketForm.assetId));
                                    const assignedEmployees = currentAsset?.assignedEmployees || [];
                                    if (assignedEmployees.length > 1) {
                                        return (
                                            <div className="asset-field">
                                                <label>Tag Employee *</label>
                                                <select 
                                                    required
                                                    value={ticketForm.taggedEmployeeId || ''} 
                                                    onChange={(e) => setTicketForm({ ...ticketForm, taggedEmployeeId: e.target.value })}
                                                >
                                                    <option value="">Select Employee to tag</option>
                                                    {assignedEmployees.map((emp) => (
                                                        <option key={emp.employeeId} value={emp.employeeId}>
                                                            {emp.employeeName} ({emp.employeeEmployeeId || 'No ID'})
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        );
                                    }
                                    return null;
                                })()}
                                <div className="asset-form-grid">
                                    <div className="asset-field">
                                        <label>Type *</label>
                                        <select value={ticketForm.ticketType} onChange={(e) => setTicketForm({ ...ticketForm, ticketType: e.target.value })}>
                                            {ticketTypes.map((t) => <option key={t} value={t}>{t}</option>)}
                                        </select>
                                    </div>
                                    <div className="asset-field">
                                        <label>Priority</label>
                                        <select value={ticketForm.priority} onChange={(e) => setTicketForm({ ...ticketForm, priority: e.target.value })}>
                                            {['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map((p) => <option key={p} value={p}>{p}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div className="asset-field">
                                    <label>Subject *</label>
                                    <input required value={ticketForm.subject} onChange={(e) => setTicketForm({ ...ticketForm, subject: e.target.value })} />
                                </div>
                                <div className="asset-field">
                                    <label>Description</label>
                                    <textarea value={ticketForm.description} onChange={(e) => setTicketForm({ ...ticketForm, description: e.target.value })} />
                                </div>
                                <div className="asset-field" style={{ marginBottom: '16px' }}>
                                    <label>Upload Support Photo / Invoice (Optional)</label>
                                    <input 
                                        type="file" 
                                        accept="image/*,application/pdf" 
                                        onChange={(e) => handleFileChange(e, (url) => setTicketForm(prev => ({ ...prev, imageUrl: url })))}
                                        disabled={uploadingFile}
                                    />
                                    {uploadingFile && <p style={{ fontSize: '12px', color: '#6366f1', margin: '4px 0 0 0' }}>Uploading...</p>}
                                    {ticketForm.imageUrl && (
                                        <p style={{ fontSize: '12px', color: '#10b981', margin: '4px 0 0 0' }}>
                                            ✓ Uploaded: <a href={ticketForm.imageUrl} target="_blank" rel="noreferrer" style={{ textDecoration: 'underline' }}>View file</a>
                                        </p>
                                    )}
                                </div>
                                <div className="asset-modal-actions">
                                    <button type="button" className="asset-btn-secondary" onClick={() => setShowTicketModal(false)}>Cancel</button>
                                    <button type="submit" className="asset-btn-primary" disabled={submitting || uploadingFile}>{submitting ? 'Saving…' : 'Create ticket'}</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {showMaintenanceModal && (
                <div className="asset-modal-overlay" onClick={() => !submitting && setShowMaintenanceModal(false)}>
                    <div className="asset-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="asset-modal-header"><h2>Log maintenance</h2></div>
                        <div className="asset-modal-body">
                            <form onSubmit={handleAddMaintenance}>
                                <div className="asset-field">
                                    <label>Asset *</label>
                                    <select required value={maintenanceForm.assetId || ''} onChange={(e) => setMaintenanceForm({ ...maintenanceForm, assetId: e.target.value })}>
                                        <option value="">Select asset</option>
                                        {assets.map((a) => (
                                            <option key={a.id} value={a.id}>{a.assetName} ({a.assetId})</option>
                                        ))}
                                    </select>
                                </div>
                                {(() => {
                                    const currentAsset = selectedAsset || assets.find(a => Number(a.id) === Number(maintenanceForm.assetId));
                                    const assignedEmployees = currentAsset?.assignedEmployees || [];
                                    if (assignedEmployees.length > 1) {
                                        return (
                                            <div className="asset-field">
                                                <label>Tag Employee *</label>
                                                <select 
                                                    required
                                                    value={maintenanceForm.taggedEmployeeId || ''} 
                                                    onChange={(e) => setMaintenanceForm({ ...maintenanceForm, taggedEmployeeId: e.target.value })}
                                                >
                                                    <option value="">Select Employee to tag</option>
                                                    {assignedEmployees.map((emp) => (
                                                        <option key={emp.employeeId} value={emp.employeeId}>
                                                            {emp.employeeName} ({emp.employeeEmployeeId || 'No ID'})
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        );
                                    }
                                    return null;
                                })()}
                                <div className="asset-form-grid">
                                    <div className="asset-field">
                                        <label>Type</label>
                                        <select
                                            value={['GENERAL', 'REPAIR', 'UPGRADE', 'PREVENTATIVE', 'SOFTWARE', 'HARDWARE'].includes(maintenanceForm.maintenanceType) ? maintenanceForm.maintenanceType : (maintenanceForm.maintenanceType ? 'OTHER' : 'GENERAL')}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                if (val === 'OTHER') {
                                                    setMaintenanceForm({ ...maintenanceForm, maintenanceType: '' });
                                                } else {
                                                    setMaintenanceForm({ ...maintenanceForm, maintenanceType: val });
                                                }
                                            }}
                                        >
                                            <option value="GENERAL">GENERAL</option>
                                            <option value="REPAIR">REPAIR</option>
                                            <option value="UPGRADE">UPGRADE</option>
                                            <option value="PREVENTATIVE">PREVENTATIVE</option>
                                            <option value="SOFTWARE">SOFTWARE</option>
                                            <option value="HARDWARE">HARDWARE</option>
                                            <option value="OTHER">Other</option>
                                        </select>
                                    </div>
                                    <div className="asset-field">
                                        <label>Vendor</label>
                                        <input value={maintenanceForm.vendor} onChange={(e) => setMaintenanceForm({ ...maintenanceForm, vendor: e.target.value })} />
                                    </div>
                                </div>
                                {!['GENERAL', 'REPAIR', 'UPGRADE', 'PREVENTATIVE', 'SOFTWARE', 'HARDWARE'].includes(maintenanceForm.maintenanceType) && (
                                    <div className="asset-field" style={{ marginTop: '12px' }}>
                                        <label>Custom Type Name</label>
                                        <input
                                            placeholder="Enter custom type..."
                                            value={maintenanceForm.maintenanceType}
                                            onChange={(e) => setMaintenanceForm({ ...maintenanceForm, maintenanceType: e.target.value })}
                                        />
                                    </div>
                                )}
                                <div className="asset-form-grid" style={{ marginTop: '12px' }}>
                                    <div className="asset-field">
                                        <label style={{ display: 'flex', alignItems: 'flex-end', minHeight: '28px' }}>Cost</label>
                                        <input type="number" step="0.01" value={maintenanceForm.cost} onChange={(e) => setMaintenanceForm({ ...maintenanceForm, cost: e.target.value })} />
                                    </div>
                                    <div className="asset-field">
                                        <label style={{ display: 'flex', alignItems: 'flex-end', minHeight: '28px' }}>Resolved Date (Completed At)</label>
                                        <input type="date" value={maintenanceForm.completedAt} onChange={(e) => setMaintenanceForm({ ...maintenanceForm, completedAt: e.target.value })} />
                                    </div>
                                </div>
                                <div className="asset-field">
                                    <label>Description</label>
                                    <textarea value={maintenanceForm.description} onChange={(e) => setMaintenanceForm({ ...maintenanceForm, description: e.target.value })} />
                                </div>
                                <div className="asset-field">
                                    <label>Outcome notes</label>
                                    <textarea value={maintenanceForm.outcomeNotes} onChange={(e) => setMaintenanceForm({ ...maintenanceForm, outcomeNotes: e.target.value })} />
                                </div>
                                <div className="asset-field" style={{ marginBottom: '16px' }}>
                                    <label>Upload Support Document / Photo (Optional)</label>
                                    <input 
                                        type="file" 
                                        accept="image/*,application/pdf" 
                                        onChange={(e) => handleFileChange(e, (url) => setMaintenanceForm(prev => ({ ...prev, imageUrl: url })))}
                                        disabled={uploadingFile}
                                    />
                                    {uploadingFile && <p style={{ fontSize: '12px', color: '#6366f1', margin: '4px 0 0 0' }}>Uploading...</p>}
                                    {maintenanceForm.imageUrl && (
                                        <p style={{ fontSize: '12px', color: '#10b981', margin: '4px 0 0 0' }}>
                                            ✓ Uploaded: <a href={maintenanceForm.imageUrl} target="_blank" rel="noreferrer" style={{ textDecoration: 'underline' }}>View file</a>
                                        </p>
                                    )}
                                </div>
                                <div className="asset-modal-actions">
                                    <button type="button" className="asset-btn-secondary" onClick={() => setShowMaintenanceModal(false)}>Cancel</button>
                                    <button type="submit" className="asset-btn-primary" disabled={submitting || uploadingFile}>{submitting ? 'Saving…' : 'Save log'}</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {showStatusModal && selectedAsset && (
                <div className="asset-modal-overlay" onClick={() => setShowStatusModal(false)}>
                    <div className="asset-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
                        <div className="asset-modal-header">
                            <h2>Change status</h2>
                        </div>
                        <div className="asset-modal-body">
                            <form onSubmit={(e) => {
                                e.preventDefault();
                                handleStatusChange(selectedAsset, statusFormValue);
                                setShowStatusModal(false);
                            }}>
                                <div style={{ marginBottom: '16px' }}>
                                    <p style={{ fontSize: '14px', color: '#475569', margin: '0 0 6px 0' }}>Asset: <strong>{selectedAsset.assetName}</strong></p>
                                    <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>Asset ID: {selectedAsset.assetId || '—'}</p>
                                </div>
                                <div className="asset-field">
                                    <label htmlFor="status-select-modal">Select new status *</label>
                                    <select
                                        id="status-select-modal"
                                        required
                                        value={statusFormValue}
                                        onChange={e => setStatusFormValue(e.target.value)}
                                        style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', background: '#fff' }}
                                    >
                                        {Object.keys(statusConfig).map((s) => (
                                            <option key={s} value={s}>{statusConfig[s]?.label || s}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="asset-modal-actions" style={{ marginTop: '20px' }}>
                                    <button type="button" className="asset-btn-secondary" onClick={() => setShowStatusModal(false)}>
                                        Cancel
                                    </button>
                                    <button type="submit" className="asset-btn-primary">
                                        Update Status
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {showReturnConfirmModal && (() => {
                const targetAsset = assets.find(a => a.id === pendingReturnAssetId);
                return (
                    <div className="asset-modal-overlay" onClick={() => setShowReturnConfirmModal(false)}>
                        <div className="asset-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
                            <div className="asset-modal-header">
                                <h2>Confirm Return</h2>
                            </div>
                            <div className="asset-modal-body">
                                {targetAsset && (
                                    <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '16px' }}>
                                        <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Asset to Return</div>
                                        <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', marginTop: '4px' }}>{targetAsset.assetName}</div>
                                        {targetAsset.serialNumber && (
                                            <div style={{ fontSize: '12px', color: '#334155', marginTop: '4px' }}>
                                                Serial Number: <strong>{targetAsset.serialNumber}</strong>
                                            </div>
                                        )}
                                        <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>Current Assignee: {targetAsset.assignedToName || 'Unassigned'}</div>
                                    </div>
                                )}
                                <p style={{ fontSize: '14px', color: '#334155', marginBottom: '16px', lineHeight: '1.5' }}>
                                    Are you sure you want to mark this asset as returned? This will update its status back to available.
                                </p>
                            <div className="asset-field" style={{ marginBottom: '20px' }}>
                                <label>Upload Return Photo / Document (Optional)</label>
                                <input 
                                    type="file" 
                                    accept="image/*,application/pdf" 
                                    onChange={(e) => handleFileChange(e, setReturnImageUrl)}
                                    disabled={uploadingFile}
                                />
                                {uploadingFile && <p style={{ fontSize: '12px', color: '#6366f1', margin: '4px 0 0 0' }}>Uploading...</p>}
                                {returnImageUrl && (
                                    <p style={{ fontSize: '12px', color: '#10b981', margin: '4px 0 0 0' }}>
                                        ✓ Uploaded: <a href={returnImageUrl} target="_blank" rel="noreferrer" style={{ textDecoration: 'underline' }}>View file</a>
                                    </p>
                                )}
                            </div>
                            <div className="asset-modal-actions">
                                <button type="button" className="asset-btn-secondary" onClick={() => setShowReturnConfirmModal(false)}>
                                    Cancel
                                </button>
                                <button type="button" className="asset-btn-primary" onClick={confirmReturnAsset} disabled={submitting || uploadingFile}>
                                    {submitting ? 'Returning…' : 'Yes, Return'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
                );
            })()}

            {showCloseTicketModal && pendingTicket && (
                <div className="asset-modal-overlay" onClick={() => !submitting && setShowCloseTicketModal(false)}>
                    <div className="asset-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '450px' }}>
                        <div className="asset-modal-header">
                            <h2>Resolve / Close Ticket</h2>
                        </div>
                        <div className="asset-modal-body">
                            <form onSubmit={async (e) => {
                                e.preventDefault();
                                setSubmitting(true);
                                try {
                                    await adminAPI.updateAssetTicket(pendingTicket.id, {
                                        status: pendingTicketStatus,
                                        resolutionNotes: ticketResolutionNotes || null,
                                        resolutionImageUrl: ticketResolutionImageUrl || null,
                                    });
                                    toast.success(`Ticket marked ${pendingTicketStatus}`);
                                    setShowCloseTicketModal(false);
                                    fetchTickets();
                                    fetchAssets();
                                } catch (err) {
                                    toast.error(err.response?.data?.message || 'Failed to update ticket');
                                } finally {
                                    setSubmitting(false);
                                }
                            }}>
                                <p style={{ fontSize: '14px', color: '#334155', marginBottom: '12px' }}>
                                    Ticket: <strong>{pendingTicket.ticketNumber}</strong> · Type: {pendingTicket.ticketType}
                                </p>
                                <div className="asset-field" style={{ marginBottom: '12px' }}>
                                    <label>Resolution Notes *</label>
                                    <textarea 
                                        required 
                                        placeholder="Enter details about how the ticket was resolved..." 
                                        value={ticketResolutionNotes} 
                                        onChange={e => setTicketResolutionNotes(e.target.value)}
                                    />
                                </div>
                                <div className="asset-field" style={{ marginBottom: '20px' }}>
                                    <label>Upload Resolution Document / Photo (Optional)</label>
                                    <input 
                                        type="file" 
                                        accept="image/*,application/pdf" 
                                        onChange={(e) => handleFileChange(e, setTicketResolutionImageUrl)}
                                        disabled={uploadingFile}
                                    />
                                    {uploadingFile && <p style={{ fontSize: '12px', color: '#6366f1', margin: '4px 0 0 0' }}>Uploading...</p>}
                                    {ticketResolutionImageUrl && (
                                        <p style={{ fontSize: '12px', color: '#10b981', margin: '4px 0 0 0' }}>
                                            ✓ Uploaded: <a href={ticketResolutionImageUrl} target="_blank" rel="noreferrer" style={{ textDecoration: 'underline' }}>View file</a>
                                        </p>
                                    )}
                                </div>
                                <div className="asset-modal-actions">
                                    <button type="button" className="asset-btn-secondary" onClick={() => setShowCloseTicketModal(false)}>
                                        Cancel
                                    </button>
                                    <button type="submit" className="asset-btn-primary" disabled={submitting || uploadingFile}>
                                        Confirm {pendingTicketStatus === 'RESOLVED' ? 'Resolution' : 'Closure'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
