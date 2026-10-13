import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Search, Plus, SlidersHorizontal, Eye, Pencil, Trash2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { adminAPI, employeeAPI } from '../services/api';
import Header from '../components/Header';

export default function DepartmentDetails() {
    const { departmentName } = useParams();
    const navigate = useNavigate();
    const { hasAdminAccess } = useAuth();
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');

    // Decode department name from URL
    const decodedDeptName = decodeURIComponent(departmentName || '');

    const normalizeEmployeeList = (response) => {
            const data = response?.data ?? response;
            if (Array.isArray(data)) return data;
            if (data?.data && Array.isArray(data.data)) return data.data;
            if (data?.employees && Array.isArray(data.employees)) return data.employees;
            return [];
        };

    const fetchEmployees = async () => {
        try {
            setLoading(true);
            setError(null);
            const response = hasAdminAccess()
                ? await adminAPI.getEmployeesByDepartment(decodedDeptName)
                : await employeeAPI.getDepartmentEmployees(decodedDeptName);
            setEmployees(normalizeEmployeeList(response));
        } catch (err) {
            console.error('Error fetching department employees:', err);
            if (hasAdminAccess()) {
                try {
                    const allRes = await adminAPI.getAllEmployees();
                    const allData = allRes.data?.employees || allRes.data?.data || allRes.data || [];
                    if (Array.isArray(allData)) {
                        setEmployees(allData.filter(emp => (emp.departmentName || emp.department) === decodedDeptName));
                    }
                } catch (fallbackErr) {
                    setError('Failed to load employees');
                }
            } else {
                setError('Unable to load employee list for this department.');
                setEmployees([]);
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (decodedDeptName) {
            fetchEmployees();
        }
    }, [decodedDeptName]);


    const filteredEmployees = employees.filter(employee =>
        (employee.firstName + ' ' + employee.lastName).toLowerCase().includes(searchTerm.toLowerCase()) ||
        employee.employeeId?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getEmployeeName = (employee) => {
        return `${employee.firstName || ''} ${employee.lastName || ''}`.trim() || 'N/A';
    };

    const getEmployeeAvatar = (employee) => {
        return employee.profilePicture || `https://ui-avatars.com/api/?name=${encodeURIComponent(getEmployeeName(employee))}&background=6366f1&color=fff`;
    };

    // Helpers for new columns
    const getWorkType = (employee) => {
        // Logic to determine Office vs Remote. 
        // If officeLocation includes 'Remote' or is empty/null -> 'Remote' (just guessing logic or defaulting)
        // Actually normally it's explicit. Let's assume 'Office' unless specified.
        const loc = employee.officeLocation || '';
        if (loc.toLowerCase().includes('remote')) return 'Remote';
        return 'Office';
    };

    const getEmploymentStatus = (employee) => {
        // Logic for Permanent vs Contract
        // Using employeeType field
        return employee.employeeType || 'Permanent';
    };


    return (
        <div className="main-content">
            <Header
                title={decodedDeptName}
                subtitle={`All Departments > ${decodedDeptName}`}
            />

            <div className="page-content">
                <div className="search-filter-row">
                    <div className="page-search">
                        <Search size={14} style={{ color: '#808080' }} />
                        <input
                            type="text"
                            placeholder="Search..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <div className="action-buttons">
                        <button
                            className="add-employee-btn"
                            onClick={() => navigate('/admin/employees/add')}
                        >
                            <Plus size={14} />
                            <span>Add New Employee</span>
                        </button>
                        <button className="filter-btn">
                            <SlidersHorizontal size={14} />
                            <span>Filter</span>
                        </button>
                    </div>
                </div>

                <div className="employee-table-container">
                    <table className="employee-table">
                        <thead>
                            <tr>
                                <th>Employee ID</th>
                                <th>Employee Name</th>
                                <th>Designation</th>
                                <th>Type</th>
                                <th>Status</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan="6" style={{ textAlign: 'center', padding: '20px' }}>Loading...</td></tr>
                            ) : filteredEmployees.length === 0 ? (
                                <tr><td colSpan="6" style={{ textAlign: 'center', padding: '20px', color: '#888' }}>No employees found in this department</td></tr>
                            ) : (
                                filteredEmployees.map((employee) => (
                                    <tr
                                        key={employee.id}
                                        onClick={() => navigate(`/admin/employees/${employee.id}`)}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        <td>{employee.employeeId || 'N/A'}</td>
                                        <td>
                                            <div className="employee-cell">
                                                <img
                                                    src={getEmployeeAvatar(employee)}
                                                    alt={getEmployeeName(employee)}
                                                    className="employee-avatar"
                                                />
                                                <span>{getEmployeeName(employee)}</span>
                                            </div>
                                        </td>
                                        <td>{employee.position?.name || employee.designation || 'N/A'}</td>
                                        <td>{getWorkType(employee)}</td>
                                        <td>
                                            <span style={{
                                                padding: '4px 12px',
                                                borderRadius: '4px',
                                                fontSize: '11px',
                                                color: '#6366f1',
                                                backgroundColor: '#EEF2FF',
                                                fontWeight: 500
                                            }}>
                                                {getEmploymentStatus(employee)}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="action-icons">
                                                <span className="action-icon" onClick={() => navigate(`/employees/${employee.id}`)}>
                                                    <Eye size={16} />
                                                </span>
                                                <span className="action-icon" onClick={() => navigate(`/employees/${employee.id}`)}>
                                                    <Pencil size={16} />
                                                </span>
                                                {/* Delete - purely visual for now or implement if needed */}
                                                <span className="action-icon">
                                                    <Trash2 size={16} />
                                                </span>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>

                    <div className="pagination">
                        <div className="pagination-info">
                            <span>Showing {filteredEmployees.length} records</span>
                        </div>
                        {/* Simplified pagination for visual match */}
                        <div className="pagination-pages">
                            <button className="pagination-btn active">1</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
