import React, { useState, useEffect } from 'react';
import {
    Building, Briefcase, Clock, Calendar, Settings,
    Plus, Edit2, Trash2, CheckCircle, XCircle,
    ToggleLeft, ToggleRight, Save, X, AlertCircle,
    MapPin, BadgeCheck, UserCog, Users, Home, LogOut,
    ShieldCheck, Lock, Mail
} from 'lucide-react';
import { adminAPI, locationsAPI, featuresAPI } from '../services/api';
import { toast } from 'react-hot-toast';
import Header from '../components/Header';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';

const LEAVE_TYPE_CODE_LABELS = {
    AL: 'Annual Leave',
    SL: 'Sick Leave',
    PL: 'Personal Leave',
    ML: 'Maternity Leave',
    PTL: 'Paternity Leave',
    BL: 'Bereavement Leave',
    CL: 'Casual Leave',
    CML: 'Compassionate Leave',
    STL: 'Study Leave',
    TRL: 'Training Leave',
    UL: 'Unpaid Leave',
    CO: 'Compensatory Off',
    FL: 'Festival Leave',
    BDL: 'Birthday Leave',
    ANL: 'Anniversary Leave',
};

const FEATURE_GROUPS = [
  {
    title: "People & Org",
    description: "Manage employees, org structures, reporting managers, tasks, and assets.",
    features: [
      { key: "EMPLOYEE_MANAGEMENT", label: "Employee Management", subFeatures: ["All Employees", "Reporting Management", "Exit Management"] },
      { key: "ORGANIZATION", label: "My Org", subFeatures: ["Org Members", "Organization Setup"] },
      { key: "PROJECT_MANAGEMENT", label: "Project Management", subFeatures: ["Project Management", "Planner Board"] },
      { key: "WORK_STATUS", label: "Work Status", subFeatures: ["Work Status Tracking"] },
      { key: "DOCUMENTS", label: "Documents", subFeatures: ["Document Management"] },
      { key: "ASSETS", label: "Assets", subFeatures: ["Asset Handover", "Asset Management"] }
    ]
  },
  {
    title: "Workforce",
    description: "Manage time sheets, clock-in rules, leaves, WFH requests, and expense claims.",
    features: [
      { key: "ATTENDANCE", label: "Attendance & Timesheets", subFeatures: ["Attendance Tracking", "Time Clock"] },
      { key: "TIMESHEETS", label: "Timesheets", subFeatures: ["Timesheet Approvals"] },
      { key: "LEAVE_MANAGEMENT", label: "Leaves", subFeatures: ["Leaves & Approvals", "Leave Adjustments", "Leave Analytics"] },
      { key: "WFH", label: "Work From Home", subFeatures: ["WFH Requests & Approvals"] },
      { key: "EXPENSES", label: "Expenses", subFeatures: ["Expense Approvals & Claims"] },
      { key: "HOLIDAYS", label: "Holidays", subFeatures: ["Holiday Calendar"] }
    ]
  },
  {
    title: "Culture",
    description: "Keep the workforce engaged with notice boards, complaints, and wellness features.",
    features: [
      { key: "NOTICES", label: "Notice Board", subFeatures: ["Notice Board", "Notifications"] },
      { key: "COMPLAINTS", label: "Complaints", subFeatures: ["Complaints & Feedback"] },
      { key: "ACHIEVEMENTS", label: "Achievements & Employee of Quarter", subFeatures: ["Achievements", "Employee of the Quarter"] },
      { key: "GAMES", label: "Fun & Wellness", subFeatures: ["Games & Wellness"] }
    ]
  },
  {
    title: "Manage Account",
    description: "Organization settings, security policies, location configurations, and role permissions.",
    features: [
      { key: "SETTINGS", label: "System Settings", subFeatures: ["Users", "Location Settings", "Roles & Permissions", "System Settings"] },
      { key: "BILLING", label: "Billing & Subscription", subFeatures: ["Manage Plans", "Billing Details"] },
      { key: "WORKFLOWS", label: "Workflow Management", subFeatures: ["Custom Approval Workflows"] }
    ]
  },
  {
    title: "Analytics",
    description: "Detailed reports on workforce, leaves, and attendance.",
    features: [
      { key: "REPORTS", label: "Analytics Reports", subFeatures: ["Leave Report", "Attendance Report", "Timesheet Report"] }
    ]
  },
  {
    title: "Core & Performance",
    description: "Essential modules for salary, training, and reviews.",
    features: [
      { key: "PAYROLL", label: "Payroll Management", subFeatures: ["Payroll", "Payslips", "Payroll Sync"] },
      { key: "QUIZ", label: "Quiz & Training", subFeatures: ["Quiz & Training Modules"] },
      { key: "PMS", label: "Performance Management", subFeatures: ["PMS (Reviews & Ratings)"] }
    ]
  }
];

