import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
    User,
    Briefcase,
    FileText,
    Lock,
    Mail,
    Edit,
    Calendar,
    MapPin,
    Phone,
    Download,
    GitMerge,
    ChevronRight,
    Award,
    Clock,
    Info,
    Loader2,
    CheckCircle,
    Upload,
    Trash2,
    X,
    Plus,
    RefreshCw
} from 'lucide-react';
import Header from '../components/Header';
import { useAuth } from '../contexts/AuthContext';
import { adminAPI, employeeAPI, reportingAPI, documentAPI } from '../services/api';
import { toast } from 'react-hot-toast';
import OrgChart from '../components/OrgChart';

export default function EmployeeDetails({ embeddedId, isEmbedded = false }) {
    const { id } = useParams();
    const navigate = useNavigate();
    const location = useLocation();

    // Check modes
    const isProfileView = location.pathname === '/employee/profile';
    const isAdminProfileView = location.pathname === '/admin/profile';

    const [activeTab, setActiveTab] = useState('overview');
    const [employee, setEmployee] = useState(null);
    const [hierarchy, setHierarchy] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const { hasAdminAccess, getCurrentUser, updateUserData, hasCrudPermission } = useAuth();
    const currentUser = getCurrentUser();

    // Edit states
    const [isEditing, setIsEditing] = useState(false);
    const [editData, setEditData] = useState(null);
    const [isSaving, setIsSaving] = useState(false);

    // Determine effective ID
    const effectiveId = embeddedId || id;

    useEffect(() => {
        fetchData();
    }, [effectiveId, isAdminProfileView, isProfileView]);

    const fetchData = async () => {
        setLoading(true);
        try {
            let empData = null;

            // 1. Fetch Employee Data
            if (embeddedId) {
                const res = await adminAPI.getEmployeeById(embeddedId);
                empData = res.data?.data || res.data;
            } else if (isAdminProfileView) {
                const res = await adminAPI.getAdminProfile();
                empData = res.data;
            } else if (id) {
                const res = await adminAPI.getEmployeeById(id);
                empData = res.data?.data || res.data;
            } else {
                const res = await employeeAPI.getProfile();
                empData = res.data?.data || res.data;

                // Update user data in AuthContext with latest profile data (including role)
                // This ensures the Header component shows the correct role
                if (empData && currentUser && (empData.employeeId === currentUser.employeeId || empData.id === currentUser.id || empData.email === currentUser.email)) {
                    try {
                        // Update user data in AuthContext (this will update both state and window.safeSessionStorage)
                        updateUserData(empData);
                    } catch (err) {
                        console.warn('Failed to update user data:', err);
                    }
                }
            }
            setEmployee(empData);

            // 2. Fetch Hierarchy - Show only immediate manager and direct reportees
            if (empData) {
                // For both admins and employees, show simplified hierarchy (immediate manager + direct reportees)
                // Try to get employee ID - prefer numeric id, fallback to employeeId string
                let empId = empData.id || empData._id;

                // If no numeric ID, try using employeeId string (the backend supports both)
                if (!empId && empData.employeeId) {
                    empId = empData.employeeId;
                }

                // Only fetch hierarchy if we have an ID
                if (empId) {
                    try {
                        console.log("Fetching simplified hierarchy for employee ID:", empId, "Employee data:", empData);

                        // Fetch only immediate manager (not full hierarchy chain)
                        let immediateManager = null;
                        try {
                            const managerRes = await reportingAPI.getReportingManager(empId);
                            const managerData = managerRes.data || managerRes;
                            // Only use if it's not an error message
                            if (managerData && !managerData.message && (managerData.id || managerData.employeeId)) {
                                immediateManager = managerData;
                            }
                        } catch (mErr) {
                            console.log("No immediate manager found or error:", mErr.message);
                        }

                        // Fetch subordinates (direct reports) - team members
                        const subordinatesRes = await reportingAPI.getSubordinates(empId);
                        let subordinatesData = subordinatesRes.data || subordinatesRes;
                        // Handle nested data structure
                        if (subordinatesData && !Array.isArray(subordinatesData)) {
                            if (subordinatesData.data) {
                                subordinatesData = subordinatesData.data;
                            } else if (subordinatesData.subordinates) {
                                subordinatesData = subordinatesData.subordinates;
                            } else if (subordinatesData.teamMembers) {
                                subordinatesData = subordinatesData.teamMembers;
                            }
                        }
                        console.log("Subordinates data received:", subordinatesData);
                        console.log("Subordinates count:", Array.isArray(subordinatesData) ? subordinatesData.length : 0);

                        // Ensure we have arrays - only include immediate manager
                        const managersArray = immediateManager ? [immediateManager] : [];
                        const subordinatesArray = Array.isArray(subordinatesData) ? subordinatesData : [];

                        // Combine hierarchy data: immediate manager + employee + direct reportees
                        const simplifiedHierarchy = {
                            type: 'employee',
                            managers: managersArray,
                            employee: empData,
                            subordinates: subordinatesArray
                        };

                        console.log("Setting simplified hierarchy:", simplifiedHierarchy);
                        console.log("Immediate manager:", immediateManager ? 'Found' : 'None');
                        console.log("Direct reportees count:", subordinatesArray.length);
                        setHierarchy(simplifiedHierarchy);
                    } catch (hErr) {
                        console.error("Hierarchy fetch failed", hErr);
                        console.error("Error details:", hErr.response?.data || hErr.message);
                        console.error("Error stack:", hErr.stack);
                        // Set empty hierarchy on error (still show employee node)
                        setHierarchy({
                            type: 'employee',
                            managers: [],
                            employee: empData,
                            subordinates: []
                        });
                    }
                } else {
                    console.warn("No employee ID found in employee data:", empData);
                    // Set empty hierarchy if no ID available
                    setHierarchy({
                        type: 'employee',
                        managers: [],
                        employee: empData,
                        subordinates: []
                    });
                }
            } else {
                // No employee data, set empty hierarchy
                console.warn("No employee data available");
                setHierarchy(null);
            }

        } catch (err) {
            console.error(err);
            setError("Failed to load profile.");
        } finally {
            setLoading(false);
        }
    };

    const handleEditToggle = () => {
        if (!isEditing) {
            // Initialize editData with existing employee data
            // Helper to ensure date is in YYYY-MM-DD for input type="date"
            const formatDateForInput = (dateVal) => {
                if (!dateVal) return '';
                try {
                    const dateObj = new Date(dateVal);
                    if (isNaN(dateObj.getTime())) return dateVal; // Fallback if not a valid date
                    return dateObj.toISOString().split('T')[0];
                } catch (e) {
                    return dateVal;
                }
            };

            setEditData({
                firstName: employee?.firstName || '',
                lastName: employee?.lastName || '',
                email: employee?.email || '',
                phone: employee?.phoneNumber || employee?.phone || '',
                panNumber: employee?.panNumber || '',
                dateOfBirth: formatDateForInput(employee?.dob || employee?.dateOfBirth) || '',
                emergencyContact: employee?.emergencyContact || '',
                emergencyPhone: employee?.emergencyPhone || '',
                bloodGroup: employee?.bloodGroup || '',
                education: employee?.education || '',
                skills: employee?.skills || employee?.skillSet || '',
                bio: employee?.bio || '',
                gender: employee?.gender || '',
                maritalStatus: employee?.maritalStatus || '',
                nationality: employee?.nationality || '',
                personalEmail: employee?.personalEmail || '',
                altPhone: employee?.altPhone || '',
                address: employee?.presentAddressLine1 || employee?.address || '',
                emergencyContactRelation: employee?.emergencyContactRelation || ''
            });
        }
        setIsEditing(!isEditing);
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setEditData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            // Prepare data for API - use updateProfile with FormData for compatibility
            const formData = new FormData();
            Object.keys(editData).forEach(key => {
                if (editData[key] !== null && editData[key] !== undefined) {
                    formData.append(key, editData[key]);
                }
            });

            await employeeAPI.updateProfile(formData);
            toast.success("Profile updated successfully!");
            setIsEditing(false);
            fetchData(); // Refresh data
        } catch (err) {
            console.error("Failed to update profile:", err);
            toast.error(err.response?.data?.message || "Failed to update profile.");
        } finally {
            setIsSaving(false);
        }
    };

    if (loading) return (
        <div className={isEmbedded ? "h-full flex items-center justify-center" : "main-content"}>
            {!isEmbedded && <Header title="Loading Profile..." />}
            <div className={isEmbedded ? "loading-spinner" : "page-content center-content"}>
                {!isEmbedded && <div className="loading-spinner"></div>}
                {isEmbedded && <Loader2 className="animate-spin" />}
            </div>
        </div>
    );

    if (error) return (
        <div className={isEmbedded ? "p-4 text-red-500" : "main-content"}>
            {!isEmbedded && <Header title="Error" />}
            <div className="page-content error-container">{error}</div>
        </div>
    );

    return (
        <div className={isEmbedded ? "h-full overflow-y-auto bg-gray-50" : "main-content"} style={isEmbedded ? {} : { paddingLeft: '10px' }}>
            {!isEmbedded && <Header title="Employee Profile" subtitle="Manage personal and professional details" />}

            <div className={isEmbedded ? "p-4" : "page-content dashboard-container"}>
                {/* Profile Header Card */}
                <div className="card profile-header-card" style={{
                    padding: 'clamp(16px, 4vw, 32px)',
                    display: 'flex',
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    alignItems: 'flex-start',
                    gap: '24px',
                    marginBottom: '24px',
                    marginTop: '16px'
                }}>
                    <div style={{ position: 'relative', margin: '0 auto' }}>
                        <img
                            src={employee?.profilePicture || `https://ui-avatars.com/api/?name=${employee?.firstName}+${employee?.lastName}&background=random&size=150`}
                            alt="Profile"
                            style={{
                                width: 'clamp(80px, 15vw, 120px)',
                                height: 'clamp(80px, 15vw, 120px)',
                                borderRadius: '16px',
                                objectFit: 'cover',
                                boxShadow: '0 8px 24px rgba(0,0,0,0.1)'
                            }}
                        />
                        <span style={{
                            position: 'absolute',
                            bottom: '-8px',
                            right: '-8px',
                            background: employee?.isActive ? '#22c55e' : '#94a3b8',
                            border: '4px solid white',
                            width: '24px',
                            height: '24px',
                            borderRadius: '50%'
                        }} />
                    </div>

                    <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                                <h1 style={{
                                    fontSize: 'clamp(20px, 4vw, 28px)',
                                    fontWeight: 'bold',
                                    marginBottom: '8px',
                                    color: 'var(--text-primary)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    flexWrap: 'wrap'
                                }}>
                                    {(() => {
                                        if (!employee) return 'User';

                                        let name = 'User';
                                        const firstName = employee.firstName || '';
                                        const lastName = employee.lastName || '';
                                        const fullNameStr = `${firstName} ${lastName}`.trim();

                                        // Check if the name is a generic placeholder
                                        const isGenericName = (nameToCheck) => {
                                            if (!nameToCheck) return true;
                                            const lowerName = nameToCheck.toLowerCase().trim();
                                            return lowerName === 'admin user' || lowerName === 'admin' || lowerName === 'user';
                                        };

                                        if (fullNameStr && !isGenericName(fullNameStr)) {
                                            name = fullNameStr;
                                        } else if (employee.name && !isGenericName(employee.name)) {
                                            name = employee.name;
                                        } else if (employee.fullName && !isGenericName(employee.fullName)) {
                                            name = employee.fullName;
                                        } else if (employee.displayName && !isGenericName(employee.displayName)) {
                                            name = employee.displayName;
                                        } else if (employee.username && !isGenericName(employee.username)) {
                                            name = employee.username;
                                        } else {
                                            name = fullNameStr || employee.username || 'User';
                                        }

                                        return name;
                                    })()}
                                    {employee?.employeeId && (
                                        <span style={{
                                            fontSize: '14px',
                                            fontWeight: '500',
                                            padding: '4px 10px',
                                            backgroundColor: '#f1f5f9',
                                            color: '#64748b',
                                            borderRadius: '8px',
                                            border: '1px solid #e2e8f0'
                                        }}>
                                            ID: {employee.employeeId}
                                        </span>
                                    )}
                                </h1>
                                <p style={{ fontSize: '16px', color: 'var(--text-secondary)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                    <Briefcase size={16} /> {employee?.position || employee?.positionName || employee?.designation || employee?.jobTitle || employee?.positionTitle || (employee?.position && typeof employee.position === 'object' ? (employee.position?.title || employee.position?.name) : '') || 'No Designation'}
                                    <span style={{ margin: '0 8px' }}>•</span>
                                    <MapPin size={16} /> {employee?.locationName || employee?.officeLocation || employee?.workLocation || 'Office'}
                                    {(() => {
                                        // Determine role value dynamically
                                        let roleValue = "";
                                        
                                        // 1. Check roles array (if available) - prioritize CEO, HR, ADMIN, MANAGER
                                        if (employee?.roles && Array.isArray(employee.roles) && employee.roles.length > 0) {
                                            const rolesUpper = employee.roles.map(r => {
                                                const raw = typeof r === 'object' && r !== null ? (r.name || '') : r;
                                                return String(raw).trim().toUpperCase();
                                            });
                                            
                                            if (rolesUpper.includes('CEO')) roleValue = 'CEO';
                                            else if (rolesUpper.includes('HR')) roleValue = 'HR';
                                            else if (rolesUpper.includes('ADMIN')) roleValue = 'ADMIN';
                                            else if (rolesUpper.includes('MANAGER')) roleValue = 'MANAGER';
                                            else {
                                                const first = employee.roles[0];
                                                roleValue = typeof first === 'object' && first !== null ? (first.name || '') : first;
                                            }
                                        }
                                        
                                        // 2. Fallback to employeeRoleName or role field
                                        if (!roleValue) {
                                            roleValue = employee?.employeeRoleName || '';
                                        }
                                        
                                        if (!roleValue && employee?.role) {
                                            if (typeof employee.role === 'string') {
                                                roleValue = employee.role;
                                            } else if (employee.role.name) {
                                                roleValue = employee.role.name;
                                            }
                                        }
                                        
                                        // 3. Dynamic Check: If role is still generic or HR, but designation is CEO, use CEO
                                        const upperDesignation = String(employee?.designation || employee?.jobTitle || '').trim().toUpperCase();
                                        const upperRoleValue = String(roleValue).trim().toUpperCase();
                                        
                                        if (upperDesignation === 'CEO' || upperDesignation.includes('CHIEF EXECUTIVE OFFICER')) {
                                            if (!roleValue || upperRoleValue === 'HR' || upperRoleValue === 'EMPLOYEE' || upperRoleValue === 'ADMIN') {
                                                roleValue = 'CEO';
                                            }
                                        }

                                        if (roleValue) {
                                            // Format role display (keep HR, CEO, ADMIN, MANAGER uppercase)
                                            const upperRole = String(roleValue).trim().toUpperCase();
                                            let displayRole = roleValue;
                                            if (upperRole === 'HR' || upperRole === 'CEO' || upperRole === 'ADMIN' || upperRole === 'MANAGER') {
                                                displayRole = upperRole;
                                            } else {
                                                // Capitalize for other roles
                                                displayRole = String(roleValue)
                                                    .trim()
                                                    .split(' ')
                                                    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                                                    .join(' ');
                                            }


                                            // Get role badge styling
                                            const getRoleStyle = () => {
                                                if (upperRole === 'HR' || upperRole === 'CEO') {
                                                    return {
                                                        backgroundColor: '#fef3c7',
                                                        color: '#92400e',
                                                        padding: '4px 12px',
                                                        borderRadius: '12px',
                                                        fontSize: '12px',
                                                        fontWeight: '600',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '6px'
                                                    };
                                                } else if (upperRole === 'ADMIN') {
                                                    return {
                                                        backgroundColor: '#dbeafe',
                                                        color: '#1e40af',
                                                        padding: '4px 12px',
                                                        borderRadius: '12px',
                                                        fontSize: '12px',
                                                        fontWeight: '600',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '6px'
                                                    };
                                                } else if (upperRole === 'MANAGER') {
                                                    return {
                                                        backgroundColor: '#d1fae5',
                                                        color: '#065f46',
                                                        padding: '4px 12px',
                                                        borderRadius: '12px',
                                                        fontSize: '12px',
                                                        fontWeight: '600',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '6px'
                                                    };
                                                } else {
                                                    return {
                                                        backgroundColor: '#e0e7ff',
                                                        color: '#3730a3',
                                                        padding: '4px 12px',
                                                        borderRadius: '12px',
                                                        fontSize: '12px',
                                                        fontWeight: '600',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '6px'
                                                    };
                                                }
                                            };

                                            return (
                                                <>
                                                    <span style={{ margin: '0 8px' }}>•</span>
                                                    <span style={getRoleStyle()}>
                                                        <Award size={14} /> {displayRole}
                                                    </span>
                                                </>
                                            );
                                        }
                                        return null;
                                    })()}
                                </p>

                                <div style={{ display: 'flex', gap: '24px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
                                        <Mail size={16} /> {employee?.email || 'N/A'}
                                    </div>
                                    {employee?.officialEmail && employee?.officialEmail !== employee?.email && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
                                            <Mail size={16} /> {employee?.officialEmail}
                                        </div>
                                    )}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
                                        <Phone size={16} /> {employee?.phoneNumber || 'N/A'}
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '12px' }}>
                                {(hasAdminAccess() || isProfileView) && !isEditing && hasCrudPermission?.('PEOPLE_ORG_EMPLOYEES', 'update') && (
                                    <button
                                        className="btn btn-secondary"
                                        style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                                        onClick={isProfileView ? handleEditToggle : () => navigate(`/admin/employees/${effectiveId}/edit`)}
                                    >
                                        <Edit size={16} /> Edit
                                    </button>
                                )}
                                {isEditing && (
                                    <>
                                        <button
                                            className="btn btn-primary"
                                            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                                            onClick={handleSave}
                                            disabled={isSaving}
                                        >
                                            {isSaving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />} Save
                                        </button>
                                        <button
                                            className="btn btn-secondary"
                                            onClick={() => setIsEditing(false)}
                                            disabled={isSaving}
                                        >
                                            Cancel
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Page-level Tab Navigation (not in card) */}
                <nav
                    className="employee-details-tabs"
                    style={{
                        width: '100%',
                        display: 'flex',
                        gap: '12px',
                        borderBottom: '2px solid #e5e7eb',
                        marginBottom: '16px',
                        background: 'transparent',
                        padding: '0 0 8px 0',
                        position: 'relative',
                        zIndex: 2,
                        overflowX: 'auto',
                        whiteSpace: 'nowrap',
                        scrollbarWidth: 'none'
                    }}
                >
                    {['overview', 'job', 'documents', 'timeline', 'hierarchy'].map(tab => (
                        <button
                            key={tab}
                            className={`employee-details-tab-btn${activeTab === tab ? ' active' : ''}`}
                            onClick={() => setActiveTab(tab)}
                            style={{
                                border: 'none',
                                background: 'none',
                                fontWeight: activeTab === tab ? 700 : 500,
                                color: activeTab === tab ? '#2563eb' : '#374151',
                                borderBottom: activeTab === tab ? '3px solid #2563eb' : '3px solid transparent',
                                padding: '8px 20px',
                                fontSize: '1rem',
                                cursor: 'pointer',
                                outline: 'none',
                                display: 'flex',
                                alignItems: 'center',
                                flexShrink: 0,
                                transition: 'color 0.2s, border-bottom 0.2s',
                                borderRadius: 0,
                                backgroundColor: 'transparent',
                                boxShadow: 'none',
                                marginBottom: '-2px'
                            }}
                        >
                            {tab === 'overview' && <User size={16} style={{ marginRight: '8px' }} />}
                            {tab === 'job' && <Briefcase size={16} style={{ marginRight: '8px' }} />}
                            {tab === 'documents' && <FileText size={16} style={{ marginRight: '8px' }} />}
                            {tab === 'timeline' && <Clock size={16} style={{ marginRight: '8px' }} />}
                            {tab === 'hierarchy' && <GitMerge size={16} style={{ marginRight: '8px' }} />}
                            {tab}
                        </button>
                    ))}
                </nav>

                {/* Tab Content */}
                <div className="fade-in" style={{ visibility: 'visible', opacity: 1 }}>
                    {activeTab === 'overview' && (
                        <OverviewTab 
                            employee={isEditing ? editData : employee} 
                            isEditing={isEditing} 
                            onInputChange={handleInputChange} 
                        />
                    )}
                    {activeTab === 'job' && <JobDetailsTab employee={employee} />}
                    {activeTab === 'documents' && (
                        <DocumentsTab 
                            employeeId={employee?.employeeId || employee?.id || effectiveId}
                            canManage={isProfileView || isAdminProfileView || hasAdminAccess()} 
                        />
                    )}
                    {activeTab === 'timeline' && <TimelineTab employee={employee} />}
                    {activeTab === 'hierarchy' && <HierarchyTab hierarchy={hierarchy} />}
                </div>

            </div>
        </div>
    );
}

// --- Sub Components ---

function OverviewTab({ employee, isEditing, onInputChange }) {
    return (
        <div style={{ maxWidth: '100%', padding: '8px 0' }}>
            <div style={{ display: 'flex', flexDirection: 'column', width: '100%', gap: '24px', position: 'relative' }}>
                {/* Personal Info */}
                <div className="card" style={{ width: '100%', flex: 'none', float: 'none', position: 'relative' }}>
                    <div className="card-header">
                        <h3 className="card-title">Personal Information</h3>
                    </div>
                    <div style={{
                        padding: '24px',
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                        gap: '18px 24px'
                    }}>
                        <InfoItem 
                            label="First Name" 
                            value={employee?.firstName} 
                            isEditing={isEditing} 
                            name="firstName" 
                            onChange={onInputChange} 
                        />
                        <InfoItem 
                            label="Last Name" 
                            value={employee?.lastName} 
                            isEditing={isEditing} 
                            name="lastName" 
                            onChange={onInputChange} 
                        />
                        <InfoItem 
                            label="Date of Birth" 
                            value={employee?.dob || employee?.dateOfBirth} 
                            isEditing={isEditing} 
                            name="dateOfBirth" 
                            type="date" 
                            onChange={onInputChange} 
                            icon={<Calendar size={14} />} 
                        />
                        <InfoItem 
                            label="Gender" 
                            value={employee?.gender} 
                            isEditing={isEditing} 
                            name="gender" 
                            type="select" 
                            options={['Male', 'Female', 'Other']} 
                            onChange={onInputChange} 
                        />
                        <InfoItem 
                            label="Marital Status" 
                            value={employee?.maritalStatus} 
                            isEditing={isEditing} 
                            name="maritalStatus" 
                            type="select" 
                            options={['Single', 'Married', 'Divorced', 'Widowed']} 
                            onChange={onInputChange} 
                        />
                        <InfoItem 
                            label="Nationality" 
                            value={employee?.nationality} 
                            isEditing={isEditing} 
                            name="nationality" 
                            type="select"
                            options={[
                                'Indian', 'American', 'British', 'Canadian', 'Australian', 
                                'German', 'French', 'United Arab Emirates', 'Saudi Arabian',
                                'Singaporean', 'Malaysian', 'Japanese', 'Chinese', 'South Korean', 
                                'Italian', 'Spanish', 'Russian', 'Brazilian', 'Mexican', 
                                'South African', 'Nigerian', 'Other'
                            ]}
                            onChange={onInputChange} 
                        />
                        <InfoItem 
                            label="Personal Email" 
                            value={employee?.personalEmail || employee?.email} 
                            isEditing={isEditing} 
                            name="personalEmail" 
                            type="email" 
                            onChange={onInputChange} 
                        />
                        <InfoItem 
                            label="Alt. Phone" 
                            value={employee?.altPhone || employee?.alternatePhone} 
                            isEditing={isEditing} 
                            name="altPhone" 
                            onChange={onInputChange} 
                        />
                    </div>
                </div>

                {/* Address */}
                <div className="card" style={{ width: '100%', flex: 'none', float: 'none', position: 'relative' }}>
                    <div className="card-header">
                        <h3 className="card-title">Current Address</h3>
                    </div>
                    <div style={{ padding: '24px' }}>
                        {isEditing ? (
                            <InfoItem 
                                label="Address" 
                                value={employee?.address || employee?.presentAddressLine1} 
                                isEditing={true} 
                                name="address" 
                                type="textarea" 
                                onChange={onInputChange} 
                                fullWidth 
                            />
                        ) : (
                            employee?.presentAddressLine1 || employee?.address ? (
                                <p style={{ lineHeight: '1.6', color: 'var(--text-secondary)' }}>
                                    {employee?.presentAddressLine1 || employee?.address}
                                    {employee?.presentAddressLine2 && <><br />{employee.presentAddressLine2}</>}
                                    {(employee?.presentCity || employee?.city) && (
                                        <><br />{(employee?.presentCity || employee?.city)}{employee?.presentState || employee?.state ? `, ${employee?.presentState || employee?.state}` : ''}</>
                                    )}
                                    {employee?.presentPostalCode || employee?.zipCode ? (
                                        <><br />{employee?.presentPostalCode || employee?.zipCode}</>
                                    ) : null}
                                    {employee?.presentCountry && <><br />{employee.presentCountry}</>}
                                </p>
                            ) : (
                                <p style={{ lineHeight: '1.6', color: 'var(--text-secondary)' }}>No address provided</p>
                            )
                        )}
                    </div>
                </div>
            </div>

            {/* Emergency Contacts */}
            <div className="card" style={{ marginTop: 16 }}>
                <div className="card-header">
                    <h3 className="card-title">Emergency Contact</h3>
                </div>
                <div style={{
                    padding: '24px',
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '18px 24px'
                }}>
                    <InfoItem 
                        label="Name" 
                        value={employee?.emergencyContact || employee?.emergencyContactName} 
                        isEditing={isEditing} 
                        name="emergencyContact" 
                        onChange={onInputChange} 
                    />
                    <InfoItem 
                        label="Relation" 
                        value={employee?.emergencyContactRelation} 
                        isEditing={isEditing} 
                        name="emergencyContactRelation" 
                        onChange={onInputChange} 
                    />
                    <InfoItem 
                        label="Phone" 
                        value={employee?.emergencyPhone || employee?.emergencyContactPhone} 
                        isEditing={isEditing} 
                        name="emergencyPhone" 
                        onChange={onInputChange} 
                    />
                </div>
            </div>
            
            {/* Bio section if editing */}
            {isEditing && (
                <div className="card" style={{ marginTop: 16 }}>
                    <div className="card-header">
                        <h3 className="card-title">About Me</h3>
                    </div>
                    <div style={{ padding: '24px' }}>
                        <InfoItem 
                            label="Bio" 
                            value={employee?.bio} 
                            isEditing={true} 
                            name="bio" 
                            type="textarea" 
                            onChange={onInputChange} 
                            fullWidth 
                        />
                    </div>
                </div>
            )}
        </div>
    );
}

function JobDetailsTab({ employee }) {
    // Extract role value from employee data
    let roleValue = employee?.employeeRoleName || '';
    if (!roleValue && employee?.role) {
        if (typeof employee.role === 'string') {
            roleValue = employee.role;
        } else if (employee.role.name) {
            roleValue = employee.role.name;
        }
    }
    const displayRole = roleValue || 'N/A';

    return (
        <div className="card">
            <div className="card-header">
                <h3 className="card-title">Employment Details</h3>
            </div>
            <div style={{
                padding: '24px',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                gap: '32px'
            }}>
                <InfoItem label="Employee ID" value={employee?.employeeId || 'N/A'} />
                <InfoItem label="Department" value={employee?.departmentName || employee?.department?.name || employee?.department || 'N/A'} />
                <InfoItem label="Reporting Manager" value={employee?.reportingManagerName || employee?.reportingManager?.name || 'N/A'} />

                <InfoItem label="Designation" value={employee?.position || employee?.positionName || employee?.designation || employee?.jobTitle || employee?.positionTitle || (employee?.position && typeof employee.position === 'object' ? (employee.position?.title || employee.position?.name) : '') || 'N/A'} />
                <InfoItem label="Role" value={displayRole} />
                <InfoItem label="Employment Type" value={employee?.employeeType || 'Full Time'} />

                <InfoItem label="Joining Date" value={employee?.hireDate || employee?.joiningDate || 'N/A'} />
                <InfoItem label="Work Location" value={employee?.locationName || employee?.officeLocation || employee?.workLocation || 'N/A'} />
                <InfoItem label="Probation Status" value={employee?.probationStatus || 'Confirmed'} />
            </div>
        </div>
    );
}

const PROFILE_DOCUMENT_TYPES = [
    { id: 'APPOINTMENT_LETTER', label: 'Appointment Letter' },
    { id: 'SALARY_SLIP', label: 'Salary Slip' },
    { id: 'RELIEVING_LETTER', label: 'Relieving Letter' },
    { id: 'EXPERIENCE_CERTIFICATE', label: 'Experience Certificate' },
    { id: 'AADHAR_CARD', label: 'Aadhaar Card' },
    { id: 'PAN_CARD', label: 'PAN Card' },
    { id: 'PASSPORT', label: 'Passport' },
    { id: 'PASSPORT_SIZE_PHOTO', label: 'Passport Size Photo' },
    { id: 'DRIVING_LICENSE', label: 'Driving License' },
    { id: 'EDUCATIONAL_CERTIFICATE', label: 'Educational Certificate' },
    { id: 'BANK_PASSBOOK', label: 'Bank Passbook' },
    { id: 'ADDRESS_PROOF', label: 'Address Proof' },
    { id: 'OTHER', label: 'Other' },
];

function formatDocumentType(type) {
    if (!type) return '—';
    const found = PROFILE_DOCUMENT_TYPES.find((d) => d.id === type);
    return found ? found.label : String(type).replace(/_/g, ' ');
}

function DocumentsTab({ employeeId, canManage = false }) {
    const [documents, setDocuments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [uploadData, setUploadData] = useState({ type: '', file: null });
    const [uploading, setUploading] = useState(false);

    const fetchDocuments = async () => {
        setLoading(true);
        try {
            const res = employeeId 
                ? await documentAPI.getEmployeeDocuments(employeeId)
                : await documentAPI.getMyDocuments();
            setDocuments(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            console.error('Failed to fetch documents', err);
            toast.error('Failed to load documents.');
            setDocuments([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDocuments();
    }, [employeeId]);

    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            setUploadData((prev) => ({ ...prev, file }));
        }
    };

    const handleUpload = async (e) => {
        e.preventDefault();
        if (!uploadData.type || !uploadData.file) {
            toast.error('Please select document type and file.');
            return;
        }

        setUploading(true);
        try {
            if (employeeId) {
                await documentAPI.uploadEmployeeDocument(employeeId, uploadData.type, uploadData.file);
            } else {
                await documentAPI.uploadDocument(uploadData.type, uploadData.file);
            }
            toast.success('Document uploaded successfully.');
            setShowUploadModal(false);
            setUploadData({ type: '', file: null });
            fetchDocuments();
        } catch (err) {
            toast.error(err.response?.data?.message || err.response?.data?.error || 'Upload failed. Please try again.');
        } finally {
            setUploading(false);
        }
    };

    const handleDownload = async (doc) => {
        try {
            if (doc.fileData) {
                const link = document.createElement('a');
                link.href = `data:${doc.mimeType};base64,${doc.fileData}`;
                link.download = doc.originalFileName;
                link.click();
                return;
            }
            const res = employeeId
                ? await documentAPI.downloadDocument(doc.id)
                : await documentAPI.downloadMyDocument(doc.id);
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', doc.originalFileName);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Download failed', err);
            toast.error('Download failed.');
        }
    };

    const handleDelete = async (docId) => {
        if (!window.confirm('Are you sure you want to delete this document?')) return;
        try {
            if (employeeId) {
                await documentAPI.deleteEmployeeDocument(employeeId, docId);
            } else {
                await documentAPI.deleteMyDocument(docId);
            }
            toast.success('Document deleted.');
            fetchDocuments();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Delete failed.');
        }
    };

    return (
        <div className="card">
            <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                <h3 className="card-title" style={{ margin: 0 }}>Documents</h3>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                        onClick={fetchDocuments}
                        disabled={loading}
                        title="Refresh documents"
                    >
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                        Refresh
                    </button>
                    {canManage && (
                        <button
                            type="button"
                            className="btn btn-primary"
                            style={{ fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                            onClick={() => setShowUploadModal(true)}
                        >
                            <Plus size={14} /> Upload Document
                        </button>
                    )}
                </div>
            </div>
            <div className="employee-table-container">
                <table className="employee-table">
                    <thead>
                        <tr>
                            <th>Document Name</th>
                            <th>Type</th>
                            <th>Status</th>
                            <th>Uploaded Date</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={5} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-secondary)' }}>
                                    <Loader2 size={20} className="animate-spin" style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                                    Loading documents...
                                </td>
                            </tr>
                        ) : documents.length > 0 ? (
                            documents.map((doc) => (
                                <tr key={doc.id}>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <div style={{ padding: '8px', background: '#f1f5f9', borderRadius: '8px' }}>
                                                <FileText size={16} color="var(--primary-color)" />
                                            </div>
                                            <span style={{ fontWeight: 500 }}>{doc.originalFileName}</span>
                                        </div>
                                    </td>
                                    <td>{formatDocumentType(doc.documentType)}</td>
                                    <td>
                                        {doc.isVerified ? (
                                            <span style={{ color: '#16a34a', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                <CheckCircle size={14} /> Verified
                                            </span>
                                        ) : (
                                            <span style={{ color: '#d97706', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                <Clock size={14} /> Pending
                                            </span>
                                        )}
                                    </td>
                                    <td>
                                        {doc.uploadDate
                                            ? new Date(doc.uploadDate).toLocaleDateString('en-US', {
                                                year: 'numeric',
                                                month: 'short',
                                                day: 'numeric',
                                            })
                                            : '—'}
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <button
                                                type="button"
                                                title="Download"
                                                onClick={() => handleDownload(doc)}
                                                style={{ color: 'var(--primary-color)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
                                            >
                                                <Download size={16} />
                                            </button>
                                            {canManage && !doc.isVerified && (
                                                <button
                                                    type="button"
                                                    title="Delete"
                                                    onClick={() => handleDelete(doc.id)}
                                                    style={{ color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={5} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-secondary)' }}>
                                    {canManage
                                        ? 'No documents yet. Click Upload Document to add your first file.'
                                        : 'No documents available.'}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {showUploadModal && canManage && createPortal(
                <div
                    className="hr-modal-overlay"
                    onClick={() => !uploading && setShowUploadModal(false)}
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(15, 23, 42, 0.65)',
                        backdropFilter: 'blur(4px)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 99999,
                        padding: '16px',
                    }}
                >
                    <div
                        className="hr-modal"
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            maxWidth: '480px',
                            width: '100%',
                            background: '#fff',
                            color: '#111827',
                            borderRadius: '12px',
                            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                            overflow: 'hidden',
                            position: 'relative',
                            zIndex: 100000,
                        }}
                    >
                        <div className="hr-modal-header" style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#111827' }}>Upload Document</h2>
                            <button
                                type="button"
                                className="hr-modal-close"
                                onClick={() => !uploading && setShowUploadModal(false)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', padding: '4px' }}
                                aria-label="Close"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleUpload} style={{ padding: '20px' }}>
                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: '#374151' }}>
                                    Document Type
                                </label>
                                <select
                                    value={uploadData.type}
                                    onChange={(e) => setUploadData((prev) => ({ ...prev, type: e.target.value }))}
                                    required
                                    style={{
                                        width: '100%',
                                        padding: '10px 12px',
                                        borderRadius: '8px',
                                        border: '1px solid #d1d5db',
                                        fontSize: '14px',
                                        background: '#fff',
                                        color: '#111827',
                                    }}
                                >
                                    <option value="">Select type</option>
                                    {PROFILE_DOCUMENT_TYPES.map((d) => (
                                        <option key={d.id} value={d.id}>{d.label}</option>
                                    ))}
                                </select>
                            </div>
                            <div style={{ marginBottom: '20px' }}>
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: '#374151' }}>
                                    File
                                </label>
                                <div
                                    style={{
                                        border: '2px dashed #d1d5db',
                                        borderRadius: '8px',
                                        padding: '20px',
                                        textAlign: 'center',
                                        background: uploadData.file ? '#f0fdf4' : '#f9fafb',
                                    }}
                                >
                                    <input
                                        type="file"
                                        accept=".pdf,.jpg,.jpeg,.png"
                                        onChange={handleFileChange}
                                        required={!uploadData.file}
                                        style={{ width: '100%', fontSize: '13px' }}
                                    />
                                    {uploadData.file && (
                                        <p style={{ margin: '10px 0 0', fontSize: '13px', color: '#16a34a', fontWeight: 500 }}>
                                            {uploadData.file.name} ({(uploadData.file.size / 1024).toFixed(1)} KB)
                                        </p>
                                    )}
                                    <p style={{ margin: '8px 0 0', fontSize: '12px', color: '#6b7280' }}>
                                        PDF, JPG, or PNG (max 10MB)
                                    </p>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={() => setShowUploadModal(false)}
                                    disabled={uploading}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="btn btn-primary"
                                    disabled={uploading || !uploadData.type || !uploadData.file}
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                                >
                                    {uploading ? (
                                        <>
                                            <Loader2 size={14} className="animate-spin" /> Uploading...
                                        </>
                                    ) : (
                                        <>
                                            <Upload size={14} /> Upload
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}

function TimelineTab({ employee }) {
    // Build accurate timeline events from real data
    const timelineEvents = [];

    // Format date helper
    const formatDate = (dateString) => {
        if (!dateString) return null;
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
        } catch (e) {
            return dateString;
        }
    };

    // Calculate probation confirmation date
    const calculateProbationEndDate = (hireDate, probationMonths) => {
        if (!hireDate || !probationMonths || probationMonths <= 0) return null;
        try {
            const hire = new Date(hireDate);
            const endDate = new Date(hire);
            endDate.setMonth(endDate.getMonth() + probationMonths);
            return endDate.toISOString().split('T')[0]; // Return YYYY-MM-DD format
        } catch (e) {
            return null;
        }
    };

    // 1. Joined Company event
    if (employee?.hireDate) {
        const designation = employee?.designation || employee?.jobTitle || employee?.positionTitle || 'Employee';
        timelineEvents.push({
            title: 'Joined Company',
            date: employee.hireDate,
            description: `Started as ${designation}`,
            icon: <Award size={16} />
        });
    }

    // 2. Probation Confirmed event (if probation period has ended)
    if (employee?.hireDate && employee?.probationPeriodMonths && employee.probationPeriodMonths > 0) {
        const probationEndDate = calculateProbationEndDate(employee.hireDate, employee.probationPeriodMonths);
        if (probationEndDate) {
            const today = new Date();
            const endDate = new Date(probationEndDate);
            // Only show if probation period has ended
            if (endDate < today) {
                timelineEvents.push({
                    title: 'Probation Confirmed',
                    date: probationEndDate,
                    description: `Successfully completed ${employee.probationPeriodMonths} month${employee.probationPeriodMonths > 1 ? 's' : ''} probation period`,
                    icon: <CheckCircle size={16} />
                });
            }
        }
    }

    // 3. Account Created event (if different from hire date)
    if (employee?.createdAt) {
        const createdDate = new Date(employee.createdAt).toISOString().split('T')[0];
        const hireDate = employee?.hireDate;
        // Only show if created date is significantly different from hire date (more than 1 day)
        if (hireDate && createdDate !== hireDate) {
            const created = new Date(createdDate);
            const hire = new Date(hireDate);
            const diffDays = Math.abs((created - hire) / (1000 * 60 * 60 * 24));
            if (diffDays > 1) {
                timelineEvents.push({
                    title: 'Account Created',
                    date: createdDate,
                    description: 'Employee account was created in the system',
                    icon: <User size={16} />
                });
            }
        }
    }

    // Sort events by date (oldest first - chronological order)
    timelineEvents.sort((a, b) => {
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        return dateA - dateB; // Ascending order (oldest first)
    });

    // If no events, show a message
    if (timelineEvents.length === 0) {
        return (
            <div className="card">
                <div className="card-header">
                    <h3 className="card-title">Career Timeline</h3>
                </div>
                <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    <p>No timeline events available for this employee.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="card">
            <div className="card-header">
                <h3 className="card-title">Career Timeline</h3>
            </div>
            <div style={{ padding: '32px', overflowX: 'auto' }}>
                <div className="timeline" style={{ position: 'relative', paddingLeft: '24px', minWidth: '320px' }}>
                    {/* Vertical Line */}
                    <div style={{ position: 'absolute', left: '7px', top: '0', bottom: '0', width: '2px', background: 'var(--border-color)' }}></div>

                    {timelineEvents.map((evt, idx) => (
                        <div key={idx} style={{ position: 'relative', marginBottom: '40px', paddingLeft: '24px' }}>
                            {/* Dot */}
                            <div style={{
                                position: 'absolute',
                                left: '-16px',
                                top: '0',
                                width: '32px',
                                height: '32px',
                                borderRadius: '50%',
                                background: 'white',
                                border: '2px solid var(--primary-color)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'var(--primary-color)',
                                zIndex: 2
                            }}>
                                {evt.icon}
                            </div>

                            <div>
                                <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--primary-color)', background: 'var(--primary-light)', padding: '4px 8px', borderRadius: '4px' }}>
                                    {formatDate(evt.date) || evt.date}
                                </span>
                                <h4 style={{ fontSize: '16px', fontWeight: 'bold', margin: '8px 0 4px 0' }}>{evt.title}</h4>
                                <p style={{ color: 'var(--text-secondary)' }}>{evt.description}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

function HierarchyTab({ hierarchy }) {
    if (!hierarchy) {
        return (
            <div className="card">
                <div className="card-header">
                    <h3 className="card-title">Reporting Structure</h3>
                </div>
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--gray-500)' }}>
                    <Info size={32} style={{ marginBottom: '16px', opacity: 0.6 }} />
                    <p style={{ fontSize: '16px', fontWeight: 500 }}>Loading hierarchy data...</p>
                    <p style={{ fontSize: '14px', marginTop: '8px' }}>Please wait while we fetch your reporting structure.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="card">
            <div className="card-header">
                <h3 className="card-title">Reporting Structure</h3>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px', fontWeight: 'normal' }}>
                    Showing immediate manager and direct reportees
                </p>
            </div>
            <div style={{ padding: '0' }}>
                <OrgChart hierarchyData={hierarchy} />
            </div>
        </div>
    );
}



function InfoItem({ label, value, icon, fullWidth, isEditing, name, type = 'text', options = [], onChange }) {
    return (
        <div style={{ gridColumn: fullWidth ? '1 / -1' : 'auto' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                {icon} {label}
            </label>
            {isEditing ? (
                type === 'select' ? (
                    <select
                        name={name}
                        value={value || ''}
                        onChange={onChange}
                        className="form-control"
                        style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--border-color)' }}
                    >
                        <option value="">Select {label}</option>
                        {options.map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                        ))}
                    </select>
                ) : type === 'textarea' ? (
                    <textarea
                        name={name}
                        value={value || ''}
                        onChange={onChange}
                        className="form-control"
                        rows={3}
                        style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--border-color)', resize: 'vertical' }}
                    />
                ) : (
                    <input
                        type={type}
                        name={name}
                        value={value || ''}
                        onChange={onChange}
                        onClick={(e) => {
                            if (type === 'date' && e.target.showPicker) {
                                e.target.showPicker();
                            }
                        }}
                        className="form-control"
                        style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--border-color)' }}
                    />
                )
            ) : (
                <div style={{ fontSize: '15px', color: 'var(--text-primary)', fontWeight: '500', minHeight: '22px' }}>
                    {value || '-'}
                </div>
            )}
        </div>
    );
}
