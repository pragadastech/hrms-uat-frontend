import React, { useState, useEffect } from 'react';
import {
    FileText, Upload, Download, Trash2, Plus, RefreshCw,
    CheckCircle, AlertCircle, Clock, Search, File, Loader
} from 'lucide-react';
import { payslipTemplateAPI, generatedPayslipAPI, adminAPI } from '../services/api';
import Header from '../components/Header';
import DynamicPayslipGenerator from './DynamicPayslipGenerator';

export default function AdminPayslipManagement() {
    const [activeTab, setActiveTab] = useState('templates'); // templates, payslips
    const [loading, setLoading] = useState(false);
    const [templates, setTemplates] = useState([]);
    const [payslips, setPayslips] = useState([]);

    // States for Generating Payslips Tab
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

    // Upload Modal State
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [uploadData, setUploadData] = useState({ name: '', description: '', file: null });
    const [uploading, setUploading] = useState(false);

    // Dynamic Generator State
    const [showGenerator, setShowGenerator] = useState(false);

    useEffect(() => {
        fetchData();
    }, [activeTab, selectedMonth, selectedYear]);

    const fetchData = async () => {
        setLoading(true);
        try {
            if (activeTab === 'templates') {
                const res = await payslipTemplateAPI.getAllTemplates();
                setTemplates(Array.isArray(res.data) ? res.data : []);
            } else {
                const res = await generatedPayslipAPI.getAllPayslips(selectedMonth, selectedYear);
                setPayslips(Array.isArray(res.data) ? res.data : []);
            }
        } catch (e) {
            console.error("Failed to fetch data", e);
        } finally {
            setLoading(false);
        }
    };

    const handleUpload = async (e) => {
        e.preventDefault();
        if (!uploadData.file || !uploadData.name) {
            alert("Please provide name and file");
            return;
        }

        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('name', uploadData.name);
            formData.append('description', uploadData.description);
            formData.append('file', uploadData.file);

            await payslipTemplateAPI.uploadTemplate(formData);
            setShowUploadModal(false);
            setUploadData({ name: '', description: '', file: null });
            fetchData();
        } catch (e) {
            alert('Upload failed: ' + (e.response?.data?.message || e.message));
        } finally {
            setUploading(false);
        }
    };

    const handleDeleteTemplate = async (id) => {
        if (window.confirm('Delete this template?')) {
            try {
                await payslipTemplateAPI.deleteTemplate(id);
                fetchData();
            } catch (e) { alert('Delete failed'); }
        }
    };

    const handleDeletePayslip = async (id) => {
        if (window.confirm('Delete this payslip?')) {
            try {
                await generatedPayslipAPI.deletePayslip(id);
                fetchData();
            } catch (e) { alert('Delete failed'); }
        }
    };

    const handleDownload = async (id, fileName, type) => {
        try {
            const api = type === 'template' ? payslipTemplateAPI.downloadTemplate : generatedPayslipAPI.downloadPayslip;
            const res = await api(id);
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', fileName || 'download.pdf');
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (e) {
            alert('Download failed');
        }
    };

    return (
        <div className="main-content">
            <Header title="Payslip Management" subtitle="Manage templates and generate employee payslips" />

            <div className="page-content">
                {/* Navigation Tabs */}
                <div className="flex gap-1 mb-6 border-b border-gray-200">
                    <button
                        className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${activeTab === 'templates' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                        onClick={() => setActiveTab('templates')}
                    >
                        Templates
                    </button>
                    <button
                        className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${activeTab === 'payslips' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                        onClick={() => setActiveTab('payslips')}
                    >
                        Generated Payslips
                    </button>
                </div>

                {/* Templates Tab */}
                {activeTab === 'templates' && (
                    <div>
                        <div className="flex justify-between items-center mb-6">
                            <div className="text-gray-500 text-sm">{templates.length} templates available</div>
                            <button className="add-employee-btn" onClick={() => setShowUploadModal(true)}>
                                <Upload size={18} /> Upload Template
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {templates.map(tpl => (
                                <div key={tpl.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:shadow-md transition-shadow">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="p-3 bg-red-50 text-red-600 rounded-lg">
                                            <FileText size={24} />
                                        </div>
                                        <div className={`badge ${tpl.active ? 'badge-active' : 'badge-inactive'}`}>
                                            {tpl.active ? 'Active' : 'Inactive'}
                                        </div>
                                    </div>
                                    <h3 className="font-bold text-gray-900 mb-1">{tpl.name}</h3>
                                    <p className="text-sm text-gray-500 mb-4 h-10 line-clamp-2">{tpl.description || 'No description'}</p>

                                    <div className="flex justify-between items-center text-xs text-gray-400 border-t border-gray-100 pt-4">
                                        <div>{(tpl.fileSize / 1024).toFixed(1)} KB • {new Date(tpl.createdAt).toLocaleDateString()}</div>
                                        <div className="flex gap-2">
                                            <button onClick={() => handleDownload(tpl.id, tpl.fileName, 'template')} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded" title="Download">
                                                <Download size={16} />
                                            </button>
                                            <button onClick={() => handleDeleteTemplate(tpl.id)} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded hover:text-red-500" title="Delete">
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Payslips Tab */}
                {activeTab === 'payslips' && (
                    <div>
                        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-6 flex flex-wrap gap-4 items-center justify-between">
                            <div className="flex gap-4">
                                <select
                                    className="form-input"
                                    value={selectedMonth}
                                    onChange={(e) => setSelectedMonth(Number(e.target.value))}
                                >
                                    {Array.from({ length: 12 }, (_, i) => (
                                        <option key={i + 1} value={i + 1}>{new Date(0, i).toLocaleString('default', { month: 'long' })}</option>
                                    ))}
                                </select>
                                <select
                                    className="form-input"
                                    value={selectedYear}
                                    onChange={(e) => setSelectedYear(Number(e.target.value))}
                                >
                                    {[0, 1, 2, 3, 4].map(i => {
                                        const y = new Date().getFullYear() - i;
                                        return <option key={y} value={y}>{y}</option>;
                                    })}
                                </select>
                                <button className="icon-btn" onClick={fetchData} title="Refresh">
                                    <RefreshCw size={18} />
                                </button>
                            </div>
                            <button className="add-employee-btn" onClick={() => setShowGenerator(true)}>
                                <Plus size={18} /> Generate New Payslip
                            </button>
                        </div>

                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-200">
                                    <tr>
                                        <th className="px-4 py-3">Employee</th>
                                        <th className="px-4 py-3">Period</th>
                                        <th className="px-4 py-3">Net Salary</th>
                                        <th className="px-4 py-3">Status</th>
                                        <th className="px-4 py-3 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {payslips.map(slip => (
                                        <tr key={slip.id} className="hover:bg-gray-50">
                                            <td className="px-4 py-3">
                                                <div className="font-medium text-gray-900">{slip.employeeName}</div>
                                                <div className="text-xs text-gray-500">{slip.employeeIdString}</div>
                                            </td>
                                            <td className="px-4 py-3">
                                                {new Date(0, slip.month - 1).toLocaleString('default', { month: 'long' })} {slip.year}
                                            </td>
                                            <td className="px-4 py-3 font-medium text-gray-900">
                                                ₹{slip.netSalary?.toLocaleString('en-IN') || 0}
                                            </td>
                                            <td className="px-4 py-3">
                                                {slip.status === 'GENERATED' ? (
                                                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-100 text-green-700 text-xs font-medium"><CheckCircle size={10} /> Generated</span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-medium"><Clock size={10} /> Pending</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <div className="flex justify-end gap-2">
                                                    <button onClick={() => handleDownload(slip.id, slip.generatedFileName, 'payslip')} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"><Download size={16} /></button>
                                                    <button onClick={() => handleDeletePayslip(slip.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded"><Trash2 size={16} /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {payslips.length === 0 && (
                                        <tr>
                                            <td colSpan="5" className="px-4 py-8 text-center text-gray-500">
                                                No payslips generated for this period.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {/* Upload Modal */}
            {showUploadModal && (
                <div className="modal-overlay fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl w-full max-w-md p-6">
                        <h3 className="text-xl font-bold mb-4">Upload Template</h3>
                        <form onSubmit={handleUpload} className="space-y-4">
                            <input
                                className="form-input w-full"
                                placeholder="Template Name"
                                required
                                value={uploadData.name}
                                onChange={e => setUploadData({ ...uploadData, name: e.target.value })}
                            />
                            <textarea
                                className="form-input w-full"
                                placeholder="Description"
                                rows={3}
                                value={uploadData.description}
                                onChange={e => setUploadData({ ...uploadData, description: e.target.value })}
                            />
                            <input
                                type="file"
                                className="form-input w-full"
                                accept=".pdf"
                                required
                                onChange={e => setUploadData({ ...uploadData, file: e.target.files[0] })}
                            />
                            <div className="flex justify-end gap-3 pt-2">
                                <button type="button" onClick={() => setShowUploadModal(false)} className="px-4 py-2 border rounded">Cancel</button>
                                <button type="submit" className="add-employee-btn" disabled={uploading}>{uploading ? 'Uploading...' : 'Upload'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Dynamic Generator Modal */}
            <DynamicPayslipGenerator
                open={showGenerator}
                onClose={() => setShowGenerator(false)}
                onSuccess={() => {
                    fetchData();
                    alert("Payslip generated successfully!");
                }}
            />
        </div>
    );
}
