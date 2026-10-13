import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { teamAPI, exitAPI, managerAssetAPI, locationsAPI } from '../services/api';
import {
    RefreshCw,
    Box,
    AlertCircle,
    Info,
    Plus,
    Monitor,
    UserPlus,
    X,
    CheckCircle,
    XCircle,
    MoreVertical,
    Smartphone,
    HardDrive,
    Headphones,
    Briefcase,
    LayoutDashboard,
    Ticket,
    Wrench,
    ArrowRightLeft,
    Search,
    History,
    Package,
    Pencil,
    Trash2
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import Header from '../components/Header';

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

const statusConfig = {
    AVAILABLE: { label: 'Available', color: '#059669', bg: '#D1FAE5' },
    ASSIGNED: { label: 'Assigned', color: '#2563EB', bg: '#DBEAFE' },
    MAINTENANCE: { label: 'Maintenance', color: '#D97706', bg: '#FEF3C7' },
    DAMAGED: { label: 'Damaged', color: '#DC2626', bg: '#FEE2E2' },
    LOST: { label: 'Lost', color: '#7C3AED', bg: '#EDE9FE' },
};

const getTypeIcon = (type) => {
    switch (type?.toUpperCase()) {
        case 'LAPTOP':
        case 'MONITOR':
            return Monitor;
        case 'MOBILE':
        case 'TABLET':
            return Smartphone;
        case 'KEYBOARD':
        case 'MOUSE':
        case 'CHARGER':
            return HardDrive;
        case 'HEADPHONES':
            return Headphones;
        case 'BAG':
            return Briefcase;
        default:
            return Box;
    }
};

const ASSET_TYPE_OPTIONS = ['LAPTOP', 'MOBILE', 'TABLET', 'MONITOR', 'KEYBOARD', 'MOUSE', 'HEADPHONES', 'CHARGER', 'BAG', 'OTHER'];

const getTeamMemberDbId = (member) => {
    if (!member) return '';
    const rawId = member.id ?? member.employeeIdNumber ?? member.employee?.id ?? member.employee_id;
    if (rawId == null || rawId === '') return '';
    const num = Number(rawId);
    return Number.isFinite(num) ? String(num) : '';
};

export default function TeamAssetManagement() {
    const { user, hasAdminAccess, hasCrudPermission: baseHasCrudPermission } = useAuth();
    const hasCrudPermission = useCallback((moduleName, operation) => {
        if (moduleName === 'ASSETS') {
            return baseHasCrudPermission('PEOPLE_ORG_ASSETS_TEAM', operation);
        }
        return baseHasCrudPermission(moduleName, operation);
    }, [baseHasCrudPermission]);

    const isAdminUser = hasAdminAccess && hasAdminAccess();
    const location = useLocation();
    const isOrgView = isAdminUser && location.pathname.startsWith('/admin');

    const [loading, setLoading] = useState(true);
    const [teamMembers, setTeamMembers] = useState([]);
    const [teamAssets, setTeamAssets] = useState([]);
    const [teamTickets, setTeamTickets] = useState([]);
    const [availableAssets, setAvailableAssets] = useState([]);
    const [allAssets, setAllAssets] = useState([]);
    const [assignedHandovers, setAssignedHandovers] = useState([]);
    const [loadingTeamAssets, setLoadingTeamAssets] = useState(false);
    const [loadingHandovers, setLoadingHandovers] = useState(false);
    const [loadingTickets, setLoadingTickets] = useState(false);
    
    const [selectedMemberAssets, setSelectedMemberAssets] = useState(null);
    const [activeTab, setActiveTab] = useState('members');
    const [activeDropdownId, setActiveDropdownId] = useState(null);
    const [showAssetModal, setShowAssetModal] = useState(false);
    const [showAssignAssetModal, setShowAssignAssetModal] = useState(false);
    const [assetAssignMode, setAssetAssignMode] = useState('existing');
    const [assetAssignForm, setAssetAssignForm] = useState({
        employeeId: '', assetId: '', notes: '', location: '', assetName: '', assetType: 'LAPTOP', imageUrl: '', configuration: '',
    });
    const [memberSearchTerm, setMemberSearchTerm] = useState('');
    const [showMemberDropdown, setShowMemberDropdown] = useState(false);
    const [assigningAsset, setAssigningAsset] = useState(false);
    const [updatingAssetStatusId, setUpdatingAssetStatusId] = useState(null);
    const [selectedHandover, setSelectedHandover] = useState(null);
    const [showHandoverModal, setShowHandoverModal] = useState(false);
    const [updatingHandoverItemId, setUpdatingHandoverItemId] = useState(null);

    const [selectedAssetHistory, setSelectedAssetHistory] = useState(null);
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [history, setHistory] = useState([]);
    const [assetTickets, setAssetTickets] = useState([]);
    const [assetMaintenance, setAssetMaintenance] = useState([]);
    const [historyTab, setHistoryTab] = useState('lifecycle');

    const [showTransferModal, setShowTransferModal] = useState(false);
    const [selectedAssetTransfer, setSelectedAssetTransfer] = useState(null);
    const [transferData, setTransferData] = useState({ assetId: null, toEmployeeId: '', notes: '', location: '', imageUrl: '' });
    const [showStatusModal, setShowStatusModal] = useState(false);
    const [selectedAssetStatus, setSelectedAssetStatus] = useState(null);
    const [statusFormValue, setStatusFormValue] = useState('');
    const [showReturnConfirmModal, setShowReturnConfirmModal] = useState(false);
    const [pendingReturnAssetId, setPendingReturnAssetId] = useState(null);
    const [showMaintenanceModal, setShowMaintenanceModal] = useState(false);
    const [maintenanceForm, setMaintenanceForm] = useState({
        assetId: null, vendor: '', cost: '', maintenanceType: 'GENERAL', description: '',
        startedAt: '', completedAt: '', outcomeNotes: '', imageUrl: '', taggedEmployeeId: '',
    });
    const [showTicketModal, setShowTicketModal] = useState(false);
    const [ticketForm, setTicketForm] = useState({
        assetId: '', ticketType: 'REPAIR', priority: 'MEDIUM', subject: '', description: '', imageUrl: '', taggedEmployeeId: '',
    });
    const [assetSearchTerm, setAssetSearchTerm] = useState('');
    const [assetTypeFilter, setAssetTypeFilter] = useState('ALL');
    const [assetStatusFilter, setAssetStatusFilter] = useState('ALL');

    // File upload and ticket closure states
    const [uploadingFile, setUploadingFile] = useState(false);
    const [returnImageUrl, setReturnImageUrl] = useState('');
    const [showCloseTicketModal, setShowCloseTicketModal] = useState(false);
    const [pendingTicket, setPendingTicket] = useState(null);
    const [pendingTicketStatus, setPendingTicketStatus] = useState('');
    const [ticketResolutionNotes, setTicketResolutionNotes] = useState('');
    const [ticketResolutionImageUrl, setTicketResolutionImageUrl] = useState('');
    const [locations, setLocations] = useState([]);
    
    // Delete Asset confirmation modal state
    const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
    const [pendingDeleteAssetId, setPendingDeleteAssetId] = useState(null);

    const fetchLocations = async () => {
        try {
            const response = await locationsAPI.list(0, 100);
            const locList = Array.isArray(response.data?.items) ? response.data.items : (Array.isArray(response.data) ? response.data : []);
            setLocations(locList);
        } catch (error) {
            console.error('Error fetching locations:', error);
        }
    };

    useEffect(() => {
        const handleOutsideClick = () => setActiveDropdownId(null);
        window.addEventListener('click', handleOutsideClick);
        return () => window.removeEventListener('click', handleOutsideClick);
    }, []);

    const fetchTeamAssets = async () => {
        try {
            setLoadingTeamAssets(true);
            setLoadingHandovers(true);
            setLoadingTickets(true);
            const [assetsRes, availableRes, allAssetsRes, handoversRes, ticketsRes] = await Promise.all([
                managerAssetAPI.getTeamAssets(isOrgView),
                managerAssetAPI.getAvailableAssets(),
                managerAssetAPI.getAllAssets().catch(() => ({ data: [] })),
                exitAPI.getMyAssignedHandovers().catch(() => ({ data: [] })),
                managerAssetAPI.getTickets().catch(() => ({ data: [] })),
            ]);
            setTeamAssets(assetsRes.data || []);
            setAvailableAssets(availableRes.data || []);
            setAllAssets(allAssetsRes.data || []);
            setAssignedHandovers(Array.isArray(handoversRes?.data) ? handoversRes.data : []);
            setTeamTickets(ticketsRes?.data || []);
        } catch (err) {
            console.warn('Failed to fetch team assets', err);
            toast.error(err.response?.data?.message || 'Failed to load team assets');
        } finally {
            setLoadingTeamAssets(false);
            setLoadingHandovers(false);
            setLoadingTickets(false);
        }
    };

    const fetchTeamMembers = async () => {
        try {
            const managerId = user?.employeeId || user?.id;
            if (managerId) {
                const res = await teamAPI.getTeamOverview(managerId);
                setTeamMembers(res.data || []);
            }
        } catch (err) {
            console.error('Failed to fetch team members', err);
        }
    };

    useEffect(() => {
        const init = async () => {
            setLoading(true);
            await Promise.all([fetchTeamMembers(), fetchTeamAssets(), fetchLocations()]);
            setLoading(false);
        };
        init();
    }, [user, isOrgView]);

    const openMemberAssetsModal = (member) => {
        const memberDbId = Number(getTeamMemberDbId(member));
        const memberAssets = teamAssets.filter(asset => asset.assignedToId === memberDbId);
        setSelectedMemberAssets({
            member,
            assets: memberAssets,
        });
        setShowAssetModal(true);
    };

    const openAssignAssetModal = (member = null, prepopulatedAsset = null) => {
        const dbId = member ? getTeamMemberDbId(member) : '';
        setAssetAssignForm({
            employeeId: dbId,
            assetId: prepopulatedAsset ? String(prepopulatedAsset.id) : '',
            notes: '',
            location: '',
            assetName: prepopulatedAsset ? prepopulatedAsset.assetName : '',
            assetType: prepopulatedAsset ? prepopulatedAsset.assetType : 'LAPTOP',
            imageUrl: prepopulatedAsset ? prepopulatedAsset.imageUrl : '',
            brand: prepopulatedAsset ? prepopulatedAsset.brand : '',
            model: prepopulatedAsset ? prepopulatedAsset.model : '',
            serialNumber: prepopulatedAsset ? prepopulatedAsset.serialNumber : '',
            configuration: prepopulatedAsset ? prepopulatedAsset.configuration : '',
        });
        if (member) {
            setMemberSearchTerm(`${member.firstName || ''} ${member.lastName || ''}`.trim() + ` (${member.employeeId || ''})`);
        } else {
            setMemberSearchTerm('');
        }
        setShowMemberDropdown(false);
        setAssetAssignMode(prepopulatedAsset || !hasCrudPermission('ASSETS', 'create') ? 'existing' : 'new');
        setShowAssignAssetModal(true);
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
            const res = await managerAssetAPI.uploadAssetFile(file);
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

    const handleAssignTeamAsset = async () => {
        const employeeId = Number(assetAssignForm.employeeId);
        if (!assetAssignForm.employeeId || !Number.isFinite(employeeId)) {
            toast.error('Select a valid team member');
            return;
        }

        if (assetAssignMode === 'new') {
            const assetName = (assetAssignForm.assetName || '').trim();
            if (!assetName) {
                toast.error('Enter an asset name');
                return;
            }
            try {
                setAssigningAsset(true);
                await managerAssetAPI.createAndAssignAsset({
                    employeeId,
                    assetName,
                    assetType: assetAssignForm.assetType || 'OTHER',
                    brand: assetAssignForm.brand || undefined,
                    model: assetAssignForm.model || undefined,
                    serialNumber: assetAssignForm.serialNumber || undefined,
                    notes: assetAssignForm.notes || undefined,
                    location: assetAssignForm.location || undefined,
                    imageUrl: assetAssignForm.imageUrl || null,
                    configuration: assetAssignForm.configuration || undefined,
                }, isOrgView);
                toast.success('Asset added and assigned to team member');
                setShowAssignAssetModal(false);
                fetchTeamAssets();
            } catch (err) {
                toast.error(err.response?.data?.message || 'Failed to add asset');
            } finally {
                setAssigningAsset(false);
            }
            return;
        }

        const assetId = Number(assetAssignForm.assetId);
        if (!assetAssignForm.assetId || !Number.isFinite(assetId)) {
            toast.error('Select an asset from inventory');
            return;
        }

        const asset = allAssets.find(a => a.id === assetId);
        if (asset && Array.isArray(asset.assignedEmployees)) {
            const alreadyAssigned = asset.assignedEmployees.some(emp => emp.employeeId === employeeId);
            if (alreadyAssigned) {
                toast.error("This asset is already assigned to this employee");
                return;
            }
        }

        try {
            setAssigningAsset(true);
            await managerAssetAPI.assignAsset({
                employeeId,
                assetId,
                notes: assetAssignForm.notes || undefined,
                location: assetAssignForm.location || undefined,
            }, isOrgView);
            toast.success('Asset assigned to team member');
            setShowAssignAssetModal(false);
            fetchTeamAssets();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to assign asset');
        } finally {
            setAssigningAsset(false);
        }
    };

    const handleReturnTeamAsset = (assetId) => {
        setPendingReturnAssetId(assetId);
        setShowReturnConfirmModal(true);
    };

    const confirmReturnTeamAsset = async () => {
        if (!pendingReturnAssetId) return;
        try {
            setAssigningAsset(true);
            await managerAssetAPI.returnAsset(pendingReturnAssetId, isOrgView, returnImageUrl || null);
            toast.success('Asset returned');
            fetchTeamAssets();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to return asset');
        } finally {
            setAssigningAsset(false);
            setShowReturnConfirmModal(false);
            setPendingReturnAssetId(null);
            setReturnImageUrl('');
        }
    };

    const handleDeleteAsset = (assetId) => {
        setPendingDeleteAssetId(assetId);
        setShowDeleteConfirmModal(true);
    };

    const confirmDeleteAsset = async () => {
        if (!pendingDeleteAssetId) return;
        try {
            setAssigningAsset(true);
            await managerAssetAPI.deleteAsset(pendingDeleteAssetId);
            toast.success('Asset deleted successfully');
            fetchTeamAssets();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to delete asset');
        } finally {
            setAssigningAsset(false);
            setShowDeleteConfirmModal(false);
            setPendingDeleteAssetId(null);
        }
    };

    const handleUpdateTeamAssetStatus = async (assetId, status) => {
        if (!assetId || !status) return;
        try {
            setUpdatingAssetStatusId(assetId);
            await managerAssetAPI.updateAssetStatus(assetId, status, isOrgView);
            toast.success('Asset status updated');
            fetchTeamAssets();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Update failed');
        } finally {
            setUpdatingAssetStatusId(null);
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
            await managerAssetAPI.updateTicket(ticket.id, { status });
            toast.success(`Ticket marked as ${status.replace('_', ' ')}`);
            fetchTeamAssets();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to update ticket status');
        }
    };

    const handleUpdateHandoverItemStatus = async (itemId, status) => {
        if (!itemId || !status) return;
        try {
            setUpdatingHandoverItemId(itemId);
            await exitAPI.updateAssetItem(itemId, { status });
            toast.success('Asset handover status updated');
            fetchTeamAssets();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Update failed');
        } finally {
            setUpdatingHandoverItemId(null);
        }
    };

    const openHistoryModal = async (asset) => {
        setSelectedAssetHistory(asset);
        setShowHistoryModal(true);
        setHistoryTab('lifecycle');
        setHistory([]);
        setAssetTickets([]);
        setAssetMaintenance([]);
        try {
            const [historyRes, maintenanceRes] = await Promise.allSettled([
                managerAssetAPI.getAssetHistory(asset.id),
                managerAssetAPI.getAssetMaintenanceForAsset(asset.id)
            ]);
            if (historyRes.status === 'fulfilled' && Array.isArray(historyRes.value?.data)) {
                setHistory(historyRes.value.data);
            }
            if (maintenanceRes.status === 'fulfilled' && Array.isArray(maintenanceRes.value?.data)) {
                setAssetMaintenance(maintenanceRes.value.data);
            }
            const tickets = teamTickets.filter(t => t.assetId === asset.id || t.assetCode === asset.assetCode);
            setAssetTickets(tickets);
        } catch (err) {
            console.error('Failed to load asset details', err);
        }
    };

    const openMaintenance = (asset) => {
        setMaintenanceForm({
            assetId: asset?.id || null,
            vendor: '', cost: '', maintenanceType: 'GENERAL', description: '',
            startedAt: '', completedAt: '', outcomeNotes: '', imageUrl: '',
            taggedEmployeeId: '',
        });
        setSelectedAssetHistory(asset || null);
        setShowMaintenanceModal(true);
    };

    const handleAddMaintenance = async (e) => {
        e.preventDefault();
        setAssigningAsset(true);
        try {
            let desc = maintenanceForm.description || '';
            if (maintenanceForm.taggedEmployeeId) {
                const emp = teamMembers.find(m => String(m.id || m.employeeId) === String(maintenanceForm.taggedEmployeeId));
                if (emp) {
                    const empName = `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || emp.employeeId;
                    desc = `[User: ${empName} (${emp.employeeId || 'NA'})] ${desc}`;
                }
            }
            await managerAssetAPI.addMaintenance({
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
            toast.success('Maintenance logged successfully');
            setShowMaintenanceModal(false);
            fetchTeamAssets();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to log maintenance');
        } finally {
            setAssigningAsset(false);
        }
    };

    const openTicket = (asset) => {
        setTicketForm({
            assetId: asset?.id || '',
            ticketType: 'REPAIR',
            priority: 'MEDIUM',
            subject: asset ? `${asset.assetName} issue` : '',
            description: '',
            imageUrl: '',
            taggedEmployeeId: '',
        });
        setShowTicketModal(true);
    };

    const handleRaiseTicket = async (e) => {
        e.preventDefault();
        setAssigningAsset(true);
        try {
            let desc = ticketForm.description || '';
            if (ticketForm.taggedEmployeeId) {
                const emp = teamMembers.find(m => String(m.id || m.employeeId) === String(ticketForm.taggedEmployeeId));
                if (emp) {
                    const empName = `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || emp.employeeId;
                    desc = `[User: ${empName} (${emp.employeeId || 'NA'})] ${desc}`;
                }
            }
            await managerAssetAPI.createTicket({
                ...ticketForm,
                assetId: Number(ticketForm.assetId),
                description: desc || null,
                imageUrl: ticketForm.imageUrl || null,
            });
            toast.success('Ticket submitted successfully');
            setShowTicketModal(false);
            fetchTeamAssets();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to raise ticket');
        } finally {
            setAssigningAsset(false);
        }
    };

    const openTransferModal = (asset) => {
        setSelectedAssetTransfer(asset);
        setTransferData({
            assetId: asset.id,
            toEmployeeId: '',
            notes: '',
            location: asset.location || ''
        });
        setShowTransferModal(true);
    };

    const handleTransfer = async (e) => {
        e.preventDefault();
        if (!transferData.toEmployeeId) {
            toast.error('Please select a team member');
            return;
        }
        try {
            setAssigningAsset(true);
            await managerAssetAPI.transferAsset({
                assetId: transferData.assetId,
                toEmployeeId: Number(transferData.toEmployeeId),
                notes: transferData.notes || null,
                location: transferData.location || null,
                imageUrl: transferData.imageUrl || null,
            });
            toast.success('Asset transferred successfully');
            setShowTransferModal(false);
            fetchTeamAssets();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to transfer asset');
        } finally {
            setAssigningAsset(false);
        }
    };

    const membersWithAssets = teamMembers.map(member => ({
        member,
        assets: teamAssets.filter(asset => asset.assignedToId === Number(getTeamMemberDbId(member))),
    }));
    const membersWithAnyAssets = membersWithAssets.filter(entry => entry.assets.length > 0);
    const totalAssets = teamAssets.length;
    const teamMembersCount = teamMembers.length;
    const availableCount = availableAssets.length;

    return (
        <div className="main-content asset-page">
            <Header title="Team Asset Management" subtitle="Manage and assign equipment for your team" />
            
            <div className="page-content">
                <div className="asset-handover-redesign" style={{ animation: 'fadeIn 0.4s ease-out' }}>
                    <div className="approvals-header mp-section-wide" style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                        <div className="approvals-title-group" style={{ flex: 1 }}>
                            <h2 className="approvals-title" style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', margin: '0 0 4px 0' }}>Team Asset Management</h2>
                            <p className="approvals-sub" style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>View, assign, return, and update status for team assets and exit clearances</p>
                        </div>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button
                                onClick={fetchTeamAssets}
                                style={{
                                    border: '1px solid #cbd5e1',
                                    background: '#ffffff',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    padding: '8px 16px',
                                    borderRadius: '8px',
                                    color: '#000000',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    fontSize: '13px',
                                    height: '38px',
                                    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
                                    transition: 'all 0.2s',
                                    whiteSpace: 'nowrap'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ffffff'}
                            >
                                <RefreshCw size={14} style={{ color: '#000000' }} /> Refresh
                            </button>
                            {hasCrudPermission('ASSETS', 'update') && (
                                <button
                                    className="btn-ts btn-ts-approve"
                                    style={{ padding: '8px 20px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(217, 119, 6, 0.2)', cursor: 'pointer', border: 'none', background: '#d97706', color: '#fff', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}
                                    type="button"
                                    onClick={() => openMaintenance(null)}
                                >
                                    <Wrench size={14} /> Log Maintenance
                                </button>
                            )}
                            {hasCrudPermission('ASSETS', 'create') && (
                                <button
                                    className="btn-ts btn-ts-approve"
                                    style={{ padding: '8px 20px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)', cursor: 'pointer', border: 'none', background: '#10b981', color: '#fff', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}
                                    type="button"
                                    onClick={() => openAssignAssetModal()}
                                >
                                    <UserPlus size={14} /> Assign New
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="asset-metrics" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '32px' }}>
                        <div className="asset-m-card" style={{ borderTop: '4px solid #6366f1', background: '#fff', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
                            <div className="asset-m-lbl" style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', fontWeight: 800 }}>Team Assets</div>
                            <div className="asset-m-val" style={{ fontSize: '32px', fontWeight: 800, color: '#0f172a', margin: '8px 0 0' }}>{totalAssets}</div>
                            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>Currently assigned to your team</div>
                        </div>
                        <div className="asset-m-card" style={{ borderTop: '4px solid #10b981', background: '#fff', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
                            <div className="asset-m-lbl" style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', fontWeight: 800 }}>Team Members</div>
                            <div className="asset-m-val" style={{ fontSize: '32px', fontWeight: 800, color: '#0f172a', margin: '8px 0 0' }}>{teamMembersCount}</div>
                            <div style={{ fontSize: '11px', color: '#10b981', fontWeight: 600, marginTop: '4px' }}>{membersWithAnyAssets.length} with assets</div>
                        </div>
                        <div className="asset-m-card" style={{ borderTop: '4px solid #f59e0b', background: '#fff', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
                            <div className="asset-m-lbl" style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', fontWeight: 800 }}>Available to Assign</div>
                            <div className="asset-m-val" style={{ fontSize: '32px', fontWeight: 800, color: '#0f172a', margin: '8px 0 0' }}>{availableCount}</div>
                            <div style={{ fontSize: '11px', color: '#f59e0b', fontWeight: 600, marginTop: '4px' }}>Ready for assignment</div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', background: '#f1f5f9', padding: '4px', borderRadius: '12px', width: 'fit-content', marginBottom: '24px', flexWrap: 'wrap', gap: '4px' }}>
                        {[
                            { id: 'inventory', label: 'Inventory', icon: Package },
                            { id: 'members', label: 'Team Members', icon: UserPlus },
                            { id: 'assets', label: 'Team Assets', icon: Box },
                            { id: 'tickets', label: 'Support Tickets', icon: Ticket },
                            { id: 'clearances', label: 'Exit Clearances', icon: CheckCircle },
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

                    {activeTab === 'inventory' && (() => {
                        const term = assetSearchTerm.toLowerCase();
                        
                        // Calculate stats
                        const totalCount = allAssets.length;
                        const availableCount = allAssets.filter(a => a.status === 'AVAILABLE').length;
                        const assignedCount = allAssets.filter(a => a.status === 'ASSIGNED').length;
                        const maintenanceCount = allAssets.filter(a => a.status === 'MAINTENANCE').length;

                        const filtered = allAssets.filter(asset => {
                            const matchesSearch = !term || 
                                (asset.assetName || '').toLowerCase().includes(term) ||
                                (asset.brand || '').toLowerCase().includes(term) ||
                                (asset.model || '').toLowerCase().includes(term) ||
                                (asset.assetCode || '').toLowerCase().includes(term) ||
                                (asset.serialNumber || '').toLowerCase().includes(term);
                            const matchesType = assetTypeFilter === 'ALL' || asset.assetType === assetTypeFilter;
                            const matchesStatus = assetStatusFilter === 'ALL' || asset.status === assetStatusFilter;
                            return matchesSearch && matchesType && matchesStatus;
                        });

                        return (
                            <div className="inventory-tab-content" style={{ animation: 'fadeIn 0.3s ease-out' }}>
                                {/* Inventory KPI Cards */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                                    <div className="asset-m-card" style={{ borderTop: '4px solid #4f46e5', background: '#fff', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
                                        <div className="asset-m-lbl" style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', fontWeight: 800 }}>Total Assets</div>
                                        <div className="asset-m-val" style={{ fontSize: '32px', fontWeight: 800, color: '#0f172a', margin: '8px 0 0' }}>{totalCount}</div>
                                        <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, marginTop: '4px' }}>Registered in organization</div>
                                    </div>
                                    <div className="asset-m-card" style={{ borderTop: '4px solid #16a34a', background: '#fff', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
                                        <div className="asset-m-lbl" style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', fontWeight: 800 }}>Available</div>
                                        <div className="asset-m-val" style={{ fontSize: '32px', fontWeight: 800, color: '#0f172a', margin: '8px 0 0' }}>{availableCount}</div>
                                        <div style={{ fontSize: '11px', color: '#16a34a', fontWeight: 600, marginTop: '4px' }}>Ready to assign</div>
                                    </div>
                                    <div className="asset-m-card" style={{ borderTop: '4px solid #1e40af', background: '#fff', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
                                        <div className="asset-m-lbl" style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', fontWeight: 800 }}>Assigned</div>
                                        <div className="asset-m-val" style={{ fontSize: '32px', fontWeight: 800, color: '#0f172a', margin: '8px 0 0' }}>{assignedCount}</div>
                                        <div style={{ fontSize: '11px', color: '#1e40af', fontWeight: 600, marginTop: '4px' }}>Currently in use</div>
                                    </div>
                                    <div className="asset-m-card" style={{ borderTop: '4px solid #b45309', background: '#fff', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
                                        <div className="asset-m-lbl" style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', fontWeight: 800 }}>Maintenance</div>
                                        <div className="asset-m-val" style={{ fontSize: '32px', fontWeight: 800, color: '#0f172a', margin: '8px 0 0' }}>{maintenanceCount}</div>
                                        <div style={{ fontSize: '11px', color: '#b45309', fontWeight: 600, marginTop: '4px' }}>Under repair / service</div>
                                    </div>
                                </div>

                                {/* Search and Filter Toolbar */}
                                <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
                                    <div style={{ position: 'relative', flex: 1, minWidth: '260px' }}>
                                        <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                                        <input
                                            type="text"
                                            placeholder="Search inventory by name, brand, model, serial, or ID..."
                                            value={assetSearchTerm}
                                            onChange={(e) => setAssetSearchTerm(e.target.value)}
                                            style={{
                                                width: '100%',
                                                padding: '10px 12px 10px 38px',
                                                borderRadius: '8px',
                                                border: '1px solid #e2e8f0',
                                                fontSize: '13px',
                                                color: '#0f172a',
                                                outline: 'none',
                                                boxSizing: 'border-box'
                                            }}
                                        />
                                    </div>
                                    <select
                                        value={assetTypeFilter}
                                        onChange={(e) => setAssetTypeFilter(e.target.value)}
                                        style={{
                                            padding: '10px 12px',
                                            borderRadius: '8px',
                                            border: '1px solid #e2e8f0',
                                            fontSize: '13px',
                                            color: '#334155',
                                            background: '#fff',
                                            cursor: 'pointer',
                                            minWidth: '130px',
                                            outline: 'none'
                                        }}
                                        aria-label="Filter by asset type"
                                    >
                                        <option value="ALL">All Types</option>
                                        {ASSET_TYPE_OPTIONS.map(type => (
                                            <option key={type} value={type}>{type}</option>
                                        ))}
                                    </select>
                                    <select
                                        value={assetStatusFilter}
                                        onChange={(e) => setAssetStatusFilter(e.target.value)}
                                        style={{
                                            padding: '10px 12px',
                                            borderRadius: '8px',
                                            border: '1px solid #e2e8f0',
                                            fontSize: '13px',
                                            color: '#334155',
                                            background: '#fff',
                                            cursor: 'pointer',
                                            minWidth: '130px',
                                            outline: 'none'
                                        }}
                                        aria-label="Filter by status"
                                    >
                                        <option value="ALL">All Statuses</option>
                                        <option value="AVAILABLE">Available</option>
                                        <option value="ASSIGNED">Assigned</option>
                                        <option value="MAINTENANCE">Maintenance</option>
                                        <option value="RETIRED">Retired</option>
                                    </select>
                                    <button
                                        type="button"
                                        onClick={fetchTeamAssets}
                                        style={{
                                            border: '1px solid #cbd5e1',
                                            background: '#ffffff',
                                            fontWeight: 700,
                                            cursor: 'pointer',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '8px',
                                            padding: '10px 16px',
                                            borderRadius: '8px',
                                            color: '#000000',
                                            fontSize: '13px',
                                            height: '40px',
                                            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
                                            transition: 'all 0.2s',
                                            whiteSpace: 'nowrap'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ffffff'}
                                    >
                                        <RefreshCw size={14} style={{ color: '#000000' }} /> Refresh
                                    </button>
                                    {hasCrudPermission('ASSETS', 'create') && (
                                        <button
                                            type="button"
                                            onClick={() => openAssignAssetModal()}
                                            className="btn-ts btn-ts-approve"
                                            style={{
                                                padding: '10px 16px',
                                                borderRadius: '8px',
                                                boxShadow: '0 2px 4px rgba(16, 185, 129, 0.15)',
                                                cursor: 'pointer',
                                                border: 'none',
                                                background: '#10b981',
                                                color: '#fff',
                                                fontWeight: 600,
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '8px',
                                                fontSize: '13px',
                                                height: '40px',
                                                whiteSpace: 'nowrap'
                                            }}
                                        >
                                            <Plus size={14} /> Assign New
                                        </button>
                                    )}
                                </div>

                                {filtered.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '60px 20px', background: '#f8fafc', borderRadius: '16px', border: '1px dashed #e2e8f0' }}>
                                        <div style={{ fontSize: '32px', marginBottom: '12px' }}>📦</div>
                                        <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#334155', margin: '0 0 6px 0' }}>No Assets Found</h3>
                                        <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
                                            {allAssets.length === 0 
                                                ? 'No assets are currently registered in the system.' 
                                                : 'No assets match your search filters.'}
                                        </p>
                                    </div>
                                ) : (
                                    <div className="asset-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
                                        {filtered.map((asset) => {
                                            const typeIcons = {
                                                LAPTOP: Monitor,
                                                MOBILE: Smartphone,
                                                TABLET: Smartphone,
                                                MONITOR: Monitor,
                                                KEYBOARD: HardDrive,
                                                MOUSE: HardDrive,
                                                HEADPHONES: Headphones,
                                                CHARGER: HardDrive,
                                                BAG: Briefcase,
                                                OTHER: Box
                                            };
                                            const IconComponent = typeIcons[asset.assetType] || Box;

                                            const statusStyles = {
                                                AVAILABLE: { label: 'Available', color: '#15803d', bg: '#dcfce7' },
                                                ASSIGNED: { label: 'Assigned', color: '#1e40af', bg: '#dbeafe' },
                                                MAINTENANCE: { label: 'Maintenance', color: '#b45309', bg: '#fef3c7' },
                                                RETIRED: { label: 'Retired', color: '#dc2626', bg: '#fee2e2' }
                                            };
                                            const st = statusStyles[asset.status] || { label: asset.status, color: '#64748b', bg: '#f1f5f9' };

                                            return (
                                                <div className="asset-card" key={asset.id} style={{ padding: '16px', background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', position: 'relative' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                                                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                                            <div style={{ background: '#f1f5f9', padding: '8px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                                <IconComponent size={18} style={{ color: '#4f46e5' }} />
                                                            </div>
                                                            <div>
                                                                <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>{asset.assetName}</div>
                                                                <div style={{ fontSize: '11px', color: '#64748b' }}>
                                                                    {asset.brand || 'Generic'} · {asset.model || 'Generic'}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <span style={{
                                                            fontSize: '11px',
                                                            fontWeight: 700,
                                                            color: st.color,
                                                            background: st.bg,
                                                            padding: '2px 8px',
                                                            borderRadius: '999px',
                                                            textTransform: 'uppercase'
                                                        }}>
                                                            {st.label}
                                                        </span>
                                                    </div>

                                                    {/* Side-by-side Layout for details and image preview */}
                                                    <div style={{ display: 'flex', justifyContent: 'flex-start', gap: '16px', width: '100%', marginBottom: '12px', flexGrow: 1 }}>
                                                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                                                            {asset.assetCode && (
                                                                <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '8px' }}>
                                                                    ID: <strong>{asset.assetCode}</strong>
                                                                </div>
                                                            )}
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                                {asset.serialNumber && (
                                                                    <div style={{ fontSize: '11px', color: '#64748b' }}>
                                                                        Serial: <strong style={{ color: '#334155' }}>{asset.serialNumber}</strong>
                                                                    </div>
                                                                )}
                                                                {asset.location && (
                                                                    <div style={{ fontSize: '11px', color: '#64748b' }}>
                                                                        Location: <strong style={{ color: '#334155' }}>{asset.location}</strong>
                                                                    </div>
                                                                )}
                                                                {asset.configuration && (
                                                                    <div style={{ fontSize: '11px', color: '#64748b' }}>
                                                                        Configuration: <strong style={{ color: '#334155' }}>{asset.configuration}</strong>
                                                                    </div>
                                                                )}
                                                                {asset.notes && (
                                                                    <div style={{ fontSize: '11px', color: '#64748b' }}>
                                                                        Notes: <strong style={{ color: '#334155' }}>{asset.notes}</strong>
                                                                    </div>
                                                                )}
                                                                {asset.status === 'ASSIGNED' && asset.assignedToName && (
                                                                    <div style={{ fontSize: '11.5px', color: '#64748b', background: '#f8fafc', padding: '4px 8px', borderRadius: '4px', display: 'inline-block', width: 'fit-content' }}>
                                                                        Assigned to: <strong style={{ color: '#334155' }}>{asset.assignedToName}</strong>
                                                                    </div>
                                                                )}
                                                                {asset.quantity > 1 && (
                                                                    <div style={{ display: 'flex', gap: '10px', marginTop: '6px', background: '#f8fafc', padding: '4px 8px', borderRadius: '6px', border: '1px dashed #cbd5e1', fontSize: '11px', color: '#475569', width: 'fit-content' }}>
                                                                        <span>Total: <strong>{asset.quantity}</strong></span>
                                                                        <span>Assigned: <strong style={{ color: '#10b981' }}>{asset.assignedQuantity ?? 0}</strong></span>
                                                                        <span>Available: <strong style={{ color: '#4f46e5' }}>{asset.availableQuantity ?? (asset.quantity - (asset.assignedQuantity ?? 0))}</strong></span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {asset.imageUrl && (
                                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                                                                <img 
                                                                    src={asset.imageUrl} 
                                                                    alt={asset.assetName} 
                                                                    style={{ width: '80px', height: '80px', borderRadius: '8px', objectFit: 'cover', border: '1px solid #e2e8f0' }} 
                                                                />
                                                                <a href={asset.imageUrl} target="_blank" rel="noreferrer" style={{
                                                                    display: 'inline-block',
                                                                    padding: '4px 8px',
                                                                    fontSize: '11px',
                                                                    fontWeight: 600,
                                                                    color: '#4f46e5',
                                                                    background: '#eeebff',
                                                                    borderRadius: '6px',
                                                                    textDecoration: 'none',
                                                                    textAlign: 'center',
                                                                    boxShadow: '0 2px 4px rgba(79, 70, 229, 0.15)',
                                                                    transition: 'background-color 0.2s'
                                                                }}>
                                                                    View Image
                                                                </a>
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid #f1f5f9', paddingTop: '12px', marginTop: 'auto' }}>
                                                        {asset.status === 'AVAILABLE' && hasCrudPermission('ASSETS', 'update') && (
                                                            <button
                                                                type="button"
                                                                style={{
                                                                    flex: 1,
                                                                    background: '#1a4ff0',
                                                                    color: '#fff',
                                                                    border: 'none',
                                                                    height: '40px',
                                                                    padding: '0 12px',
                                                                    borderRadius: '8px',
                                                                    fontWeight: 600,
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center',
                                                                    gap: '6px',
                                                                    cursor: 'pointer',
                                                                    fontSize: '13px',
                                                                    transition: 'background-color 0.2s'
                                                                }}
                                                                onClick={() => openAssignAssetModal(null, asset)}
                                                            >
                                                                <UserPlus size={16} /> Assign
                                                            </button>
                                                        )}
                                                        {asset.status === 'ASSIGNED' && hasCrudPermission('ASSETS', 'update') && (
                                                            <>
                                                                <button
                                                                    type="button"
                                                                    style={{
                                                                        flex: 1,
                                                                        border: '1px solid #ef4444',
                                                                        color: '#ef4444',
                                                                        background: '#fff',
                                                                        height: '40px',
                                                                        padding: '0 12px',
                                                                        borderRadius: '8px',
                                                                        fontWeight: 600,
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        justifyContent: 'center',
                                                                        gap: '6px',
                                                                        cursor: 'pointer',
                                                                        fontSize: '13px'
                                                                    }}
                                                                    onClick={() => handleReturnTeamAsset(asset.id)}
                                                                >
                                                                    Return
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    style={{
                                                                        flex: 1,
                                                                        border: '1px solid #4f46e5',
                                                                        color: '#4f46e5',
                                                                        background: '#fff',
                                                                        height: '40px',
                                                                        padding: '0 12px',
                                                                        borderRadius: '8px',
                                                                        fontWeight: 600,
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        justifyContent: 'center',
                                                                        gap: '6px',
                                                                        cursor: 'pointer',
                                                                        fontSize: '13px'
                                                                    }}
                                                                    onClick={() => openTransferModal(asset)}
                                                                >
                                                                    Transfer
                                                                </button>
                                                            </>
                                                        )}
                                                        {asset.status === 'MAINTENANCE' && hasCrudPermission('ASSETS', 'update') && (
                                                            <button
                                                                type="button"
                                                                style={{
                                                                    flex: 1,
                                                                    background: '#10b981',
                                                                    color: '#fff',
                                                                    border: 'none',
                                                                    height: '40px',
                                                                    padding: '0 12px',
                                                                    borderRadius: '8px',
                                                                    fontWeight: 600,
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center',
                                                                    gap: '6px',
                                                                    cursor: 'pointer',
                                                                    fontSize: '13px'
                                                                }}
                                                                onClick={async () => {
                                                                    try {
                                                                        await managerAssetAPI.updateAssetStatus(asset.id, 'AVAILABLE', isOrgView);
                                                                        toast.success('Maintenance completed');
                                                                        fetchTeamAssets();
                                                                    } catch (err) {
                                                                        toast.error(err.response?.data?.message || 'Failed to update status');
                                                                    }
                                                                }}
                                                            >
                                                                Complete
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })()}

                    {activeTab === 'clearances' && (
                        assignedHandovers.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '80px', background: '#f8fafc', borderRadius: '16px', border: '1px dashed #e2e8f0' }}>
                                <div style={{ fontSize: '32px', marginBottom: '16px' }}>📋</div>
                                <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#334155' }}>No Exit Clearances</h3>
                                <p style={{ fontSize: '14px', color: '#64748b' }}>No exit clearances are currently assigned to you.</p>
                            </div>
                        ) : (
                            <div className="asset-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
                                {assignedHandovers.map((handover) => (
                                    <div className="asset-card" key={handover.id} style={{ padding: '16px', background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                                        <div className="asset-top" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                            <div>
                                                <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
                                                    {handover.employeeName || 'Exiting Employee'}
                                                </div>
                                                <div style={{ fontSize: '10px', color: '#64748b' }}>
                                                    {handover.employeeEmployeeId || '—'} · LWD {handover.lastWorkingDay ? new Date(handover.lastWorkingDay).toLocaleDateString() : 'TBD'}
                                                </div>
                                            </div>
                                            <div className="asset-count" style={{ fontSize: '12px', background: '#f1f5f9', padding: '4px 8px', borderRadius: '6px', fontWeight: 600 }}>{(handover.assetItems || []).length} Items</div>
                                        </div>
                                        <div className="asset-actions">
                                            <button
                                                className="btn-asset btn-asset-view"
                                                style={{ border: '1px solid #cbd5e1', background: '#fff', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', width: '100%', fontWeight: 600 }}
                                                onClick={() => {
                                                    setSelectedHandover(handover);
                                                    setShowHandoverModal(true);
                                                }}
                                            >
                                                View All Items
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )
                    )}

                    {activeTab === 'tickets' && (
                        teamTickets.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '80px', background: '#f8fafc', borderRadius: '16px', border: '1px dashed #e2e8f0' }}>
                                <div style={{ fontSize: '32px', marginBottom: '16px' }}>🎫</div>
                                <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#334155' }}>No Support Tickets</h3>
                                <p style={{ fontSize: '14px', color: '#64748b' }}>There are no active support tickets for your team&apos;s assets.</p>
                            </div>
                        ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
                                {teamTickets.map((ticket) => (
                                    <div className="asset-card" key={ticket.id} style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '16px', background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.02)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                            <span style={{ fontSize: '12px', fontWeight: 800, color: '#0f172a' }}>
                                                {ticket.ticketNumber} · <span style={{ color: '#4f46e5' }}>{ticket.ticketType || 'REPAIR'}</span>
                                            </span>
                                            <span style={{ 
                                                 fontSize: '11px', 
                                                 fontWeight: 700, 
                                                 color: ticket.status === 'OPEN' ? '#b45309' : ticket.status === 'IN_PROGRESS' ? '#1e40af' : '#15803d', 
                                                 background: ticket.status === 'OPEN' ? '#fef3c7' : ticket.status === 'IN_PROGRESS' ? '#dbeafe' : '#dcfce7', 
                                                 padding: '2px 8px', 
                                                 borderRadius: '999px',
                                                 textTransform: 'uppercase'
                                             }}>
                                                 {ticket.status}
                                             </span>
                                         </div>
                                         <div style={{ fontWeight: 700, fontSize: '14px', color: '#0f172a' }}>
                                             {ticket.subject}
                                         </div>
                                         <div style={{ fontSize: '12px', color: '#64748b' }}>
                                             {ticket.description}
                                         </div>
                                         <div className="asset-card-meta" style={{ fontSize: '11px', color: '#94a3b8' }}>
                                             {ticket.assetName} ({ticket.assetCode || 'AST-N/A'}) · Priority: <span style={{ fontWeight: 700 }}>{ticket.priority || 'MEDIUM'}</span>
                                         </div>
                                         <div style={{ fontSize: '11px', color: '#64748b', background: '#f8fafc', padding: '6px 10px', borderRadius: '6px' }}>
                                             Raised by: <strong>{ticket.raisedByName || ticket.raisedByUsername}</strong>
                                         </div>
                                         {ticket.imageUrl && (
                                              <div style={{ marginTop: '8px' }}>
                                                  <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '4px', fontWeight: 600 }}>Issue Attachment:</div>
                                                  {ticket.imageUrl.toLowerCase().endsWith('.pdf') ? (
                                                      <a href={ticket.imageUrl} target="_blank" rel="noreferrer" style={{ fontSize: '11px', color: '#4f46e5', fontWeight: 600, textDecoration: 'underline' }}>View PDF Attachment</a>
                                                  ) : (
                                                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                          <a href={ticket.imageUrl} target="_blank" rel="noreferrer" style={{ display: 'block' }}>
                                                              <img 
                                                                  src={ticket.imageUrl} 
                                                                  alt="Issue Preview" 
                                                                  style={{ width: '60px', height: '60px', borderRadius: '6px', objectFit: 'cover', border: '1px solid #e2e8f0' }} 
                                                                />
                                                          </a>
                                                          <a href={ticket.imageUrl} target="_blank" rel="noreferrer" style={{ 
                                                              display: 'inline-flex',
                                                              alignItems: 'center',
                                                              justifyContent: 'center',
                                                              padding: '4px 8px', 
                                                              borderRadius: '4px', 
                                                              background: '#4f46e5', 
                                                              color: '#ffffff', 
                                                              fontSize: '10px', 
                                                              fontWeight: 600, 
                                                              textDecoration: 'none',
                                                              boxShadow: '0 1px 3px rgba(79, 70, 229, 0.15)'
                                                          }}>
                                                              View Attachment
                                                          </a>
                                                      </div>
                                                  )}
                                              </div>
                                          )}
                                          {ticket.resolutionImageUrl && (
                                              <div style={{ marginTop: '8px' }}>
                                                  <div style={{ fontSize: '11px', color: '#15803d', marginBottom: '4px', fontWeight: 600 }}>Resolution Attachment:</div>
                                                  {ticket.resolutionImageUrl.toLowerCase().endsWith('.pdf') ? (
                                                      <a href={ticket.resolutionImageUrl} target="_blank" rel="noreferrer" style={{ fontSize: '11px', color: '#15803d', fontWeight: 600, textDecoration: 'underline' }}>View PDF Resolution</a>
                                                  ) : (
                                                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                          <a href={ticket.resolutionImageUrl} target="_blank" rel="noreferrer" style={{ display: 'block' }}>
                                                              <img 
                                                                  src={ticket.resolutionImageUrl} 
                                                                  alt="Resolution Preview" 
                                                                  style={{ width: '60px', height: '60px', borderRadius: '6px', objectFit: 'cover', border: '1px solid #dcfce7' }} 
                                                              />
                                                          </a>
                                                          <a href={ticket.resolutionImageUrl} target="_blank" rel="noreferrer" style={{ 
                                                              display: 'inline-flex',
                                                              alignItems: 'center',
                                                              justifyContent: 'center',
                                                              padding: '4px 8px', 
                                                              borderRadius: '4px', 
                                                              background: '#15803d', 
                                                              color: '#ffffff', 
                                                              fontSize: '10px', 
                                                              fontWeight: 600, 
                                                              textDecoration: 'none',
                                                              boxShadow: '0 1px 3px rgba(21, 128, 61, 0.15)'
                                                          }}>
                                                              View Resolution
                                                          </a>
                                                      </div>
                                                  )}
                                              </div>
                                          )}
                                          {ticket.resolutionNotes && (
                                              <div style={{ fontSize: '11px', color: '#15803d', background: '#dcfce7', padding: '6px 10px', borderRadius: '6px', marginTop: '6px' }}>
                                                  Resolution: <strong>{ticket.resolutionNotes}</strong>
                                              </div>
                                          )}
                                         <div className="asset-card-actions" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', borderTop: '1px solid #f1f5f9', paddingTop: '10px', marginTop: '4px' }}>
                                             {['IN_PROGRESS', 'RESOLVED', 'CLOSED'].filter((s) => s !== ticket.status).map((s) => (
                                                 <button 
                                                     key={s} 
                                                     type="button" 
                                                     onClick={() => handleUpdateTicketStatus(ticket, s)}
                                                     style={{
                                                         padding: '4px 8px',
                                                         borderRadius: '6px',
                                                         border: '1px solid #cbd5e1',
                                                         background: '#fff',
                                                         fontSize: '11px',
                                                         fontWeight: 600,
                                                         color: '#374151',
                                                         cursor: 'pointer',
                                                         transition: 'all 0.2s'
                                                     }}
                                                     onMouseEnter={(e) => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.borderColor = '#94a3b8'; }}
                                                     onMouseLeave={(e) => { e.currentTarget.style.background = '#ffffff'; e.currentTarget.style.borderColor = '#cbd5e1'; }}
                                                 >
                                                     {s.replace('_', ' ')}
                                                 </button>
                                             ))}
                                         </div>
                                     </div>
                                ))}
                            </div>
                        )
                    )}

                    {activeTab === 'assets' && (
                        teamAssets.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '80px', background: '#f8fafc', borderRadius: '16px', border: '1px dashed #e2e8f0' }}>
                                <div style={{ fontSize: '32px', marginBottom: '16px' }}>📦</div>
                                <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#334155' }}>No Assets Assigned</h3>
                                <p style={{ fontSize: '14px', color: '#64748b' }}>No assets are currently assigned to your team members.</p>
                            </div>
                        ) : (
                            <div className="asset-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
                                {teamAssets.map((asset) => {
                                    const Icon = getTypeIcon(asset.assetType);
                                    const status = statusConfig[asset.status] || { label: asset.status, color: '#475569', bg: '#f1f5f9' };
                                    const dropdownOpen = activeDropdownId === asset.id;
                                    return (
                                        <div className="asset-card" key={asset.id} style={{ padding: '20px', background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', position: 'relative', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                                                    <div style={{ background: '#f3e8ff', padding: '12px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '48px', height: '48px' }}>
                                                        <Icon size={22} style={{ color: '#7c3aed' }} />
                                                    </div>
                                                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                        {asset.assetType || '—'}
                                                    </span>
                                                </div>
                                                <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                                                    <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', margin: '12px 0 2px 0', textTransform: 'capitalize' }}>
                                                        {asset.assetName || 'Unnamed Asset'}
                                                    </h3>
                                                    <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '8px' }}>
                                                        {asset.brand || 'Generic'} · {asset.model || 'Generic'}
                                                    </p>
                                                    <div style={{ fontSize: '13px', color: '#475569', marginBottom: '4px' }}>
                                                        Serial: <strong>{asset.serialNumber || '—'}</strong>
                                                    </div>
                                                    <div style={{ fontSize: '13px', color: '#475569', marginBottom: '12px', lineHeight: '1.4' }}>
                                                        Configuration: <strong>{asset.configuration || '—'}</strong>
                                                    </div>
                                                    
                                                    <span style={{
                                                        fontSize: '12px',
                                                        fontWeight: 600,
                                                        color: status.color,
                                                        background: status.bg,
                                                        padding: '4px 12px',
                                                        borderRadius: '999px',
                                                        width: 'fit-content',
                                                        marginBottom: '16px',
                                                        display: 'inline-block'
                                                    }}>
                                                        {status.label}
                                                    </span>

                                                    {asset.assignedToName && (
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderTop: '1px solid #f1f5f9', paddingTop: '12px', marginBottom: '16px' }}>
                                                            <div style={{
                                                                width: '32px',
                                                                height: '32px',
                                                                borderRadius: '50%',
                                                                background: '#7c3aed',
                                                                color: '#fff',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                fontWeight: 700,
                                                                fontSize: '14px',
                                                                textTransform: 'uppercase'
                                                            }}>
                                                                {asset.assignedToName.charAt(0)}
                                                            </div>
                                                            <span style={{ fontSize: '14px', fontWeight: 500, color: '#334155' }}>
                                                                {asset.assignedToName}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid #f1f5f9', paddingTop: '12px', marginTop: 'auto' }}>
                                                {hasCrudPermission('ASSETS', 'update') && (
                                                    <button
                                                        type="button"
                                                        style={{
                                                            flex: 2,
                                                            border: 'none',
                                                            background: '#f2994a',
                                                            color: '#fff',
                                                            height: '42px',
                                                            borderRadius: '10px',
                                                            fontWeight: 700,
                                                            cursor: 'pointer',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            gap: '6px',
                                                            fontSize: '13px',
                                                            boxShadow: '0 2px 4px rgba(242, 153, 74, 0.2)'
                                                        }}
                                                        onClick={() => handleReturnTeamAsset(asset.id)}
                                                    >
                                                        <RefreshCw size={14} /> Return
                                                    </button>
                                                )}
                                                {hasCrudPermission('ASSETS', 'update') && (
                                                    <button
                                                        type="button"
                                                        style={{
                                                            flex: 2,
                                                            border: 'none',
                                                            background: '#12b76a',
                                                            color: '#fff',
                                                            height: '42px',
                                                            borderRadius: '10px',
                                                            fontWeight: 700,
                                                            cursor: 'pointer',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            gap: '6px',
                                                            fontSize: '13px',
                                                            boxShadow: '0 2px 4px rgba(18, 183, 106, 0.2)'
                                                        }}
                                                        onClick={() => openTransferModal(asset)}
                                                    >
                                                        <ArrowRightLeft size={14} /> Transfer
                                                    </button>
                                                )}
                                                <div style={{ position: 'relative', flex: 1 }}>
                                                    <button
                                                        type="button"
                                                        style={{
                                                            width: '100%',
                                                            height: '42px',
                                                            border: 'none',
                                                            background: '#f1f5f9',
                                                            color: '#475569',
                                                            borderRadius: '10px',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            cursor: 'pointer',
                                                            fontWeight: 600
                                                        }}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setActiveDropdownId(dropdownOpen ? null : asset.id);
                                                        }}
                                                    >
                                                        <MoreVertical size={18} />
                                                    </button>
                                                    {dropdownOpen && (
                                                        <div 
                                                            onClick={e => e.stopPropagation()} 
                                                            style={{
                                                                position: 'absolute',
                                                                right: 0,
                                                                bottom: '48px',
                                                                background: '#fff',
                                                                border: '1px solid #e2e8f0',
                                                                borderRadius: '12px',
                                                                boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)',
                                                                width: '190px',
                                                                zIndex: 100,
                                                                padding: '8px 0'
                                                            }}
                                                        >
                                                            <button
                                                                type="button"
                                                                style={{ width: '100%', padding: '10px 16px', textAlign: 'left', background: 'none', border: 'none', fontSize: '13px', color: '#334155', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 500 }}
                                                                onClick={() => { openHistoryModal(asset); setActiveDropdownId(null); }}
                                                            >
                                                                <History size={14} style={{ color: '#64748b' }} /> View History
                                                            </button>
                                                            {hasCrudPermission('ASSETS', 'update') && (
                                                                <button
                                                                    type="button"
                                                                    style={{ width: '100%', padding: '10px 16px', textAlign: 'left', background: 'none', border: 'none', fontSize: '13px', color: '#334155', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 500 }}
                                                                    onClick={() => { openTicket(asset); setActiveDropdownId(null); }}
                                                                >
                                                                    <Ticket size={14} style={{ color: '#64748b' }} /> Raise Ticket
                                                                </button>
                                                            )}
                                                            {hasCrudPermission('ASSETS', 'update') && (
                                                                <button
                                                                    type="button"
                                                                    style={{ width: '100%', padding: '10px 16px', textAlign: 'left', background: 'none', border: 'none', fontSize: '13px', color: '#334155', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 500 }}
                                                                    onClick={() => { openMaintenance(asset); setActiveDropdownId(null); }}
                                                                >
                                                                    <Wrench size={14} style={{ color: '#64748b' }} /> Log Maintenance
                                                                </button>
                                                            )}
                                                            <button
                                                                type="button"
                                                                style={{ width: '100%', padding: '10px 16px', textAlign: 'left', background: 'none', border: 'none', fontSize: '13px', color: '#334155', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 500 }}
                                                                onClick={() => { toast.error('This action is restricted to Admin portal users.'); setActiveDropdownId(null); }}
                                                            >
                                                                <Pencil size={14} style={{ color: '#64748b' }} /> Edit Asset
                                                            </button>
                                                            {hasCrudPermission('ASSETS', 'update') && (
                                                                <button
                                                                    type="button"
                                                                    style={{ width: '100%', padding: '10px 16px', textAlign: 'left', background: 'none', border: 'none', fontSize: '13px', color: '#334155', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 500 }}
                                                                    onClick={() => {
                                                                        setSelectedAssetStatus(asset);
                                                                        setStatusFormValue(asset.status);
                                                                        setShowStatusModal(true);
                                                                        setActiveDropdownId(null);
                                                                    }}
                                                                >
                                                                    <RefreshCw size={14} style={{ color: '#64748b' }} /> Change Status
                                                                </button>
                                                            )}
                                                            <div style={{ borderTop: '1px solid #f1f5f9', margin: '8px 0' }}></div>
                                                            {hasCrudPermission('ASSETS', 'delete') ? (
                                                                <button
                                                                    type="button"
                                                                    style={{ width: '100%', padding: '10px 16px', textAlign: 'left', background: 'none', border: 'none', fontSize: '13px', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 600 }}
                                                                    onClick={() => { handleDeleteAsset(asset.id); setActiveDropdownId(null); }}
                                                                >
                                                                    <Trash2 size={14} style={{ color: '#ef4444' }} /> Delete Asset
                                                                </button>
                                                            ) : (
                                                                <button
                                                                    type="button"
                                                                    style={{ width: '100%', padding: '10px 16px', textAlign: 'left', background: 'none', border: 'none', fontSize: '13px', color: '#94a3b8', cursor: 'not-allowed', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 500 }}
                                                                    disabled
                                                                >
                                                                    <Trash2 size={14} style={{ color: '#cbd5e1' }} /> Delete Asset
                                                                </button>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )
                    )}

                    {activeTab === 'members' && (
                        <div className="asset-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
                            {loadingTeamAssets ? (
                                <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '100px' }}>
                                    <div className="animate-spin" style={{ width: '40px', height: '40px', border: '4px solid #f1f5f9', borderTop: '4px solid #1a4ff0', borderRadius: '50%', margin: '0 auto 16px' }}></div>
                                    <p style={{ color: '#64748b', fontWeight: 500 }}>Loading team assets...</p>
                                </div>
                            ) : teamMembers.length === 0 ? (
                                <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '80px', background: '#f8fafc', borderRadius: '16px', border: '1px dashed #e2e8f0' }}>
                                    <div style={{ fontSize: '32px', marginBottom: '16px' }}>👥</div>
                                    <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#334155' }}>No Team Members</h3>
                                    <p style={{ fontSize: '14px', color: '#64748b' }}>You don&apos;t have any direct reports to manage assets for.</p>
                                </div>
                            ) : (
                                membersWithAssets.map(({ member, assets }, idx) => {
                                    const memberName = `${member.firstName || ''} ${member.lastName || ''}`.trim() || member.employeeId || 'Team Member';
                                    const initials = memberName.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2) || 'TM';
                                    const colors = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
                                    const color = colors[idx % colors.length];

                                    return (
                                        <div className="asset-card" key={member.id || member.employeeId || idx} style={{ padding: '16px', background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                                            <div>
                                                <div className="asset-top" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                                        <div className="u-av" style={{ background: `${color}15`, color: color, width: '36px', height: '36px', fontSize: '12px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                                                            {initials}
                                                        </div>
                                                        <div>
                                                            <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>{memberName}</div>
                                                            <div style={{ fontSize: '10px', color: '#64748b' }}>{member.employeeId}</div>
                                                        </div>
                                                    </div>
                                                    <div className="asset-count" style={{ fontSize: '12px', background: '#f1f5f9', padding: '4px 8px', borderRadius: '6px', fontWeight: 600 }}>{assets.length} Assets</div>
                                                </div>

                                                <div className="asset-items" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                    {assets.length === 0 ? (
                                                        <div style={{ fontSize: '12px', color: '#94a3b8', textAlign: 'center', padding: '12px 0' }}>
                                                            No assets assigned yet
                                                        </div>
                                                    ) : (
                                                        assets.map(asset => (
                                                            <div key={asset.id} style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '8px 12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>{asset.assetName}</span>
                                                                    <span style={{ fontSize: '10px', color: '#64748b' }}>{asset.status}</span>
                                                                </div>
                                                                {asset.configuration && (
                                                                    <div style={{ fontSize: '11px', color: '#64748b' }}>
                                                                        Configuration: <span style={{ color: '#334155' }}>{asset.configuration}</span>
                                                                    </div>
                                                                )}
                                                                {asset.notes && (
                                                                    <div style={{ fontSize: '11px', color: '#64748b' }}>
                                                                        Notes: <span style={{ color: '#334155' }}>{asset.notes}</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ))
                                                    )}
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                                                <button
                                                    className="btn-asset btn-asset-view"
                                                    style={{ 
                                                        flex: 1, 
                                                        border: '1px solid #cbd5e1', 
                                                        background: '#ffffff', 
                                                        color: '#475569', 
                                                        padding: '8px 16px', 
                                                        borderRadius: '8px', 
                                                        cursor: 'pointer', 
                                                        fontSize: '12px', 
                                                        fontWeight: 600,
                                                        transition: 'all 0.2s ease',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
                                                        height: '40px'
                                                    }}
                                                    onClick={() => openMemberAssetsModal(member)}
                                                    onMouseEnter={(e) => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.borderColor = '#94a3b8'; }}
                                                    onMouseLeave={(e) => { e.currentTarget.style.background = '#ffffff'; e.currentTarget.style.borderColor = '#cbd5e1'; }}
                                                >
                                                    View All
                                                </button>
                                                {hasCrudPermission('ASSETS', 'create') && (
                                                    <button
                                                        className="btn-asset btn-asset-assign"
                                                        style={{ 
                                                            flex: 1, 
                                                            border: 'none', 
                                                            background: '#4f46e5', 
                                                            color: '#ffffff', 
                                                            padding: '8px 16px', 
                                                            borderRadius: '8px', 
                                                            cursor: 'pointer', 
                                                            fontSize: '12px', 
                                                            fontWeight: 600,
                                                            transition: 'all 0.2s ease',
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            boxShadow: '0 1px 2px rgba(79, 70, 229, 0.15)',
                                                            height: '40px'
                                                        }}
                                                        onClick={() => openAssignAssetModal(member)}
                                                        onMouseEnter={(e) => { e.currentTarget.style.background = '#4338ca'; }}
                                                        onMouseLeave={(e) => { e.currentTarget.style.background = '#4f46e5'; }}
                                                    >
                                                        + Assign New
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    )}
                </div>
            </div>

            {showAssetModal && selectedMemberAssets && (
                <div className="asset-modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div className="asset-modal" style={{ background: '#fff', borderRadius: '16px', padding: '24px', width: '90%', maxWidth: '600px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' }}>
                        <div className="asset-modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
                            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>Assets assigned to {selectedMemberAssets.member.firstName}</h3>
                            <button 
                                onClick={() => setShowAssetModal(false)} 
                                style={{ 
                                    background: 'none', 
                                    border: 'none', 
                                    cursor: 'pointer', 
                                    padding: '6px', 
                                    borderRadius: '50%', 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    justifyContent: 'center', 
                                    transition: 'background-color 0.2s',
                                    color: '#64748b'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <div className="asset-modal-body" style={{ maxHeight: '400px', overflowY: 'auto', marginBottom: '20px' }}>
                            {selectedMemberAssets.assets.length === 0 ? (
                                <p style={{ color: '#64748b', textAlign: 'center', padding: '24px 0' }}>No assets assigned.</p>
                            ) : (
                                <div style={{ display: 'grid', gap: '12px' }}>
                                    {selectedMemberAssets.assets.map(asset => (
                                        <div key={asset.id} style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', background: '#f8fafc' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                                <strong style={{ color: '#0f172a' }}>{asset.assetName}</strong>
                                                <span style={{ 
                                                    fontSize: '11px', 
                                                    fontWeight: 700, 
                                                    color: asset.status === 'ASSIGNED' ? '#15803d' : '#475569', 
                                                    background: asset.status === 'ASSIGNED' ? '#dcfce7' : '#e2e8f0', 
                                                    padding: '2px 8px', 
                                                    borderRadius: '999px' 
                                                }}>{asset.status}</span>
                                            </div>
                                            <p style={{ margin: '0 0 12px', fontSize: '12px', color: '#64748b' }}>
                                                Code: {asset.assetCode || '—'} · Brand: {asset.brand || '—'} · Model: {asset.model || '—'}
                                            </p>
                                            {asset.configuration && (
                                                <p style={{ margin: '0 0 6px', fontSize: '12px', color: '#64748b' }}>
                                                    <strong>Configuration:</strong> {asset.configuration}
                                                </p>
                                            )}
                                            {asset.notes && (
                                                <p style={{ margin: '0 0 12px', fontSize: '12px', color: '#64748b' }}>
                                                    <strong>Notes:</strong> {asset.notes}
                                                </p>
                                            )}
                                            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', borderTop: '1px solid #e2e8f0', paddingTop: '12px' }}>
                                                {hasCrudPermission('ASSETS', 'update') && (
                                                    <button 
                                                        onClick={() => handleReturnTeamAsset(asset.id)} 
                                                        style={{ 
                                                            border: '1px solid #ef4444', 
                                                            color: '#ef4444', 
                                                            background: '#fff', 
                                                            padding: '6px 12px', 
                                                            borderRadius: '6px', 
                                                            cursor: 'pointer', 
                                                            fontSize: '12px',
                                                            fontWeight: 600,
                                                            transition: 'all 0.2s'
                                                        }}
                                                        onMouseEnter={(e) => { e.currentTarget.style.background = '#fef2f2'; }}
                                                        onMouseLeave={(e) => { e.currentTarget.style.background = '#ffffff'; }}
                                                    >
                                                        Return Asset
                                                    </button>
                                                )}
                                                {hasCrudPermission('ASSETS', 'update') && (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
                                                        <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>Change Status:</span>
                                                        <select
                                                            value={asset.status}
                                                            onChange={(e) => handleUpdateTeamAssetStatus(asset.id, e.target.value)}
                                                            style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px', color: '#0f172a', background: '#fff', fontWeight: 500 }}
                                                        >
                                                            <option value="ASSIGNED">Assigned</option>
                                                            <option value="MAINTENANCE">Maintenance</option>
                                                            <option value="DAMAGED">Damaged</option>
                                                            <option value="LOST">Lost</option>
                                                        </select>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="asset-modal-footer" style={{ borderTop: '1px solid #f1f5f9', paddingTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
                            <button 
                                onClick={() => setShowAssetModal(false)}
                                style={{
                                    border: '1px solid #cbd5e1',
                                    background: '#fff',
                                    color: '#475569',
                                    padding: '8px 20px',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    fontSize: '13px',
                                    fontWeight: 600,
                                    transition: 'background-color 0.2s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ffffff'}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showAssignAssetModal && (
                <div className="asset-modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div className="asset-modal" style={{ background: '#fff', borderRadius: '16px', padding: '24px', width: '90%', maxWidth: '500px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' }}>
                        <div className="asset-modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
                            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>Assign Asset</h3>
                            <button 
                                onClick={() => setShowAssignAssetModal(false)} 
                                style={{ 
                                    background: 'none', 
                                    border: 'none', 
                                    cursor: 'pointer', 
                                    padding: '6px', 
                                    borderRadius: '50%', 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    justifyContent: 'center', 
                                    transition: 'background-color 0.2s',
                                    color: '#64748b'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <div className="asset-modal-body">
                            {hasCrudPermission('ASSETS', 'create') ? (
                                <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
                                    <button 
                                        onClick={() => setAssetAssignMode('existing')} 
                                        style={{ 
                                            flex: 1, 
                                            padding: '10px', 
                                            borderRadius: '8px', 
                                            border: assetAssignMode === 'existing' ? '2px solid #6366f1' : '1px solid #cbd5e1', 
                                            background: '#fff', 
                                            color: '#374151',
                                            fontWeight: 600,
                                            cursor: 'pointer'
                                        }}
                                    >
                                        From Inventory
                                    </button>
                                    <button 
                                        onClick={() => setAssetAssignMode('new')} 
                                        style={{ 
                                            flex: 1, 
                                            padding: '10px', 
                                            borderRadius: '8px', 
                                            border: assetAssignMode === 'new' ? '2px solid #6366f1' : '1px solid #cbd5e1', 
                                            background: '#fff', 
                                            color: '#374151',
                                            fontWeight: 600,
                                            cursor: 'pointer'
                                        }}
                                    >
                                        Create & Assign New
                                    </button>
                                </div>
                            ) : null}

                            {(!hasCrudPermission('ASSETS', 'create') || assetAssignMode === 'existing') ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    <div>
                                        <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>SELECT ASSET</label>
                                        <select
                                            value={assetAssignForm.assetId}
                                            onChange={(e) => setAssetAssignForm({ ...assetAssignForm, assetId: e.target.value })}
                                            style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', marginTop: '4px', background: '#ffffff', color: '#0f172a', fontSize: '13px', fontWeight: 500 }}
                                        >
                                            <option value="" style={{ color: '#94a3b8' }}>Select asset...</option>
                                            {availableAssets.map(a => (
                                                <option key={a.id} value={a.id} style={{ color: '#0f172a' }}>{a.assetName} ({a.brand} {a.model})</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                        <div>
                                            <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>ASSET NAME</label>
                                            <input
                                                value={assetAssignForm.assetName}
                                                onChange={(e) => setAssetAssignForm({ ...assetAssignForm, assetName: e.target.value })}
                                                style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', marginTop: '4px', background: '#ffffff', color: '#0f172a', fontSize: '13px' }}
                                                placeholder="Enter asset name..."
                                            />
                                        </div>
                                        <div>
                                            <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>ASSET TYPE</label>
                                            <select
                                                value={assetAssignForm.assetType}
                                                onChange={(e) => setAssetAssignForm({ ...assetAssignForm, assetType: e.target.value })}
                                                style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', marginTop: '4px', background: '#ffffff', color: '#0f172a', fontSize: '13px', fontWeight: 500 }}
                                            >
                                                {ASSET_TYPE_OPTIONS.map(opt => (
                                                    <option key={opt} value={opt} style={{ color: '#0f172a' }}>{opt}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                        <div>
                                            <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>BRAND</label>
                                            <input
                                                value={assetAssignForm.brand || ''}
                                                onChange={(e) => setAssetAssignForm({ ...assetAssignForm, brand: e.target.value })}
                                                style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', marginTop: '4px', background: '#ffffff', color: '#0f172a', fontSize: '13px' }}
                                                placeholder="e.g. Dell, Apple"
                                            />
                                        </div>
                                        <div>
                                            <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>MODEL</label>
                                            <input
                                                value={assetAssignForm.model || ''}
                                                onChange={(e) => setAssetAssignForm({ ...assetAssignForm, model: e.target.value })}
                                                style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', marginTop: '4px', background: '#ffffff', color: '#0f172a', fontSize: '13px' }}
                                                placeholder="e.g. Inspiron, MacBook Pro"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>SERIAL NUMBER</label>
                                        <input
                                            value={assetAssignForm.serialNumber || ''}
                                            onChange={(e) => setAssetAssignForm({ ...assetAssignForm, serialNumber: e.target.value })}
                                            style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', marginTop: '4px', background: '#ffffff', color: '#0f172a', fontSize: '13px' }}
                                            placeholder="Enter serial number..."
                                        />
                                    </div>
                                    <div style={{ marginTop: '12px' }}>
                                        <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>CONFIGURATION (OPTIONAL)</label>
                                        <input
                                            value={assetAssignForm.configuration || ''}
                                            onChange={(e) => setAssetAssignForm({ ...assetAssignForm, configuration: e.target.value })}
                                            style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', marginTop: '4px', background: '#ffffff', color: '#0f172a', fontSize: '13px' }}
                                            placeholder="e.g. 16GB RAM, 512GB SSD"
                                        />
                                    </div>
                                </div>
                            )}

                            <div style={{ marginTop: '16px' }}>
                                <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>ASSIGN TO</label>
                                <select
                                    value={assetAssignForm.employeeId}
                                    onChange={(e) => setAssetAssignForm({ ...assetAssignForm, employeeId: e.target.value })}
                                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', marginTop: '4px', background: '#ffffff', color: '#0f172a', fontSize: '13px', fontWeight: 500 }}
                                >
                                    <option value="" style={{ color: '#94a3b8' }}>Select team member...</option>
                                    {teamMembers.map(m => (
                                        <option key={m.id} value={getTeamMemberDbId(m)} style={{ color: '#0f172a' }}>{m.firstName} {m.lastName} ({m.employeeId})</option>
                                    ))}
                                </select>
                            </div>

                            <div style={{ marginTop: '16px' }}>
                                <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>LOCATION</label>
                                <input
                                    value={assetAssignForm.location}
                                    onChange={(e) => setAssetAssignForm({ ...assetAssignForm, location: e.target.value })}
                                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', marginTop: '4px', background: '#ffffff', color: '#0f172a', fontSize: '13px' }}
                                    placeholder="Select location or enter custom (e.g. Desk 12)"
                                    list="office-locations"
                                />
                                <datalist id="office-locations">
                                    {locations.map(loc => (
                                        <option key={loc.id} value={loc.locationName}>
                                            {loc.locationName} {loc.locationCode ? `(${loc.locationCode})` : ''}
                                        </option>
                                    ))}
                                </datalist>
                            </div>

                            <div style={{ marginTop: '16px' }}>
                                <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>NOTES</label>
                                <input
                                    value={assetAssignForm.notes}
                                    onChange={(e) => setAssetAssignForm({ ...assetAssignForm, notes: e.target.value })}
                                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', marginTop: '4px', background: '#ffffff', color: '#0f172a', fontSize: '13px' }}
                                    placeholder="Notes..."
                                />
                            </div>
                            
                            {assetAssignMode === 'new' && (
                                <div style={{ marginTop: '16px' }}>
                                    <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>UPLOAD PHOTO / INVOICE (OPTIONAL)</label>
                                    <input 
                                        type="file" 
                                        accept="image/*,application/pdf" 
                                        onChange={(e) => handleFileChange(e, (url) => setAssetAssignForm(prev => ({ ...prev, imageUrl: url })))}
                                        disabled={uploadingFile}
                                        style={{ marginTop: '4px', fontSize: '13px', display: 'block', width: '100%' }}
                                    />
                                    {uploadingFile && <p style={{ fontSize: '12px', color: '#6366f1', margin: '4px 0 0 0' }}>Uploading...</p>}
                                    {assetAssignForm.imageUrl && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                                            {!assetAssignForm.imageUrl.toLowerCase().endsWith('.pdf') && (
                                                <img src={assetAssignForm.imageUrl} alt="Preview" style={{ width: '40px', height: '40px', borderRadius: '4px', objectFit: 'cover', border: '1px solid #e2e8f0' }} />
                                            )}
                                            <span style={{ fontSize: '12px', color: '#10b981' }}>✓ Uploaded:</span>
                                            <a href={assetAssignForm.imageUrl} target="_blank" rel="noreferrer" style={{ fontSize: '12px', color: '#10b981', textDecoration: 'underline', fontWeight: 600 }}>
                                                View {assetAssignForm.imageUrl.toLowerCase().endsWith('.pdf') ? 'PDF' : 'Image'}
                                            </a>
                                        </div>
                                    )}
                                </div>
                            )}

                            <div style={{ display: 'flex', gap: '10px', marginTop: '24px', borderTop: '1px solid #f1f5f9', paddingTop: '16px' }}>
                                <button 
                                    onClick={() => setShowAssignAssetModal(false)} 
                                    style={{ 
                                        flex: 1, 
                                        padding: '10px', 
                                        borderRadius: '8px', 
                                        border: '1px solid #cbd5e1', 
                                        background: '#fff', 
                                        color: '#475569',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        transition: 'background-color 0.2s'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ffffff'}
                                >
                                    Cancel
                                </button>
                                <button 
                                    onClick={handleAssignTeamAsset} 
                                    disabled={assigningAsset || uploadingFile} 
                                    style={{ 
                                        flex: 1, 
                                        padding: '10px', 
                                        borderRadius: '8px', 
                                        border: 'none', 
                                        background: '#4f46e5', 
                                        color: '#fff', 
                                        fontWeight: 600, 
                                        cursor: 'pointer',
                                        transition: 'background-color 0.2s',
                                        boxShadow: '0 1px 2px rgba(79, 70, 229, 0.15)'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#4338ca'}
                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#4f46e5'}
                                >
                                    {assigningAsset ? 'Assigning...' : 'Assign'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showHandoverModal && selectedHandover && (
                <div className="asset-modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div className="asset-modal" style={{ background: '#fff', borderRadius: '16px', padding: '24px', width: '90%', maxWidth: '600px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' }}>
                        <div className="asset-modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
                            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>Handover items for {selectedHandover.employeeName}</h3>
                            <button 
                                onClick={() => setShowHandoverModal(false)} 
                                style={{ 
                                    background: 'none', 
                                    border: 'none', 
                                    cursor: 'pointer', 
                                    padding: '6px', 
                                    borderRadius: '50%', 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    justifyContent: 'center', 
                                    transition: 'background-color 0.2s',
                                    color: '#64748b'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <div className="asset-modal-body" style={{ maxHeight: '400px', overflowY: 'auto', marginBottom: '20px' }}>
                            {(selectedHandover.assetItems || []).length === 0 ? (
                                <p style={{ color: '#64748b', textAlign: 'center', padding: '24px 0' }}>No handover items.</p>
                            ) : (
                                <div style={{ display: 'grid', gap: '12px' }}>
                                    {selectedHandover.assetItems.map(item => (
                                        <div key={item.id} style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', background: '#f8fafc' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                                <strong style={{ color: '#0f172a' }}>{item.assetName}</strong>
                                                <span style={{ 
                                                    fontSize: '11px', 
                                                    fontWeight: 700, 
                                                    color: item.status === 'CLEARED' ? '#15803d' : '#b45309', 
                                                    background: item.status === 'CLEARED' ? '#dcfce7' : '#fef3c7', 
                                                    padding: '2px 8px', 
                                                    borderRadius: '999px' 
                                                }}>{item.status}</span>
                                            </div>
                                            <div style={{ display: 'flex', gap: '10px', marginTop: '12px', borderTop: '1px solid #e2e8f0', paddingTop: '12px' }}>
                                                <button 
                                                    onClick={() => handleUpdateHandoverItemStatus(item.id, 'CLEARED')} 
                                                    style={{ 
                                                        border: 'none', 
                                                        background: '#10b981', 
                                                        color: '#fff', 
                                                        padding: '6px 12px', 
                                                        borderRadius: '6px', 
                                                        cursor: 'pointer', 
                                                        fontSize: '12px',
                                                        fontWeight: 600,
                                                        transition: 'background-color 0.2s'
                                                    }}
                                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#059669'}
                                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#10b981'}
                                                >
                                                    Clear Item
                                                </button>
                                                <button 
                                                    onClick={() => handleUpdateHandoverItemStatus(item.id, 'PENDING')} 
                                                    style={{ 
                                                        border: 'none', 
                                                        background: '#ef4444', 
                                                        color: '#fff', 
                                                        padding: '6px 12px', 
                                                        borderRadius: '6px', 
                                                        cursor: 'pointer', 
                                                        fontSize: '12px',
                                                        fontWeight: 600,
                                                        transition: 'background-color 0.2s'
                                                    }}
                                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#dc2626'}
                                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ef4444'}
                                                >
                                                    Mark Pending
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {showTransferModal && selectedAssetTransfer && (
                <div className="asset-modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div className="asset-modal" style={{ background: '#fff', borderRadius: '16px', padding: '24px', width: '90%', maxWidth: '500px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' }}>
                        <div className="asset-modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
                            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>Transfer Asset</h3>
                            <button 
                                onClick={() => setShowTransferModal(false)} 
                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleTransfer} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Asset to Transfer</div>
                                <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', marginTop: '4px' }}>{selectedAssetTransfer.assetName}</div>
                                {selectedAssetTransfer.serialNumber && (
                                    <div style={{ fontSize: '12px', color: '#334155', marginTop: '4px' }}>
                                        Serial Number: <strong>{selectedAssetTransfer.serialNumber}</strong>
                                    </div>
                                )}
                                <div style={{ fontSize: '12px', color: '#64748b', marginTop: selectedAssetTransfer.serialNumber ? '2px' : '0' }}>Current Assignee: {selectedAssetTransfer.assignedToName || 'Unassigned'}</div>
                            </div>
                            <div>
                                <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Transfer To</label>
                                <select
                                    required
                                    value={transferData.toEmployeeId}
                                    onChange={(e) => setTransferData({ ...transferData, toEmployeeId: e.target.value })}
                                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', marginTop: '6px', background: '#fff', color: '#0f172a', fontSize: '13px', fontWeight: 500 }}
                                >
                                    <option value="">Select team member...</option>
                                    {teamMembers.map(m => {
                                        const dbId = getTeamMemberDbId(m);
                                        return (
                                            <option key={m.id || dbId} value={dbId}>
                                                {m.firstName} {m.lastName} ({m.employeeId})
                                            </option>
                                        );
                                    })}
                                </select>
                            </div>
                            <div>
                                <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>New Location</label>
                                <input
                                    type="text"
                                    placeholder="e.g. Bangalore Office"
                                    value={transferData.location}
                                    onChange={(e) => setTransferData({ ...transferData, location: e.target.value })}
                                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', marginTop: '6px', fontSize: '13px' }}
                                />
                            </div>
                            <div>
                                <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Transfer Notes</label>
                                <textarea
                                    placeholder="Add reason for transfer..."
                                    rows="3"
                                    value={transferData.notes}
                                    onChange={(e) => setTransferData({ ...transferData, notes: e.target.value })}
                                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', marginTop: '6px', fontSize: '13px', resize: 'vertical' }}
                                />
                            </div>
                            <div style={{ marginTop: '12px' }}>
                                <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>UPLOAD TRANSFER DOCUMENT / PHOTO (OPTIONAL)</label>
                                <input 
                                    type="file" 
                                    accept="image/*,application/pdf" 
                                    onChange={(e) => handleFileChange(e, (url) => setTransferData(prev => ({ ...prev, imageUrl: url })))}
                                    disabled={uploadingFile}
                                    style={{ marginTop: '6px', fontSize: '13px', display: 'block', width: '100%' }}
                                />
                                {uploadingFile && <p style={{ fontSize: '12px', color: '#6366f1', margin: '4px 0 0 0' }}>Uploading...</p>}
                                {transferData.imageUrl && (
                                    <p style={{ fontSize: '12px', color: '#10b981', margin: '4px 0 0 0' }}>
                                        ✓ Uploaded: <a href={transferData.imageUrl} target="_blank" rel="noreferrer" style={{ textDecoration: 'underline' }}>View file</a>
                                    </p>
                                )}
                            </div>
                            <div className="asset-modal-footer" style={{ borderTop: '1px solid #f1f5f9', paddingTop: '16px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                                <button 
                                    type="button"
                                    onClick={() => setShowTransferModal(false)}
                                    style={{ border: '1px solid #cbd5e1', background: '#fff', color: '#475569', padding: '8px 20px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit"
                                    disabled={assigningAsset || uploadingFile}
                                    style={{ border: 'none', background: '#4f46e5', color: '#fff', padding: '8px 20px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}
                                >
                                    {assigningAsset ? 'Transferring...' : 'Transfer Asset'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showHistoryModal && selectedAssetHistory && (
                <div className="asset-modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div className="asset-modal" style={{ background: '#fff', borderRadius: '16px', padding: '24px', width: '90%', maxWidth: '650px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' }}>
                        <div className="asset-modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px', flexShrink: 0 }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>Asset History</h3>
                                <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748b' }}>
                                    {selectedAssetHistory.assetName} ({selectedAssetHistory.assetId || 'AST-N/A'})
                                </p>
                            </div>
                            <button 
                                onClick={() => setShowHistoryModal(false)} 
                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}
                            >
                                <X size={20} />
                            </button>
                        </div>
                        
                        <div className="asset-modal-tabs" style={{ display: 'flex', gap: '8px', background: '#f1f5f9', padding: '4px', borderRadius: '8px', width: 'fit-content', marginBottom: '16px', flexShrink: 0 }}>
                            <button 
                                onClick={() => setHistoryTab('lifecycle')} 
                                style={{
                                    padding: '6px 12px',
                                    borderRadius: '6px',
                                    border: 'none',
                                    background: historyTab === 'lifecycle' ? '#fff' : 'transparent',
                                    color: historyTab === 'lifecycle' ? '#0f172a' : '#475569',
                                    fontWeight: 600,
                                    fontSize: '12px',
                                    cursor: 'pointer'
                                }}
                            >
                                Lifecycle & Assignments ({history.length})
                            </button>
                            <button 
                                onClick={() => setHistoryTab('tickets')} 
                                style={{
                                    padding: '6px 12px',
                                    borderRadius: '6px',
                                    border: 'none',
                                    background: historyTab === 'tickets' ? '#fff' : 'transparent',
                                    color: historyTab === 'tickets' ? '#0f172a' : '#475569',
                                    fontWeight: 600,
                                    fontSize: '12px',
                                    cursor: 'pointer'
                                }}
                            >
                                Repairs & Issues ({assetTickets.length})
                            </button>
                            <button 
                                onClick={() => setHistoryTab('maintenance')} 
                                style={{
                                    padding: '6px 12px',
                                    borderRadius: '6px',
                                    border: 'none',
                                    background: historyTab === 'maintenance' ? '#fff' : 'transparent',
                                    color: historyTab === 'maintenance' ? '#0f172a' : '#475569',
                                    fontWeight: 600,
                                    fontSize: '12px',
                                    cursor: 'pointer'
                                }}
                            >
                                Maintenance Logs ({assetMaintenance.length})
                            </button>
                        </div>

                        <div className="asset-modal-body" style={{ overflowY: 'auto', flex: 1, paddingRight: '4px', marginBottom: '20px' }}>
                            {historyTab === 'lifecycle' && (
                                history.length === 0 ? (
                                    <p style={{ color: '#64748b', textAlign: 'center', padding: '24px 0' }}>No history recorded yet.</p>
                                ) : (
                                    <div style={{ display: 'grid', gap: '12px' }}>
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
                                    <div style={{ display: 'grid', gap: '12px' }}>
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
                                                    }}>{t.status}</span>
                                                </div>
                                                <div style={{ fontWeight: 700, fontSize: '13px', color: '#334155', marginTop: '6px' }}>{t.subject}</div>
                                                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>{t.description}</div>
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
                                                <div className="asset-card-meta" style={{ fontSize: '11px', color: '#94a3b8', marginTop: '6px' }}>
                                                    Priority: <strong>{t.priority}</strong> · Raised: {formatDate(t.createdAt)}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )
                            )}

                            {historyTab === 'maintenance' && (
                                assetMaintenance.length === 0 ? (
                                    <p style={{ color: '#64748b', textAlign: 'center', padding: '24px 0' }}>No maintenance history logged.</p>
                                ) : (
                                    <div style={{ display: 'grid', gap: '12px', maxHeight: '350px', overflowY: 'auto' }}>
                                        {assetMaintenance.map((m) => (
                                            <div key={m.id} style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <span style={{ fontSize: '12px', fontWeight: 800, color: '#0f172a' }}>
                                                        {m.maintenanceType || 'GENERAL'}
                                                    </span>
                                                    <span style={{ fontSize: '12px', color: '#059669', background: '#d1fae5', padding: '2px 8px', borderRadius: '6px', fontWeight: 600 }}>
                                                        Cost: ₹{m.cost || '0.00'}
                                                    </span>
                                                </div>
                                                <div style={{ fontSize: '13px', color: '#334155', marginTop: '4px' }}>{m.description || 'No description provided.'}</div>
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
                        </div>

                        <div className="asset-modal-footer" style={{ borderTop: '1px solid #f1f5f9', paddingTop: '16px', display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}>
                            <button 
                                onClick={() => setShowHistoryModal(false)}
                                style={{ border: '1px solid #cbd5e1', background: '#fff', color: '#475569', padding: '8px 20px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showStatusModal && selectedAssetStatus && (
                <div className="asset-modal-overlay" onClick={() => setShowStatusModal(false)}>
                    <div className="asset-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
                        <div className="asset-modal-header">
                            <h2>Change status</h2>
                        </div>
                        <div className="asset-modal-body">
                            <form onSubmit={(e) => {
                                e.preventDefault();
                                handleUpdateTeamAssetStatus(selectedAssetStatus.id, statusFormValue);
                                setShowStatusModal(false);
                            }}>
                                <div style={{ marginBottom: '16px' }}>
                                    <p style={{ fontSize: '14px', color: '#475569', margin: '0 0 6px 0' }}>Asset: <strong>{selectedAssetStatus.assetName}</strong></p>
                                    <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>Asset ID: {selectedAssetStatus.assetCode || '—'}</p>
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
                                        {['ASSIGNED', 'MAINTENANCE', 'DAMAGED', 'LOST'].map((s) => (
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
                const targetAsset = teamAssets.find(a => a.id === pendingReturnAssetId);
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
                                    Are you sure you want to mark this asset as returned from the team member?
                                </p>
                            <div className="asset-field" style={{ marginBottom: '20px' }}>
                                <label>Upload Return Photo / Document (Optional)</label>
                                <input 
                                    type="file" 
                                    accept="image/*,application/pdf" 
                                    onChange={(e) => handleFileChange(e, setReturnImageUrl)}
                                    disabled={uploadingFile}
                                    style={{ marginTop: '6px', fontSize: '13px', display: 'block', width: '100%' }}
                                />
                                {uploadingFile && <p style={{ fontSize: '12px', color: '#6366f1', margin: '4px 0 0 0' }}>Uploading...</p>}
                                {returnImageUrl && (
                                    <p style={{ fontSize: '12px', color: '#10b981', margin: '4px 0 0 0' }}>
                                        ✓ Uploaded: <a href={returnImageUrl} target="_blank" rel="noreferrer" style={{ textDecoration: 'underline' }}>View file</a>
                                    </p>
                                )}
                            </div>
                            <div className="asset-modal-actions" style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                                <button 
                                    type="button" 
                                    style={{ border: '1px solid #cbd5e1', background: '#fff', color: '#475569', padding: '8px 20px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}
                                    onClick={() => setShowReturnConfirmModal(false)}
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="button" 
                                    style={{ border: 'none', background: '#ef4444', color: '#fff', padding: '8px 20px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}
                                    onClick={confirmReturnTeamAsset} 
                                    disabled={assigningAsset || uploadingFile}
                                >
                                    {assigningAsset ? 'Returning…' : 'Yes, Return'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
                );
            })()}

            {showDeleteConfirmModal && (() => {
                const targetAsset = teamAssets.find(a => a.id === pendingDeleteAssetId);
                return (
                    <div className="asset-modal-overlay" onClick={() => setShowDeleteConfirmModal(false)}>
                        <div className="asset-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
                            <div className="asset-modal-header">
                                <h2>Confirm Delete</h2>
                            </div>
                            <div className="asset-modal-body">
                                {targetAsset && (
                                    <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '16px' }}>
                                        <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Asset to Delete</div>
                                        <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', marginTop: '4px' }}>{targetAsset.assetName}</div>
                                        {targetAsset.serialNumber && (
                                            <div style={{ fontSize: '12px', color: '#334155', marginTop: '4px' }}>
                                                Serial Number: <strong>{targetAsset.serialNumber}</strong>
                                            </div>
                                        )}
                                        <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>Status: {targetAsset.status}</div>
                                    </div>
                                )}
                                <p style={{ fontSize: '14px', color: '#334155', marginBottom: '16px', lineHeight: '1.5' }}>
                                    Are you sure you want to permanently delete this asset? This action cannot be undone.
                                </p>
                                <div className="asset-modal-actions" style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                                    <button 
                                        type="button" 
                                        style={{ border: '1px solid #cbd5e1', background: '#fff', color: '#475569', padding: '8px 20px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}
                                        onClick={() => setShowDeleteConfirmModal(false)}
                                    >
                                        Cancel
                                    </button>
                                    <button 
                                        type="button" 
                                        style={{ border: 'none', background: '#ef4444', color: '#fff', padding: '8px 20px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}
                                        onClick={confirmDeleteAsset} 
                                        disabled={assigningAsset}
                                    >
                                        {assigningAsset ? 'Deleting…' : 'Yes, Delete'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {showCloseTicketModal && pendingTicket && (
                <div className="asset-modal-overlay" onClick={() => !assigningAsset && setShowCloseTicketModal(false)}>
                    <div className="asset-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '450px', background: '#fff', borderRadius: '16px', padding: '24px' }}>
                        <div className="asset-modal-header" style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '12px', marginBottom: '16px' }}>
                            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>Resolve / Close Ticket</h2>
                        </div>
                        <div className="asset-modal-body">
                            <form onSubmit={async (e) => {
                                e.preventDefault();
                                setAssigningAsset(true);
                                try {
                                    await managerAssetAPI.updateTicket(pendingTicket.id, {
                                        status: pendingTicketStatus,
                                        resolutionNotes: ticketResolutionNotes || null,
                                        resolutionImageUrl: ticketResolutionImageUrl || null,
                                    });
                                    toast.success(`Ticket marked ${pendingTicketStatus}`);
                                    setShowCloseTicketModal(false);
                                    fetchTeamAssets();
                                } catch (err) {
                                    toast.error(err.response?.data?.message || 'Failed to update ticket');
                                } finally {
                                    setAssigningAsset(false);
                                }
                            }}>
                                <p style={{ fontSize: '14px', color: '#334155', marginBottom: '12px' }}>
                                    Ticket: <strong>{pendingTicket.ticketNumber}</strong> · Type: {pendingTicket.ticketType}
                                </p>
                                <div className="asset-field" style={{ marginBottom: '12px' }}>
                                    <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Resolution Notes *</label>
                                    <textarea 
                                        required 
                                        placeholder="Enter details about how the ticket was resolved..." 
                                        value={ticketResolutionNotes} 
                                        onChange={e => setTicketResolutionNotes(e.target.value)}
                                        style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', marginTop: '6px' }}
                                    />
                                </div>
                                <div className="asset-field" style={{ marginBottom: '20px' }}>
                                    <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Upload Resolution Document / Photo (Optional)</label>
                                    <input 
                                        type="file" 
                                        accept="image/*,application/pdf" 
                                        onChange={(e) => handleFileChange(e, setTicketResolutionImageUrl)}
                                        disabled={uploadingFile}
                                        style={{ marginTop: '6px', fontSize: '13px', display: 'block', width: '100%' }}
                                    />
                                    {uploadingFile && <p style={{ fontSize: '12px', color: '#6366f1', margin: '4px 0 0 0' }}>Uploading...</p>}
                                    {ticketResolutionImageUrl && (
                                        <p style={{ fontSize: '12px', color: '#10b981', margin: '4px 0 0 0' }}>
                                            ✓ Uploaded: <a href={ticketResolutionImageUrl} target="_blank" rel="noreferrer" style={{ textDecoration: 'underline' }}>View file</a>
                                        </p>
                                    )}
                                </div>
                                <div className="asset-modal-actions" style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                                    <button 
                                        type="button" 
                                        style={{ border: '1px solid #cbd5e1', background: '#fff', color: '#475569', padding: '8px 20px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}
                                        onClick={() => setShowCloseTicketModal(false)}
                                    >
                                        Cancel
                                    </button>
                                    <button 
                                        type="submit" 
                                        style={{ border: 'none', background: '#4f46e5', color: '#fff', padding: '8px 20px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}
                                        disabled={assigningAsset || uploadingFile}
                                    >
                                        Confirm {pendingTicketStatus === 'RESOLVED' ? 'Resolution' : 'Closure'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {showTicketModal && (
                <div className="asset-modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => !assigningAsset && setShowTicketModal(false)}>
                    <div className="asset-modal" style={{ background: '#fff', borderRadius: '16px', padding: '24px', width: '90%', maxWidth: '500px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' }} onClick={(e) => e.stopPropagation()}>
                        <div className="asset-modal-header" style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '12px', marginBottom: '16px' }}>
                            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>Raise asset ticket</h2>
                        </div>
                        <div className="asset-modal-body">
                            <form onSubmit={handleRaiseTicket} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <div className="asset-field" style={{ display: 'flex', flexDirection: 'column' }}>
                                    <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Asset *</label>
                                    <select 
                                        required 
                                        value={ticketForm.assetId} 
                                        onChange={(e) => setTicketForm({ ...ticketForm, assetId: e.target.value })}
                                        style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', marginTop: '6px', background: '#fff', fontSize: '13px' }}
                                    >
                                        <option value="">Select asset</option>
                                        {teamAssets.map((a) => (
                                            <option key={a.id} value={a.id}>{a.assetName} ({a.assetCode || a.id})</option>
                                        ))}
                                    </select>
                                </div>
                                {(() => {
                                    const currentAsset = selectedAsset || teamAssets.find(a => Number(a.id) === Number(ticketForm.assetId));
                                    const assignedEmployees = currentAsset?.assignedEmployees || [];
                                    if (assignedEmployees.length > 1) {
                                        return (
                                            <div className="asset-field" style={{ display: 'flex', flexDirection: 'column' }}>
                                                <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', display: 'flex', alignItems: 'flex-end', minHeight: '16px' }}>Tag Employee *</label>
                                                <select 
                                                    required
                                                    value={ticketForm.taggedEmployeeId || ''} 
                                                    onChange={(e) => setTicketForm({ ...ticketForm, taggedEmployeeId: e.target.value })}
                                                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', marginTop: '6px', background: '#fff', fontSize: '13px' }}
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
                                <div className="asset-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                    <div className="asset-field" style={{ display: 'flex', flexDirection: 'column' }}>
                                        <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', display: 'flex', alignItems: 'flex-end', minHeight: '28px' }}>Type *</label>
                                        <select 
                                            value={ticketForm.ticketType} 
                                            onChange={(e) => setTicketForm({ ...ticketForm, ticketType: e.target.value })}
                                            style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', marginTop: '6px', background: '#fff', fontSize: '13px' }}
                                        >
                                            {['REPAIR', 'DAMAGE', 'LOST', 'REPLACEMENT', 'MAINTENANCE'].map((t) => <option key={t} value={t}>{t}</option>)}
                                        </select>
                                    </div>
                                    <div className="asset-field" style={{ display: 'flex', flexDirection: 'column' }}>
                                        <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', display: 'flex', alignItems: 'flex-end', minHeight: '28px' }}>Priority</label>
                                        <select 
                                            value={ticketForm.priority} 
                                            onChange={(e) => setTicketForm({ ...ticketForm, priority: e.target.value })}
                                            style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', marginTop: '6px', background: '#fff', fontSize: '13px' }}
                                        >
                                            {['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map((p) => <option key={p} value={p}>{p}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div className="asset-field" style={{ display: 'flex', flexDirection: 'column' }}>
                                    <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Subject *</label>
                                    <input 
                                        required 
                                        value={ticketForm.subject} 
                                        onChange={(e) => setTicketForm({ ...ticketForm, subject: e.target.value })}
                                        style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', marginTop: '6px', fontSize: '13px' }}
                                    />
                                </div>
                                <div className="asset-field" style={{ display: 'flex', flexDirection: 'column' }}>
                                    <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Description</label>
                                    <textarea 
                                        value={ticketForm.description} 
                                        onChange={(e) => setTicketForm({ ...ticketForm, description: e.target.value })}
                                        style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', marginTop: '6px', fontSize: '13px', minHeight: '60px', resize: 'vertical' }}
                                    />
                                </div>
                                <div className="asset-field" style={{ display: 'flex', flexDirection: 'column', marginBottom: '16px' }}>
                                    <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Upload Support Photo / Invoice (Optional)</label>
                                    <input 
                                        type="file" 
                                        accept="image/*,application/pdf" 
                                        onChange={(e) => handleFileChange(e, (url) => setTicketForm(prev => ({ ...prev, imageUrl: url })))}
                                        disabled={uploadingFile}
                                        style={{ marginTop: '6px', fontSize: '13px', display: 'block', width: '100%' }}
                                    />
                                    {uploadingFile && <p style={{ fontSize: '12px', color: '#6366f1', margin: '4px 0 0 0' }}>Uploading...</p>}
                                    {ticketForm.imageUrl && (
                                        <p style={{ fontSize: '12px', color: '#10b981', margin: '4px 0 0 0' }}>
                                            ✓ Uploaded: <a href={ticketForm.imageUrl} target="_blank" rel="noreferrer" style={{ textDecoration: 'underline' }}>View file</a>
                                        </p>
                                    )}
                                </div>
                                <div className="asset-modal-actions" style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', borderTop: '1px solid #f1f5f9', paddingTop: '16px' }}>
                                    <button 
                                        type="button" 
                                        style={{ border: '1px solid #cbd5e1', background: '#fff', color: '#475569', padding: '8px 20px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}
                                        onClick={() => setShowTicketModal(false)}
                                    >
                                        Cancel
                                    </button>
                                    <button 
                                        type="submit" 
                                        style={{ border: 'none', background: '#4f46e5', color: '#fff', padding: '8px 20px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}
                                        disabled={assigningAsset || uploadingFile}
                                    >
                                        {assigningAsset ? 'Submitting…' : 'Submit'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {showMaintenanceModal && (() => {
                const isSaveDisabled = !maintenanceForm.assetId || 
                                       !maintenanceForm.maintenanceType || 
                                       (!String(maintenanceForm.vendor || '').trim() && 
                                        !String(maintenanceForm.cost || '').trim() && 
                                        !String(maintenanceForm.completedAt || '').trim() && 
                                        !String(maintenanceForm.description || '').trim() && 
                                        !String(maintenanceForm.outcomeNotes || '').trim() && 
                                        !maintenanceForm.imageUrl);
                return (
                    <div className="asset-modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => !assigningAsset && setShowMaintenanceModal(false)}>
                        <div className="asset-modal" style={{ background: '#fff', borderRadius: '16px', padding: '24px', width: '90%', maxWidth: '500px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' }} onClick={(e) => e.stopPropagation()}>
                            <div className="asset-modal-header" style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '12px', marginBottom: '16px' }}>
                                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>Log maintenance</h2>
                            </div>
                            <div className="asset-modal-body">
                                <form onSubmit={handleAddMaintenance} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    <div className="asset-field" style={{ display: 'flex', flexDirection: 'column' }}>
                                        <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Asset *</label>
                                        <select 
                                            required 
                                            value={maintenanceForm.assetId || ''} 
                                            onChange={(e) => setMaintenanceForm({ ...maintenanceForm, assetId: e.target.value })}
                                            style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', marginTop: '6px', background: '#fff', fontSize: '13px' }}
                                        >
                                            <option value="">Select asset</option>
                                            {teamAssets.map((a) => (
                                                <option key={a.id} value={a.id}>{a.assetName} ({a.assetCode || a.id})</option>
                                            ))}
                                        </select>
                                    </div>
                                        {(() => {
                                            const currentAsset = selectedAssetHistory || teamAssets.find(a => Number(a.id) === Number(maintenanceForm.assetId));
                                            const assignedEmployees = currentAsset?.assignedEmployees || [];
                                            if (assignedEmployees.length > 1) {
                                                return (
                                                    <div className="asset-field" style={{ display: 'flex', flexDirection: 'column' }}>
                                                        <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', display: 'flex', alignItems: 'flex-end', minHeight: '16px' }}>Tag Employee *</label>
                                                        <select 
                                                            required
                                                            value={maintenanceForm.taggedEmployeeId || ''} 
                                                            onChange={(e) => setMaintenanceForm({ ...maintenanceForm, taggedEmployeeId: e.target.value })}
                                                            style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', marginTop: '6px', background: '#fff', fontSize: '13px' }}
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
                                    <div className="asset-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                        <div className="asset-field" style={{ display: 'flex', flexDirection: 'column' }}>
                                            <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', display: 'flex', alignItems: 'flex-end', minHeight: '28px' }}>Type *</label>
                                            <select 
                                                value={maintenanceForm.maintenanceType === 'GENERAL' || maintenanceForm.maintenanceType === 'REPAIR' || maintenanceForm.maintenanceType === 'INSPECTION' ? maintenanceForm.maintenanceType : 'OTHER'} 
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    setMaintenanceForm({ 
                                                        ...maintenanceForm, 
                                                        maintenanceType: val === 'OTHER' ? '' : val 
                                                    });
                                                }}
                                                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', marginTop: '6px', background: '#fff', fontSize: '13px' }}
                                            >
                                                <option value="GENERAL">GENERAL</option>
                                                <option value="REPAIR">REPAIR</option>
                                                <option value="INSPECTION">INSPECTION</option>
                                                <option value="OTHER">Other</option>
                                            </select>
                                            {!(maintenanceForm.maintenanceType === 'GENERAL' || maintenanceForm.maintenanceType === 'REPAIR' || maintenanceForm.maintenanceType === 'INSPECTION') && (
                                                <input 
                                                    type="text" 
                                                    placeholder="Enter type name" 
                                                    value={maintenanceForm.maintenanceType} 
                                                    onChange={(e) => setMaintenanceForm({ ...maintenanceForm, maintenanceType: e.target.value })}
                                                    required 
                                                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', marginTop: '6px', fontSize: '13px' }} 
                                                />
                                            )}
                                        </div>
                                        <div className="asset-field" style={{ display: 'flex', flexDirection: 'column' }}>
                                            <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', display: 'flex', alignItems: 'flex-end', minHeight: '28px' }}>Vendor</label>
                                            <input 
                                                value={maintenanceForm.vendor || ''} 
                                                onChange={(e) => setMaintenanceForm({ ...maintenanceForm, vendor: e.target.value })}
                                                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', marginTop: '6px', fontSize: '13px' }}
                                            />
                                        </div>
                                    </div>
                                    <div className="asset-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                        <div className="asset-field" style={{ display: 'flex', flexDirection: 'column' }}>
                                            <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', display: 'flex', alignItems: 'flex-end', minHeight: '28px' }}>Cost (₹)</label>
                                            <input 
                                                type="number"
                                                value={maintenanceForm.cost || ''} 
                                                onChange={(e) => setMaintenanceForm({ ...maintenanceForm, cost: e.target.value })}
                                                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', marginTop: '6px', fontSize: '13px' }}
                                            />
                                        </div>
                                        <div className="asset-field" style={{ display: 'flex', flexDirection: 'column' }}>
                                            <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', display: 'flex', alignItems: 'flex-end', minHeight: '28px' }}>Resolved Date (Completed At)</label>
                                            <input 
                                                type="date"
                                                value={maintenanceForm.completedAt || ''} 
                                                onChange={(e) => setMaintenanceForm({ ...maintenanceForm, completedAt: e.target.value })}
                                                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', marginTop: '6px', fontSize: '13px' }}
                                            />
                                        </div>
                                    </div>
                                    <div className="asset-field" style={{ display: 'flex', flexDirection: 'column' }}>
                                        <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Description</label>
                                        <textarea 
                                            value={maintenanceForm.description || ''} 
                                            onChange={(e) => setMaintenanceForm({ ...maintenanceForm, description: e.target.value })}
                                            style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', marginTop: '6px', fontSize: '13px', minHeight: '60px', resize: 'vertical' }}
                                        />
                                    </div>
                                    <div className="asset-field" style={{ display: 'flex', flexDirection: 'column' }}>
                                        <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Outcome Notes</label>
                                        <textarea 
                                            value={maintenanceForm.outcomeNotes || ''} 
                                            onChange={(e) => setMaintenanceForm({ ...maintenanceForm, outcomeNotes: e.target.value })}
                                            style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', marginTop: '6px', fontSize: '13px', minHeight: '60px', resize: 'vertical' }}
                                        />
                                    </div>
                                    <div className="asset-field" style={{ display: 'flex', flexDirection: 'column', marginBottom: '16px' }}>
                                        <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Upload Support Photo / Invoice (Optional)</label>
                                        <input 
                                            type="file" 
                                            accept="image/*,application/pdf" 
                                            onChange={(e) => handleFileChange(e, (url) => setMaintenanceForm(prev => ({ ...prev, imageUrl: url })))}
                                            disabled={uploadingFile}
                                            style={{ marginTop: '6px', fontSize: '13px', display: 'block', width: '100%' }}
                                        />
                                        {uploadingFile && <p style={{ fontSize: '12px', color: '#6366f1', margin: '4px 0 0 0' }}>Uploading...</p>}
                                        {maintenanceForm.imageUrl && (
                                            <p style={{ fontSize: '12px', color: '#10b981', margin: '4px 0 0 0' }}>
                                                ✓ Uploaded: <a href={maintenanceForm.imageUrl} target="_blank" rel="noreferrer" style={{ textDecoration: 'underline' }}>View file</a>
                                            </p>
                                        )}
                                    </div>
                                    <div className="asset-modal-actions" style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', borderTop: '1px solid #f1f5f9', paddingTop: '16px' }}>
                                        <button 
                                            type="button" 
                                            style={{ border: '1px solid #cbd5e1', background: '#fff', color: '#475569', padding: '8px 20px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}
                                            onClick={() => setShowMaintenanceModal(false)}
                                        >
                                            Cancel
                                        </button>
                                        <button 
                                            type="submit" 
                                            style={{ 
                                                border: 'none', 
                                                background: isSaveDisabled ? '#cbd5e1' : '#4f46e5', 
                                                color: isSaveDisabled ? '#94a3b8' : '#fff', 
                                                padding: '8px 20px', 
                                                borderRadius: '8px', 
                                                cursor: isSaveDisabled ? 'not-allowed' : 'pointer', 
                                                fontSize: '13px', 
                                                fontWeight: 600,
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '8px'
                                            }}
                                            disabled={assigningAsset || uploadingFile || isSaveDisabled}
                                        >
                                            {assigningAsset ? (
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <span className="animate-spin" style={{ 
                                                        display: 'inline-block', 
                                                        width: '12px', 
                                                        height: '12px', 
                                                        border: '2px solid #fff', 
                                                        borderTop: '2px solid transparent', 
                                                        borderRadius: '50%',
                                                        animation: 'spin 1s linear infinite'
                                                    }}></span>
                                                    Saving…
                                                </span>
                                            ) : 'Save log'}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
}
