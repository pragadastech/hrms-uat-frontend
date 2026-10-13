import React, { useState, useEffect } from 'react';
import {
    X, Save, FileText, User, Calculator, AlertCircle, CheckCircle, Loader
} from 'lucide-react';
import { payslipTemplateAPI, generatedPayslipAPI, adminAPI } from '../services/api';

const DynamicPayslipGenerator = ({ open, onClose, onSuccess }) => {
    const [templates, setTemplates] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [selectedTemplate, setSelectedTemplate] = useState('');
    const [selectedEmployee, setSelectedEmployee] = useState('');
    const [selectedEmployeeData, setSelectedEmployeeData] = useState(null);
    const [formFields, setFormFields] = useState([]);
    const [formValues, setFormValues] = useState({});
    const [loading, setLoading] = useState(false);
    const [loadingFields, setLoadingFields] = useState(false);
    const [error, setError] = useState('');
    const [remarks, setRemarks] = useState('');
    const [currentMonth, setCurrentMonth] = useState('');
    const [currentYear, setCurrentYear] = useState('');

    // Salary Calculations State
    const [salaryCalculations, setSalaryCalculations] = useState({
        grossSalary: 0,
        netSalary: 0,
        basicSalary: 0,
        totalAllowances: 0,
        totalDeductions: 0
    });

    useEffect(() => {
        if (open) {
            loadTemplates();
            loadEmployees();
            const now = new Date();
            setCurrentMonth(now.toLocaleString('en-IN', { month: 'long', timeZone: 'Asia/Calcutta' }));
            setCurrentYear(now.getFullYear().toString());
        }
    }, [open]);

    useEffect(() => {
        if (selectedTemplate) {
            loadFormFields(selectedTemplate);
        } else {
            setFormFields([]);
            setFormValues({});
        }
    }, [selectedTemplate]);

    useEffect(() => {
        if (selectedEmployeeData && formFields.length > 0) {
            handleEmployeeChange(selectedEmployee);
        }
    }, [formFields, selectedEmployee]);

    const loadTemplates = async () => {
        try {
            const response = await payslipTemplateAPI.getAllTemplates();
            setTemplates(response.data.filter(template => template.active));
        } catch (error) {
            console.error('Error loading templates:', error);
            setError('Failed to load templates');
        }
    };

    const loadEmployees = async () => {
        try {
            const response = await adminAPI.getAllEmployees();
            setEmployees(Array.isArray(response.data) ? response.data : response.data.employees || []);
        } catch (error) {
            console.error('Error loading employees:', error);
            setError('Failed to load employees');
        }
    };

    const loadFormFields = async (templateId) => {
        setLoadingFields(true);
        setError('');
        try {
            const response = await payslipTemplateAPI.getTemplateFormFields(templateId);
            setFormFields(response.data);

            const initialValues = {};
            response.data.forEach(field => {
                initialValues[field.fieldName] = field.defaultValue || '';
            });
            setFormValues(initialValues);
        } catch (error) {
            setError('Failed to load form fields from template');
        } finally {
            setLoadingFields(false);
        }
    };

    const handleEmployeeChange = (employeeId) => {
        setSelectedEmployee(employeeId);

        if (employeeId) {
            const employee = employees.find(emp => emp.id === parseInt(employeeId));
            setSelectedEmployeeData(employee);

            if (employee && formFields.length > 0) {
                const updatedValues = { ...formValues };

                // Helper to find field by keywords
                const findField = (keywords) => formFields.find(field =>
                    keywords.some(k => field.fieldName.toLowerCase().includes(k))
                );

                // Auto-populate logic
                const employeeCodeField = findField(['employee code', 'employee_code', 'emp code']);
                if (employeeCodeField) updatedValues[employeeCodeField.fieldName] = employee.employeeId;

                const nameField = findField(['employee name', 'employee_name', 'name']);
                if (nameField) updatedValues[nameField.fieldName] = `${employee.firstName} ${employee.lastName}`;

                const panField = findField(['pan', 'pan_card']);
                if (panField && employee.panNumber) updatedValues[panField.fieldName] = employee.panNumber;

                const roleField = findField(['role', 'designation', 'position']);
                if (roleField && employee.role) updatedValues[roleField.fieldName] = employee.role;

                const dateFields = ['dateOfHiring', 'dateOfJoining', 'joiningDate', 'hireDate'];
                const empDate = dateFields.reduce((acc, key) => acc || employee[key], null);

                const hireDateField = findField(['hire date', 'joining date', 'doj', 'date of join']);
                if (hireDateField && empDate) {
                    updatedValues[hireDateField.fieldName] = new Date(empDate).toLocaleDateString('en-IN', {
                        day: '2-digit', month: '2-digit', year: 'numeric'
                    });
                }

                const monthField = findField(['payslip month', 'period', 'month']);
                if (monthField && !monthField.fieldName.toLowerCase().includes('net')) {
                    updatedValues[monthField.fieldName] = `PAYSLIP FOR ${currentMonth.toUpperCase()} ${currentYear}`;
                }

                setFormValues(updatedValues);
            }
        } else {
            setSelectedEmployeeData(null);
        }
    };

    const calculateSalaryComponents = (basicSalary, allowances = 0, hra = 0, da = 0, bonuses = 0) => {
        const basic = parseFloat(basicSalary) || 0;
        const allow = parseFloat(allowances) || 0;
        const hraVal = parseFloat(hra) || 0;
        const daVal = parseFloat(da) || 0;
        const bonusVal = parseFloat(bonuses) || 0;

        const totalAllowances = allow + hraVal + daVal + bonusVal;
        const grossSalary = basic + totalAllowances;

        // PF (12% of Basic)
        const pf = Math.round((basic * 0.12) * 100) / 100;

        // Professional Tax (Simplified Slab)
        let pt = 0;
        if (grossSalary > 15000) pt = 200;
        else if (grossSalary > 10000) pt = 150;

        // ESI (1.75% of Gross if <= 21000)
        const esi = grossSalary <= 21000 ? Math.round((grossSalary * 0.0175) * 100) / 100 : 0;

        const totalDeductions = pf + pt + esi;
        const netSalary = grossSalary - totalDeductions;

        return {
            pf, pt, esi, totalAllowances, totalDeductions, grossSalary, netSalary
        };
    };

    const handleFormValueChange = (fieldName, value) => {
        setFormValues(prev => ({ ...prev, [fieldName]: value }));

        // Attempt auto-calculation if salary fields change
        // This is a simplified version of the reference logic
        const getVal = (keywords) => {
            const field = formFields.find(f => keywords.some(k => f.fieldName.toLowerCase().includes(k)));
            if (!field) return 0;
            return field.fieldName === fieldName ? parseFloat(value) : parseFloat(formValues[field.fieldName] || 0);
        };

        const basic = getVal(['basic']);
        const allow = getVal(['allowance', 'spl']);
        const hra = getVal(['hra', 'rent']);
        const da = getVal(['da', 'dearness']);
        const bonus = getVal(['bonus', 'incentive']);

        if (basic > 0) {
            const calcs = calculateSalaryComponents(basic, allow, hra, da, bonus);
            setSalaryCalculations(calcs);

            // Auto-fill calculated fields
            const updated = { ...formValues, [fieldName]: value };

            const setField = (keywords, val) => {
                const f = formFields.find(f => keywords.some(k => f.fieldName.toLowerCase().includes(k)));
                if (f) updated[f.fieldName] = val.toString();
            };

            setField(['net salary', 'net_salary', 'take home', 'net pay'], calcs.netSalary);
            setField(['gross salary', 'gross_salary', 'total earning'], calcs.grossSalary);
            setField(['pf', 'provident'], calcs.pf);
            setField(['pt', 'professional tax'], calcs.pt);
            setField(['esi'], calcs.esi);

            setFormValues(updated);
        }
    };

    const handleGenerate = async () => {
        if (!selectedTemplate || !selectedEmployee) {
            setError('Please select both template and employee');
            return;
        }

        setLoading(true);
        try {
            const requestData = {
                employeeId: parseInt(selectedEmployee),
                templateId: parseInt(selectedTemplate),
                formFieldValues: formValues,
                remarks: remarks
            };

            const response = await generatedPayslipAPI.generatePayslipDynamic(requestData);
            onSuccess(response.data);
            handleClose();
        } catch (error) {
            setError(error.response?.data?.message || 'Failed to generate payslip');
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        setSelectedTemplate('');
        setSelectedEmployee('');
        setSelectedEmployeeData(null);
        setFormFields([]);
        setFormValues({});
        setError('');
        setRemarks('');
        onClose();
    };

    if (!open) return null;

    return (
        <div className="modal-overlay fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col relative">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <div>
                        <h3 className="text-xl font-bold text-gray-900">Generate Dynamic Payslip</h3>
                        <p className="text-sm text-gray-500">Auto-fill PDF templates with employee data</p>
                    </div>
                    <button onClick={handleClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                    {error && (
                        <div className="bg-red-50 text-red-700 p-3 rounded-lg mb-4 flex items-center gap-2 text-sm">
                            <AlertCircle size={16} /> {error}
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Select Template</label>
                            <select
                                className="form-input w-full"
                                value={selectedTemplate}
                                onChange={(e) => setSelectedTemplate(e.target.value)}
                            >
                                <option value="">Choose Template...</option>
                                {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Select Employee</label>
                            <select
                                className="form-input w-full"
                                value={selectedEmployee}
                                onChange={(e) => handleEmployeeChange(e.target.value)}
                            >
                                <option value="">Choose Employee...</option>
                                {employees.map(e => <option key={e.id} value={e.id}>{e.firstName} {e.lastName} ({e.employeeId})</option>)}
                            </select>
                        </div>
                    </div>

                    {selectedEmployeeData && (
                        <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-4 mb-6 flex gap-6 text-sm">
                            <div><span className="text-indigo-900 font-semibold">ID:</span> <span className="text-indigo-700">{selectedEmployeeData.employeeId}</span></div>
                            <div><span className="text-indigo-900 font-semibold">Name:</span> <span className="text-indigo-700">{selectedEmployeeData.firstName} {selectedEmployeeData.lastName}</span></div>
                            <div><span className="text-indigo-900 font-semibold">Role:</span> <span className="text-indigo-700">{selectedEmployeeData.role}</span></div>
                        </div>
                    )}

                    {loadingFields ? (
                        <div className="py-12 flex justify-center text-gray-400">
                            <Loader className="animate-spin" size={32} />
                        </div>
                    ) : formFields.length > 0 ? (
                        <div className="space-y-6">
                            <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
                                <FileText size={18} className="text-gray-400" />
                                <h4 className="font-bold text-gray-800">Template Fields</h4>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {formFields.map(field => (
                                    <div key={field.fieldName}>
                                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 truncate" title={field.displayName || field.fieldName}>
                                            {field.displayName || field.fieldName}
                                            {field.required && <span className="text-red-500">*</span>}
                                        </label>
                                        {field.fieldType === 'choice' ? (
                                            <select
                                                className="form-input w-full text-sm"
                                                value={formValues[field.fieldName] || ''}
                                                onChange={(e) => handleFormValueChange(field.fieldName, e.target.value)}
                                            >
                                                <option value="">Select...</option>
                                                <option value="Yes">Yes</option>
                                                <option value="No">No</option>
                                                <option value="Male">Male</option>
                                                <option value="Female">Female</option>
                                            </select>
                                        ) : (
                                            <input
                                                type="text"
                                                className={`form-input w-full text-sm ${field.fieldName.toLowerCase().includes('net') ? 'font-bold text-green-700 bg-green-50 border-green-200' : ''}`}
                                                value={formValues[field.fieldName] || ''}
                                                onChange={(e) => handleFormValueChange(field.fieldName, e.target.value)}
                                                placeholder={field.defaultValue || ''}
                                            />
                                        )}
                                    </div>
                                ))}
                            </div>

                            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                                <label className="block text-sm font-medium text-gray-700 mb-2">Remarks (Optional)</label>
                                <textarea
                                    className="form-input w-full text-sm"
                                    rows={2}
                                    value={remarks}
                                    onChange={e => setRemarks(e.target.value)}
                                    placeholder="Add any internal notes..."
                                />
                            </div>
                        </div>
                    ) : selectedTemplate && (
                        <div className="text-center py-12 text-gray-400">
                            No fields detected in this template.
                        </div>
                    )}
                </div>

                <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
                    <button onClick={handleClose} className="px-5 py-2.5 border rounded-lg hover:bg-white transition-colors font-medium">Cancel</button>
                    <button
                        onClick={handleGenerate}
                        disabled={loading || !selectedTemplate || !selectedEmployee}
                        className="add-employee-btn"
                    >
                        {loading ? 'Generating...' : 'Generate Payslip'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DynamicPayslipGenerator;
