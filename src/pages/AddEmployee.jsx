import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import Header from '../components/Header';
import { toast } from 'react-hot-toast';
import { adminAPI, locationsAPI, documentAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import {
  formatLimitReachedMessage,
  getApiErrorMessage,
  isEmployeeLimitError,
} from '../utils/employeeLimitUtils';
import {
  mapSelfFillToEmployeeForm,
  getSubmittedDocumentNames,
} from '../utils/employeeSelfFillUtils';
import {
    User,
    Briefcase,
    FileText,
    Lock,
    Upload,
    Calendar,
    Mail,
    Phone,
    Save,
    X,
    ChevronDown,
    Loader2,
    Eye,
    Download,
    Trash2,
    ExternalLink
} from 'lucide-react';

import { Country, State, City } from 'country-state-city';

const getSelectedCountryIsoCode = (nationality) => {
    if (!nationality) return '';
    if (nationality === 'Other') return '';
    
    const legacyMap = {
        'Indian': 'IN',
        'American': 'US',
        'British': 'GB',
        'Canadian': 'CA',
        'Australian': 'AU',
        'Singaporean': 'SG',
        'Emirati': 'AE',
        'German': 'DE',
        'French': 'FR',
        'Japanese': 'JP'
    };
    if (legacyMap[nationality]) return legacyMap[nationality];

    const found = Country.getAllCountries().find(c => 
        c.name.toLowerCase() === nationality.toLowerCase() || 
        c.isoCode.toLowerCase() === nationality.toLowerCase()
    );
    return found ? found.isoCode : '';
};

function SearchableSelect({ value, onChange, options, placeholder = "Select option", emptyMessage = "No options found", disabled = false }) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [hoveredIdx, setHoveredIdx] = useState(-1);
    const containerRef = useRef(null);

    useEffect(() => {
        function handleClickOutside(event) {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const filtered = options.filter(opt =>
        String(opt.label || opt.value || opt).toLowerCase().includes(search.toLowerCase())
    );

    const selectedOption = options.find(opt => (opt.value !== undefined ? opt.value : opt) === value);
    const displayLabel = selectedOption ? (selectedOption.label || selectedOption.value) : value || '';

    return (
        <div className="relative" ref={containerRef} style={{ position: 'relative' }}>
            <button
                type="button"
                onClick={() => { if (!disabled) { setIsOpen(!isOpen); setSearch(''); } }}
                disabled={disabled}
                className="w-full flex items-center justify-between border border-gray-300 bg-gray-50 rounded-md px-3 py-2 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 min-h-[38px]"
                style={{
                    width: '100%',
                    textAlign: 'left',
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    opacity: disabled ? 0.6 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    backgroundColor: '#f9fafb',
                    color: '#374151',
                    border: '1px solid #d1d5db',
                    padding: '8px 12px',
                    borderRadius: '6px'
                }}
            >
                <span className="truncate" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {displayLabel || placeholder}
                </span>
                <ChevronDown size={16} className="text-gray-400 ml-2 shrink-0" style={{ color: '#9ca3af', flexShrink: 0 }} />
            </button>
            {isOpen && (
                <div 
                    style={{
                        position: 'absolute',
                        zIndex: 9999,
                        marginTop: '4px',
                        width: '100%',
                        backgroundColor: '#ffffff',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                        display: 'flex',
                        flexDirection: 'column',
                        maxHeight: '240px',
                        overflow: 'hidden'
                    }}
                >
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search..."
                        style={{
                            width: '100%',
                            borderBottom: '1px solid #e5e7eb',
                            padding: '8px 12px',
                            fontSize: '14px',
                            outline: 'none',
                            backgroundColor: '#ffffff',
                            color: '#1f2937'
                        }}
                        onClick={(e) => e.stopPropagation()}
                        autoFocus
                    />
                    <div style={{ maxHeight: '180px', overflowY: 'auto', width: '100%' }} className="custom-scrollbar">
                        {filtered.length === 0 ? (
                            <div style={{ padding: '8px 12px', fontSize: '14px', color: '#9ca3af' }}>{emptyMessage}</div>
                        ) : (
                            filtered.map((opt, idx) => {
                                const val = opt.value !== undefined ? opt.value : opt;
                                const lbl = opt.label || opt;
                                const isSelected = value === val;
                                return (
                                    <button
                                        key={idx}
                                        type="button"
                                        onMouseEnter={() => setHoveredIdx(idx)}
                                        onMouseLeave={() => setHoveredIdx(-1)}
                                        style={{
                                            width: '100%',
                                            textAlign: 'left',
                                            padding: '8px 12px',
                                            fontSize: '14px',
                                            border: 'none',
                                            cursor: 'pointer',
                                            display: 'block',
                                            backgroundColor: isSelected ? '#eff6ff' : (hoveredIdx === idx ? '#f3f4f6' : '#ffffff'),
                                            color: isSelected ? '#1d4ed8' : (hoveredIdx === idx ? '#2563eb' : '#374151'),
                                            fontWeight: isSelected ? '600' : '400'
                                        }}
                                        onClick={() => {
                                            onChange(val);
                                            setIsOpen(false);
                                        }}
                                    >
                                        {lbl}
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

const DRAFT_KEY = 'addEmployee_draft';
const AUTOSAVE_DEBOUNCE_MS = 2000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalizeEmail = (value) =>
    String(value || '')
        .trim()
        .replace(/^mailto:/i, '')
        .trim()
        .toLowerCase();

const initialFormState = {
    firstName: '', lastName: '', phoneNumber: '', email: '', dateOfBirth: '', maritalStatus: '', gender: '', otherGender: '', nationality: '', otherNationality: '',
    address: '', city: '', otherCity: '', state: '', otherState: '', zipCode: '', emergencyContact: '', emergencyPhone: '', bloodGroup: '',
    employeeId: '', userName: '', employeeType: '', professionalEmail: '', departmentId: '', positionId: '', designation: '',
    workingDays: '', joiningDate: '', officeLocation: '', employeeRoleId: '', shiftId: '', salary: '', panNumber: '', reportingManagerId: '',
    uanNumber: '', aadhaarNumber: '', highestQualification: '', primarySkills: '', secondarySkills: '', experienceYears: '', sourceOfHire: '', workLocation: '',
    appointmentLetter: null, salarySlips: null, relivingLetter: null, relievingLetter: null, experienceLetter: null,
    slackId: '', skypeId: ''
};

function getDraft() {
    // Draft feature disabled
    return null;
}
function setDraft(formData, activeTab) {
    // Draft feature disabled – no-op
    return;
}
function clearDraft() {
    // Draft feature disabled – no-op
    return;
}

export default function AddEmployee() {
    const navigate = useNavigate();
    const { id } = useParams();
    const location = useLocation();
    // Treat any /edit URL as edit mode, even if params are missing or malformed
    const isEditMode = !!id || location.pathname.includes('/edit');

    const appointmentRef = useRef(null);
    const salaryRef = useRef(null);
    const relivingRef = useRef(null);
    const experienceRef = useRef(null);

    // ─── Role hierarchy ───────────────────────────────────────────────────────
    // ADMIN → CEO → HR → MANAGER → EMPLOYEE
    const { user, adminUser, sessionType } = useAuth();

    const ROLE_HIERARCHY_ALLOWED = {
        ADMIN:    ['ADMIN', 'CEO', 'HR', 'MANAGER', 'EMPLOYEE'],
        CEO:      ['CEO', 'HR', 'MANAGER', 'EMPLOYEE'],
        HR:       ['HR', 'MANAGER', 'EMPLOYEE'],
        MANAGER:  [],
        EMPLOYEE: [],
    };

    const currentUserRole = useMemo(() => {
        if (sessionType === 'admin') return 'ADMIN';
        if (sessionType === 'employee' && user) {
            // Prefer displayRoles (real names) — user.roles has CEO mapped to "HR" by backend
            const roleList = ((user.displayRoles?.length ? user.displayRoles : user.roles) || []).map(r => String(r).toUpperCase());
            for (const r of ['CEO', 'HR', 'MANAGER', 'EMPLOYEE']) {
                if (roleList.includes(r)) return r;
            }
            if (user.role?.name) return user.role.name.toUpperCase();
        }
        return 'ADMIN'; // Default: treat unknown as ADMIN for backward compatibility
    }, [sessionType, user, adminUser]);

    const allowedRoleNames = ROLE_HIERARCHY_ALLOWED[currentUserRole] || ROLE_HIERARCHY_ALLOWED['ADMIN'];
    // ─────────────────────────────────────────────────────────────────────────

    const [departments, setDepartments] = useState([]);
    const [positions, setPositions] = useState([]);
    const [roles, setRoles] = useState([]);
    const [shifts, setShifts] = useState([]);
    const [locations, setLocations] = useState([]);
    const [allEmployees, setAllEmployees] = useState([]);

    const [activeTab, setActiveTab] = useState('personal');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [draftRestored, setDraftRestored] = useState(false);
    const [employeeIdForUpdate, setEmployeeIdForUpdate] = useState(null);
    const [employeeStringIdForDocs, setEmployeeStringIdForDocs] = useState('');
    const [existingDocuments, setExistingDocuments] = useState([]);
    const [loadingDocuments, setLoadingDocuments] = useState(false);
    const [viewingDoc, setViewingDoc] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [loadingPreview, setLoadingPreview] = useState(false);
    const [deleteTargetDoc, setDeleteTargetDoc] = useState(null);
    const [deleteSelfFillTargetDoc, setDeleteSelfFillTargetDoc] = useState(null);
    const [deletingDoc, setDeletingDoc] = useState(false);
    const [employeeLimit, setEmployeeLimit] = useState(null);
    const [selfFillRequest, setSelfFillRequest] = useState(null);
    const [selfFillLoading, setSelfFillLoading] = useState(false);
    const [sendingSelfFill, setSendingSelfFill] = useState(false);
    const [selfFillDocNote, setSelfFillDocNote] = useState('');
    const [formData, setFormData] = useState(() => {
        const draft = getDraft();
        if (draft?.formData) {
            const restored = { ...initialFormState, ...draft.formData };
            // Always reset employeeId so we rely on backend format preview
            restored.employeeId = '';
            return restored;
        }
        return { ...initialFormState };
    });

    const managers = useMemo(() => {
        return allEmployees.filter(e => {
            // Check if this employee is the current manager (check both numeric id and formatted employeeId)
            const isCurrentManager = isEditMode && formData.reportingManagerId &&
                (String(e.id) === String(formData.reportingManagerId) ||
                    (e.employeeId && String(e.employeeId) === String(formData.reportingManagerId)));

            // Allow current manager even if they are inactive (so the assigned name shows up)
            if (e.isActive === false && !isCurrentManager) return false;

            // Crucial: An employee cannot report to themselves.
            if (isEditMode && String(e.id) === String(id)) return false;

            const roleName = (e.employeeRoleName || e.roleName || e.employeeRole?.name || e.role?.name || '').toUpperCase().trim();
            const isManagerOrAdmin = ['MANAGER', 'ADMIN', 'HR', 'CEO'].includes(roleName);

            return isManagerOrAdmin || isCurrentManager;
        });
    }, [allEmployees, isEditMode, formData.reportingManagerId, id]);

    const [errors, setErrors] = useState({});
    const [nextEmployeeId, setNextEmployeeId] = useState('');
    const [checkingEmail, setCheckingEmail] = useState(false);
    const [checkingProfessionalEmail, setCheckingProfessionalEmail] = useState(false);

    // Country, State, City hooks using country-state-city
    const countries = useMemo(() => Country.getAllCountries(), []);

    const countryOptions = useMemo(() => {
        const list = countries.map(c => ({
            value: c.name,
            label: `${c.flag || ''} ${c.name} (${c.isoCode})`
        }));
        list.push({ value: 'Other', label: 'Other' });
        return list;
    }, [countries]);

    const selectedCountryIso = useMemo(() => {
        return getSelectedCountryIsoCode(formData.country || formData.nationality);
    }, [formData.country, formData.nationality]);

    const stateOptions = useMemo(() => {
        if (!selectedCountryIso) return [];
        const list = State.getStatesOfCountry(selectedCountryIso).map(s => ({
            value: s.name,
            label: s.name
        }));
        list.push({ value: 'Other', label: 'Other' });
        return list;
    }, [selectedCountryIso]);

    const selectedStateIso = useMemo(() => {
        if (!selectedCountryIso || !formData.state || formData.state === 'Other') return '';
        const foundState = State.getStatesOfCountry(selectedCountryIso).find(s => 
            s.name.toLowerCase() === formData.state.toLowerCase()
        );
        return foundState ? foundState.isoCode : '';
    }, [selectedCountryIso, formData.state]);

    const cityOptions = useMemo(() => {
        if (!selectedCountryIso || !selectedStateIso) return [];
        const list = City.getCitiesOfState(selectedCountryIso, selectedStateIso).map(c => ({
            value: c.name,
            label: c.name
        }));
        list.push({ value: 'Other', label: 'Other' });
        return list;
    }, [selectedCountryIso, selectedStateIso]);

    const handleCustomChange = (name, value) => {
        setFormData(prev => {
            const next = { ...prev, [name]: value };
            if (name === 'nationality') {
                next.state = '';
                next.otherState = '';
                next.city = '';
                next.otherCity = '';
                next.zipCode = '';
            } else if (name === 'state') {
                next.city = '';
                next.otherCity = '';
                next.zipCode = '';
            }
            return next;
        });

        // Validate the field
        const fieldError = validateField(name, value);
        setErrors(prev => ({ ...prev, [name]: fieldError }));
    };

    useEffect(() => {
        const draft = getDraft();
        if (draft?.formData) {
            if (draft.activeTab) setActiveTab(draft.activeTab);
            setDraftRestored(true);
            const t = setTimeout(() => setDraftRestored(false), 4000);
            return () => clearTimeout(t);
        }
    }, []);

    useEffect(() => {
        // Don't autosave draft if we're in edit mode and still loading employee data
        if (isEditMode && loading) return;
        const timer = setTimeout(() => setDraft(formData, activeTab), AUTOSAVE_DEBOUNCE_MS);
        return () => clearTimeout(timer);
    }, [formData, activeTab, isEditMode, loading]);

    // Live email check for personal email
    useEffect(() => {
        const email = normalizeEmail(formData.email);
        if (!email || !EMAIL_PATTERN.test(email) || isEditMode) {
            setCheckingEmail(false);
            return;
        }

        let cancelled = false;
        const timer = setTimeout(async () => {
            setCheckingEmail(true);
            try {
                const res = await adminAPI.checkEmployeeEmail(email);
                if (cancelled) return;
                const exists = res.data?.exists || res.data?.data?.exists || (typeof res.data === 'boolean' && res.data);
                if (exists) {
                    setErrors(prev => ({ ...prev, email: 'Email already exists in the system' }));
                } else {
                    setErrors(prev => ({ ...prev, email: '' }));
                }
            } catch (err) {
                console.error('Error checking email:', err);
            } finally {
                if (!cancelled) setCheckingEmail(false);
            }
        }, 800);
        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [formData.email, isEditMode]);

    // Live check for professional email
    useEffect(() => {
        const email = normalizeEmail(formData.professionalEmail);
        if (!email || !EMAIL_PATTERN.test(email) || isEditMode) {
            setCheckingProfessionalEmail(false);
            return;
        }

        let cancelled = false;
        const timer = setTimeout(async () => {
            setCheckingProfessionalEmail(true);
            try {
                const res = await adminAPI.checkEmployeeEmail(email);
                if (cancelled) return;
                const exists = res.data?.exists || res.data?.data?.exists || (typeof res.data === 'boolean' && res.data);
                if (exists) {
                    setErrors(prev => ({ ...prev, professionalEmail: 'Professional email already exists' }));
                } else {
                    setErrors(prev => ({ ...prev, professionalEmail: '' }));
                }
            } catch (err) {
                console.error('Error checking professional email:', err);
            } finally {
                if (!cancelled) setCheckingProfessionalEmail(false);
            }
        }, 800);
        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [formData.professionalEmail, isEditMode]);

    // Fetch employee data if in edit mode
    useEffect(() => {
        if (isEditMode) {
            const loadEmployeeData = async () => {
                try {
                    setLoading(true);
                    const targetId = id;
                    if (!targetId) return;

                    // Prefer enhanced employee API for richer data / consistent DTO
                    const res = await adminAPI.getEnhancedEmployeeById(targetId).catch(async () => {
                        return await adminAPI.getEmployeeById(targetId);
                    });

                    const empData = res.data?.data || res.data;

                    if (empData) {
                        console.log('📥 Loaded employee data:', empData);
                        console.log('📥 maritalStatus:', empData.maritalStatus, 'type:', typeof empData.maritalStatus);
                        console.log('📥 gender:', empData.gender, 'type:', typeof empData.gender);
                        console.log('📥 nationality:', empData.nationality, 'type:', typeof empData.nationality);

                        setEmployeeIdForUpdate(empData.id || targetId);
                        setEmployeeStringIdForDocs(empData.employeeId || '');
                        const genderOptions = ["Male", "Female", "Other", "Prefer not to say"];

                        const backendGender = (empData.gender && String(empData.gender).trim()) || '';
                        const isCustomGender = backendGender && !genderOptions.includes(backendGender);

                        const backendNationality = (empData.nationality && String(empData.nationality).trim()) || '';
                        const countryIso = getSelectedCountryIsoCode(backendNationality);
                        
                        let mappedNationality = backendNationality;
                        let otherNationalityVal = '';
                        if (backendNationality && !countryIso) {
                            mappedNationality = 'Other';
                            otherNationalityVal = backendNationality;
                        }

                        // Determine state
                        const backendState = empData.state || empData.presentState || '';
                        let mappedState = backendState;
                        let otherStateVal = '';
                        if (countryIso && backendState) {
                            const statesList = State.getStatesOfCountry(countryIso);
                            const foundState = statesList.find(s => s.name.toLowerCase() === backendState.toLowerCase());
                            if (!foundState) {
                                mappedState = 'Other';
                                otherStateVal = backendState;
                            } else {
                                mappedState = foundState.name;
                            }
                        } else if (backendState) {
                            mappedState = 'Other';
                            otherStateVal = backendState;
                        }

                        // Determine city
                        const backendCity = empData.city || empData.presentCity || '';
                        let mappedCity = backendCity;
                        let otherCityVal = '';
                        if (countryIso && mappedState && mappedState !== 'Other' && backendCity) {
                            const resolvedStateIso = State.getStatesOfCountry(countryIso).find(s => s.name.toLowerCase() === mappedState.toLowerCase())?.isoCode;
                            if (resolvedStateIso) {
                                const citiesList = City.getCitiesOfState(countryIso, resolvedStateIso);
                                const foundCity = citiesList.find(c => c.name.toLowerCase() === backendCity.toLowerCase());
                                if (!foundCity) {
                                    mappedCity = 'Other';
                                    otherCityVal = backendCity;
                                } else {
                                    mappedCity = foundCity.name;
                                }
                            } else {
                                mappedCity = 'Other';
                                otherCityVal = backendCity;
                            }
                        } else if (backendCity) {
                            mappedCity = 'Other';
                            otherCityVal = backendCity;
                        }

                        const loadedFormData = {
                            firstName: empData.firstName || '',
                            lastName: empData.lastName || '',
                            phoneNumber: empData.phoneNumber || '',
                            email: empData.email || '',
                            dateOfBirth: empData.dateOfBirth || empData.dob || '',
                            maritalStatus: (empData.maritalStatus && String(empData.maritalStatus).trim()) || '',
                            gender: isCustomGender ? 'Other' : backendGender,
                            otherGender: isCustomGender ? backendGender : '',
                            nationality: mappedNationality,
                            otherNationality: otherNationalityVal,
                            address: empData.address || empData.presentAddressLine1 || '',
                            city: mappedCity,
                            otherCity: otherCityVal,
                            state: mappedState,
                            otherState: otherStateVal,
                            zipCode: empData.zipCode || empData.presentPostalCode || '',
                            emergencyContact: empData.emergencyContact || empData.emergencyContactName || '',
                            emergencyPhone: empData.emergencyPhone || empData.emergencyContactPhone || '',
                            bloodGroup: empData.bloodGroup || '',
                            employeeId: empData.employeeId || '',
                            userName: empData.userName || '',
                            employeeType: empData.employeeType || '',
                            professionalEmail: empData.professionalEmail || empData.officialEmail || empData.email || '',
                            departmentId: empData.departmentId || empData.department?.id || '',
                            positionId: empData.positionId || empData.position?.id || '',
                            designation: empData.designation || empData.jobTitle || '',
                            workingDays: empData.workingDays || '',
                            joiningDate: empData.joiningDate || empData.hireDate || '',
                            officeLocation: empData.locationId || empData.location?.id || '',
                            employeeRoleId: empData.employeeRoleId || empData.employeeRole?.id || '',
                            shiftId: empData.shiftId || empData.shift?.id || '',
                            salary: empData.salary || '',
                            panNumber: empData.panNumber || '',
                            reportingManagerId: empData.reportingManagerId ? String(empData.reportingManagerId) : (empData.reportingManager?.id ? String(empData.reportingManager.id) : ''),
                            uanNumber: empData.uanNumber || '',
                            aadhaarNumber: empData.aadhaarNumber || '',
                            highestQualification: empData.highestQualification || '',
                            primarySkills: empData.primarySkills || '',
                            secondarySkills: empData.secondarySkills || '',
                            experienceYears: empData.experienceYears || '',
                            sourceOfHire: empData.sourceOfHire || '',
                            workLocation: empData.workLocation || '',
                            slackId: empData.slackId || '',
                            skypeId: empData.skypeId || '',
                            appointmentLetter: null,
                            salarySlips: null,
                            relivingLetter: null,
                            relievingLetter: null,
                            experienceLetter: null,
                        };
                        console.log('📝 Setting formData - maritalStatus:', loadedFormData.maritalStatus, 'gender:', loadedFormData.gender, 'nationality:', loadedFormData.nationality);
                        setFormData(loadedFormData);

                        // Fetch existing documents for this employee
                        const docSearchId = empData.employeeId || targetId;
                        if (docSearchId) {
                            setLoadingDocuments(true);
                            try {
                                const docRes = await documentAPI.getEmployeeDocuments(docSearchId);
                                setExistingDocuments(Array.isArray(docRes.data) ? docRes.data : (Array.isArray(docRes) ? docRes : []));
                            } catch (docErr) {
                                console.warn('Failed to load existing documents for employee:', docErr);
                            } finally {
                                setLoadingDocuments(false);
                            }
                        }
                    }
                } catch (err) {
                    console.error('Error loading employee data:', err);
                    setError('Failed to load employee data. Please refresh.');
                } finally {
                    setLoading(false);
                }
            };
            loadEmployeeData();
        }
    }, [isEditMode, id]);

    const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDrop = (e, field) => {
        e.preventDefault();
        e.stopPropagation();
        const files = e.dataTransfer?.files;
        if (files && files[0]) {
            setFormData(prev => ({ ...prev, [field]: files[0] }));
            setErrors(prev => ({ ...prev, [field]: '' }));
        }
    };

    const handleDeleteExistingDoc = (doc) => {
        setDeleteTargetDoc(doc);
    };

    const handleConfirmDeleteDoc = async () => {
        if (!deleteTargetDoc) return;
        setDeletingDoc(true);
        try {
            const empIdToUse = employeeStringIdForDocs || employeeIdForUpdate || id;
            await documentAPI.deleteEmployeeDocument(empIdToUse, deleteTargetDoc.id);
            toast.success("Document deleted successfully");
            setExistingDocuments(prev => prev.filter(d => d.id !== deleteTargetDoc.id));
            setDeleteTargetDoc(null);
        } catch (err) {
            console.error("Failed to delete document:", err);
            toast.error(err.response?.data?.message || err.response?.data?.error || "Failed to delete document");
        } finally {
            setDeletingDoc(false);
        }
    };

    const handleDownloadExistingDoc = async (doc) => {
        try {
            if (doc.fileData) {
                const link = document.createElement("a");
                link.href = `data:${doc.mimeType};base64,${doc.fileData}`;
                link.download = doc.originalFileName;
                link.click();
                return;
            }
            const empIdToUse = employeeStringIdForDocs || employeeIdForUpdate || id;
            const res = await documentAPI.downloadDocument(doc.id);
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', doc.originalFileName);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error("Download failed:", err);
            toast.error("Download failed");
        }
    };

    const handleViewExistingDoc = async (doc) => {
        console.log("👁️ Opening preview for document:", doc);
        setViewingDoc(doc);
        if (doc.fileData) {
            setPreviewUrl(`data:${doc.mimeType || 'image/jpeg'};base64,${doc.fileData}`);
        } else {
            setLoadingPreview(true);
            try {
                const res = await documentAPI.previewDocument(doc.id);
                const contentType = doc.mimeType || res.headers?.['content-type'] || 'application/pdf';
                const url = window.URL.createObjectURL(new Blob([res.data], { type: contentType }));
                setPreviewUrl(url);
            } catch (e) {
                console.error("Preview failed, trying download fallback:", e);
                try {
                    const res = await documentAPI.downloadDocument(doc.id);
                    const contentType = doc.mimeType || res.headers?.['content-type'] || 'application/pdf';
                    const url = window.URL.createObjectURL(new Blob([res.data], { type: contentType }));
                    setPreviewUrl(url);
                } catch (fallbackErr) {
                    console.error("Download fallback failed:", fallbackErr);
                    toast.error("Could not load document preview");
                }
            } finally {
                setLoadingPreview(false);
            }
        }
    };

    const handleViewSelfFillDoc = async (item) => {
        if (!selfFillRequest?.id) return;
        // Reset state first to prevent flickering of previous preview image/iframe
        if (previewUrl && previewUrl.startsWith('blob:')) {
            window.URL.revokeObjectURL(previewUrl);
        }
        setPreviewUrl(null);
        
        let determinedMime = 'application/pdf';
        const name = (item.name || '').toLowerCase();
        if (name.endsWith('.jpg') || name.endsWith('.jpeg')) determinedMime = 'image/jpeg';
        else if (name.endsWith('.png')) determinedMime = 'image/png';
        else if (name.endsWith('.webp')) determinedMime = 'image/webp';
        else if (name.endsWith('.gif')) determinedMime = 'image/gif';

        setViewingDoc({ originalFileName: item.name, documentType: item.field, mimeType: determinedMime });
        setLoadingPreview(true);
        try {
            const res = await adminAPI.previewSelfFillDocument(selfFillRequest.id, item.field);
            const contentType = res.headers?.['content-type'] || determinedMime;
            const url = window.URL.createObjectURL(new Blob([res.data], { type: contentType }));
            setPreviewUrl(url);
        } catch (err) {
            console.error("Failed to preview self-fill doc:", err);
            toast.error("Could not preview self-fill document");
        } finally {
            setLoadingPreview(false);
        }
    };

    const handleDownloadSelfFillDoc = async (item) => {
        if (!selfFillRequest?.id) return;
        try {
            const res = await adminAPI.downloadSelfFillDocument(selfFillRequest.id, item.field);
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', item.name);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error("Failed to download self-fill doc:", err);
            toast.error("Could not download self-fill document");
        }
    };

    const handleDeleteSelfFillDoc = (item) => {
        setDeleteSelfFillTargetDoc(item);
    };

    const handleConfirmDeleteSelfFillDoc = async () => {
        if (!deleteSelfFillTargetDoc || !selfFillRequest?.id || !selfFillRequest?.formData?.documents) return;
        setDeletingDoc(true);
        try {
            await adminAPI.deleteSelfFillDocument(selfFillRequest.id, deleteSelfFillTargetDoc.field);
            const updatedDocs = { ...selfFillRequest.formData.documents };
            delete updatedDocs[deleteSelfFillTargetDoc.field];
            setSelfFillRequest(prev => ({
                ...prev,
                formData: {
                    ...prev.formData,
                    documents: updatedDocs
                }
            }));
            toast.success(`Removed ${deleteSelfFillTargetDoc.name} permanently`);
            setDeleteSelfFillTargetDoc(null);
        } catch (err) {
            console.error("Failed to delete self-fill doc from backend:", err);
            toast.error(err.response?.data?.message || err.message || "Failed to remove document");
        } finally {
            setDeletingDoc(false);
        }
    };

    const closePreviewModal = () => {
        if (previewUrl && previewUrl.startsWith('blob:')) {
            window.URL.revokeObjectURL(previewUrl);
        }
        setViewingDoc(null);
        setPreviewUrl(null);
    };

    // Fetch initial data
    useEffect(() => {
        const fetchDropdowns = async () => {
            try {
                setLoading(true);
                const [deptRes, posRes, roleRes, shiftRes, locRes, empRes, empIdFormatRes, limitRes] = await Promise.all([
                    adminAPI.getActiveDepartments(),
                    adminAPI.getActivePositions(),
                    adminAPI.getActiveEmployeeRoles(),
                    adminAPI.getAllShifts(),
                    locationsAPI.list(),
                    adminAPI.getAllEmployees(),
                    !isEditMode ? adminAPI.getEmployeeIdFormat() : Promise.resolve({ data: {} }),
                    !isEditMode ? adminAPI.getEmployeeLimit() : Promise.resolve({ data: null }),
                ]);

                setDepartments(deptRes.data || []);
                setPositions(posRes.data || []);
                setRoles(roleRes.data || []);
                setShifts(shiftRes.data || shiftRes.data?.data || []);
                if (!isEditMode) {
                    setEmployeeLimit(limitRes.data || null);
                }

                // Locations: support multiple response shapes (paged items, plain array, or content)
                const locData = locRes.data;
                const normalizedLocations = Array.isArray(locData?.items)
                    ? locData.items
                    : Array.isArray(locData)
                        ? locData
                        : Array.isArray(locData?.content)
                            ? locData.content
                            : [];
                setLocations(normalizedLocations);
                const allEmps = empRes.data?.employees || empRes.data || [];
                setAllEmployees(allEmps);

                // Pre-populate next employee ID example from backend format (only for add mode)
                if (!isEditMode) {
                    const fmt = empIdFormatRes.data || {};
                    if (fmt.nextEmployeeIdExample) {
                        setNextEmployeeId(fmt.nextEmployeeIdExample);
                        setFormData(prev => ({ ...prev, employeeId: fmt.nextEmployeeIdExample }));
                    }
                }
            } catch (err) {
                console.error('Error fetching dropdowns:', err);
                setError('Failed to load form options. Please refresh.');
            } finally {
                setLoading(false);
            }
        };
        fetchDropdowns();
    }, [isEditMode]);

    const validateField = (name, value) => {
        let error = '';
        switch (name) {
            case 'firstName':
                if (!value?.trim()) error = 'First name is required';
                break;
            case 'lastName':
                if (!value?.trim()) error = 'Last name is required';
                break;
            case 'phoneNumber':
                if (!value?.trim()) error = 'Phone number is required';
                else if (!/^\d{10}$/.test(value)) error = 'Phone number must be exactly 10 digits';
                else if (/^(\d)\1{9}$/.test(value)) error = 'Phone number cannot be all same digits';
                else if (/^0/.test(value)) error = 'Phone number cannot start with 0';
                else {
                    // Reject sequential (1234567890) and reverse-sequential (9876543210) patterns
                    const digits = value.split('').map(Number);
                    const isSequential = digits.every((d, i) => i === 0 || d === (digits[i - 1] + 1) % 10);
                    const isReverseSeq = digits.every((d, i) => i === 0 || d === (digits[i - 1] - 1 + 10) % 10);
                    if (isSequential || isReverseSeq) error = 'Phone number cannot be a sequential pattern';
                }
                break;
            case 'email':
                if (!normalizeEmail(value)) error = 'Email is required';
                else if (!EMAIL_PATTERN.test(normalizeEmail(value))) error = 'Invalid email format';
                break;
            case 'professionalEmail':
                if (!normalizeEmail(value)) error = 'Professional email is required';
                else if (!EMAIL_PATTERN.test(normalizeEmail(value))) error = 'Invalid professional email format';
                break;
            case 'dateOfBirth':
                if (!value) error = 'Date of birth is required';
                else {
                    const selected = new Date(value);
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    if (selected >= today) error = 'Date of birth cannot be today or in the future';
                }
                break;
            case 'joiningDate':
                if (!value) error = 'Joining date is required';
                break;
            case 'employeeType':
                if (!value) error = 'Employee type is required';
                break;
            case 'departmentId':
                if (!value) error = 'Department is required';
                break;
            case 'positionId':
                if (!value) error = 'Position is required';
                break;
            case 'employeeRoleId':
                if (!value) error = 'System role is required';
                break;
            case 'officeLocation':
                if (!value) error = 'Office location is required';
                break;
            case 'salary':
                if (value !== '' && value !== null && value !== undefined && Number(value) < 0) {
                    error = 'Salary cannot be a negative amount';
                }
                break;
            case 'panNumber':
                if (value && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(String(value).toUpperCase().trim())) {
                    error = 'Invalid PAN format (e.g. ABCDE1234F)';
                }
                break;
            case 'aadhaarNumber':
                if (value && !/^\d{12}$/.test(String(value).replace(/\s/g, ''))) {
                    error = 'Aadhaar must be exactly 12 digits';
                }
                break;
            case 'reportingManagerId':
                // Optional
                error = '';
                break;

            default:
                break;
        }
        return error;
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        let normalizedValue =
            name === 'email' || name === 'professionalEmail'
                ? value.replace(/^mailto:/i, '').replace(/\s/g, '')
                : value;

        if (name === 'salary') {
            // Prevent minus sign or negative inputs completely in live state
            if (value !== '' && Number(value) < 0) {
                normalizedValue = Math.abs(Number(value)).toString();
            }
        } else if (name === 'panNumber') {
            normalizedValue = value.toUpperCase().slice(0, 10);
        } else if (name === 'aadhaarNumber') {
            // Strips non-digits and enforces 12-digit max
            const digits = value.replace(/\D/g, '').slice(0, 12);
            normalizedValue = digits;
        }

        setFormData(prev => ({ ...prev, [name]: normalizedValue }));

        // Live validation
        const fieldError = validateField(name, normalizedValue);
        setErrors(prev => ({ ...prev, [name]: fieldError }));
    };

    const handleFileChange = (e, field) => {
        const file = e.target.files[0];
        if (file) {
            setFormData(prev => ({ ...prev, [field]: file }));
            setErrors(prev => ({ ...prev, [field]: '' }));
        }
    };

    const validateTab = (tab) => {
        const fieldsToValidate = [];
        if (tab === 'personal') {
            fieldsToValidate.push('firstName', 'lastName', 'phoneNumber', 'email', 'dateOfBirth');
        } else if (tab === 'professional') {
            fieldsToValidate.push('employeeType', 'departmentId', 'positionId', 'employeeRoleId', 'professionalEmail');
        } else if (tab === 'workComp') {
            fieldsToValidate.push('joiningDate', 'officeLocation', 'reportingManagerId');
        }

        let hasError = false;
        const newErrors = { ...errors };

        fieldsToValidate.forEach(field => {
            const err = validateField(field, formData[field]);
            if (err) {
                newErrors[field] = err;
                hasError = true;
            } else {
                if ((field === 'email' || field === 'professionalEmail') && errors[field] && errors[field].includes('already exists')) {
                    newErrors[field] = errors[field];
                    hasError = true;
                } else {
                    delete newErrors[field];
                }
            }
        });

        // Block moving forward if we are actively checking the email in DB
        if (tab === 'personal' && checkingEmail) hasError = true;
        if (tab === 'professional' && checkingProfessionalEmail) hasError = true;

        if (hasError) {
            setErrors(newErrors);
        }
        return !hasError;
    };

    const handleTabChange = (targetTabId) => {
        if (activeTab === targetTabId) return;

        const tabsOrder = ['personal', 'professional', 'workComp', 'documents'];
        const currentIndex = tabsOrder.indexOf(activeTab);
        const targetIndex = tabsOrder.indexOf(targetTabId);

        if (targetIndex > currentIndex) {
            for (let i = currentIndex; i < targetIndex; i++) {
                if (!validateTab(tabsOrder[i])) {
                    setActiveTab(tabsOrder[i]);
                    return;
                }
            }
        }

        setActiveTab(targetTabId);
    };

    const handleNext = () => {
        const tabsOrder = ['personal', 'professional', 'workComp', 'documents'];
        const currentIndex = tabsOrder.indexOf(activeTab);
        if (currentIndex < tabsOrder.length - 1) {
            handleTabChange(tabsOrder[currentIndex + 1]);
        }
    };

    const handleSendSelfFill = async () => {
        if (!formData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
            toast.error('Enter a valid personal email before sending the self-fill form.');
            setActiveTab('personal');
            return;
        }
        const invitedName = [formData.firstName, formData.lastName].filter(Boolean).join(' ').trim() || undefined;
        setSendingSelfFill(true);
        try {
            const res = await adminAPI.sendEmployeeSelfFillInvite({
                email: normalizeEmail(formData.email),
                invitedName,
            });
            setSelfFillRequest(res.data || res);
            toast.success(res.data?.message || res.message || 'Self-fill form link sent.');
        } catch (err) {
            toast.error(getApiErrorMessage(err, 'Failed to send self-fill form link.'));
        } finally {
            setSendingSelfFill(false);
        }
    };

    const handleRefreshSelfFill = async () => {
        if (!formData.email?.trim()) {
            toast.error('Enter the employee email to check submission status.');
            return;
        }
        setSelfFillLoading(true);
        try {
            const res = await adminAPI.getEmployeeSelfFillByEmail(formData.email.trim());
            const data = res.data || res;
            setSelfFillRequest(data);
            if (data.status === 'COMPLETED') {
                toast.success('Employee has submitted their details. You can apply them to this form.');
            } else if (data.status === 'PENDING') {
                toast('Waiting for employee to complete the form.', { icon: '⏳' });
            } else {
                toast(data.message || `Status: ${data.status}`);
            }
        } catch (err) {
            if (err.response?.status === 400) {
                setSelfFillRequest(null);
            }
            toast.error(getApiErrorMessage(err, 'No self-fill request found for this email.'));
        } finally {
            setSelfFillLoading(false);
        }
    };

    const handleApplySelfFill = () => {
        if (!selfFillRequest?.formData) {
            toast.error('No submitted details available yet.');
            return;
        }
        setFormData((prev) => mapSelfFillToEmployeeForm(selfFillRequest.formData, prev));
        const docs = getSubmittedDocumentNames(selfFillRequest.formData);
        if (docs.length > 0) {
            setSelfFillDocNote(
                `Employee uploaded: ${docs.map((d) => d.name).join(', ')}. Re-upload here if needed when creating the employee.`
            );
        } else {
            setSelfFillDocNote('');
        }
        toast.success('Employee-submitted details applied. Review and complete remaining HR fields.');
        setActiveTab('personal');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        setError(null);

        // Final validation — only run on known text/primitive fields, never on File objects
        const VALIDATABLE_KEYS = [
            'firstName', 'lastName', 'phoneNumber', 'email', 'dateOfBirth',
            'employeeType', 'departmentId', 'positionId', 'employeeRoleId', 'professionalEmail',
            'joiningDate', 'officeLocation', 'reportingManagerId', 'salary', 'panNumber', 'aadhaarNumber',
        ];
        const newErrors = {};
        VALIDATABLE_KEYS.forEach(key => {
            const err = validateField(key, formData[key]);
            if (err) newErrors[key] = err;
        });

        if (errors.email && errors.email.includes('already exists')) newErrors.email = errors.email;
        if (errors.professionalEmail && errors.professionalEmail.includes('already exists')) newErrors.professionalEmail = errors.professionalEmail;

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            setSaving(false);

            // Determine which tab has the first error to switch to it
            if (newErrors.firstName || newErrors.lastName || newErrors.email || newErrors.phoneNumber || newErrors.dateOfBirth) {
                setActiveTab('personal');
            } else if (newErrors.employeeType || newErrors.departmentId || newErrors.positionId || newErrors.employeeRoleId || newErrors.professionalEmail) {
                setActiveTab('professional');
            } else if (newErrors.joiningDate || newErrors.officeLocation || newErrors.reportingManagerId) {
                setActiveTab('workComp');
            }

            return;
        }

        try {
            const payload = {
                firstName: formData.firstName.trim(),
                lastName: formData.lastName.trim(),
                email: formData.email.trim(),
                phoneNumber: formData.phoneNumber.trim(),
                hireDate: formData.joiningDate,
                active: false,
                officialEmail: normalizeEmail(formData.professionalEmail) || null,
                departmentId: formData.departmentId ? Number(formData.departmentId) : null,
                positionId: formData.positionId ? Number(formData.positionId) : null,
                employeeRoleId: formData.employeeRoleId ? Number(formData.employeeRoleId) : null,
                shiftId: formData.shiftId ? Number(formData.shiftId) : null,
                locationId: formData.officeLocation ? Number(formData.officeLocation) : null,
                salary: formData.salary ? Number(formData.salary) : null,
                panNumber: formData.panNumber?.trim() || null,
                uanNumber: formData.uanNumber?.trim() || null,
                aadhaarNumber: formData.aadhaarNumber?.trim() || null,
                reportingManagerId: formData.reportingManagerId ? Number(formData.reportingManagerId) : null,
                dateOfBirth: formData.dateOfBirth || null,
                emergencyContact: formData.emergencyContact?.trim() || null,
                emergencyPhone: formData.emergencyPhone?.trim() || null,
                bloodGroup: formData.bloodGroup?.trim() || null,
                presentAddressLine1: formData.address?.trim() || null,
                presentCity: formData.city === 'Other' ? (formData.otherCity?.trim() || 'Other') : (formData.city?.trim() || null),
                presentState: formData.state === 'Other' ? (formData.otherState?.trim() || 'Other') : (formData.state?.trim() || null),
                presentPostalCode: formData.zipCode?.trim() || null,
                jobTitle: formData.designation?.trim() || null,
                nationality: formData.nationality === 'Other' ? (formData.otherNationality?.trim() || 'Other') : (formData.nationality?.trim() || null),
                gender: formData.gender === 'Other' ? (formData.otherGender?.trim() || 'Other') : (formData.gender?.trim() || null),
                maritalStatus: formData.maritalStatus && formData.maritalStatus.trim() ? formData.maritalStatus.trim() : null,
                employeeType: formData.employeeType?.trim() || null,
                highestQualification: formData.highestQualification?.trim() || null,
                primarySkills: formData.primarySkills?.trim() || null,
                secondarySkills: formData.secondarySkills?.trim() || null,
                experienceYears: formData.experienceYears ? Number(formData.experienceYears) : null,
                sourceOfHire: formData.sourceOfHire?.trim() || null,
                workLocation: formData.workLocation?.trim() || null,
                slackId: formData.slackId?.trim() || null,
                skypeId: formData.skypeId?.trim() || null,
                workingDays: formData.workingDays?.trim() || null,
                // employeeId intentionally omitted so backend always auto-generates a unique ID (only for create)
            };

            let targetId = employeeIdForUpdate || id;
            let resolvedStringEmployeeId = null;

            if (isEditMode && targetId) {
                console.log('🔄 Updating employee with ID:', targetId);
                const response = await adminAPI.updateEnhancedEmployee(targetId, payload);
                console.log('✅ Update response:', response.data);
                const resData = response.data?.data || response.data || response;
                resolvedStringEmployeeId = resData?.employeeId || employeeStringIdForDocs || String(targetId);
                clearDraft();
            } else {
                if (employeeLimit?.atLimit) {
                    toast.error(formatLimitReachedMessage(employeeLimit), { duration: 6000 });
                    setSaving(false);
                    return;
                }
                console.log('➕ Creating new employee');
                const response = await adminAPI.createEnhancedEmployee(payload);
                console.log('✅ Create response:', response.data);
                const resData = response.data?.data || response.data || response;
                targetId = resData?.id || null;
                resolvedStringEmployeeId = resData?.employeeId || null;
                console.log('📋 After create — numeric targetId:', targetId, '| resolvedStringEmployeeId:', resolvedStringEmployeeId);
                clearDraft();
            }

            // If resolvedStringEmployeeId is still missing, fetch it from the backend
            if (!resolvedStringEmployeeId && targetId) {
                try {
                    console.log('🔍 Fetching string employeeId from backend for numeric ID:', targetId);
                    const freshEmpRes = await adminAPI.getEmployeeById(targetId);
                    const freshEmp = freshEmpRes.data || freshEmpRes;
                    resolvedStringEmployeeId = freshEmp?.employeeId || String(targetId);
                    console.log('✅ Got string employeeId via fresh fetch:', resolvedStringEmployeeId);
                } catch (fetchErr) {
                    console.warn('⚠️ Could not fetch employee for doc upload, falling back to numeric:', fetchErr);
                    resolvedStringEmployeeId = employeeStringIdForDocs || String(targetId);
                }
            }

            // Upload documents — keep loader active while files are uploading
            const documentMappings = [
                { file: formData.appointmentLetter, type: 'APPOINTMENT_LETTER', label: 'Appointment Letter' },
                { file: formData.salarySlips, type: 'SALARY_SLIP', label: 'Salary Slips' },
                { file: formData.relievingLetter || formData.relivingLetter, type: 'RELIEVING_LETTER', label: 'Relieving Letter' },
                { file: formData.experienceLetter, type: 'EXPERIENCE_CERTIFICATE', label: 'Experience Letter' },
            ];
            const docsToUpload = documentMappings.filter(d => d.file instanceof File);
            console.log(`📂 ${docsToUpload.length} document(s) to upload for employee: ${resolvedStringEmployeeId}`);

            if (docsToUpload.length > 0 && resolvedStringEmployeeId) {
                const uploadToastId = toast.loading(`Uploading ${docsToUpload.length} document(s)... Please wait.`);
                for (const doc of docsToUpload) {
                    try {
                        console.log(`📤 Uploading [${doc.type}] "${doc.file.name}" (${doc.file.size}B) → employee: ${resolvedStringEmployeeId}`);
                        await documentAPI.uploadEmployeeDocument(resolvedStringEmployeeId, doc.type, doc.file);
                    } catch (docErr) {
                        console.error(`❌ Failed to upload [${doc.type}] "${doc.file.name}":`, docErr);
                        const errMsg = docErr.response?.data?.message || docErr.response?.data?.error || docErr.message || '';
                        toast.error(`Failed to upload ${doc.label}${errMsg ? ': ' + errMsg : ''}`);
                    }
                }
                toast.dismiss(uploadToastId);
                if (isEditMode) {
                    toast.success('Updated employee documents successfully!');
                } else {
                toast.success('Employee created successfully!');
            }
            } else if (docsToUpload.length > 0) {
                console.error('❌ Documents skipped: resolvedStringEmployeeId is empty');
                toast.error('Employee saved but documents could not be linked. Upload them from the edit page.');
            } else {
                // No documents to upload
                if (isEditMode) {
                    toast.success('Employee updated successfully!');
                } else {
                    toast.success('Employee created successfully!');
                }
            }

            navigate('/admin/employees');
        } catch (err) {
            console.error(`Error ${isEditMode ? 'updating' : 'creating'} employee:`, err);

            const errorMessage = getApiErrorMessage(
                err,
                `Failed to ${isEditMode ? 'update' : 'create'} employee. Please try again.`
            );

            setError(errorMessage);
            toast.error(errorMessage, {
                duration: isEmployeeLimitError(err) ? 7000 : 5000,
            });
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="p-8 text-center text-gray-500">Loading form...</div>;

    const getCountryCode = (nationality) => {
        switch (nationality) {
            case 'Indian': return '+91';
            case 'American': return '+1';
            case 'British': return '+44';
            case 'Canadian': return '+1';
            case 'Australian': return '+61';
            case 'Singaporean': return '+65';
            case 'Emirati': return '+971';
            case 'German': return '+49';
            case 'French': return '+33';
            case 'Japanese': return '+81';
            default: return '';
        }
    };

    const countryCode = getCountryCode(formData.nationality);

    const tabs = [
        { id: 'personal', label: 'Personal Information', icon: User },
        { id: 'professional', label: 'Professional Information', icon: Briefcase },
        { id: 'workComp', label: 'Work, Compensation', icon: Briefcase },
        { id: 'documents', label: 'Documents', icon: FileText },
    ];

    return (
        <div className="main-content flex flex-col h-screen">
            <Header title={isEditMode ? "Edit Employee" : "Add New Employee"} subtitle={isEditMode ? "All Employee > Edit Employee" : "All Employee > Add New Employee"} />

            <div className="page-content flex-1 flex flex-col overflow-hidden">

                {!isEditMode && employeeLimit?.atLimit && (
                    <div style={{
                        margin: '12px 16px 0',
                        padding: '12px 16px',
                        borderRadius: '10px',
                        border: '1px solid #fecaca',
                        background: '#fef2f2',
                        color: '#991b1b',
                        fontSize: '13px',
                        lineHeight: 1.5,
                    }}>
                        {formatLimitReachedMessage(employeeLimit)}
                    </div>
                )}

                {!isEditMode && (
                    <div style={{
                        margin: '12px 16px 0',
                        padding: '14px 16px',
                        borderRadius: '10px',
                        border: '1px solid #bfdbfe',
                        background: '#eff6ff',
                        color: '#1e3a8a',
                        fontSize: '13px',
                        lineHeight: 1.5,
                    }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                            <div>
                                <p style={{ fontWeight: 600, marginBottom: 4 }}>Send form to employee</p>
                                <p style={{ margin: 0, color: '#1e40af' }}>
                                    Email a secure link so the employee can fill personal, address, ID, and document details. After they submit, apply their answers here and complete HR-only fields.
                                </p>
                                {selfFillRequest && (
                                    <p style={{ margin: '8px 0 0', fontSize: 12 }}>
                                        Status: <strong>{selfFillRequest.status}</strong>
                                        {selfFillRequest.expiresAt && selfFillRequest.status === 'PENDING' && (
                                            <> · Expires {new Date(selfFillRequest.expiresAt).toLocaleString()}</>
                                        )}
                                    </p>
                                )}
                                {selfFillDocNote && (
                                    <p style={{ margin: '8px 0 0', fontSize: 12, color: '#166534' }}>{selfFillDocNote}</p>
                                )}
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                <button
                                    type="button"
                                    onClick={handleSendSelfFill}
                                    disabled={sendingSelfFill}
                                    style={{
                                        padding: '8px 16px',
                                        borderRadius: '6px',
                                        backgroundColor: '#2563eb',
                                        color: 'white',
                                        border: 'none',
                                        fontSize: '13px',
                                        fontWeight: '500',
                                        cursor: sendingSelfFill ? 'not-allowed' : 'pointer',
                                        opacity: sendingSelfFill ? 0.6 : 1,
                                        transition: 'background-color 0.2s'
                                    }}
                                    onMouseEnter={(e) => { if (!sendingSelfFill) e.target.style.backgroundColor = '#1d4ed8'; }}
                                    onMouseLeave={(e) => { if (!sendingSelfFill) e.target.style.backgroundColor = '#2563eb'; }}
                                >
                                    {sendingSelfFill ? 'Sending...' : 'Send form link'}
                                </button>
                                <button
                                    type="button"
                                    onClick={handleRefreshSelfFill}
                                    disabled={selfFillLoading}
                                    style={{
                                        padding: '8px 16px',
                                        borderRadius: '6px',
                                        border: '1px solid #bfdbfe',
                                        backgroundColor: 'white',
                                        color: '#2563eb',
                                        fontSize: '13px',
                                        fontWeight: '500',
                                        cursor: selfFillLoading ? 'not-allowed' : 'pointer',
                                        opacity: selfFillLoading ? 0.6 : 1,
                                        transition: 'background-color 0.2s'
                                    }}
                                    onMouseEnter={(e) => { if (!selfFillLoading) e.target.style.backgroundColor = '#eff6ff'; }}
                                    onMouseLeave={(e) => { if (!selfFillLoading) e.target.style.backgroundColor = 'white'; }}
                                >
                                    {selfFillLoading ? 'Checking...' : 'Check submission'}
                                </button>
                                {selfFillRequest?.status === 'COMPLETED' && selfFillRequest?.formData && (
                                    <button
                                        type="button"
                                        onClick={handleApplySelfFill}
                                        style={{
                                            padding: '8px 16px',
                                            borderRadius: '6px',
                                            border: '1px solid #bbf7d0',
                                            backgroundColor: '#f0fdf4',
                                            color: '#166534',
                                            fontSize: '13px',
                                            fontWeight: '500',
                                            cursor: 'pointer',
                                            transition: 'background-color 0.2s'
                                        }}
                                        onMouseEnter={(e) => { e.target.style.backgroundColor = '#dcfce7'; }}
                                        onMouseLeave={(e) => { e.target.style.backgroundColor = '#f0fdf4'; }}
                                    >
                                        Apply submitted details
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                <div 
                    className="bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col flex-1 overflow-hidden"
                    style={{ margin: '16px' }}
                >

                    {(draftRestored || getDraft()) && (
                        <div className="mx-6 mt-4 flex items-center justify-between gap-3 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">
                            <span>{draftRestored ? 'Draft restored. Your progress is saved automatically.' : 'Draft saved. You can leave and come back anytime.'}</span>
                            <button
                                type="button"
                                onClick={() => { clearDraft(); setFormData({ ...initialFormState }); setActiveTab('personal'); setDraftRestored(false); }}
                                className="shrink-0 px-3 py-1.5 rounded-md border border-amber-300 bg-white text-amber-700 hover:bg-amber-50 text-sm font-medium"
                            >
                                Discard draft
                            </button>
                        </div>
                    )}

                    {/* Tabs Header - Segmented Control */}
                    <div className="px-6 py-4 flex justify-end pt-6 flex-none border-b border-gray-100">
                        <div className="segmented-control">
                            {tabs.map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => handleTabChange(tab.id)}
                                    className={`segmented-control-btn ${activeTab === tab.id ? 'active' : ''}`}
                                >
                                    <tab.icon size={14} />
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Form Container */}
                    <form onSubmit={(e) => { e.preventDefault(); }} className="flex flex-col flex-1 overflow-hidden">
                        {error && (
                            <div className="mx-6 mt-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                                {error}
                            </div>
                        )}
                        {/* Scrollable Content Area */}
                        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                            {/* 1. PERSONAL INFORMATION */}
                            {activeTab === 'personal' && (
                                <div className="space-y-6 animate-fadeIn">
                                    <div>
                                        <h2 className="text-base font-semibold text-gray-900">Personal Information</h2>
                                        <p className="mt-1 text-sm text-gray-500">
                                            Basic details about the employee including contact, demographics and emergency information.
                                        </p>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">First Name <span className="text-red-500" style={{ color: "red" }}>*</span></label>
                                            <input
                                                type="text"
                                                name="firstName"
                                                value={formData.firstName}
                                                onChange={handleChange}
                                                className={`form-input bg-gray-50 ${errors.firstName ? 'border-red-500 focus:ring-red-500' : ''}`}
                                                placeholder="Bob"
                                            />
                                            {errors.firstName && <p className="mt-1 text-xs text-red-500" style={{ color: "red" }}>{errors.firstName}</p>}
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Last Name <span className="text-red-500" style={{ color: "red" }}>*</span></label>
                                            <input
                                                type="text"
                                                name="lastName"
                                                value={formData.lastName}
                                                onChange={handleChange}
                                                className={`form-input bg-gray-50 ${errors.lastName ? 'border-red-500 focus:ring-red-500' : ''}`}
                                                placeholder="Lee"
                                            />
                                            {errors.lastName && <p className="mt-1 text-xs text-red-500" style={{ color: "red" }}>{errors.lastName}</p>}
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Mobile Number <span className="text-red-500" style={{ color: "red" }}>*</span></label>
                                            <div className="relative flex items-center">
                                                {countryCode && (
                                                    <span className="absolute left-3 text-gray-500 text-sm font-medium">{countryCode}</span>
                                                )}
                                                <input
                                                    type="tel"
                                                    name="phoneNumber"
                                                    value={formData.phoneNumber}
                                                    onChange={handleChange}
                                                    style={{ paddingLeft: countryCode ? `${(countryCode.length * 8) + 20}px` : undefined }}
                                                    className={`form-input bg-gray-50 w-full ${errors.phoneNumber ? 'border-red-500 focus:ring-red-500' : ''}`}
                                                    placeholder="7895123456"
                                                    maxLength="10"
                                                />
                                            </div>
                                            {errors.phoneNumber && <p className="mt-1 text-xs text-red-500" style={{ color: "red" }}>{errors.phoneNumber}</p>}
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Email Address <span className="text-red-500" style={{ color: "red" }}>*</span></label>
                                            <div className="relative">
                                                <input
                                                    type="email"
                                                    name="email"
                                                    value={formData.email}
                                                    onChange={handleChange}
                                                    className={`form-input bg-gray-50 ${errors.email ? 'border-red-500 focus:ring-red-500' : ''}`}
                                                    placeholder="employee@example.com"
                                                />
                                                {checkingEmail && (
                                                    <div className="absolute right-3 top-2.5">
                                                        <Loader2 size={16} className="animate-spin text-gray-400" />
                                                    </div>
                                                )}
                                            </div>
                                            {errors.email && <p className="mt-1 text-xs text-red-500" style={{ color: "red" }}>{errors.email}</p>}
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth <span className="text-red-500" style={{ color: "red" }}>*</span></label>
                                            <div className="relative">
                                                <input
                                                    type="date"
                                                    name="dateOfBirth"
                                                    value={formData.dateOfBirth}
                                                    onChange={handleChange}
                                                    onClick={(e) => e.target.showPicker?.()}
                                                    className={`form-input bg-gray-50 w-full ${errors.dateOfBirth ? 'border-red-500 focus:ring-red-500' : ''}`}
                                                    placeholder="MM/DD/YYYY"
                                                    max={new Date(new Date().setDate(new Date().getDate() - 1)).toISOString().split('T')[0]}
                                                    style={{ color: formData.dateOfBirth ? 'inherit' : '#9ca3af' }}
                                                />
                                                {errors.dateOfBirth && <p className="mt-1 text-xs text-red-500" style={{ color: "red" }}>{errors.dateOfBirth}</p>}
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Marital Status</label>
                                            <select
                                                name="maritalStatus"
                                                value={formData.maritalStatus}
                                                onChange={handleChange}
                                                className="form-input bg-gray-50"
                                            >
                                                <option value="">Select status</option>
                                                <option value="Single">Single</option>
                                                <option value="Married">Married</option>
                                                <option value="Divorced">Divorced</option>
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                                            <select
                                                name="gender"
                                                value={formData.gender}
                                                onChange={handleChange}
                                                className="form-input bg-gray-50"
                                            >
                                                <option value="">Select gender</option>
                                                <option value="Male">Male</option>
                                                <option value="Female">Female</option>
                                                <option value="Other">Other</option>
                                                <option value="Prefer not to say">Prefer not to say</option>
                                            </select>
                                            {formData.gender === 'Other' && (
                                                <input
                                                    type="text"
                                                    name="otherGender"
                                                    value={formData.otherGender}
                                                    onChange={handleChange}
                                                    className="form-input bg-gray-50 mt-2 animate-fadeIn"
                                                    placeholder="Please specify gender"
                                                />
                                            )}
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Nationality</label>
                                            <SearchableSelect
                                                value={formData.nationality}
                                                onChange={(val) => handleCustomChange('nationality', val)}
                                                options={countryOptions}
                                                placeholder="Select nationality"
                                                emptyMessage="No matching nationality found"
                                            />
                                            {formData.nationality === 'Other' && (
                                                <input
                                                    type="text"
                                                    name="otherNationality"
                                                    value={formData.otherNationality}
                                                    onChange={handleChange}
                                                    className="form-input bg-gray-50 mt-2 animate-fadeIn"
                                                    placeholder="Please specify nationality"
                                                />
                                            )}
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Emergency Contact Name</label>
                                            <input
                                                type="text"
                                                name="emergencyContact"
                                                value={formData.emergencyContact}
                                                onChange={handleChange}
                                                className="form-input bg-gray-50"
                                                placeholder="Contact person name"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Emergency Phone</label>
                                            <input
                                                type="tel"
                                                name="emergencyPhone"
                                                value={formData.emergencyPhone}
                                                onChange={handleChange}
                                                className="form-input bg-gray-50"
                                                placeholder="Emergency contact number"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Blood Group</label>
                                            <input
                                                type="text"
                                                name="bloodGroup"
                                                value={formData.bloodGroup}
                                                onChange={handleChange}
                                                className="form-input bg-gray-50"
                                                placeholder="e.g. O+, B-"
                                            />
                                        </div>
                                    </div>

                                </div>
                            )}


                            {/* 2. PROFESSIONAL INFORMATION */}
                            {activeTab === 'professional' && (
                                <div className="space-y-8 animate-fadeIn">
                                    <div className="space-y-3">
                                        <div>
                                            <h2 className="text-base font-semibold text-gray-900">Professional Information</h2>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Employee ID</label>
                                                <input
                                                    type="text"
                                                    name="employeeId"
                                                    value={formData.employeeId || ''}
                                                    readOnly
                                                    className="form-input bg-gray-100 cursor-not-allowed"
                                                    placeholder=""
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Employee Type <span className="text-red-500" style={{ color: "red" }}>*</span></label>
                                                <select
                                                    name="employeeType"
                                                    value={formData.employeeType}
                                                    onChange={handleChange}
                                                    className={`form-input bg-gray-50 ${errors.employeeType ? 'border-red-500 focus:ring-red-500' : ''}`}
                                                >
                                                    <option value="">Select Employee Type</option>
                                                    <option value="Full Time">Full Time</option>
                                                    <option value="Contract">Contract</option>
                                                </select>
                                                {errors.employeeType && <p className="mt-1 text-xs text-red-500" style={{ color: "red" }}>{errors.employeeType}</p>}
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Professional Email <span className="text-red-500" style={{ color: "red" }}>*</span></label>
                                                <div className="relative">
                                                    <input
                                                        type="email"
                                                        name="professionalEmail"
                                                        value={formData.professionalEmail}
                                                        onChange={handleChange}
                                                        className={`form-input bg-gray-50 ${errors.professionalEmail ? 'border-red-500 focus:ring-red-500' : ''}`}
                                                        placeholder="Official email address"
                                                    />
                                                    {checkingProfessionalEmail && (
                                                        <div className="absolute right-3 top-2.5">
                                                            <Loader2 size={16} className="animate-spin text-gray-400" />
                                                        </div>
                                                    )}
                                                </div>
                                                {errors.professionalEmail && <p className="mt-1 text-xs text-red-500" style={{ color: "red" }}>{errors.professionalEmail}</p>}
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Department <span className="text-red-500" style={{ color: "red" }}>*</span></label>
                                                <select
                                                    name="departmentId"
                                                    value={formData.departmentId}
                                                    onChange={handleChange}
                                                    className={`form-input bg-gray-50 ${errors.departmentId ? 'border-red-500 focus:ring-red-500' : ''}`}
                                                >
                                                    <option value="">Select Department</option>
                                                    {departments.map(d => (
                                                        <option key={d.id} value={d.id}>{d.name}</option>
                                                    ))}
                                                </select>
                                                {errors.departmentId && <p className="mt-1 text-xs text-red-500" style={{ color: "red" }}>{errors.departmentId}</p>}
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Position <span className="text-red-500" style={{ color: "red" }}>*</span></label>
                                                <select
                                                    name="positionId"
                                                    value={formData.positionId}
                                                    onChange={handleChange}
                                                    className={`form-input bg-gray-50 ${errors.positionId ? 'border-red-500 focus:ring-red-500' : ''}`}
                                                >
                                                    <option value="">Select Position</option>
                                                    {positions.map(p => (
                                                        <option key={p.id} value={p.id}>{p.title || p.name}</option>
                                                    ))}
                                                </select>
                                                {errors.positionId && <p className="mt-1 text-xs text-red-500" style={{ color: "red" }}>{errors.positionId}</p>}
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">System Roles (User Roles) <span className="text-red-500" style={{ color: "red" }}>*</span></label>
                                                <select
                                                    name="employeeRoleId"
                                                    value={formData.employeeRoleId}
                                                    onChange={handleChange}
                                                    className={`form-input bg-gray-50 ${errors.employeeRoleId ? 'border-red-500 focus:ring-red-500' : ''}`}
                                                  >
                                                    <option value="">Select System Role</option>
                                                    {roles
                                                        .filter(r => {
                                                            const label = (r.name || r.roleName || '').toUpperCase().trim();
                                                            // Always show the currently assigned role in edit mode
                                                            if (isEditMode && formData.employeeRoleId &&
                                                                String(r.id) === String(formData.employeeRoleId)) {
                                                                return true;
                                                            }
                                                            // Exclude ADMIN from dropdown for create/edit
                                                            if (label === 'ADMIN') return false;
                                                            // Filter based on current user's role hierarchy
                                                            return allowedRoleNames.includes(label);
                                                        })
                                                        .map(r => {
                                                            const label = r.name || r.roleName || r.description || `Role #${r.id}`;
                                                            const isCurrentAssigned = isEditMode &&
                                                                String(r.id) === String(formData.employeeRoleId);
                                                            const roleLabel = (r.name || r.roleName || '').toUpperCase().trim();
                                                            const isOutOfScope = isCurrentAssigned &&
                                                                !allowedRoleNames.includes(roleLabel);
                                                            return (
                                                                <option key={r.id} value={r.id}
                                                                    disabled={isOutOfScope}>
                                                                    {label}{isOutOfScope ? ' (view only)' : ''}
                                                                </option>
                                                            );
                                                        })}
                                                </select>
                                                {errors.employeeRoleId && <p className="mt-1 text-xs text-red-500" style={{ color: "red" }}>{errors.employeeRoleId}</p>}
                                                {/* Role assignment restriction hint */}
                                                {currentUserRole === 'CEO' && (
                                                    <p className="mt-1 text-xs text-amber-600">
                                                        You do not have permission to assign the ADMIN role. Only ADMIN can assign ADMIN roles.
                                                    </p>
                                                )}
                                                {currentUserRole === 'HR' && (
                                                    <p className="mt-1 text-xs text-amber-600">
                                                        HR can only assign HR, MANAGER, and EMPLOYEE roles.
                                                    </p>
                                                )}
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Job Title / Designation</label>
                                                <input
                                                    type="text"
                                                    name="designation"
                                                    value={formData.designation}
                                                    onChange={handleChange}
                                                    className="form-input bg-gray-50"
                                                    placeholder="e.g. Administrator"
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                                                <input
                                                    type="text"
                                                    name="address"
                                                    value={formData.address}
                                                    onChange={handleChange}
                                                    className="form-input bg-gray-50 w-full"
                                                    placeholder="Street address, area"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
                                                <SearchableSelect
                                                    value={formData.nationality}
                                                    onChange={(val) => handleCustomChange('nationality', val)}
                                                    options={countryOptions}
                                                    placeholder="Select Country"
                                                    emptyMessage="No matching country found"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                                                <SearchableSelect
                                                    value={formData.state}
                                                    onChange={(val) => handleCustomChange('state', val)}
                                                    options={stateOptions}
                                                    placeholder={formData.nationality ? "Select State" : "Select Country first"}
                                                    emptyMessage="No states found"
                                                    disabled={!formData.nationality}
                                                />
                                                {formData.state === 'Other' && (
                                                    <input
                                                        type="text"
                                                        name="otherState"
                                                        value={formData.otherState || ''}
                                                    onChange={handleChange}
                                                        className="form-input bg-gray-50 mt-2 animate-fadeIn"
                                                        placeholder="Please specify state"
                                                    />
                                                )}
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                                                <SearchableSelect
                                                    value={formData.city}
                                                    onChange={(val) => handleCustomChange('city', val)}
                                                    options={cityOptions}
                                                    placeholder="Select City"
                                                    emptyMessage="No cities found"
                                                    disabled={!formData.state || formData.state === 'Other'}
                                                />
                                                {(formData.city === 'Other' || formData.state === 'Other') && (
                                                    <input
                                                        type="text"
                                                        name="otherCity"
                                                        value={formData.otherCity || ''}
                                                    onChange={handleChange}
                                                        className="form-input bg-gray-50 mt-2 animate-fadeIn"
                                                        placeholder="Please specify city"
                                                    />
                                                )}
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">ZIP / Postal Code</label>
                                                <input
                                                    type="text"
                                                    name="zipCode"
                                                    value={formData.zipCode}
                                                    onChange={handleChange}
                                                    className="form-input bg-gray-50"
                                                    placeholder="PIN / ZIP"
                                                    maxLength={getSelectedCountryIsoCode(formData.nationality) === 'US' ? '5' : '6'}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* 3. WORK, COMPENSATION */}
                            {activeTab === 'workComp' && (
                                <div className="space-y-8 animate-fadeIn">
                                    <div>
                                        <h2 className="text-base font-semibold text-gray-900">Work, Compensation</h2>
                                    </div>

                                    {/* Section 1: Work & Compensation */}
                                    <div className="space-y-3">
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Shift</label>
                                                <select
                                                    name="shiftId"
                                                    value={formData.shiftId}
                                                    onChange={handleChange}
                                                    className="form-input bg-gray-50"
                                                >
                                                    <option value="">Select Shift</option>
                                                    {(Array.isArray(shifts) ? shifts : []).map(s => (
                                                        <option key={s.id} value={s.id}>{s.shiftName || s.name}</option>
                                                    ))}
                                                </select>
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Joining Date <span className="text-red-500" style={{ color: "red" }}>*</span></label>
                                                <div className="relative">
                                                    <input
                                                        type="date"
                                                        name="joiningDate"
                                                        value={formData.joiningDate}
                                                        onChange={handleChange}
                                                        onClick={(e) => e.target.showPicker?.()}
                                                        className={`form-input bg-gray-50 w-full ${errors.joiningDate ? 'border-red-500 focus:ring-red-500' : ''}`}
                                                        required
                                                    />
                                                    {errors.joiningDate && <p className="mt-1 text-xs text-red-500" style={{ color: "red" }}>{errors.joiningDate}</p>}
                                                </div>
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Reporting Manager</label>
                                                <select
                                                    name="reportingManagerId"
                                                    value={formData.reportingManagerId}
                                                    onChange={handleChange}
                                                    className={`form-input bg-gray-50 ${errors.reportingManagerId ? 'border-red-500 focus:ring-red-500' : ''}`}
                                                >
                                                    <option value="">Select Reporting Manager</option>
                                                    {managers.map(m => {
                                                        const role = (m.employeeRoleName || m.roleName || m.employeeRole?.name || m.role?.name || '');
                                                        return (
                                                            <option key={m.id} value={m.id}>
                                                                {m.firstName} {m.lastName}{m.employeeId ? ` (${m.employeeId})` : ''} {role ? `- ${role}` : ''}
                                                            </option>
                                                        );
                                                    })}
                                                </select>
                                                {errors.reportingManagerId && <p className="mt-1 text-xs text-red-500" style={{ color: "red" }}>{errors.reportingManagerId}</p>}
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Office Location <span className="text-red-500" style={{ color: "red" }}>*</span></label>
                                                <select
                                                    name="officeLocation"
                                                    value={formData.officeLocation}
                                                    onChange={handleChange}
                                                    className={`form-input bg-gray-50 location-select ${errors.officeLocation ? 'border-red-500 focus:ring-red-500' : ''}`}
                                                    style={{ color: '#111827', backgroundColor: '#ffffff' }}
                                                >
                                                    <option value="">Select Office Location</option>
                                                    {locations.map(l => {
                                                        const label = l.name || l.locationName || l.locationCode || `Location #${l.id}`;
                                                        return (
                                                            <option key={l.id} value={l.id}>
                                                                {label}
                                                            </option>
                                                        );
                                                    })}
                                                </select>
                                                {errors.officeLocation && <p className="mt-1 text-xs text-red-500" style={{ color: "red" }}>{errors.officeLocation}</p>}
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Salary</label>
                                                <input
                                                    type="number"
                                                    name="salary"
                                                    value={formData.salary}
                                                    onChange={handleChange}
                                                    onKeyDown={(e) => {
                                                        if (e.key === '-' || e.key === 'e' || e.key === 'E') {
                                                            e.preventDefault();
                                                        }
                                                    }}
                                                    className={`form-input bg-gray-50 ${errors.salary ? 'border-red-500 focus:ring-red-500' : ''}`}
                                                    min="0"
                                                    step="0.01"
                                                    placeholder="Monthly salary"
                                                />
                                                {errors.salary && <p className="mt-1 text-xs text-red-500" style={{ color: "red" }}>{errors.salary}</p>}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Section 2: Statutory IDs */}
                                    <div className="space-y-3">
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">PAN Number</label>
                                                <input
                                                    type="text"
                                                    name="panNumber"
                                                    value={formData.panNumber}
                                                    onChange={handleChange}
                                                    maxLength="10"
                                                    className={`form-input bg-gray-50 uppercase ${errors.panNumber ? 'border-red-500 focus:ring-red-500' : ''}`}
                                                    placeholder="ABCDE1234F"
                                                />
                                                {errors.panNumber && <p className="mt-1 text-xs text-red-500" style={{ color: "red" }}>{errors.panNumber}</p>}
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">UAN Number</label>
                                                <input
                                                    type="text"
                                                    name="uanNumber"
                                                    value={formData.uanNumber}
                                                    onChange={handleChange}
                                                    className="form-input bg-gray-50"
                                                    placeholder="UAN number"
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Aadhaar Number</label>
                                                <input
                                                    type="text"
                                                    name="aadhaarNumber"
                                                    value={formData.aadhaarNumber}
                                                    onChange={handleChange}
                                                    className={`form-input bg-gray-50 ${errors.aadhaarNumber ? 'border-red-500 focus:ring-red-500' : ''}`}
                                                    placeholder="12 digit Aadhaar"
                                                    maxLength="12"
                                                />
                                                {errors.aadhaarNumber && <p className="mt-1 text-xs text-red-500" style={{ color: "red" }}>{errors.aadhaarNumber}</p>}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Section 3: Qualifications & Skills */}
                                    <div className="space-y-3">
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Highest Qualification</label>
                                                <input
                                                    type="text"
                                                    name="highestQualification"
                                                    value={formData.highestQualification}
                                                    onChange={handleChange}
                                                    className="form-input bg-gray-50"
                                                    placeholder="e.g. B.Tech, MBA"
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Primary Skills</label>
                                                <input
                                                    type="text"
                                                    name="primarySkills"
                                                    value={formData.primarySkills}
                                                    onChange={handleChange}
                                                    className="form-input bg-gray-50"
                                                    placeholder="e.g. React, Java, SQL"
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Secondary Skills</label>
                                                <input
                                                    type="text"
                                                    name="secondarySkills"
                                                    value={formData.secondarySkills}
                                                    onChange={handleChange}
                                                    className="form-input bg-gray-50"
                                                    placeholder="Additional skills (optional)"
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Total Experience (Years)</label>
                                                <input
                                                    type="number"
                                                    name="experienceYears"
                                                    value={formData.experienceYears}
                                                    onChange={handleChange}
                                                    className="form-input bg-gray-50"
                                                    min="0"
                                                    step="0.5"
                                                    placeholder="e.g. 3.5"
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Source of Hire</label>
                                                <input
                                                    type="text"
                                                    name="sourceOfHire"
                                                    value={formData.sourceOfHire}
                                                    onChange={handleChange}
                                                    className="form-input bg-gray-50"
                                                    placeholder="e.g. Referral, Naukri, LinkedIn"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* 3. DOCUMENTS */}
                            {activeTab === 'documents' && (
                                <div className="space-y-6 animate-fadeIn">
                                    <div>
                                        <h2 className="text-base font-semibold text-gray-900">Documents</h2>
                                        <p className="mt-1 text-sm text-gray-500">
                                            Upload supporting documents like appointment letter, salary slips and experience letters.
                                        </p>
                                         {selfFillRequest?.formData?.documents && Object.keys(selfFillRequest.formData.documents).length > 0 && (
                                             <div style={{
                                                 marginTop: '16px',
                                                 marginBottom: '20px',
                                                 backgroundColor: '#ffffff',
                                                 border: '1px solid #e5e7eb',
                                                 borderRadius: '12px',
                                                 padding: '20px',
                                                 boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                                             }}>
                                                 <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid #f3f4f6' }}>
                                                     <div style={{
                                                         width: '32px',
                                                         height: '32px',
                                                         borderRadius: '8px',
                                                         backgroundColor: '#eff6ff',
                                                         color: '#2563eb',
                                                         display: 'flex',
                                                         alignItems: 'center',
                                                         justifyContent: 'center',
                                                         fontWeight: 700
                                                     }}>
                                                         <FileText size={18} />
                                                     </div>
                                                     <div>
                                                         <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#111827', margin: 0 }}>Candidate Self-Fill Documents</h3>
                                                         <p style={{ fontSize: '12px', color: '#6b7280', margin: '2px 0 0 0' }}>Uploaded by candidate during self-onboarding fill</p>
                                                     </div>
                                    </div>

                                                 <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                                     {getSubmittedDocumentNames(selfFillRequest.formData).map((docItem) => {
                                                         const docLabel = docItem.field.replace(/([A-Z])/g, ' $1').trim().toUpperCase();
                                                         return (
                                                             <div
                                                                 key={docItem.field}
                                                                 style={{
                                                                     display: 'flex',
                                                                     alignItems: 'center',
                                                                     justifyContent: 'space-between',
                                                                     padding: '12px 16px',
                                                                     backgroundColor: '#f9fafb',
                                                                     border: '1px solid #e5e7eb',
                                                                     borderRadius: '10px',
                                                                     gap: '16px'
                                                                 }}
                                                             >
                                                                 <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
                                                                     <div style={{
                                                                         width: '36px',
                                                                         height: '36px',
                                                                         borderRadius: '8px',
                                                                         backgroundColor: '#eff6ff',
                                                                         color: '#2563eb',
                                                                         display: 'flex',
                                                                         alignItems: 'center',
                                                                         justifyContent: 'center',
                                                                         flexShrink: 0
                                                                     }}>
                                                                         <FileText size={18} />
                                                                     </div>
                                                                     <div style={{ minWidth: 0, flex: 1 }}>
                                                                         <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                                                             <span style={{
                                                                                 fontWeight: 600,
                                                                                 fontSize: '13px',
                                                                                 color: '#111827',
                                                                                 overflow: 'hidden',
                                                                                 textOverflow: 'ellipsis',
                                                                                 whiteSpace: 'nowrap',
                                                                                 maxWidth: '280px'
                                                                             }} title={docItem.name}>
                                                                                 {docItem.name}
                                                                             </span>
                                                                             <span style={{
                                                                                 padding: '3px 8px',
                                                                                 borderRadius: '4px',
                                                                                 fontSize: '10px',
                                                                                 fontWeight: 700,
                                                                                 backgroundColor: '#e0e7ff',
                                                                                 color: '#3730a3',
                                                                                 letterSpacing: '0.04em'
                                                                             }}>
                                                                                 {docLabel}
                                                                             </span>
                                                                         </div>
                                                                     </div>
                                                                 </div>

                                                                 <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                                                                     <button
                                                                         type="button"
                                                                         title="View Document"
                                                                         onClick={() => handleViewSelfFillDoc(docItem)}
                                                                         style={{
                                                                             display: 'inline-flex',
                                                                             alignItems: 'center',
                                                                             gap: '5px',
                                                                             padding: '6px 12px',
                                                                             fontSize: '12px',
                                                                             fontWeight: 600,
                                                                             color: '#1d4ed8',
                                                                             backgroundColor: '#eff6ff',
                                                                             border: '1px solid #bfdbfe',
                                                                             borderRadius: '6px',
                                                                             cursor: 'pointer'
                                                                         }}
                                                                     >
                                                                         <Eye size={14} />
                                                                         <span>View</span>
                                                                     </button>
                                                                     <button
                                                                         type="button"
                                                                         title="Download Document"
                                                                         onClick={() => handleDownloadSelfFillDoc(docItem)}
                                                                         style={{
                                                                             display: 'inline-flex',
                                                                             alignItems: 'center',
                                                                             gap: '5px',
                                                                             padding: '6px 12px',
                                                                             fontSize: '12px',
                                                                             fontWeight: 600,
                                                                             color: '#047857',
                                                                             backgroundColor: '#ecfdf5',
                                                                             border: '1px solid #a7f3d0',
                                                                             borderRadius: '6px',
                                                                             cursor: 'pointer'
                                                                         }}
                                                                     >
                                                                         <Download size={14} />
                                                                         <span>Download</span>
                                                                     </button>
                                                                     <button
                                                                         type="button"
                                                                         title="Remove from list"
                                                                         onClick={() => handleDeleteSelfFillDoc(docItem)}
                                                                         style={{
                                                                             display: 'inline-flex',
                                                                             alignItems: 'center',
                                                                             gap: '5px',
                                                                             padding: '6px 12px',
                                                                             fontSize: '12px',
                                                                             fontWeight: 600,
                                                                             color: '#be123c',
                                                                             backgroundColor: '#fff1f2',
                                                                             border: '1px solid #fecdd3',
                                                                             borderRadius: '6px',
                                                                             cursor: 'pointer'
                                                                         }}
                                                                     >
                                                                         <Trash2 size={14} />
                                                                         <span>Delete</span>
                                                                     </button>
                                                                 </div>
                                                             </div>
                                                         );
                                                     })}
                                                 </div>
                                             </div>
                                         )}
                                    </div>

                                    {/* Existing Documents List (in Edit Mode) */}
                                    {isEditMode && (
                                        <div className="mb-6 bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                                            <div className="flex items-center justify-between mb-4 border-b border-gray-100 pb-3">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-sm">
                                                        <FileText size={18} />
                                                    </div>
                                                    <div>
                                                        <h3 className="text-base font-semibold text-gray-900">Existing Uploaded Documents</h3>
                                                        <p className="text-xs text-gray-500">Uploaded records linked to this employee profile</p>
                                                    </div>
                                                </div>
                                                {loadingDocuments && (
                                                    <div className="flex items-center gap-1.5 text-xs text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full font-medium">
                                                        <Loader2 size={13} className="animate-spin" /> Loading...
                                                    </div>
                                                )}
                                            </div>

                                            {existingDocuments.length > 0 ? (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                                    {existingDocuments.map((doc) => {
                                                        const docTypeName = String(doc.documentType || 'OTHER').replace(/_/g, ' ');
                                                        const isVerified = Boolean(doc.isVerified);
                                                        return (
                                                            <div
                                                                key={doc.id}
                                                                style={{
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'space-between',
                                                                    padding: '12px 16px',
                                                                    backgroundColor: '#ffffff',
                                                                    border: '1px solid #e5e7eb',
                                                                    borderRadius: '10px',
                                                                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                                                                    gap: '12px',
                                                                    flexWrap: 'nowrap'
                                                                }}
                                                            >
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
                                                                    <div style={{
                                                                        width: '38px',
                                                                        height: '38px',
                                                                        borderRadius: '8px',
                                                                        backgroundColor: '#eff6ff',
                                                                        color: '#2563eb',
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        justifyContent: 'center',
                                                                        flexShrink: 0
                                                                    }}>
                                                                        <FileText size={20} />
                                                                    </div>
                                                                    <div style={{ minWidth: 0, flex: 1 }}>
                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '2px' }}>
                                                                            <span style={{ fontWeight: 600, fontSize: '13px', color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '220px' }}>
                                                                                {doc.originalFileName || doc.fileName || 'Document File'}
                                                                            </span>
                                                                            <span style={{
                                                                                padding: '2px 8px',
                                                                                borderRadius: '4px',
                                                                                fontSize: '10px',
                                                                                fontWeight: 700,
                                                                                backgroundColor: '#e0e7ff',
                                                                                color: '#3730a3',
                                                                                letterSpacing: '0.03em',
                                                                                textTransform: 'uppercase'
                                                                            }}>
                                                                                {docTypeName}
                                                                            </span>
                                                                            <span style={{
                                                                                padding: '2px 7px',
                                                                                borderRadius: '4px',
                                                                                fontSize: '10px',
                                                                                fontWeight: 600,
                                                                                backgroundColor: isVerified ? '#dcfce7' : '#fef3c7',
                                                                                color: isVerified ? '#166534' : '#92400e'
                                                                            }}>
                                                                                {isVerified ? '✓ Verified' : 'Pending'}
                                                                            </span>
                                                                        </div>
                                                                        <div style={{ fontSize: '11px', color: '#6b7280' }}>
                                                                            {doc.uploadDate && `Uploaded on ${new Date(doc.uploadDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}`}
                                                                            {doc.fileSize && ` • ${(doc.fileSize / 1024).toFixed(1)} KB`}
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                                                                    <button
                                                                        type="button"
                                                                        title="View Document"
                                                                        onClick={() => handleViewExistingDoc(doc)}
                                                                        style={{
                                                                            display: 'inline-flex',
                                                                            alignItems: 'center',
                                                                            gap: '4px',
                                                                            padding: '6px 10px',
                                                                            fontSize: '12px',
                                                                            fontWeight: 600,
                                                                            color: '#1d4ed8',
                                                                            backgroundColor: '#eff6ff',
                                                                            border: '1px solid #bfdbfe',
                                                                            borderRadius: '6px',
                                                                            cursor: 'pointer'
                                                                        }}
                                                                    >
                                                                        <Eye size={14} />
                                                                        <span>View</span>
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        title="Download Document"
                                                                        onClick={() => handleDownloadExistingDoc(doc)}
                                                                        style={{
                                                                            display: 'inline-flex',
                                                                            alignItems: 'center',
                                                                            gap: '4px',
                                                                            padding: '6px 10px',
                                                                            fontSize: '12px',
                                                                            fontWeight: 600,
                                                                            color: '#047857',
                                                                            backgroundColor: '#ecfdf5',
                                                                            border: '1px solid #a7f3d0',
                                                                            borderRadius: '6px',
                                                                            cursor: 'pointer'
                                                                        }}
                                                                    >
                                                                        <Download size={14} />
                                                                        <span>Download</span>
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        title="Delete Document"
                                                                        onClick={() => handleDeleteExistingDoc(doc)}
                                                                        style={{
                                                                            display: 'inline-flex',
                                                                            alignItems: 'center',
                                                                            gap: '4px',
                                                                            padding: '6px 10px',
                                                                            fontSize: '12px',
                                                                            fontWeight: 600,
                                                                            color: '#be123c',
                                                                            backgroundColor: '#fff1f2',
                                                                            border: '1px solid #fecdd3',
                                                                            borderRadius: '6px',
                                                                            cursor: 'pointer'
                                                                        }}
                                                                    >
                                                                        <Trash2 size={14} />
                                                                        <span>Delete</span>
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            ) : (
                                                <div className="text-center py-6 border border-dashed border-gray-200 rounded-lg bg-gray-50/50">
                                                    <FileText size={28} className="mx-auto text-gray-400 mb-1.5" />
                                                    <p className="text-xs text-gray-500 font-medium">No existing documents attached to this employee profile.</p>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {[
                                            { label: 'Upload Appointment Letter', ref: appointmentRef, field: 'appointmentLetter' },
                                            { label: 'Upload Salary Slips', ref: salaryRef, field: 'salarySlips' },
                                            { label: 'Upload Relieving Letter', ref: relivingRef, field: 'relievingLetter' },
                                            { label: 'Upload Experience Letter', ref: experienceRef, field: 'experienceLetter' },
                                        ].map((doc, idx) => (
                                            <div
                                                key={idx}
                                                className={`border border-dashed rounded-lg p-6 flex flex-col items-center justify-center text-center cursor-pointer h-40 transition-colors ${formData[doc.field] ? 'border-green-400 bg-green-50/50' : 'border-gray-300 hover:bg-gray-50'}`}
                                                onClick={() => doc.ref.current?.click()}
                                                onDragOver={handleDragOver}
                                                onDrop={(e) => handleDrop(e, doc.field)}
                                            >
                                                <p className="text-sm font-medium text-gray-700 w-full text-left mb-2">{doc.label}</p>
                                                <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 ${formData[doc.field] ? 'bg-green-100' : 'bg-primary-50'}`}>
                                                    <Upload className={formData[doc.field] ? 'text-green-600' : 'text-primary-600'} size={18} />
                                                </div>
                                                <p className="text-xs text-gray-500">
                                                    Drag & Drop or <span className="text-primary-600 font-medium">choose file</span>
                                                </p>
                                                <input
                                                    type="file"
                                                    ref={doc.ref}
                                                    className="hidden"
                                                    accept=".pdf,.jpg,.jpeg,.png"
                                                    onChange={(e) => handleFileChange(e, doc.field)}
                                                />
                                                {formData[doc.field] && (
                                                    <p className="mt-2 text-xs text-green-700 font-semibold truncate w-full px-2">
                                                        ✓ {formData[doc.field].name}
                                                    </p>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div> {/* Closes the scrollable content area */}

                        {/* Footer Buttons */}
                        <div className="flex-none p-4 border-t border-gray-200 bg-white flex justify-end gap-3 rounded-b-lg">
                            <button
                                type="button"
                                onClick={() => navigate('/admin/employees')}
                                className="px-6 py-2.5 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 shadow-sm transition-colors"
                            >
                                Cancel
                            </button>

                            {activeTab !== 'documents' ? (
                                <button
                                    type="button"
                                    onClick={handleNext}
                                    className="px-6 py-2.5 min-w-[100px] rounded-lg bg-primary-600 text-white font-medium hover:bg-primary-700 shadow-sm transition-colors flex items-center justify-center"
                                >
                                    Next
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={handleSubmit}
                                    disabled={saving}
                                    className="px-6 py-2.5 min-w-[100px] rounded-lg bg-primary-600 text-white font-medium hover:bg-primary-700 shadow-sm transition-colors flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed"
                                >
                                    {saving ? (isEditMode ? 'Updating...' : 'Adding...') : (isEditMode ? 'Update' : 'Add')}
                                </button>
                            )}
                        </div>
                    </form>
                </div>
            </div>

            {/* Document Preview Modal */}
            {viewingDoc && createPortal(
                <div
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(0, 0, 0, 0.75)',
                        backdropFilter: 'blur(3px)',
                        zIndex: 99999,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '16px'
                    }}
                    onClick={closePreviewModal}
                >
                    <div
                        style={{
                            backgroundColor: '#ffffff',
                            borderRadius: '12px',
                            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                            maxWidth: '850px',
                            width: '100%',
                            maxHeight: '90vh',
                            display: 'flex',
                            flexDirection: 'column',
                            overflow: 'hidden'
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div style={{
                            padding: '16px 20px',
                            borderBottom: '1px solid #e5e7eb',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            backgroundColor: '#f9fafb'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{ padding: '6px', backgroundColor: '#eff6ff', color: '#1d4ed8', borderRadius: '6px' }}>
                                    <Eye size={18} />
                                </div>
                                <div>
                                    <h3 style={{ fontWeight: 600, color: '#111827', fontSize: '15px', margin: 0 }}>
                                        {viewingDoc.originalFileName || viewingDoc.fileName || 'Document Preview'}
                                    </h3>
                                    <span style={{ fontSize: '11px', color: '#6b7280', fontWeight: 500 }}>
                                        {String(viewingDoc.documentType || '').replace(/_/g, ' ')}
                                    </span>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={closePreviewModal}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    fontSize: '20px',
                                    cursor: 'pointer',
                                    color: '#6b7280',
                                    padding: '4px 8px',
                                    borderRadius: '6px'
                                }}
                            >
                                ✕
                            </button>
                        </div>
                        <div style={{
                            padding: '16px',
                            flex: 1,
                            overflow: 'auto',
                            backgroundColor: '#f3f4f6',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            minHeight: '400px'
                        }}>
                            {loadingPreview ? (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', color: '#4b5563' }}>
                                    <Loader2 size={32} className="animate-spin text-blue-600" />
                                    <p style={{ fontSize: '14px', fontWeight: 500 }}>Loading document preview...</p>
                                </div>
                            ) : previewUrl ? (
                                (viewingDoc.mimeType?.includes('image') || (viewingDoc.originalFileName && viewingDoc.originalFileName.match(/\.(jpg|jpeg|png|webp|gif)$/i))) ? (
                                    <img
                                        src={previewUrl}
                                        alt="Document Preview"
                                        style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain', borderRadius: '6px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}
                                    />
                                ) : (
                                    <div style={{ width: '100%', height: '70vh', display: 'flex', flexDirection: 'column' }}>
                                        <iframe
                                            src={previewUrl.startsWith('http') ? `https://docs.google.com/gview?url=${encodeURIComponent(previewUrl)}&embedded=true` : `${previewUrl}#toolbar=0`}
                                            title="Document PDF Preview"
                                            style={{ width: '100%', flex: 1, border: '1px solid #d1d5db', borderRadius: '6px' }}
                                        />
                                        <div style={{ padding: '10px 14px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: '0 0 6px 6px', marginTop: '6px' }}>
                                            <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>
                                                If your browser blocks the inline PDF, click to open directly:
                                            </span>
                                            <a
                                                href={previewUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 14px', backgroundColor: '#2563eb', color: '#ffffff', borderRadius: '6px', fontSize: '12px', fontWeight: 600, textDecoration: 'none' }}
                                            >
                                                <ExternalLink size={14} /> Open PDF in New Tab
                                            </a>
                                        </div>
                                    </div>
                                )
                            ) : (
                                <div style={{ textAlign: 'center', color: '#6b7280', padding: '32px' }}>
                                    <FileText size={48} style={{ margin: '0 auto 8px', color: '#9ca3af' }} />
                                    <p style={{ fontSize: '14px' }}>Unable to render preview for this file type.</p>
                                </div>
                            )}
                        </div>
                        <div style={{
                            padding: '12px 20px',
                            borderTop: '1px solid #e5e7eb',
                            backgroundColor: '#ffffff',
                            display: 'flex',
                            justifyContent: 'flex-end',
                            gap: '10px'
                        }}>
                            <button
                                type="button"
                                onClick={() => handleDownloadExistingDoc(viewingDoc)}
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    padding: '8px 16px',
                                    fontSize: '13px',
                                    fontWeight: 600,
                                    color: '#047857',
                                    backgroundColor: '#ecfdf5',
                                    border: '1px solid #a7f3d0',
                                    borderRadius: '6px',
                                    cursor: 'pointer'
                                }}
                            >
                                <Download size={15} /> Download Document
                            </button>
                            <button
                                type="button"
                                onClick={closePreviewModal}
                                style={{
                                    padding: '8px 16px',
                                    fontSize: '13px',
                                    fontWeight: 600,
                                    color: '#374151',
                                    backgroundColor: '#f3f4f6',
                                    border: '1px solid #d1d5db',
                                    borderRadius: '6px',
                                    cursor: 'pointer'
                                }}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Delete Confirmation Modal */}
            {deleteTargetDoc && createPortal(
                <div
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(0, 0, 0, 0.65)',
                        backdropFilter: 'blur(3px)',
                        zIndex: 99999,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '16px'
                    }}
                    onClick={() => !deletingDoc && setDeleteTargetDoc(null)}
                >
                    <div
                        style={{
                            backgroundColor: '#ffffff',
                            borderRadius: '12px',
                            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                            maxWidth: '440px',
                            width: '100%',
                            overflow: 'hidden'
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div style={{
                            padding: '16px 20px',
                            borderBottom: '1px solid #f3f4f6',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            backgroundColor: '#fff1f2'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: '8px',
                                    backgroundColor: '#ffe4e6',
                                    color: '#e11d48',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    <Trash2 size={18} />
                                </div>
                                <h3 style={{ fontWeight: 700, color: '#9f1239', fontSize: '16px', margin: 0 }}>
                                    Delete Document
                                </h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setDeleteTargetDoc(null)}
                                disabled={deletingDoc}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    fontSize: '18px',
                                    cursor: deletingDoc ? 'not-allowed' : 'pointer',
                                    color: '#9ca3af',
                                    padding: '4px'
                                }}
                            >
                                ✕
                            </button>
                        </div>

                        <div style={{ padding: '20px' }}>
                            <p style={{ fontSize: '14px', color: '#374151', margin: 0, lineHeight: 1.5 }}>
                                Are you sure you want to delete <strong style={{ color: '#111827' }}>{deleteTargetDoc.originalFileName || deleteTargetDoc.fileName || 'this document'}</strong>?
                            </p>
                            <p style={{ fontSize: '12px', color: '#6b7280', margin: '8px 0 0 0' }}>
                                This action will permanently delete the file from database and storage. It cannot be undone.
                            </p>
                        </div>

                        <div style={{
                            padding: '12px 20px',
                            borderTop: '1px solid #f3f4f6',
                            backgroundColor: '#f9fafb',
                            display: 'flex',
                            justifyContent: 'flex-end',
                            gap: '10px'
                        }}>
                            <button
                                type="button"
                                onClick={() => setDeleteTargetDoc(null)}
                                disabled={deletingDoc}
                                style={{
                                    padding: '8px 16px',
                                    fontSize: '13px',
                                    fontWeight: 600,
                                    color: '#4b5563',
                                    backgroundColor: '#ffffff',
                                    border: '1px solid #d1d5db',
                                    borderRadius: '6px',
                                    cursor: deletingDoc ? 'not-allowed' : 'pointer'
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmDeleteDoc}
                                disabled={deletingDoc}
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    padding: '8px 18px',
                                    fontSize: '13px',
                                    fontWeight: 600,
                                    color: '#ffffff',
                                    backgroundColor: deletingDoc ? '#f43f5e' : '#e11d48',
                                    border: 'none',
                                    borderRadius: '6px',
                                    cursor: deletingDoc ? 'not-allowed' : 'pointer',
                                    opacity: deletingDoc ? 0.8 : 1
                                }}
                            >
                                {deletingDoc ? (
                                    <>
                                        <Loader2 size={15} className="animate-spin" />
                                        <span>Deleting...</span>
                                    </>
                                ) : (
                                    <>
                                        <Trash2 size={15} />
                                        <span>Delete Document</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Self-Fill Document Deletion Confirm Modal */}
            {deleteSelfFillTargetDoc && createPortal(
                <div
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(0, 0, 0, 0.65)',
                        backdropFilter: 'blur(3px)',
                        zIndex: 99999,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '16px'
                    }}
                    onClick={() => !deletingDoc && setDeleteSelfFillTargetDoc(null)}
                >
                    <div
                        style={{
                            backgroundColor: '#ffffff',
                            borderRadius: '12px',
                            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                            maxWidth: '440px',
                            width: '100%',
                            overflow: 'hidden'
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div style={{
                            padding: '16px 20px',
                            borderBottom: '1px solid #f3f4f6',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            backgroundColor: '#fff1f2'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: '8px',
                                    backgroundColor: '#ffe4e6',
                                    color: '#e11d48',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    <Trash2 size={18} />
                                </div>
                                <h3 style={{ fontWeight: 700, color: '#9f1239', fontSize: '16px', margin: 0 }}>
                                    Remove Self-Fill Document
                                </h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setDeleteSelfFillTargetDoc(null)}
                                disabled={deletingDoc}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    fontSize: '18px',
                                    cursor: deletingDoc ? 'not-allowed' : 'pointer',
                                    color: '#9ca3af',
                                    padding: '4px'
                                }}
                            >
                                ✕
                            </button>
                        </div>

                        <div style={{ padding: '20px' }}>
                            <p style={{ fontSize: '14px', color: '#374151', margin: 0, lineHeight: 1.5 }}>
                                Are you sure you want to remove <strong style={{ color: '#111827' }}>{deleteSelfFillTargetDoc.name}</strong> from candidate self-fill details?
                            </p>
                            <p style={{ fontSize: '12px', color: '#6b7280', margin: '8px 0 0 0' }}>
                                This will exclude this document from being associated with the candidate profile.
                            </p>
                        </div>

                        <div style={{
                            padding: '12px 20px',
                            borderTop: '1px solid #f3f4f6',
                            backgroundColor: '#f9fafb',
                            display: 'flex',
                            justifyContent: 'flex-end',
                            gap: '10px'
                        }}>
                            <button
                                type="button"
                                onClick={() => setDeleteSelfFillTargetDoc(null)}
                                disabled={deletingDoc}
                                style={{
                                    padding: '8px 16px',
                                    fontSize: '13px',
                                    fontWeight: 600,
                                    color: '#4b5563',
                                    backgroundColor: '#ffffff',
                                    border: '1px solid #d1d5db',
                                    borderRadius: '6px',
                                    cursor: deletingDoc ? 'not-allowed' : 'pointer'
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmDeleteSelfFillDoc}
                                disabled={deletingDoc}
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    padding: '8px 18px',
                                    fontSize: '13px',
                                    fontWeight: 600,
                                    color: '#ffffff',
                                    backgroundColor: deletingDoc ? '#f43f5e' : '#e11d48',
                                    border: 'none',
                                    borderRadius: '6px',
                                    cursor: deletingDoc ? 'not-allowed' : 'pointer',
                                    opacity: deletingDoc ? 0.8 : 1
                                }}
                            >
                                {deletingDoc ? (
                                    <>
                                        <Loader2 size={15} className="animate-spin" />
                                        <span>Removing...</span>
                                    </>
                                ) : (
                                    <>
                                        <Trash2 size={15} />
                                        <span>Remove Document</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}
