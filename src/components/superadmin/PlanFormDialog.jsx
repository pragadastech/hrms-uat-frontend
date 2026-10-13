import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle } from 'lucide-react';

export const COMMON_MODULES = [
  'ACHIEVEMENTS', 'ASSETS', 'ATTENDANCE', 'COMPLAINTS', 'DOCUMENTS',
  'EMPLOYEE_MANAGEMENT', 'EXPENSES', 'EXTRA_HOURS', 'GAMES', 'HOLIDAYS',
  'LEAVE_MANAGEMENT', 'NOTICES', 'ORGANIZATION', 'PAYROLL',
  'PMS', 'PROJECT_MANAGEMENT', 'QUIZ', 'REPORTS', 'SETTINGS',
  'TIMESHEETS', 'TIME_CLOCK', 'WFH', 'WORK_STATUS', 'WORKFLOWS',
];

const emptyForm = {
  planId: '',
  name: '',
  price: '',
  durationDays: '',
  maxEmployees: '',
  modules: '',
  isTrial: false,
  isActive: true,
  description: '',
};

function planToForm(plan) {
  if (!plan) return { ...emptyForm };
  return {
    planId: plan.planId || '',
    name: plan.name || '',
    price: plan.price != null ? String(plan.price) : '',
    durationDays: plan.durationDays != null ? String(plan.durationDays) : '',
    maxEmployees: plan.maxEmployees != null ? String(plan.maxEmployees) : '',
    modules: (plan.modules || []).join(', '),
    isTrial: !!plan.isTrial,
    isActive: plan.isActive !== false,
    description: plan.description || '',
  };
}

