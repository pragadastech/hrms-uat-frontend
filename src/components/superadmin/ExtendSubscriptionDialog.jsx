import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, CalendarPlus } from 'lucide-react';

const QUICK_DAYS = [7, 30, 90, 365];

function formatDate(value) {
  if (!value) return 'Not set';
  return new Date(value).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default function ExtendSubscriptionDialog({
  open,
  tenant,
  saving = false,
  onClose,
  onSubmit,
}) {
  const [days, setDays] = useState('30');
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (!open) return;
    setDays('30');
    setFormError('');
  }, [open, tenant]);

  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (e) => {
      if (e.key === 'Escape' && !saving) onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, saving, onClose]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const additionalDays = parseInt(days, 10);
    if (Number.isNaN(additionalDays) || additionalDays <= 0) {
      setFormError('Enter a valid number of days greater than 0.');
      return;
    }
    if (additionalDays > 3650) {
      setFormError('Maximum extension is 3650 days (10 years).');
      return;
    }
    try {
      await onSubmit(additionalDays);
    } catch (err) {
      const message =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        err?.message ||
        'Failed to extend subscription';
      setFormError(message);
    }
  };

  if (!open || !tenant || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="hr-modal-overlay extend-sub-dialog-overlay"
      onClick={() => !saving && onClose()}
      role="presentation"
    >
      <div
        className="hr-modal extend-sub-dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="extend-sub-dialog-title"
      >
        <div className="hr-modal-header">
          <div>
            <h2 id="extend-sub-dialog-title">Extend subscription</h2>
            <p className="extend-sub-dialog-subtitle">{tenant.name}</p>
          </div>
          <button
            type="button"
            className="hr-modal-close"
            onClick={onClose}
            disabled={saving}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="hr-modal-body extend-sub-dialog-body">
            {formError && (
              <div className="extend-sub-dialog-error">
                <AlertCircle size={16} aria-hidden="true" />
                <span>{formError}</span>
              </div>
            )}

            <div className="extend-sub-summary">
              <div className="extend-sub-summary-row">
                <span>Current plan</span>
                <strong>{tenant.currentPlanName || 'Standard'}</strong>
              </div>
              <div className="extend-sub-summary-row">
                <span>Status</span>
                <strong>{tenant.subscriptionStatus || 'N/A'}</strong>
              </div>
              <div className="extend-sub-summary-row">
                <span>Expires</span>
                <strong>{tenant.planEndDate ? formatDate(tenant.planEndDate) : 'LIFETIME'}</strong>
              </div>
            </div>

            <div className="hr-form-group">
              <label htmlFor="extendDays">Additional days *</label>
              <input
                id="extendDays"
                type="number"
                min="1"
                max="3650"
                value={days}
                onChange={(e) => {
                  setDays(e.target.value);
                  if (formError) setFormError('');
                }}
                placeholder="e.g. 30"
                disabled={saving}
                required
                autoFocus
              />
            </div>

            <div className="extend-sub-quick">
              <span className="extend-sub-quick-label">Quick select</span>
              <div className="extend-sub-quick-btns">
                {QUICK_DAYS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    className={`extend-sub-quick-btn${String(days) === String(d) ? ' active' : ''}`}
                    onClick={() => {
                      setDays(String(d));
                      if (formError) setFormError('');
                    }}
                    disabled={saving}
                  >
                    {d} days
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="hr-modal-footer">
            <button type="button" className="hr-btn-secondary" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="hr-btn-primary" disabled={saving}>
              <CalendarPlus size={16} style={{ marginRight: 6, verticalAlign: 'middle' }} />
              {saving ? 'Extending...' : 'Extend subscription'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
