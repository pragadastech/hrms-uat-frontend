import { useEffect, useMemo, useState } from 'react';
import {
  Layers, Plus, ToggleLeft, ToggleRight, Trash2,
  AlertCircle, Users, Layout,
  TrendingUp, Zap, Pencil, MousePointer2, ShieldCheck,
} from 'lucide-react';
import SuperAdminPageShell from '../components/superadmin/SuperAdminPageShell';
import PlanFormDialog from '../components/superadmin/PlanFormDialog';
import { superAdminAPI } from '../services/api';
import './SuperAdminPlans.css';

export default function SuperAdminPlans() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingPlan, setEditingPlan] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const loadPlans = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      setError(null);
      const res = await superAdminAPI.getPlans();
      const data = res.data || res;
      const list = Array.isArray(data) ? data : [];
      list.sort((a, b) => (a.planId || '').localeCompare(b.planId || ''));
      setPlans(list);
    } catch (e) {
      console.error('Failed to load plans', e);
      setError('Failed to load subscription plans');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadPlans();
  }, []);

  const stats = useMemo(() => ({
    total: plans.length,
    active: plans.filter((p) => p.isActive).length,
    trial: plans.filter((p) => p.isTrial).length,
  }), [plans]);

  const extraModules = useMemo(() => {
    const modules = new Set();
    plans.forEach((p) => {
      (p.modules || []).forEach((m) => { if (m) modules.add(m); });
    });
    return Array.from(modules);
  }, [plans]);

  const handleSave = async (payload) => {
    setSaving(true);
    try {
      if (editingPlan) {
        await superAdminAPI.updatePlan(editingPlan.planId, payload);
      } else {
        await superAdminAPI.createPlan(payload);
      }
      await loadPlans(true);
      setEditingPlan(null);
      setShowForm(false);
    } catch (err) {
      console.error('Failed to save plan', err);
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (plan) => {
    if (!window.confirm(`Delete plan "${plan.name}"?`)) return;
    try {
      await superAdminAPI.deletePlan(plan.planId);
      await loadPlans(true);
    } catch (err) {
      console.error('Failed to delete plan', err);
      alert(err?.response?.data?.error || err?.response?.data?.message || 'Failed to delete plan');
    }
  };

  const handleToggleStatus = async (plan) => {
    try {
      await superAdminAPI.togglePlanStatus(plan.planId);
      await loadPlans(true);
    } catch (err) {
      console.error('Failed to toggle plan status', err);
      alert('Failed to toggle plan status');
    }
  };

  return (
    <SuperAdminPageShell
      className="plans-page"
      title="Plans"
      subtitle="Manage subscription plans and modules"
      loading={loading && plans.length === 0}
      loadingText="Loading plans..."
    >
      <div className="plans-container">
        <div className="sa-stats-row sa-stats-row--3">
          <div className="sa-stat-tile">
            <div className="sa-stat-tile__icon"><Layers size={20} /></div>
            <div>
              <div className="sa-stat-tile__value">{stats.total}</div>
              <div className="sa-stat-tile__label">Total Plans</div>
            </div>
          </div>
          <div className="sa-stat-tile sa-stat-tile--emerald">
            <div className="sa-stat-tile__icon"><TrendingUp size={20} /></div>
            <div>
              <div className="sa-stat-tile__value">{stats.active}</div>
              <div className="sa-stat-tile__label">Active Plans</div>
            </div>
          </div>
          <div className="sa-stat-tile sa-stat-tile--amber">
            <div className="sa-stat-tile__icon"><Zap size={20} /></div>
            <div>
              <div className="sa-stat-tile__value">{stats.trial}</div>
              <div className="sa-stat-tile__label">Trial Plans</div>
            </div>
          </div>
        </div>

        <div className="sa-toolbar plans-toolbar">
          <div>
            <h2 className="plans-section-title">Subscription plans</h2>
            <p className="plans-section-desc">Configure pricing, limits, and module access</p>
          </div>
          <button type="button" onClick={() => { setEditingPlan(null); setShowForm(true); }} className="sa-btn-primary">
            <Plus size={18} strokeWidth={2.5} />
            Create plan
          </button>
        </div>

        {error && (
          <div className="sa-portal-error card" style={{ marginBottom: 16 }}>
            <AlertCircle size={20} style={{ marginBottom: 8 }} />
            <p>{error}</p>
          </div>
        )}

        <div className="plans-grid">
          {plans.map((plan) => (
            <article
              key={plan.planId}
              className={`plan-card ${!plan.isActive ? 'plan-card--inactive' : ''}`}
            >
              <div className={`plan-card__accent ${plan.isTrial ? 'plan-card__accent--trial' : ''}`} />

              <div className="plan-card__body">
                <div className="plan-card__badges">
                  <span className={`sa-badge ${plan.isActive ? 'sa-badge--success' : 'sa-badge--muted'}`}>
                    {plan.isActive ? 'Live' : 'Inactive'}
                  </span>
                  {plan.isTrial && <span className="sa-badge sa-badge--warning">Trial</span>}
                </div>

                <h3 className="plan-card__name">{plan.name}</h3>
                <code className="plan-card__id">{plan.planId}</code>

                <p className="plan-card__desc">
                  {plan.description || 'Comprehensive plan features for scaling teams.'}
                </p>

                <div className="plan-card__pricing">
                  <div className="plan-card__price">
                    ₹{Number(plan.price).toLocaleString('en-IN')}
                    <span>/ {plan.durationDays} days</span>
                  </div>
                  <div className="plan-card__specs">
                    <span><Users size={13} /> {plan.maxEmployees || '∞'} seats</span>
                    <span><ShieldCheck size={13} /> Verified</span>
                  </div>
                </div>

                <div className="plan-card__modules">
                  <div className="plan-card__modules-label">
                    <Layout size={12} />
                    {(plan.modules || []).length} modules
                  </div>
                  <div className="plan-card__module-tags">
                    {(plan.modules || []).slice(0, 8).map((mod) => (
                      <span key={mod} className="plan-module-tag">{mod.replace(/_/g, ' ')}</span>
                    ))}
                    {(plan.modules || []).length > 8 && (
                      <span className="plan-module-tag plan-module-tag--more">
                        +{(plan.modules || []).length - 8}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <footer className="plan-card__footer">
                <button type="button" onClick={() => { setEditingPlan(plan); setShowForm(true); }} className="plan-card__action plan-card__action--edit" title="Edit">
                  <Pencil size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleStatus(plan)}
                  className={`plan-card__action ${plan.isActive ? 'plan-card__action--active' : ''}`}
                  title={plan.isActive ? 'Deactivate' : 'Activate'}
                >
                  {plan.isActive ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                </button>
                <button type="button" onClick={() => handleDelete(plan)} className="plan-card__action plan-card__action--delete" title="Delete">
                  <Trash2 size={16} />
                </button>
              </footer>
            </article>
          ))}

          {!loading && plans.length === 0 && (
            <div className="plans-empty">
              <MousePointer2 size={36} />
              <h3>No plans yet</h3>
              <p>Create your first subscription plan to get started.</p>
              <button type="button" onClick={() => { setEditingPlan(null); setShowForm(true); }} className="sa-btn-primary">
                <Plus size={18} />
                Create plan
              </button>
            </div>
          )}
        </div>
      </div>

      <PlanFormDialog
        open={showForm}
        plan={editingPlan}
        extraModules={extraModules}
        saving={saving}
        onClose={() => { if (!saving) { setEditingPlan(null); setShowForm(false); } }}
        onSubmit={handleSave}
      />
    </SuperAdminPageShell>
  );
}
