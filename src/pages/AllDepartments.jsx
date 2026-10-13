import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ChevronRight, Loader2, Users } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { adminAPI, employeeAPI } from '../services/api';
import Header from '../components/Header';

export default function AllDepartments() {
  const navigate = useNavigate();
  const { hasAdminAccess } = useAuth();
  const [departments, setDepartments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Normalize departments from API response
  const normalizeDepartments = (response) => {
    if (response?.data?.departments && Array.isArray(response.data.departments)) return response.data.departments;
    if (response?.data && Array.isArray(response.data)) return response.data;
    if (response?.data?.data && Array.isArray(response.data.data)) return response.data.data;
    return [];
  };

  // Fetch departments (admin: full list; employee: read-only list via /api/employee/departments)
  const fetchDepartments = async () => {
    try {
      const response = hasAdminAccess()
        ? await adminAPI.getAllDepartments()
        : await employeeAPI.getDepartments();
      setDepartments(normalizeDepartments(response));
    } catch (err) {
      console.error('Error fetching departments:', err);
      if (!hasAdminAccess()) setError('Unable to load departments. You may not have access.');
    }
  };

  // Fetch employees from API
  const fetchEmployees = async () => {
    try {
      console.log('Fetching employees for departments...');
      const response = await adminAPI.getAllEmployees();
      console.log('Employees API response for departments:', response);

      // Check if response has data (direct array or wrapped)
      if (response.data?.employees && Array.isArray(response.data.employees)) {
        console.log('Setting employees from response.data.employees:', response.data.employees.length);
        setEmployees(response.data.employees);
      } else if (response.data && Array.isArray(response.data)) {
        console.log('Setting employees from direct array:', response.data.length);
        setEmployees(response.data);
      } else if (response.data?.data && Array.isArray(response.data.data)) {
        console.log('Setting employees from wrapped array:', response.data.data.length);
        setEmployees(response.data.data);
      } else {
        console.error('Unexpected employees response format for departments:', response.data);
        setEmployees([]);
      }
    } catch (err) {
      console.error('Error fetching employees for departments:', err);
      setEmployees([]);
    }
  };

  // Load data on component mount (departments for all; employees list only for admin)
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        if (hasAdminAccess()) {
          await Promise.all([fetchDepartments(), fetchEmployees()]);
        } else {
          await fetchDepartments();
        }
      } catch (err) {
        setError('Failed to load departments data');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [hasAdminAccess]);

  // Get employees for a department
  const getEmployeesForDepartment = (departmentName) => {
    console.log(`Getting employees for department: "${departmentName}"`);
    console.log('Available employees:', employees.length);
    console.log('Employee department names:', employees.map(emp => emp.departmentName));

    const filtered = employees.filter(employee => employee.departmentName === departmentName);
    console.log(`Found ${filtered.length} employees for department "${departmentName}"`);

    return filtered;
  };

  // Filter departments based on search term
  const filteredDepartments = departments.filter(dept =>
    dept.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Get employee full name
  const getEmployeeName = (employee) => {
    return `${employee.firstName || ''} ${employee.lastName || ''}`.trim() || 'N/A';
  };

  // Get employee avatar (fallback to default)
  const getEmployeeAvatar = (employee) => {
    return employee.profilePicture || `https://ui-avatars.com/api/?name=${encodeURIComponent(getEmployeeName(employee))}&background=6366f1&color=fff`;
  };

  if (loading) {
    return (
      <div className="main-content">
        <Header title="All Departments" subtitle="All Departments Information" />
        <div className="page-content">
          <div className="loading-container">
            <Loader2 className="animate-spin" size={32} />
            <p>Loading departments...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="main-content">
        <Header title="All Departments" subtitle="All Departments Information" />
        <div className="page-content">
          <div className="error-container">
            <p>Error: {error}</p>
            <button onClick={() => window.location.reload()} className="retry-btn">
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="main-content">
      <Header title="All Departments" subtitle="All Departments Information" />

      <div className="page-content">
        <div className="departments-search">
          <div className="page-search">
            <Search size={14} style={{ color: '#808080' }} />
            <input
              type="text"
              placeholder="Search departments..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="departments-grid">
          {filteredDepartments.map((dept) => {
            console.log('Processing department:', dept.name, dept);
            const departmentEmployees = getEmployeesForDepartment(dept.name);

            return (
              <div key={dept.id} className="department-card">
                <div className="department-card-header">
                  <div>
                    <h3 className="department-name">{dept.name}</h3>
                    <span className="department-count">
                      <Users size={14} style={{ marginRight: '4px' }} />
                      {departmentEmployees.length} {departmentEmployees.length === 1 ? 'Member' : 'Members'}
                    </span>
                  </div>
                  <span
                    className="view-all-link"
                    style={{ cursor: 'pointer' }}
                    onClick={() => navigate(hasAdminAccess() ? `/admin/departments/${encodeURIComponent(dept.name)}` : `/employee/departments/${encodeURIComponent(dept.name)}`)}
                  >
                    View All
                  </span>
                </div>

                <div className="department-members">
                  {departmentEmployees.length > 0 ? (
                    departmentEmployees.slice(0, 5).map((employee) => (
                      <div
                        key={employee.id}
                        className="department-member"
                        onClick={() => navigate(`/admin/employees/${employee.id}`)}
                        style={{ cursor: 'pointer' }}
                      >
                        <div className="member-info">
                          <img
                            src={getEmployeeAvatar(employee)}
                            alt={getEmployeeName(employee)}
                            className="member-avatar"
                            onError={(e) => {
                              e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(getEmployeeName(employee))}&background=6366f1&color=fff`;
                            }}
                          />
                          <div className="member-details">
                            <span className="member-name">{getEmployeeName(employee)}</span>
                            <span className="member-role">{employee.position?.name || 'Employee'}</span>
                          </div>
                        </div>
                        <ChevronRight size={14} className="member-arrow" />
                      </div>
                    ))
                  ) : (
                    <div className="no-members">
                      <p>No employees in this department</p>
                    </div>
                  )}

                  {departmentEmployees.length > 5 && (
                    <div className="more-members">
                      <span>+{departmentEmployees.length - 5} more members</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {filteredDepartments.length === 0 && (
          <div className="no-data">
            <p>No departments found matching your search.</p>
          </div>
        )}
      </div>
    </div>
  );
}
