import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, SlidersHorizontal, Eye, Edit2, Trash2, Power, PowerOff, CheckCircle, XCircle, ChevronLeft, ChevronRight, ChevronDown, Loader2, Download, Upload, X, BellOff, Bell } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import { adminAPI } from '../services/api';
import Header from '../components/Header';
import EmployeeDetails from './EmployeeDetails';
import {
  formatImportLimitMessage,
  formatLimitReachedMessage,
  getApiErrorMessage,
} from '../utils/employeeLimitUtils';

export default function AllEmployees() {
  const navigate = useNavigate();
  const { hasAdminAccess, hasCrudPermission } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalRecords, setTotalRecords] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [importSummary, setImportSummary] = useState(null);

  // Drawer State
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(null);
  const [showDrawer, setShowDrawer] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [employeeLimit, setEmployeeLimit] = useState(null);

  // Debounce search input changes (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const fetchEmployeeLimit = async () => {
    try {
      const res = await adminAPI.getEmployeeLimit();
      setEmployeeLimit(res.data || null);
    } catch (err) {
      console.warn('Failed to fetch employee limit', err);
    }
  };

  // Fetch employees from API with search, page, limit
  const fetchEmployees = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = {
        search: debouncedSearchTerm.trim(),
        page: currentPage,
        limit: pageSize
      };

      const response = await adminAPI.getAllEmployees(params);

      // Check if response has data in various formats
      if (response.data?.employees && Array.isArray(response.data.employees)) {
        setEmployees(response.data.employees);
        const total = response.data.totalCount ?? response.data.employees.length;
        setTotalRecords(total);
        setTotalPages(response.data.totalPages ?? Math.ceil(total / pageSize));
      } else if (response.data && Array.isArray(response.data)) {
        setEmployees(response.data);
        setTotalRecords(response.data.length);
        setTotalPages(Math.ceil(response.data.length / pageSize));
      } else if (response.data?.data && Array.isArray(response.data.data)) {
        setEmployees(response.data.data);
        const total = response.data.totalCount ?? response.data.data.length;
        setTotalRecords(total);
        setTotalPages(response.data.totalPages ?? Math.ceil(total / pageSize));
      } else {
        setError(`Invalid response format. Received: ${typeof response.data} - ${JSON.stringify(response.data).substring(0, 200)}`);
      }
    } catch (err) {
      console.error('Error fetching employees:', err);
      const status = err.response?.status;
      if (status === 502 || status === 503 || status === 504 || !err.response) {
        setError('The server is temporarily unavailable. Please wait a moment and refresh. If this continues, check Railway deployment logs.');
      } else {
        setError(getApiErrorMessage(err, 'Failed to fetch employees'));
      }
    } finally {
      setLoading(false);
    }
  };

  // Load employees when search, page, or page size changes
  useEffect(() => {
    if (hasAdminAccess()) {
      fetchEmployees();
    } else {
      setLoading(false);
      setError('Admin access required');
    }
  }, [hasAdminAccess, debouncedSearchTerm, currentPage, pageSize]);

  useEffect(() => {
    if (hasAdminAccess()) {
      fetchEmployeeLimit();
    }
  }, [hasAdminAccess]);

  // Table rows rendered directly from server-paginated data
  const paginatedEmployees = employees;

  // Handle page change
  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  // Handle page size change
  const handlePageSizeChange = (newSize) => {
    setPageSize(parseInt(newSize));
    setCurrentPage(1);
  };

  // Handle employee status toggle
  const handleStatusToggle = async (employeeId) => {
    try {
      // Find the employee to get current status for better messaging
      const employee = employees.find(emp => emp.id === employeeId);
      const wasActive = employee?.isActive || false;

      const response = await adminAPI.toggleEmployeeStatus(employeeId);

      // Show success notification
      if (response.data) {
        const isNowActive = response.data.isActive !== undefined ? response.data.isActive : !wasActive;
        if (isNowActive) {
          toast.success(response.data.message || 'Employee activated successfully');
        } else {
          toast.success(response.data.message || 'Employee deactivated successfully');
        }
      } else {
        toast.success(wasActive ? 'Employee deactivated successfully' : 'Employee activated successfully');
      }

      // Refresh employees list
      fetchEmployees();
    } catch (err) {
      console.error('Error toggling employee status:', err);
      toast.error(err.response?.data?.error || 'Failed to update employee status');
    }
  };

  // Handle mute/unmute notifications toggle
  const handleMuteToggle = async (employeeId) => {
    try {
      const employee = employees.find(emp => emp.id === employeeId);
      const wasMuted = employee?.isEmailMuted || false;

      const response = await adminAPI.toggleEmployeeEmailMuted(employeeId);

      if (response.data) {
        toast.success(response.data.message || (wasMuted ? 'Notifications unmuted' : 'Notifications muted'));
      } else {
        toast.success(wasMuted ? 'Notifications unmuted' : 'Notifications muted');
      }

      fetchEmployees();
    } catch (err) {
      console.error('Error toggling mute status:', err);
      toast.error(err.response?.data?.error || 'Failed to toggle notifications');
    }
  };

  // Handle employee deletion
  const handleDeleteEmployee = async () => {
    if (!deleteTarget) return;
    try {
      // NOTE: /admin/employees/{id} is a soft-delete (sets active=false).
      // Use permanent delete so the employee record is actually removed and no longer appears in lists.
      await adminAPI.permanentlyDeleteEmployee(deleteTarget.id);
      toast.success('Employee deleted successfully');
      fetchEmployees();
    } catch (err) {
      console.error('Error deleting employee:', err);
      toast.error(err.response?.data?.message || err.response?.data || 'Failed to delete employee');
    } finally {
      setDeleteTarget(null);
    }
  };


  // Export to CSV
  const handleExportCSV = () => {
    if (!employees || employees.length === 0) {
      toast.error("No employees to export");
      return;
    }

    const headers = [
      "employeeId", "firstName", "lastName", "email", "officialEmail", "phoneNumber", "department", "position", "reportingManagerName",
      "hireDate", "status", "salary", "panNumber", "location", "shift",
      "dateOfBirth", "gender", "maritalStatus", "nationality", "bloodGroup",
      "emergencyContact", "emergencyPhone", "education", "employeeType"
    ];

    const csvRows = [];
    csvRows.push(headers.join(","));

    employees.forEach(emp => {
      const row = [
        emp.employeeId || '',
        emp.firstName || '',
        emp.lastName || '',
        emp.email || '',
        emp.officialEmail || emp.email || '',
        emp.phoneNumber || emp.phone || emp.mobile || '',
        emp.departmentName || emp.department || '',
        emp.positionTitle || emp.position || emp.jobTitle || emp.designation || '',
        emp.reportingManagerName || '',
        emp.hireDate || emp.joiningDate || '',
        Boolean(emp.isActive ?? emp.active) ? 'Active' : 'Inactive',
        emp.salary || '',
        emp.panNumber || '',
        emp.locationName || emp.location || '',
        emp.shiftName || emp.shiftType || emp.shift || '',
        emp.dateOfBirth || '',
        emp.gender || '',
        emp.maritalStatus || '',
        emp.nationality || '',
        emp.bloodGroup || '',
        emp.emergencyContact || '',
        emp.emergencyPhone || '',
        emp.education || '',
        emp.employeeType || ''
      ];
      // Escape quotes and wrap values in quotes strictly to prevent CSV breaking with commas in values
      csvRows.push(row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(","));
    });

    const csvString = "\uFEFF" + csvRows.join("\n");
    const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `employees_export_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    toast.success("Export started");
  };

  // Export bulk import failure errors to CSV
  const handleDownloadImportErrors = () => {
    if (!importSummary?.failedRows || importSummary.failedRows.length === 0) return;
    const headers = ["RowNumber", "EmployeeID", "Email", "FailureReason"];
    const rows = [headers.join(",")];
    importSummary.failedRows.forEach(r => {
      const row = [r.rowNumber, r.employeeId || '', r.email || '', r.reason || ''];
      rows.push(row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(","));
    });
    const csvString = "\uFEFF" + rows.join("\n");
    const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `import_failures_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    toast.success("Error report downloaded");
  };

  // Download import template based on backend EmployeeDto
  const handleDownloadTemplate = () => {
    // Columns aligned to EmployeeDto fields (core + common lookups)
    const headers = [
      'employeeId',        // REQUIRED
      'firstName',         // REQUIRED
      'lastName',          // REQUIRED
      'email',             // REQUIRED
      'officialEmail',     // optional (defaults to email)
      'phoneNumber',       // REQUIRED
      'department',        // optional (name)
      'position',          // optional (name)
      'reportingManagerName', // optional (full name)
      'hireDate',          // REQUIRED (YYYY-MM-DD)
      'salary',            // optional, e.g. 50000
      'active',            // true / false
      'departmentId',      // optional (numeric ID)
      'positionId',        // optional (numeric ID)
      'employeeRoleId',    // optional (numeric role id)
      'locationId',        // optional (office location id)
      'shiftId'            // optional (shift id)
    ];

    const csvRows = [];
    csvRows.push(headers.join(','));
    // Optionally add one sample row
    const sampleRow = [
      'EMP-001',
      'John',
      'Doe',
      'john.doe@example.com',
      'john.doe@example.com',
      '9876543210',
      'IT', // department
      'Software Engineer', // position
      'Alice Manager', // reportingManagerName
      '2025-01-01', // hireDate
      '50000', // salary
      'true', // active
      '', // departmentId
      '', // positionId
      '', // employeeRoleId
      '', // locationId
      ''  // shiftId
    ];
    csvRows.push(sampleRow.map((v) => `"${v}"`).join(','));

    const csvString = csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'employee_import_template.csv';
    a.click();
  };

  // Import CSV
  const processRows = async (rows, colIndexMapping) => {
    if (employeeLimit?.atLimit) {
      toast.error(formatLimitReachedMessage(employeeLimit), { duration: 6000 });
      return;
    }

    const validRows = rows.filter(cols => cols.length > 0 && (cols[0] || cols[1]));
    const remainingSeats = employeeLimit?.remainingSeats ?? null;
    if (remainingSeats !== null && validRows.length > remainingSeats) {
      toast.error(formatImportLimitMessage(employeeLimit, validRows.length), { duration: 6000 });
      return;
    }

    toast.loading("Importing employees...", { id: 'importLoader' });

    const payloads = [];

    const cleanStr = (str) => String(str || '').toLowerCase().replace(/[\s_]/g, "");

    const colIndexClean = {};
    if (colIndexMapping) {
      Object.keys(colIndexMapping).forEach(key => {
        colIndexClean[cleanStr(key)] = colIndexMapping[key];
      });
    }

    for (const cols of rows) {
      if (cols.length === 0 || (!cols[0] && !cols[1])) continue;

      const hasHeaderMapping = Object.keys(colIndexClean).length > 0;

      const normalizeEmail = (val) => {
        if (!val) return '';
        return String(val).trim().replace(/^mailto:/i, '');
      };

      const getCol = (rowCols, key, fallbackKeys = []) => {
        if (!hasHeaderMapping) return '';
        const lowerKey = cleanStr(key);
        if (colIndexClean[lowerKey] != null) return rowCols[colIndexClean[lowerKey]] || '';
        for (const fb of fallbackKeys) {
          const fbLower = cleanStr(fb);
          if (colIndexClean[fbLower] != null) return rowCols[colIndexClean[fbLower]] || '';
        }
        return '';
      };

      const parseNumeric = (val) => {
        if (!val) return null;
        const cleaned = String(val).replace(/[^\d.-]/g, '');
        const num = parseFloat(cleaned);
        return isNaN(num) ? null : num;
      };

      const normalizeDate = (dateStr) => {
        if (!dateStr || String(dateStr).toLowerCase() === 'n/a') return null;
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;

        if (!isNaN(dateStr) && Number(dateStr) > 30000) {
          const date = XLSX.SSF.parse_date_code(Number(dateStr));
          return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
        }

        const parts = String(dateStr).split(/[/-]/);
        if (parts.length === 3) {
          if (parts[0].length === 4) return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
          else if (parts[2].length === 4) return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
        return null;
      };

      let firstName, lastName, email, officialEmail, phone, employeeId, hireDateVal;
      let departmentId, positionId, employeeRoleId, salary, locationId, shiftId, reportingManagerId, activeStr;
      let department, position, reportingManagerName;

      if (hasHeaderMapping) {
        firstName = getCol(cols, 'firstName', ['first', 'name']);
        lastName = getCol(cols, 'lastName', ['last']);
        email = normalizeEmail(getCol(cols, 'email', ['emailaddress']));
        officialEmail = normalizeEmail(getCol(cols, 'officialEmail', ['professionalEmail', 'official email']));
        phone = getCol(cols, 'phoneNumber', ['phone', 'mobile', 'cell']);
        employeeId = getCol(cols, 'employeeId', ['id', 'empid', 'emp_id']);
        hireDateVal = normalizeDate(getCol(cols, 'hireDate', ['joiningdate', 'joining date', 'dateofjoining', 'doj']));

        departmentId = getCol(cols, 'departmentId', ['dept id']);
        positionId = getCol(cols, 'positionId', ['pos id', 'designation id']);
        employeeRoleId = getCol(cols, 'employeeRoleId', ['role id']);
        salary = parseNumeric(getCol(cols, 'salary', ['ctc', 'pay']));
        locationId = getCol(cols, 'locationId', ['branch id']);
        shiftId = getCol(cols, 'shiftId');
        reportingManagerId = getCol(cols, 'reportingManagerId', ['manager id']);
        activeStr = getCol(cols, 'active', ['status', 'isactive']);

        department = getCol(cols, 'department', ['dept', 'departmentname']);
        position = getCol(cols, 'position', ['designation', 'job title', 'title', 'positiontitle']);
        reportingManagerName = getCol(cols, 'reportingManagerName', ['manager', 'reporting manager']);
      } else {
        const [fn, ln, em, ph, , , empId] = cols;
        firstName = fn;
        lastName = ln;
        email = normalizeEmail(em);
        officialEmail = email;
        phone = ph;
        employeeId = empId;
        hireDateVal = new Date().toISOString().split('T')[0];
        activeStr = 'true';
      }

      if (!firstName && !lastName && !email) continue;

      const toSafeNum = (val) => {
        if (val === null || val === undefined || val === '') return null;
        const num = Number(val);
        return isNaN(num) ? null : num;
      };

      const resolvedEmail = email || `temp-${Math.random().toString(36).substring(7)}@example.com`;
      const payload = {
        employeeId: employeeId || `EMP-${Math.floor(Math.random() * 10000)}`,
        firstName: firstName || 'N/A',
        lastName: lastName || 'N/A',
        email: resolvedEmail,
        officialEmail: officialEmail || resolvedEmail,
        phoneNumber: phone || '0000000000',
        hireDate: hireDateVal || new Date().toISOString().split('T')[0],
        active: activeStr ? (String(activeStr).toLowerCase() === 'true' || String(activeStr).toLowerCase() === 'active' || String(activeStr).toLowerCase() === 'yes') : true,
        departmentId: toSafeNum(departmentId),
        positionId: toSafeNum(positionId),
        employeeRoleId: toSafeNum(employeeRoleId),
        salary: toSafeNum(salary),
        locationId: toSafeNum(locationId),
        shiftId: toSafeNum(shiftId),
        reportingManagerId: toSafeNum(reportingManagerId),
        department: department || null,
        position: position || null,
        reportingManagerName: reportingManagerName || null
      };

      payloads.push(payload);
    }

    if (payloads.length === 0) {
      toast.dismiss('importLoader');
      toast.error('No valid employee data found to import.');
      return;
    }

    try {
      const res = await adminAPI.bulkImportEmployees(payloads);
      toast.dismiss('importLoader');
      const data = res.data || {};
      const successCount = data.successCount ?? 0;
      const failCount = data.failCount ?? 0;
      const failedRows = data.failedRows || [];

      if (failCount === 0) {
        toast.success(`Successfully imported all ${successCount} employees.`);
      } else {
        setImportSummary({
          totalCount: payloads.length,
          successCount,
          failCount,
          failedRows
        });
      }
    } catch (err) {
      // Fallback: process in sequential API calls if bulk endpoint is unavailable
      let successCount = 0;
      let failCount = 0;
      const failedRows = [];

      for (let i = 0; i < payloads.length; i++) {
        try {
          await adminAPI.createEmployee(payloads[i]);
          successCount++;
        } catch (e) {
          failCount++;
          failedRows.push({
            rowNumber: i + 1,
            employeeId: payloads[i].employeeId || 'N/A',
            email: payloads[i].email || 'N/A',
            reason: getApiErrorMessage(e, 'Failed to import employee')
          });
        }
      }

      toast.dismiss('importLoader');
      if (failCount === 0) {
        toast.success(`Successfully imported all ${successCount} employees.`);
      } else {
        setImportSummary({
          totalCount: payloads.length,
          successCount,
          failCount,
          failedRows
        });
      }
    }

    fetchEmployees();
    fetchEmployeeLimit();
  };

  const handleImportCSV = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');

    if (isExcel) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

        if (rows.length < 2) {
          toast.error("File is empty or missing data rows");
          return;
        }

        const headerCols = rows[0];
        const colIndex = {};
        headerCols.forEach((name, idx) => {
          if (name) colIndex[String(name).toLowerCase().replace(/\s/g, "")] = idx;
        });

        processRows(rows.slice(1), colIndex);
        event.target.value = null;
      };
      reader.readAsArrayBuffer(file);
    } else {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const text = e.target.result;
        const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
        if (lines.length < 2) {
          toast.error("Invalid CSV format");
          return;
        }

        const parseCSVLine = (line) => {
          const result = [];
          let cur = '';
          let inQuotes = false;
          for (let i = 0; i < line.length; i++) {
            const c = line[i];
            if (c === '"') inQuotes = !inQuotes;
            else if (c === ',' && !inQuotes) {
              result.push(cur.trim());
              cur = '';
            } else {
              cur += c;
            }
          }
          result.push(cur.trim());
          return result;
        };

        const headerCols = parseCSVLine(lines[0]);
        const colIndex = {};
        headerCols.forEach((name, idx) => {
          if (name) colIndex[name.toLowerCase().replace(/\s/g, "")] = idx;
        });

        const dataRows = lines.slice(1).map(line => parseCSVLine(line));
        processRows(dataRows, colIndex);
        event.target.value = null;
      };
      reader.readAsText(file);
    }
  };

  // Get employee full name
  const getEmployeeName = (employee) => {
    return `${employee.firstName || ''} ${employee.lastName || ''}`.trim() || 'N/A';
  };

  // Get employee avatar (fallback to default)
  const getEmployeeAvatar = (employee) => {
    return employee.profilePicture || `https://ui-avatars.com/api/?name=${encodeURIComponent(getEmployeeName(employee))}&background=6366f1&color=fff`;
  };

  // Get employee status badge class
  const getStatusBadgeClass = (isActive) => {
    return isActive ? 'status-badge active' : 'status-badge inactive';
  };

  // Get employee status text
  const getStatusText = (isActive) => {
    return isActive ? 'Active' : 'Inactive';
  };

  const handleRowClick = (employeeId) => {
    setSelectedEmployeeId(employeeId);
    setShowDrawer(true);
  };

  const closeDrawer = () => {
    setShowDrawer(false);
    setTimeout(() => setSelectedEmployeeId(null), 300); // Clear after animation
  };

  if (loading) {
    return (
      <div className="main-content">
        <Header title="All Employees" subtitle="All Employee Information" />
        <div className="page-content">
          <div className="loading-container">
            <Loader2 className="animate-spin" size={32} />
            <p>Loading employees...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="main-content">
        <Header title="All Employees" subtitle="All Employee Information" />
        <div className="page-content">
          <div className="error-container">
            <p>Error: {error}</p>
            <button onClick={fetchEmployees} className="retry-btn">
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="main-content" style={{ position: 'relative', overflow: 'hidden' }}>
      <style>{`
        /* ===== RESPONSIVE: Compact Desktop (≤1200px) ===== */
        @media (max-width: 1200px) {
          .employee-table th,
          .employee-table td {
            padding: 8px 10px;
            font-size: 11px;
          }
          
          .action-icons {
            gap: 6px;
          }
          
          .action-icon {
            width: 16px;
            height: 16px;
          }
        }

        /* ===== RESPONSIVE: Tablet Landscape (≤1024px) ===== */
        @media (max-width: 1024px) {
          .search-filter-row {
            flex-direction: column;
            gap: 10px;
            align-items: stretch !important;
            padding: 10px 12px;
          }
          
          .page-search {
            width: 100%;
          }
          
          .page-search input {
            width: 100%;
          }
          
          .action-buttons {
            flex-wrap: wrap;
            gap: 8px;
          }
          
          .action-buttons button {
            flex: 1 1 auto;
            min-width: 0;
            font-size: 11px;
            padding: 7px 12px;
          }
          
          .employee-table-container {
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
          }
          
          /* Hide Email column on tablet */
          .employee-table th:nth-child(5),
          .employee-table td:nth-child(5) {
            display: none;
          }
          
          .employee-drawer {
            width: 100% !important;
            max-width: 100% !important;
          }
        }

        /* ===== RESPONSIVE: Tablet Portrait (≤768px) ===== */
        @media (max-width: 768px) {
          .search-filter-row {
            padding: 10px;
          }
          
          .action-buttons {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 6px;
            width: 100%;
          }
          
          .action-buttons .add-employee-btn {
            grid-column: 1 / -1;
          }
          
          .action-buttons button {
            font-size: 11px;
            padding: 8px 10px;
            justify-content: center;
          }
          
          .employee-table-container {
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
          }
          
          .employee-table {
            min-width: 680px;
          }
          
          .employee-table th,
          .employee-table td {
            padding: 8px 8px;
            font-size: 10px;
            white-space: nowrap;
          }
          
          /* Hide Department, Designation columns on small tablet */
          .employee-table th:nth-child(3),
          .employee-table th:nth-child(4),
          .employee-table th:nth-child(5),
          .employee-table td:nth-child(3),
          .employee-table td:nth-child(4),
          .employee-table td:nth-child(5) {
            display: none;
          }
          
          .pagination {
            flex-direction: column;
            gap: 10px;
            align-items: stretch;
            padding: 10px;
          }
          
          .pagination-info {
            flex-direction: row;
            flex-wrap: wrap;
            gap: 6px;
            align-items: center;
            font-size: 10px;
          }
          
          .pagination-info span:last-child {
            font-size: 10px;
            margin-left: 0 !important;
          }
          
          .pagination-pages {
            justify-content: center;
            flex-wrap: wrap;
            gap: 4px;
          }
          
          .pagination-btn {
            min-width: 32px;
            height: 32px;
            font-size: 11px;
          }
          
          .action-icons {
            gap: 6px;
          }
          
          .action-icon {
            width: 16px;
            height: 16px;
          }
        }

        /* ===== RESPONSIVE: Mobile (≤480px) ===== */
        @media (max-width: 480px) {
          .search-filter-row {
            padding: 8px;
          }
          
          .action-buttons {
            grid-template-columns: 1fr 1fr;
            gap: 6px;
          }
          
          .action-buttons .add-employee-btn {
            grid-column: 1 / -1;
          }
          
          .action-buttons button span {
            display: inline;
            font-size: 10px;
          }
          
          .employee-table {
            min-width: 500px;
          }
          
          /* On mobile: show only Name, ID, Status, Action */
          .employee-table th:nth-child(3),
          .employee-table th:nth-child(4),
          .employee-table th:nth-child(5),
          .employee-table td:nth-child(3),
          .employee-table td:nth-child(4),
          .employee-table td:nth-child(5) {
            display: none;
          }
          
          .employee-table th,
          .employee-table td {
            padding: 6px 6px;
            font-size: 10px;
          }
          
          .employee-cell {
            gap: 6px;
          }
          
          .employee-avatar {
            width: 24px;
            height: 24px;
          }
          
          .action-icons {
            gap: 4px;
            flex-wrap: wrap;
          }
          
          .action-icon {
            width: 14px;
            height: 14px;
            padding: 2px;
          }
          
          .pagination {
            padding: 8px;
          }
          
          .pagination-btn {
            min-width: 28px;
            height: 28px;
            font-size: 10px;
          }
          
          .status-badge {
            font-size: 8px;
            padding: 1px 6px;
          }
        }
      `}</style>
      <Header title="All Employees" subtitle="All Employee Information" />

      <div className="page-content" style={{ padding: '10px 12px' }}>
        {employeeLimit?.maxEmployees != null && (
          <div style={{
            margin: '0 0 6px 0',
            padding: '6px 10px',
            borderRadius: '8px',
            border: employeeLimit.atLimit ? '1px solid #fecaca' : '1px solid #dbeafe',
            background: employeeLimit.atLimit ? '#fef2f2' : '#eff6ff',
            color: employeeLimit.atLimit ? '#991b1b' : '#1e40af',
            fontSize: '13px',
            fontWeight: 500,
          }}>
            Plan seats: {employeeLimit.currentEmployeeCount} / {employeeLimit.maxEmployees} employees used
            {employeeLimit.atLimit
              ? ' — all seats are in use. Upgrade your plan in Organization Settings to add more.'
              : ` — ${employeeLimit.remainingSeats} seat${employeeLimit.remainingSeats === 1 ? '' : 's'} remaining.`}
          </div>
        )}
        <div className="search-filter-row">
          <div className="page-search">
            <Search size={14} style={{ color: '#808080' }} />
            <input
              type="text"
              placeholder="Search employees..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="action-buttons">
            {hasCrudPermission?.('PEOPLE_ORG_EMPLOYEES', 'create') && (
              <button
                className="add-employee-btn"
                onClick={() => {
                  if (employeeLimit?.atLimit) {
                    toast.error(formatLimitReachedMessage(employeeLimit), { duration: 6000 });
                    return;
                  }
                  navigate('/admin/employees/add');
                }}
                disabled={employeeLimit?.atLimit}
                style={employeeLimit?.atLimit ? { opacity: 0.6, cursor: 'not-allowed' } : undefined}
              >
                <Plus size={14} />
                <span>Add New Employee</span>
              </button>
            )}
            <button className="filter-btn" onClick={handleExportCSV}>
              <Download size={14} />
              <span>Export</span>
            </button>
            <button className="filter-btn" onClick={handleDownloadTemplate}>
              <Download size={14} />
              <span>Template</span>
            </button>
            {hasCrudPermission?.('PEOPLE_ORG_EMPLOYEES', 'create') && (
              <button
                className="filter-btn"
                onClick={() => {
                  if (employeeLimit?.atLimit) {
                    toast.error(formatLimitReachedMessage(employeeLimit), { duration: 6000 });
                    return;
                  }
                  document.getElementById('csvInput').click();
                }}
                disabled={employeeLimit?.atLimit}
                style={employeeLimit?.atLimit ? { opacity: 0.6, cursor: 'not-allowed' } : undefined}
              >
                <Upload size={14} />
                <span>Import</span>
              </button>
            )}
            <input
              type="file"
              id="csvInput"
              accept=".csv, .xlsx, .xls"
              style={{ display: 'none' }}
              onChange={handleImportCSV}
            />
          </div>
        </div>

        <div className="card">
          <div className="employee-table-container" style={{ borderBottom: 'none' }}>
          <table className="employee-table">
            <thead>
              <tr>
                <th>Employee Name</th>
                <th>Employee ID</th>
                <th>Department</th>
                <th>Position</th>
                <th>Reporting Manager Name</th>
                <th>Email</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {paginatedEmployees.map((employee) => (
                <tr
                  key={employee.id}
                  onClick={() => handleRowClick(employee.id)}
                  style={{ cursor: 'pointer' }}
                >
                  <td>
                    <div className="employee-cell">
                      <img
                        src={getEmployeeAvatar(employee)}
                        alt=""
                        aria-hidden="true"
                        className="employee-avatar"
                        onError={(e) => {
                          e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(getEmployeeName(employee))}&background=6366f1&color=fff`;
                        }}
                      />
                      <span>{getEmployeeName(employee)}</span>
                    </div>
                  </td>
                  <td>{employee.employeeId || 'N/A'}</td>
                  <td>{employee.departmentName || 'N/A'}</td>
                  <td>{employee.positionTitle || employee.jobTitle || 'N/A'}</td>
                  <td>{employee.reportingManagerName || 'N/A'}</td>
                  <td>{employee.email || 'N/A'}</td>
                  <td>
                    <span className={getStatusBadgeClass(employee.isActive)}>
                      {getStatusText(employee.isActive)}
                    </span>
                  </td>
                  <td>
                    <div className="action-icons" onClick={(e) => e.stopPropagation()}>
                      <span className="action-icon" title="View" onClick={() => handleRowClick(employee.id)}>
                        <Eye size={16} />
                      </span>
                      {hasCrudPermission?.('PEOPLE_ORG_EMPLOYEES', 'update') && (
                        <span
                          className="action-icon"
                          title="Edit"
                          onClick={() => navigate(`/admin/employees/${employee.id}/edit`)}
                        >
                          <Edit2 size={16} />
                        </span>
                      )}
                      {hasCrudPermission?.('PEOPLE_ORG_EMPLOYEES', 'update') && (
                        <span
                          className="action-icon"
                          title={(employee.isActive || employee.active) ? "Deactivate" : "Activate"}
                          onClick={() => handleStatusToggle(employee.id)}
                          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          {Boolean(employee.isActive || employee.active) ? (
                            <Power size={16} style={{ color: '#22c55e', display: 'block' }} />
                          ) : (
                            <PowerOff size={16} style={{ color: '#ef4444', display: 'block' }} />
                          )}
                        </span>
                      )}
                      {hasCrudPermission?.('PEOPLE_ORG_EMPLOYEES', 'update') && (
                        <span
                          className="action-icon"
                          title={employee.isEmailMuted ? 'Unmute Notifications' : 'Mute Notifications'}
                          onClick={() => handleMuteToggle(employee.id)}
                          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          {employee.isEmailMuted ? (
                            <BellOff size={16} style={{ color: '#f59e0b', display: 'block' }} />
                          ) : (
                            <Bell size={16} style={{ color: '#6b7280', display: 'block' }} />
                          )}
                        </span>
                      )}
                      {hasCrudPermission?.('PEOPLE_ORG_EMPLOYEES', 'delete') && (
                        <span
                          className="action-icon delete-icon"
                          title="Delete"
                          onClick={() => setDeleteTarget(employee)}
                        >
                          <Trash2 size={16} />
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {employees.length === 0 && (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '40px 20px', color: '#6b7280' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                      <Search size={32} style={{ color: '#9ca3af', marginBottom: '4px' }} />
                      <p style={{ fontSize: '15px', fontWeight: 600, color: '#374151', margin: 0 }}>No matching employee records found</p>
                      <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>Try searching with a different name, ID, or email.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <div className="pagination">
            <div className="pagination-info">
              <span>Showing</span>
              <select
                className="pagination-select"
                value={pageSize}
                onChange={(e) => handlePageSizeChange(e.target.value)}
              >
                <option value="10">10</option>
                <option value="20">20</option>
                <option value="50">50</option>
              </select>
              <ChevronDown size={10} style={{ marginLeft: '-20px', pointerEvents: 'none' }} />
              <span style={{ marginLeft: '20px' }}>
                Showing {totalRecords === 0 ? 0 : ((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalRecords)} out of {totalRecords} records
              </span>
            </div>
            <div className="pagination-pages">
              <button
                className="pagination-btn"
                disabled={currentPage === 1}
                onClick={() => handlePageChange(currentPage - 1)}
              >
                <ChevronLeft size={12} />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                <button
                  key={page}
                  className={`pagination-btn ${page === currentPage ? 'active' : ''}`}
                  onClick={() => handlePageChange(page)}
                >
                  {page}
                </button>
              ))}
              <button
                className="pagination-btn"
                disabled={currentPage === totalPages || totalPages === 0}
                onClick={() => handlePageChange(currentPage + 1)}
              >
                <ChevronRight size={12} />
              </button>
            </div>
          </div>
        </div>
        </div>
      </div>

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="hr-modal-overlay" onClick={() => { setDeleteTarget(null); setDeleteConfirmText(''); }}>
          <div
            className="hr-modal"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '440px' }}
          >
            <div className="hr-modal-header">
              <h2>Delete Employee</h2>
              <button
                className="hr-modal-close"
                onClick={() => { setDeleteTarget(null); setDeleteConfirmText(''); }}
              >
                ×
              </button>
            </div>
            <div className="hr-modal-body">
              <p style={{ fontSize: '14px', color: 'var(--gray-600)', marginBottom: '12px' }}>
                Are you sure you want to delete{' '}
                <strong>{getEmployeeName(deleteTarget)}</strong> ({deleteTarget.employeeId || 'N/A'})? This action cannot be undone.
              </p>
              <div style={{ marginBottom: '8px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '4px' }}>
                  To confirm, type <strong>{deleteTarget.employeeId || getEmployeeName(deleteTarget).split(' ')[0]}</strong> below:
                </label>
                <input
                  type="text"
                  placeholder={`Type "${deleteTarget.employeeId || getEmployeeName(deleteTarget).split(' ')[0]}" to confirm`}
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: '13px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    outline: 'none'
                  }}
                />
              </div>
            </div>
            <div className="hr-modal-footer">
              <button
                type="button"
                className="hr-btn-secondary"
                onClick={() => { setDeleteTarget(null); setDeleteConfirmText(''); }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="hr-btn-primary"
                disabled={deleteConfirmText.trim().toLowerCase() !== (deleteTarget.employeeId || getEmployeeName(deleteTarget).split(' ')[0]).toLowerCase()}
                style={{
                  opacity: deleteConfirmText.trim().toLowerCase() === (deleteTarget.employeeId || getEmployeeName(deleteTarget).split(' ')[0]).toLowerCase() ? 1 : 0.5,
                  cursor: deleteConfirmText.trim().toLowerCase() === (deleteTarget.employeeId || getEmployeeName(deleteTarget).split(' ')[0]).toLowerCase() ? 'pointer' : 'not-allowed',
                  backgroundColor: '#dc2626'
                }}
                onClick={() => {
                  handleDeleteEmployee();
                  setDeleteConfirmText('');
                }}
              >
                Permanently Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Drawer Overlay */}
      {showDrawer && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.4)',
            zIndex: 40,
            backdropFilter: 'blur(2px)'
          }}
          onClick={closeDrawer}
        />
      )}

      {/* Drawer Panel */}
      <div
        className="employee-drawer"
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          width: '650px', // Employee details drawer
          backgroundColor: 'white',
          boxShadow: '-4px 0 16px rgba(0,0,0,0.1)',
          zIndex: 50,
          transform: showDrawer ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
          display: 'flex',
          flexDirection: 'column',
          borderLeft: '1px solid var(--gray-20)'
        }}
      >
        {/* Drawer Header Helper */}
        <div style={{
          padding: '16px 24px',
          borderBottom: '1px solid var(--gray-10)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: 'var(--white-5)'
        }}>
          <h2 style={{ fontSize: '18px', fontWeight: 'bold' }}>Employee Details</h2>
          <button onClick={closeDrawer} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}>
            <X size={20} color="var(--gray-500)" />
          </button>
        </div>

        {/* Drawer Content */}
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', position: 'relative' }}>
          {selectedEmployeeId && (
            <EmployeeDetails embeddedId={selectedEmployeeId} isEmbedded={true} />
          )}
        </div>
      </div>

      {/* Bulk Import Failure / Results Summary Modal */}
      {importSummary && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px'
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '650px',
            width: '100%',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            display: 'flex',
            flexDirection: 'column',
            maxHeight: '85vh'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '12px', borderBottom: '1px solid #e5e7eb' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#111827', margin: 0 }}>Import Results Summary</h3>
              <button onClick={() => setImportSummary(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}>
                <X size={20} />
              </button>
            </div>
            
            <div style={{ display: 'flex', gap: '12px', marginTop: '16px', marginBottom: '16px' }}>
              <span style={{ padding: '4px 12px', backgroundColor: '#e0e7ff', color: '#3730a3', borderRadius: '9999px', fontSize: '13px', fontWeight: 600 }}>
                Total Processed: {importSummary.totalCount}
              </span>
              <span style={{ padding: '4px 12px', backgroundColor: '#dcfce7', color: '#166534', borderRadius: '9999px', fontSize: '13px', fontWeight: 600 }}>
                Succeeded: {importSummary.successCount}
              </span>
              <span style={{ padding: '4px 12px', backgroundColor: '#fee2e2', color: '#991b1b', borderRadius: '9999px', fontSize: '13px', fontWeight: 600 }}>
                Failed: {importSummary.failCount}
              </span>
            </div>

            {importSummary.failedRows && importSummary.failedRows.length > 0 && (
              <div style={{ flex: 1, overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: '8px', marginTop: '8px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
                  <thead style={{ backgroundColor: '#f9fafb', position: 'sticky', top: 0 }}>
                    <tr>
                      <th style={{ padding: '8px 12px', borderBottom: '1px solid #e5e7eb', color: '#374151' }}>Row #</th>
                      <th style={{ padding: '8px 12px', borderBottom: '1px solid #e5e7eb', color: '#374151' }}>Employee ID</th>
                      <th style={{ padding: '8px 12px', borderBottom: '1px solid #e5e7eb', color: '#374151' }}>Email</th>
                      <th style={{ padding: '8px 12px', borderBottom: '1px solid #e5e7eb', color: '#374151' }}>Failure Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importSummary.failedRows.map((row, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '8px 12px', color: '#6b7280' }}>{row.rowNumber}</td>
                        <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontWeight: 600 }}>{row.employeeId}</td>
                        <td style={{ padding: '8px 12px', color: '#1f2937' }}>{row.email}</td>
                        <td style={{ padding: '8px 12px', color: '#dc2626', fontWeight: 500 }}>{row.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div style={{ paddingTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              {importSummary.failedRows && importSummary.failedRows.length > 0 ? (
                <button
                  onClick={handleDownloadImportErrors}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#fee2e2',
                    color: '#991b1b',
                    border: '1px solid #fca5a5',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '13px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <Download size={14} />
                  <span>Export Failure CSV</span>
                </button>
              ) : <div />}
              <button
                onClick={() => setImportSummary(null)}
                style={{
                  padding: '8px 20px',
                  backgroundColor: '#4f46e5',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '14px'
                }}
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
