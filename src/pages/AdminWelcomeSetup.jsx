import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminAPI, onboardingAPI, organizationAPI } from '../services/api';
import { CheckCircle2, AlertCircle, Clock, Users, Calendar, BadgeCheck, FileCheck, Building2, Pencil, Trash2, Home } from 'lucide-react';

// Step order and labels match System Settings; each step can be configured or skipped (no skip to dashboard).
const STEP_CONFIG = [
  { id: 0, label: 'Company Details', icon: Building2, description: 'Review and update basic company details like name, PAN and GST. These are shared across the system.' },
  { id: 1, label: 'Shifts', icon: Clock, description: 'Define your standard working hours. You can add more detailed shifts later from the attendance module in System Settings.' },
  { id: 2, label: 'Weekends', icon: Calendar, description: 'Choose which days are considered weekends for your organization. These days will be excluded from regular working calculations.' },
  { id: 3, label: 'Departments', icon: Users, description: 'Create at least one department so employees can be grouped and reported correctly.' },
  { id: 7, label: 'Positions', icon: BadgeCheck, description: 'Create positions (job titles) for your employees. This helps in defining roles and hierarchies.' },
  { id: 4, label: 'Leave Types', icon: Calendar, description: 'Create at least one leave type, such as Annual Leave. You can fine-tune leave policies later from System Settings.' },
  { id: 8, label: 'Locations', icon: Building2, description: 'Add office locations where employees are based.' },
  { id: 9, label: 'WFH Policy', icon: Home, description: 'Configure your Work From Home policy and rules.' },
  { id: 10, label: 'Notice Period', icon: AlertCircle, description: 'Set default notice period and related settings for exits.' },
  { id: 5, label: 'Emp ID Format', icon: BadgeCheck, description: 'Choose an Employee ID prefix and starting number. You can refine this later from System Settings.' },
  { id: 6, label: 'Review & Complete', icon: FileCheck, description: 'Review your setup and accept the terms to complete onboarding. You cannot access the dashboard until setup is complete.' },
];

const PROGRESS_STEPS = [1, 2, 3, 7, 4, 8, 9, 10, 5, 6];