export default function PlanFormDialog({
  open,
  plan,
  extraModules = [],
  saving = false,
  onClose,
  onSubmit,
}) {
  const isEdit = !!plan;
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (!open) return;
    setForm(planToForm(plan));
    setFormError('');
  }, [open, plan]);

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

  const moduleOptions = useMemo(() => {
    const set = new Set(COMMON_MODULES);
    extraModules.forEach((m) => { if (m) set.add(m); });
    (plan?.modules || []).forEach((m) => { if (m) set.add(m); });
    return Array.from(set).sort();
  }, [extraModules, plan]);

  const selectedModules = useMemo(
    () => (form.modules ? form.modules.split(',').map((m) => m.trim()).filter(Boolean) : []),
    [form.modules],
  );

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
    if (formError) setFormError('');
  };

  const toggleModule = (moduleName) => {
    const current = selectedModules;
    const updated = current.includes(moduleName)
      ? current.filter((item) => item !== moduleName)
      : [...current, moduleName];
    setForm((prev) => ({ ...prev, modules: updated.join(', ') }));
    if (formError) setFormError('');
  };

  const buildPayload = () => ({
    planId: form.planId.trim() || undefined,
    name: form.name.trim(),
    price: form.price ? Number(form.price) : 0,
    durationDays: form.durationDays ? Number(form.durationDays) : null,
    maxEmployees: form.maxEmployees ? Number(form.maxEmployees) : null,
    modules: selectedModules,
    isTrial: !!form.isTrial,
    isActive: !!form.isActive,
    description: form.description.trim(),
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.planId.trim() && !isEdit) {
      setFormError('Plan ID is required.');
      return;
    }
    if (!form.name.trim()) {
      setFormError('Plan name is required.');
      return;
    }
    if (!form.maxEmployees || Number(form.maxEmployees) <= 0) {
      setFormError('Max employees must be greater than 0.');
      return;
    }
    if (!form.durationDays || Number(form.durationDays) <= 0) {
      setFormError('Duration must be greater than 0 days.');
      return;
    }

    try {
      await onSubmit(buildPayload());
    } catch (err) {
      const message =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        err?.message ||
        'Failed to save plan';
      setFormError(message);
    }
  };

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="hr-modal-overlay plan-form-dialog-overlay"
      onClick={() => !saving && onClose()}
      role="presentation"
    >
      <div
        className="hr-modal plan-form-dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="plan-form-dialog-title"
      >
        <div className="hr-modal-header">
          <div>
            <h2 id="plan-form-dialog-title">{isEdit ? 'Edit Plan' : 'Create Plan'}</h2>
            {isEdit && (
              <p className="plan-form-dialog-subtitle">ID: {form.planId}</p>
            )}
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
          <div className="hr-modal-body plan-form-dialog-body">
            {formError && (
              <div className="plan-form-dialog-error">
                <AlertCircle size={16} aria-hidden="true" />
                <span>{formError}</span>
              </div>
            )}

            <div className="plan-form-section">
              <h3>Plan details</h3>
              <div className="hr-form-row">
                <div className="hr-form-group">
                  <label htmlFor="planId">Plan ID *</label>
                  <input
                    id="planId"
                    type="text"
                    name="planId"
                    value={form.planId}
                    onChange={handleChange}
                    placeholder="e.g. PLAN_PRO"
                    disabled={isEdit || saving}
                    required={!isEdit}
                  />
                </div>
                <div className="hr-form-group">
                  <label htmlFor="planName">Plan name *</label>
                  <input
                    id="planName"
                    type="text"
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    placeholder="e.g. Pro Plan"
                    disabled={saving}
                    required
                  />
                </div>
              </div>
            </div>

            <div className="plan-form-section">
              <h3>Pricing & limits</h3>
              <div className="hr-form-row plan-form-row-3">
                <div className="hr-form-group">
                  <label htmlFor="planPrice">Price (₹)</label>
                  <input
                    id="planPrice"
                    type="number"
                    name="price"
                    value={form.price}
                    onChange={handleChange}
                    min="0"
                    step="0.01"
                    placeholder="0"
                    disabled={saving}
                  />
                </div>
                <div className="hr-form-group">
                  <label htmlFor="planDuration">Duration (days) *</label>
                  <input
                    id="planDuration"
                    type="number"
                    name="durationDays"
                    value={form.durationDays}
                    onChange={handleChange}
                    min="1"
                    placeholder="30"
                    disabled={saving}
                    required
                  />
                </div>
                <div className="hr-form-group">
                  <label htmlFor="planMaxEmployees">Max employees *</label>
                  <input
                    id="planMaxEmployees"
                    type="number"
                    name="maxEmployees"
                    value={form.maxEmployees}
                    onChange={handleChange}
                    min="1"
                    placeholder="50"
                    disabled={saving}
                    required
                  />
                </div>
              </div>
            </div>

            <div className="plan-form-section">
              <h3>Modules ({selectedModules.length})</h3>
              <div className="plan-module-grid" role="group" aria-label="Select modules">
                {moduleOptions.map((moduleName) => {
                  const isSelected = selectedModules.includes(moduleName);
                  return (
                    <button
                      key={moduleName}
                      type="button"
                      className={`plan-module-chip${isSelected ? ' selected' : ''}`}
                      onClick={() => toggleModule(moduleName)}
                      disabled={saving}
                      aria-pressed={isSelected}
                    >
                      {moduleName.replace(/_/g, ' ')}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="plan-form-section">
              <h3>Description</h3>
              <div className="hr-form-group">
                <textarea
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  placeholder="Brief description of this plan..."
                  rows={3}
                  disabled={saving}
                />
              </div>
            </div>

            <div className="plan-form-toggles">
              <label className="plan-form-toggle">
                <input
                  type="checkbox"
                  name="isTrial"
                  checked={form.isTrial}
                  onChange={handleChange}
                  disabled={saving}
                />
                <span>Trial plan</span>
              </label>
              <label className="plan-form-toggle">
                <input
                  type="checkbox"
                  name="isActive"
                  checked={form.isActive}
                  onChange={handleChange}
                  disabled={saving}
                />
                <span>Active</span>
              </label>
            </div>
          </div>

          <div className="hr-modal-footer">
            <button
              type="button"
              className="hr-btn-secondary"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button type="submit" className="hr-btn-primary" disabled={saving}>
              {saving ? 'Saving...' : isEdit ? 'Save changes' : 'Create plan'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
