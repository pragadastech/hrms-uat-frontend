import React, { useState, useEffect } from 'react';
import {
    FileText, Download, CheckCircle, AlertCircle, Clock,
    Calendar, RefreshCw, DollarSign
} from 'lucide-react';
import { generatedPayslipAPI } from '../services/api';
import Header from '../components/Header';

export default function EmployeePayslips() {
    const [payslips, setPayslips] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchPayslips();
    }, []);

    const fetchPayslips = async () => {
        setLoading(true);
        try {
            const res = await generatedPayslipAPI.getMyPayslips();
            setPayslips(Array.isArray(res.data) ? res.data : []);
        } catch (e) {
            console.error("Failed to fetch payslips", e);
        } finally {
            setLoading(false);
        }
    };

    const handleDownload = async (id, fileName) => {
        try {
            const res = await generatedPayslipAPI.downloadMyPayslip(id);
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', fileName || 'payslip.pdf');
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (e) {
            alert('Download failed');
        }
    };

    const getPeriod = (slip) => {
        if (!slip.payslipMonth || !slip.payslipYear) return 'N/A';
        return `${new Date(0, slip.payslipMonth - 1).toLocaleString('default', { month: 'long' })} ${slip.payslipYear}`;
    };

    return (
        <div className="main-content">
            <Header title="My Payslips" subtitle="View and download your monthly salary slips" />

            <div className="page-content">
                <div className="flex justify-between items-center mb-6">
                    <div className="text-gray-500 text-sm font-medium">
                        Showing {payslips.length} payslips
                    </div>
                    <button className="btn btn-secondary" onClick={fetchPayslips} title="Refresh">
                        <RefreshCw size={16} /> Refresh
                    </button>
                </div>

                <div className="grid grid-cols-1 gap-4">
                    {payslips.map(slip => (
                        <div key={slip.id} className="card p-5 hover:border-indigo-200 group">
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                <div className="flex gap-4">
                                    <div className="w-12 h-12 rounded-lg bg-green-50 text-green-600 flex items-center justify-center shrink-0 group-hover:bg-green-600 group-hover:text-white transition-colors">
                                        <DollarSign size={24} />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-gray-900 text-lg mb-1">{getPeriod(slip)}</h3>
                                        <div className="flex items-center gap-3 text-sm text-gray-500">
                                            <span className="flex items-center gap-1"><Calendar size={14} /> {new Date(slip.paymentDate).toLocaleDateString()}</span>
                                            <span>•</span>
                                            <span className="font-medium text-gray-900">Net Pay: ₹{slip.netSalary?.toLocaleString('en-IN')}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 border-gray-100 pt-4 md:pt-0">
                                    {slip.status === 'GENERATED' ? (
                                        <span className="badge badge-success"><CheckCircle size={12} /> Paid</span>
                                    ) : (
                                        <span className="badge badge-warning"><Clock size={12} /> Processing</span>
                                    )}

                                    <button
                                        onClick={() => handleDownload(slip.id, slip.generatedFileName)}
                                        className="btn btn-secondary text-sm"
                                    >
                                        <Download size={16} /> Download
                                    </button>
                                </div>
                            </div>

                            <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-3 gap-4 text-xs text-gray-400">
                                <div>
                                    <div className="uppercase tracking-wider mb-1 font-semibold">Basic</div>
                                    <div className="font-medium text-gray-700 text-sm">₹{slip.basicSalary?.toLocaleString('en-IN')}</div>
                                </div>
                                <div>
                                    <div className="uppercase tracking-wider mb-1 font-semibold">Allowances</div>
                                    <div className="font-medium text-green-600 text-sm">+₹{slip.allowances?.toLocaleString('en-IN')}</div>
                                </div>
                                <div>
                                    <div className="uppercase tracking-wider mb-1 font-semibold">Deductions</div>
                                    <div className="font-medium text-red-600 text-sm">-₹{slip.deductions?.toLocaleString('en-IN')}</div>
                                </div>
                            </div>
                        </div>
                    ))}

                    {payslips.length === 0 && !loading && (
                        <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-300">
                            <FileText size={48} className="mx-auto text-gray-300 mb-4" />
                            <h3 className="text-lg font-medium text-gray-900">No payslips found</h3>
                            <p className="text-gray-500">Your payslip history will appear here.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