export default function AdminWelcomeSetup() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [status, setStatus] = useState({
    shiftsConfigured: false,
    weekendsConfigured: false,
    departmentsConfigured: false,
    positionsConfigured: false,
    leaveTypesConfigured: false,
    empIdConfigured: false,
    shiftsSkipped: false,
    weekendsSkipped: false,
    departmentsSkipped: false,
    positionsSkipped: false,
    leaveTypesSkipped: false,
    empIdSkipped: false,
  });

  const [locationsList, setLocationsList] = useState([]);
  const [locationsConfigured, setLocationsConfigured] = useState(false);
  const [locationsSkipped, setLocationsSkipped] = useState(false);

  const [wfhPolicy, setWfhPolicy] = useState(null);
  const [wfhConfigured, setWfhConfigured] = useState(false);
  const [wfhSkipped, setWfhSkipped] = useState(false);

  const [noticeConfig, setNoticeConfig] = useState(null);
  const [noticeConfigured, setNoticeConfigured] = useState(false);
  const [noticeSkipped, setNoticeSkipped] = useState(false);

  const [activeStep, setActiveStep] = useState(1);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [hasReachedReview, setHasReachedReview] = useState(false);

  const [companyDetails, setCompanyDetails] = useState({
    name: '',
    companyPan: '',
    gstNumber: '',
  });
  const [savingCompany, setSavingCompany] = useState(false);

  // For "see your ..." lists inside the wizard
  const [shiftsList, setShiftsList] = useState([]);
  const [isShiftEditorOpen, setIsShiftEditorOpen] = useState(false);
  const [departmentsList, setDepartmentsList] = useState([]);
  const [positionsList, setPositionsList] = useState([]);
  const [leaveTypesList, setLeaveTypesList] = useState([]);
  const [isDepartmentEditorOpen, setIsDepartmentEditorOpen] = useState(false);
  const [isPositionEditorOpen, setIsPositionEditorOpen] = useState(false);
  const [isLeaveTypeEditorOpen, setIsLeaveTypeEditorOpen] = useState(false);
  const [editingShiftId, setEditingShiftId] = useState(null);
  const [editingDepartmentId, setEditingDepartmentId] = useState(null);
  const [editingPositionId, setEditingPositionId] = useState(null);
  const [editingLeaveTypeId, setEditingLeaveTypeId] = useState(null);

  const [isLocationEditorOpen, setIsLocationEditorOpen] = useState(false);
  const [editingLocationId, setEditingLocationId] = useState(null);
  const [locationForm, setLocationForm] = useState({
    locationName: '',
    locationCode: '',
    address: '',
    contactPerson: '',
    shiftTiming: '',
    timezone: 'Asia/Kolkata'
  });

  const [shiftForm, setShiftForm] = useState({
    shiftName: 'General Shift',
    shiftType: 'REGULAR',
    startTime: '09:00',
    endTime: '18:00',
    description: '',
  });

  const [weekendForm, setWeekendForm] = useState({
    id: null,
    monday: false,
    tuesday: false,
    wednesday: false,
    thursday: false,
    friday: false,
    saturday: true,
    sunday: true,
  });

  const [departmentForm, setDepartmentForm] = useState({
    name: 'HR',
    description: '',
  });

  const [positionForm, setPositionForm] = useState({
    title: '',
    description: '',
  });


  const [leaveTypeForm, setLeaveTypeForm] = useState({
    leaveTypeName: '',
    leaveTypeCode: '',
    defaultLeaveCount: 12,
  });

  const [availableLeaveTypeCodes, setAvailableLeaveTypeCodes] = useState([]);
  const [selectedLeaveTemplate, setSelectedLeaveTemplate] = useState('');

  const LEAVE_TYPE_LABELS = {
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
    WFH: 'Work From Home',
    CO: 'Compensatory Off',
    FL: 'Festival Leave',
    BDL: 'Birthday Leave',
    ANL: 'Anniversary Leave',
  };

  const [empIdForm, setEmpIdForm] = useState({
    prefix: 'EMP',
    nextNumber: 1,
    padding: 3,
    locationBased: false,
    nextEmployeeIdExample: 'EMP001',
  });
  const [prefixAvailable, setPrefixAvailable] = useState(true);
  const [prefixChecking, setPrefixChecking] = useState(false);

  useEffect(() => {
    const timer = setTimeout(async () => {
      const prefix = empIdForm.prefix?.trim();
      if (!prefix || prefix.length < 2) {
        setPrefixAvailable(true);
        return;
      }
      try {
        setPrefixChecking(true);
        const res = await adminAPI.checkPrefixAvailability(prefix);
        setPrefixAvailable(res?.data?.available ?? res?.available ?? true);
      } catch (err) {
        console.error('Error checking prefix availability', err);
        setPrefixAvailable(true); // Fallback to avoid blocking if API fails
      } finally {
        setPrefixChecking(false);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [empIdForm.prefix]);

  useEffect(() => {
    // Generate simple preview
    const prefix = empIdForm.prefix || '';
    const padding = parseInt(empIdForm.padding || '3', 10);
    const numPart = String(empIdForm.nextNumber).padStart(padding, '0');
    const example = empIdForm.locationBased
      ? `${prefix}LOC${numPart}`
      : `${prefix}${numPart}`;
    setEmpIdForm(prev => {
      if (prev.nextEmployeeIdExample === example) return prev;
      return { ...prev, nextEmployeeIdExample: example };
    });
  }, [empIdForm.prefix, empIdForm.nextNumber, empIdForm.locationBased, empIdForm.padding]);

  const [toast, setToast] = useState(null);
  const [toastVisible, setToastVisible] = useState(false);

  const buildErrorMessage = (prefix, err, fallback) => {
    const data = err?.response?.data;
    let backendMessage = '';

    if (data) {
      if (typeof data === 'string') {
        backendMessage = data;
      } else if (typeof data === 'object') {
        const mainMsg = data.message || data.error || '';
        const listErrors = Array.isArray(data.errors)
          ? data.errors.join(' | ')
          : Array.isArray(data.errorMessages)
            ? data.errorMessages.join(' | ')
            : '';
        backendMessage = [mainMsg, listErrors].filter(Boolean).join(' | ');
      }
    }

    if (backendMessage) {
      return `${prefix}: ${backendMessage}`;
    }
    return `${prefix}: ${fallback}`;
  };

  useEffect(() => {
    if (!toast) return;
    setToastVisible(true);
    const hideTimer = setTimeout(() => {
      setToastVisible(false);
    }, 2600);
    const clearTimer = setTimeout(() => {
      setToast(null);
    }, 3000);
    return () => {
      clearTimeout(hideTimer);
      clearTimeout(clearTimer);
    };
  }, [toast]);

  // Check server-side onboarding state on mount — if already complete, redirect to dashboard
  useEffect(() => {
    let cancelled = false;
    const verifyOnboarding = async () => {
      try {
        const res = await onboardingAPI.getMyOnboardingState();
        if (!cancelled && res?.data?.onboardingCompleted === true) {
          window.safeLocalStorage.setItem('adminOnboardingComplete', 'true');
          try {
            const storedAdmin = window.safeSessionStorage.getItem('adminUser');
            if (storedAdmin) {
              const parsed = JSON.parse(storedAdmin);
              parsed.onboardingCompleted = true;
              window.safeSessionStorage.setItem('adminUser', JSON.stringify(parsed));
            }
          } catch (e) { /* ignore */ }
          navigate('/admin/dashboard', { replace: true });
        } else if (!cancelled && res?.data?.isTenantAdmin === false) {
          // Non-tenant-admin roles should not stay on the wizard
          window.safeLocalStorage.setItem('adminOnboardingComplete', 'true');
          navigate('/admin/dashboard', { replace: true });
        }
      } catch (err) {
        // If the check fails, let the wizard load normally
        console.warn('Onboarding verification failed:', err);
      }
    };
    verifyOnboarding();
    return () => { cancelled = true; };
  }, [navigate]);

  useEffect(() => {
    const fetchInitial = async () => {
      try {
        setLoading(true);
        setError('');

        const [
          shiftsRes,
          weekendRes,
          deptsRes,
          positionsRes,
          leaveTypesRes,
          empIdRes,
          availableCodesRes,
          locationsRes,
          wfhRes,
          noticeRes,
        ] = await Promise.all([
          adminAPI.getAllShifts().catch(() => ({ data: [] })),
          adminAPI.getWeekendConfig().catch(() => ({ data: null })),
          adminAPI.getAllDepartments().catch(() => ({ data: [] })),
          (adminAPI.getAllPositions?.() ?? Promise.resolve({ data: [] })).catch(() => ({ data: [] })),
          adminAPI.getAllLeaveTypes().catch(() => ({ data: [] })),
          adminAPI.getEmployeeIdFormat().catch(() => ({ data: null })),
          (adminAPI.getAvailableLeaveTypeCodes?.() ?? Promise.resolve({ data: [] })).catch(() => ({ data: [] })),
          // locationsAPI is exported separately - import dynamically to avoid top-level circular issues
          import('../services/api').then((m) => m.locationsAPI.list().catch(() => ({ data: [] }))),
          (adminAPI.getWfhPolicyConfig?.() ?? Promise.resolve({ data: null })).catch(() => ({ data: null })),
          (adminAPI.getNoticePeriodConfig?.() ?? Promise.resolve({ data: null })).catch(() => ({ data: null })),
        ]);

        const shifts = shiftsRes?.data || shiftsRes || [];
        const depts = deptsRes?.data || deptsRes || [];
        const positions = positionsRes?.data || positionsRes || [];
        const weekend = weekendRes?.data || weekendRes || null;
        const leaveTypes = leaveTypesRes?.data || leaveTypesRes || [];
        const empId = empIdRes?.data || empIdRes || null;
        const availableCodes = availableCodesRes?.data || availableCodesRes || [];
        const locData = locationsRes?.data || locationsRes || [];
        const wfhData = wfhRes?.data || wfhRes || null;
        const noticeData = noticeRes?.data || noticeRes || null;

        const shiftsConfigured = Array.isArray(shifts) && shifts.length > 0;
        const departmentsConfigured = Array.isArray(depts) && depts.length > 0;
        const positionsConfigured = Array.isArray(positions) && positions.length > 0;
        const weekendsConfigured = !!(weekend && weekend.id);
        const leaveTypesConfigured = Array.isArray(leaveTypes) && leaveTypes.length > 0;
        const empIdConfigured = !!empId && !!empId.prefix;

        // normalize locations
        const normalizedLocations = Array.isArray(locData?.items)
          ? locData.items
          : Array.isArray(locData)
          ? locData
          : Array.isArray(locData?.content)
          ? locData.content
          : [];
        const locationsConfiguredLocal = Array.isArray(normalizedLocations) && normalizedLocations.length > 0;
        const wfhConfiguredLocal = !!(wfhData && Object.keys(wfhData).length > 0);
        const noticeConfiguredLocal = !!(noticeData && Object.keys(noticeData).length > 0);

        if (Array.isArray(shifts)) setShiftsList(shifts);
        if (Array.isArray(depts)) setDepartmentsList(depts);
        if (Array.isArray(positions)) setPositionsList(positions);
        if (Array.isArray(availableCodes)) setAvailableLeaveTypeCodes(availableCodes);
        if (Array.isArray(normalizedLocations)) setLocationsList(normalizedLocations);
        const finalWfhPolicyObj = wfhData && Object.keys(wfhData).length > 0 ? wfhData : {
          maxDaysPerWeek: null,
          maxDaysPerMonth: null,
          allowWeekends: false,
          allowHolidays: false,
          allowPastDates: false
        };
        setWfhPolicy(finalWfhPolicyObj);

        const configs = Array.isArray(noticeData) ? noticeData : (noticeData?.items || []);
        const defaultCfg = Array.isArray(configs) ? configs.find(c => !c.position && !c.department) : null;
        const finalNoticeConfig = defaultCfg || (Array.isArray(configs) && configs.length > 0 ? configs[0] : (noticeData && typeof noticeData === 'object' && !Array.isArray(noticeData) ? noticeData : null));
        setNoticeConfig(finalNoticeConfig || { defaultNoticePeriodDays: 30, noticePeriodDays: 30 });

        if (shiftsConfigured) {
          const first = shifts[0];
          setShiftForm({
            shiftName: first.shiftName || 'General Shift',
            shiftType: first.shiftType || 'REGULAR',
            startTime: first.startTime || '09:00',
            endTime: first.endTime || '18:00',
            description: first.description || '',
          });
        }

        if (weekend) {
          setWeekendForm((prev) => ({
            ...prev,
            id: weekend.id || null,
            monday: weekend.monday ?? false,
            tuesday: weekend.tuesday ?? false,
            wednesday: weekend.wednesday ?? false,
            thursday: weekend.thursday ?? false,
            friday: weekend.friday ?? false,
            saturday: weekend.saturday ?? true,
            sunday: weekend.sunday ?? true,
          }));
        }

        if (departmentsConfigured) {
          const firstDept = depts[0];
          setDepartmentForm({
            name: firstDept.name || 'HR',
            description: firstDept.description || '',
          });
        }

        if (Array.isArray(leaveTypes)) {
          setLeaveTypesList(leaveTypes);
        }

        if (leaveTypesConfigured) {
          const lt = leaveTypes[0];
          setLeaveTypeForm({
            leaveTypeName: lt.leaveTypeName || 'Annual Leave',
            leaveTypeCode: lt.leaveTypeCode || 'AL',
            defaultLeaveCount: lt.defaultLeaveCount ?? 12,
          });
        }

        if (empId) {
          setEmpIdForm({
            prefix: empId.prefix || 'EMP',
            nextNumber: empId.nextNumber || 1,
            locationBased: !!empId.locationBased,
            nextEmployeeIdExample:
              empId.nextEmployeeIdExample ||
              `${(empId.prefix || 'EMP').toUpperCase()}${String(empId.nextNumber || 1).padStart(
                3,
                '0'
              )}`,
          });
        }

        setStatus((prev) => ({
          ...prev,
          shiftsConfigured,
          weekendsConfigured,
          departmentsConfigured,
          positionsConfigured,
          leaveTypesConfigured,
          empIdConfigured,
        }));

        setLocationsConfigured(locationsConfiguredLocal);
        setWfhConfigured(wfhConfiguredLocal);
        setNoticeConfigured(noticeConfiguredLocal);

        // Do not redirect to dashboard here; user must complete Review step and accept terms.
        // Determine first step that is not configured (skipped state is in React state; on first load all skipped are false)
        if (!shiftsConfigured) setActiveStep(1);
        else if (!weekendsConfigured) setActiveStep(2);
        else if (!departmentsConfigured) setActiveStep(3);
        else if (!positionsConfigured) setActiveStep(7);
        else if (!leaveTypesConfigured) setActiveStep(4);
        else if (!locationsConfiguredLocal) setActiveStep(8);
        else if (!wfhConfiguredLocal) setActiveStep(9);
        else if (!noticeConfiguredLocal) setActiveStep(10);
        else if (!empIdConfigured) setActiveStep(5);
        else setActiveStep(6);
      } catch (err) {
        console.error('Admin welcome setup status error', err);
        setError(
          buildErrorMessage(
            'Setup',
            err,
            'Unable to load setup status. Please fill each step and try again.'
          )
        );
      } finally {
        setLoading(false);
      }
    };

    fetchInitial();
  }, [navigate]);

  // Fetch company (organization) details to pre-populate name / PAN / GST in setup header
  useEffect(() => {
    const fetchCompany = async () => {
      try {
        const res = await organizationAPI.get();
        const data = res.data || {};
        setCompanyDetails({
          name: data.company_name || '',
          companyPan: data.company_pan || '',
          gstNumber: data.gst_number || '',
        });
      } catch (e) {
        // Non-blocking; just log
        console.error('Error loading organization/company details for setup:', e);
      }
    };
    fetchCompany();
  }, []);

  const stepDone = (configured, skipped) => !!configured || !!skipped;
  const allRequiredStepsDone =
    stepDone(status.shiftsConfigured, status.shiftsSkipped) &&
    stepDone(status.weekendsConfigured, status.weekendsSkipped) &&
    stepDone(status.departmentsConfigured, status.departmentsSkipped) &&
    stepDone(status.positionsConfigured, status.positionsSkipped) &&
    stepDone(status.leaveTypesConfigured, status.leaveTypesSkipped) &&
    stepDone(locationsConfigured, locationsSkipped) &&
    stepDone(wfhConfigured, wfhSkipped) &&
    stepDone(noticeConfigured, noticeSkipped) &&
    stepDone(status.empIdConfigured, status.empIdSkipped);

  const canNavigateToStep = (targetId) => {
    if (targetId === 0) return true;
    if (hasReachedReview) return true;

    // Allow clicking back to any step that is already done or currently active
    if (isStepDone(targetId) || activeStep === targetId) return true;

    const targetIndex = PROGRESS_STEPS.indexOf(targetId);
    if (targetIndex <= 0) return true; // Step 1 is always reachable

    // Next step is allowed if the previous one is done
    const prevStepId = PROGRESS_STEPS[targetIndex - 1];
    return isStepDone(prevStepId);
  };

  const handleSkipStep = (stepId) => {
    if (stepId === 1) { setStatus((s) => ({ ...s, shiftsSkipped: true })); setActiveStep(2); }
    else if (stepId === 2) { setStatus((s) => ({ ...s, weekendsSkipped: true })); setActiveStep(3); }
    else if (stepId === 3) { setStatus((s) => ({ ...s, departmentsSkipped: true })); setActiveStep(7); }
    else if (stepId === 7) { setStatus((s) => ({ ...s, positionsSkipped: true })); setActiveStep(4); }
    else if (stepId === 4) { setStatus((s) => ({ ...s, leaveTypesSkipped: true })); setActiveStep(8); }
    else if (stepId === 8) { setLocationsSkipped(true); setActiveStep(9); }
    else if (stepId === 9) { setWfhSkipped(true); setActiveStep(10); }
    else if (stepId === 10) { setNoticeSkipped(true); setActiveStep(5); }
    else if (stepId === 5) { setStatus((s) => ({ ...s, empIdSkipped: true })); setActiveStep(6); setHasReachedReview(true); }
    setError('');
  };

  const handleCompleteSetup = async (e) => {
    e.preventDefault();
    if (!termsAccepted) {
      setError('You must accept the Terms and Conditions to complete setup.');
      return;
    }
    setError('');
    setCompleting(true);
    try {
      await onboardingAPI.completeOnboarding();
      window.safeLocalStorage.setItem('adminOnboardingComplete', 'true');
      // Also update the stored admin user so window.safeSessionStorage stays in sync
      try {
        const storedAdmin = window.safeSessionStorage.getItem('adminUser');
        if (storedAdmin) {
          const parsed = JSON.parse(storedAdmin);
          parsed.onboardingCompleted = true;
          window.safeSessionStorage.setItem('adminUser', JSON.stringify(parsed));
        }
      } catch (e) { /* ignore */ }
      navigate('/admin/dashboard', { replace: true });
    } catch (err) {
      console.error('Failed to complete onboarding:', err);
      setError(
        buildErrorMessage('Setup', err, 'Unable to complete setup. Please try again.')
      );
    } finally {
      setCompleting(false);
    }
  };

  const handleSaveCompanyDetails = async (e) => {
    e.preventDefault();
    setSavingCompany(true);
    const trimmedCompanyName = (companyDetails.name || '').trim();
    if (!trimmedCompanyName) {
      setError('Company details: Please enter a company name.');
      setSavingCompany(false);
      return;
    }
    if (trimmedCompanyName.length > 100) {
      setError('Company details: Company name must be less than 100 characters.');
      setSavingCompany(false);
      return;
    }

    const panPattern = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    if (companyDetails.companyPan && !panPattern.test(companyDetails.companyPan)) {
      setError('Company details: Invalid PAN format (e.g., ABCDE1234F).');
      setSavingCompany(false);
      return;
    }

    const gstPattern = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    if (companyDetails.gstNumber && !gstPattern.test(companyDetails.gstNumber)) {
      setError('Company details: Invalid GST format.');
      setSavingCompany(false);
      return;
    }

    try {
      const payload = {
        name: trimmedCompanyName,
        companyPan: companyDetails.companyPan || undefined,
        gstNumber: companyDetails.gstNumber || undefined,
      };
      await organizationAPI.save(payload, false);
      // After saving company details, move into the main setup flow (Shifts step)
      setActiveStep(1);
    } catch (err) {
      console.error('Failed to save company details from setup:', err);
      setError(
        buildErrorMessage(
          'Company details',
          err,
          'Unable to save company details. Please try again.'
        )
      );
    } finally {
      setSavingCompany(false);
    }
  };

  const handleCreateShift = async (e) => {
    e.preventDefault();
    setError('');

    // If a shift is already configured, this submit just moves to the next step
    if (status.shiftsConfigured) {
      setActiveStep(2);
      return;
    }

    const trimmedName = shiftForm.shiftName.trim();
    if (!trimmedName) {
      setError('Shifts: Please enter a shift name.');
      return;
    }
    if (trimmedName.length > 50) {
      setError('Shifts: Shift name must be less than 50 characters.');
      return;
    }
    if (!shiftForm.startTime || !shiftForm.endTime) {
      setError('Shifts: Please provide both start and end times.');
      return;
    }
    if (shiftForm.startTime === shiftForm.endTime) {
      setError('Shifts: Start time and End time cannot be the same.');
      return;
    }
    const isDuplicate = shiftsList.some(s => s.shiftName.toLowerCase() === trimmedName.toLowerCase());
    if (isDuplicate) {
      setError(`Shifts: A shift with name "${trimmedName}" already exists.`);
      return;
    }

    try {
      setLoading(true);
      await adminAPI.createShift({
        shiftName: trimmedName,
        shiftType: shiftForm.shiftType || 'REGULAR',
        startTime: shiftForm.startTime,
        endTime: shiftForm.endTime,
        description: shiftForm.description?.trim() || null,
      });
      setStatus((prev) => ({ ...prev, shiftsConfigured: true }));
      // Refresh list to stay in sync
      const res = await adminAPI.getAllShifts();
      const shifts = res?.data || res || [];
      if (Array.isArray(shifts)) setShiftsList(shifts);
      setActiveStep(2);
    } catch (err) {
      console.error('Error creating shift', err);
      setError(
        buildErrorMessage(
          'Shifts',
          err,
          'Unable to save shift. Please check the values and try again.'
        )
      );
    } finally {
      setLoading(false);
    }
  };

  // Add another shift but stay on the same step; update local list so user can see all configured shifts
  const handleAddShiftOnly = async () => {
    setError('');

    const trimmedName = shiftForm.shiftName.trim();
    if (!trimmedName) {
      setError('Shifts: Please enter a shift name.');
      return;
    }
    if (trimmedName.length > 50) {
      setError('Shifts: Shift name must be less than 50 characters.');
      return;
    }
    if (!shiftForm.startTime || !shiftForm.endTime) {
      setError('Shifts: Please provide both start and end times.');
      return;
    }
    if (shiftForm.startTime === shiftForm.endTime) {
      setError('Shifts: Start time and End time cannot be the same.');
      return;
    }
    const isDuplicate = shiftsList.some(s => s.shiftName.toLowerCase() === trimmedName.toLowerCase() && s.id !== editingShiftId);
    if (isDuplicate) {
      setError(`Shifts: A shift with name "${trimmedName}" already exists.`);
      return;
    }

    try {
      setLoading(true);
      if (editingShiftId) {
        await adminAPI.updateShift(editingShiftId, {
          shiftName: trimmedName,
          shiftType: shiftForm.shiftType || 'REGULAR',
          startTime: shiftForm.startTime,
          endTime: shiftForm.endTime,
          description: shiftForm.description?.trim() || null,
        });
        setToast({ type: 'success', message: 'Shift updated successfully.' });
      } else {
        await adminAPI.createShift({
          shiftName: trimmedName,
          shiftType: shiftForm.shiftType || 'REGULAR',
          startTime: shiftForm.startTime,
          endTime: shiftForm.endTime,
          description: shiftForm.description?.trim() || null,
        });
        setToast({ type: 'success', message: 'Shift added successfully.' });
      }
      // Mark as configured and refresh list from backend
      setStatus((prev) => ({ ...prev, shiftsConfigured: true }));
      const res = await adminAPI.getAllShifts();
      const shifts = res?.data || res || [];
      if (Array.isArray(shifts)) {
        setShiftsList(shifts);
      }
      // Close the editor after successful save
      setIsShiftEditorOpen(false);
      setEditingShiftId(null);
    } catch (err) {
      console.error('Error creating shift', err);
      setError(
        buildErrorMessage(
          'Shifts',
          err,
          'Unable to save shift. Please check the values and try again.'
        )
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteShift = async (id) => {
    if (!window.confirm('Are you sure you want to delete this shift?')) return;
    try {
      setLoading(true);
      await adminAPI.deleteShift(id);
      const res = await adminAPI.getAllShifts();
      const shifts = res?.data || res || [];
      setShiftsList(Array.isArray(shifts) ? shifts : []);
      if (shifts.length === 0) setStatus(p => ({ ...p, shiftsConfigured: false }));
      setToast({ type: 'success', message: 'Shift deleted successfully.' });
    } catch (err) {
      setError(buildErrorMessage('Shifts', err, 'Unable to delete shift.'));
    } finally {
      setLoading(false);
    }
  };

  const handleSaveWeekends = async (e) => {
    e.preventDefault();
    setError('');

    try {
      setLoading(true);
      await adminAPI.updateWeekendConfig({
        id: weekendForm.id,
        monday: weekendForm.monday,
        tuesday: weekendForm.tuesday,
        wednesday: weekendForm.wednesday,
        thursday: weekendForm.thursday,
        friday: weekendForm.friday,
        saturday: weekendForm.saturday,
        sunday: weekendForm.sunday,
      });
      setStatus((prev) => ({ ...prev, weekendsConfigured: true }));
      setActiveStep(3);
    } catch (err) {
      console.error('Error updating weekend config', err);
      setError(
        buildErrorMessage(
          'Weekends',
          err,
          'Unable to save weekend settings. Please try again.'
        )
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDepartment = async (e) => {
    e.preventDefault();
    setError('');

    if (status.departmentsConfigured) {
      setActiveStep(7);
      return;
    }

    const trimmedName = departmentForm.name.trim();
    if (!trimmedName) {
      setError('Departments: Please enter a department name.');
      return;
    }
    if (trimmedName.length > 100) {
      setError('Departments: Name must be less than 100 characters.');
      return;
    }
    const isDuplicate = departmentsList.some(d => d.name.toLowerCase() === trimmedName.toLowerCase());
    if (isDuplicate) {
      setError(`Departments: A department with name "${trimmedName}" already exists.`);
      return;
    }

    try {
      setLoading(true);
      await adminAPI.createDepartment({
        name: trimmedName,
        description: departmentForm.description?.trim() || null,
        isActive: true,
      });
      setStatus((prev) => ({ ...prev, departmentsConfigured: true }));
      setActiveStep(7);
    } catch (err) {
      console.error('Error creating department', err);
      setError(
        buildErrorMessage('Departments', err, 'Unable to save department. Please try again.')
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePosition = async (e) => {
    e.preventDefault();
    setError('');

    if (status.positionsConfigured) {
      setActiveStep(4);
      return;
    }

    const trimmedTitle = positionForm.title.trim();
    if (!trimmedTitle) {
      setError('Positions: Please enter a position title.');
      return;
    }
    if (trimmedTitle.length > 100) {
      setError('Positions: Title must be less than 100 characters.');
      return;
    }
    const isDuplicate = positionsList.some(p => p.title.toLowerCase() === trimmedTitle.toLowerCase());
    if (isDuplicate) {
      setError(`Positions: A position with title "${trimmedTitle}" already exists.`);
      return;
    }

    let probationMonths = null;
    if (positionForm.hasProbation) {
      if (positionForm.probationPeriodMonths === 'custom') {
        probationMonths = parseInt(positionForm.customProbationMonths, 10) || null;
      } else {
        probationMonths = parseInt(positionForm.probationPeriodMonths, 10) || null;
      }
    }

    try {
      setLoading(true);
      await adminAPI.createPosition({
        title: trimmedTitle,
        description: positionForm.description?.trim() || null,
        isActive: true,
        probationPeriodMonths: probationMonths,
      });
      setStatus((prev) => ({ ...prev, positionsConfigured: true }));
      setActiveStep(4);
    } catch (err) {
      console.error('Error creating position', err);
      setError(buildErrorMessage('Positions', err, 'Unable to save position. Please try again.'));
    } finally {
      setLoading(false);
    }
  };


  const handleAddPositionOnly = async () => {
    setError('');
    const trimmedTitle = positionForm.title.trim();
    if (!trimmedTitle) {
      setError('Positions: Please enter a position title.');
      return;
    }
    const isDuplicate = positionsList.some(p => p.title.toLowerCase() === trimmedTitle.toLowerCase() && p.id !== editingPositionId);
    if (isDuplicate) {
      setError(`Positions: A position with title "${trimmedTitle}" already exists.`);
      return;
    }

    let probationMonths = null;
    if (positionForm.hasProbation) {
      if (positionForm.probationPeriodMonths === 'custom') {
        probationMonths = parseInt(positionForm.customProbationMonths, 10) || null;
      } else {
        probationMonths = parseInt(positionForm.probationPeriodMonths, 10) || null;
      }
    }

    try {
      setLoading(true);
      if (editingPositionId) {
        await adminAPI.updatePosition(editingPositionId, {
          title: trimmedTitle,
          description: positionForm.description,
          isActive: true,
          probationPeriodMonths: probationMonths,
        });
        setToast({ type: 'success', message: 'Position updated successfully.' });
      } else {
        await adminAPI.createPosition({
          title: trimmedTitle,
          description: positionForm.description,
          isActive: true,
          probationPeriodMonths: probationMonths,
        });
        setToast({ type: 'success', message: 'Position added successfully.' });
      }
      setStatus((prev) => ({ ...prev, positionsConfigured: true }));
      const res = await adminAPI.getAllPositions();
      setPositionsList(res?.data || []);
      setIsPositionEditorOpen(false);
      setEditingPositionId(null);
    } catch (err) {
      setError(buildErrorMessage('Positions', err, 'Unable to save position.'));
    } finally {
      setLoading(false);
    }
  };


  const handleDeletePosition = async (id) => {
    if (!window.confirm('Are you sure you want to delete this position?')) return;
    try {
      setLoading(true);
      await adminAPI.deletePosition(id);
      const res = await adminAPI.getAllPositions();
      setPositionsList(res?.data || []);
      if ((res?.data || []).length === 0) setStatus(p => ({ ...p, positionsConfigured: false }));
      setToast({ type: 'success', message: 'Position deleted successfully.' });
    } catch (err) {
      setError(buildErrorMessage('Positions', err, 'Unable to delete position.'));
    } finally {
      setLoading(false);
    }
  };


  const handleAddDepartmentOnly = async () => {
    setError('');

    const trimmedName = departmentForm.name.trim();
    if (!trimmedName) {
      setError('Departments: Please enter a department name.');
      return;
    }
    if (trimmedName.length > 100) {
      setError('Departments: Name must be less than 100 characters.');
      return;
    }
    const isDuplicate = departmentsList.some(d => d.name.toLowerCase() === trimmedName.toLowerCase() && d.id !== editingDepartmentId);
    if (isDuplicate) {
      setError(`Departments: A department with name "${trimmedName}" already exists.`);
      return;
    }

    try {
      setLoading(true);
      if (editingDepartmentId) {
        await adminAPI.updateDepartment(editingDepartmentId, {
          name: trimmedName,
          description: departmentForm.description?.trim() || null,
          isActive: true,
        });
        setToast({ type: 'success', message: 'Department updated successfully.' });
      } else {
        await adminAPI.createDepartment({
          name: trimmedName,
          description: departmentForm.description?.trim() || null,
          isActive: true,
        });
        setToast({ type: 'success', message: 'Department added successfully.' });
      }
      setStatus((prev) => ({ ...prev, departmentsConfigured: true }));
      const deptsRes = await adminAPI.getAllDepartments();
      const depts = deptsRes?.data || deptsRes || [];
      if (Array.isArray(depts)) {
        setDepartmentsList(depts);
      }
      setIsDepartmentEditorOpen(false);
      setEditingDepartmentId(null);
    } catch (err) {
      console.error('Error creating department', err);
      setError(
        buildErrorMessage('Departments', err, 'Unable to save department. Please try again.')
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDepartment = async (id) => {
    if (!window.confirm('Are you sure you want to delete this department?')) return;
    try {
      setLoading(true);
      await adminAPI.deleteDepartment(id);
      const res = await adminAPI.getAllDepartments();
      const depts = res?.data || res || [];
      setDepartmentsList(Array.isArray(depts) ? depts : []);
      if (depts.length === 0) setStatus(p => ({ ...p, departmentsConfigured: false }));
      setToast({ type: 'success', message: 'Department deleted successfully.' });
    } catch (err) {
      setError(buildErrorMessage('Departments', err, 'Unable to delete department.'));
    } finally {
      setLoading(false);
    }
  };

  const handleCreateLeaveType = async (e) => {
    e.preventDefault();
    setError('');

    if (status.leaveTypesConfigured) {
      setActiveStep(8);
      return;
    }

    const trimmedName = leaveTypeForm.leaveTypeName.trim();
    const trimmedCode = leaveTypeForm.leaveTypeCode.trim().toUpperCase();
    if (!trimmedName || !trimmedCode) {
      setError('Leave types: Please choose or enter a leave type name and code.');
      return;
    }
    const isNameDuplicate = leaveTypesList.some(lt => lt.leaveTypeName.toLowerCase() === trimmedName.toLowerCase());
    const isCodeDuplicate = leaveTypesList.some(lt => lt.leaveTypeCode.toUpperCase() === trimmedCode);
    if (isNameDuplicate) {
      setError(`Leave types: A leave type with name "${trimmedName}" already exists.`);
      return;
    }
    if (isCodeDuplicate) {
      setError(`Leave types: A leave type with code "${trimmedCode}" already exists.`);
      return;
    }

    if (
      !Number.isFinite(leaveTypeForm.defaultLeaveCount) ||
      leaveTypeForm.defaultLeaveCount < 0
    ) {
      setError('Leave types: Please enter a valid default days count (0 or more).');
      return;
    }

    try {
      setLoading(true);
      const payload = {
        leaveTypeName: trimmedName,
        leaveTypeCode: trimmedCode,
        description: 'Default leave type created during setup',
        defaultLeaveCount: leaveTypeForm.defaultLeaveCount,
        allowCarryforward: false,
        requiresApproval: true,
        colorCode: '#4F46E5',
        isActive: true,
      };
      await adminAPI.createLeaveType(payload, 'admin');
      setStatus((prev) => ({ ...prev, leaveTypesConfigured: true }));
      setActiveStep(8);
    } catch (err) {
      console.error('Error creating leave type', err);
      setError(
        buildErrorMessage('Leave types', err, 'Unable to save leave type. Please try again.')
      );
    } finally {
      setLoading(false);
    }
  };

  const handleAddLeaveTypeOnly = async () => {
    setError('');

    const trimmedName = leaveTypeForm.leaveTypeName.trim();
    const trimmedCode = leaveTypeForm.leaveTypeCode.trim().toUpperCase();
    if (!trimmedName || !trimmedCode) {
      setError('Leave types: Please choose or enter a leave type name and code.');
      return;
    }

    try {
      setLoading(true);
      const payload = {
        leaveTypeName: trimmedName,
        leaveTypeCode: trimmedCode,
        description: editingLeaveTypeId ? 'Leave type updated during setup' : 'Leave type created during setup',
        defaultLeaveCount: leaveTypeForm.defaultLeaveCount,
        allowCarryforward: false,
        requiresApproval: true,
        colorCode: '#4F46E5',
        isActive: true,
      };

      if (editingLeaveTypeId) {
        await adminAPI.updateLeaveType(editingLeaveTypeId, payload, 'admin');
        setToast({ type: 'success', message: 'Leave type updated successfully.' });
      } else {
        await adminAPI.createLeaveType(payload, 'admin');
        setToast({ type: 'success', message: 'Leave type added successfully.' });
      }

      setStatus((prev) => ({ ...prev, leaveTypesConfigured: true }));
      const ltRes = await adminAPI.getAllLeaveTypes();
      const leaveTypes = ltRes?.data || ltRes || [];
      if (Array.isArray(leaveTypes)) {
        setLeaveTypesList(leaveTypes);
      }
      setIsLeaveTypeEditorOpen(false);
      setEditingLeaveTypeId(null);
    } catch (err) {
      console.error('Error creating leave type', err);
      setError(
        buildErrorMessage('Leave types', err, 'Unable to save leave type. Please try again.')
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteLeaveType = async (id) => {
    if (!window.confirm('Are you sure you want to delete this leave type?')) return;
    try {
      setLoading(true);
      await adminAPI.deleteLeaveType(id);
      const res = await adminAPI.getAllLeaveTypes();
      const lts = res?.data || res || [];
      setLeaveTypesList(Array.isArray(lts) ? lts : []);
      if (lts.length === 0) setStatus(p => ({ ...p, leaveTypesConfigured: false }));
      setToast({ type: 'success', message: 'Leave type deleted successfully.' });
    } catch (err) {
      setError(buildErrorMessage('Leave types', err, 'Unable to delete leave type.'));
    } finally {
      setLoading(false);
    }
  };

  const handleSaveEmpId = async (e) => {
    e.preventDefault();
    setError('');

    if (status.empIdConfigured) {
      setActiveStep(6);
      setHasReachedReview(true);
      return;
    }

    const trimmedPrefix = empIdForm.prefix.trim().toUpperCase();
    if (!trimmedPrefix) {
      setError('Employee ID: Please enter an Employee ID prefix.');
      return;
    }
    if (!prefixAvailable) {
      setError('Employee ID: Please use a unique ID prefix.');
      return;
    }
    if (trimmedPrefix.length < 2 || trimmedPrefix.length > 10) {
      setError('Employee ID: Prefix must be between 2 and 10 characters.');
      return;
    }
    if (!/^[A-Z0-9\-_/]+$/.test(trimmedPrefix)) {
      setError('Employee ID: Prefix must be alphanumeric (hyphens, underscores, and slashes are allowed).');
      return;
    }
    if (empIdForm.nextNumber < 0) {
      setError('Employee ID: Next number must be 0 or greater.');
      return;
    }

    try {
      setLoading(true);
      const padding = parseInt(empIdForm.padding || '3', 10);
      const payload = {
        prefix: empIdForm.prefix.trim().toUpperCase(),
        nextNumber: parseInt(empIdForm.nextNumber, 10) || 0,
        numberFormat: `%0${padding}d`,
        locationBased: !!empIdForm.locationBased,
      };
      await adminAPI.updateEmployeeIdFormat(payload);
      setStatus((prev) => ({ ...prev, empIdConfigured: true }));
      setActiveStep(6);
      setHasReachedReview(true);
    } catch (err) {
      console.error('Error saving employee ID format', err);
      setError(
        buildErrorMessage(
          'Employee ID',
          err,
          'Unable to save Employee ID format. Please try again.'
        )
      );
    } finally {
      setLoading(false);
    }
  };

  const getLocationsAPI = async () => {
    const apiModule = await import('../services/api');
    return apiModule.locationsAPI;
  };

  const handleCreateLocation = async (e) => {
    e.preventDefault();
    setError('');

    if (locationsConfigured) {
      setActiveStep(9);
      return;
    }

    const trimmedName = locationForm.locationName.trim();
    const trimmedCode = locationForm.locationCode.trim().toUpperCase();
    if (!trimmedName || !trimmedCode) {
      setError('Locations: Please enter a location name and code.');
      return;
    }

    try {
      setLoading(true);
      const locAPI = await getLocationsAPI();
      await locAPI.create({
        locationName: trimmedName,
        locationCode: trimmedCode,
        address: locationForm.address.trim(),
        contactPerson: locationForm.contactPerson.trim(),
        timezone: locationForm.timezone,
      });
      setLocationsConfigured(true);
      const res = await locAPI.list();
      const locs = res?.data?.items || res?.data || res || [];
      const normalized = Array.isArray(locs.items) ? locs.items : (Array.isArray(locs) ? locs : (Array.isArray(locs.content) ? locs.content : []));
      setLocationsList(normalized);
      setActiveStep(9);
    } catch (err) {
      console.error('Error creating location', err);
      setError(buildErrorMessage('Locations', err, 'Unable to save location. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const handleAddLocationOnly = async () => {
    setError('');
    const trimmedName = locationForm.locationName.trim();
    const trimmedCode = locationForm.locationCode.trim().toUpperCase();
    if (!trimmedName || !trimmedCode) {
      setError('Locations: Please enter a location name and code.');
      return;
    }

    try {
      setLoading(true);
      const locAPI = await getLocationsAPI();
      if (editingLocationId) {
        await locAPI.update(editingLocationId, {
          locationName: trimmedName,
          locationCode: trimmedCode,
          address: locationForm.address.trim(),
          contactPerson: locationForm.contactPerson.trim(),
          timezone: locationForm.timezone,
        });
        setToast({ type: 'success', message: 'Location updated successfully.' });
      } else {
        await locAPI.create({
          locationName: trimmedName,
          locationCode: trimmedCode,
          address: locationForm.address.trim(),
          contactPerson: locationForm.contactPerson.trim(),
          timezone: locationForm.timezone,
        });
        setToast({ type: 'success', message: 'Location added successfully.' });
      }
      setLocationsConfigured(true);
      const res = await locAPI.list();
      const locs = res?.data?.items || res?.data || res || [];
      const normalized = Array.isArray(locs.items) ? locs.items : (Array.isArray(locs) ? locs : (Array.isArray(locs.content) ? locs.content : []));
      setLocationsList(normalized);
      setIsLocationEditorOpen(false);
      setEditingLocationId(null);
    } catch (err) {
      console.error('Error saving location', err);
      setError(buildErrorMessage('Locations', err, 'Unable to save location. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteLocationLocal = async (id) => {
    if (!window.confirm('Are you sure you want to delete this location?')) return;
    try {
      setLoading(true);
      const locAPI = await getLocationsAPI();
      await locAPI.remove(id);
      const res = await locAPI.list();
      const locs = res?.data?.items || res?.data || res || [];
      const normalized = Array.isArray(locs.items) ? locs.items : (Array.isArray(locs) ? locs : (Array.isArray(locs.content) ? locs.content : []));
      setLocationsList(normalized);
      if (normalized.length === 0) setLocationsConfigured(false);
      setToast({ type: 'success', message: 'Location deleted successfully.' });
    } catch (err) {
      console.error('Error deleting location', err);
      setError(buildErrorMessage('Locations', err, 'Unable to delete location.'));
    } finally {
      setLoading(false);
    }
  };

  const handleSaveWfhPolicyLocal = async (e) => {
    e.preventDefault();
    setError('');

    try {
      setLoading(true);
      const policyPayload = {
        maxDaysPerWeek: wfhPolicy?.maxDaysPerWeek ?? null,
        maxDaysPerMonth: wfhPolicy?.maxDaysPerMonth ?? null,
        allowWeekends: !!wfhPolicy?.allowWeekends,
        allowHolidays: !!wfhPolicy?.allowHolidays,
        allowPastDates: !!wfhPolicy?.allowPastDates,
      };
      await adminAPI.updateWfhPolicyConfig(policyPayload);
      setWfhConfigured(true);
      setWfhPolicy(policyPayload);
      setActiveStep(10);
    } catch (err) {
      console.error('Error saving WFH policy', err);
      setError(buildErrorMessage('WFH Policy', err, 'Unable to save WFH Policy. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const handleSaveNoticePeriodLocal = async (e) => {
    e.preventDefault();
    setError('');

    const days = noticeConfig?.defaultNoticePeriodDays ?? noticeConfig?.noticePeriodDays ?? 30;

    try {
      setLoading(true);
      await adminAPI.setDefaultNoticePeriod(days);
      setNoticeConfigured(true);
      setNoticeConfig({
        defaultNoticePeriodDays: days,
        noticePeriodDays: days
      });
      setActiveStep(5);
    } catch (err) {
      console.error('Error saving Notice Period', err);
      setError(buildErrorMessage('Notice Period', err, 'Unable to save Notice Period. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const isStepDone = (stepId) => {
    if (stepId === 1) return status.shiftsConfigured || status.shiftsSkipped;
    if (stepId === 2) return status.weekendsConfigured || status.weekendsSkipped;
    if (stepId === 3) return status.departmentsConfigured || status.departmentsSkipped;
    if (stepId === 7) return status.positionsConfigured || status.positionsSkipped;
    if (stepId === 4) return status.leaveTypesConfigured || status.leaveTypesSkipped;
    if (stepId === 5) return status.empIdConfigured || status.empIdSkipped;
    if (stepId === 8) return locationsConfigured || locationsSkipped;
    if (stepId === 9) return wfhConfigured || wfhSkipped;
    if (stepId === 10) return noticeConfigured || noticeSkipped;
    if (stepId === 6) return false;
    return false;
  };

  const isStepConfigured = (stepId) => {
    if (stepId === 0) {
      // Consider company details configured when any key field is filled
      return !!(companyDetails.name || companyDetails.companyPan || companyDetails.gstNumber);
    }
    if (stepId === 1) return status.shiftsConfigured;
    if (stepId === 2) return status.weekendsConfigured;
    if (stepId === 3) return status.departmentsConfigured;
    if (stepId === 7) return status.positionsConfigured;
    if (stepId === 4) return status.leaveTypesConfigured;
    if (stepId === 5) return status.empIdConfigured;
    if (stepId === 8) return locationsConfigured;
    if (stepId === 9) return wfhConfigured;
    if (stepId === 10) return noticeConfigured;
    // Review step is not directly "configured"
    return false;
  };

  const selectedStepConfig = STEP_CONFIG.find((s) => s.id === activeStep) || STEP_CONFIG[0];

  const progressIndex = PROGRESS_STEPS.indexOf(activeStep);
  const progressPercent =
    progressIndex === -1 ? 0 : ((progressIndex + 1) / PROGRESS_STEPS.length) * 100;

  const renderStepContent = () => {
    // Company details step – edit basic company info here instead of in the header
    if (activeStep === 0) {
      return (
        <form onSubmit={handleSaveCompanyDetails} style={{ marginTop: 4 }}>
          <h2
            style={{
              fontSize: 18,
              fontWeight: 600,
              margin: 0,
              marginBottom: 8,
              color: '#0f172a',
            }}
          >
            Company details
          </h2>
          <p style={{ margin: 0, marginBottom: 12, fontSize: 13, color: '#6b7280' }}>
            These details are shared across the system and used in emails, reports and statutory records.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 4 }}>
                Company name
              </label>
              <input
                type="text"
                value={companyDetails.name}
                onChange={(e) => setCompanyDetails((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Your company name"
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: 8,
                  border: '1px solid #e5e7eb',
                  fontSize: 13,
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 4 }}>
                Company PAN
              </label>
              <input
                type="text"
                value={companyDetails.companyPan}
                onChange={(e) =>
                  setCompanyDetails((prev) => ({ ...prev, companyPan: e.target.value.toUpperCase() }))
                }
                placeholder="PAN"
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: 8,
                  border: '1px solid #e5e7eb',
                  fontSize: 13,
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 4 }}>
                GST number
              </label>
              <input
                type="text"
                value={companyDetails.gstNumber}
                onChange={(e) =>
                  setCompanyDetails((prev) => ({ ...prev, gstNumber: e.target.value.toUpperCase() }))
                }
                placeholder="GST"
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: 8,
                  border: '1px solid #e5e7eb',
                  fontSize: 13,
                }}
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={savingCompany}
            style={{
              marginTop: 4,
              padding: '9px 16px',
              borderRadius: 999,
              border: 'none',
              background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
              color: '#ffffff',
              fontSize: 14,
              fontWeight: 600,
              cursor: savingCompany ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}
          >
            {savingCompany && <Clock size={16} className="animate-spin" />}
            {savingCompany ? 'Saving…' : 'Save company details'}
          </button>
        </form>
      );
    }
    if (activeStep === 6) {
      const weekendDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
        .filter((d) => weekendForm[d])
        .map((d) => d.charAt(0).toUpperCase() + d.slice(1));

      return (
        <form onSubmit={handleCompleteSetup} style={{ marginTop: 4 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0, marginBottom: 8, color: '#0f172a' }}>
            Review & Complete setup
          </h2>
          <p style={{ margin: 0, marginBottom: 16, fontSize: 13, color: '#6b7280' }}>
            Review the details you have configured in each step. You can change these later from
            System Settings.
          </p>

          {/* Company details */}
          <div
            style={{
              marginBottom: 12,
              padding: '10px 12px',
              borderRadius: 8,
              border: '1px solid #e5e7eb',
              backgroundColor: '#f9fafb',
            }}
          >
            <h3 style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 600, color: '#111827' }}>
              Company details
            </h3>
            <div style={{ fontSize: 12, color: '#374151', display: 'grid', rowGap: 2 }}>
              <span>
                <strong>Name:</strong> {companyDetails.name || '—'}
              </span>
              <span>
                <strong>PAN:</strong> {companyDetails.companyPan || '—'}
              </span>
              <span>
                <strong>GST:</strong> {companyDetails.gstNumber || '—'}
              </span>
            </div>
          </div>

          {/* Shifts */}
          <div
            style={{
              marginBottom: 12,
              padding: '10px 12px',
              borderRadius: 8,
              border: '1px solid #e5e7eb',
              backgroundColor: '#f9fafb',
            }}
          >
            <h3 style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 600, color: '#111827' }}>
              Shifts
            </h3>
            {status.shiftsSkipped ? (
              <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>This step was skipped.</p>
            ) : shiftsList.length === 0 ? (
              <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>No shifts configured.</p>
            ) : (
              <div
                style={{
                  borderRadius: 6,
                  border: '1px solid #e5e7eb',
                  overflow: 'hidden',
                  backgroundColor: '#ffffff',
                  fontSize: 12,
                }}
              >
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '2fr 2fr 1fr',
                    padding: '6px 10px',
                    backgroundColor: '#f3f4f6',
                    fontSize: 11,
                    fontWeight: 600,
                    color: '#6b7280',
                  }}
                >
                  <span>Name</span>
                  <span>Time</span>
                  <span style={{ textAlign: 'right' }}>Type</span>
                </div>
                <div>
                  {shiftsList.map((s) => (
                    <div
                      key={s.id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '2fr 2fr 1fr',
                        padding: '6px 10px',
                        borderTop: '1px solid #f3f4f6',
                        alignItems: 'center',
                      }}
                    >
                      <span style={{ fontWeight: 500 }}>{s.shiftName}</span>
                      <span style={{ color: '#4b5563' }}>
                        {s.startTime} – {s.endTime}
                      </span>
                      <span style={{ textAlign: 'right' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '2px 8px',
                            borderRadius: 999,
                            backgroundColor: '#e0ecff',
                            color: '#1d4ed8',
                            fontSize: 11,
                            fontWeight: 600,
                          }}
                        >
                          {s.shiftType}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Weekends */}
          <div
            style={{
              marginBottom: 12,
              padding: '10px 12px',
              borderRadius: 8,
              border: '1px solid #e5e7eb',
              backgroundColor: '#f9fafb',
            }}
          >
            <h3 style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 600, color: '#111827' }}>
              Weekends
            </h3>
            {status.weekendsSkipped ? (
              <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>This step was skipped.</p>
            ) : weekendDays.length === 0 ? (
              <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>No weekends configured.</p>
            ) : (
              <p style={{ margin: 0, fontSize: 12, color: '#374151' }}>
                These days are treated as weekends:{' '}
                <strong>{weekendDays.join(', ')}</strong>
              </p>
            )}
          </div>

          {/* Departments */}
          <div
            style={{
              marginBottom: 12,
              padding: '10px 12px',
              borderRadius: 8,
              border: '1px solid #e5e7eb',
              backgroundColor: '#f9fafb',
            }}
          >
            <h3 style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 600, color: '#111827' }}>
              Departments
            </h3>
            {status.departmentsSkipped ? (
              <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>This step was skipped.</p>
            ) : departmentsList.length === 0 ? (
              <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>No departments configured.</p>
            ) : (
              <div
                style={{
                  borderRadius: 6,
                  border: '1px solid #e5e7eb',
                  overflow: 'hidden',
                  backgroundColor: '#ffffff',
                  fontSize: 12,
                }}
              >
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '2fr 3fr',
                    padding: '6px 10px',
                    backgroundColor: '#f3f4f6',
                    fontSize: 11,
                    fontWeight: 600,
                    color: '#6b7280',
                  }}
                >
                  <span>Name</span>
                  <span>Description</span>
                </div>
                <div>
                  {departmentsList.map((d) => (
                    <div
                      key={d.id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '2fr 3fr',
                        padding: '6px 10px',
                        borderTop: '1px solid #f3f4f6',
                        alignItems: 'center',
                      }}
                    >
                      <span style={{ fontWeight: 500 }}>{d.name}</span>
                      <span style={{ color: '#4b5563' }}>{d.description || '—'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          {/* Positions */}
          <div
            style={{
              marginBottom: 12,
              padding: '10px 12px',
              borderRadius: 8,
              border: '1px solid #e5e7eb',
              backgroundColor: '#f9fafb',
            }}
          >
            <h3 style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 600, color: '#111827' }}>
              Positions
            </h3>
            {status.positionsSkipped ? (
              <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>This step was skipped.</p>
            ) : positionsList.length === 0 ? (
              <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>No positions configured.</p>
            ) : (
              <div
                style={{
                  borderRadius: 6,
                  border: '1px solid #e5e7eb',
                  overflow: 'hidden',
                  backgroundColor: '#ffffff',
                  fontSize: 12,
                }}
              >
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '2fr 3fr',
                    padding: '6px 10px',
                    backgroundColor: '#f3f4f6',
                    fontSize: 11,
                    fontWeight: 600,
                    color: '#6b7280',
                  }}
                >
                  <span>Title</span>
                  <span>Description</span>
                </div>
                <div>
                  {positionsList.map((p) => (
                    <div
                      key={p.id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '2fr 3fr',
                        padding: '6px 10px',
                        borderTop: '1px solid #f3f4f6',
                        alignItems: 'center',
                      }}
                    >
                      <span style={{ fontWeight: 500 }}>{p.title}</span>
                      <span style={{ color: '#4b5563' }}>{p.description || '—'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Leave types */}
          <div
            style={{
              marginBottom: 12,
              padding: '10px 12px',
              borderRadius: 8,
              border: '1px solid #e5e7eb',
              backgroundColor: '#f9fafb',
            }}
          >
            <h3 style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 600, color: '#111827' }}>
              Leave types
            </h3>
            {status.leaveTypesSkipped ? (
              <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>This step was skipped.</p>
            ) : leaveTypesList.length === 0 ? (
              <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>No leave types configured.</p>
            ) : (
              <div
                style={{
                  borderRadius: 6,
                  border: '1px solid #e5e7eb',
                  overflow: 'hidden',
                  backgroundColor: '#ffffff',
                  fontSize: 12,
                }}
              >
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '2fr 1fr 1fr',
                    padding: '6px 10px',
                    backgroundColor: '#f3f4f6',
                    fontSize: 11,
                    fontWeight: 600,
                    color: '#6b7280',
                  }}
                >
                  <span>Name</span>
                  <span>Code</span>
                  <span style={{ textAlign: 'right' }}>Default days</span>
                </div>
                <div>
                  {leaveTypesList.map((lt) => (
                    <div
                      key={lt.id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '2fr 1fr 1fr',
                        padding: '6px 10px',
                        borderTop: '1px solid #f3f4f6',
                        alignItems: 'center',
                      }}
                    >
                      <span style={{ fontWeight: 500 }}>{lt.leaveTypeName}</span>
                      <span style={{ color: '#4b5563' }}>{lt.leaveTypeCode}</span>
                      <span style={{ textAlign: 'right', color: '#4b5563' }}>
                        {lt.defaultLeaveCount}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Locations */}
          <div
            style={{
              marginBottom: 12,
              padding: '10px 12px',
              borderRadius: 8,
              border: '1px solid #e5e7eb',
              backgroundColor: '#f9fafb',
            }}
          >
            <h3 style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 600, color: '#111827' }}>
              Locations
            </h3>
            {locationsSkipped ? (
              <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>This step was skipped.</p>
            ) : locationsList.length === 0 ? (
              <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>No locations configured.</p>
            ) : (
              <div style={{ fontSize: 12, color: '#374151', display: 'grid', rowGap: 2 }}>
                {locationsList.slice(0, 8).map((l, idx) => (
                  <div key={l.id || idx} style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 500 }}>{l.name || l.locationName || l.title || 'Location'}</span>
                    <span style={{ color: '#4b5563' }}>{l.address || l.city || ''}</span>
                  </div>
                ))}
                {locationsList.length > 8 && (
                  <div style={{ fontSize: 12, color: '#6b7280' }}>and {locationsList.length - 8} more…</div>
                )}
              </div>
            )}
          </div>

          {/* WFH Policy */}
          <div
            style={{
              marginBottom: 12,
              padding: '10px 12px',
              borderRadius: 8,
              border: '1px solid #e5e7eb',
              backgroundColor: '#f9fafb',
            }}
          >
            <h3 style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 600, color: '#111827' }}>
              WFH Policy
            </h3>
            {wfhSkipped ? (
              <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>This step was skipped.</p>
            ) : !wfhPolicy ? (
              <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>No WFH policy configured.</p>
            ) : (
              <div style={{ fontSize: 12, color: '#374151', display: 'grid', rowGap: 2 }}>
                <span>
                  <strong>Max Days Per Week:</strong> {wfhPolicy.maxDaysPerWeek !== null ? wfhPolicy.maxDaysPerWeek : 'Unlimited'}
                </span>
                <span>
                  <strong>Max Days Per Month:</strong> {wfhPolicy.maxDaysPerMonth !== null ? wfhPolicy.maxDaysPerMonth : 'Unlimited'}
                </span>
              </div>
            )}
          </div>

          {/* Notice Period */}
          <div
            style={{
              marginBottom: 12,
              padding: '10px 12px',
              borderRadius: 8,
              border: '1px solid #e5e7eb',
              backgroundColor: '#f9fafb',
            }}
          >
            <h3 style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 600, color: '#111827' }}>
              Notice Period
            </h3>
            {noticeSkipped ? (
              <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>This step was skipped.</p>
            ) : !noticeConfig ? (
              <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>No notice period configured.</p>
            ) : (
              <div style={{ fontSize: 12, color: '#374151', display: 'grid', rowGap: 2 }}>
                <span>
                  <strong>Default days:</strong> {noticeConfig.defaultNoticePeriodDays ?? noticeConfig.noticePeriodDays ?? '—'}
                </span>
              </div>
            )}
          </div>

          {/* Employee ID */}
          <div
            style={{
              marginBottom: 16,
              padding: '10px 12px',
              borderRadius: 8,
              border: '1px solid #e5e7eb',
              backgroundColor: '#f9fafb',
            }}
          >
            <h3 style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 600, color: '#111827' }}>
              Employee ID format
            </h3>
            {status.empIdSkipped ? (
              <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>This step was skipped.</p>
            ) : (
              <div style={{ fontSize: 12, color: '#374151', display: 'grid', rowGap: 2 }}>
                <span>
                  <strong>Prefix:</strong> {empIdForm.prefix || '—'}
                </span>
                <span>
                  <strong>Next number:</strong> {empIdForm.nextNumber || '—'}
                </span>
                <span>
                  <strong>Location based:</strong> {empIdForm.locationBased ? 'Yes' : 'No'}
                </span>
                <span>
                  <strong>Example ID:</strong> {empIdForm.nextEmployeeIdExample || '—'}
                </span>
              </div>
            )}
          </div>

          {/* Terms & complete */}
          <div style={{ marginBottom: 16 }}>
            <label
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                cursor: 'pointer',
                fontSize: 13,
                color: '#374151',
              }}
            >
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                disabled={completing}
                style={{ cursor: 'pointer', accentColor: '#2563eb', colorScheme: 'light' }}
              />
              <span>
                I agree to the Terms and Conditions of using this platform. I understand that I can update these settings later from System Settings.
              </span>
            </label>
          </div>
          {
            !allRequiredStepsDone && (
              <p style={{ marginBottom: 12, fontSize: 13, color: '#b45309' }}>
                Complete or skip all {PROGRESS_STEPS.length - 1} steps above before you can finish setup.
              </p>
            )
          }
          <button
            type="submit"
            disabled={completing || !termsAccepted || !allRequiredStepsDone}
            style={{
              marginTop: 4,
              padding: '9px 20px',
              borderRadius: 999,
              border: 'none',
              background:
                termsAccepted && allRequiredStepsDone
                  ? 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)'
                  : '#9ca3af',
              color: '#ffffff',
              fontSize: 14,
              fontWeight: 600,
              cursor: completing || !termsAccepted || !allRequiredStepsDone ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}
          >
            {completing && <Clock size={16} className="animate-spin" />}
            {completing ? 'Completing…' : 'Complete setup'}
          </button>
        </form >
      );
    }

    if (activeStep === 1) {
      return (
        <form id="admin-setup-step-1" onSubmit={handleCreateShift} style={{ marginTop: 4 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 12,
              gap: 12,
            }}
          >
            <div>
              <h2
                style={{
                  fontSize: 18,
                  fontWeight: 600,
                  margin: 0,
                  marginBottom: 4,
                  color: '#0f172a',
                }}
              >
                Step 1 · Configure shifts
              </h2>
              <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>
                Define your standard working hours. You can add multiple shifts for your organization.
              </p>
            </div>
            <div
              style={{
                display: 'flex',
                gap: 8,
                flexShrink: 0,
                flexWrap: 'wrap',
                justifyContent: 'flex-end',
              }}
            >
              <button
                type="button"
                disabled={loading}
                onClick={() => {
                  setIsShiftEditorOpen(true);
                  setEditingShiftId(null);
                  setShiftForm({
                    shiftName: 'General Shift',
                    shiftType: 'REGULAR',
                    startTime: '09:00',
                    endTime: '18:00',
                    description: '',
                  });
                }}
                style={{
                  padding: '7px 14px',
                  borderRadius: 999,
                  border: '1px solid #2563eb',
                  background: '#ffffff',
                  color: '#2563eb',
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                {loading && activeStep === 1 && !isShiftEditorOpen ? <Clock size={14} className="animate-spin" /> : '+ Add shift'}
              </button>
            </div>
          </div>

          {isShiftEditorOpen && (
            <div
              style={{
                marginBottom: 12,
                padding: '10px 12px',
                borderRadius: 8,
                border: '1px solid #e5e7eb',
                backgroundColor: '#f9fafb',
              }}
            >
              <div style={{ marginBottom: 10 }}>
                <label
                  htmlFor="shiftName"
                  style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 4 }}
                >
                  Shift name
                </label>
                <input
                  id="shiftName"
                  type="text"
                  value={shiftForm.shiftName}
                  onChange={(e) =>
                    setShiftForm((prev) => ({ ...prev, shiftName: e.target.value }))
                  }
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: 8,
                    border: '1px solid #e5e7eb',
                    fontSize: 13,
                    backgroundColor: '#ffffff',
                    color: '#374151',
                  }}
                  disabled={loading}
                />
              </div>
              <div style={{ display: 'flex', gap: 12, marginBottom: 10 }}>
                <div style={{ flex: 1 }}>
                  <label
                    htmlFor="startTime"
                    style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 4 }}
                  >
                    Start time
                  </label>
                  <input
                    id="startTime"
                    type="time"
                    value={shiftForm.startTime}
                    onChange={(e) =>
                      setShiftForm((prev) => ({ ...prev, startTime: e.target.value }))
                    }
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: 8,
                      border: '1px solid #e5e7eb',
                      fontSize: 13,
                      backgroundColor: '#ffffff',
                      color: '#374151',
                    }}
                    disabled={loading}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label
                    htmlFor="endTime"
                    style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 4 }}
                  >
                    End time
                  </label>
                  <input
                    id="endTime"
                    type="time"
                    value={shiftForm.endTime}
                    onChange={(e) =>
                      setShiftForm((prev) => ({ ...prev, endTime: e.target.value }))
                    }
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: 8,
                      border: '1px solid #e5e7eb',
                      fontSize: 13,
                      backgroundColor: '#ffffff',
                      color: '#374151',
                    }}
                    disabled={loading}
                  />
                </div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <label
                  style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 4 }}
                >
                  Shift type
                </label>
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 8,
                  }}
                >
                  {['REGULAR', 'MORNING', 'EVENING', 'NIGHT'].map((type) => {
                    const labels = {
                      REGULAR: 'Regular',
                      MORNING: 'Morning',
                      EVENING: 'Evening',
                      NIGHT: 'Night',
                    };
                    const selected = shiftForm.shiftType === type;
                    return (
                      <button
                        key={type}
                        type="button"
                        disabled={loading}
                        onClick={() =>
                          setShiftForm((prev) => ({
                            ...prev,
                            shiftType: type,
                          }))
                        }
                        style={{
                          padding: '6px 10px',
                          borderRadius: 999,
                          border: selected ? 'none' : '1px solid #e5e7eb',
                          backgroundColor: selected ? '#2563eb' : '#ffffff',
                          color: selected ? '#ffffff' : '#4b5563',
                          fontSize: 12,
                          cursor: loading ? 'not-allowed' : 'pointer',
                        }}
                      >
                        {labels[type]}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => setIsShiftEditorOpen(false)}
                  style={{
                    padding: '7px 14px',
                    borderRadius: 999,
                    border: '1px solid #d1d5db',
                    background: '#ffffff',
                    color: '#6b7280',
                    fontSize: 13,
                    cursor: loading ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                >
                  {loading && isShiftEditorOpen && <Clock size={14} className="animate-spin" />}
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleAddShiftOnly}
                  style={{
                    padding: '7px 14px',
                    borderRadius: 999,
                    border: 'none',
                    background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                    color: '#ffffff',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: loading ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                >
                  {loading && isShiftEditorOpen ? <Clock size={14} className="animate-spin" /> : (editingShiftId ? 'Update shift' : 'Save shift')}
                </button>
              </div>
            </div>
          )}
          {shiftsList.length === 0 && isShiftEditorOpen ? null : (
            <div
              style={{
                marginTop: 12,
                padding: '8px 10px',
                borderRadius: 8,
                border: '1px solid #e5e7eb',
                backgroundColor: '#f9fafb',
              }}
            >
              {shiftsList.length === 0 ? (
                <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>
                  No shifts available yet. Use "Add shift" to create one.
                </p>
              ) : (
                <>
                  <p
                    style={{
                      margin: '0 0 6px',
                      fontSize: 12,
                      color: '#6b7280',
                    }}
                  >
                    Configured shifts:
                  </p>
                  <div
                    style={{
                      borderRadius: 6,
                      border: '1px solid #e5e7eb',
                      overflow: 'hidden',
                      backgroundColor: '#ffffff',
                    }}
                  >
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1.5fr 1.5fr 1fr 100px',
                        padding: '6px 10px',
                        backgroundColor: '#f3f4f6',
                        fontSize: 11,
                        fontWeight: 600,
                        color: '#6b7280',
                      }}
                    >
                      <span>Name</span>
                      <span>Time</span>
                      <span>Type</span>
                      <span style={{ textAlign: 'center' }}>Actions</span>
                    </div>
                    <div>
                      {shiftsList.map((s) => (
                        <div
                          key={s.id}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '1.5fr 1.5fr 1fr 100px',
                            padding: '6px 10px',
                            fontSize: 12,
                            color: '#374151',
                            borderTop: '1px solid #f3f4f6',
                            alignItems: 'center',
                          }}
                        >
                          <span style={{ fontWeight: 500 }}>{s.shiftName}</span>
                          <span style={{ color: '#4b5563' }}>
                            {s.startTime} – {s.endTime}
                          </span>
                          <span>
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '2px 8px',
                                borderRadius: 999,
                                backgroundColor: '#e0ecff',
                                color: '#1d4ed8',
                                fontSize: 11,
                                fontWeight: 600,
                              }}
                            >
                              {s.shiftType}
                            </span>
                          </span>
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingShiftId(s.id);
                                setShiftForm({
                                  shiftName: s.shiftName,
                                  shiftType: s.shiftType,
                                  startTime: s.startTime,
                                  endTime: s.endTime,
                                  description: s.description || '',
                                });
                                setIsShiftEditorOpen(true);
                              }}
                              style={{
                                padding: '4px',
                                borderRadius: 4,
                                border: '1px solid #e5e7eb',
                                background: 'white',
                                color: '#2563eb',
                                cursor: 'pointer',
                              }}
                            >
                              <Pencil size={12} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteShift(s.id)}
                              style={{
                                padding: '4px',
                                borderRadius: 4,
                                border: '1px solid #fee2e2',
                                background: 'white',
                                color: '#ef4444',
                                cursor: 'pointer',
                              }}
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </form>
      );
    }

    if (activeStep === 2) {
      const toggleDay = (day) => {
        setWeekendForm((prev) => ({ ...prev, [day]: !prev[day] }));
      };

      return (
        <form id="admin-setup-step-2" onSubmit={handleSaveWeekends}>
          <h2
            style={{
              fontSize: 18,
              fontWeight: 600,
              margin: 0,
              marginBottom: 8,
              color: '#0f172a',
            }}
          >
            Step 2 · Set weekends
          </h2>
          <p style={{ margin: 0, marginBottom: 12, fontSize: 13, color: '#6b7280' }}>
            Choose which days are considered weekends for your organization. These days will be
            excluded from regular working calculations.
          </p>
          {/* Weekends are single configuration here; full management is available later in settings */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
              gap: 8,
              marginBottom: 12,
              maxWidth: 360,
            }}
          >
            {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map(
              (day) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleDay(day)}
                  disabled={loading}
                  style={{
                    padding: '6px 8px',
                    borderRadius: 999,
                    border: weekendForm[day] ? 'none' : '1px solid #e5e7eb',
                    backgroundColor: weekendForm[day] ? '#2563eb' : '#ffffff',
                    color: weekendForm[day] ? '#ffffff' : '#4b5563',
                    fontSize: 12,
                    textTransform: 'capitalize',
                    cursor: loading ? 'not-allowed' : 'pointer',
                  }}
                >
                  {day.slice(0, 3)}
                </button>
              )
            )}
          </div>
          {/* Buttons moved to shared footer */}
        </form>
      );
    }

    if (activeStep === 3) {
      return (
        <form id="admin-setup-step-3" onSubmit={handleCreateDepartment}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 12,
              gap: 12,
            }}
          >
            <div>
              <h2
                style={{
                  fontSize: 18,
                  fontWeight: 600,
                  margin: 0,
                  marginBottom: 4,
                  color: '#0f172a',
                }}
              >
                Step 3 · Add your first department
              </h2>
              <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>
                Create at least one department so employees can be grouped and reported correctly.
              </p>
            </div>
            <div
              style={{
                display: 'flex',
                gap: 8,
                flexShrink: 0,
                flexWrap: 'wrap',
                justifyContent: 'flex-end',
              }}
            >
              <button
                type="button"
                disabled={loading}
                onClick={() => {
                  setIsDepartmentEditorOpen(true);
                  setEditingDepartmentId(null);
                  setDepartmentForm({
                    name: '',
                    description: '',
                  });
                }}
                style={{
                  padding: '7px 14px',
                  borderRadius: 999,
                  border: '1px solid #2563eb',
                  background: '#ffffff',
                  color: '#2563eb',
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                {loading && activeStep === 3 && isDepartmentEditorOpen === false ? <Clock size={14} className="animate-spin" /> : '+ Add department'}
              </button>
            </div>
          </div>

          {isDepartmentEditorOpen && (
            <div
              style={{
                marginBottom: 12,
                padding: '10px 12px',
                borderRadius: 8,
                border: '1px solid #e5e7eb',
                backgroundColor: '#f9fafb',
              }}
            >
              <div style={{ marginBottom: 10 }}>
                <label
                  htmlFor="deptName"
                  style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 4 }}
                >
                  Department name
                </label>
                <input
                  id="deptName"
                  type="text"
                  value={departmentForm.name}
                  onChange={(e) =>
                    setDepartmentForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: 8,
                    border: '1px solid #e5e7eb',
                    fontSize: 13,
                  }}
                  disabled={loading}
                />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label
                  htmlFor="deptDesc"
                  style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 4 }}
                >
                  Description (optional)
                </label>
                <textarea
                  id="deptDesc"
                  rows={3}
                  value={departmentForm.description}
                  onChange={(e) =>
                    setDepartmentForm((prev) => ({ ...prev, description: e.target.value }))
                  }
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: 8,
                    border: '1px solid #e5e7eb',
                    fontSize: 13,
                    resize: 'vertical',
                  }}
                  disabled={loading}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => setIsDepartmentEditorOpen(false)}
                  style={{
                    padding: '7px 14px',
                    borderRadius: 999,
                    border: '1px solid #d1d5db',
                    background: '#ffffff',
                    color: '#6b7280',
                    fontSize: 13,
                    cursor: loading ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                >
                  {loading && isDepartmentEditorOpen && <Clock size={14} className="animate-spin" />}
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleAddDepartmentOnly}
                  style={{
                    padding: '7px 14px',
                    borderRadius: 999,
                    border: 'none',
                    background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                    color: '#ffffff',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: loading ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                >
                  {loading && isDepartmentEditorOpen ? <Clock size={14} className="animate-spin" /> : (editingDepartmentId ? 'Update department' : 'Save department')}
                </button>
              </div>
            </div>
          )}

          {departmentsList.length === 0 && isDepartmentEditorOpen ? null : (
            <div
              style={{
                marginBottom: 12,
                padding: '8px 10px',
                borderRadius: 8,
                border: '1px solid #e5e7eb',
                backgroundColor: '#f9fafb',
              }}
            >
              {departmentsList.length === 0 ? (
                <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>
                  No departments available yet. Use "Add department" to create one.
                </p>
              ) : (
                <>
                  <p style={{ margin: '0 0 6px', fontSize: 12, color: '#6b7280' }}>
                    Configured departments:
                  </p>
                  <div
                    style={{
                      borderRadius: 6,
                      border: '1px solid #e5e7eb',
                      overflow: 'hidden',
                      backgroundColor: '#ffffff',
                    }}
                  >
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1.5fr 2fr 100px',
                        padding: '6px 10px',
                        backgroundColor: '#f3f4f6',
                        fontSize: 11,
                        fontWeight: 600,
                        color: '#6b7280',
                      }}
                    >
                      <span>Name</span>
                      <span>Description</span>
                      <span style={{ textAlign: 'center' }}>Actions</span>
                    </div>
                    <div>
                      {departmentsList.map((d) => (
                        <div
                          key={d.id}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '1.5fr 2fr 100px',
                            padding: '6px 10px',
                            fontSize: 12,
                            color: '#374151',
                            borderTop: '1px solid #f3f4f6',
                            alignItems: 'center',
                          }}
                        >
                          <span style={{ fontWeight: 500 }}>{d.name}</span>
                          <span style={{ color: '#4b5563' }}>
                            {d.description || '—'}
                          </span>
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                            <button
                              type="button"
                              disabled={loading}
                              onClick={() => {
                                setEditingDepartmentId(d.id);
                                setDepartmentForm({
                                  name: d.name,
                                  description: d.description || '',
                                });
                                setIsDepartmentEditorOpen(true);
                              }}
                              style={{
                                padding: '4px',
                                borderRadius: 4,
                                border: '1px solid #e5e7eb',
                                background: 'white',
                                color: '#2563eb',
                                cursor: loading ? 'not-allowed' : 'pointer',
                              }}
                            >
                              <Pencil size={12} />
                            </button>
                            <button
                              type="button"
                              disabled={loading}
                              onClick={() => handleDeleteDepartment(d.id)}
                              style={{
                                padding: '4px',
                                borderRadius: 4,
                                border: '1px solid #fee2e2',
                                background: 'white',
                                color: '#ef4444',
                                cursor: loading ? 'not-allowed' : 'pointer',
                              }}
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </form>
      );
    }

    if (activeStep === 7) {
      return (
        <form id="admin-setup-step-7" onSubmit={handleCreatePosition}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 12,
              gap: 12,
            }}
          >
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0, marginBottom: 4, color: '#0f172a' }}>
                Step 7 · Add positions
              </h2>
              <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>
                Create positions (job titles) for your employees.
              </p>
            </div>
            <button
              type="button"
              disabled={loading}
              onClick={() => {
                setIsPositionEditorOpen(true);
                setEditingPositionId(null);
                setPositionForm({
                  title: '',
                  description: '',
                  hasProbation: false,
                  probationPeriodMonths: 3,
                  customProbationMonths: '',
                });
              }}
              style={{
                padding: '7px 14px',
                borderRadius: 999,
                border: '1px solid #2563eb',
                background: '#ffffff',
                color: '#2563eb',
                fontSize: 13,
                fontWeight: 500,
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              {loading && activeStep === 7 && !isPositionEditorOpen ? <Clock size={14} className="animate-spin" /> : '+ Add position'}
            </button>
          </div>

          {isPositionEditorOpen && (
            <div style={{ marginBottom: 12, padding: '10px 12px', borderRadius: 8, border: '1px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
              <div style={{ marginBottom: 10 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 4 }}>Position title</label>
                <input
                  type="text"
                  value={positionForm.title}
                  onChange={(e) => setPositionForm((prev) => ({ ...prev, title: e.target.value }))}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13, backgroundColor: '#ffffff', color: '#374151' }}
                  disabled={loading}
                />
              </div>
              <div style={{ marginBottom: 10 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 4 }}>Description (optional)</label>
                <textarea
                  rows={2}
                  value={positionForm.description}
                  onChange={(e) => setPositionForm((prev) => ({ ...prev, description: e.target.value }))}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13, resize: 'vertical', backgroundColor: '#ffffff', color: '#374151' }}
                  disabled={loading}
                />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={!!positionForm.hasProbation}
                    onChange={(e) => setPositionForm((prev) => ({ ...prev, hasProbation: e.target.checked }))}
                    disabled={loading}
                    style={{ cursor: 'pointer', accentColor: '#2563eb', colorScheme: 'light' }}
                  />
                  Enable Probation
                </label>
              </div>

              {positionForm.hasProbation && (
                <div style={{ marginBottom: 12, paddingLeft: 18 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4, color: '#4b5563' }}>
                    Probation Period (Months)
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {[3, 6].map((months) => (
                      <label key={months} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, cursor: 'pointer' }}>
                        <input
                          type="radio"
                          name="probationMonths"
                          value={months}
                          checked={positionForm.probationPeriodMonths === months}
                          onChange={() => setPositionForm((prev) => ({ ...prev, probationPeriodMonths: months }))}
                          disabled={loading}
                          style={{ cursor: 'pointer', accentColor: '#2563eb', colorScheme: 'light' }}
                        />
                        {months} Months
                      </label>
                    ))}
                    <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="probationMonths"
                        value="custom"
                        checked={positionForm.probationPeriodMonths === 'custom'}
                        onChange={() => setPositionForm((prev) => ({ ...prev, probationPeriodMonths: 'custom' }))}
                        disabled={loading}
                        style={{ cursor: 'pointer', accentColor: '#2563eb', colorScheme: 'light' }}
                      />
                      Custom
                    </label>

                    {positionForm.probationPeriodMonths === 'custom' && (
                      <input
                        type="number"
                        min="1"
                        max="24"
                        placeholder="Months"
                        value={positionForm.customProbationMonths || ''}
                        onChange={(e) => setPositionForm((prev) => ({ ...prev, customProbationMonths: e.target.value }))}
                        style={{
                          width: 80,
                          padding: '4px 8px',
                          borderRadius: 6,
                          border: '1px solid #e5e7eb',
                          fontSize: 12,
                          backgroundColor: '#ffffff',
                          color: '#374151',
                        }}
                        disabled={loading}
                      />
                    )}
                  </div>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => setIsPositionEditorOpen(false)}
                  style={{
                    padding: '7px 14px',
                    borderRadius: 999,
                    border: '1px solid #d1d5db',
                    background: '#ffffff',
                    color: '#6b7280',
                    fontSize: 13,
                    cursor: loading ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                >
                  {loading && isPositionEditorOpen && <Clock size={14} className="animate-spin" />}
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleAddPositionOnly}
                  style={{
                    padding: '7px 14px',
                    borderRadius: 999,
                    border: 'none',
                    background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                    color: '#ffffff',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: loading ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                >
                  {loading && isPositionEditorOpen ? <Clock size={14} className="animate-spin" /> : (editingPositionId ? 'Update position' : 'Save position')}
                </button>
              </div>
            </div>
          )}

          {positionsList.length === 0 && isPositionEditorOpen ? null : (
            <div style={{ marginBottom: 12, padding: '8px 10px', borderRadius: 8, border: '1px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
              {positionsList.length === 0 ? (
                <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>No positions available yet.</p>
              ) : (
                <div style={{ borderRadius: 6, border: '1px solid #e5e7eb', overflow: 'hidden', backgroundColor: '#ffffff' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1.5fr 100px', padding: '6px 10px', backgroundColor: '#f3f4f6', fontSize: 11, fontWeight: 600, color: '#6b7280' }}>
                    <span>Title</span>
                    <span>Probation</span>
                    <span>Description</span>
                    <span style={{ textAlign: 'center' }}>Actions</span>
                  </div>
                  {positionsList.map((p) => (
                    <div key={p.id} style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1.5fr 100px', padding: '6px 10px', fontSize: 12, color: '#374151', borderTop: '1px solid #f3f4f6', alignItems: 'center' }}>
                      <span style={{ fontWeight: 500 }}>{p.title}</span>
                      <span style={{ color: '#4b5563' }}>{p.probationPeriodMonths ? `${p.probationPeriodMonths} Months` : '—'}</span>
                      <span style={{ color: '#4b5563' }}>{p.description || '—'}</span>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                        <button
                          disabled={loading}
                          type="button"
                          onClick={() => {
                            setEditingPositionId(p.id);
                            const isStd = [3, 6].includes(p.probationPeriodMonths);
                            setPositionForm({
                              title: p.title,
                              description: p.description || '',
                              hasProbation: !!p.probationPeriodMonths,
                              probationPeriodMonths: isStd ? p.probationPeriodMonths : (p.probationPeriodMonths ? 'custom' : 3),
                              customProbationMonths: !isStd && p.probationPeriodMonths ? String(p.probationPeriodMonths) : '',
                            });
                            setIsPositionEditorOpen(true);
                          }}
                          style={{ padding: '4px', borderRadius: 4, border: '1px solid #e5e7eb', background: 'white', color: '#2563eb', cursor: 'pointer' }}
                        >
                          <Pencil size={12} />
                        </button>
                        <button disabled={loading} type="button" onClick={() => handleDeletePosition(p.id)} style={{ padding: '4px', borderRadius: 4, border: '1px solid #fee2e2', background: 'white', color: '#ef4444', cursor: 'pointer' }}><Trash2 size={12} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </form>
      );
    }


    if (activeStep === 4) {
      // All available leave types for display (same as internal application): use API codes or fallback to LEAVE_TYPE_LABELS keys, exclude HALF_DAY
      const displayAvailableCodes =
        Array.isArray(availableLeaveTypeCodes) && availableLeaveTypeCodes.length > 0
          ? availableLeaveTypeCodes.filter((c) => (c || '').toUpperCase() !== 'HALF_DAY')
          : Object.keys(LEAVE_TYPE_LABELS).filter((c) => (c || '').toUpperCase() !== 'HALF_DAY');
      const createdCodesSet = new Set(
        leaveTypesList.map((lt) => (lt.leaveTypeCode || '').toUpperCase()).filter(Boolean)
      );

      return (
        <form id="admin-setup-step-4" onSubmit={handleCreateLeaveType}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 12,
              gap: 12,
            }}
          >
            <div>
              <h2
                style={{
                  fontSize: 18,
                  fontWeight: 600,
                  margin: 0,
                  marginBottom: 4,
                  color: '#0f172a',
                }}
              >
                Step 4 · Create a basic leave type
              </h2>
              <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>
                Create at least one leave type, such as Annual Leave. You can add more leave types
                here as needed.
              </p>
            </div>
            <div
              style={{
                display: 'flex',
                gap: 8,
                flexShrink: 0,
                flexWrap: 'wrap',
                justifyContent: 'flex-end',
              }}
            >
              <button
                type="button"
                disabled={loading}
                onClick={() => {
                  setIsLeaveTypeEditorOpen(true);
                  setEditingLeaveTypeId(null);
                  setSelectedLeaveTemplate('');
                  setLeaveTypeForm({
                    leaveTypeName: '',
                    leaveTypeCode: '',
                    defaultLeaveCount: 12,
                  });
                }}
                style={{
                  padding: '7px 14px',
                  borderRadius: 999,
                  border: '1px solid #2563eb',
                  background: '#ffffff',
                  color: '#2563eb',
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                {loading && activeStep === 4 && !isLeaveTypeEditorOpen ? <Clock size={14} className="animate-spin" /> : '+ Add leave type'}
              </button>
            </div>
          </div>

          {isLeaveTypeEditorOpen && (
            <div
              style={{
                marginBottom: 12,
                padding: '10px 12px',
                borderRadius: 8,
                border: '1px solid #e5e7eb',
                backgroundColor: '#f9fafb',
              }}
            >
              <div style={{ marginBottom: 10 }}>
                <label
                  htmlFor="leaveTypeTemplate"
                  style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 4 }}
                >
                  Leave type
                </label>
                <select
                  id="leaveTypeTemplate"
                  disabled={loading}
                  value={selectedLeaveTemplate}
                  onChange={(e) => {
                    const code = e.target.value;
                    setSelectedLeaveTemplate(code);
                    const displayName = code ? LEAVE_TYPE_LABELS[code] || code : '';
                    setLeaveTypeForm((prev) => ({
                      ...prev,
                      leaveTypeName: displayName,
                      leaveTypeCode: code,
                    }));
                  }}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: 8,
                    border: '1px solid #e5e7eb',
                    backgroundColor: '#ffffff',
                    fontSize: 13,
                    cursor: loading ? 'not-allowed' : 'pointer',
                  }}
                >
                  <option value="">Select leave type</option>
                  {displayAvailableCodes.map((code) => {
                    const name = LEAVE_TYPE_LABELS[code] || code;
                    return (
                      <option key={code} value={code}>
                        {name} ({code})
                      </option>
                    );
                  })}
                </select>
              </div>
              <div style={{ maxWidth: 260, marginBottom: 12 }}>
                <label
                  htmlFor="ltCount"
                  style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 4 }}
                >
                  Default days (per year)
                </label>
                <input
                  id="ltCount"
                  type="number"
                  min={0}
                  value={leaveTypeForm.defaultLeaveCount}
                  onChange={(e) =>
                    setLeaveTypeForm((prev) => ({
                      ...prev,
                      defaultLeaveCount: parseInt(e.target.value || '0', 10),
                    }))
                  }
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: 8,
                    border: '1px solid #e5e7eb',
                    fontSize: 13,
                  }}
                  disabled={loading}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => setIsLeaveTypeEditorOpen(false)}
                  style={{
                    padding: '7px 14px',
                    borderRadius: 999,
                    border: '1px solid #d1d5db',
                    background: '#ffffff',
                    color: '#6b7280',
                    fontSize: 13,
                    cursor: loading ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                >
                  {loading && isLeaveTypeEditorOpen && <Clock size={14} className="animate-spin" />}
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleAddLeaveTypeOnly}
                  style={{
                    padding: '7px 14px',
                    borderRadius: 999,
                    border: 'none',
                    background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                    color: '#ffffff',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: loading ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                >
                  {loading && isLeaveTypeEditorOpen ? <Clock size={14} className="animate-spin" /> : (editingLeaveTypeId ? 'Update leave type' : 'Save leave type')}
                </button>
              </div>
            </div>
          )}

          {leaveTypesList.length === 0 && isLeaveTypeEditorOpen ? null : (
            <div
              style={{
                marginBottom: 12,
                padding: '8px 10px',
                borderRadius: 8,
                border: '1px solid #e5e7eb',
                backgroundColor: '#f9fafb',
              }}
            >
              {leaveTypesList.length === 0 ? (
                <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>
                  No leave types available yet. Use "Add leave type" to create one.
                </p>
              ) : (
                <>
                  <p style={{ margin: '0 0 6px', fontSize: 12, color: '#6b7280' }}>
                    Configured leave types:
                  </p>
                  <div
                    style={{
                      borderRadius: 6,
                      border: '1px solid #e5e7eb',
                      overflow: 'hidden',
                      backgroundColor: '#ffffff',
                    }}
                  >
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1.5fr 1fr 1fr 100px',
                        padding: '6px 10px',
                        backgroundColor: '#f3f4f6',
                        fontSize: 11,
                        fontWeight: 600,
                        color: '#6b7280',
                      }}
                    >
                      <span>Name</span>
                      <span>Code</span>
                      <span style={{ textAlign: 'center' }}>Default days</span>
                      <span style={{ textAlign: 'center' }}>Actions</span>
                    </div>
                    <div>
                      {leaveTypesList.map((lt) => (
                        <div
                          key={lt.id}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '1.5fr 1fr 1fr 100px',
                            padding: '6px 10px',
                            fontSize: 12,
                            color: '#374151',
                            borderTop: '1px solid #f3f4f6',
                            alignItems: 'center',
                          }}
                        >
                          <span style={{ fontWeight: 500 }}>{lt.leaveTypeName}</span>
                          <span style={{ color: '#4b5563' }}>{lt.leaveTypeCode}</span>
                          <span style={{ textAlign: 'center', color: '#4b5563' }}>
                            {lt.defaultLeaveCount}
                          </span>
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingLeaveTypeId(lt.id);
                                setSelectedLeaveTemplate(lt.leaveTypeCode);
                                setLeaveTypeForm({
                                  leaveTypeName: lt.leaveTypeName,
                                  leaveTypeCode: lt.leaveTypeCode,
                                  defaultLeaveCount: lt.defaultLeaveCount,
                                });
                                setIsLeaveTypeEditorOpen(true);
                              }}
                              style={{
                                padding: '4px',
                                borderRadius: 4,
                                border: '1px solid #e5e7eb',
                                background: 'white',
                                color: '#2563eb',
                                cursor: 'pointer',
                              }}
                            >
                              <Pencil size={12} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteLeaveType(lt.id)}
                              style={{
                                padding: '4px',
                                borderRadius: 4,
                                border: '1px solid #fee2e2',
                                background: 'white',
                                color: '#ef4444',
                                cursor: 'pointer',
                              }}
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
          {/* Buttons moved to shared footer */}
        </form>
      );
    }

    if (activeStep === 8) {
      return (
        <form id="admin-setup-step-8" onSubmit={handleCreateLocation}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 12,
              gap: 12,
            }}
          >
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0, marginBottom: 4, color: '#0f172a' }}>
                Step 8 · Add office locations
              </h2>
              <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>
                Add office locations where employees are based.
              </p>
            </div>
            <button
              type="button"
              disabled={loading}
              onClick={() => {
                setIsLocationEditorOpen(true);
                setEditingLocationId(null);
                setLocationForm({
                  locationName: '',
                  locationCode: '',
                  address: '',
                  contactPerson: '',
                  shiftTiming: '',
                  timezone: 'Asia/Kolkata'
                });
              }}
              style={{
                padding: '7px 14px',
                borderRadius: 999,
                border: '1px solid #2563eb',
                background: '#ffffff',
                color: '#2563eb',
                fontSize: 13,
                fontWeight: 500,
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              {loading && activeStep === 8 && !isLocationEditorOpen ? <Clock size={14} className="animate-spin" /> : '+ Add location'}
            </button>
          </div>

          {isLocationEditorOpen && (
            <div style={{ marginBottom: 12, padding: '10px 12px', borderRadius: 8, border: '1px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 4 }}>Location name</label>
                  <input
                    type="text"
                    value={locationForm.locationName}
                    onChange={(e) => setLocationForm((prev) => ({ ...prev, locationName: e.target.value }))}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13 }}
                    disabled={loading}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 4 }}>Location code</label>
                  <input
                    type="text"
                    placeholder="e.g. NY, MUM"
                    value={locationForm.locationCode}
                    onChange={(e) => setLocationForm((prev) => ({ ...prev, locationCode: e.target.value.toUpperCase() }))}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13 }}
                    disabled={loading}
                  />
                </div>
              </div>
              <div style={{ marginBottom: 10 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 4 }}>Address</label>
                <input
                  type="text"
                  value={locationForm.address}
                  onChange={(e) => setLocationForm((prev) => ({ ...prev, address: e.target.value }))}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13 }}
                  disabled={loading}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 4 }}>Contact person (optional)</label>
                  <input
                    type="text"
                    value={locationForm.contactPerson}
                    onChange={(e) => setLocationForm((prev) => ({ ...prev, contactPerson: e.target.value }))}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13 }}
                    disabled={loading}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 4 }}>Timezone</label>
                  <select
                    value={locationForm.timezone}
                    onChange={(e) => setLocationForm((prev) => ({ ...prev, timezone: e.target.value }))}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13, backgroundColor: '#fff' }}
                    disabled={loading}
                  >
                    <option value="Asia/Kolkata">India (IST)</option>
                    <option value="America/New_York">US Eastern (EST)</option>
                    <option value="Europe/London">London (GMT/BST)</option>
                    <option value="Asia/Singapore">Singapore (SGT)</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => setIsLocationEditorOpen(false)}
                  style={{
                    padding: '7px 14px',
                    borderRadius: 999,
                    border: '1px solid #d1d5db',
                    background: '#ffffff',
                    color: '#6b7280',
                    fontSize: 13,
                    cursor: loading ? 'not-allowed' : 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleAddLocationOnly}
                  style={{
                    padding: '7px 14px',
                    borderRadius: 999,
                    border: 'none',
                    background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                    color: '#ffffff',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: loading ? 'not-allowed' : 'pointer',
                  }}
                >
                  {editingLocationId ? 'Update location' : 'Save location'}
                </button>
              </div>
            </div>
          )}

          <div style={{ marginBottom: 12, padding: '8px 10px', borderRadius: 8, border: '1px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
            {locationsList.length === 0 ? (
              !isLocationEditorOpen && <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>No locations available yet. Click "+ Add location" to add one.</p>
            ) : (
              <div style={{ borderRadius: 6, border: '1px solid #e5e7eb', overflow: 'hidden', backgroundColor: '#ffffff' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 2fr 100px', padding: '6px 10px', backgroundColor: '#f3f4f6', fontSize: 11, fontWeight: 600, color: '#6b7280' }}>
                  <span>Name</span>
                  <span>Code</span>
                  <span>Address</span>
                  <span style={{ textAlign: 'center' }}>Actions</span>
                </div>
                {locationsList.map((l) => (
                  <div key={l.id} style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 2fr 100px', padding: '6px 10px', fontSize: 12, color: '#374151', borderTop: '1px solid #f3f4f6', alignItems: 'center' }}>
                    <span style={{ fontWeight: 500 }}>{l.locationName || l.name || '—'}</span>
                    <span style={{ color: '#4b5563', fontFamily: 'monospace' }}>{l.locationCode || '—'}</span>
                    <span style={{ color: '#4b5563' }}>{l.address || '—'}</span>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                      <button disabled={loading} type="button" onClick={() => { setEditingLocationId(l.id); setLocationForm({ locationName: l.locationName || l.name || '', locationCode: l.locationCode || '', address: l.address || '', contactPerson: l.contactPerson || '', shiftTiming: l.shiftTiming || '', timezone: l.timezone || 'Asia/Kolkata' }); setIsLocationEditorOpen(true); }} style={{ padding: '4px', borderRadius: 4, border: '1px solid #e5e7eb', background: 'white', color: '#2563eb', cursor: 'pointer' }}><Pencil size={12} /></button>
                      <button disabled={loading} type="button" onClick={() => handleDeleteLocationLocal(l.id)} style={{ padding: '4px', borderRadius: 4, border: '1px solid #fee2e2', background: 'white', color: '#ef4444', cursor: 'pointer' }}><Trash2 size={12} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </form>
      );
    }

    if (activeStep === 9) {
      const toggleWfhOption = (key) => {
        setWfhPolicy((prev) => ({ ...prev, [key]: !prev?.[key] }));
      };

      return (
        <form id="admin-setup-step-9" onSubmit={handleSaveWfhPolicyLocal}>
          <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0, marginBottom: 8, color: '#0f172a' }}>
            Step 9 · WFH Policy Configuration
          </h2>
          <p style={{ margin: 0, marginBottom: 16, fontSize: 13, color: '#6b7280' }}>
            Configure Work From Home limits and weekend/holiday rules for your organization.
          </p>

          <div style={{ display: 'grid', gap: 12, marginBottom: 12, maxWidth: 500 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 4 }}>Max Days Per Week</label>
                <input
                  type="number"
                  min="0"
                  max="7"
                  value={wfhPolicy?.maxDaysPerWeek ?? ''}
                  onChange={(e) => setWfhPolicy(prev => ({
                    ...prev,
                    maxDaysPerWeek: e.target.value === '' ? null : parseInt(e.target.value)
                  }))}
                  placeholder="Unlimited"
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13 }}
                  disabled={loading}
                />
                <span style={{ fontSize: 10, color: '#6b7280' }}>Leave empty for unlimited</span>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 4 }}>Max Days Per Month</label>
                <input
                  type="number"
                  min="0"
                  max="31"
                  value={wfhPolicy?.maxDaysPerMonth ?? ''}
                  onChange={(e) => setWfhPolicy(prev => ({
                    ...prev,
                    maxDaysPerMonth: e.target.value === '' ? null : parseInt(e.target.value)
                  }))}
                  placeholder="Unlimited"
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13 }}
                  disabled={loading}
                />
                <span style={{ fontSize: 10, color: '#6b7280' }}>Leave empty for unlimited</span>
              </div>
            </div>
          </div>
        </form>
      );
    }

    if (activeStep === 10) {
      const days = noticeConfig?.defaultNoticePeriodDays ?? noticeConfig?.noticePeriodDays ?? 30;

      return (
        <form id="admin-setup-step-10" onSubmit={handleSaveNoticePeriodLocal}>
          <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0, marginBottom: 8, color: '#0f172a' }}>
            Step 10 · Notice Period Configuration
          </h2>
          <p style={{ margin: 0, marginBottom: 16, fontSize: 13, color: '#6b7280' }}>
            Set the default notice period (in days) for employee exits.
          </p>

          <div style={{ maxWidth: 300, marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 4 }}>Default Notice Period (Days)</label>
            <input
              type="number"
              min="0"
              max="365"
              value={days}
              onChange={(e) => setNoticeConfig((prev) => ({
                ...prev,
                defaultNoticePeriodDays: parseInt(e.target.value) || 0,
                noticePeriodDays: parseInt(e.target.value) || 0
              }))}
              style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13 }}
              disabled={loading}
            />
            <p style={{ margin: '4px 0 0', fontSize: 11, color: '#6b7280' }}>
              Standard notice period is usually 30, 60 or 90 days.
            </p>
          </div>
        </form>
      );
    }

    if (activeStep === 5) {
      return (
        <form id="admin-setup-step-5" onSubmit={handleSaveEmpId}>
          <h2
            style={{
              fontSize: 18,
              fontWeight: 600,
              margin: 0,
              marginBottom: 8,
              color: '#0f172a',
            }}
          >
            Step 5 · Configure Employee ID format
          </h2>
          <p style={{ margin: 0, marginBottom: 12, fontSize: 13, color: '#6b7280' }}>
            Choose a simple Employee ID prefix and starting number. You can refine this later from
            the settings screen.
          </p>
          {/* Emp ID is a single configuration in this wizard; advanced options live in settings */}
          <div style={{ marginBottom: 12 }}>
            <label
              htmlFor="empPrefix"
              style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 4 }}
            >
              ID prefix
            </label>
            <input
              id="empPrefix"
              type="text"
              value={empIdForm.prefix}
              onChange={(e) =>
                setEmpIdForm((prev) => ({ ...prev, prefix: e.target.value.toUpperCase() }))
              }
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: 8,
                border: `1px solid ${!prefixAvailable ? '#ef4444' : '#e5e7eb'}`,
                fontSize: 13,
                outline: !prefixAvailable ? 'none' : undefined,
                boxShadow: !prefixAvailable ? '0 0 0 1px #ef4444' : 'none',
              }}
              disabled={loading}
            />
            {!prefixChecking && !prefixAvailable && (
              <p style={{ margin: '4px 0 0', fontSize: 11, color: '#ef4444' }}>
                Please use a unique ID prefix.
              </p>
            )}
          </div>
          <div style={{ marginBottom: 12 }}>
            <label
              htmlFor="empNext"
              style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 4 }}
            >
              Next number
            </label>
            <input
              id="empNext"
              type="number"
              min={0}
              value={empIdForm.nextNumber}
              onChange={(e) =>
                setEmpIdForm((prev) => ({
                  ...prev,
                  nextNumber: parseInt(e.target.value || '0', 10),
                }))
              }
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: 8,
                border: '1px solid #e5e7eb',
                fontSize: 13,
              }}
              disabled={loading}
            />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label
              htmlFor="empPadding"
              style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 4 }}
            >
              Digits padding (Leading zeros)
            </label>
            <select
              id="empPadding"
              value={empIdForm.padding}
              onChange={(e) =>
                setEmpIdForm((prev) => ({
                  ...prev,
                  padding: parseInt(e.target.value, 10),
                }))
              }
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: 8,
                border: '1px solid #e5e7eb',
                backgroundColor: '#ffffff',
                fontSize: 13,
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
              disabled={loading}
            >
              {[1, 2, 3, 4].map((len) => (
                <option key={len} value={len}>
                  {len} {len === 1 ? 'Digit' : 'Digits'} (e.g. {String(empIdForm.nextNumber).padStart(len, '0')})
                </option>
              ))}
            </select>
          </div>
          <div
            style={{
              marginBottom: 10,
              padding: '8px 10px',
              borderRadius: 8,
              backgroundColor: '#eff6ff',
              border: '1px solid #dbeafe',
              fontSize: 12,
              color: '#1d4ed8',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span style={{ fontWeight: 500 }}>Example next Employee ID</span>
            <span
              style={{
                fontFamily: 'monospace',
                fontSize: 13,
                padding: '2px 8px',
                borderRadius: 999,
                backgroundColor: '#1d4ed8',
                color: '#fff',
              }}
            >
              {empIdForm.nextEmployeeIdExample}
            </span>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 13,
                cursor: 'pointer',
                color: '#374151',
              }}
            >
              <input
                type="checkbox"
                checked={empIdForm.locationBased}
                onChange={(e) =>
                  setEmpIdForm((prev) => ({ ...prev, locationBased: e.target.checked }))
                }
                disabled={loading}
                style={{ cursor: 'pointer', accentColor: '#2563eb', colorScheme: 'light' }}
              />
              <span>Include location code in Employee ID</span>
            </label>
            <p style={{ margin: '4px 0 0', fontSize: 11, color: '#6b7280' }}>
              When enabled, IDs will include a short location code before the number.
            </p>
          </div>
        </form>
      );
    }

    if (activeStep === 6) {
      const getStatusLabel = (configured, skipped, items) => {
        if (configured || (Array.isArray(items) && items.length > 0)) return 'Configured';
        if (skipped) return 'Skipped';
        return 'Not configured';
      };

      return (
        <form id="admin-setup-step-6" onSubmit={handleCompleteSetup}>
          <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0, marginBottom: 8, color: '#0f172a' }}>
            Step 6 · Review & Complete Onboarding
          </h2>
          <p style={{ margin: 0, marginBottom: 16, fontSize: 13, color: '#6b7280' }}>
            Review your configuration summary below. Accept the terms and conditions to launch your workspace.
          </p>

          <div style={{ marginBottom: 16, padding: '12px', borderRadius: 8, border: '1px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 10px', color: '#1e293b' }}>Setup Summary</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', fontSize: 13 }}>
              <div><strong>Company Name:</strong> {companyDetails.name || 'Pragva HRMS'}</div>
              <div><strong>Shifts:</strong> {getStatusLabel(status.shiftsConfigured, status.shiftsSkipped, shiftsList)}</div>
              <div><strong>Weekends:</strong> {status.weekendsConfigured ? 'Configured' : 'Skipped'}</div>
              <div><strong>Departments:</strong> {getStatusLabel(status.departmentsConfigured, status.departmentsSkipped, departmentsList)}</div>
              <div><strong>Positions:</strong> {getStatusLabel(status.positionsConfigured, status.positionsSkipped, positionsList)}</div>
              <div><strong>Leave Types:</strong> {getStatusLabel(status.leaveTypesConfigured, status.leaveTypesSkipped, leaveTypesList)}</div>
              <div><strong>Locations:</strong> {getStatusLabel(locationsConfigured, locationsSkipped, locationsList)}</div>
              <div><strong>Employee ID Format:</strong> {empIdForm.prefix} (Example: {empIdForm.nextEmployeeIdExample})</div>
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', color: '#374151' }}>
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                disabled={completing}
                style={{ cursor: 'pointer', accentColor: '#2563eb', colorScheme: 'light' }}
              />
              <span>I accept the Terms & Conditions and confirm setup is accurate.</span>
            </label>
          </div>

          <button
            type="submit"
            disabled={!termsAccepted || completing}
            style={{
              padding: '10px 20px',
              borderRadius: 999,
              border: 'none',
              background: termsAccepted && !completing ? 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)' : '#cbd5e1',
              color: '#ffffff',
              fontSize: 14,
              fontWeight: 600,
              cursor: termsAccepted && !completing ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            {completing ? 'Completing setup…' : 'Complete setup'}
          </button>
        </form>
      );
    }

    return (
      <p style={{ fontSize: 13, color: '#6b7280' }}>Step not recognized.</p>
    );
  };

  return (
    <div
      style={{
        height: '100vh',
        maxHeight: '100vh',
        display: 'flex',
        flexDirection: 'row',
        fontFamily: "'Inter', sans-serif",
        backgroundColor: '#f8fafc',
        position: 'relative',
        width: '100%',
        boxSizing: 'border-box',
        margin: 0,
        overflow: 'hidden',
      }}
    >
      {/* Left: main setup content (approx. 3/4 width) */}
      <div
        style={{
          flex: '0 0 75%',
          height: '100%',
          maxHeight: '100vh',
          padding: '32px 48px',
          backgroundColor: '#ffffff',
          display: 'flex',
          flexDirection: 'column',
          boxSizing: 'border-box',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            minHeight: 0,
            overflow: 'hidden',
          }}
        >
          {/* Simple title above sidebar */}
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>Admin setup wizard</div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>Complete these steps to finish configuring Pragva‑HRMS.</div>
          </div>

          {error && (
            <div style={{ marginBottom: 16, padding: '10px 12px', borderRadius: 12, border: '1px solid #fecaca', backgroundColor: '#fef2f2', color: '#b91c1c', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}


          <div
            style={{
              display: 'flex',
              flex: 1,
              minHeight: 0,
              gap: 16,
            }}
          >
            {/* Sidebar with step pills */}
            <div
              style={{
                width: 220,
                flexShrink: 0,
                borderRadius: 12,
                border: '1px solid #e5e7eb',
                backgroundColor: '#f9fafb',
                padding: '10px 8px',
                boxSizing: 'border-box',
                overflowY: 'auto',
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#6b7280',
                  marginBottom: 8,
                  padding: '0 4px',
                }}
              >
                Setup steps
              </div>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}
              >
                {STEP_CONFIG.map((step) => {
                  const isActive = activeStep === step.id;
                  const Icon = step.icon;
                  const enabled = canNavigateToStep(step.id);
                  return (
                    <button
                      key={step.id}
                      type="button"
                      onClick={() => {
                        if (!enabled) return;
                        setActiveStep(step.id);
                        if (step.id === 6) setHasReachedReview(true);
                      }}
                      style={{
                        width: '100%',
                        padding: '7px 10px',
                        borderRadius: 999,
                        border: isActive ? '1px solid #2563eb' : '1px solid transparent',
                        backgroundColor: isActive ? '#eff6ff' : '#ffffff',
                        color: !enabled ? '#9ca3af' : isActive ? '#1d4ed8' : '#4b5563',
                        fontSize: 11,
                        fontWeight: isActive ? 600 : 500,
                        cursor: enabled ? 'pointer' : 'not-allowed',
                        opacity: enabled ? 1 : 0.6,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        boxShadow: isActive ? '0 0 0 1px rgba(37,99,235,0.1)' : 'none',
                      }}
                    >
                      <Icon size={14} />
                      <span
                        style={{
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {step.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Main step content column */}
            <div
              style={{
                flex: 1,
                minHeight: 0,
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {/* Scrollable step content */}
              <div
                style={{
                  flex: 1,
                  minHeight: 0,
                  overflowY: 'auto',
                  overflowX: 'hidden',
                  paddingBottom: 8,
                }}
              >
                {!loading ? (
                  renderStepContent()
                ) : (
                  <p style={{ fontSize: 13, color: '#6b7280' }}>Loading setup data…</p>
                )}
              </div>

              {/* Bottom action bar for configured steps */}
              {activeStep !== 0 && activeStep !== 6 && (
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 10,
                    width: '100%',
                    paddingTop: 12,
                    borderTop: '1px solid #e5e7eb',
                    backgroundColor: '#ffffff',
                  }}
                >
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => handleSkipStep(activeStep)}
                    style={{
                      padding: '9px 16px',
                      borderRadius: 999,
                      border: '1px solid #d1d5db',
                      background: '#fff',
                      color: '#6b7280',
                      fontSize: 14,
                      cursor: loading ? 'not-allowed' : 'pointer',
                    }}
                  >
                    Skip this step
                  </button>
                  {(activeStep === 2 || activeStep === 5 || activeStep === 9 || activeStep === 10 || isStepConfigured(activeStep)) && (
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => {
                        const form = document.getElementById(`admin-setup-step-${activeStep}`);
                        if (form && typeof form.requestSubmit === 'function') {
                          form.requestSubmit();
                        } else if (form) {
                          form.submit();
                        }
                      }}
                      style={{
                        padding: '9px 16px',
                        borderRadius: 999,
                        border: 'none',
                        background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                        color: '#ffffff',
                        fontSize: 14,
                        fontWeight: 600,
                        cursor: loading ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8
                      }}
                    >
                      {loading && !isDepartmentEditorOpen && !isShiftEditorOpen && !isLeaveTypeEditorOpen && !isPositionEditorOpen && <Clock size={16} className="animate-spin" />}
                      Save &amp; continue
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {toast && (
        <div
          style={{
            position: 'fixed',
            right: 24,
            top: 24,
            zIndex: 50,
            padding: '10px 14px',
            borderRadius: 999,
            backgroundColor: toast.type === 'success' ? '#16a34a' : '#f97316',
            color: '#fff',
            fontSize: 13,
            boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            opacity: toastVisible ? 1 : 0,
            transform: toastVisible ? 'translateY(0)' : 'translateY(-8px)',
            transition: 'opacity 0.3s ease-in-out, transform 0.3s ease-in-out',
          }}
        >
          <CheckCircle2 size={16} color="#bbf7d0" />
          <span>{toast.message}</span>
        </div>
      )}

      {/* Right: blue info card showing current step description (sticks to top on scroll) */}
      <div
        style={{
          flex: '0 0 25%',
          height: '100%',
          maxHeight: '100vh',
          background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 50%, #1e3a8a 100%)',
          color: '#e5e7eb',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'center',
          padding: '32px 24px',
          boxSizing: 'border-box',
          overflowY: 'auto',
        }}
      >
        <div
          style={{
            width: '100%',
            position: 'sticky',
            top: 24,
          }}
        >
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12, color: '#f9fafb' }}>
            {selectedStepConfig.label}
          </h2>
          <p style={{ fontSize: 13, color: '#e5e7eb', lineHeight: 1.6, marginBottom: 20 }}>
            {selectedStepConfig.description}
          </p>

          {activeStep === 4 && (
            <div style={{ marginTop: 24 }}>
              <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 600, color: '#f3f4f6', letterSpacing: '0.025em' }}>
                All available leave types (Name · Code)
              </p>
              <div
                style={{
                  borderRadius: 12,
                  border: '1px solid rgba(255,255,255,0.15)',
                  overflow: 'hidden',
                  backgroundColor: 'rgba(255,255,255,0.08)',
                  backdropFilter: 'blur(8px)',
                }}
              >
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr auto 60px',
                    padding: '8px 12px',
                    backgroundColor: 'rgba(255,255,255,0.12)',
                    fontSize: 11,
                    fontWeight: 600,
                    color: '#d1d5db',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  <span>Name</span>
                  <span>Code</span>
                  <span style={{ textAlign: 'right' }}>Status</span>
                </div>
                <div>
                  {(Array.isArray(availableLeaveTypeCodes) && availableLeaveTypeCodes.length > 0
                    ? availableLeaveTypeCodes.filter((c) => (c || '').toUpperCase() !== 'HALF_DAY')
                    : Object.keys(LEAVE_TYPE_LABELS).filter((c) => (c || '').toUpperCase() !== 'HALF_DAY')
                  ).map((code) => {
                    const name = LEAVE_TYPE_LABELS[code] || code;
                    const isCreated = leaveTypesList.some(lt => (lt.leaveTypeCode || '').toUpperCase() === (code || '').toUpperCase());
                    return (
                      <div
                        key={code}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr auto 60px',
                          padding: '10px 12px',
                          fontSize: 12,
                          color: '#f3f4f6',
                          borderTop: '1px solid rgba(255,255,255,0.08)',
                          alignItems: 'center',
                        }}
                      >
                        <span style={{ fontWeight: 500 }}>{name}</span>
                        <span style={{ color: '#9ca3af', fontFamily: 'monospace', fontSize: 11 }}>{code}</span>
                        <span style={{ textAlign: 'right', fontSize: 11, fontWeight: 600, color: isCreated ? '#4ade80' : 'rgba(255,255,255,0.3)' }}>
                          {isCreated ? 'Added' : '—'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
