import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, Edit, Trash2, Eye, MoreVertical, Loader2, UserPlus, UserX, Shield, UserCog, Users, UserCheck, ToggleLeft, ToggleRight, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { adminAPI, reportingAPI } from '../services/api';
import Header from '../components/Header';
import {
  formatLimitReachedMessage,
  getApiErrorMessage,
  isEmployeeLimitError,
} from '../utils/employeeLimitUtils';
import './UserManagement.css';

export default function UserManagement() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('admins');
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [employeeFilter, setEmployeeFilter] = useState('employee-only');

  // Admins state
  const [admins, setAdmins] = useState([]);
  const [adminsLoading, setAdminsLoading] = useState(false);

  // HRs state
  const [hrs, setHrs] = useState([]);
  const [hrsLoading, setHrsLoading] = useState(false);

  // Managers state
  const [managers, setManagers] = useState([]);
  const [managersLoading, setManagersLoading] = useState(false);

  // Employees state
  const [employees, setEmployees] = useState([]);
  const [employeeLimit, setEmployeeLimit] = useState(null);
  const [employeesLoading, setEmployeesLoading] = useState(false);

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('create'); // 'create' or 'edit'
  const [selectedUser, setSelectedUser] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    firstName: '',
    lastName: '',
    password: '',
    confirmPassword: '',
    phoneNumber: '',
    role: 'ADMIN', // ADMIN, HR, EMPLOYEE
    isActive: true
  });
  
  // Validation errors
  const [validationErrors, setValidationErrors] = useState({});

  // Fetch admins
  const fetchAdmins = async () => {
    setAdminsLoading(true);
    try {
      // Use /api/admin/admins endpoint (AdminController) or /api/admin (TenantAdminController)
      const response = await api.get('/admin/admins');
      setAdmins(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Error fetching admins:', error);
      // Fallback to TenantAdminController endpoint
      try {
        const fallbackResponse = await api.get('/admin');
        setAdmins(Array.isArray(fallbackResponse.data) ? fallbackResponse.data : []);
      } catch (fallbackError) {
        console.error('Error fetching admins (fallback):', fallbackError);
        toast.error('Failed to fetch admins');
        setAdmins([]);
      }
    } finally {
      setAdminsLoading(false);
    }
  };

  // Fetch HRs and CEOs (employees with HR or CEO role)
  const fetchHRs = async () => {
    setHrsLoading(true);
    try {
      // Get all employees and filter for HR/CEO role
      const response = await adminAPI.getAllEmployees();
      let employeesData = [];
      if (response.data?.employees && Array.isArray(response.data.employees)) {
        employeesData = response.data.employees;
      } else if (Array.isArray(response.data)) {
        employeesData = response.data;
      } else if (response.data?.data && Array.isArray(response.data.data)) {
        employeesData = response.data.data;
      }
      
      // Filter for HR/CEO role - check multiple possible locations
      const hrEmployees = employeesData.filter(emp => {
        // Check employeeRoleName field
        const employeeRoleName = String(emp.employeeRoleName || '').trim().toUpperCase();
        if (employeeRoleName === 'HR' || employeeRoleName === 'CEO') return true;
        
        // Check role.name (if role is an object)
        const roleName = emp.role?.name ? String(emp.role.name).trim().toUpperCase() : '';
        if (roleName === 'HR' || roleName === 'CEO') return true;
        
        // Check role field (if it's a string)
        const roleString = typeof emp.role === 'string' ? String(emp.role).trim().toUpperCase() : '';
        if (roleString === 'HR' || roleString === 'CEO') return true;
        
        // Check roles array
        const roles = emp.roles || [];
        if (roles.some(r => {
          const rName = typeof r === 'string' ? r : (r?.name || '');
          return ['HR', 'CEO'].includes(String(rName).trim().toUpperCase());
        })) return true;
        
        return false;
      });
      
      console.log('HR/CEO Employees found:', hrEmployees.length, hrEmployees);
      setHrs(hrEmployees);
    } catch (error) {
      console.error('Error fetching HRs/CEOs:', error);
      toast.error('Failed to fetch HRs/CEOs');
      setHrs([]);
    } finally {
      setHrsLoading(false);
    }
  };

  // Fetch managers (employees with reportees)
  const fetchManagers = async () => {
    setManagersLoading(true);
    try {
      // Get all employees
      const allEmployeesRes = await adminAPI.getAllEmployees();
      let allEmployees = [];
      if (allEmployeesRes.data?.employees && Array.isArray(allEmployeesRes.data.employees)) {
        allEmployees = allEmployeesRes.data.employees;
      } else if (Array.isArray(allEmployeesRes.data)) {
        allEmployees = allEmployeesRes.data;
      } else if (allEmployeesRes.data?.data && Array.isArray(allEmployeesRes.data.data)) {
        allEmployees = allEmployeesRes.data.data;
      }
      
      // Get all employees with managers info to build a map of manager -> subordinates
      const allWithManagersRes = await reportingAPI.getAllWithManagers();
      let allWithManagers = [];
      if (allWithManagersRes.data && Array.isArray(allWithManagersRes.data)) {
        allWithManagers = allWithManagersRes.data;
      } else if (allWithManagersRes.data?.data && Array.isArray(allWithManagersRes.data.data)) {
        allWithManagers = allWithManagersRes.data.data;
      }
      
      // Build a map of manager IDs to their subordinate count
      const managerCountMap = new Map();
      allWithManagers.forEach(emp => {
        const managerId = emp.reportingManagerId;
        if (managerId) {
          managerCountMap.set(managerId, (managerCountMap.get(managerId) || 0) + 1);
        }
      });
      
      // Find employees who are managers (have reportees)
      const managersWithCounts = allEmployees
        .map(emp => {
          const empId = emp.id;
          const reporteeCount = managerCountMap.get(empId) || 0;
          
          if (reporteeCount > 0) {
            return {
              ...emp,
              reporteeCount
            };
          }
          return null;
        })
        .filter(m => m !== null)
        .sort((a, b) => b.reporteeCount - a.reporteeCount);
      
      setManagers(managersWithCounts);
    } catch (error) {
      console.error('Error fetching managers:', error);
      toast.error('Failed to fetch managers');
      setManagers([]);
    } finally {
      setManagersLoading(false);
    }
  };

  // Fetch employees
  const fetchEmployees = async () => {
    setEmployeesLoading(true);
    try {
      const response = await adminAPI.getAllEmployees();
      let employeesData = [];
      if (response.data?.employees && Array.isArray(response.data.employees)) {
        employeesData = response.data.employees;
      } else if (Array.isArray(response.data)) {
        employeesData = response.data;
      } else if (response.data?.data && Array.isArray(response.data.data)) {
        employeesData = response.data.data;
      }
      
      // Get manager IDs to exclude managers from general employee list
      let managerIds = new Set();
      try {
        const allWithManagersRes = await reportingAPI.getAllWithManagers();
        let allWithManagers = [];
        if (allWithManagersRes.data && Array.isArray(allWithManagersRes.data)) {
          allWithManagers = allWithManagersRes.data;
        } else if (allWithManagersRes.data?.data && Array.isArray(allWithManagersRes.data.data)) {
          allWithManagers = allWithManagersRes.data.data;
        }
        allWithManagers.forEach(emp => {
          if (emp.reportingManagerId) managerIds.add(String(emp.reportingManagerId));
        });
      } catch (repErr) {
        console.warn('Could not fetch reporting managers for filtering:', repErr);
      }

      // Properly extract the primary role name for each employee
      const processedEmployees = employeesData.map(emp => {
        let extractedRole = '';
        if (emp.employeeRoleName) {
          extractedRole = String(emp.employeeRoleName);
        } else if (emp.roleName) {
          extractedRole = String(emp.roleName);
        } else if (emp.role) {
          if (typeof emp.role === 'string') extractedRole = emp.role;
          else if (emp.role.name) extractedRole = emp.role.name;
        }
        
        const roleName = extractedRole.trim().toUpperCase();
        const roles = emp.roles || [];
        
        const hasAdminRole = roleName === 'ADMIN' || roles.some(r => {
          const rName = typeof r === 'string' ? r : (r?.name || '');
          return String(rName).trim().toUpperCase() === 'ADMIN';
        });
        
        const hasHRRole = ['HR', 'CEO'].includes(roleName) || roles.some(r => {
          const rName = typeof r === 'string' ? r : (r?.name || '');
          return ['HR', 'CEO'].includes(String(rName).trim().toUpperCase());
        });
        
        const hasManagerRole = roleName === 'MANAGER' || roles.some(r => {
          const rName = typeof r === 'string' ? r : (r?.name || '');
          return String(rName).trim().toUpperCase() === 'MANAGER';
        });
        
        const isManagerByReportees = managerIds.has(String(emp.id));

        const isEmployeeRoleOnly = !hasAdminRole && !hasHRRole && !hasManagerRole && !isManagerByReportees;

        return {
          ...emp,
          extractedRoleName: roleName,
          isEmployeeRoleOnly
        };
      });
      
      setEmployees(processedEmployees);
    } catch (error) {
      console.error('Error fetching employees:', error);
      toast.error('Failed to fetch employees');
      setEmployees([]);
    } finally {
      setEmployeesLoading(false);
    }
  };

  // Fetch data based on active tab
  useEffect(() => {
    if (activeTab === 'admins') {
      fetchAdmins();
    } else if (activeTab === 'hrs') {
      fetchHRs();
    } else if (activeTab === 'managers') {
      fetchManagers();
    } else if (activeTab === 'employees') {
      fetchEmployees();
    }
  }, [activeTab]);

  useEffect(() => {
    const fetchEmployeeLimit = async () => {
      try {
        const res = await adminAPI.getEmployeeLimit();
        setEmployeeLimit(res.data || null);
      } catch (error) {
        console.error('Failed to fetch employee limit:', error);
      }
    };
    fetchEmployeeLimit();
  }, []);

  // Validate form
  const validateForm = () => {
    const errors = {};
    
    if (activeTab === 'admins') {
      // Username validation
      if (!formData.username.trim()) {
        errors.username = 'Username is required';
      } else if (formData.username.trim().length < 3) {
        errors.username = 'Username must be at least 3 characters';
      } else if (formData.username.trim().length > 50) {
        errors.username = 'Username must not exceed 50 characters';
      }
      
      // Email validation
      if (!formData.email.trim()) {
        errors.email = 'Email is required';
      } else {
        const emailRegex = /^[A-Za-z0-9+_.-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
        if (!emailRegex.test(formData.email.trim())) {
          errors.email = 'Invalid email format';
        }
      }
      
      // Password validation (only for create mode or if typed in edit mode)
      if (modalMode === 'create' || (modalMode === 'edit' && formData.password)) {
        if (modalMode === 'create' && !formData.password) {
          errors.password = 'Password is required';
        } else if (formData.password.length < 8) {
          errors.password = 'Password must be at least 8 characters';
        }
        
        if (modalMode === 'create') {
          if (!formData.confirmPassword) {
            errors.confirmPassword = 'Please confirm your password';
          } else if (formData.password !== formData.confirmPassword) {
            errors.confirmPassword = 'Passwords do not match';
          }
        }
      }
    }
    
    // First name validation
    if (!formData.firstName.trim()) {
      errors.firstName = 'First name is required';
    } else if (formData.firstName.trim().length > 100) {
      errors.firstName = 'First name must not exceed 100 characters';
    }
    
    // Last name validation
    if (!formData.lastName.trim()) {
      errors.lastName = 'Last name is required';
    } else if (formData.lastName.trim().length > 100) {
      errors.lastName = 'Last name must not exceed 100 characters';
    }
    
    // Phone number validation (optional)
    if (formData.phoneNumber && formData.phoneNumber.trim().length > 20) {
      errors.phoneNumber = 'Phone number must not exceed 20 characters';
    }
    
    // Role validation
    if (!formData.role) {
      errors.role = 'Role is required';
    }
    
    setValidationErrors(errors);
    return { isValid: Object.keys(errors).length === 0, errors };
  };
  
  // Check for duplicate username
  const checkDuplicateUsername = async (username) => {
    if (!username || username.trim().length < 3) return false;
    
    try {
      const response = await api.get('/admin');
      const existingAdmins = Array.isArray(response.data) ? response.data : [];
      const trimmedUsername = username.trim().toLowerCase();
      return existingAdmins.some(admin => 
        admin.username && admin.username.toLowerCase() === trimmedUsername &&
        (!selectedUser || admin.id !== selectedUser.id)
      );
    } catch (error) {
      console.error('Error checking duplicate username:', error);
      return false;
    }
  };
  
  // Check for duplicate email
  const checkDuplicateEmail = async (email) => {
    if (!email || !email.trim()) return false;
    
    try {
      const response = await api.get('/admin');
      const existingAdmins = Array.isArray(response.data) ? response.data : [];
      const trimmedEmail = email.trim().toLowerCase();
      return existingAdmins.some(admin => 
        admin.email && admin.email.toLowerCase() === trimmedEmail &&
        (!selectedUser || admin.id !== selectedUser.id)
      );
    } catch (error) {
      console.error('Error checking duplicate email:', error);
      return false;
    }
  };
  
  // Open create modal
  const handleCreate = () => {
    if (activeTab === 'hrs') {
      if (employeeLimit?.atLimit) {
        toast.error(formatLimitReachedMessage(employeeLimit), { duration: 6000 });
        return;
      }
      navigate('/admin/employees/add');
      return;
    }
    if (activeTab === 'managers' && employeeLimit?.atLimit) {
      toast.error(formatLimitReachedMessage(employeeLimit), { duration: 6000 });
      return;
    }
    setModalMode('create');
    setSelectedUser(null);
    setValidationErrors({});
    setFormData({
      username: '',
      email: '',
      firstName: '',
      lastName: '',
      password: '',
      confirmPassword: '',
      phoneNumber: '',
      role: activeTab === 'admins' ? 'ADMIN' : 'EMPLOYEE',
      isActive: true
    });
    setShowModal(true);
  };

  // Open edit modal
  const handleEdit = (userData) => {
    if (activeTab !== 'admins') {
      // For non-admins (HR, Manager, Employee), navigate to the full employee edit page
      navigate(`/admin/employees/${userData.id || userData.employeeId}/edit`);
      return;
    }
    setModalMode('edit');
    setSelectedUser(userData);
    setValidationErrors({});
    
    // Determine role from employeeRoleName or role field
    let userRole = userData.employeeRoleName || userData.role || '';
    if (!userRole && Array.isArray(userData.roles) && userData.roles.length > 0) {
      const firstRole = userData.roles[0];
      userRole = typeof firstRole === 'string' ? firstRole : (firstRole?.name || '');
    }
    if (!userRole && activeTab === 'admins') userRole = 'ADMIN';
    else if (!userRole && activeTab === 'hrs') userRole = 'HR';
    else if (!userRole) userRole = 'EMPLOYEE';
    
    // Ensure userRole is a string before calling toUpperCase
    const roleString = String(userRole).trim().toUpperCase();
    
    setFormData({
      username: userData.username || userData.employeeId || '',
      email: userData.email || '',
      firstName: userData.firstName || '',
      lastName: userData.lastName || '',
      password: '',
      confirmPassword: '',
      phoneNumber: userData.phoneNumber || '',
      role: roleString,
      isActive: userData.isActive !== undefined ? userData.isActive : (userData.active !== undefined ? userData.active : true)
    });
    setShowModal(true);
  };

  // Handle form submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate form
    const { isValid, errors } = validateForm();
    if (!isValid) {
      const firstError = Object.values(errors)[0];
      toast.error(firstError || 'Please fix the validation errors');
      return;
    }
    
    // Check for duplicates (only for admins)
    if (activeTab === 'admins') {
      const isDuplicateUsername = await checkDuplicateUsername(formData.username);
      if (isDuplicateUsername) {
        setValidationErrors(prev => ({ ...prev, username: 'Username already exists' }));
        toast.error('Username already exists');
        return;
      }
      
      const isDuplicateEmail = await checkDuplicateEmail(formData.email);
      if (isDuplicateEmail) {
        setValidationErrors(prev => ({ ...prev, email: 'Email already exists' }));
        toast.error('Email already exists');
        return;
      }
    }
    
    if (
      modalMode === 'create' &&
      (activeTab === 'hrs' || activeTab === 'managers') &&
      employeeLimit?.atLimit
    ) {
      toast.error(formatLimitReachedMessage(employeeLimit), { duration: 6000 });
      return;
    }
    
    try {
      if (modalMode === 'create') {
        if (activeTab === 'admins') {
          // Create admin using TenantAdminController
          const adminData = {
            username: formData.username.trim(),
            email: formData.email.trim().toLowerCase(),
            password: formData.password,
            firstName: formData.firstName.trim(),
            lastName: formData.lastName.trim(),
            phoneNumber: formData.phoneNumber?.trim() || null,
            adminLevel: 'ADMIN',
            isActive: formData.isActive
          };
          await api.post('/admin', adminData);
          toast.success('Admin created successfully');
        } else if (activeTab === 'hrs') {
          // Create HR - create employee with HR role
          const employeeData = {
            ...formData,
            employeeRoleName: 'HR',
            role: 'HR'
          };
          await adminAPI.createEmployee(employeeData);
          toast.success('HR created successfully');
        } else {
          // Create employee - redirect to add employee page or create here
          const employeeData = {
            ...formData,
            employeeRoleName: 'EMPLOYEE',
            role: 'EMPLOYEE'
          };
          await adminAPI.createEmployee(employeeData);
          toast.success('Employee created successfully');
        }
      } else {
        // Update user
        if (activeTab === 'admins') {
          // Update admin - try TenantAdminController first, fallback to AdminController
          const adminData = {
            username: formData.username.trim(),
            email: formData.email.trim().toLowerCase(),
            firstName: formData.firstName.trim(),
            lastName: formData.lastName.trim(),
            phoneNumber: formData.phoneNumber?.trim() || null,
            adminLevel: 'ADMIN',
            isActive: formData.isActive
          };
          // Only include password if provided
          if (formData.password && formData.password.trim()) {
            adminData.password = formData.password;
          }
          try {
            await api.put(`/admin/${selectedUser.id}`, adminData);
          } catch (error) {
            // If TenantAdminController fails, try AdminController endpoint
            await api.put(`/admin/admins/${selectedUser.id}`, adminData);
          }
          toast.success('Admin updated successfully');
        } else if (activeTab === 'hrs') {
          // Update HR (employee with HR role)
          const employeeData = {
            ...formData,
            employeeRoleName: 'HR',
            role: 'HR'
          };
          await adminAPI.updateEmployee(selectedUser.id || selectedUser.employeeId, employeeData);
          toast.success('HR updated successfully');
        } else {
          // Update employee
          const employeeData = {
            ...formData,
            employeeRoleName: 'EMPLOYEE',
            role: 'EMPLOYEE'
          };
          await adminAPI.updateEmployee(selectedUser.id || selectedUser.employeeId, employeeData);
          toast.success('Employee updated successfully');
        }
      }
      
      setShowModal(false);
      // Refresh data
      if (activeTab === 'admins') fetchAdmins();
      else if (activeTab === 'hrs') fetchHRs();
      else fetchEmployees();
    } catch (error) {
      console.error('Error saving user:', error);
      const fallback = isEmployeeLimitError(error)
        ? 'You have reached your plan employee limit.'
        : 'Failed to save user';
      toast.error(getApiErrorMessage(error, fallback), { duration: isEmployeeLimitError(error) ? 6000 : 4000 });
    }
  };

  // Handle delete
  const handleDelete = async () => {
    if (!userToDelete) return;
    
    try {
      if (activeTab === 'admins') {
        // Delete admin - try TenantAdminController first, fallback to AdminController
        try {
          await api.delete(`/admin/${userToDelete.id}`);
        } catch (error) {
          // Fallback to AdminController endpoint
          await adminAPI.deleteAdmin(userToDelete.id);
        }
        toast.success('Admin deleted successfully');
      } else if (activeTab === 'hrs') {
        // Delete HR (employee with HR role)
        await adminAPI.permanentlyDeleteEmployee(userToDelete.id || userToDelete.employeeId);
        toast.success('HR deleted successfully');
      } else {
        // Delete employee
        await adminAPI.permanentlyDeleteEmployee(userToDelete.id || userToDelete.employeeId);
        toast.success('Employee deleted successfully');
      }
      
      setShowDeleteModal(false);
      setUserToDelete(null);
      // Refresh data
      if (activeTab === 'admins') fetchAdmins();
      else if (activeTab === 'hrs') fetchHRs();
      else fetchEmployees();
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error(error.response?.data?.message || error.response?.data || 'Failed to delete user');
    }
  };

  // Toggle user status
  const handleToggleStatus = async (userData) => {
    const id = userData.id || userData.employeeId;
    if (!id) {
      toast.error('User ID not found');
      return;
    }

    try {
      if (activeTab === 'admins') {
        await adminAPI.toggleAdminStatus(id);
        toast.success(`Admin status updated successfully`);
      } else {
        await adminAPI.toggleEmployeeStatus(id);
        toast.success(`User status updated successfully`);
      }
      
      // Force refresh data
      if (activeTab === 'admins') fetchAdmins();
      else if (activeTab === 'hrs') fetchHRs();
      else if (activeTab === 'managers') fetchManagers();
      else fetchEmployees();
    } catch (error) {
      console.error('Error toggling status:', error);
      toast.error('Failed to update status');
    }
  };

  // Get current data based on active tab
  const getCurrentData = () => {
    if (activeTab === 'admins') return admins;
    if (activeTab === 'hrs') return hrs;
    if (activeTab === 'managers') return managers;
    return employees;
  };

  // Get current loading state
  const getCurrentLoading = () => {
    if (activeTab === 'admins') return adminsLoading;
    if (activeTab === 'hrs') return hrsLoading;
    if (activeTab === 'managers') return managersLoading;
    return employeesLoading;
  };

  // Filter data based on search and employee filter
  const filteredData = getCurrentData().filter(item => {
    // Apply employee filter if on employees tab
    if (activeTab === 'employees' && employeeFilter === 'employee-only') {
      if (!item.isEmployeeRoleOnly) {
        return false;
      }
    }

    const searchLower = searchTerm.toLowerCase();
    return (
      item.username?.toLowerCase().includes(searchLower) ||
      item.email?.toLowerCase().includes(searchLower) ||
      item.firstName?.toLowerCase().includes(searchLower) ||
      item.lastName?.toLowerCase().includes(searchLower) ||
      item.employeeId?.toLowerCase().includes(searchLower) ||
      `${item.firstName || ''} ${item.lastName || ''}`.toLowerCase().includes(searchLower)
    );
  });

  return (
    <div className="main-content user-management-page">
      <Header title="User Management" subtitle="Manage Admins, HRs, and Employees" />

      <div className="page-content">
        {/* Tabs */}
        <div className="card um-tabs-card">
          <div className="um-tabs" role="tablist" aria-label="User type">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'admins'}
              className={`um-tab ${activeTab === 'admins' ? 'active' : ''}`}
              onClick={() => setActiveTab('admins')}
            >
              <Shield size={16} />
              Admins ({admins.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'hrs'}
              className={`um-tab ${activeTab === 'hrs' ? 'active' : ''}`}
              onClick={() => setActiveTab('hrs')}
            >
              <UserCog size={16} />
              HRs / CEOs ({hrs.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'managers'}
              className={`um-tab ${activeTab === 'managers' ? 'active' : ''}`}
              onClick={() => setActiveTab('managers')}
            >
              <UserCheck size={16} />
              Managers ({managers.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'employees'}
              className={`um-tab ${activeTab === 'employees' ? 'active' : ''}`}
              onClick={() => setActiveTab('employees')}
            >
              <Users size={16} />
              Employees ({employeeFilter === 'employee-only' ? employees.filter(e => e.isEmployeeRoleOnly).length : employees.length})
            </button>
          </div>
        </div>

        {/* Content Card */}
        <div className="card">
          <div className="um-card-header">
            <h3 className="card-title">
              {activeTab === 'admins' ? 'Admins' : activeTab === 'hrs' ? 'HRs / CEOs' : activeTab === 'managers' ? 'Managers' : 'Employees'}
            </h3>
            <div className="um-toolbar">
              <div className="search-input-wrap um-search">
                <Search size={16} className="search-input-wrap__icon" aria-hidden />
                <input
                  type="search"
                  placeholder="Search users..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  aria-label="Search users"
                />
              </div>
              {activeTab === 'employees' && (
                <div style={{ marginLeft: '12px' }}>
                  <select
                    value={employeeFilter}
                    onChange={(e) => setEmployeeFilter(e.target.value)}
                    className="hr-input"
                    style={{ padding: '8px 12px', minWidth: '160px', height: '38px', borderRadius: '6px' }}
                    aria-label="Filter Employees"
                  >
                    <option value="all">All Employees</option>
                    <option value="employee-only">Only Employee Role</option>
                  </select>
                </div>
              )}
              {activeTab !== 'employees' && (
                <button
                  type="button"
                  onClick={handleCreate}
                  className="hr-btn-primary"
                  disabled={(activeTab === 'hrs' || activeTab === 'managers') && employeeLimit?.atLimit}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    ...((activeTab === 'hrs' || activeTab === 'managers') && employeeLimit?.atLimit
                      ? { opacity: 0.6, cursor: 'not-allowed' }
                      : {}),
                  }}
                >
                  <Plus size={16} />
                  {activeTab === 'admins' ? 'Add Admin' : 'Add User'}
                </button>
              )}
            </div>
          </div>

          {(activeTab === 'hrs' || activeTab === 'managers') && employeeLimit?.atLimit && (
            <div className="um-limit-banner">
              {formatLimitReachedMessage(employeeLimit)}
            </div>
          )}

          <div className="employee-table-container um-table-wrap">
            {getCurrentLoading() ? (
              <div className="um-loading">
                <Loader2 className="animate-spin" size={28} style={{ margin: '0 auto 8px' }} />
                <p>Loading users...</p>
              </div>
            ) : filteredData.length === 0 ? (
              <div className="um-empty">
                <Users size={36} style={{ color: '#9ca3af', marginBottom: '8px' }} />
                <p>No {activeTab} found</p>
              </div>
            ) : (
              <>
              <table className="employee-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Username/ID</th>
                    <th>Email</th>
                    <th>Role</th>
                    {activeTab === 'managers' && <th>Reportees</th>}
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredData.map((item) => {
                    const fullName = `${item.firstName || ''} ${item.lastName || ''}`.trim() || item.name || 'N/A';
                    const username = item.username || item.employeeId || 'N/A';
                    const email = item.email || 'N/A';
                    
                    // Extract role name - handle both string and object formats
                    let roleValue = item.employeeRoleName || '';
                    if (!roleValue && item.role) {
                      if (typeof item.role === 'string') {
                        roleValue = item.role;
                      } else if (item.role.name) {
                        roleValue = item.role.name;
                      }
                    }
                    // Also check roles array (e.g. CEO employees may only have role in roles[])
                    if (!roleValue && Array.isArray(item.roles) && item.roles.length > 0) {
                      const firstRole = item.roles[0];
                      roleValue = typeof firstRole === 'string' ? firstRole : (firstRole?.name || '');
                    }
                    if (!roleValue) {
                      roleValue = activeTab === 'admins' ? 'ADMIN' : activeTab === 'hrs' ? 'HR' : 'EMPLOYEE';
                    }
                    const role = String(roleValue).trim().toUpperCase();
                    const isActive = item.isActive !== undefined ? item.isActive : (item.active !== undefined ? item.active : true);

                    return (
                      <tr key={item.id || item.employeeId}>
                        <td>
                          <div className="employee-cell">
                            <img
                              src={`https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=6366f1&color=fff`}
                              className="employee-avatar"
                              alt=""
                            />
                            <div>
                              <div style={{ fontWeight: 500 }}>{fullName}</div>
                            </div>
                          </div>
                        </td>
                        <td>{username}</td>
                        <td>{email}</td>
                        <td>
                          <span className="status-badge" style={{
                            backgroundColor: role === 'ADMIN' ? '#dbeafe' : (role === 'HR' || role === 'CEO') ? '#fef3c7' : role === 'MANAGER' ? '#d1fae5' : '#e0e7ff',
                            color: role === 'ADMIN' ? '#1e40af' : (role === 'HR' || role === 'CEO') ? '#92400e' : role === 'MANAGER' ? '#065f46' : '#3730a3'
                          }}>
                            {role}
                          </span>
                        </td>
                        {activeTab === 'managers' && (
                          <td>
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '4px 12px',
                              backgroundColor: '#dbeafe',
                              color: '#1e40af',
                              borderRadius: '12px',
                              fontSize: '13px',
                              fontWeight: 500
                            }}>
                              <Users size={14} />
                              {item.reporteeCount || 0}
                            </span>
                          </td>
                        )}
                        <td>
                          <span className={`status-badge ${isActive ? 'active' : 'inactive'}`}>
                            {isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td>
                          <div className="action-icons" style={{ display: 'flex', gap: '8px' }}>
                            <span
                              className="action-icon"
                              title="Edit"
                              onClick={() => handleEdit(item)}
                              style={{ color: '#3b82f6', cursor: 'pointer' }}
                            >
                              <Edit size={16} />
                            </span>
                            <span
                              className="action-icon"
                              title={isActive ? 'Deactivate' : 'Activate'}
                              onClick={() => handleToggleStatus(item)}
                              style={{ color: isActive ? '#10b981' : '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                            >
                              {isActive ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                            </span>
                            {activeTab !== 'hrs' && activeTab !== 'managers' && (
                              <span
                                className="action-icon"
                                title="Delete"
                                onClick={() => {
                                  setUserToDelete(item);
                                  setShowDeleteModal(true);
                                }}
                                style={{ color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                              >
                                <Trash2 size={16} />
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="um-table-hint">Swipe left to see all columns</p>
              </>
            )}
          </div>
        </div>

        {/* Create/Edit Modal */}
        {showModal && (
          <div className="hr-modal-overlay" onClick={() => setShowModal(false)}>
            <div className="hr-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '420px', width: '90%' }}>
              <div className="hr-modal-header">
                <h2>{modalMode === 'create' ? 'Create' : 'Edit'} {activeTab === 'admins' ? 'Admin' : activeTab === 'hrs' ? 'HR' : 'Employee'}</h2>
                <button className="hr-modal-close" onClick={() => setShowModal(false)}>×</button>
              </div>
              <form onSubmit={handleSubmit}>
                <div className="hr-modal-body" style={{ maxHeight: 'calc(100vh - 180px)', overflowY: 'auto' }}>
                  <div className="hr-form-group">
                    <label>Username *</label>
                    <input
                      type="text"
                      value={formData.username}
                      onChange={(e) => {
                        setFormData({ ...formData, username: e.target.value });
                        if (validationErrors.username) {
                          setValidationErrors(prev => {
                            const newErrors = { ...prev };
                            delete newErrors.username;
                            return newErrors;
                          });
                        }
                      }}
                      required
                      disabled={modalMode === 'edit'}
                      minLength={3}
                      maxLength={50}
                    />
                    {validationErrors.username && (
                      <span style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                        {validationErrors.username}
                      </span>
                    )}
                  </div>
                  <div className="hr-form-group">
                    <label>Email *</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => {
                        setFormData({ ...formData, email: e.target.value });
                        if (validationErrors.email) {
                          setValidationErrors(prev => {
                            const newErrors = { ...prev };
                            delete newErrors.email;
                            return newErrors;
                          });
                        }
                      }}
                      required
                    />
                    {validationErrors.email && (
                      <span style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                        {validationErrors.email}
                      </span>
                    )}
                  </div>
                  <div className="hr-form-row">
                    <div className="hr-form-group">
                      <label>First Name *</label>
                      <input
                        type="text"
                        value={formData.firstName}
                        onChange={(e) => {
                          setFormData({ ...formData, firstName: e.target.value });
                          if (validationErrors.firstName) {
                            setValidationErrors(prev => {
                              const newErrors = { ...prev };
                              delete newErrors.firstName;
                              return newErrors;
                            });
                          }
                        }}
                        required
                        maxLength={100}
                      />
                      {validationErrors.firstName && (
                        <span style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                          {validationErrors.firstName}
                        </span>
                      )}
                    </div>
                    <div className="hr-form-group">
                      <label>Last Name *</label>
                      <input
                        type="text"
                        value={formData.lastName}
                        onChange={(e) => {
                          setFormData({ ...formData, lastName: e.target.value });
                          if (validationErrors.lastName) {
                            setValidationErrors(prev => {
                              const newErrors = { ...prev };
                              delete newErrors.lastName;
                              return newErrors;
                            });
                          }
                        }}
                        required
                        maxLength={100}
                      />
                      {validationErrors.lastName && (
                        <span style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                          {validationErrors.lastName}
                        </span>
                      )}
                    </div>
                  </div>
                  {activeTab === 'admins' && modalMode === 'create' && (
                    <>
                      <div className="hr-form-row">
                        <div className="hr-form-group">
                          <label>Password *</label>
                          <input
                            type="password"
                            value={formData.password}
                            onChange={(e) => {
                              setFormData({ ...formData, password: e.target.value });
                              if (validationErrors.password) {
                                setValidationErrors(prev => {
                                  const newErrors = { ...prev };
                                  delete newErrors.password;
                                  return newErrors;
                                });
                              }
                            }}
                            required
                            minLength={8}
                            placeholder="Minimum 8 characters"
                          />
                          {validationErrors.password && (
                            <span style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                              {validationErrors.password}
                            </span>
                          )}
                        </div>
                        <div className="hr-form-group">
                          <label>Confirm Password *</label>
                          <input
                            type="password"
                            value={formData.confirmPassword}
                            onChange={(e) => {
                              setFormData({ ...formData, confirmPassword: e.target.value });
                              if (validationErrors.confirmPassword) {
                                setValidationErrors(prev => {
                                  const newErrors = { ...prev };
                                  delete newErrors.confirmPassword;
                                  return newErrors;
                                });
                              }
                            }}
                            required
                            placeholder="Re-enter password"
                          />
                          {validationErrors.confirmPassword && (
                            <span style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                              {validationErrors.confirmPassword}
                            </span>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                  {activeTab === 'admins' && modalMode === 'edit' && (
                    <div className="hr-form-group">
                      <label>New Password (leave blank to keep current)</label>
                      <input
                        type="password"
                        value={formData.password}
                        onChange={(e) => {
                          setFormData({ ...formData, password: e.target.value });
                          if (validationErrors.password) {
                            setValidationErrors(prev => {
                              const newErrors = { ...prev };
                              delete newErrors.password;
                              return newErrors;
                            });
                          }
                        }}
                        minLength={8}
                        placeholder="Minimum 8 characters if changing"
                      />
                      {validationErrors.password && (
                        <span style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                          {validationErrors.password}
                        </span>
                      )}
                    </div>
                  )}
                  <div className="hr-form-group">
                    <label>Phone Number</label>
                    <input
                      type="text"
                      value={formData.phoneNumber}
                      onChange={(e) => {
                        setFormData({ ...formData, phoneNumber: e.target.value });
                        if (validationErrors.phoneNumber) {
                          setValidationErrors(prev => {
                            const newErrors = { ...prev };
                            delete newErrors.phoneNumber;
                            return newErrors;
                          });
                        }
                      }}
                      maxLength={20}
                      placeholder="Optional"
                    />
                    {validationErrors.phoneNumber && (
                      <span style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                        {validationErrors.phoneNumber}
                      </span>
                    )}
                  </div>
                  <div className="hr-form-group">
                    <label>Role</label>
                    {activeTab === 'admins' ? (
                      <div 
                        style={{ 
                          padding: '10px 12px', 
                          background: '#f3f4f6', 
                          border: '1px solid #e5e7eb', 
                          borderRadius: '8px',
                          color: '#4b5563',
                          fontSize: '14px',
                          fontWeight: 500,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}
                      >
                        <Shield size={14} /> Admin
                      </div>
                    ) : (
                      <select
                        value={formData.role}
                        onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                        disabled={modalMode === 'edit'}
                      >
                        <option value="ADMIN">Admin</option>
                        <option value="HR">HR</option>
                        <option value="CEO">CEO</option>
                        <option value="EMPLOYEE">Employee</option>
                      </select>
                    )}
                  </div>
                  <div className="hr-form-group" style={{ marginBottom: '0', display: 'flex', alignItems: 'center' }}>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer', margin: 0 }}>
                      <input
                        type="checkbox"
                        checked={formData.isActive}
                        onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                        style={{ width: '18px', height: '18px', cursor: 'pointer', margin: 0, padding: 0 }}
                      />
                      <span style={{ fontSize: '14px', fontWeight: 500, lineHeight: 1 }}>Active</span>
                    </label>
                  </div>
                </div>
                <div className="hr-modal-footer">
                  <button type="button" className="hr-btn-secondary" onClick={() => setShowModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="hr-btn-primary">
                    {modalMode === 'create' ? 'Create' : 'Update'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteModal && userToDelete && (
          <div className="hr-modal-overlay" onClick={() => setShowDeleteModal(false)}>
            <div className="hr-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px', width: '90%' }}>
              <div className="hr-modal-header">
                <h2>Delete {activeTab === 'admins' ? 'Admin' : activeTab === 'hrs' ? 'HR' : 'Employee'}</h2>
                <button className="hr-modal-close" onClick={() => setShowDeleteModal(false)}>×</button>
              </div>
              <div className="hr-modal-body">
                <p>
                  Are you sure you want to delete <strong>{userToDelete.firstName} {userToDelete.lastName}</strong> ({userToDelete.username || userToDelete.employeeId})?
                </p>
                <p style={{ color: '#ef4444', fontSize: '13px', marginTop: '12px' }}>
                  This action cannot be undone.
                </p>
              </div>
              <div className="hr-modal-footer">
                <button type="button" className="hr-btn-secondary" onClick={() => setShowDeleteModal(false)}>
                  Cancel
                </button>
                <button type="button" className="hr-btn-primary" onClick={handleDelete} style={{ backgroundColor: '#ef4444' }}>
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <style>
        {`
          .hr-modal-body::-webkit-scrollbar {
            width: 5px;
          }
          .hr-modal-body::-webkit-scrollbar-track {
            background: transparent;
          }
          .hr-modal-body::-webkit-scrollbar-thumb {
            background: #ffffff;
            border-radius: 10px;
            border: 1px solid #e5e7eb;
          }
          .hr-modal-body::-webkit-scrollbar-thumb:hover {
            background: #f9fafb;
          }
          /* Firefox */
          .hr-modal-body {
            scrollbar-width: thin;
            scrollbar-color: #ffffff transparent;
          }
        `}
      </style>
    </div>
  );
}

