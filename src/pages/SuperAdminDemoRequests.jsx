import { useEffect, useState, useMemo } from 'react';
import { Search, Mail, RefreshCw, Inbox, Building2, Users } from 'lucide-react';
import SuperAdminPageShell from '../components/superadmin/SuperAdminPageShell';
import { superAdminAPI } from '../services/api';

export default function SuperAdminDemoRequests() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await superAdminAPI.getDemoRequests();
      setItems(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      setError(e?.response?.data?.message || e?.message || 'Failed to load lead requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    if (!searchTerm.trim()) return items;
    const term = searchTerm.toLowerCase();
    return items.filter((item) =>
      [item.fullName, item.workEmail, item.companyName, item.source, item.phoneNumber]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(term))
    );
  }, [items, searchTerm]);

  const uniqueCompanies = useMemo(
    () => new Set(items.map((i) => i.companyName).filter(Boolean)).size,
    [items]
  );

  const formatDate = (value) => {
    if (!value) return '—';
    return new Date(value).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <SuperAdminPageShell
      title="Lead Requests"
      subtitle="Demo and contact form submissions"
      loading={loading}
      loadingText="Loading leads..."
      error={error}
      onRetry={load}
    >
      <div className="sa-stats-row sa-stats-row--3">
        <div className="sa-stat-tile">
          <div className="sa-stat-tile__icon"><Inbox size={20} /></div>
          <div>
            <div className="sa-stat-tile__value">{items.length}</div>
            <div className="sa-stat-tile__label">Total leads</div>
          </div>
        </div>
        <div className="sa-stat-tile sa-stat-tile--violet">
          <div className="sa-stat-tile__icon"><Building2 size={20} /></div>
          <div>
            <div className="sa-stat-tile__value">{uniqueCompanies}</div>
            <div className="sa-stat-tile__label">Companies</div>
          </div>
        </div>
        <div className="sa-stat-tile sa-stat-tile--emerald">
          <div className="sa-stat-tile__icon"><Users size={20} /></div>
          <div>
            <div className="sa-stat-tile__value">{filtered.length}</div>
            <div className="sa-stat-tile__label">Matching search</div>
          </div>
        </div>
      </div>

      <div className="sa-toolbar">
        <div className="sa-search-field">
          <Search size={16} className="sa-search-field__icon" aria-hidden />
          <input
            type="text"
            placeholder="Search name, email, company..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button type="button" className="filter-btn" onClick={load}>
          <RefreshCw size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} />
          Refresh
        </button>
      </div>

      <div className="sa-panel">
        <div className="sa-panel__head">All submissions</div>
        <div className="sa-panel__body sa-panel__body--flush">
          <div className="employee-table-container">
            <table className="employee-table">
              <thead>
                <tr>
                  <th>Contact</th>
                  <th>Company</th>
                  <th>Team size</th>
                  <th>Source</th>
                  <th>Submitted</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5}>
                      <p className="sa-empty-hint">
                        <Mail size={22} style={{ margin: '0 auto 8px', opacity: 0.4, display: 'block' }} />
                        No lead requests found.
                      </p>
                    </td>
                  </tr>
                ) : (
                  filtered.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{item.fullName || '—'}</div>
                        <div className="stat-card-date">{item.workEmail || '—'}</div>
                        <div className="stat-card-date">
                          {(item.phoneCode || '')} {item.phoneNumber || ''}
                        </div>
                      </td>
                      <td>{item.companyName || '—'}</td>
                      <td>{item.employeeCount ?? '—'}</td>
                      <td>{item.source || '—'}</td>
                      <td className="stat-card-date">{formatDate(item.createdAt)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </SuperAdminPageShell>
  );
}