export default function AdminSettings() {
    const { theme } = useTheme();
    const { getCurrentUser } = useAuth();
    const [activeTab, setActiveTab] = useState('shifts');
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Data States
    const [shifts, setShifts] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [positions, setPositions] = useState([]);
    const [leaveTypes, setLeaveTypes] = useState([]);
    const [availableLeaveTypeCodes, setAvailableLeaveTypeCodes] = useState([]);
    const [locations, setLocations] = useState([]);
    const [locationEmployees, setLocationEmployees] = useState({}); // Map of locationId -> employees
    const [showLocationUsersModal, setShowLocationUsersModal] = useState(false);
    const [selectedLocationUsers, setSelectedLocationUsers] = useState([]);
    const [selectedLocationForUsers, setSelectedLocationForUsers] = useState(null);
    const [managerLimits, setManagerLimits] = useState({});
    const [empIdFormat, setEmpIdFormat] = useState({
        prefix: '',
        nextNumber: 1,
        numberFormat: '%03d',
        locationBased: false,
        digitConfig: 3,
        nextEmployeeIdExample: '',
    });
    const [empIdFormatError, setEmpIdFormatError] = useState('');
    const [weekendConfig, setWeekendConfig] = useState({
        monday: false,
        tuesday: false,
        wednesday: false,
        thursday: false,
        friday: false,
        saturday: true,
        sunday: true,
    });
    const [wfhPolicy, setWfhPolicy] = useState({
        maxDaysPerWeek: null,
        maxDaysPerMonth: null,
        allowWeekends: false,
        allowHolidays: false,
        allowPastDates: false,
    });
    const [noticePeriodDays, setNoticePeriodDays] = useState(30);
    const [noticePeriodConfigs, setNoticePeriodConfigs] = useState([]);
    const [twoFactorEnabled, setTwoFactorEnabled] = useState(true);
    const [allFeatures, setAllFeatures] = useState({});
    const [planFeatures, setPlanFeatures] = useState([]);
    const [enabledFeatures, setEnabledFeatures] = useState(new Set());
    const [approvalCcConfig, setApprovalCcConfig] = useState({
        enabled: false,
        recipientTarget: 'DEPARTMENT_HR',
        customEmails: '',
    });

    // Dialog States
    const [showShiftModal, setShowShiftModal] = useState(false);
    const [showDeptModal, setShowDeptModal] = useState(false);
    const [showPosModal, setShowPosModal] = useState(false);
    const [showLeaveTypeModal, setShowLeaveTypeModal] = useState(false);
    const [showLocationModal, setShowLocationModal] = useState(false);

    // Selection/Editing States
    const [selectedItem, setSelectedItem] = useState(null);
    const [formData, setFormData] = useState({});
    const [originalFormData, setOriginalFormData] = useState({});
    const [selectedLeaveTemplate, setSelectedLeaveTemplate] = useState('');

    const fetchShifts = async () => {
        try {
            const res = await adminAPI.getAllShifts();
            setShifts(Array.isArray(res.data) ? [...res.data].sort((a, b) => a.id - b.id) : []);
        } catch (e) { }
    };
    const fetchDepartments = async () => {
        try {
            const res = await adminAPI.getAllDepartments();
            setDepartments(Array.isArray(res.data) ? [...res.data].sort((a, b) => a.id - b.id) : []);
        } catch (e) { }
    };
    const fetchPositions = async () => {
        try {
            const res = await adminAPI.getAllPositions();
            setPositions(Array.isArray(res.data) ? [...res.data].sort((a, b) => a.id - b.id) : []);
        } catch (e) { }
    };
    const fetchLeaveTypes = async () => {
        try {
            const res = await adminAPI.getAllLeaveTypes();
            setLeaveTypes(Array.isArray(res.data) ? [...res.data].sort((a, b) => a.id - b.id) : []);
        } catch (e) { }
    };
    const fetchAvailableLeaveTypeCodes = async () => {
        try {
            const res = await adminAPI.getAvailableLeaveTypeCodes();
            setAvailableLeaveTypeCodes(Array.isArray(res.data) ? res.data : []);
        } catch (e) {
            console.error('Error fetching available leave type codes:', e);
        }
    };
    const fetchLocations = async () => {
        try {
            const res = await locationsAPI.list(0, 100);
            const locationsList = Array.isArray(res.data?.items) ? [...res.data.items].sort((a, b) => a.id - b.id) : [];
            setLocations(locationsList);

            // Fetch employees for each location
            await fetchEmployeesByLocations(locationsList);
        } catch (e) {
            console.error('Error fetching locations:', e);
        }
    };

    const fetchEmployeesByLocations = async (locationsList) => {
        try {
            // Fetch all employees
            const employeesRes = await adminAPI.getAllEmployees();
            let allEmployees = [];
            if (employeesRes.data?.employees && Array.isArray(employeesRes.data.employees)) {
                allEmployees = employeesRes.data.employees;
            } else if (Array.isArray(employeesRes.data)) {
                allEmployees = employeesRes.data;
            }

            // Group employees by location
            const employeesByLocation = {};
            locationsList.forEach(loc => {
                employeesByLocation[loc.id] = allEmployees.filter(emp =>
                    emp.locationId === loc.id ||
                    emp.location?.id === loc.id ||
                    (emp.location && typeof emp.location === 'object' && emp.location.id === loc.id)
                );
            });

            setLocationEmployees(employeesByLocation);
        } catch (e) {
            console.error('Error fetching employees by location:', e);
        }
    };
    const fetchManagerLimits = async () => {
        try {
            const res = await adminAPI.getManagerLeaveLimits();
            setManagerLimits(res.data || {});
        } catch (e) { }
    }
    const fetchEmpIdFormat = async () => {
        try {
            const res = await adminAPI.getEmployeeIdFormat();
            const data = res.data || {};
            setEmpIdFormat({
                prefix: data.prefix || 'EMP',
                nextNumber: data.nextNumber || 1,
                numberFormat: data.numberFormat || '%03d',
                locationBased: !!data.locationBased,
                digitConfig: data.digitConfig || 3,
                nextEmployeeIdExample: data.nextEmployeeIdExample || '',
            });
        } catch (e) { }
    }

    const fetchWeekendConfig = async () => {
        try {
            const res = await adminAPI.getWeekendConfig();
            const data = res.data || res || {};
            setWeekendConfig({
                monday: data.monday ?? false,
                tuesday: data.tuesday ?? false,
                wednesday: data.wednesday ?? false,
                thursday: data.thursday ?? false,
                friday: data.friday ?? false,
                saturday: data.saturday ?? true,
                sunday: data.sunday ?? true,
            });
        } catch (e) { }
    };

    const fetchWfhPolicy = async () => {
        try {
            const res = await adminAPI.getWfhPolicyConfig();
            const data = res.data || {};
            setWfhPolicy({
                maxDaysPerWeek: data.maxDaysPerWeek ?? null,
                maxDaysPerMonth: data.maxDaysPerMonth ?? null,
                allowWeekends: data.allowWeekends ?? false,
                allowHolidays: data.allowHolidays ?? false,
                allowPastDates: data.allowPastDates ?? false,
            });
        } catch (e) {
            console.error('Error fetching WFH policy:', e);
        }
    };

    const fetchNoticePeriodConfig = async () => {
        try {
            const res = await adminAPI.getNoticePeriodConfig();
            const configs = Array.isArray(res.data) ? res.data : [];
            setNoticePeriodConfigs(configs);
            const defaultCfg = configs.find(c => !c.position && !c.department);
            if (defaultCfg) {
                setNoticePeriodDays(defaultCfg.noticePeriodDays ?? 30);
            }
        } catch (e) {
            console.error('Error fetching notice period config:', e);
        }
    };
    
    const fetchTwoFactorConfig = async () => {
        try {
            const res = await adminAPI.getTwoFactorConfig();
            setTwoFactorEnabled(res.data?.twoFactorEnabled ?? true);
        } catch (e) {
            console.error('Error fetching 2FA config:', e);
        }
    };

    const fetchApprovalCcConfig = async () => {
        try {
            const res = await adminAPI.getManagerApprovalCcConfig();
            if (res.data) {
                setApprovalCcConfig({
                    enabled: !!res.data.enabled,
                    recipientTarget: res.data.recipientTarget || 'DEPARTMENT_HR',
                    customEmails: res.data.customEmails || '',
                });
            }
        } catch (e) {
            console.error('Error fetching Approval CC Config:', e);
        }
    };

    const handleApprovalCcSave = async () => {
        if (approvalCcConfig.enabled) {
            const targets = (approvalCcConfig.recipientTarget || '')
                .split(',')
                .map(s => s.trim())
                .filter(Boolean);
            const customEmailsRaw = (approvalCcConfig.customEmails || '').trim();

            if (targets.length === 0 && !customEmailsRaw) {
                toast.error('Please select at least one CC recipient strategy or enter custom email addresses when notifications are enabled');
                return;
            }

            if (customEmailsRaw) {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                const emailList = customEmailsRaw.split(/[,;\s]+/).map(s => s.trim()).filter(Boolean);
                const invalidEmails = emailList.filter(email => !emailRegex.test(email));
                if (invalidEmails.length > 0) {
                    toast.error(`Invalid email format: ${invalidEmails.join(', ')}`);
                    return;
                }
            }
        }

        setSubmitting(true);
        try {
            await adminAPI.updateManagerApprovalCcConfig(approvalCcConfig);
            toast.success('Manager approval CC notification settings saved successfully');
        } catch (e) {
            toast.error(e.response?.data?.message || 'Failed to save manager approval CC settings');
        } finally {
            setSubmitting(false);
        }
    };

    const fetchFeaturesData = async () => {
        try {
            const [allRes, accessRes] = await Promise.all([
                featuresAPI.getAllFeatures(),
                featuresAPI.getAccessInfo()
            ]);
            
            setAllFeatures(allRes.data || {});
            
            // Available features in current plan
            const available = accessRes.data?.availableFeatures || [];
            const restricted = accessRes.data?.restrictedFeatures || [];
            
            // Total features that *could* be enabled (all in plan + any already enabled)
            const combined = accessRes.data?.planFeatures || [...new Set([...available, ...restricted])];
            setPlanFeatures(combined.sort());
            
            // Currently enabled features (intersection of plan and tenant settings)
            setEnabledFeatures(new Set(available));
        } catch (e) {
            console.error('Error fetching features data:', e);
        }
    };

    const handleTwoFactorSave = async () => {
        setSubmitting(true);
        try {
            await adminAPI.updateTwoFactorConfig({ twoFactorEnabled });
            toast.success('Security settings saved successfully');
        } catch (e) {
            toast.error('Failed to save security settings');
        } finally {
            setSubmitting(false);
        }
    };

    const fetchAllData = async () => {
        setLoading(true);
        try {
            await Promise.all([
                fetchShifts(),
                fetchDepartments(),
                fetchPositions(),
                fetchLeaveTypes(),
                fetchAvailableLeaveTypeCodes(),
                fetchLocations(),
                fetchManagerLimits(),
                fetchEmpIdFormat(),
                fetchWeekendConfig(),
                fetchWfhPolicy(),
                fetchNoticePeriodConfig(),
                fetchTwoFactorConfig(),
                fetchApprovalCcConfig(),
                fetchFeaturesData(),
            ]);
        } catch (error) {
            console.error('Error fetching settings data:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAllData();
    }, []);

    // --- Handlers ---

    const handleShiftSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            if (selectedItem) {
                await adminAPI.updateShift(selectedItem.id, formData);
            } else {
                await adminAPI.createShift(formData);
            }
            setShowShiftModal(false);
            fetchShifts();
        } catch (e) { alert('Failed to save shift'); }
        finally { setSubmitting(false); }
    };

    const handleDeptSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            if (selectedItem) {
                await adminAPI.updateDepartment(selectedItem.id, formData);
            } else {
                await adminAPI.createDepartment(formData);
            }
            setShowDeptModal(false);
            fetchDepartments();
        } catch (e) { alert('Failed to save department'); }
        finally { setSubmitting(false); }
    };

    const handlePosSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            if (selectedItem) {
                await adminAPI.updatePosition(selectedItem.id, formData);
            } else {
                await adminAPI.createPosition(formData);
            }
            setShowPosModal(false);
            fetchPositions();
        } catch (e) { alert('Failed to save position'); }
        finally { setSubmitting(false); }
    };

    const buildLeaveTypePayload = (data) => ({
        leaveTypeName: (data.leaveTypeName || '').trim(),
        leaveTypeCode: (data.leaveTypeCode || '').trim().toUpperCase(),
        description: data.description || '',
        defaultLeaveCount: Number.isFinite(Number(data.defaultLeaveCount)) ? Number(data.defaultLeaveCount) : 0,
        allowCarryforward: !!data.allowCarryforward,
        maxCarryforwardLimit: data.maxCarryforwardLimit ?? null,
        isActive: data.isActive ?? data.active ?? true,
        colorCode: data.colorCode || '#4F46E5',
        requiresApproval: data.requiresApproval !== false,
        maxContinuousDays: data.maxContinuousDays ?? null,
        requiresDocument: !!data.requiresDocument,
        restrictDuringProbation: !!data.restrictDuringProbation,
        probationAllocation: data.probationAllocation ?? null,
        allowedGenders: data.allowedGenders?.trim() || null,
        prorate: !!data.prorate,
        roundingRule: data.prorate ? (data.roundingRule || 'ROUND_UP') : null,
        positionAllocations: (data.positionAllocations || [])
            .filter((row) => row.positionId && row.annualAllocation != null)
            .map((row) => ({
                positionId: Number(row.positionId),
                annualAllocation: Number(row.annualAllocation),
            })),
    });

    const handleLeaveTypeSubmit = async (e) => {
        e.preventDefault();
        const payload = buildLeaveTypePayload(formData);
        if (!payload.leaveTypeName) {
            toast.error('Leave type name is required');
            return;
        }
        if (!payload.leaveTypeCode) {
            toast.error('Leave type code is required');
            return;
        }
        if (payload.defaultLeaveCount < 0) {
            toast.error('Annual allocation cannot be negative');
            return;
        }
        setSubmitting(true);
        try {
            const actor = getCurrentUser()?.employeeId || getCurrentUser()?.email || 'admin';
            if (selectedItem) {
                await adminAPI.updateLeaveType(selectedItem.id, payload, actor);
                toast.success('Leave type updated');
            } else {
                await adminAPI.createLeaveType(payload, actor);
                toast.success('Leave type created');
            }
            setShowLeaveTypeModal(false);
            fetchLeaveTypes();
            fetchAvailableLeaveTypeCodes();
        } catch (err) {
            const apiMsg = err.response?.data;
            const message = typeof apiMsg === 'string'
                ? apiMsg
                : apiMsg?.message || err.message || 'Failed to save leave type';
            toast.error(message);
        } finally { setSubmitting(false); }
    }

    const handleEmpIdSave = async () => {
        setEmpIdFormatError('');
        setSubmitting(true);
        try {
            const payload = {
                prefix: (empIdFormat.prefix || 'EMP').toUpperCase(),
                nextNumber: parseInt(empIdFormat.nextNumber || 1, 10),
                numberFormat: empIdFormat.numberFormat || '%03d',
                locationBased: !!empIdFormat.locationBased,
                digitConfig: parseInt(empIdFormat.digitConfig) || 3,
            };
            const res = await adminAPI.updateEmployeeIdFormat(payload);
            const data = res.data?.data || payload;
            setEmpIdFormat(prev => ({
                ...prev,
                ...data,
                nextEmployeeIdExample: data.nextEmployeeIdExample || prev.nextEmployeeIdExample,
            }));
            setEmpIdFormatError('');
            alert('Employee ID format saved');
        } catch (e) {
            let msg = 'Failed to save format';
            if (e?.response?.data?.message) {
                msg = e.response.data.message;
            } else if (e?.message) {
                msg = e.message;
            }
            setEmpIdFormatError(msg);
        } finally {
            setSubmitting(false);
        }
    }

    const handleWeekendSave = async () => {
        setSubmitting(true);
        try {
            await adminAPI.updateWeekendConfig(weekendConfig);
            alert('Weekend settings saved');
        } catch (e) {
            alert('Failed to save weekend settings');
        } finally {
            setSubmitting(false);
        }
    };

    const handleManagerLimitsSave = async () => {
        setSubmitting(true);
        try {
            await adminAPI.updateManagerLeaveLimits(managerLimits);
            alert('Limits saved');
        } catch (e) { alert('Failed to save limits'); }
        finally { setSubmitting(false); }
    }

    const handleWfhPolicySave = async () => {
        setSubmitting(true);
        try {
            await adminAPI.updateWfhPolicyConfig({
                maxDaysPerWeek: wfhPolicy.maxDaysPerWeek,
                maxDaysPerMonth: wfhPolicy.maxDaysPerMonth,
                allowWeekends: wfhPolicy.allowWeekends,
                allowHolidays: wfhPolicy.allowHolidays,
                allowPastDates: wfhPolicy.allowPastDates,
            });
            toast.success('WFH policy saved successfully');
        } catch (e) {
            toast.error('Failed to save WFH policy');
        } finally {
            setSubmitting(false);
        }
    };

    const handleNoticePeriodSave = async () => {
        setSubmitting(true);
        try {
            await adminAPI.setDefaultNoticePeriod(noticePeriodDays);
            toast.success('Notice period saved successfully');
            fetchNoticePeriodConfig();
        } catch (e) {
            toast.error('Failed to save notice period');
        } finally {
            setSubmitting(false);
        }
    };

    const handleFeatureToggle = (featureKey) => {
        // Prevent disabling essential features
        if (['DASHBOARD', 'SETTINGS', 'ORGANIZATION'].includes(featureKey)) return;
        
        setEnabledFeatures(prev => {
            const next = new Set(prev);
            if (next.has(featureKey)) {
                next.delete(featureKey);
            } else {
                next.add(featureKey);
            }
            return next;
        });
    };

    const handleFeaturesSave = async () => {
        setSubmitting(true);
        try {
            await featuresAPI.updateFeatures(Array.from(enabledFeatures));
            toast.success('Feature settings updated successfully. Employees will see these changes on their next refresh.');
            fetchFeaturesData();
        } catch (e) {
            toast.error('Failed to update features');
        } finally {
            setSubmitting(false);
        }
    };

    // --- Modals Open/Close ---

    const openShiftModal = (shift = null) => {
        setSelectedItem(shift);
        setFormData(shift || { shiftName: '', shiftType: 'MORNING', startTime: '09:00', endTime: '18:00', description: '' });
        setShowShiftModal(true);
    }

    const openDeptModal = (dept = null) => {
        setSelectedItem(dept);
        setFormData(dept || { name: '', description: '', isActive: true });
        setShowDeptModal(true);
    }

    const openPosModal = (pos = null) => {
        setSelectedItem(pos);
        setFormData(pos || { title: '', description: '', probationPeriodMonths: 0, isActive: true });
        setShowPosModal(true);
    }

    const openLeaveTypeModal = (lt = null) => {
        setSelectedItem(lt);
        setSelectedLeaveTemplate('');
        const initialData = lt ? {
            ...lt,
            isActive: lt.isActive ?? lt.active ?? true,
            positionAllocations: lt.positionAllocations || [],
            allowedGenders: lt.allowedGenders || '',
            prorate: lt.prorate ?? false,
            roundingRule: lt.roundingRule ?? 'ROUND_UP',
        } : {
            leaveTypeName: '', leaveTypeCode: '', description: '',
            defaultLeaveCount: 0, allowCarryforward: false, maxCarryforwardLimit: null,
            requiresApproval: true, maxContinuousDays: null, requiresDocument: false,
            restrictDuringProbation: false, probationAllocation: null, allowedGenders: '',
            positionAllocations: [],
            prorate: false, roundingRule: 'ROUND_UP',
            colorCode: '#4F46E5', isActive: true
        };
        setFormData(initialData);
        setOriginalFormData(initialData);
        setShowLeaveTypeModal(true);
    }

    const openLocationModal = (loc = null) => {
        setSelectedItem(loc);
        setFormData(loc || {
            locationName: '',
            locationCode: '',
            address: '',
            contactPerson: '',
            shiftTiming: '',
            timezone: 'Asia/Kolkata'
        });
        setShowLocationModal(true);
    }

    const handleLocationSave = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            if (selectedItem) {
                await locationsAPI.update(selectedItem.id, formData);
                toast.success('Location updated successfully');
            } else {
                await locationsAPI.create(formData);
                toast.success('Location created successfully');
            }
            setShowLocationModal(false);
            fetchLocations();
        } catch (error) {
            console.error('Error saving location:', error);
            toast.error(error.response?.data?.message || 'Failed to save location');
        } finally {
            setSubmitting(false);
        }
    }

    const handleDeleteLocation = async (id) => {
        if (!window.confirm('Are you sure you want to delete this location?')) return;
        try {
            await locationsAPI.remove(id);
            toast.success('Location deleted successfully');
            fetchLocations();
        } catch (error) {
            console.error('Error deleting location:', error);
            const errorMessage = error.response?.data?.message || error.message || '';
            if (errorMessage.includes('foreign key') || errorMessage.includes('constraint') || error.response?.status === 400) {
                toast.error('Cannot delete location: It is currently assigned to one or more employees. Please reassign those employees to another location first.');
            } else {
                toast.error(errorMessage || 'Failed to delete location');
            }
        }
    }

    // Helper to compute next ID preview
    function getNextIdPreview() {
        const prefix = (empIdFormat.prefix || 'EMP').toUpperCase();
        const nextNumber = empIdFormat.nextNumber || 1;
        const digits = empIdFormat.digitConfig || 3;
        const numberPart = String(nextNumber).padStart(digits, '0');
        let loc = '';
        if (empIdFormat.locationBased) {
            loc = 'NY'; // Example location code, replace with actual if available
        }
        return `${prefix}${loc}${numberPart}`;
    }
    const hasLeaveTypeChanges = () => {
        if (!originalFormData) return false;
        const fields = [
            'leaveTypeName', 'leaveTypeCode', 'description', 'defaultLeaveCount',
            'allowCarryforward', 'maxCarryforwardLimit', 'requiresApproval',
            'maxContinuousDays', 'requiresDocument', 'restrictDuringProbation',
            'probationAllocation', 'allowedGenders', 'prorate', 'roundingRule',
            'colorCode', 'active'
        ];
        for (const f of fields) {
            if (formData[f] !== originalFormData[f]) return true;
        }
        const pos1 = formData.positionAllocations || [];
        const pos2 = originalFormData.positionAllocations || [];
        if (pos1.length !== pos2.length) return true;
        for (let i = 0; i < pos1.length; i++) {
            if (pos1[i].positionId !== pos2[i].positionId || 
                pos1[i].annualAllocation !== pos2[i].annualAllocation) {
                return true;
            }
        }
        return false;
    };

    return (
        <div className="main-content">
            <Header title="System Settings" subtitle="Configure Shifts, Departments, and Policies" />

            <div className="page-content" style={{ display: 'flex', gap: '24px', height: 'calc(100vh - 80px)', overflow: 'hidden' }}>
                {/* Local Sidebar */}
                <aside style={{
                    width: '240px',
                    minWidth: '240px',
                    background: 'var(--white-5)',
                    borderRadius: '12px',
                    border: '1px solid var(--gray-10)',
                    padding: '16px 8px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px'
                }}>
                    <div style={{ padding: '0 12px 12px', marginBottom: '8px', borderBottom: '1px solid var(--gray-10)' }}>
                        <h3 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--dark-500)' }}>Configuration</h3>
                        <p style={{ fontSize: '11px', color: 'var(--gray-500)' }}>Manage system settings</p>
                    </div>

                    <nav className="sidebar-nav" style={{ flex: 'none' }}>
                        {[
                            { id: 'shifts', label: 'Shifts', icon: Clock },
                            { id: 'departments', label: 'Departments', icon: Building },
                            { id: 'positions', label: 'Positions', icon: Briefcase },
                            { id: 'locations', label: 'Locations', icon: MapPin },
                            { id: 'weekends', label: 'Weekends', icon: Calendar },
                            { id: 'leavetypes', label: 'Leave Types', icon: Calendar },
                            { id: 'limits', label: 'Manager Limits', icon: UserCog },
                            { id: 'empid', label: 'Emp ID Format', icon: BadgeCheck },
                            { id: 'wfhpolicy', label: 'WFH Policy', icon: Home },
                            { id: 'noticeperiod', label: 'Notice Period', icon: LogOut },
                            { id: 'approvalcc', label: 'Approval Email CC', icon: Mail },
                            { id: 'security', label: 'Security', icon: ShieldCheck },
                            { id: 'features', label: 'Feature Toggles', icon: ShieldCheck },
                        ].map(tab => (
                            <button
                                key={tab.id}
                                className={`sidebar-nav-item ${activeTab === tab.id ? 'active' : ''}`}
                                onClick={() => setActiveTab(tab.id)}
                                style={{
                                    width: '100%',
                                    justifyContent: 'flex-start',
                                    border: 'none',
                                    background: activeTab === tab.id ? 'var(--primary-10)' : 'transparent',
                                    color: activeTab === tab.id ? 'var(--primary-600)' : 'var(--dark-80)'
                                }}
                            >
                                <span className="sidebar-nav-icon">
                                    <tab.icon size={16} />
                                </span>
                                <span>{tab.label}</span>
                            </button>
                        ))}
                    </nav>
                </aside>

                {/* Content Area */}
                <div className="settings-content" style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }}>

                    {/* SHIFTS TAB */}
                    {activeTab === 'shifts' && (
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                                <h3>Shift Configurations</h3>
                                <button className="add-employee-btn" onClick={() => openShiftModal()}>
                                    <Plus size={16} /> Add Shift
                                </button>
                            </div>
                            <div className="employee-table-container">
                                <table className="employee-table">
                                    <thead>
                                        <tr>
                                            <th>Shift Name</th>
                                            <th>Type</th>
                                            <th>Time</th>
                                            <th>Description</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {shifts.map(shift => (
                                            <tr key={shift.id}>
                                                <td>{shift.shiftName}</td>
                                                <td><span className="status-badge pending">{shift.shiftType}</span></td>
                                                <td>{shift.startTime} - {shift.endTime}</td>
                                                <td>{shift.description}</td>
                                                <td>
                                                    <div style={{ display: 'flex', gap: '8px' }}>
                                                        <button
                                                            onClick={() => openShiftModal(shift)}
                                                            style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--primary-color)' }}
                                                            title="Edit"
                                                        >
                                                            <Edit2 size={16} />
                                                        </button>
                                                        <button
                                                            onClick={async () => { if (window.confirm('Delete?')) { await adminAPI.deleteShift(shift.id); fetchShifts(); } }}
                                                            style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#ef4444' }}
                                                            title="Delete"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* DEPARTMENTS TAB */}
                    {activeTab === 'departments' && (
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                                <h3>Department Management</h3>
                                <button className="add-employee-btn" onClick={() => openDeptModal()}>
                                    <Plus size={16} /> Add Department
                                </button>
                            </div>
                            <div className="employee-table-container">
                                <table className="employee-table">
                                    <thead>
                                        <tr>
                                            <th>Name</th>
                                            <th>Description</th>
                                            <th>Status</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {departments.map(dept => (
                                            <tr key={dept.id}>
                                                <td>{dept.name}</td>
                                                <td>{dept.description}</td>
                                                <td>
                                                    <span className={`status-badge ${dept.isActive ? 'approved' : 'rejected'}`}>
                                                        {dept.isActive ? 'Active' : 'Inactive'}
                                                    </span>
                                                </td>
                                                <td>
                                                    <div style={{ display: 'flex', gap: '8px' }}>
                                                        <button
                                                            onClick={() => openDeptModal(dept)}
                                                            style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--primary-color)' }}
                                                            title="Edit"
                                                        >
                                                            <Edit2 size={16} />
                                                        </button>
                                                        <button
                                                            onClick={async () => { await adminAPI.toggleDepartmentStatus(dept.id); fetchDepartments(); }}
                                                            style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
                                                            title="Toggle Status"
                                                        >
                                                            {dept.isActive ? <ToggleRight size={16} color="#10b981" /> : <ToggleLeft size={16} />}
                                                        </button>
                                                        <button
                                                            onClick={async () => { if (window.confirm('Delete?')) { await adminAPI.deleteDepartment(dept.id); fetchDepartments(); } }}
                                                            style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#ef4444' }}
                                                            title="Delete"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* WEEKENDS TAB */}
                    {activeTab === 'weekends' && (
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                                <h3>Weekend Settings</h3>
                                <button className="add-employee-btn" onClick={handleWeekendSave} disabled={submitting}>
                                    <Save size={16} /> Save Weekends
                                </button>
                            </div>
                            <p style={{ fontSize: '13px', color: 'var(--gray-600)', marginBottom: '12px' }}>
                                Choose which days are considered weekends for your organization. These days will be
                                excluded from regular working and leave calculations.
                            </p>
                            <div
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                                    gap: '8px',
                                    maxWidth: '420px',
                                }}
                            >
                                {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map(
                                    (day) => (
                                        <button
                                            key={day}
                                            type="button"
                                            onClick={() =>
                                                setWeekendConfig((prev) => ({ ...prev, [day]: !prev[day] }))
                                            }
                                            className="form-chip"
                                            style={{
                                                padding: '6px 10px',
                                                borderRadius: '999px',
                                                border: weekendConfig[day]
                                                    ? 'none'
                                                    : '1px solid var(--gray-10)',
                                                backgroundColor: weekendConfig[day]
                                                    ? 'var(--primary-500)'
                                                    : '#fff',
                                                color: weekendConfig[day] ? '#fff' : 'var(--dark-80)',
                                                fontSize: '12px',
                                                textTransform: 'capitalize',
                                                cursor: 'pointer',
                                            }}
                                        >
                                            {day.slice(0, 3)}
                                        </button>
                                    )
                                )}
                            </div>
                        </div>
                    )}

                    {/* POSITIONS TAB */}
                    {activeTab === 'positions' && (
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                                <h3>Position Management</h3>
                                <button className="add-employee-btn" onClick={() => openPosModal()}>
                                    <Plus size={16} /> Add Position
                                </button>
                            </div>
                            <div className="employee-table-container">
                                <table className="employee-table">
                                    <thead>
                                        <tr>
                                            <th>Title</th>
                                            <th>Probation</th>
                                            <th>Status</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {positions.map(pos => (
                                            <tr key={pos.id}>
                                                <td>{pos.title}</td>
                                                <td>{pos.probationPeriodMonths} months</td>
                                                <td>
                                                    <span className={`status-badge ${pos.isActive ? 'approved' : 'rejected'}`}>
                                                        {pos.isActive ? 'Active' : 'Inactive'}
                                                    </span>
                                                </td>
                                                <td>
                                                    <div style={{ display: 'flex', gap: '8px' }}>
                                                        <button
                                                            onClick={() => openPosModal(pos)}
                                                            style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--primary-color)' }}
                                                            title="Edit"
                                                        >
                                                            <Edit2 size={16} />
                                                        </button>
                                                        <button
                                                            onClick={async () => { await adminAPI.togglePositionStatus(pos.id); fetchPositions(); }}
                                                            style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
                                                            title="Toggle Status"
                                                        >
                                                            {pos.isActive ? <ToggleRight size={16} color="#10b981" /> : <ToggleLeft size={16} />}
                                                        </button>
                                                        <button
                                                            onClick={async () => { if (window.confirm('Delete?')) { await adminAPI.deletePosition(pos.id); fetchPositions(); } }}
                                                            style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#ef4444' }}
                                                            title="Delete"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* LOCATIONS TAB */}
                    {activeTab === 'locations' && (
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                                <h3>Location Management</h3>
                                <button className="add-employee-btn" onClick={() => openLocationModal()}>
                                    <Plus size={16} /> Add Location
                                </button>
                            </div>
                            <div className="employee-table-container">
                                <table className="employee-table">
                                    <thead>
                                        <tr>
                                            <th>Location Name</th>
                                            <th>Location Code</th>
                                            <th>Address</th>
                                            <th>Contact Person</th>
                                            <th>Shift Timing</th>
                                            <th>Timezone</th>
                                            <th>Associated Users</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {locations.length === 0 ? (
                                            <tr>
                                                <td colSpan="8" style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>
                                                    No locations found. Click "Add Location" to create one.
                                                </td>
                                            </tr>
                                        ) : (
                                            locations.map(loc => {
                                                const associatedEmployees = locationEmployees[loc.id] || [];
                                                const employeeCount = associatedEmployees.length;

                                                return (
                                                    <tr key={loc.id}>
                                                        <td style={{ fontWeight: 500 }}>{loc.locationName}</td>
                                                        <td>{loc.locationCode || '-'}</td>
                                                        <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                            {loc.address || '-'}
                                                        </td>
                                                        <td>{loc.contactPerson || '-'}</td>
                                                        <td>{loc.shiftTiming || '-'}</td>
                                                        <td>{loc.timezone || '-'}</td>
                                                        <td>
                                                            {employeeCount > 0 ? (
                                                                <span
                                                                    onClick={() => {
                                                                        setSelectedLocationForUsers(loc);
                                                                        setSelectedLocationUsers(associatedEmployees);
                                                                        setShowLocationUsersModal(true);
                                                                    }}
                                                                    style={{
                                                                        display: 'inline-flex',
                                                                        alignItems: 'center',
                                                                        gap: '4px',
                                                                        padding: '4px 12px',
                                                                        backgroundColor: '#dbeafe',
                                                                        color: '#1e40af',
                                                                        borderRadius: '12px',
                                                                        fontSize: '13px',
                                                                        fontWeight: 500,
                                                                        cursor: 'pointer',
                                                                        transition: 'all 0.2s'
                                                                    }}
                                                                    onMouseEnter={(e) => {
                                                                        e.target.style.backgroundColor = '#bfdbfe';
                                                                    }}
                                                                    onMouseLeave={(e) => {
                                                                        e.target.style.backgroundColor = '#dbeafe';
                                                                    }}
                                                                >
                                                                    <Users size={14} />
                                                                    {employeeCount} {employeeCount === 1 ? 'user' : 'users'}
                                                                </span>
                                                            ) : (
                                                                <span style={{ color: '#9ca3af', fontSize: '13px' }}>No users</span>
                                                            )}
                                                        </td>
                                                        <td>
                                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                                <button
                                                                    onClick={() => openLocationModal(loc)}
                                                                    style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--primary-color)' }}
                                                                    title="Edit"
                                                                >
                                                                    <Edit2 size={16} />
                                                                </button>
                                                                <button
                                                                    onClick={() => handleDeleteLocation(loc.id)}
                                                                    style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#ef4444' }}
                                                                    title="Delete"
                                                                >
                                                                    <Trash2 size={16} />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* LEAVE TYPES TAB */}
                    {activeTab === 'leavetypes' && (
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                                <h3>Leave Policy Config</h3>
                                <button className="add-employee-btn" onClick={() => openLeaveTypeModal()}>
                                    <Plus size={16} /> Add Leave Type
                                </button>
                            </div>
                            <div className="employee-table-container">
                                <table className="employee-table">
                                    <thead>
                                        <tr>
                                            <th>Name</th>
                                            <th>Code</th>
                                            <th>Annual Days</th>
                                            <th>Carry Fwd</th>
                                            <th>Max Continuous</th>
                                            <th>Restrictions</th>
                                            <th>Approval Req.</th>
                                            <th>Status</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {leaveTypes.map(lt => (
                                            <tr key={lt.id}>
                                                <td>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <div style={{ width: 12, height: 12, borderRadius: 2, background: lt.colorCode }}></div>
                                                        {lt.leaveTypeName}
                                                    </div>
                                                </td>
                                                <td>{lt.leaveTypeCode}</td>
                                                <td>{lt.defaultLeaveCount}</td>
                                                <td>{lt.allowCarryforward ? (lt.maxCarryforwardLimit ?? 'Yes') : 'No'}</td>
                                                <td>{lt.maxContinuousDays ?? '—'}</td>
                                                <td style={{ fontSize: 12 }}>
                                                     {[
                                                         lt.requiresDocument && 'Doc',
                                                         lt.restrictDuringProbation ? 'Probation: Blocked' : (lt.probationAllocation !== null && lt.probationAllocation !== undefined ? `Probation Allocation: ${lt.probationAllocation}` : null),
                                                         lt.allowedGenders && `Gender: ${lt.allowedGenders}`,
                                                         lt.positionAllocations?.length > 0 && `${lt.positionAllocations.length} position(s)`,
                                                     ].filter(Boolean).join(' · ') || '—'}
                                                 </td>
                                                <td>{lt.requiresApproval ? 'Yes' : 'No'}</td>
                                                <td>
                                                    <span className={`status-badge ${(lt.isActive ?? lt.active) ? 'approved' : 'rejected'}`}>
                                                        {(lt.isActive ?? lt.active) ? 'Active' : 'Inactive'}
                                                    </span>
                                                </td>
                                                <td>
                                                    <div style={{ display: 'flex', gap: '8px' }}>
                                                        <button
                                                            onClick={() => openLeaveTypeModal(lt)}
                                                            style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--primary-color)' }}
                                                            title="Edit"
                                                        >
                                                            <Edit2 size={16} />
                                                        </button>
                                                        <button
                                                            onClick={async () => { await adminAPI.toggleLeaveTypeStatus(lt.id); fetchLeaveTypes(); }}
                                                            style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
                                                            title="Toggle Status"
                                                        >
                                                            {(lt.isActive ?? lt.active) ? <ToggleRight size={16} color="#10b981" /> : <ToggleLeft size={16} />}
                                                        </button>
                                                        <button
                                                            onClick={async () => { if (window.confirm('Delete?')) { await adminAPI.deleteLeaveType(lt.id); fetchLeaveTypes(); } }}
                                                            style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#ef4444' }}
                                                            title="Delete"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* MANAGER LIMITS TAB */}
                    {activeTab === 'limits' && (
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                                <h3>Report Manager Leave Limits</h3>
                                <button className="add-employee-btn" onClick={handleManagerLimitsSave} disabled={submitting}>
                                    <Save size={16} /> Save Limits
                                </button>
                            </div>
                            <div className="employee-table-container">
                                <table className="employee-table">
                                    <thead>
                                        <tr>
                                            <th>Leave Type</th>
                                            <th>Max Leaves Limit</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {leaveTypes.map(lt => (
                                            <tr key={lt.id}>
                                                <td style={{ width: '40%' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <span style={{ fontWeight: 500 }}>{lt.leaveTypeName}</span>
                                                        <span className="status-badge pending">{lt.leaveTypeCode}</span>
                                                    </div>
                                                </td>
                                                <td>
                                                    <input
                                                        type="number"
                                                        className="form-input"
                                                        style={{ width: '100%', maxWidth: '200px' }}
                                                        value={managerLimits[lt.leaveTypeCode] || ''}
                                                        onChange={(e) => setManagerLimits({ ...managerLimits, [lt.leaveTypeCode]: e.target.value === '' ? null : parseInt(e.target.value) })}
                                                        placeholder="Unlimited"
                                                    />
                                                </td>
                                            </tr>
                                        ))}
                                        <tr key="WFH">
                                            <td style={{ width: '40%' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <span style={{ fontWeight: 500 }}>Work From Home</span>
                                                    <span className="status-badge pending">WFH</span>
                                                </div>
                                            </td>
                                            <td>
                                                <input
                                                    type="number"
                                                    className="form-input"
                                                    style={{ width: '100%', maxWidth: '200px' }}
                                                    value={managerLimits.WFH ?? ''}
                                                    onChange={(e) => setManagerLimits({ ...managerLimits, WFH: e.target.value === '' ? null : parseInt(e.target.value) })}
                                                    placeholder="Unlimited"
                                                />
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* EMPLOYEE ID FORMAT TAB */}
                    {activeTab === 'empid' && (
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                                <h3>Employee ID Generation</h3>
                                <button className="add-employee-btn" onClick={handleEmpIdSave} disabled={submitting}>
                                    <Save size={16} /> Save Format
                                </button>
                            </div>
                            {empIdFormatError && (
                                <div style={{ color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 16px', marginBottom: 16, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <AlertCircle size={18} style={{ minWidth: 18 }} />
                                    <span>{empIdFormatError}</span>
                                </div>
                            )}
                            <div className="employee-table-container">
                                <table className="employee-table">
                                    <thead>
                                        <tr>
                                            <th style={{ width: '30%' }}>Parameter</th>
                                            <th style={{ width: '40%' }}>Configuration</th>
                                            <th style={{ width: '30%' }}>Description</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr>
                                            <td style={{ fontWeight: 500 }}>Prefix</td>
                                            <td>
                                                <input
                                                    className="form-input"
                                                    style={{ width: '100%' }}
                                                    value={empIdFormat.prefix}
                                                    onChange={e => setEmpIdFormat({ ...empIdFormat, prefix: e.target.value.toUpperCase() })}
                                                    placeholder="e.g. EMP"
                                                />
                                            </td>
                                            <td style={{ color: 'var(--gray-500)', fontSize: '13px' }}>
                                                Static text at the start of ID
                                            </td>
                                        </tr>
                                        <tr>
                                            <td style={{ fontWeight: 500 }}>Next Number</td>
                                            <td>
                                                <input
                                                    type="number"
                                                    className="form-input"
                                                    style={{ width: '100%' }}
                                                    value={empIdFormat.nextNumber}
                                                    onChange={e => setEmpIdFormat({ ...empIdFormat, nextNumber: parseInt(e.target.value) })}
                                                />
                                            </td>
                                            <td style={{ color: 'var(--gray-500)', fontSize: '13px' }}>
                                                The number for the next new employee
                                            </td>
                                        </tr>
                                        <tr>
                                            <td style={{ fontWeight: 500 }}>Location Based</td>
                                            <td>
                                                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={empIdFormat.locationBased}
                                                        onChange={e => setEmpIdFormat({ ...empIdFormat, locationBased: e.target.checked })}
                                                    />
                                                    <span>Include Location Code</span>
                                                </label>
                                            </td>
                                            <td style={{ color: 'var(--gray-500)', fontSize: '13px' }}>
                                                Adds location abbreviation (e.g. NY)
                                            </td>
                                        </tr>
                                        <tr>
                                            <td style={{ fontWeight: 500 }}>Digit Configuration</td>
                                            <td>
                                                <input
                                                    type="number"
                                                    className="form-input"
                                                    style={{ width: '100%' }}
                                                    min={1}
                                                    value={empIdFormat.digitConfig || ''}
                                                    onChange={e => setEmpIdFormat({ ...empIdFormat, digitConfig: parseInt(e.target.value) || '' })}
                                                    placeholder="e.g. 4 for 0001"
                                                />
                                            </td>
                                            <td style={{ color: 'var(--gray-500)', fontSize: '13px' }}>
                                                Number of digits for Employee ID (e.g. 4 will make 0001, 0002, ...)
                                            </td>
                                        </tr>
                                        <tr>
                                            <td style={{ fontWeight: 500 }}>Next ID Example</td>
                                            <td colSpan="2">
                                                <div style={{
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '8px',
                                                    padding: '6px 10px',
                                                    borderRadius: '999px',
                                                    background: 'var(--primary-5)',
                                                    color: 'var(--primary-700)',
                                                    fontFamily: 'monospace',
                                                    fontSize: '13px',
                                                    fontWeight: 600
                                                }}>
                                                    {getNextIdPreview()}
                                                </div>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* WFH POLICY TAB */}
                    {activeTab === 'wfhpolicy' && (
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                                <h3>WFH Policy Configuration</h3>
                                <button className="add-employee-btn" onClick={handleWfhPolicySave} disabled={submitting}>
                                    <Save size={16} /> {submitting ? 'Saving...' : 'Save Policy'}
                                </button>
                            </div>
                            <p style={{ fontSize: '13px', color: 'var(--gray-600)', marginBottom: '20px' }}>
                                Configure Work From Home limits and rules for your organization. These settings apply to all employees.
                            </p>

                            <div style={{ display: 'grid', gap: '20px', maxWidth: '600px' }}>
                                {/* Limits Section */}
                                <div style={{
                                    background: 'var(--white-5, #fff)',
                                    border: '1px solid var(--gray-10, #e5e7eb)',
                                    borderRadius: '12px',
                                    padding: '20px'
                                }}>
                                    <h4 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--dark-500)', marginBottom: '16px' }}>
                                        WFH Day Limits
                                    </h4>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: 'var(--dark-80)', marginBottom: '6px' }}>
                                                Max Days Per Week
                                            </label>
                                            <input
                                                type="number"
                                                className="form-input"
                                                style={{ width: '100%' }}
                                                min="0"
                                                max="7"
                                                value={wfhPolicy.maxDaysPerWeek ?? ''}
                                                onChange={(e) => setWfhPolicy(prev => ({
                                                    ...prev,
                                                    maxDaysPerWeek: e.target.value === '' ? null : parseInt(e.target.value)
                                                }))}
                                                placeholder="Unlimited"
                                            />
                                            <span style={{ fontSize: '11px', color: 'var(--gray-500)' }}>Leave empty for unlimited</span>
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: 'var(--dark-80)', marginBottom: '6px' }}>
                                                Max Days Per Month
                                            </label>
                                            <input
                                                type="number"
                                                className="form-input"
                                                style={{ width: '100%' }}
                                                min="0"
                                                max="31"
                                                value={wfhPolicy.maxDaysPerMonth ?? ''}
                                                onChange={(e) => setWfhPolicy(prev => ({
                                                    ...prev,
                                                    maxDaysPerMonth: e.target.value === '' ? null : parseInt(e.target.value)
                                                }))}
                                                placeholder="Unlimited"
                                            />
                                            <span style={{ fontSize: '11px', color: 'var(--gray-500)' }}>Leave empty for unlimited</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Toggle Options Section */}
                                <div style={{
                                    background: 'var(--white-5, #fff)',
                                    border: '1px solid var(--gray-10, #e5e7eb)',
                                    borderRadius: '12px',
                                    padding: '20px'
                                }}>
                                    <h4 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--dark-500)', marginBottom: '16px' }}>
                                        Policy Rules
                                    </h4>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                        {[
                                            { key: 'allowPastDates', label: 'Allow Past Date Requests', desc: 'Employees can submit WFH requests for past dates' },
                                        ].map(opt => (
                                            <div
                                                key={opt.key}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between',
                                                    padding: '10px 12px',
                                                    borderRadius: '8px',
                                                    border: '1px solid var(--gray-10, #f3f4f6)',
                                                    background: wfhPolicy[opt.key] ? 'var(--primary-5, #eff6ff)' : 'transparent'
                                                }}
                                            >
                                                <div>
                                                    <div style={{ fontSize: '13px', fontWeight: '500', color: 'var(--dark-500)' }}>{opt.label}</div>
                                                    <div style={{ fontSize: '11px', color: 'var(--gray-500)', marginTop: '2px' }}>{opt.desc}</div>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => setWfhPolicy(prev => ({ ...prev, [opt.key]: !prev[opt.key] }))}
                                                    style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '4px' }}
                                                >
                                                    {wfhPolicy[opt.key]
                                                        ? <ToggleRight size={28} color="#10b981" />
                                                        : <ToggleLeft size={28} color="#9ca3af" />
                                                    }
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Current Policy Summary */}
                                <div style={{
                                    background: 'var(--blue-50, #eff6ff)',
                                    border: '1px solid var(--blue-200, #bfdbfe)',
                                    borderRadius: '12px',
                                    padding: '16px'
                                }}>
                                    <h4 style={{ fontSize: '13px', fontWeight: '600', color: 'var(--blue-700, #1d4ed8)', marginBottom: '8px' }}>
                                        Current Policy Summary
                                    </h4>
                                    <div style={{ fontSize: '12px', color: 'var(--blue-600, #2563eb)', lineHeight: '1.6' }}>
                                        <div>Weekly Limit: <strong>{wfhPolicy.maxDaysPerWeek != null ? `${wfhPolicy.maxDaysPerWeek} day(s)` : 'Unlimited'}</strong></div>
                                        <div>Monthly Limit: <strong>{wfhPolicy.maxDaysPerMonth != null ? `${wfhPolicy.maxDaysPerMonth} day(s)` : 'Unlimited'}</strong></div>
                                        <div>Past Dates: <strong>{wfhPolicy.allowPastDates ? 'Allowed' : 'Blocked'}</strong></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* NOTICE PERIOD TAB */}
                    {activeTab === 'noticeperiod' && (
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                                <h3>Notice Period Configuration</h3>
                                <button className="add-employee-btn" onClick={handleNoticePeriodSave} disabled={submitting}>
                                    <Save size={16} /> {submitting ? 'Saving...' : 'Save Notice Period'}
                                </button>
                            </div>
                            <p style={{ fontSize: '13px', color: 'var(--gray-600)', marginBottom: '20px' }}>
                                Set the default notice period for employee exits. This applies organization-wide unless overridden by position or department.
                            </p>

                            <div style={{ display: 'grid', gap: '20px', maxWidth: '600px' }}>
                                {/* Default Notice Period */}
                                <div style={{
                                    background: 'var(--white-5, #fff)',
                                    border: '1px solid var(--gray-10, #e5e7eb)',
                                    borderRadius: '12px',
                                    padding: '20px'
                                }}>
                                    <h4 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--dark-500)', marginBottom: '16px' }}>
                                        Default Notice Period
                                    </h4>
                                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '12px', maxWidth: '300px' }}>
                                        <div style={{ flex: 1 }}>
                                            <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: 'var(--dark-80)', marginBottom: '6px' }}>
                                                Notice Period (Days)
                                            </label>
                                            <input
                                                type="number"
                                                className="form-input"
                                                style={{ width: '100%' }}
                                                min="0"
                                                max="365"
                                                value={noticePeriodDays}
                                                onChange={(e) => setNoticePeriodDays(parseInt(e.target.value) || 0)}
                                                placeholder="30"
                                            />
                                        </div>
                                        <div style={{
                                            padding: '8px 14px',
                                            background: 'var(--gray-50, #f9fafb)',
                                            borderRadius: '8px',
                                            fontSize: '13px',
                                            color: 'var(--gray-600)',
                                            whiteSpace: 'nowrap',
                                            marginBottom: '2px'
                                        }}>
                                            ≈ {Math.round(noticePeriodDays / 30)} month(s)
                                        </div>
                                    </div>
                                    <p style={{ fontSize: '11px', color: 'var(--gray-500)', marginTop: '8px' }}>
                                        This is the default notice period applied to all employees when they initiate an exit request.
                                    </p>
                                </div>

                                {/* Existing Notice Period Configs */}
                                {noticePeriodConfigs.length > 0 && (
                                    <div style={{
                                        background: 'var(--white-5, #fff)',
                                        border: '1px solid var(--gray-10, #e5e7eb)',
                                        borderRadius: '12px',
                                        padding: '20px'
                                    }}>
                                        <h4 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--dark-500)', marginBottom: '16px' }}>
                                            Active Configurations
                                        </h4>
                                        <div className="employee-table-container">
                                            <table className="employee-table">
                                                <thead>
                                                    <tr>
                                                        <th>Scope</th>
                                                        <th>Notice Period</th>
                                                        <th>Status</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {noticePeriodConfigs.map((cfg, idx) => (
                                                        <tr key={cfg.id || idx}>
                                                            <td style={{ fontWeight: 500 }}>
                                                                {!cfg.position && !cfg.department
                                                                    ? 'Default (All Employees)'
                                                                    : cfg.position
                                                                        ? `Position: ${cfg.position.title || cfg.position.name || 'N/A'}`
                                                                        : `Department: ${cfg.department?.name || 'N/A'}`
                                                                }
                                                            </td>
                                                            <td>
                                                                <span style={{
                                                                    display: 'inline-flex',
                                                                    alignItems: 'center',
                                                                    gap: '4px',
                                                                    padding: '4px 10px',
                                                                    borderRadius: '999px',
                                                                    fontSize: '12px',
                                                                    fontWeight: 600,
                                                                    background: 'var(--primary-5, #eff6ff)',
                                                                    color: 'var(--primary-700, #1d4ed8)'
                                                                }}>
                                                                    {cfg.noticePeriodDays} days
                                                                </span>
                                                            </td>
                                                            <td>
                                                                <span className={`status-badge ${cfg.isActive ? 'approved' : 'rejected'}`}>
                                                                    {cfg.isActive ? 'Active' : 'Inactive'}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}

                                {/* Info Card */}
                                <div style={{
                                    background: 'var(--amber-50, #fffbeb)',
                                    border: '1px solid var(--amber-200, #fde68a)',
                                    borderRadius: '12px',
                                    padding: '16px',
                                    display: 'flex',
                                    gap: '10px',
                                    alignItems: 'flex-start'
                                }}>
                                    <AlertCircle size={18} style={{ color: 'var(--amber-600, #d97706)', flexShrink: 0, marginTop: '2px' }} />
                                    <div style={{ fontSize: '12px', color: 'var(--amber-700, #b45309)', lineHeight: '1.6' }}>
                                        <strong>How notice period works:</strong><br />
                                        When an employee submits a resignation, the system calculates their last working day based on this notice period.
                                        The default applies to all employees unless a position- or department-specific override exists.
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                    {/* APPROVAL EMAIL CC TAB */}
                    {activeTab === 'approvalcc' && (
                        <div style={{ width: '100%' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                                <h3>Manager Approval Email CC Notifications</h3>
                                <button className="add-employee-btn" onClick={handleApprovalCcSave} disabled={submitting}>
                                    <Save size={16} /> {submitting ? 'Saving...' : 'Save Settings'}
                                </button>
                            </div>
                            <p style={{ fontSize: '13px', color: 'var(--gray-600)', marginBottom: '20px' }}>
                                Dynamically CC HRs, Admins, or specific email addresses when a manager approves an employee's request.
                            </p>

                            <div style={{ display: 'grid', gap: '20px', width: '100%' }}>
                                {/* Master Enable Card */}
                                <div style={{
                                    background: 'var(--white-5, #fff)',
                                    border: '1px solid var(--gray-10, #e5e7eb)',
                                    borderRadius: '12px',
                                    padding: '24px',
                                    width: '100%'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                                        <div style={{
                                            padding: '10px',
                                            background: 'var(--primary-5, #eff6ff)',
                                            color: 'var(--primary-600, #2563eb)',
                                            borderRadius: '10px'
                                        }}>
                                            <Mail size={24} />
                                        </div>
                                        <div>
                                            <h4 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--dark-500)' }}>
                                                Enable Manager Approval CC Notifications
                                            </h4>
                                            <p style={{ fontSize: '12px', color: 'var(--gray-500)' }}>
                                                Automatically include configured recipients in CC on request approval emails.
                                            </p>
                                        </div>
                                    </div>

                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        padding: '16px',
                                        borderRadius: '12px',
                                        background: approvalCcConfig.enabled ? 'var(--primary-5, #eff6ff)' : 'var(--gray-50, #f9fafb)',
                                        border: '1px solid',
                                        borderColor: approvalCcConfig.enabled ? 'var(--primary-100, #dbeafe)' : 'var(--gray-100, #f3f4f6)'
                                    }}>
                                        <div>
                                            <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--dark-500)' }}>
                                                CC Notification Status
                                            </div>
                                            <div style={{ fontSize: '12px', color: 'var(--gray-500)' }}>
                                                {approvalCcConfig.enabled ? 'Enabled (Emails will include CC list)' : 'Disabled (Only employee receives approval mail)'}
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setApprovalCcConfig(prev => {
                                                const nextEnabled = !prev.enabled;
                                                const currentTargets = (prev.recipientTarget || '').split(',').map(s => s.trim()).filter(Boolean);
                                                const customRaw = (prev.customEmails || '').trim();
                                                let nextTarget = prev.recipientTarget;
                                                if (nextEnabled && currentTargets.length === 0 && !customRaw) {
                                                    nextTarget = 'DEPARTMENT_HR';
                                                }
                                                return {
                                                    ...prev,
                                                    enabled: nextEnabled,
                                                    recipientTarget: nextTarget
                                                };
                                            })}
                                            style={{
                                                background: 'none',
                                                border: 'none',
                                                cursor: 'pointer',
                                                color: approvalCcConfig.enabled ? 'var(--primary-600, #2563eb)' : 'var(--gray-400, #9ca3af)',
                                                display: 'flex',
                                                alignItems: 'center'
                                            }}
                                        >
                                            {approvalCcConfig.enabled ? <ToggleRight size={36} /> : <ToggleLeft size={36} />}
                                        </button>
                                    </div>

                                    {/* Recipient Target Checkbox Selection (Multi-select) */}
                                    <div style={{
                                        marginTop: '24px',
                                        opacity: approvalCcConfig.enabled ? 1 : 0.55,
                                        pointerEvents: approvalCcConfig.enabled ? 'auto' : 'none',
                                        transition: 'all 0.2s ease'
                                    }}>
                                        <label style={{ fontSize: '14px', fontWeight: '600', color: 'var(--dark-500)', display: 'block', marginBottom: '12px' }}>
                                            CC Recipient Selection Strategy (Select Multiple)
                                        </label>
                                        <div style={{ display: 'grid', gap: '12px', width: '100%' }}>
                                            {[
                                                {
                                                    value: 'DEPARTMENT_HR',
                                                    title: 'Department HR',
                                                    desc: 'CC HR employee(s) assigned to the requesting employee\'s department (fallback to all HRs if department has no dedicated HR).'
                                                },
                                                {
                                                    value: 'ALL_HR',
                                                    title: 'All HR Personnel',
                                                    desc: 'CC all active HR role personnel across the entire organization.'
                                                },
                                                {
                                                    value: 'ONLY_ADMINS',
                                                    title: 'Only System Admins',
                                                    desc: 'CC all active system Administrators.'
                                                },
                                                {
                                                    value: 'ALL_HR_AND_ADMINS',
                                                    title: 'All HRs & Admins',
                                                    desc: 'CC both active HR personnel and system Administrators.'
                                                }
                                            ].map(opt => {
                                                const isChecked = (approvalCcConfig.recipientTarget || '')
                                                    .split(',')
                                                    .map(s => s.trim())
                                                    .includes(opt.value);
                                                return (
                                                    <label
                                                        key={opt.value}
                                                        style={{
                                                            display: 'flex',
                                                            alignItems: 'flex-start',
                                                            gap: '12px',
                                                            padding: '14px',
                                                            borderRadius: '10px',
                                                            border: '1px solid',
                                                            borderColor: (isChecked && approvalCcConfig.enabled) ? 'var(--primary-500, #3b82f6)' : 'var(--gray-200, #e5e7eb)',
                                                            background: (isChecked && approvalCcConfig.enabled) ? 'var(--primary-50, #eff6ff)' : 'var(--white, #fff)',
                                                            cursor: approvalCcConfig.enabled ? 'pointer' : 'not-allowed',
                                                            width: '100%'
                                                        }}
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            value={opt.value}
                                                            checked={isChecked}
                                                            disabled={!approvalCcConfig.enabled}
                                                            onChange={() => {
                                                                if (!approvalCcConfig.enabled) return;
                                                                const currentTargets = (approvalCcConfig.recipientTarget || '')
                                                                    .split(',')
                                                                    .map(s => s.trim())
                                                                    .filter(Boolean);
                                                                let newTargets = [];
                                                                if (currentTargets.includes(opt.value)) {
                                                                    newTargets = currentTargets.filter(t => t !== opt.value);
                                                                } else {
                                                                    newTargets = [...currentTargets, opt.value];
                                                                }
                                                                setApprovalCcConfig(prev => ({
                                                                    ...prev,
                                                                    recipientTarget: newTargets.join(',')
                                                                }));
                                                            }}
                                                            style={{ marginTop: '3px', width: '18px', height: '18px', cursor: approvalCcConfig.enabled ? 'pointer' : 'not-allowed' }}
                                                        />
                                                        <div style={{ flex: 1 }}>
                                                            <div style={{ fontSize: '14px', fontWeight: '600', color: approvalCcConfig.enabled ? 'var(--dark-500)' : 'var(--gray-400)' }}>
                                                                {opt.title}
                                                            </div>
                                                            <div style={{ fontSize: '12px', color: 'var(--gray-500)', marginTop: '2px' }}>
                                                                {opt.desc}
                                                            </div>
                                                        </div>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Custom Email Input */}
                                    <div style={{
                                        marginTop: '24px',
                                        width: '100%',
                                        opacity: approvalCcConfig.enabled ? 1 : 0.55,
                                        pointerEvents: approvalCcConfig.enabled ? 'auto' : 'none',
                                        transition: 'all 0.2s ease'
                                    }}>
                                        <label style={{ fontSize: '14px', fontWeight: '600', color: 'var(--dark-500)', display: 'block', marginBottom: '6px' }}>
                                            Additional / Custom Email Addresses (Optional)
                                        </label>
                                        <p style={{ fontSize: '12px', color: 'var(--gray-500)', marginBottom: '8px' }}>
                                            Enter specific email address(es) separated by commas to always include in CC (e.g. hr-leads@company.com, notify@company.com).
                                        </p>
                                        <input
                                            type="text"
                                            className="input-field"
                                            placeholder="e.g. hr-lead@company.com, admin-team@company.com"
                                            value={approvalCcConfig.customEmails}
                                            disabled={!approvalCcConfig.enabled}
                                            onChange={(e) => setApprovalCcConfig(prev => ({ ...prev, customEmails: e.target.value }))}
                                            style={{
                                                width: '100%',
                                                padding: '10px 12px',
                                                cursor: approvalCcConfig.enabled ? 'text' : 'not-allowed',
                                                backgroundColor: approvalCcConfig.enabled ? undefined : 'var(--gray-100, #f3f4f6)'
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                    {/* SECURITY TAB */}
                    {activeTab === 'security' && (
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                                <h3>Security & Authentication</h3>
                                <button className="add-employee-btn" onClick={handleTwoFactorSave} disabled={submitting}>
                                    <Save size={16} /> {submitting ? 'Saving...' : 'Save Security Settings'}
                                </button>
                            </div>
                            <p style={{ fontSize: '13px', color: 'var(--gray-600)', marginBottom: '20px' }}>
                                Manage authentication methods and security protocols for your organization.
                            </p>

                            <div style={{ display: 'grid', gap: '20px', maxWidth: '600px' }}>
                                {/* 2FA Section */}
                                <div style={{
                                    background: 'var(--white-5, #fff)',
                                    border: '1px solid var(--gray-10, #e5e7eb)',
                                    borderRadius: '12px',
                                    padding: '24px'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                                        <div style={{
                                            padding: '10px',
                                            background: 'var(--primary-5, #eff6ff)',
                                            color: 'var(--primary-600, #2563eb)',
                                            borderRadius: '10px'
                                        }}>
                                            <ShieldCheck size={24} />
                                        </div>
                                        <div>
                                            <h4 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--dark-500)' }}>
                                                Two-Factor Authentication (2FA)
                                            </h4>
                                            <p style={{ fontSize: '12px', color: 'var(--gray-500)' }}>
                                                Enhance account security with email-based OTP verification.
                                            </p>
                                        </div>
                                    </div>

                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        padding: '16px',
                                        borderRadius: '12px',
                                        background: twoFactorEnabled ? 'var(--primary-5, #eff6ff)' : 'var(--gray-50, #f9fafb)',
                                        border: '1px solid',
                                        borderColor: twoFactorEnabled ? 'var(--primary-100, #dbeafe)' : 'var(--gray-100, #f3f4f6)'
                                    }}>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--dark-500)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                Employee 2FA Status
                                                {twoFactorEnabled ? 
                                                    <span style={{ fontSize: '10px', padding: '2px 8px', background: '#dcfce7', color: '#15803d', borderRadius: '99px' }}>Enabled</span> :
                                                    <span style={{ fontSize: '10px', padding: '2px 8px', background: '#fee2e2', color: '#b91c1c', borderRadius: '99px' }}>Disabled</span>
                                                }
                                            </div>
                                            <div style={{ fontSize: '12px', color: 'var(--gray-500)', marginTop: '4px', maxWidth: '350px' }}>
                                                When enabled, all employees will be required to enter a 6-digit OTP sent to their registered email address during login.
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setTwoFactorEnabled(!twoFactorEnabled)}
                                            style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '4px' }}
                                        >
                                            {twoFactorEnabled
                                                ? <ToggleRight size={36} color="#10b981" />
                                                : <ToggleLeft size={36} color="#9ca3af" />
                                            }
                                        </button>
                                    </div>

                                    {/* Admin 2FA Info (Non-toggleable) */}
                                    <div style={{
                                        marginTop: '20px',
                                        padding: '16px',
                                        borderRadius: '12px',
                                        background: '#f8fafc',
                                        border: '1px dashed #cbd5e1',
                                        display: 'flex',
                                        gap: '12px'
                                    }}>
                                        <Lock size={18} style={{ color: '#64748b', flexShrink: 0, marginTop: '2px' }} />
                                        <div style={{ fontSize: '12px', color: '#475569', lineHeight: '1.6' }}>
                                            <strong>Admin Security:</strong><br />
                                            Two-factor authentication is <strong>mandatory</strong> for all administrator accounts and cannot be disabled. This ensures the highest level of security for system configuration and sensitive data.
                                        </div>
                                    </div>
                                </div>

                                {/* Security Best Practices */}
                                <div style={{
                                    background: 'var(--amber-50, #fffbeb)',
                                    border: '1px solid var(--amber-200, #fde68a)',
                                    borderRadius: '12px',
                                    padding: '16px',
                                    display: 'flex',
                                    gap: '12px'
                                }}>
                                    <AlertCircle size={20} style={{ color: '#d97706', flexShrink: 0 }} />
                                    <div style={{ fontSize: '12px', color: '#b45309', lineHeight: '1.6' }}>
                                        <strong>Important:</strong> Enabling 2FA significantly reduces the risk of unauthorized access due to compromised passwords. We recommend keeping this feature enabled for all users.
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* FEATURES TAB */}
                    {activeTab === 'features' && (
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                                <h3>Feature Management</h3>
                                <button
                                    className="add-employee-btn"
                                    onClick={handleFeaturesSave}
                                    disabled={submitting}
                                >
                                    <Save size={16} /> {submitting ? 'Saving...' : 'Save Feature Settings'}
                                </button>
                            </div>
                            <p style={{ fontSize: '13px', color: 'var(--gray-600)', marginBottom: '24px' }}>
                                Manage which modules are enabled for your organization. Disabling a feature will hide it from all employees and managers immediately. 
                                Note: You can only enable features included in your current plan.
                            </p>
                            <div style={{ marginBottom: '40px' }}>
                                {FEATURE_GROUPS.map(group => {
                                    const groupFeatures = group.features.filter(f => planFeatures.includes(f.key));
                                    if (groupFeatures.length === 0) return null;
                                    return (
                                        <div key={group.title} style={{ marginBottom: '32px' }}>
                                            <div style={{ borderBottom: '2px solid var(--gray-10, #f3f4f6)', paddingBottom: '8px', marginBottom: '16px' }}>
                                                <h4 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--dark-500)', margin: 0 }}>{group.title}</h4>
                                                <p style={{ fontSize: '12px', color: 'var(--gray-500)', margin: '4px 0 0' }}>{group.description}</p>
                                            </div>
                                            <div style={{ 
                                                display: 'grid', 
                                                gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', 
                                                gap: '16px' 
                                            }}>
                                                {groupFeatures.map(f => {
                                                    const key = f.key;
                                                    const isEssential = ['DASHBOARD', 'SETTINGS', 'ORGANIZATION'].includes(key);
                                                    const isEnabled = enabledFeatures.has(key);
                                                    return (
                                                        <div 
                                                            key={key}
                                                            style={{
                                                                background: '#fff',
                                                                border: '1px solid var(--gray-10)',
                                                                borderRadius: '12px',
                                                                padding: '16px',
                                                                display: 'flex',
                                                                flexDirection: 'column',
                                                                gap: '12px',
                                                                opacity: isEssential ? 0.7 : 1,
                                                                position: 'relative',
                                                                transition: 'all 0.2s ease',
                                                                boxShadow: isEnabled ? '0 4px 12px rgba(99, 102, 241, 0.08)' : 'none',
                                                                borderColor: isEnabled ? 'var(--primary-200)' : 'var(--gray-10)'
                                                            }}
                                                        >
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                                                    <div style={{ 
                                                                        width: '36px', 
                                                                        height: '36px', 
                                                                        borderRadius: '10px', 
                                                                        background: isEnabled ? 'var(--primary-50)' : 'var(--gray-50)',
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        justifyContent: 'center',
                                                                        color: isEnabled ? 'var(--primary-600)' : 'var(--gray-400)'
                                                                    }}>
                                                                        <ShieldCheck size={20} />
                                                                    </div>
                                                                    <div>
                                                                        <h4 style={{ fontSize: '14px', fontWeight: '600', margin: 0, color: 'var(--dark-500)' }}>
                                                                            {allFeatures[key] || f.label || key}
                                                                        </h4>
                                                                        <span style={{ fontSize: '10px', color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                                            {key}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                                
                                                                <div 
                                                                    onClick={() => !isEssential && !submitting && handleFeatureToggle(key)}
                                                                    style={{
                                                                        width: '44px',
                                                                        height: '24px',
                                                                        borderRadius: '99px',
                                                                        backgroundColor: isEnabled ? 'var(--primary-500)' : '#e5e7eb',
                                                                        position: 'relative',
                                                                        cursor: isEssential ? 'not-allowed' : 'pointer',
                                                                        transition: 'background-color 0.2s'
                                                                    }}
                                                                >
                                                                    <div style={{
                                                                        position: 'absolute',
                                                                        top: '2px',
                                                                        left: isEnabled ? '22px' : '2px',
                                                                        width: '20px',
                                                                        height: '20px',
                                                                        borderRadius: '50%',
                                                                        backgroundColor: '#fff',
                                                                        transition: 'left 0.2s ease'
                                                                    }} />
                                                                </div>
                                                            </div>
                                                            
                                                            {f.subFeatures && f.subFeatures.length > 0 && (
                                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
                                                                    {f.subFeatures.map(sf => (
                                                                        <span 
                                                                            key={sf} 
                                                                            style={{
                                                                                fontSize: '11px',
                                                                                padding: '2px 8px',
                                                                                background: 'var(--gray-5, #f9fafb)',
                                                                                border: '1px solid var(--gray-10, #f3f4f6)',
                                                                                color: 'var(--gray-600, #475569)',
                                                                                borderRadius: '6px'
                                                                            }}
                                                                        >
                                                                            {sf}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            )}

                                                            {isEssential && (
                                                                <p style={{ fontSize: '11px', color: 'var(--primary-600)', margin: 0, fontWeight: '500' }}>
                                                                    Essential system feature (Always enabled)
                                                                </p>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}

                                {/* Fallback for un-categorized features */}
                                {(() => {
                                    const mappedKeys = new Set(FEATURE_GROUPS.flatMap(g => g.features.map(f => f.key)));
                                    const otherFeatures = planFeatures.filter(key => !mappedKeys.has(key));
                                    if (otherFeatures.length === 0) return null;
                                    return (
                                        <div style={{ marginTop: '24px' }}>
                                            <div style={{ borderBottom: '2px solid var(--gray-10, #f3f4f6)', paddingBottom: '8px', marginBottom: '16px' }}>
                                                <h4 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--dark-500)', margin: 0 }}>Other Modules</h4>
                                                <p style={{ fontSize: '12px', color: 'var(--gray-500)', margin: '4px 0 0' }}>Additional modules and services</p>
                                            </div>
                                            <div style={{ 
                                                display: 'grid', 
                                                gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', 
                                                gap: '16px' 
                                            }}>
                                                {otherFeatures.map(key => {
                                                    const isEssential = ['DASHBOARD', 'SETTINGS', 'ORGANIZATION'].includes(key);
                                                    const isEnabled = enabledFeatures.has(key);
                                                    return (
                                                        <div 
                                                            key={key}
                                                            style={{
                                                                background: '#fff',
                                                                border: '1px solid var(--gray-10)',
                                                                borderRadius: '12px',
                                                                padding: '16px',
                                                                display: 'flex',
                                                                flexDirection: 'column',
                                                                gap: '12px',
                                                                opacity: isEssential ? 0.7 : 1,
                                                                position: 'relative',
                                                                transition: 'all 0.2s ease',
                                                                boxShadow: isEnabled ? '0 4px 12px rgba(99, 102, 241, 0.08)' : 'none',
                                                                borderColor: isEnabled ? 'var(--primary-200)' : 'var(--gray-10)'
                                                            }}
                                                        >
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                                                    <div style={{ 
                                                                        width: '36px', 
                                                                        height: '36px', 
                                                                        borderRadius: '10px', 
                                                                        background: isEnabled ? 'var(--primary-50)' : 'var(--gray-50)',
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        justifyContent: 'center',
                                                                        color: isEnabled ? 'var(--primary-600)' : 'var(--gray-400)'
                                                                    }}>
                                                                        <ShieldCheck size={20} />
                                                                    </div>
                                                                    <div>
                                                                        <h4 style={{ fontSize: '14px', fontWeight: '600', margin: 0, color: 'var(--dark-500)' }}>
                                                                            {allFeatures[key] || key}
                                                                        </h4>
                                                                        <span style={{ fontSize: '10px', color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                                            {key}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                                
                                                                <div 
                                                                    onClick={() => !isEssential && !submitting && handleFeatureToggle(key)}
                                                                    style={{
                                                                        width: '44px',
                                                                        height: '24px',
                                                                        borderRadius: '99px',
                                                                        backgroundColor: isEnabled ? 'var(--primary-500)' : '#e5e7eb',
                                                                        position: 'relative',
                                                                        cursor: isEssential ? 'not-allowed' : 'pointer',
                                                                        transition: 'background-color 0.2s'
                                                                    }}
                                                                >
                                                                    <div style={{
                                                                        position: 'absolute',
                                                                        top: '2px',
                                                                        left: isEnabled ? '22px' : '2px',
                                                                        width: '20px',
                                                                        height: '20px',
                                                                        borderRadius: '50%',
                                                                        backgroundColor: '#fff',
                                                                        transition: 'left 0.2s ease'
                                                                    }} />
                                                                </div>
                                                            </div>
                                                            {isEssential && (
                                                                <p style={{ fontSize: '11px', color: 'var(--primary-600)', margin: 0, fontWeight: '500' }}>
                                                                    Essential system feature (Always enabled)
                                                                </p>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>
                    )}

                </div>
            </div>

            {/* MODALS */}
            {/* Shift Modal */}
            {showShiftModal && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    background: theme === 'dark' ? 'rgba(0, 0, 0, 0.6)' : 'rgba(0,0,0,0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000
                }}>
                    <div style={{
                        background: theme === 'dark' ? '#1e293b' : 'white',
                        borderRadius: '12px',
                        padding: '24px',
                        width: '100%',
                        maxWidth: '400px',
                        position: 'relative',
                        border: theme === 'dark' ? '1px solid #334155' : 'none'
                    }}>
                        <button
                            onClick={() => setShowShiftModal(false)}
                            style={{
                                position: 'absolute',
                                right: '16px',
                                top: '16px',
                                color: theme === 'dark' ? '#cbd5e1' : '#999',
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer'
                            }}
                        >
                            <X size={20} />
                        </button>

                        <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '20px', color: theme === 'dark' ? '#f8fafc' : '#111' }}>
                            {selectedItem ? 'Edit Shift' : 'Add Shift'}
                        </h3>

                        <form onSubmit={handleShiftSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <input
                                placeholder="Shift Name"
                                required
                                value={formData.shiftName}
                                onChange={e => setFormData({ ...formData, shiftName: e.target.value })}
                                style={{
                                    width: '100%',
                                    padding: '10px 14px',
                                    borderRadius: '8px',
                                    border: theme === 'dark' ? '1px solid #475569' : '1px solid #ddd',
                                    fontSize: '13px',
                                    backgroundColor: theme === 'dark' ? '#0f172a' : 'white',
                                    color: theme === 'dark' ? '#f8fafc' : '#0F172A',
                                }}
                            />
                            <select
                                value={formData.shiftType}
                                onChange={e => setFormData({ ...formData, shiftType: e.target.value })}
                                style={{
                                    width: '100%',
                                    padding: '10px 14px',
                                    borderRadius: '8px',
                                    border: theme === 'dark' ? '1px solid #475569' : '1px solid #ddd',
                                    fontSize: '13px',
                                    backgroundColor: theme === 'dark' ? '#0f172a' : 'white',
                                    color: theme === 'dark' ? '#f8fafc' : '#0F172A',
                                }}
                            >
                                <option value="MORNING" style={{ backgroundColor: theme === 'dark' ? '#1e293b' : 'white', color: theme === 'dark' ? '#f8fafc' : '#0F172A' }}>Morning</option>
                                <option value="EVENING" style={{ backgroundColor: theme === 'dark' ? '#1e293b' : 'white', color: theme === 'dark' ? '#f8fafc' : '#0F172A' }}>Evening</option>
                                <option value="NIGHT" style={{ backgroundColor: theme === 'dark' ? '#1e293b' : 'white', color: theme === 'dark' ? '#f8fafc' : '#0F172A' }}>Night</option>
                            </select>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <input
                                    type="time"
                                    value={formData.startTime}
                                    onChange={e => setFormData({ ...formData, startTime: e.target.value })}
                                    style={{
                                        width: '100%',
                                        padding: '10px 14px',
                                        borderRadius: '8px',
                                        border: theme === 'dark' ? '1px solid #475569' : '1px solid #ddd',
                                        fontSize: '13px',
                                        backgroundColor: theme === 'dark' ? '#0f172a' : 'white',
                                        color: theme === 'dark' ? '#f8fafc' : '#0F172A',
                                    }}
                                />
                                <input
                                    type="time"
                                    value={formData.endTime}
                                    onChange={e => setFormData({ ...formData, endTime: e.target.value })}
                                    style={{
                                        width: '100%',
                                        padding: '10px 14px',
                                        borderRadius: '8px',
                                        border: theme === 'dark' ? '1px solid #475569' : '1px solid #ddd',
                                        fontSize: '13px',
                                        backgroundColor: theme === 'dark' ? '#0f172a' : 'white',
                                        color: theme === 'dark' ? '#f8fafc' : '#0F172A',
                                    }}
                                />
                            </div>
                            <textarea
                                placeholder="Description"
                                rows={3}
                                value={formData.description}
                                onChange={e => setFormData({ ...formData, description: e.target.value })}
                                style={{
                                    width: '100%',
                                    padding: '10px 14px',
                                    borderRadius: '8px',
                                    border: theme === 'dark' ? '1px solid #475569' : '1px solid #ddd',
                                    fontSize: '13px',
                                    fontFamily: 'inherit',
                                    resize: 'vertical',
                                    backgroundColor: theme === 'dark' ? '#0f172a' : 'white',
                                    color: theme === 'dark' ? '#f8fafc' : '#0F172A',
                                }}
                            />
                            <button
                                disabled={submitting}
                                className="add-employee-btn"
                                style={{
                                    marginTop: '8px',
                                    padding: '12px',
                                    borderRadius: '8px',
                                    fontSize: '14px',
                                    fontWeight: 600,
                                    justifyContent: 'center',
                                    width: '100%'
                                }}
                            >
                                Save
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Department Modal */}
            {showDeptModal && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    background: theme === 'dark' ? 'rgba(0, 0, 0, 0.6)' : 'rgba(0,0,0,0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000
                }}>
                    <div style={{
                        background: theme === 'dark' ? '#1e293b' : 'white',
                        borderRadius: '12px',
                        padding: '24px',
                        width: '100%',
                        maxWidth: '400px',
                        position: 'relative',
                        border: theme === 'dark' ? '1px solid #334155' : 'none'
                    }}>
                        <button
                            onClick={() => setShowDeptModal(false)}
                            style={{
                                position: 'absolute',
                                right: '16px',
                                top: '16px',
                                color: theme === 'dark' ? '#cbd5e1' : '#999',
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer'
                            }}
                        >
                            <X size={20} />
                        </button>

                        <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '20px', color: theme === 'dark' ? '#f8fafc' : '#111' }}>
                            {selectedItem ? 'Edit Department' : 'Add Department'}
                        </h3>

                        <form onSubmit={handleDeptSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <input
                                placeholder="Department Name"
                                required
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                style={{
                                    width: '100%',
                                    padding: '10px 14px',
                                    borderRadius: '8px',
                                    border: theme === 'dark' ? '1px solid #475569' : '1px solid #ddd',
                                    fontSize: '13px',
                                    backgroundColor: theme === 'dark' ? '#0f172a' : 'white',
                                    color: theme === 'dark' ? '#f8fafc' : '#0F172A',
                                }}
                            />
                            <textarea
                                placeholder="Description"
                                rows={3}
                                value={formData.description}
                                onChange={e => setFormData({ ...formData, description: e.target.value })}
                                style={{
                                    width: '100%',
                                    padding: '10px 14px',
                                    borderRadius: '8px',
                                    border: theme === 'dark' ? '1px solid #475569' : '1px solid #ddd',
                                    fontSize: '13px',
                                    fontFamily: 'inherit',
                                    resize: 'vertical',
                                    backgroundColor: theme === 'dark' ? '#0f172a' : 'white',
                                    color: theme === 'dark' ? '#f8fafc' : '#0F172A',
                                }}
                            />
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer', color: theme === 'dark' ? '#cbd5e1' : '#333' }}>
                                <input type="checkbox" checked={formData.isActive} onChange={e => setFormData({ ...formData, isActive: e.target.checked })} style={{ accentColor: '#4f46e5' }} />
                                Active
                            </label>

                            <button
                                disabled={submitting}
                                className="add-employee-btn"
                                style={{
                                    marginTop: '8px',
                                    padding: '12px',
                                    borderRadius: '8px',
                                    fontSize: '14px',
                                    fontWeight: 600,
                                    justifyContent: 'center',
                                    width: '100%'
                                }}
                            >
                                Save
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Position Modal */}
            {showPosModal && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    background: theme === 'dark' ? 'rgba(0, 0, 0, 0.6)' : 'rgba(0,0,0,0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000
                }}>
                    <div style={{
                        background: theme === 'dark' ? '#1e293b' : 'white',
                        borderRadius: '12px',
                        padding: '24px',
                        width: '100%',
                        maxWidth: '400px',
                        position: 'relative',
                        border: theme === 'dark' ? '1px solid #334155' : 'none'
                    }}>
                        <button
                            onClick={() => setShowPosModal(false)}
                            style={{
                                position: 'absolute',
                                right: '16px',
                                top: '16px',
                                color: theme === 'dark' ? '#cbd5e1' : '#999',
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer'
                            }}
                        >
                            <X size={20} />
                        </button>

                        <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '20px', color: theme === 'dark' ? '#f8fafc' : '#111' }}>
                            {selectedItem ? 'Edit Position' : 'Add Position'}
                        </h3>

                        <form onSubmit={handlePosSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <input
                                placeholder="Position Title"
                                required
                                value={formData.title}
                                onChange={e => setFormData({ ...formData, title: e.target.value })}
                                style={{
                                    width: '100%',
                                    padding: '10px 14px',
                                    borderRadius: '8px',
                                    border: theme === 'dark' ? '1px solid #475569' : '1px solid #ddd',
                                    fontSize: '13px',
                                    backgroundColor: theme === 'dark' ? '#0f172a' : 'white',
                                    color: theme === 'dark' ? '#f8fafc' : '#0F172A',
                                }}
                            />
                            <input
                                type="number"
                                placeholder="Probation (Months)"
                                value={formData.probationPeriodMonths}
                                onChange={e => setFormData({ ...formData, probationPeriodMonths: parseInt(e.target.value) })}
                                style={{
                                    width: '100%',
                                    padding: '10px 14px',
                                    borderRadius: '8px',
                                    border: theme === 'dark' ? '1px solid #475569' : '1px solid #ddd',
                                    fontSize: '13px',
                                    backgroundColor: theme === 'dark' ? '#0f172a' : 'white',
                                    color: theme === 'dark' ? '#f8fafc' : '#0F172A',
                                }}
                            />
                            <textarea
                                placeholder="Description"
                                rows={3}
                                value={formData.description}
                                onChange={e => setFormData({ ...formData, description: e.target.value })}
                                style={{
                                    width: '100%',
                                    padding: '10px 14px',
                                    borderRadius: '8px',
                                    border: theme === 'dark' ? '1px solid #475569' : '1px solid #ddd',
                                    fontSize: '13px',
                                    fontFamily: 'inherit',
                                    resize: 'vertical',
                                    backgroundColor: theme === 'dark' ? '#0f172a' : 'white',
                                    color: theme === 'dark' ? '#f8fafc' : '#0F172A',
                                }}
                            />
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer', color: theme === 'dark' ? '#cbd5e1' : '#333' }}>
                                <input type="checkbox" checked={formData.isActive} onChange={e => setFormData({ ...formData, isActive: e.target.checked })} style={{ accentColor: '#4f46e5' }} />
                                Active
                            </label>

                            <button
                                disabled={submitting}
                                className="add-employee-btn"
                                style={{
                                    marginTop: '8px',
                                    padding: '12px',
                                    borderRadius: '8px',
                                    fontSize: '14px',
                                    fontWeight: 600,
                                    justifyContent: 'center',
                                    width: '100%'
                                }}
                            >
                                Save
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Leave Type Modal */}
            {showLeaveTypeModal && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    background: theme === 'dark' ? 'rgba(0, 0, 0, 0.6)' : 'rgba(15, 23, 42, 0.4)',
                    backdropFilter: 'blur(8px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                    padding: '16px'
                }}>
                    <div 
                        className="no-scrollbar"
                        style={{
                            background: theme === 'dark' ? '#1e293b' : '#ffffff',
                            borderRadius: '20px',
                            padding: '20px',
                            width: '95%',
                            maxWidth: '960px',
                            position: 'relative',
                            maxHeight: '90vh',
                            display: 'flex',
                            flexDirection: 'column',
                            overflowY: 'hidden',
                            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.15)',
                            border: theme === 'dark' ? '1px solid #334155' : '1px solid rgba(241, 245, 249, 0.8)',
                        }}
                    >
                        <button
                            onClick={() => setShowLeaveTypeModal(false)}
                            style={{
                                position: 'absolute',
                                right: '20px',
                                top: '20px',
                                color: theme === 'dark' ? '#cbd5e1' : '#64748B',
                                background: theme === 'dark' ? '#334155' : '#F8FAFC',
                                border: 'none',
                                borderRadius: '50%',
                                width: '32px',
                                height: '32px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = theme === 'dark' ? '#475569' : '#E2E8F0'; e.currentTarget.style.color = theme === 'dark' ? '#f8fafc' : '#0F172A'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = theme === 'dark' ? '#334155' : '#F8FAFC'; e.currentTarget.style.color = theme === 'dark' ? '#cbd5e1' : '#64748B'; }}
                        >
                            <X size={16} />
                        </button>

                        <div style={{ marginBottom: '16px', flexShrink: 0 }}>
                            <span style={{
                                display: 'inline-block',
                                background: theme === 'dark' ? '#1e1b4b' : '#EEF2FF',
                                color: theme === 'dark' ? '#818CF8' : '#4F46E5',
                                fontSize: '10px',
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                                padding: '3px 8px',
                                borderRadius: '9999px',
                                marginBottom: '4px'
                            }}>
                                Leave Policy System
                            </span>
                            <h3 style={{ fontSize: '18px', fontWeight: 800, color: theme === 'dark' ? '#f8fafc' : '#0F172A', margin: 0 }}>
                                {selectedItem ? 'Edit Leave Type' : 'Create Leave Type'}
                            </h3>
                        </div>

                        <form onSubmit={handleLeaveTypeSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
                            <div className="no-scrollbar" style={{ flex: 1, overflowY: 'auto', paddingRight: '4px', display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '16px' }}>
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                                gap: '16px'
                            }}>
                                {/* Column 1: Basics & Template */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    <div style={{
                                        background: theme === 'dark' ? '#0f172a' : '#F8FAFC',
                                        padding: '14px',
                                        borderRadius: '12px',
                                        border: theme === 'dark' ? '1px solid #334155' : '1px solid #E2E8F0',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '10px'
                                    }}>
                                        <h4 style={{ margin: '0 0 2px 0', fontSize: '13px', fontWeight: 700, color: theme === 'dark' ? '#f8fafc' : '#0F172A' }}>General Settings</h4>
                                        
                                        <div>
                                            <label style={{ fontSize: '10px', fontWeight: 600, color: theme === 'dark' ? '#cbd5e1' : '#475569', marginBottom: '2px', display: 'block' }}>
                                                Choose from template
                                            </label>
                                            <select
                                                value={selectedLeaveTemplate}
                                                onChange={(e) => {
                                                    const value = e.target.value;
                                                    setSelectedLeaveTemplate(value);
                                                    const leaveTypeName = LEAVE_TYPE_CODE_LABELS[value] || value;
                                                    if (value && LEAVE_TYPE_CODE_LABELS[value]) {
                                                        setFormData(prev => ({
                                                            ...prev,
                                                            leaveTypeName: leaveTypeName,
                                                            leaveTypeCode: value,
                                                        }));
                                                    } else {
                                                        setFormData(prev => ({
                                                            ...prev,
                                                            leaveTypeName: prev.leaveTypeName || '',
                                                            leaveTypeCode: prev.leaveTypeCode || '',
                                                        }));
                                                    }
                                                }}
                                                style={{
                                                    width: '100%',
                                                    padding: '6px 10px',
                                                    borderRadius: '6px',
                                                    border: theme === 'dark' ? '1px solid #475569' : '1px solid #CBD5E1',
                                                    fontSize: '12px',
                                                    fontWeight: 500,
                                                    color: theme === 'dark' ? '#f8fafc' : '#0F172A',
                                                    backgroundColor: theme === 'dark' ? '#1e293b' : 'white',
                                                    outline: 'none',
                                                }}
                                            >
                                                <option value="" style={{ backgroundColor: theme === 'dark' ? '#1e293b' : 'white', color: theme === 'dark' ? '#f8fafc' : '#0F172A' }}>Custom leave type</option>
                                                {(() => {
                                                    const createdCodes = new Set(
                                                        leaveTypes.map(lt => lt.leaveTypeCode?.toUpperCase()).filter(Boolean)
                                                    );
                                                    const remainingCodes = availableLeaveTypeCodes.filter(
                                                        code => {
                                                            const upper = code.toUpperCase();
                                                            return !createdCodes.has(upper)
                                                                && upper !== 'HALF_DAY'
                                                                && upper !== 'WFH'
                                                                && LEAVE_TYPE_CODE_LABELS[upper];
                                                        }
                                                    );
                                                    if (remainingCodes.length === 0 && availableLeaveTypeCodes.length > 0) {
                                                        return <option value="" disabled>All leave types have been created</option>;
                                                    }
                                                    if (remainingCodes.length === 0) {
                                                        return <option value="" disabled>Loading leave types...</option>;
                                                    }
                                                    return remainingCodes.map(code => {
                                                        const name = LEAVE_TYPE_CODE_LABELS[code] || code;
                                                        return (
                                                            <option key={code} value={code} style={{ backgroundColor: theme === 'dark' ? '#1e293b' : 'white', color: theme === 'dark' ? '#f8fafc' : '#0F172A' }}>
                                                                {name} ({code})
                                                            </option>
                                                        );
                                                    });
                                                })()}
                                            </select>
                                        </div>
                                        
                                        <div>
                                            <label style={{ fontSize: '10px', fontWeight: 600, color: theme === 'dark' ? '#cbd5e1' : '#475569', marginBottom: '2px', display: 'block' }}>Leave Type Name</label>
                                            <input
                                                placeholder="e.g. Annual Leave"
                                                required
                                                value={formData.leaveTypeName}
                                                onChange={e => setFormData({ ...formData, leaveTypeName: e.target.value })}
                                                style={{
                                                    width: '100%',
                                                    padding: '6px 10px',
                                                    borderRadius: '6px',
                                                    border: theme === 'dark' ? '1px solid #475569' : '1px solid #CBD5E1',
                                                    fontSize: '12px',
                                                    fontWeight: 500,
                                                    color: theme === 'dark' ? '#f8fafc' : '#0F172A',
                                                    backgroundColor: theme === 'dark' ? '#1e293b' : 'white',
                                                    outline: 'none',
                                                }}
                                            />
                                        </div>
                                        
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                            <div>
                                                <label style={{ fontSize: '10px', fontWeight: 600, color: theme === 'dark' ? '#cbd5e1' : '#475569', marginBottom: '2px', display: 'block' }}>Code</label>
                                                <input
                                                    placeholder="e.g. AL"
                                                    required
                                                    value={formData.leaveTypeCode}
                                                    onChange={e => setFormData({ ...formData, leaveTypeCode: e.target.value.toUpperCase() })}
                                                    disabled={!!selectedLeaveTemplate}
                                                    style={{
                                                        width: '100%',
                                                        padding: '6px 10px',
                                                        borderRadius: '6px',
                                                        border: theme === 'dark' ? '1px solid #475569' : '1px solid #CBD5E1',
                                                        fontSize: '12px',
                                                        fontWeight: 500,
                                                        color: selectedLeaveTemplate ? (theme === 'dark' ? '#64748b' : '#94a3b8') : (theme === 'dark' ? '#f8fafc' : '#0F172A'),
                                                        outline: 'none',
                                                        backgroundColor: selectedLeaveTemplate ? (theme === 'dark' ? '#0f172a' : '#F1F5F9') : (theme === 'dark' ? '#1e293b' : 'white'),
                                                    }}
                                                />
                                            </div>
                                            
                                            <div>
                                                <label style={{ fontSize: '10px', fontWeight: 600, color: theme === 'dark' ? '#cbd5e1' : '#475569', marginBottom: '2px', display: 'block' }}>Theme Color</label>
                                                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                                    <input
                                                        type="color"
                                                        value={formData.colorCode}
                                                        onChange={e => setFormData({ ...formData, colorCode: e.target.value })}
                                                        style={{
                                                            width: '32px',
                                                            height: '28px',
                                                            borderRadius: '4px',
                                                            border: theme === 'dark' ? '1px solid #475569' : '1px solid #CBD5E1',
                                                            padding: '1px',
                                                            cursor: 'pointer',
                                                            backgroundColor: theme === 'dark' ? '#1e293b' : 'white'
                                                        }}
                                                    />
                                                    <span style={{ fontSize: '10px', color: theme === 'dark' ? '#cbd5e1' : '#64748B', fontFamily: 'monospace' }}>{formData.colorCode}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Position Overrides Card in Column 1 */}
                                    <div style={{
                                        background: theme === 'dark' ? '#042f2e' : '#F0FDFA',
                                        padding: '14px',
                                        borderRadius: '12px',
                                        border: theme === 'dark' ? '1px solid #115e59' : '1px solid #99F6E4',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '10px'
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: theme === 'dark' ? '#2dd4bf' : '#0F766E' }}>Position Allocations</h4>
                                            <button
                                                type="button"
                                                style={{
                                                    padding: '3px 6px',
                                                    fontSize: '10px',
                                                    fontWeight: 600,
                                                    background: theme === 'dark' ? '#0d9488' : '#0F766E',
                                                    color: 'white',
                                                    border: 'none',
                                                    borderRadius: '4px',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '2px',
                                                }}
                                                onClick={() => setFormData({
                                                    ...formData,
                                                    positionAllocations: [
                                                        ...(formData.positionAllocations || []),
                                                        { positionId: '', annualAllocation: formData.defaultLeaveCount || 0 },
                                                    ],
                                                })}
                                            >
                                                <Plus size={10} /> Add
                                            </button>
                                        </div>
                                        {(formData.positionAllocations || []).length === 0 ? (
                                            <p style={{ fontSize: '10px', color: theme === 'dark' ? '#2dd4bf' : '#0D9488', margin: 0, lineHeight: 1.4 }}>
                                                Uses default annual days for all positions unless overridden.
                                            </p>
                                        ) : (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                {(formData.positionAllocations || []).map((row, index) => (
                                                    <div key={index} style={{ display: 'grid', gridTemplateColumns: '1fr 70px 24px', gap: '4px', alignItems: 'center' }}>
                                                        <select
                                                            value={row.positionId || ''}
                                                            onChange={(e) => {
                                                                const next = [...formData.positionAllocations];
                                                                next[index] = { ...next[index], positionId: e.target.value ? parseInt(e.target.value, 10) : '' };
                                                                setFormData({ ...formData, positionAllocations: next });
                                                            }}
                                                            style={{ 
                                                                padding: '4px 6px', 
                                                                borderRadius: '4px', 
                                                                border: theme === 'dark' ? '1px solid #475569' : '1px solid #CBD5E1', 
                                                                fontSize: '11px',
                                                                backgroundColor: theme === 'dark' ? '#1e293b' : 'white',
                                                                color: theme === 'dark' ? '#f8fafc' : '#0f172a',
                                                                outline: 'none'
                                                            }}
                                                        >
                                                            <option value="">Select position</option>
                                                            {positions.filter(p => p.active !== false).map((pos) => (
                                                                <option key={pos.id} value={pos.id}>{pos.title}</option>
                                                            ))}
                                                        </select>
                                                        <input
                                                            type="number"
                                                            min={0}
                                                            value={row.annualAllocation ?? ''}
                                                            onChange={(e) => {
                                                                const next = [...formData.positionAllocations];
                                                                next[index] = { ...next[index], annualAllocation: parseInt(e.target.value, 10) || 0 };
                                                                setFormData({ ...formData, positionAllocations: next });
                                                            }}
                                                            placeholder="Days"
                                                            style={{ 
                                                                padding: '4px 6px', 
                                                                borderRadius: '4px', 
                                                                border: theme === 'dark' ? '1px solid #475569' : '1px solid #CBD5E1', 
                                                                fontSize: '11px',
                                                                backgroundColor: theme === 'dark' ? '#1e293b' : 'white',
                                                                color: theme === 'dark' ? '#f8fafc' : '#0F172A',
                                                                outline: 'none'
                                                            }}
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => setFormData({
                                                                ...formData,
                                                                positionAllocations: formData.positionAllocations.filter((_, i) => i !== index),
                                                            })}
                                                            style={{ 
                                                                border: 'none', 
                                                                background: theme === 'dark' ? 'rgba(239, 68, 68, 0.2)' : '#FEE2E2', 
                                                                borderRadius: '4px',
                                                                width: '24px',
                                                                height: '24px',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                cursor: 'pointer', 
                                                                color: '#ef4444',
                                                            }}
                                                        >
                                                            <Trash2 size={11} />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Column 2: Allocation & Workflows */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    <div style={{
                                        background: theme === 'dark' ? '#0f172a' : '#F8FAFC',
                                        padding: '14px',
                                        borderRadius: '12px',
                                        border: theme === 'dark' ? '1px solid #334155' : '1px solid #E2E8F0',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '10px'
                                    }}>
                                        <h4 style={{ margin: '0 0 2px 0', fontSize: '13px', fontWeight: 700, color: theme === 'dark' ? '#f8fafc' : '#0F172A' }}>Entitlements & Limits</h4>
                                        
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                            <div>
                                                <label style={{ fontSize: '10px', fontWeight: 600, color: theme === 'dark' ? '#cbd5e1' : '#475569', marginBottom: '2px', display: 'block' }}>Annual Allocation</label>
                                                <input
                                                    type="number"
                                                    min={0}
                                                    value={formData.defaultLeaveCount}
                                                    onChange={e => setFormData({ ...formData, defaultLeaveCount: parseInt(e.target.value) || 0 })}
                                                    style={{
                                                        width: '100%',
                                                        padding: '6px 10px',
                                                        borderRadius: '6px',
                                                        border: theme === 'dark' ? '1px solid #475569' : '1px solid #CBD5E1',
                                                        fontSize: '12px',
                                                        fontWeight: 500,
                                                        color: theme === 'dark' ? '#f8fafc' : '#0F172A',
                                                        backgroundColor: theme === 'dark' ? '#1e293b' : 'white',
                                                        outline: 'none',
                                                    }}
                                                />
                                            </div>
                                            
                                            <div>
                                                <label style={{ fontSize: '10px', fontWeight: 600, color: theme === 'dark' ? '#cbd5e1' : '#475569', marginBottom: '2px', display: 'block' }}>Max Continuous</label>
                                                <input
                                                    type="number"
                                                    min={0}
                                                    placeholder="No limit"
                                                    value={formData.maxContinuousDays ?? ''}
                                                    onChange={e => setFormData({
                                                        ...formData,
                                                        maxContinuousDays: e.target.value === '' ? null : parseInt(e.target.value, 10),
                                                    })}
                                                    style={{
                                                        width: '100%',
                                                        padding: '6px 10px',
                                                        borderRadius: '6px',
                                                        border: theme === 'dark' ? '1px solid #475569' : '1px solid #CBD5E1',
                                                        fontSize: '12px',
                                                        fontWeight: 500,
                                                        color: theme === 'dark' ? '#f8fafc' : '#0F172A',
                                                        backgroundColor: theme === 'dark' ? '#1e293b' : 'white',
                                                        outline: 'none',
                                                    }}
                                                />
                                            </div>
                                        </div>

                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', alignItems: 'end' }}>
                                            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', background: theme === 'dark' ? '#1e293b' : '#fff', padding: '6px 8px', borderRadius: '6px', border: theme === 'dark' ? '1px solid #475569' : '1px solid #CBD5E1', height: '32px' }}>
                                                <span style={{ fontSize: '11px', fontWeight: 600, color: theme === 'dark' ? '#cbd5e1' : '#334155' }}>Carry Fwd</span>
                                                <div className="toggle-switch">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={formData.allowCarryforward} 
                                                        onChange={e => setFormData({ ...formData, allowCarryforward: e.target.checked })} 
                                                    />
                                                    <span className="toggle-slider"></span>
                                                </div>
                                            </label>

                                            <div>
                                                <label style={{ fontSize: '10px', fontWeight: 600, color: theme === 'dark' ? '#cbd5e1' : '#475569', marginBottom: '2px', display: 'block' }}>Carry Fwd Cap</label>
                                                <input
                                                    type="number"
                                                    min={0}
                                                    placeholder="No cap"
                                                    value={formData.maxCarryforwardLimit ?? ''}
                                                    onChange={e => setFormData({
                                                        ...formData,
                                                        maxCarryforwardLimit: e.target.value === '' ? null : parseInt(e.target.value, 10),
                                                    })}
                                                    disabled={!formData.allowCarryforward}
                                                    style={{
                                                        width: '100%',
                                                        padding: '6px 10px',
                                                        borderRadius: '6px',
                                                        border: theme === 'dark' ? '1px solid #475569' : '1px solid #CBD5E1',
                                                        fontSize: '12px',
                                                        fontWeight: 500,
                                                        color: theme === 'dark' ? '#f8fafc' : '#0F172A',
                                                        outline: 'none',
                                                        backgroundColor: formData.allowCarryforward ? (theme === 'dark' ? '#1e293b' : 'white') : (theme === 'dark' ? '#0f172a' : '#F8FAFC'),
                                                        opacity: formData.allowCarryforward ? 1 : 0.6,
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Workflow Toggles Card in Column 2 */}
                                    <div style={{
                                        background: theme === 'dark' ? '#0f172a' : '#F8FAFC',
                                        padding: '14px',
                                        borderRadius: '12px',
                                        border: theme === 'dark' ? '1px solid #334155' : '1px solid #E2E8F0',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '8px'
                                    }}>
                                        <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: theme === 'dark' ? '#f8fafc' : '#0F172A' }}>Workflow & Status</h4>
                                        <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', padding: '2px 0' }}>
                                            <span style={{ fontSize: '11px', fontWeight: 600, color: theme === 'dark' ? '#cbd5e1' : '#334155' }}>Requires Approval</span>
                                            <div className="toggle-switch">
                                                <input 
                                                    type="checkbox" 
                                                    checked={formData.requiresApproval} 
                                                    onChange={e => setFormData({ ...formData, requiresApproval: e.target.checked })} 
                                                />
                                                <span className="toggle-slider"></span>
                                            </div>
                                        </label>
                                        <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', padding: '2px 0' }}>
                                            <span style={{ fontSize: '11px', fontWeight: 600, color: theme === 'dark' ? '#cbd5e1' : '#334155' }}>Requires Document</span>
                                            <div className="toggle-switch">
                                                <input 
                                                    type="checkbox" 
                                                    checked={formData.requiresDocument} 
                                                    onChange={e => setFormData({ ...formData, requiresDocument: e.target.checked })} 
                                                />
                                                <span className="toggle-slider"></span>
                                            </div>
                                        </label>
                                    </div>
                                </div>

                                {/* Column 3: Proration & Restrictions */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {/* Proration Settings */}
                                    <div style={{
                                        background: theme === 'dark' ? '#0f172a' : '#F8FAFC',
                                        padding: '14px',
                                        borderRadius: '12px',
                                        border: theme === 'dark' ? '1px solid #334155' : '1px solid #E2E8F0',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '8px'
                                    }}>
                                        <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', padding: '2px 0' }}>
                                            <div>
                                                <span style={{ fontSize: '12px', fontWeight: 600, color: theme === 'dark' ? '#cbd5e1' : '#334155', display: 'block' }}>Enable Proration</span>
                                                <span style={{ fontSize: '9px', color: '#64748B', display: 'block', marginTop: '1px' }}>Prorate entitlement by join date</span>
                                            </div>
                                            <div className="toggle-switch">
                                                <input 
                                                    type="checkbox" 
                                                    checked={formData.prorate || false} 
                                                    onChange={e => setFormData({ ...formData, prorate: e.target.checked })} 
                                                />
                                                <span className="toggle-slider"></span>
                                            </div>
                                        </label>

                                        {formData.prorate && (
                                            <>
                                                <div style={{ borderTop: theme === 'dark' ? '1px solid #334155' : '1px solid #E2E8F0', paddingTop: '8px' }}>
                                                    <label style={{ fontSize: '10px', fontWeight: 600, color: theme === 'dark' ? '#cbd5e1' : '#475569', marginBottom: '4px', display: 'block' }}>Rounding Rule</label>
                                                    <div style={{ display: 'flex', gap: '6px' }}>
                                                        {[
                                                            { value: 'ROUND_UP', label: 'Up' },
                                                            { value: 'ROUND_DOWN', label: 'Down' },
                                                            { value: 'ROUND_WHOLE', label: 'Nearest', serverValue: 'NEAREST_WHOLE' }
                                                        ].map((rule) => {
                                                            const val = rule.serverValue || rule.value;
                                                            const checked = formData.roundingRule === val;
                                                            return (
                                                                <label key={val} style={{
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    gap: '2px',
                                                                    fontSize: '10px',
                                                                    fontWeight: 500,
                                                                    color: checked ? (theme === 'dark' ? '#c084fc' : '#4F46E5') : (theme === 'dark' ? '#cbd5e1' : '#475569'),
                                                                    cursor: 'pointer',
                                                                    background: checked ? (theme === 'dark' ? 'rgba(168, 85, 247, 0.1)' : '#EEF2FF') : (theme === 'dark' ? '#1e293b' : 'white'),
                                                                    padding: '4px 6px',
                                                                    borderRadius: '4px',
                                                                    border: checked ? `1px solid ${theme === 'dark' ? '#c084fc' : '#4F46E5'}` : (theme === 'dark' ? '1px solid #475569' : '1px solid #CBD5E1'),
                                                                    flex: 1,
                                                                    justifyContent: 'center'
                                                                }}>
                                                                    <input
                                                                        type="radio"
                                                                        name="roundingRule"
                                                                        value={val}
                                                                        checked={checked}
                                                                        onChange={() => setFormData({ ...formData, roundingRule: val })}
                                                                        style={{ display: 'none' }}
                                                                    />
                                                                    {rule.label}
                                                                </label>
                                                            );
                                                        })}
                                                    </div>
                                                </div>

                                                {/* Live Preview Box */}
                                                <div style={{
                                                    background: theme === 'dark' ? '#1e1b4b' : '#EEF2FF',
                                                    padding: '8px 10px',
                                                    borderRadius: '6px',
                                                    border: theme === 'dark' ? '1px solid #312e81' : '1px solid #C7D2FE',
                                                    marginTop: '2px'
                                                }}>
                                                    <div style={{ fontSize: '10px', color: theme === 'dark' ? '#cbd5e1' : '#4F46E5', lineHeight: '1.4' }}>
                                                        <div>Example Join: <strong>10-Jul-2026</strong> (175/365 days)</div>
                                                        <div>Prorated: <strong>{((formData.defaultLeaveCount || 0) * 175 / 365).toFixed(2)} days</strong></div>
                                                        <div style={{ marginTop: '2px', borderTop: '1px dashed currentColor', paddingTop: '2px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                            <span>Final:</span>
                                                            <strong>
                                                                {(() => {
                                                                    const ent = formData.defaultLeaveCount || 0;
                                                                    const raw = (ent * 175) / 365;
                                                                    if (formData.roundingRule === 'ROUND_UP') return Math.ceil(raw);
                                                                    if (formData.roundingRule === 'ROUND_DOWN') return Math.floor(raw);
                                                                    return Math.round(raw);
                                                                })()} days
                                                            </strong>
                                                        </div>
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                    </div>

                                    {/* Probation restrictions */}
                                    <div style={{
                                        background: theme === 'dark' ? '#1c1917' : '#FFFDF5',
                                        padding: '12px',
                                        borderRadius: '12px',
                                        border: theme === 'dark' ? '1px solid #78350f' : '1px solid #FEF08A',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '8px'
                                    }}>
                                        <h4 style={{ margin: 0, fontSize: '12px', fontWeight: 700, color: theme === 'dark' ? '#fef08a' : '#854D0E' }}>Probation Restrictions</h4>
                                        <label className="custom-checkbox-container" style={{ color: theme === 'dark' ? '#cbd5e1' : '#475569', fontSize: '11px' }}>
                                            <input 
                                                type="checkbox" 
                                                checked={formData.restrictDuringProbation} 
                                                onChange={e => setFormData({ ...formData, restrictDuringProbation: e.target.checked })} 
                                            />
                                            <span className="custom-checkmark"></span>
                                            Block during probation
                                        </label>
                                        <div>
                                            <label style={{ fontSize: '9px', fontWeight: 600, color: theme === 'dark' ? '#cbd5e1' : '#71717A', display: 'block', marginBottom: 2 }}>Probation allocation (if allowed)</label>
                                            <input
                                                type="number"
                                                min={0}
                                                placeholder="Use annual default"
                                                value={formData.probationAllocation ?? ''}
                                                onChange={e => setFormData({
                                                    ...formData,
                                                    probationAllocation: e.target.value === '' ? null : parseInt(e.target.value, 10),
                                                })}
                                                disabled={formData.restrictDuringProbation}
                                                style={{ 
                                                    width: '100%', 
                                                    padding: '4px 8px', 
                                                    borderRadius: '4px', 
                                                    border: theme === 'dark' ? '1px solid #475569' : '1px solid #E4E4E7', 
                                                    fontSize: '11px',
                                                    backgroundColor: formData.restrictDuringProbation ? (theme === 'dark' ? '#0f172a' : '#F4F4F5') : (theme === 'dark' ? '#1e293b' : 'white'),
                                                    color: theme === 'dark' ? '#f8fafc' : '#0F172A',
                                                    outline: 'none'
                                                }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Gender Restrictions (Full size rectangle below columns) */}
                            <div style={{
                                background: theme === 'dark' ? '#1e1b4b' : '#FAF5FF',
                                padding: '12px 16px',
                                borderRadius: '12px',
                                border: theme === 'dark' ? '1px solid #581c87' : '1px solid #E9D5FF',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '8px',
                                width: '100%'
                            }}>
                                <h4 style={{ margin: 0, fontSize: '12px', fontWeight: 700, color: theme === 'dark' ? '#e9d5ff' : '#6B21A8' }}>Gender Restrictions</h4>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                    {['Male', 'Female', 'Other', 'Prefer not to say'].map((gender) => {
                                        const selected = (formData.allowedGenders || '').split(',').map(s => s.trim()).filter(Boolean);
                                        const checked = selected.includes(gender);
                                        return (
                                            <label key={gender} style={{ 
                                                display: 'flex', 
                                                alignItems: 'center', 
                                                gap: '4px', 
                                                fontSize: '11px', 
                                                fontWeight: 500,
                                                color: checked ? (theme === 'dark' ? '#e9d5ff' : '#6B21A8') : (theme === 'dark' ? '#cbd5e1' : '#475569'),
                                                cursor: 'pointer',
                                                background: checked ? (theme === 'dark' ? 'rgba(168, 85, 247, 0.2)' : '#F3E8FF') : (theme === 'dark' ? '#1e293b' : 'white'),
                                                padding: '4px 10px',
                                                borderRadius: '12px',
                                                border: checked ? '1px solid #c084fc' : (theme === 'dark' ? '1px solid #475569' : '1px solid #E4E4E7'),
                                            }}>
                                                <input
                                                    type="checkbox"
                                                    checked={checked}
                                                    onChange={(e) => {
                                                        const next = e.target.checked
                                                            ? [...selected, gender]
                                                            : selected.filter(g => g !== gender);
                                                        setFormData({ ...formData, allowedGenders: next.join(',') });
                                                    }}
                                                    style={{ display: 'none' }}
                                                />
                                                {gender}
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>
                            </div>

                            {/* Sticky Modal Footer */}
                            <div style={{
                                display: 'flex',
                                justifyContent: 'center',
                                borderTop: theme === 'dark' ? '1px solid #334155' : '1px solid #E2E8F0',
                                paddingTop: '12px',
                                marginTop: '4px',
                                background: theme === 'dark' ? '#1e293b' : '#ffffff',
                                zIndex: 10,
                                flexShrink: 0
                            }}>
                                <button
                                    disabled={submitting || !hasLeaveTypeChanges()}
                                    style={{
                                        padding: '10px',
                                        borderRadius: '8px',
                                        fontSize: '13px',
                                        fontWeight: 700,
                                        background: submitting || !hasLeaveTypeChanges()
                                            ? (theme === 'dark' ? '#334155' : '#E2E8F0')
                                            : 'linear-gradient(135deg, #4F46E5 0%, #3B82F6 100%)',
                                        color: submitting || !hasLeaveTypeChanges()
                                            ? (theme === 'dark' ? '#64748B' : '#94A3B8')
                                            : 'white',
                                        border: 'none',
                                        cursor: submitting || !hasLeaveTypeChanges() ? 'not-allowed' : 'pointer',
                                        boxShadow: submitting || !hasLeaveTypeChanges() ? 'none' : '0 4px 12px rgba(79, 70, 229, 0.3)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        width: '100%',
                                        transition: 'all 0.2s'
                                    }}
                                    onMouseEnter={e => { if(!submitting && hasLeaveTypeChanges()) e.currentTarget.style.boxShadow = '0 6px 16px rgba(79, 70, 229, 0.4)'; }}
                                    onMouseLeave={e => { if(!submitting && hasLeaveTypeChanges()) e.currentTarget.style.boxShadow = '0 4px 12px rgba(79, 70, 229, 0.3)'; }}
                                >
                                    {submitting ? 'Saving Changes...' : 'Save Leave Policy'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Location Modal */}
            {showLocationModal && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    background: theme === 'dark' ? 'rgba(0, 0, 0, 0.6)' : 'rgba(0,0,0,0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000
                }}>
                    <div style={{
                        background: theme === 'dark' ? '#1e293b' : 'white',
                        borderRadius: '12px',
                        padding: '24px',
                        width: '100%',
                        maxWidth: '600px',
                        maxHeight: '90vh',
                        overflowY: 'auto',
                        position: 'relative',
                        border: theme === 'dark' ? '1px solid #334155' : 'none'
                    }}>
                        <button
                            onClick={() => setShowLocationModal(false)}
                            style={{
                                position: 'absolute',
                                right: '16px',
                                top: '16px',
                                color: theme === 'dark' ? '#cbd5e1' : '#999',
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer'
                            }}
                        >
                            <X size={20} />
                        </button>

                        <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '20px', color: theme === 'dark' ? '#f8fafc' : '#111' }}>
                            {selectedItem ? 'Edit Location' : 'Create Location'}
                        </h3>

                        <form onSubmit={handleLocationSave} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                            <div style={{ gridColumn: 'span 2' }}>
                                <label style={{ fontSize: '12px', color: theme === 'dark' ? '#cbd5e1' : '#666', marginBottom: '4px', display: 'block' }}>
                                    Location Name *
                                </label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={formData.locationName || ''}
                                    onChange={e => setFormData({ ...formData, locationName: e.target.value })}
                                    required
                                    placeholder="e.g. Head Office, Branch Office"
                                    style={{
                                        width: '100%',
                                        padding: '10px 14px',
                                        borderRadius: '8px',
                                        border: theme === 'dark' ? '1px solid #475569' : '1px solid #ddd',
                                        fontSize: '13px',
                                        backgroundColor: theme === 'dark' ? '#0f172a' : 'white',
                                        color: theme === 'dark' ? '#f8fafc' : '#111'
                                    }}
                                />
                            </div>

                            <div>
                                <label style={{ fontSize: '12px', color: theme === 'dark' ? '#cbd5e1' : '#666', marginBottom: '4px', display: 'block' }}>
                                    Location Code
                                </label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={formData.locationCode || ''}
                                    onChange={e => setFormData({ ...formData, locationCode: e.target.value.toUpperCase() })}
                                    placeholder="e.g. HO, BO1"
                                    maxLength={10}
                                    style={{
                                        width: '100%',
                                        padding: '10px 14px',
                                        borderRadius: '8px',
                                        border: theme === 'dark' ? '1px solid #475569' : '1px solid #ddd',
                                        fontSize: '13px',
                                        backgroundColor: theme === 'dark' ? '#0f172a' : 'white',
                                        color: theme === 'dark' ? '#f8fafc' : '#111'
                                    }}
                                />
                            </div>

                            <div>
                                <label style={{ fontSize: '12px', color: theme === 'dark' ? '#cbd5e1' : '#666', marginBottom: '4px', display: 'block' }}>
                                    Timezone
                                </label>
                                <select
                                    className="form-input"
                                    value={formData.timezone || 'Asia/Kolkata'}
                                    onChange={e => setFormData({ ...formData, timezone: e.target.value })}
                                    style={{
                                        width: '100%',
                                        padding: '10px 14px',
                                        borderRadius: '8px',
                                        border: theme === 'dark' ? '1px solid #475569' : '1px solid #ddd',
                                        fontSize: '13px',
                                        backgroundColor: theme === 'dark' ? '#0f172a' : 'white',
                                        color: theme === 'dark' ? '#f8fafc' : '#111'
                                    }}
                                >
                                    <option value="Asia/Kolkata" style={{ backgroundColor: theme === 'dark' ? '#1e293b' : 'white', color: theme === 'dark' ? '#f8fafc' : '#111' }}>Asia/Kolkata (IST)</option>
                                    <option value="UTC" style={{ backgroundColor: theme === 'dark' ? '#1e293b' : 'white', color: theme === 'dark' ? '#f8fafc' : '#111' }}>UTC</option>
                                    <option value="America/New_York" style={{ backgroundColor: theme === 'dark' ? '#1e293b' : 'white', color: theme === 'dark' ? '#f8fafc' : '#111' }}>America/New_York (EST)</option>
                                    <option value="America/Los_Angeles" style={{ backgroundColor: theme === 'dark' ? '#1e293b' : 'white', color: theme === 'dark' ? '#f8fafc' : '#111' }}>America/Los_Angeles (PST)</option>
                                    <option value="Europe/London" style={{ backgroundColor: theme === 'dark' ? '#1e293b' : 'white', color: theme === 'dark' ? '#f8fafc' : '#111' }}>Europe/London (GMT)</option>
                                    <option value="Asia/Dubai" style={{ backgroundColor: theme === 'dark' ? '#1e293b' : 'white', color: theme === 'dark' ? '#f8fafc' : '#111' }}>Asia/Dubai (GST)</option>
                                    <option value="Asia/Singapore" style={{ backgroundColor: theme === 'dark' ? '#1e293b' : 'white', color: theme === 'dark' ? '#f8fafc' : '#111' }}>Asia/Singapore (SGT)</option>
                                </select>
                            </div>

                            <div style={{ gridColumn: 'span 2' }}>
                                <label style={{ fontSize: '12px', color: theme === 'dark' ? '#cbd5e1' : '#666', marginBottom: '4px', display: 'block' }}>
                                    Address
                                </label>
                                <textarea
                                    className="form-input"
                                    value={formData.address || ''}
                                    onChange={e => setFormData({ ...formData, address: e.target.value })}
                                    rows={3}
                                    placeholder="Enter full address"
                                    style={{
                                        width: '100%',
                                        padding: '10px 14px',
                                        borderRadius: '8px',
                                        border: theme === 'dark' ? '1px solid #475569' : '1px solid #ddd',
                                        fontSize: '13px',
                                        resize: 'vertical',
                                        backgroundColor: theme === 'dark' ? '#0f172a' : 'white',
                                        color: theme === 'dark' ? '#f8fafc' : '#111'
                                    }}
                                />
                            </div>

                            <div>
                                <label style={{ fontSize: '12px', color: theme === 'dark' ? '#cbd5e1' : '#666', marginBottom: '4px', display: 'block' }}>
                                    Contact Person
                                </label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={formData.contactPerson || ''}
                                    onChange={e => setFormData({ ...formData, contactPerson: e.target.value })}
                                    placeholder="Contact person name"
                                    style={{
                                        width: '100%',
                                        padding: '10px 14px',
                                        borderRadius: '8px',
                                        border: theme === 'dark' ? '1px solid #475569' : '1px solid #ddd',
                                        fontSize: '13px',
                                        backgroundColor: theme === 'dark' ? '#0f172a' : 'white',
                                        color: theme === 'dark' ? '#f8fafc' : '#111'
                                    }}
                                />
                            </div>

                            <div>
                                <label style={{ fontSize: '12px', color: theme === 'dark' ? '#cbd5e1' : '#666', marginBottom: '4px', display: 'block' }}>
                                    Shift Timing
                                </label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={formData.shiftTiming || ''}
                                    onChange={e => setFormData({ ...formData, shiftTiming: e.target.value })}
                                    placeholder="e.g. 9:00 AM - 6:00 PM"
                                    style={{
                                        width: '100%',
                                        padding: '10px 14px',
                                        borderRadius: '8px',
                                        border: theme === 'dark' ? '1px solid #475569' : '1px solid #ddd',
                                        fontSize: '13px',
                                        backgroundColor: theme === 'dark' ? '#0f172a' : 'white',
                                        color: theme === 'dark' ? '#f8fafc' : '#111'
                                    }}
                                />
                            </div>

                            <div style={{ gridColumn: 'span 2', display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '8px' }}>
                                <button
                                    type="button"
                                    onClick={() => setShowLocationModal(false)}
                                    className="hr-btn-secondary"
                                    disabled={submitting}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="add-employee-btn"
                                    disabled={submitting}
                                >
                                    {submitting ? 'Saving...' : (selectedItem ? 'Update' : 'Create')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Location Users Modal */}
            {showLocationUsersModal && selectedLocationForUsers && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    background: theme === 'dark' ? 'rgba(0, 0, 0, 0.6)' : 'rgba(0,0,0,0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000
                }}>
                    <div style={{
                        background: theme === 'dark' ? '#1e293b' : 'white',
                        borderRadius: '12px',
                        padding: '24px',
                        width: '100%',
                        maxWidth: '700px',
                        maxHeight: '80vh',
                        overflowY: 'auto',
                        position: 'relative',
                        border: theme === 'dark' ? '1px solid #334155' : 'none'
                    }}>
                        <button
                            onClick={() => {
                                setShowLocationUsersModal(false);
                                setSelectedLocationForUsers(null);
                                setSelectedLocationUsers([]);
                            }}
                            style={{
                                position: 'absolute',
                                right: '16px',
                                top: '16px',
                                color: theme === 'dark' ? '#cbd5e1' : '#999',
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer'
                            }}
                        >
                            <X size={20} />
                        </button>

                        <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px', color: theme === 'dark' ? '#f8fafc' : '#111' }}>
                            Associated Users - {selectedLocationForUsers.locationName}
                        </h3>
                        <p style={{ fontSize: '13px', color: theme === 'dark' ? '#cbd5e1' : '#666', marginBottom: '20px' }}>
                            {selectedLocationUsers.length} {selectedLocationUsers.length === 1 ? 'employee' : 'employees'} assigned to this location
                        </p>

                        {selectedLocationUsers.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>
                                <Users size={48} style={{ marginBottom: '12px', opacity: 0.5 }} />
                                <p>No employees assigned to this location</p>
                            </div>
                        ) : (
                            <div className="employee-table-container">
                                <table className="employee-table">
                                    <thead>
                                        <tr>
                                            <th>Employee ID</th>
                                            <th>Name</th>
                                            <th>Email</th>
                                            <th>Department</th>
                                            <th>Position</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {selectedLocationUsers.map(emp => (
                                            <tr key={emp.id || emp.employeeId}>
                                                <td>{emp.employeeId || '-'}</td>
                                                <td style={{ fontWeight: 500 }}>
                                                    {emp.firstName} {emp.lastName}
                                                </td>
                                                <td>{emp.email || '-'}</td>
                                                <td>{emp.departmentName || emp.department?.name || '-'}</td>
                                                <td>{emp.position?.title || emp.position?.name || '-'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #e5e7eb' }}>
                            <button
                                onClick={() => {
                                    setShowLocationUsersModal(false);
                                    setSelectedLocationForUsers(null);
                                    setSelectedLocationUsers([]);
                                }}
                                className="hr-btn-secondary"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                /* Hide scrollbars for modals and specific wrapper components */
                .no-scrollbar::-webkit-scrollbar {
                    display: none !important;
                }
                .no-scrollbar {
                    -ms-overflow-style: none !important;  /* IE and Edge */
                    scrollbar-width: none !important;  /* Firefox */
                }

                /* Switch toggle slider styling */
                .toggle-switch {
                    position: relative;
                    display: inline-block;
                    width: 40px;
                    height: 20px;
                    flex-shrink: 0;
                }
                .toggle-switch input {
                    opacity: 0;
                    width: 0;
                    height: 0;
                }
                .toggle-slider {
                    position: absolute;
                    cursor: pointer;
                    inset: 0;
                    background-color: #cbd5e1;
                    transition: .3s;
                    border-radius: 9999px;
                }
                .toggle-slider:before {
                    position: absolute;
                    content: "";
                    height: 14px;
                    width: 14px;
                    left: 3px;
                    bottom: 3px;
                    background-color: white;
                    transition: .3s;
                    border-radius: 50%;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.15);
                }
                .toggle-switch input:checked + .toggle-slider {
                    background-color: #4F46E5;
                }
                .toggle-switch input:checked + .toggle-slider:before {
                    transform: translateX(20px);
                }

                /* Dark mode overrides for toggle slider */
                [data-theme='dark'] .toggle-slider {
                    background-color: #475569;
                }
                [data-theme='dark'] .toggle-switch input:checked + .toggle-slider {
                    background-color: #6366f1;
                }

                /* Dark Mode styling overrides for AdminSettings Modals and Controls */
                [data-theme='dark'] .form-input,
                [data-theme='dark'] input[type="text"],
                [data-theme='dark'] input[type="number"],
                [data-theme='dark'] input[type="time"],
                [data-theme='dark'] select,
                [data-theme='dark'] textarea {
                    color-scheme: dark;
                    background-color: #1e293b !important;
                    color: #f8fafc !important;
                    border-color: #475569 !important;
                }
                [data-theme='dark'] select option {
                    background-color: #1e293b !important;
                    color: #f8fafc !important;
                }
                [data-theme='dark'] input::placeholder,
                [data-theme='dark'] textarea::placeholder {
                    color: #94a3b8 !important;
                    opacity: 0.8;
                }
                [data-theme='dark'] input[type="checkbox"]:not(.toggle-switch input) {
                    color-scheme: dark;
                    accent-color: #6366f1 !important;
                }
                [data-theme='dark'] label {
                    color: #cbd5e1 !important;
                }

                /* Custom checkbox container */
                .custom-checkbox-container {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    cursor: pointer;
                    user-select: none;
                    font-size: 13px;
                    font-weight: 600;
                }
                /* Hide default checkbox */
                .custom-checkbox-container input {
                    position: absolute;
                    opacity: 0;
                    cursor: pointer;
                    height: 0;
                    width: 0;
                }
                /* Custom checkmark box */
                .custom-checkmark {
                    height: 18px;
                    width: 18px;
                    background-color: white;
                    border: 1px solid #CBD5E1;
                    border-radius: 4px;
                    display: inline-block;
                    position: relative;
                    transition: all 0.2s;
                    flex-shrink: 0;
                }
                /* Background color when checked */
                .custom-checkbox-container input:checked ~ .custom-checkmark {
                    background-color: #854D0E;
                    border-color: #854D0E;
                }
                /* Hidden check icon indicator */
                .custom-checkmark:after {
                    content: "";
                    position: absolute;
                    display: none;
                }
                /* Show check icon when checked */
                .custom-checkbox-container input:checked ~ .custom-checkmark:after {
                    display: block;
                }
                /* Draw white checkmark icon inside */
                .custom-checkbox-container .custom-checkmark:after {
                    left: 5px;
                    top: 1px;
                    width: 5px;
                    height: 10px;
                    border: solid white;
                    border-width: 0 2px 2px 0;
                    transform: rotate(45deg);
                }

                /* Dark mode checkbox overrides */
                [data-theme='dark'] .custom-checkmark {
                    background-color: #1e293b;
                    border-color: #475569;
                }
                [data-theme='dark'] .custom-checkbox-container input:checked ~ .custom-checkmark {
                    background-color: #eab308;
                    border-color: #eab308;
                }
                [data-theme='dark'] .custom-checkbox-container input:checked ~ .custom-checkmark:after {
                    border-color: #0f172a;
                }
            `}</style>
        </div>
    );
}
