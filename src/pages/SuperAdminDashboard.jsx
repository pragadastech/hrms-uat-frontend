import { useEffect, useState, useMemo } from 'react';

import {

  Building2, Users, ShieldCheck, Activity, BarChart3,

  Server, Database, Globe, IndianRupee, Clock, Box,

} from 'lucide-react';

import SuperAdminPageShell from '../components/superadmin/SuperAdminPageShell';

import { superAdminAPI } from '../services/api';

import './SuperAdminDashboard.css';



const STAT_ACCENTS = ['', 'sa-stat-tile--emerald', 'sa-stat-tile--violet', 'sa-stat-tile--amber'];



export default function SuperAdminDashboard() {

  const [stats, setStats] = useState(null);

  const [analytics, setAnalytics] = useState(null);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState(null);



  const load = async () => {

    try {

      setLoading(true);

      setError(null);

      const [statsRes, analyticsRes] = await Promise.all([

        superAdminAPI.getDashboard(),

        superAdminAPI.getAnalytics('30d'),

      ]);

      setStats(statsRes.data || statsRes);

      setAnalytics(analyticsRes.data || analyticsRes);

    } catch (e) {

      console.error('Failed to load super admin dashboard', e);

      setError('Failed to load platform overview. Please try again.');

    } finally {

      setLoading(false);

    }

  };



  useEffect(() => {

    load();

  }, []);



  const statItems = useMemo(() => {

    const safeStats = stats || {};

    const safeAnalytics = analytics || {};

    return [

      {

        label: 'Total Tenants',

        value: safeStats.totalTenants ?? '—',

        meta: `Active: ${safeStats.activeTenants ?? safeAnalytics.activeTenants ?? 0}`,

        icon: Building2,

      },

      {

        label: 'Platform Admins',

        value: safeStats.totalAdmins ?? '—',

        meta: 'System administrators',

        icon: ShieldCheck,

      },

      {

        label: 'Total Employees',

        value: safeStats.totalEmployees ?? '—',

        meta: 'Across all tenants',

        icon: Users,

      },

      {

        label: '30-Day Revenue',

        value: safeAnalytics.monthlyRevenue != null

          ? `₹${Number(safeAnalytics.monthlyRevenue).toLocaleString('en-IN')}`

          : '—',

        meta: safeAnalytics.totalRevenue != null

          ? `All time: ₹${Number(safeAnalytics.totalRevenue).toLocaleString('en-IN')}`

          : 'Paid transactions',

        icon: IndianRupee,

      },

    ];

  }, [stats, analytics]);



  const planDistribution = useMemo(() => {

    const raw = analytics?.planDistribution;

    return Array.isArray(raw) && raw.length > 0 ? raw : [];

  }, [analytics]);



  const recentActivity = useMemo(() => {

    const raw = analytics?.recentActivity;

    return Array.isArray(raw) && raw.length > 0 ? raw : [];

  }, [analytics]);



  const systemHealth = useMemo(() => {

    const raw = analytics?.systemHealth;

    if (raw && typeof raw === 'object' && Object.keys(raw).length > 0) return raw;

    return null;

  }, [analytics]);



  const healthIcons = {

    'Frontend Cluster': Globe,

    'API Servers': Server,

    'Database Node': Database,

    'Media Storage': Box,

  };



  return (

    <SuperAdminPageShell

      className="dashboard-page"

      title="Dashboard"

      subtitle="Platform overview and health"

      loading={loading}

      loadingText="Loading dashboard..."

      error={error}

      onRetry={load}

    >

      <div className="sa-stats-row">

        {statItems.map((item, i) => (

          <div key={item.label} className={`sa-stat-tile ${STAT_ACCENTS[i] || ''}`.trim()}>

            <div className="sa-stat-tile__icon">

              <item.icon size={20} />

            </div>

            <div>

              <div className="sa-stat-tile__value">{item.value}</div>

              <div className="sa-stat-tile__label">{item.label}</div>

              <div className="sa-stat-tile__meta">{item.meta}</div>

            </div>

          </div>

        ))}

      </div>



      <div className="sa-panel-grid sa-panel-grid--dashboard">

        <div className="sa-panel">

          <div className="sa-panel__head">

            <span className="sa-panel__head-icon sa-panel__head-icon--primary">

              <BarChart3 size={16} />

            </span>

            Plan distribution

          </div>

          <div className="sa-panel__body">

            {planDistribution.length === 0 ? (

              <p className="sa-empty-hint">No plan distribution data yet.</p>

            ) : (

              <div className="plan-distribution-wrapper">

                {planDistribution.map((plan, idx) => (

                  <div key={plan.name || idx} className="dist-item">

                    <div className="dist-info">

                      <span className="dist-name">{plan.name}</span>

                      <span className="dist-count">{plan.count ?? 0} tenants</span>

                    </div>

                    <div className="progress-track">

                      <div

                        className="progress-fill"

                        style={{

                          width: `${plan.percentage ?? 0}%`,

                          backgroundColor: plan.color || 'var(--primary-500)',

                        }}

                      />

                    </div>

                  </div>

                ))}

              </div>

            )}

          </div>

        </div>



        <div className="sa-panel">

          <div className="sa-panel__head">

            <span className="sa-panel__head-icon sa-panel__head-icon--success">

              <Activity size={16} />

            </span>

            System status

          </div>

          <div className="sa-panel__body">

            {!systemHealth ? (

              <p className="sa-empty-hint">System health data unavailable.</p>

            ) : (

              <div className="health-grid-modern">

                {Object.entries(systemHealth).map(([key, value]) => {

                  const Icon = healthIcons[key] || Activity;

                  const healthy = String(value).toLowerCase() === 'healthy';

                  return (

                    <div key={key} className="health-tile">

                      <div className="health-label-group">

                        <div className="sa-stat-tile__icon" style={{ width: 34, height: 34 }}>

                          <Icon size={16} />

                        </div>

                        <span className="health-label-text">{key}</span>

                      </div>

                      <div className={`status-indicator ${healthy ? 'status-active' : ''}`}>

                        <div className="status-dot" />

                        {String(value)}

                      </div>

                    </div>

                  );

                })}

              </div>

            )}

          </div>

        </div>



        <div className="sa-panel sa-panel-grid--full">

          <div className="sa-panel__head">

            <span className="sa-panel__head-icon sa-panel__head-icon--warning">

              <Clock size={16} />

            </span>

            Recent activity

          </div>

          <div className="sa-panel__body">

            {recentActivity.length === 0 ? (

              <p className="sa-empty-hint">No recent platform activity.</p>

            ) : (

              <div className="activity-timeline">

                {recentActivity.map((item, index) => (

                  <div key={index} className="activity-node">

                    <div className="activity-marker" />

                    <div className="activity-card-inner">

                      <div className="activity-header-info">

                        <span className="activity-desc-text">{item.description}</span>

                        <span className="activity-time-text">

                          <Clock size={12} style={{ marginRight: 4 }} />

                          {item.timestamp}

                        </span>

                      </div>

                    </div>

                  </div>

                ))}

              </div>

            )}

          </div>

        </div>

      </div>

    </SuperAdminPageShell>

  );

}


