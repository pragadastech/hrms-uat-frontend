import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { emailActionAPI } from '../services/api';
import { CheckCircle2, XCircle, AlertCircle, Clock, ArrowRight, Loader2, Send } from 'lucide-react';
import './EmailAction.css';

export default function EmailAction() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const action = (searchParams.get('action') || '').toLowerCase();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [requestDetails, setRequestDetails] = useState(null);
  const [status, setStatus] = useState('PROCESSING'); // 'PROCESSING' | 'SUCCESS' | 'ERROR' | 'ALREADY_PROCESSED'
  const [message, setMessage] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [submittingReject, setSubmittingReject] = useState(false);

  useEffect(() => {
    if (!token) {
      setStatus('ERROR');
      setMessage('Invalid link: No authentication token was found in the URL.');
      setLoading(false);
      return;
    }

    const processAction = async () => {
      try {
        setLoading(true);

        // Fetch request details if available
        try {
          const detailsRes = await emailActionAPI.getStatus(token);
          if (detailsRes?.data) {
            setRequestDetails(detailsRes.data);
          }
        } catch (_) {
          // If status endpoint returns error or is not found, continue with action processing
        }

        // Check if action requires input (reject)
        if (action === 'reject') {
          // Prompt user on this page for rejection reason instead of blindly failing
          setLoading(false);
          return;
        }

        let response;
        if (action === 'approve') {
          // Check if it's manager approve vs final admin approve
          try {
            response = await emailActionAPI.managerApprove(token);
          } catch (mgrErr) {
            // Fallback to standard approve
            response = await emailActionAPI.approve(token);
          }
        } else if (action === 'direct-to-hr' || action === 'direct_to_hr') {
          response = await emailActionAPI.directToHr(token);
        } else {
          setStatus('ERROR');
          setMessage(`Unknown action: "${action}". Supported actions are approve, reject, or direct-to-hr.`);
          setLoading(false);
          return;
        }

        const data = response?.data || {};
        if (data.status === 'ALREADY_PROCESSED') {
          setStatus('ALREADY_PROCESSED');
          setMessage(data.message || 'This leave request has already been processed.');
        } else if (data.status === 'FAILED') {
          setStatus('ERROR');
          setMessage(data.message || 'Could not process this leave request.');
        } else {
          setStatus('SUCCESS');
          setMessage(data.message || (
            action === 'direct-to-hr'
              ? 'Leave request successfully forwarded to HR for final review.'
              : 'Leave request approved successfully.'
          ));
        }
      } catch (err) {
        const errorMsg = err.response?.data?.error || err.response?.data?.message || err.message || 'An error occurred while processing the request.';
        if (errorMsg.toLowerCase().includes('already been') || errorMsg.toLowerCase().includes('already processed')) {
          setStatus('ALREADY_PROCESSED');
        } else {
          setStatus('ERROR');
        }
        setMessage(errorMsg);
      } finally {
        setLoading(false);
      }
    };

    processAction();
  }, [token, action]);

  const handleConfirmReject = async (e) => {
    e.preventDefault();
    if (!token) return;

    setSubmittingReject(true);
    try {
      let response;
      try {
        response = await emailActionAPI.managerReject(token, rejectionReason);
      } catch (mgrErr) {
        response = await emailActionAPI.reject(token, rejectionReason);
      }

      const data = response?.data || {};
      if (data.status === 'ALREADY_PROCESSED') {
        setStatus('ALREADY_PROCESSED');
        setMessage(data.message || 'This leave request has already been processed.');
      } else {
        setStatus('SUCCESS');
        setMessage(data.message || 'Leave request was successfully rejected and the employee has been notified.');
      }
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to reject the request.';
      if (errorMsg.toLowerCase().includes('already been') || errorMsg.toLowerCase().includes('already processed')) {
        setStatus('ALREADY_PROCESSED');
      } else {
        setStatus('ERROR');
      }
      setMessage(errorMsg);
    } finally {
      setSubmittingReject(false);
    }
  };

  const getActionTitle = () => {
    switch (action) {
      case 'direct-to-hr':
      case 'direct_to_hr':
        return 'Direct to HR';
      case 'approve':
        return 'Approve Leave Request';
      case 'reject':
        return 'Reject Leave Request';
      default:
        return 'Leave Request Action';
    }
  };

  return (
    <div className="email-action-wrapper">
      <div className="email-action-card">
        {/* Brand Header */}
        <div className="email-action-brand">
          <span className="email-action-brand-dot"></span>
          <span className="email-action-brand-name">PRAGVA HRMS</span>
        </div>

        <h1 className="email-action-title">{getActionTitle()}</h1>

        {loading ? (
          <div className="email-action-loading">
            <Loader2 className="spinner" size={36} />
            <p>Processing your request safely, please wait...</p>
          </div>
        ) : action === 'reject' && status === 'PROCESSING' ? (
          /* Rejection reason form */
          <form onSubmit={handleConfirmReject} className="email-action-form">
            {requestDetails && (
              <div className="email-action-summary">
                <div className="summary-row">
                  <span className="summary-label">Employee:</span>
                  <span className="summary-value">{requestDetails.employeeName}</span>
                </div>
                <div className="summary-row">
                  <span className="summary-label">Leave Type:</span>
                  <span className="summary-value">{requestDetails.leaveType}</span>
                </div>
                <div className="summary-row">
                  <span className="summary-label">Duration:</span>
                  <span className="summary-value">
                    {requestDetails.startDate} to {requestDetails.endDate} ({requestDetails.totalDays} days)
                  </span>
                </div>
                {requestDetails.reason && (
                  <div className="summary-row">
                    <span className="summary-label">Reason:</span>
                    <span className="summary-value">{requestDetails.reason}</span>
                  </div>
                )}
              </div>
            )}

            <div className="email-action-field">
              <label htmlFor="rejectionReason">Reason for Rejection (Optional)</label>
              <textarea
                id="rejectionReason"
                rows={3}
                placeholder="Enter feedback or explanation for the employee..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
              />
            </div>

            <div className="email-action-buttons">
              <button
                type="submit"
                disabled={submittingReject}
                className="btn-action-reject"
              >
                {submittingReject ? (
                  <>
                    <Loader2 className="spinner" size={16} />
                    Rejecting...
                  </>
                ) : (
                  <>
                    <XCircle size={16} />
                    Confirm Rejection
                  </>
                )}
              </button>
            </div>
          </form>
        ) : (
          /* Status result display */
          <div className="email-action-result">
            {status === 'SUCCESS' && (
              <div className="status-badge success">
                <div className="icon-wrap success-icon">
                  <CheckCircle2 size={44} />
                </div>
                <h2>Action Completed</h2>
                <p className="status-message">{message}</p>
              </div>
            )}

            {status === 'ALREADY_PROCESSED' && (
              <div className="status-badge warning">
                <div className="icon-wrap warning-icon">
                  <Clock size={44} />
                </div>
                <h2>Already Processed</h2>
                <p className="status-message">{message}</p>
              </div>
            )}

            {status === 'ERROR' && (
              <div className="status-badge error">
                <div className="icon-wrap error-icon">
                  <AlertCircle size={44} />
                </div>
                <h2>Unable to Process</h2>
                <p className="status-message">{message}</p>
              </div>
            )}

            {requestDetails && (
              <div className="email-action-summary mt-4">
                <div className="summary-row">
                  <span className="summary-label">Employee:</span>
                  <span className="summary-value">{requestDetails.employeeName}</span>
                </div>
                <div className="summary-row">
                  <span className="summary-label">Leave Type:</span>
                  <span className="summary-value">{requestDetails.leaveType}</span>
                </div>
                <div className="summary-row">
                  <span className="summary-label">Dates:</span>
                  <span className="summary-value">{requestDetails.startDate} to {requestDetails.endDate}</span>
                </div>
              </div>
            )}

            <div className="email-action-footer">
              <button
                type="button"
                className="btn-portal-redirect"
                onClick={() => navigate('/login')}
              >
                Go to Portal Login
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
