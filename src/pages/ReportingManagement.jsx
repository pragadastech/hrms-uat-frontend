import { useState, useEffect } from 'react';
import { Search, UserPlus, UserMinus, Loader2, Users, X, Check, AlertTriangle, Info, GitBranch } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { reportingAPI } from '../services/api';
import Header from '../components/Header';
import { toast } from 'react-hot-toast';
import OrgChart from '../components/OrgChart';

const unwrapApiList = (response) => {
  const payload = response?.data ?? response;
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
};

const enrichEmployeeForHierarchy = (employee) => ({
  ...employee,
  employeeName:
    employee?.employeeName ||
    `${employee?.firstName || ''} ${employee?.lastName || ''}`.trim() ||
    employee?.employeeId ||
    'Employee',
});

const hasHierarchyCycle = (managers = []) =>
  managers.some(
    (person) =>
      person?.lastName?.includes('CYCLE') ||
      person?.lastName?.includes('circular') ||
      person?.firstName?.includes('⚠️') ||
      person?.lastName?.includes('CHAIN TOO DEEP') ||
      person?.lastName?.includes('too deep')
  );

export default function ReportingManagement() {
  const { hasAdminAccess, getCurrentUser } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [filteredEmployees, setFilteredEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [potentialManagers, setPotentialManagers] = useState([]);
  const [loadingManagers, setLoadingManagers] = useState(false);
  const [selectedManagerId, setSelectedManagerId] = useState('');
  const [processing, setProcessing] = useState(false);
  const [showHierarchyModal, setShowHierarchyModal] = useState(false);
  const [hierarchyData, setHierarchyData] = useState(null);
  const [loadingHierarchy, setLoadingHierarchy] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [selectedManagerForHierarchy, setSelectedManagerForHierarchy] = useState(null);
  const [orgHierarchyData, setOrgHierarchyData] = useState(null);
  const [loadingOrgHierarchy, setLoadingOrgHierarchy] = useState(false);
  const [showOrgHierarchy, setShowOrgHierarchy] = useState(false);
  const [removeTarget, setRemoveTarget] = useState(null);

  useEffect(() => {
    fetchEmployees();
    // Fetch hierarchy based on user role
    if (hasAdminAccess()) {
      // For admins/HR: fetch org-wide hierarchy
      fetchOrgHierarchy();
    } else {
      // For employees: fetch their team hierarchy
      fetchEmployeeTeamHierarchy();
    }
  }, []);

  const fetchOrgHierarchy = async () => {
    try {
      setLoadingOrgHierarchy(true);
      const response = await reportingAPI.getOrgChart();
      const orgData = response.data || response;
      
      if (Array.isArray(orgData) && orgData.length > 0) {
        setOrgHierarchyData({
          type: 'org-wide',
          employees: orgData
        });
      } else {
        setOrgHierarchyData({
          type: 'org-wide',
          employees: []
        });
      }
    } catch (error) {
      console.error('Error fetching org hierarchy:', error);
      toast.error('Failed to load organization hierarchy');
      setOrgHierarchyData({
        type: 'org-wide',
        employees: []
      });
    } finally {
      setLoadingOrgHierarchy(false);
    }
  };

  // Fetch employee's team hierarchy if they're not admin
  const fetchEmployeeTeamHierarchy = async () => {
    const currentUser = getCurrentUser();
    if (!currentUser || !currentUser.id) return;
    
    try {
      setLoadingOrgHierarchy(true);
      // Fetch complete reporting hierarchy (managers above the employee)
      const hierarchyRes = await reportingAPI.getHierarchy(currentUser.id);
      const hierarchyList = unwrapApiList(hierarchyRes);
      
      // Also fetch subordinates (direct reports)
      const subordinatesRes = await reportingAPI.getSubordinates(currentUser.id);
      const subordinatesList = unwrapApiList(subordinatesRes);
      
      // Combine hierarchy data: managers above + employee + subordinates below
      const fullHierarchy = {
        type: 'employee',
        managers: hierarchyList,
        employee: enrichEmployeeForHierarchy(currentUser),
        subordinates: subordinatesList
      };
      
      setOrgHierarchyData(fullHierarchy);
    } catch (error) {
      console.error('Error fetching employee team hierarchy:', error);
      const currentUser = getCurrentUser();
      setOrgHierarchyData({
        type: 'employee',
        managers: [],
        employee: currentUser,
        subordinates: []
      });
    } finally {
      setLoadingOrgHierarchy(false);
    }
  };

  useEffect(() => {
    if (searchTerm) {
      const s = searchTerm.toLowerCase().trim();
      const filtered = employees.filter(emp => {
        const fullName = (emp.employeeName || `${emp.firstName || ''} ${emp.lastName || ''}`).trim().toLowerCase();
        const empId = (emp.employeeId || '').toLowerCase();
        const email = (emp.email || '').toLowerCase();
        const dept = (emp.department || emp.departmentName || '').toLowerCase();
        const pos = (emp.position || emp.jobTitle || '').toLowerCase();
        const manager = (emp.managerName || emp.reportingManagerName || '').toLowerCase();

        return (
          fullName.includes(s) ||
          empId.includes(s) ||
          email.includes(s) ||
          dept.includes(s) ||
          pos.includes(s) ||
          manager.includes(s)
        );
      });
      setFilteredEmployees(filtered);
    } else {
      setFilteredEmployees(employees);
    }
  }, [searchTerm, employees]);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const response = await reportingAPI.getAllWithManagers();
      const data = response.data || response;
      
      if (Array.isArray(data)) {
        setEmployees(data);
        setFilteredEmployees(data);
      } else if (data.data && Array.isArray(data.data)) {
        setEmployees(data.data);
        setFilteredEmployees(data.data);
      } else {
        setEmployees([]);
        setFilteredEmployees([]);
      }
    } catch (error) {
      console.error('Error fetching employees:', error);
      toast.error('Failed to load employees');
      setEmployees([]);
      setFilteredEmployees([]);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveManager = async (employeeId) => {
    try {
      setProcessing(true);
      await reportingAPI.removeManager(employeeId);
      toast.success('Reporting manager removed successfully');
      fetchEmployees(); // Refresh the list
    } catch (error) {
      console.error('Error removing manager:', error);
      toast.error(error.response?.data?.message || 'Failed to remove reporting manager');
    } finally {
      setProcessing(false);
    }
  };

  const handleAssignManager = async (employee) => {
    setSelectedEmployee(employee);
    setShowAssignModal(true);
    setSelectedManagerId('');
    setPotentialManagers([]);
    setErrorMessage(''); // Clear any previous errors
    setSelectedManagerForHierarchy(null); // Clear previous manager hierarchy
    
    // Fetch potential managers
    try {
      setLoadingManagers(true);
      const response = await reportingAPI.getPotentialManagers(employee.id || employee.employeeId);
      const managers = response.data || response;
      let list = Array.isArray(managers) ? managers : [];
      // The backend (ReportingService.getPotentialManagers) already filters for managerial roles.
      // We don't need to filter on the frontend since the role field might not be present in the response.
      list.sort((a, b) => {
        const nameA = (a.employeeName || `${a.firstName || ''} ${a.lastName || ''}`).trim();
        const nameB = (b.employeeName || `${b.firstName || ''} ${b.lastName || ''}`).trim();
        return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' });
      });
      setPotentialManagers(list);
    } catch (error) {
      console.error('Error fetching potential managers:', error);
      toast.error('Failed to load potential managers');
      setPotentialManagers([]);
    } finally {
      setLoadingManagers(false);
    }
  };

  const handleSaveManager = async () => {
    if (!selectedManagerId) {
      toast.error('Please select a manager');
      return;
    }

    try {
      setProcessing(true);
      setErrorMessage('');
      const employeeId = selectedEmployee.id || selectedEmployee.employeeId;
      await reportingAPI.setManager(employeeId, selectedManagerId);
      toast.success('Reporting manager assigned successfully');
      setShowAssignModal(false);
      setSelectedEmployee(null);
      setSelectedManagerId('');
      setErrorMessage('');
      setSelectedManagerForHierarchy(null);
      fetchEmployees(); // Refresh the list
    } catch (error) {
      console.error('Error assigning manager:', error);
      const errorMsg = error.response?.data?.message || error.response?.data?.errorMessage || 'Failed to assign reporting manager';
      setErrorMessage(errorMsg);
      
      // If circular reference error, fetch the potential manager's hierarchy
      if (errorMsg.includes('Circular reference') || errorMsg.includes('circular')) {
        const selectedManager = potentialManagers.find(m => m.id.toString() === selectedManagerId.toString());
        if (selectedManager) {
          setSelectedManagerForHierarchy(selectedManager);
        }
      }
      
      toast.error(errorMsg, { duration: 6000 });
    } finally {
      setProcessing(false);
    }
  };

  const handleViewHierarchy = async (employee) => {
    setShowAssignModal(false);
    setErrorMessage('');
    setSelectedManagerId('');
    setSelectedEmployee(employee);
    setShowHierarchyModal(true);
    setHierarchyData(null);
    
    try {
      setLoadingHierarchy(true);
      // Use numeric ID if available, otherwise use employeeId string
      // If it's a string employeeId, we need to find the numeric ID first
      let employeeId = employee.id;
      if (!employeeId && employee.employeeId) {
        // Try to find the employee in the employees list to get the numeric ID
        const foundEmployee = employees.find(e => 
          (e.employeeId === employee.employeeId) || 
          (e.id && e.id.toString() === employee.employeeId.toString())
        );
        employeeId = foundEmployee?.id || employee.employeeId;
      }
      
      // Fetch complete reporting hierarchy (managers above the employee)
      const hierarchyRes = await reportingAPI.getHierarchy(employeeId);
      const hierarchyList = unwrapApiList(hierarchyRes);
      
      // Also fetch subordinates (direct reports)
      const subordinatesRes = await reportingAPI.getSubordinates(employeeId);
      const subordinatesList = unwrapApiList(subordinatesRes);
      
      // Combine hierarchy data: managers above + employee + subordinates below
      const fullHierarchy = {
        type: 'employee',
        managers: hierarchyList,
        employee: enrichEmployeeForHierarchy(employee),
        subordinates: subordinatesList
      };
      
      setHierarchyData(fullHierarchy);
    } catch (error) {
      console.error('Error fetching hierarchy:', error);
      toast.error('Failed to load reporting hierarchy');
      setHierarchyData(null);
    } finally {
      setLoadingHierarchy(false);
    }
  };

  return (
    <div className="main-content reporting-mgmt-page" style={{ position: 'relative', overflow: 'hidden' }}>
      <Header title="Reporting Management" subtitle="Visualize and manage employee reporting relationships & hierarchies" />
      <div className="page-content" style={{ padding: '10px 12px' }}>
        <style>{`
        .reporting-mgmt-page .page-content {
          padding: 10px 12px;
        }
        .rm-header-card {
          background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%);
          color: white;
          padding: 14px 16px;
          border-radius: 10px;
          margin-bottom: 12px;
          box-shadow: 0 4px 12px rgba(49, 46, 129, 0.12);
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 10px;
        }
        .rm-header-title {
          margin: 0;
          font-size: 18px;
          font-weight: 700;
          letter-spacing: -0.3px;
        }
        .rm-header-subtitle {
          margin: 2px 0 0 0;
          font-size: 12px;
          opacity: 0.8;
        }
        .rm-controls-row {
          display: flex;
          gap: 10px;
          align-items: center;
          margin: 0 0 10px 0;
          flex-wrap: wrap;
          width: 100%;
        }
        .rm-search-wrapper {
          position: relative;
          flex: 1;
          min-width: 220px;
        }
        .rm-search-input {
          width: 100%;
          padding: 8px 12px;
          border-radius: 8px;
          border: 1px solid #e2e8f0;
          background: white;
          font-size: 13px;
          font-weight: 500;
          color: #0f172a;
          outline: none;
          transition: all 0.2s ease;
          box-shadow: none;
          height: 36px;
          box-sizing: border-box;
        }
        .rm-search-input:focus {
          border-color: #6366f1;
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
        }
        .rm-toggle-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 0 14px;
          height: 36px;
          border-radius: 8px;
          font-weight: 600;
          font-size: 13px;
          line-height: 1;
          cursor: pointer;
          transition: all 0.2s ease;
          border: none;
          background: #6366f1;
          color: white;
          box-shadow: none;
          white-space: nowrap;
        }
        .rm-toggle-btn:hover {
          background: #4f46e5;
          transform: none;
        }
        .rm-toggle-btn.active {
          background: #312e81;
          box-shadow: none;
        }
        .rm-table-card {
          background: white;
          border-radius: 10px;
          box-shadow: none;
          border: 1px solid #e2e8f0;
          overflow: hidden;
        }
        .rm-table-header {
          padding: 10px 14px;
          border-bottom: 1px solid #e2e8f0;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .rm-table-title {
          margin: 0;
          font-size: 14px;
          font-weight: 700;
          color: #1e293b;
        }
        .rm-table-wrapper {
          overflow-x: auto;
        }
        .rm-table {
          width: 100%;
          border-collapse: collapse;
        }
        .rm-table th {
          background: #f8fafc;
          padding: 8px 12px;
          font-size: 11px;
          font-weight: 700;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.4px;
          text-align: left;
          border-bottom: 1px solid #e2e8f0;
        }
        .rm-table td {
          padding: 8px 12px;
          border-bottom: 1px solid #f1f5f9;
          font-size: 13px;
          color: #334155;
          vertical-align: middle;
        }
        .rm-table tr:last-child td {
          border-bottom: none;
        }
        .rm-table tr:hover td {
          background: #f8fafc;
        }
        .rm-emp-badge {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .rm-avatar {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          object-fit: cover;
          border: 1px solid white;
          box-shadow: 0 1px 3px rgba(0,0,0,0.08);
        }
        .rm-emp-name {
          font-weight: 600;
          color: #1e293b;
          font-size: 13px;
        }
        .rm-emp-email {
          font-size: 11px;
          color: #64748b;
          margin-top: 0;
        }
        .rm-manager-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: #f5f3ff;
          color: #7c3aed;
          padding: 3px 8px;
          border-radius: 9999px;
          font-size: 12px;
          font-weight: 600;
        }
        .rm-no-manager {
          color: #94a3b8;
          font-style: italic;
          font-size: 12px;
        }
        .rm-actions-cell {
          display: flex;
          gap: 6px;
          align-items: center;
        }
        .rm-btn-action {
          width: 28px;
          height: 28px;
          min-width: 28px;
          min-height: 28px;
          padding: 0;
          border-radius: 6px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: none;
          cursor: pointer;
          transition: background 0.15s ease, color 0.15s ease;
          position: relative;
          flex-shrink: 0;
        }
        .rm-btn-action:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .rm-btn-action.hierarchy {
          background: #f5f3ff;
          color: #7c3aed;
        }
        .rm-btn-action.hierarchy:hover:not(:disabled) {
          background: #ede9fe;
          box-shadow: none;
          transform: none;
        }
        .rm-btn-action.assign {
          background: #e0e7ff;
          color: #4f46e5;
        }
        .rm-btn-action.assign:hover:not(:disabled) {
          background: #c7d2fe;
          box-shadow: none;
          transform: none;
        }
        .rm-btn-action.remove {
          background: #fee2e2;
          color: #ef4444;
        }
        .rm-btn-action.remove:hover:not(:disabled) {
          background: #fecaca;
          box-shadow: none;
          transform: none;
        }
        @media (max-width: 768px) {
          .rm-header-card {
            padding: 12px;
            text-align: center;
            justify-content: center;
          }
          .rm-controls-row {
            flex-direction: column;
            align-items: stretch;
          }
          .rm-toggle-btn {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>


      <div className="rm-controls-row">
        {/* Sleek Search Input */}
        <div className="rm-search-wrapper">
          <input
            type="text"
            placeholder="Search by employee name, ID, department..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="rm-search-input"
          />
        </div>
        
        {/* Redesigned Hierarchy Toggle Button */}
        <button
          onClick={() => setShowOrgHierarchy(!showOrgHierarchy)}
          className={`rm-toggle-btn ${showOrgHierarchy ? 'active' : ''}`}
        >
          <GitBranch size={16} />
          <span>{showOrgHierarchy ? 'Hide' : 'Show'} {hasAdminAccess() ? 'Org' : 'Team'} Hierarchy</span>
        </button>
      </div>

      {/* Org Hierarchy Section */}
      {showOrgHierarchy && (
        <div className="rm-table-card" style={{ marginBottom: '10px', animation: 'fadeIn 0.3s ease' }}>
          <div className="rm-table-header" style={{ flexWrap: 'wrap', gap: '6px' }}>
            <h3 className="rm-table-title">
              {hasAdminAccess() ? 'Organization-Wide Hierarchy Diagram' : 'Team Hierarchy Diagram'}
            </h3>
            <span style={{ fontSize: '11px', color: '#64748b', fontStyle: 'italic' }}>
              (Use 'Hide Hierarchy' button above to quickly scroll page on mobile)
            </span>
          </div>
          <div style={{ padding: '12px' }}>
            {loadingOrgHierarchy ? (
              <div style={{ textAlign: 'center', padding: '24px' }}>
                <Loader2 className="animate-spin" size={28} style={{ color: '#6366f1', margin: '0 auto 8px' }} />
                <p style={{ color: '#64748b', fontSize: '13px' }}>Loading organization tree...</p>
              </div>
            ) : orgHierarchyData ? (
              <OrgChart hierarchyData={orgHierarchyData} />
            ) : (
              <div style={{ textAlign: 'center', padding: '24px', color: 'var(--gray-500)' }}>
                <Info size={22} style={{ marginBottom: '6px', opacity: 0.5 }} />
                <p>No hierarchy data available</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Redesigned Employees Table */}
      <div className="rm-table-card">
        <div className="rm-table-header">
          <h3 className="rm-table-title">All Employees</h3>
        </div>
        <div className="rm-table-wrapper">
          {loading ? (
            <div style={{ textAlign: 'center', padding: '28px' }}>
              <Loader2 className="animate-spin" size={28} style={{ color: '#6366f1', margin: '0 auto 8px' }} />
              <p style={{ color: '#64748b', fontSize: '13px' }}>Loading employees list...</p>
            </div>
          ) : filteredEmployees.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '28px' }}>
              <Users size={36} style={{ color: '#cbd5e1', marginBottom: '8px' }} />
              <p style={{ color: '#64748b', fontWeight: 500, fontSize: '13px' }}>No employees found matching the search criteria</p>
            </div>
          ) : (
            <table className="rm-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Employee ID</th>
                  <th>Department</th>
                  <th>Position</th>
                  <th>Reporting Manager</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.map((employee) => (
                  <tr key={employee.id || employee.employeeId}>
                    <td>
                      <div className="rm-emp-badge">
                        <img
                          src={`https://ui-avatars.com/api/?name=${employee.employeeName || (employee.firstName + ' ' + employee.lastName) || 'Employee'}&background=c7d2fe&color=3730a3&bold=true`}
                          className="rm-avatar"
                          alt=""
                        />
                        <div>
                          <div className="rm-emp-name" title={employee.employeeName || (employee.firstName + ' ' + employee.lastName) || 'N/A'}>
                            {employee.employeeName || (employee.firstName + ' ' + employee.lastName) || 'N/A'}
                          </div>
                          <div className="rm-emp-email" title={employee.email || ''}>
                            {employee.email || ''}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td style={{ fontWeight: 600, color: '#475569' }}>{employee.employeeId || 'N/A'}</td>
                    <td>{employee.department || employee.departmentName || 'N/A'}</td>
                    <td>{employee.position || employee.jobTitle || 'N/A'}</td>
                    <td>
                      {employee.managerName || employee.reportingManagerName ? (
                        <div className="rm-manager-badge">
                          <img
                            src={`https://ui-avatars.com/api/?name=${employee.managerName || employee.reportingManagerName}&background=f3e8ff&color=6b21a8&bold=true`}
                            className="rm-avatar"
                            alt=""
                            style={{ width: '20px', height: '20px' }}
                          />
                          <span>{employee.managerName || employee.reportingManagerName}</span>
                        </div>
                      ) : (
                        <span className="rm-no-manager">No manager assigned</span>
                      )}
                    </td>
                    <td>
                      <div className="rm-actions-cell">
                        {/* Redesigned action buttons with sleek colors & tooltips */}
                        <button
                          className="rm-btn-action hierarchy"
                          title="View Reporting Hierarchy Chain"
                          onClick={() => handleViewHierarchy(employee)}
                          disabled={processing}
                        >
                          <GitBranch size={14} />
                        </button>
                        
                        {employee.managerId || employee.reportingManagerId ? (
                          <button
                            className="rm-btn-action remove"
                            title="Remove Current Manager"
                            onClick={() =>
                              setRemoveTarget({
                                id: employee.id || employee.employeeId,
                                name:
                                  employee.employeeName ||
                                  (employee.firstName + ' ' + employee.lastName) ||
                                  employee.employeeId ||
                                  'Employee',
                              })
                            }
                            disabled={processing}
                          >
                            <UserMinus size={14} />
                          </button>
                        ) : null}

                        <button
                          className="rm-btn-action assign"
                          title={(employee.managerId || employee.reportingManagerId || employee.managerName || employee.reportingManagerName) ? "Change Reporting Manager" : "Assign Reporting Manager"}
                          onClick={() => handleAssignManager(employee)}
                          disabled={processing}
                        >
                          <UserPlus size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Assign Manager Modal */}
      {showAssignModal && selectedEmployee && (
        <div className="hr-modal-overlay" onClick={() => !processing && setShowAssignModal(false)}>
          <div className="hr-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="hr-modal-header">
              <h2>
                {(selectedEmployee.managerId || selectedEmployee.reportingManagerId || selectedEmployee.managerName || selectedEmployee.reportingManagerName) ? 'Change' : 'Assign'} Reporting Manager
              </h2>
              <button 
                className="hr-modal-close" 
                onClick={() => {
                  if (!processing) {
                    setShowAssignModal(false);
                    setErrorMessage('');
                    setSelectedManagerId('');
                  }
                }}
                disabled={processing}
              >
                ×
              </button>
            </div>
            <div className="hr-modal-body">
              <div style={{ marginBottom: '20px' }}>
                <p style={{ marginBottom: '8px', color: 'var(--gray-600)' }}>Employee:</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <img
                    src={`https://ui-avatars.com/api/?name=${selectedEmployee.employeeName || (selectedEmployee.firstName + ' ' + selectedEmployee.lastName) || 'Employee'}&background=6366f1&color=fff`}
                    className="employee-avatar"
                    alt=""
                  />
                  <div>
                    <div style={{ fontWeight: 500 }}>
                      {selectedEmployee.employeeName || (selectedEmployee.firstName + ' ' + selectedEmployee.lastName) || 'N/A'}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--gray-500)' }}>
                      {selectedEmployee.employeeId || 'N/A'} • {selectedEmployee.department || 'N/A'}
                    </div>
                  </div>
                </div>
              </div>

              {selectedEmployee.managerName && (
                <div style={{ marginBottom: '20px', padding: '12px', background: 'var(--gray-50)', borderRadius: '8px' }}>
                  <p style={{ marginBottom: '4px', fontSize: '12px', color: 'var(--gray-600)' }}>Current Manager:</p>
                  <p style={{ fontWeight: 500 }}>{selectedEmployee.managerName}</p>
                </div>
              )}

              {errorMessage && (
                <div style={{ 
                  marginBottom: '20px', 
                  padding: '12px', 
                  background: '#fef2f2', 
                  border: '1px solid #fecaca',
                  borderRadius: '8px',
                  color: '#b91c1c'
                }}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                    <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
                    <div style={{ flex: 1 }}>
                      <p style={{ fontWeight: 600, marginBottom: '4px' }}>Circular Reference Detected</p>
                      <p style={{ fontSize: '13px', lineHeight: '1.5' }}>{errorMessage}</p>
                      <div style={{ marginTop: '8px', padding: '8px', background: '#fff', borderRadius: '4px', fontSize: '12px' }}>
                        <p style={{ fontWeight: 500, marginBottom: '8px' }}>To fix this:</p>
                        <ol style={{ margin: '0 0 8px 0', paddingLeft: '20px' }}>
                          <li>View the reporting hierarchies below to see both chains</li>
                          <li>If the error says "chain too deep", there's likely an existing circular reference in the potential manager's chain</li>
                          <li>Remove the manager from one of the employees in the conflicting chain</li>
                          <li>Then try assigning the manager again</li>
                        </ol>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          <button
                            onClick={() => {
                              setShowAssignModal(false);
                              handleViewHierarchy(selectedEmployee);
                            }}
                            style={{
                              padding: '6px 12px',
                              background: 'var(--primary-500)',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              fontSize: '12px',
                              fontWeight: 500,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px'
                            }}
                          >
                            <GitBranch size={14} />
                            View {selectedEmployee.employeeName || selectedEmployee.employeeId}'s Chain
                          </button>
                          {selectedManagerForHierarchy && (
                            <button
                              onClick={() => {
                                setShowAssignModal(false);
                                handleViewHierarchy(selectedManagerForHierarchy);
                              }}
                              style={{
                                padding: '6px 12px',
                                background: 'var(--primary-600)',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                fontSize: '12px',
                                fontWeight: 500,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px'
                              }}
                            >
                              <GitBranch size={14} />
                              View {selectedManagerForHierarchy.employeeName || selectedManagerForHierarchy.employeeId || selectedManagerId}'s Chain
                            </button>
                          )}
                          {selectedManagerId && !selectedManagerForHierarchy && (
                            <button
                              onClick={async () => {
                                // Find the manager from potential managers
                                const manager = potentialManagers.find(m => m.id.toString() === selectedManagerId.toString());
                                if (manager) {
                                  setShowAssignModal(false);
                                  handleViewHierarchy(manager);
                                } else {
                                  // Try to fetch manager info using the ID
                                  try {
                                    const managerInfo = { id: selectedManagerId };
                                    setShowAssignModal(false);
                                    handleViewHierarchy(managerInfo);
                                  } catch (err) {
                                    toast.error('Could not load manager hierarchy');
                                  }
                                }
                              }}
                              style={{
                                padding: '6px 12px',
                                background: 'var(--primary-600)',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                fontSize: '12px',
                                fontWeight: 500,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px'
                              }}
                            >
                              <GitBranch size={14} />
                              View Selected Manager's Chain
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="hr-form-group">
                <label>Select New Manager</label>
                {loadingManagers ? (
                  <div style={{ textAlign: 'center', padding: '20px' }}>
                    <Loader2 className="animate-spin" size={20} />
                    <p style={{ marginTop: '8px', fontSize: '12px', color: 'var(--gray-500)' }}>Loading managers...</p>
                  </div>
                ) : potentialManagers.length === 0 ? (
                  <p style={{ padding: '20px', textAlign: 'center', color: 'var(--gray-500)' }}>
                    No potential managers available
                  </p>
                ) : (
                  <select
                    value={selectedManagerId}
                    onChange={(e) => setSelectedManagerId(e.target.value)}
                    disabled={processing}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--gray-200)',
                      fontSize: '14px'
                    }}
                  >
                    <option value="">Select a manager</option>
                    {potentialManagers.map((manager) => (
                      <option key={manager.id} value={manager.id}>
                        {manager.employeeName || (manager.firstName + ' ' + manager.lastName)} ({manager.employeeId})
                        {manager.department ? ` - ${manager.department}` : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
            <div className="hr-modal-footer">
              <button
                type="button"
                className="hr-btn-secondary"
                onClick={() => setShowAssignModal(false)}
                disabled={processing}
              >
                Cancel
              </button>
              <button
                type="button"
                className="hr-btn-primary"
                onClick={handleSaveManager}
                disabled={processing || !selectedManagerId}
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                {processing && <Loader2 className="animate-spin" size={16} />}
                {(selectedEmployee.managerId || selectedEmployee.reportingManagerId || selectedEmployee.managerName || selectedEmployee.reportingManagerName) ? 'Change Manager' : 'Assign Manager'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reporting Hierarchy Modal */}
      {showHierarchyModal && selectedEmployee && (
        <div className="hr-modal-overlay" onClick={() => setShowHierarchyModal(false)}>
          <div className="hr-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '900px' }}>
            <div className="hr-modal-header">
              <h2>Reporting Hierarchy</h2>
              <button 
                className="hr-modal-close" 
                onClick={() => setShowHierarchyModal(false)}
              >
                ×
              </button>
            </div>
            <div className="hr-modal-body" style={{ overflowY: 'auto' }}>
              <div style={{ marginBottom: '20px' }}>
                <p style={{ marginBottom: '8px', color: 'var(--gray-600)' }}>Employee:</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <img
                    src={`https://ui-avatars.com/api/?name=${selectedEmployee.employeeName || (selectedEmployee.firstName + ' ' + selectedEmployee.lastName) || 'Employee'}&background=6366f1&color=fff`}
                    className="employee-avatar"
                    alt=""
                  />
                  <div>
                    <div style={{ fontWeight: 500 }}>
                      {selectedEmployee.employeeName || (selectedEmployee.firstName + ' ' + selectedEmployee.lastName) || 'N/A'}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--gray-500)' }}>
                      {selectedEmployee.employeeId || 'N/A'}
                    </div>
                  </div>
                </div>
              </div>

              {loadingHierarchy ? (
                <div style={{ textAlign: 'center', padding: '40px' }}>
                  <Loader2 className="animate-spin" size={32} />
                  <p>Loading hierarchy...</p>
                </div>
              ) : hierarchyData?.type === 'employee' ? (
                <div>
                  <h3 style={{ marginBottom: '16px', fontSize: '14px', fontWeight: 600 }}>Reporting Chain:</h3>
                  <OrgChart hierarchyData={hierarchyData} />

                  {hierarchyData.managers?.length > 0 ? (
                        <div style={{
                          marginTop: '16px',
                          padding: '16px',
                          background: 'var(--gray-50)',
                          borderRadius: '8px',
                          border: '1px solid var(--gray-200)'
                        }}>
                          <p style={{ fontSize: '12px', fontWeight: 600, marginBottom: '12px', color: 'var(--gray-600)' }}>
                            Managers above this employee
                          </p>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {[...hierarchyData.managers].reverse().map((person, index) => {
                              const isCycleMarker = hasHierarchyCycle([person]);
                              return (
                                <div key={`${person.id || person.employeeId || index}`} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                  <div style={{
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: '50%',
                                    background: isCycleMarker ? '#dc2626' : 'var(--gray-300)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'white',
                                    fontWeight: 600,
                                    fontSize: '12px'
                                  }}>
                                    {index + 1}
                                  </div>
                                  <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 500, color: isCycleMarker ? '#dc2626' : 'inherit' }}>
                                      {person.employeeName || `${person.firstName || ''} ${person.lastName || ''}`.trim() || person.employeeId || 'N/A'}
                                    </div>
                                    <div style={{ fontSize: '11px', color: isCycleMarker ? '#dc2626' : 'var(--gray-500)' }}>
                                      {person.employeeId || ''} {person.department ? `• ${person.department}` : ''}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}

                  {hasHierarchyCycle(hierarchyData.managers) && (
                        <div style={{
                          marginTop: '16px',
                          padding: '12px',
                          background: '#fef2f2',
                          border: '1px solid #fecaca',
                          borderRadius: '8px',
                          fontSize: '12px',
                          color: '#b91c1c'
                        }}>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                            <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                            <div>
                              <p style={{ fontWeight: 600, marginBottom: '4px' }}>Circular reference detected</p>
                              <p>Break the cycle by removing a manager from one of the employees shown above before assigning a new manager.</p>
                            </div>
                          </div>
                        </div>
                      )}

                  {!hierarchyData.managers?.length && !hierarchyData.subordinates?.length && (
                    <div style={{ textAlign: 'center', padding: '20px', color: 'var(--gray-500)' }}>
                      <Info size={24} style={{ marginBottom: '8px', opacity: 0.5 }} />
                      <p>No reporting manager or direct reports</p>
                    </div>
                  )}
                </div>
              ) : Array.isArray(hierarchyData) && hierarchyData.length > 0 ? (
                <div>
                  <h3 style={{ marginBottom: '16px', fontSize: '14px', fontWeight: 600 }}>Reporting Chain:</h3>
                  <div style={{
                    padding: '16px',
                    background: 'var(--gray-50)',
                    borderRadius: '8px',
                    border: '1px solid var(--gray-200)'
                  }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingBottom: '12px', borderBottom: '1px solid var(--gray-200)' }}>
                        <div style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          background: 'var(--primary-500)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'white',
                          fontWeight: 600,
                          fontSize: '12px'
                        }}>
                          0
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600 }}>
                            {selectedEmployee.employeeName || (selectedEmployee.firstName + ' ' + selectedEmployee.lastName) || selectedEmployee.employeeId || 'N/A'}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--gray-500)' }}>
                            {selectedEmployee.employeeId || ''} {selectedEmployee.department ? `• ${selectedEmployee.department}` : ''}
                          </div>
                        </div>
                      </div>
                      {hierarchyData.map((person, index) => {
                        const isCycleMarker = hasHierarchyCycle([person]);
                        return (
                          <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '50%',
                              background: isCycleMarker ? '#dc2626' : 'var(--gray-300)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: 'white',
                              fontWeight: 600,
                              fontSize: '12px'
                            }}>
                              {index + 1}
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: 500, color: isCycleMarker ? '#dc2626' : 'inherit' }}>
                                {person.employeeName || (person.firstName + ' ' + person.lastName) || person.employeeId || 'N/A'}
                              </div>
                              <div style={{ fontSize: '11px', color: isCycleMarker ? '#dc2626' : 'var(--gray-500)' }}>
                                {person.employeeId || ''} {person.department ? `• ${person.department}` : ''}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--gray-500)' }}>
                  <Info size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
                  <p>Unable to load reporting hierarchy</p>
                </div>
              )}
            </div>
            <div className="hr-modal-footer">
              <button
                type="button"
                className="hr-btn-primary"
                onClick={() => setShowHierarchyModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remove Manager confirmation modal */}
      {removeTarget && (
        <div className="hr-modal-overlay" onClick={() => setRemoveTarget(null)}>
          <div
            className="hr-modal"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '360px',
              padding: '14px 16px',
              borderRadius: '10px',
            }}
          >
            <div className="hr-modal-header">
              <h2 style={{ fontSize: '15px', fontWeight: 600 }}>Remove Reporting Manager</h2>
              <button
                className="hr-modal-close"
                onClick={() => setRemoveTarget(null)}
                disabled={processing}
              >
                ×
              </button>
            </div>
            <div className="hr-modal-body">
              <p style={{ fontSize: '13px', color: 'var(--gray-600)', marginBottom: '6px' }}>
                Are you sure you want to remove the reporting manager for{' '}
                <strong>{removeTarget.name}</strong>?
              </p>
              <p style={{ fontSize: '11px', color: 'var(--gray-500)' }}>
                This employee will no longer have a manager assigned until you set a new one.
              </p>
            </div>
            <div
              className="hr-modal-footer"
              style={{ paddingTop: 10, paddingBottom: 4, gap: 8 }}
            >
              <button
                type="button"
                className="hr-btn-secondary"
                onClick={() => setRemoveTarget(null)}
                disabled={processing}
              >
                Cancel
              </button>
              <button
                type="button"
                className="hr-btn-primary"
                onClick={async () => {
                  if (!removeTarget) return;
                  await handleRemoveManager(removeTarget.id);
                  setRemoveTarget(null);
                }}
                disabled={processing}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', paddingInline: 14 }}
              >
                {processing && <Loader2 className="animate-spin" size={16} />}
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

