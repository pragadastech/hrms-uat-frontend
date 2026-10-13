import { useEffect, useState, useMemo, useCallback } from 'react';
import {
  Building2, Search, ToggleLeft, ToggleRight, Trash2,
  Clock4, RotateCcw, ChevronLeft, ChevronRight,
  TrendingUp, Activity, BarChart,
} from 'lucide-react';
import SuperAdminPageShell from '../components/superadmin/SuperAdminPageShell';
import ExtendSubscriptionDialog from '../components/superadmin/ExtendSubscriptionDialog';
import { superAdminAPI } from '../services/api';
import './SuperAdminTenants.css';

const avatarColors = [
  'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
  'linear-gradient(135deg, #10b981 0%, #3b82f6 100%)',
  'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)',
  'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)',
  'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)'
];

export default function SuperAdminTenants() {
  const [pageData, setPageData] = useState(null);
  const [dashboardStats, setDashboardStats] = useState(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(0);
  const [size] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTenantMetrics, setSelectedTenantMetrics] = useState(null);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [extendTenant, setExtendTenant] = useState(null);
  const [extending, setExtending] = useState(false);

  const loadTenants = useCallback(async (pageIndex = 0, showTableLoader = false) => {
    try {
      if (showTableLoader) setTableLoading(true);
      else setInitialLoading(true);
      setError(null);

      const tenantsRes = await superAdminAPI.getTenants(pageIndex, size);
      const data = tenantsRes.data || tenantsRes;
      setPageData(data);
      setPage(data.number ?? pageIndex);
    } catch (e) {
      console.error('Failed to load tenants', e);
      setError('Failed to load tenants. Please try again.');
    } finally {
      setInitialLoading(false);
      setTableLoading(false);
    }
  }, [size]);

  const loadStats = useCallback(async () => {
    try {
      const statsRes = await superAdminAPI.getDashboard();
      setDashboardStats(statsRes.data || statsRes);
    } catch (e) {
      console.warn('Failed to load tenant stats', e);
    }
  }, []);

  useEffect(() => {
    loadTenants(0);
    loadStats();
  }, [loadTenants, loadStats]);

  const tenants = useMemo(() => {
    if (!pageData) return [];
    const content = pageData.content || pageData;
    if (!Array.isArray(content)) return [];
    if (!searchTerm.trim()) return content;
    const term = searchTerm.toLowerCase();
    return content.filter((t) =>
      (t.name || '').toLowerCase().includes(term) ||
      (t.primaryDomain || '').toLowerCase().includes(term) ||
      (t.industry || '').toLowerCase().includes(term) ||
      (t.contactEmail || '').toLowerCase().includes(term)
    );
  }, [pageData, searchTerm]);

  const totalPages = pageData?.totalPages ?? 1;
  const handleToggleActive = async (tenant) => {
    try {
      await superAdminAPI.updateTenantStatus(tenant.id, !tenant.active);
      await loadTenants(page, true);    } catch (e) {
      console.error('Failed to update tenant status', e);
    }
  };

  const handleSuspend = async (tenant) => {
    if (!window.confirm(`Suspend tenant "${tenant.name}"? This will restrict all platform access.`)) return;
    try {
      await superAdminAPI.suspendTenant(tenant.id);
      await loadTenants(page, true);
    } catch (e) {
      console.error('Failed to suspend tenant', e);
    }
  };

  const handleDelete = async (tenant) => {
    if (!window.confirm(`PERMANENT DELETION: Are you sure you want to erase "${tenant.name}" and all associated data structures?`)) return;
    try {
      await superAdminAPI.deleteTenant(tenant.id);
      await loadTenants(0, true);
      loadStats();
    } catch (e) {
      console.error('Failed to delete tenant', e);
    }
  };

  const handleViewMetrics = async (tenant) => {
    try {
      setMetricsLoading(true);
      setSelectedTenantMetrics({ tenant, metrics: null });
      const res = await superAdminAPI.getTenantMetrics(tenant.id);
      setSelectedTenantMetrics({
        tenant,
        metrics: res.data || res,
      });
      setTimeout(() => {
        document.getElementById('tenant-metrics-panel')?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (e) {
      console.error('Failed to load tenant metrics', e);
    } finally {
      setMetricsLoading(false);
    }
  };

  const handleExtendSubmit = async (additionalDays) => {
    if (!extendTenant) return;
    setExtending(true);
    try {
      await superAdminAPI.extendSubscription(extendTenant.id, additionalDays);
      await loadTenants(page, true);
      setExtendTenant(null);
    } catch (e) {
      console.error('Failed to extend subscription', e);
      throw e;
    } finally {
      setExtending(false);
    }
  };

  const formatDate = (value) => {
    if (!value) return 'N/A';
    return new Date(value).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const getAvatarColor = (id) => {
    if (!id) return avatarColors[0];
    const index = String(id).charCodeAt(0) % avatarColors.length;
    return avatarColors[index];
  };

  const renderStatsBar = () => {
    const s = dashboardStats || {};
    return (
      <div className="sa-stats-row sa-stats-row--3">
        <div className="sa-stat-tile">
          <div className="sa-stat-tile__icon"><Building2 size={20} /></div>
          <div>
            <div className="sa-stat-tile__value">{s.totalTenants || 0}</div>
            <div className="sa-stat-tile__label">Total Tenants</div>
          </div>
        </div>
        <div className="sa-stat-tile sa-stat-tile--emerald">
          <div className="sa-stat-tile__icon"><Activity size={20} /></div>
          <div>
            <div className="sa-stat-tile__value">{s.activeTenants || 0}</div>
            <div className="sa-stat-tile__label">Active Tenants</div>
          </div>
        </div>
        <div className="sa-stat-tile sa-stat-tile--amber">
          <div className="sa-stat-tile__icon"><Clock4 size={20} /></div>
          <div>
            <div className="sa-stat-tile__value">{tenants.length}</div>
            <div className="sa-stat-tile__label">On This Page</div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <SuperAdminPageShell
      className="tenants-page"
      title="Tenants"
      subtitle="Manage organizations and subscription cycles"
      loading={initialLoading}
      loadingText="Loading tenants..."
      error={error}
      onRetry={() => loadTenants(page)}
    >
      {renderStatsBar()}

      <div className="sa-toolbar">
        <div className="sa-search-field">
          <Search size={16} className="sa-search-field__icon" aria-hidden />
          <input
            type="text"
            placeholder="Search company, domain, contact, sector..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button type="button" className="filter-btn" onClick={() => loadTenants(page, true)} disabled={tableLoading}>
          <RotateCcw size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} />
          Refresh
        </button>
      </div>

      <div className={`tenant-table-wrapper${tableLoading ? ' sa-table-busy' : ''}`}>          <table className="tenant-table-premium">
            <thead>
              <tr>
                <th>Company</th>
                <th>Contact info</th>
                <th>Capacity</th>
                <th>Plan</th>
                <th>Status</th>
                <th>Onboarded</th>
                <th>Expiry</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((tenant) => (
                  <tr key={tenant.id}>                    <td>
                      <div className="tenant-info-cell">
                        <div
                          className="tenant-avatar-premium"
                          style={{ background: getAvatarColor(tenant.id) }}
                        >
                          {(tenant.name || 'T')[0]}
                        </div>
                        <div className="tenant-main-info" style={{ display: 'flex', flexDirection: 'column' }}>
                          <span className="tenant-name-text" style={{ marginBottom: '2px' }}>{tenant.name}</span>
                          <span className="tenant-industry-text">{tenant.industry || 'Industry N/A'}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="contact-cell">
                        <span className="email-text">{tenant.contactEmail || 'no-contact@pragva.in'}</span>
                        <code style={{ fontSize: '0.65rem', color: '#94a3b8' }}>{tenant.primaryDomain || 'unassigned'}</code>
                      </div>
                    </td>
                    <td>
                      <span className="size-tag">{tenant.companySize || '0-50'} Seats</span>
                    </td>
                    <td>
                      <div className="plan-info-premium" style={{ display: 'flex', flexDirection: 'column' }}>
                        <span className="plan-primary-name" style={{ marginBottom: '2px' }}>{tenant.currentPlanName || 'Standard'}</span>
                        <span className="plan-status-sub">{tenant.subscriptionStatus || 'N/A'}</span>
                      </div>
                    </td>
                    <td>
                      <span className={`sa-badge ${tenant.active ? 'sa-badge--success' : 'sa-badge--muted'}`}>
                        {tenant.active ? 'Active' : 'Paused'}
                      </span>
                    </td>
                    <td>
                      <span className="creation-date">{formatDate(tenant.createdAt)}</span>
                    </td>
                    <td>
                      <div className="date-group-premium">
                        {tenant.isTrial ? (
                          <span className="sa-badge sa-badge--warning">Trial</span>
                        ) : (
                          <span className="sa-badge sa-badge--primary">Paid</span>
                        )}
                        <span style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 800 }}>
                          {tenant.planEndDate ? formatDate(tenant.planEndDate) : 'LIFETIME'}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div className="action-group-premium">
                        <button
                          type="button"
                          className="action-btn-premium"
                          title="View Insights"
                          onClick={() => handleViewMetrics(tenant)}
                        >
                          <BarChart size={16} />
                        </button>

                        <button
                          type="button"
                          className="action-btn-premium"
                          title="Extend Subscription"
                          onClick={() => setExtendTenant(tenant)}
                        >
                          <TrendingUp size={16} style={{ color: '#6366f1' }} />
                        </button>

                        <button
                          type="button"
                          className="action-btn-premium"
                          title={tenant.active ? 'Deactivate' : 'Activate'}
                          onClick={() => handleToggleActive(tenant)}
                        >
                          {tenant.active ? <ToggleRight size={22} color="#10b981" /> : <ToggleLeft size={22} />}
                        </button>

                        <button
                          type="button"
                          className="action-btn-premium delete-btn-premium"
                          title="Delete tenant"
                          onClick={() => handleDelete(tenant)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}              {tenants.length === 0 && (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '4rem', color: '#94a3b8', fontStyle: 'italic' }}>
                    No platform nodes matching your search criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div className="pagination-premium">
              <span className="pagination-text">Cycle {page + 1} of {totalPages}</span>
              <div className="pagination-controls">
                <button
                  className="pg-nav-btn"
                  disabled={page === 0}
                  onClick={() => loadTenants(page - 1, true)}                >
                  <ChevronLeft size={20} />
                </button>
                <button
                  className="pg-nav-btn"
                  disabled={page + 1 >= totalPages}
                  onClick={() => loadTenants(page + 1, true)}                >
                  <ChevronRight size={20} />
                </button>
              </div>
            </div>
          )}
        </div>

        {selectedTenantMetrics && (
          <div id="tenant-metrics-panel" className="sa-panel metrics-panel">
            <div className="sa-panel__head">
              <span className="sa-panel__head-icon sa-panel__head-icon--primary">
                <TrendingUp size={16} />
              </span>
              Insights: {selectedTenantMetrics.tenant.name}
              <button
                type="button"
                className="filter-btn metrics-close-btn"
                onClick={() => setSelectedTenantMetrics(null)}
              >
                Close
              </button>
            </div>
            <div className="sa-panel__body">
              {metricsLoading ? (
                <div className="sa-portal-loading" style={{ minHeight: 160 }}>
                  <div className="sa-portal-spinner" />
                </div>
              ) : (
                <div className="metrics-grid-premium">
                  {Object.entries(selectedTenantMetrics.metrics || {}).map(([key, value]) => (
                    <div key={key} className="metric-tile-premium">
                      <span className="metric-label-premium">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                      <span className="metric-value-premium">{String(value)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      <ExtendSubscriptionDialog
        open={!!extendTenant}
        tenant={extendTenant}
        saving={extending}
        onClose={() => { if (!extending) setExtendTenant(null); }}
        onSubmit={handleExtendSubmit}
      />
    </SuperAdminPageShell>
  );
}
