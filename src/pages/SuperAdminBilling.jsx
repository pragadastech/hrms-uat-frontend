import { useEffect, useState } from 'react';

import { ReceiptIndianRupee, CreditCard, Users, Star, RefreshCw } from 'lucide-react';

import SuperAdminPageShell from '../components/superadmin/SuperAdminPageShell';

import { superAdminAPI } from '../services/api';



export default function SuperAdminBilling() {

  const [stats, setStats] = useState(null);

  const [transactions, setTransactions] = useState([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState(null);



  const loadData = async () => {

    try {

      setLoading(true);

      setError(null);

      const [statsRes, txRes] = await Promise.all([

        superAdminAPI.getBillingStats(),

        superAdminAPI.getTransactions(),

      ]);



      setStats(statsRes.data || statsRes);

      const txData = txRes.data || txRes;

      const content = Array.isArray(txData.content) ? txData.content : Array.isArray(txData) ? txData : [];

      setTransactions(content);

    } catch (e) {

      console.error('Failed to load billing data', e);

      setError('Failed to load billing overview');

    } finally {

      setLoading(false);

    }

  };



  useEffect(() => {

    loadData();

  }, []);



  const formatAmount = (value) => {

    if (value == null) return '₹0';

    try {

      return `₹${Number(value).toLocaleString('en-IN')}`;

    } catch {

      return String(value);

    }

  };



  const formatDate = (value) => {

    if (!value) return 'N/A';

    try {

      return new Date(value).toLocaleString('en-IN', {

        day: '2-digit',

        month: 'short',

        year: 'numeric',

        hour: '2-digit',

        minute: '2-digit',

      });

    } catch {

      return String(value);

    }

  };



  const safeStats = stats || {};



  const statTiles = [

    {

      label: '30-Day Revenue',

      value: formatAmount(safeStats.monthlyRevenue ?? safeStats.totalRevenueMonth),

      meta: 'Paid in last 30 days',

      icon: ReceiptIndianRupee,

      accent: '',

    },

    {

      label: 'All-Time Revenue',

      value: formatAmount(safeStats.totalRevenue),

      meta: 'Paid transactions',

      icon: CreditCard,

      accent: 'sa-stat-tile--emerald',

    },

    {

      label: 'Transactions',

      value: safeStats.totalTransactions ?? 0,

      meta: 'All time',

      icon: CreditCard,

      accent: 'sa-stat-tile--violet',

    },

    {

      label: 'Paying Tenants',

      value: safeStats.activeTenants ?? 0,

      meta: 'With paid invoices',

      icon: Users,

      accent: 'sa-stat-tile--amber',

    },

  ];



  return (

    <SuperAdminPageShell

      className="billing-page"

      title="Billing & Revenue"

      subtitle="Platform billing overview"

      loading={loading}

      loadingText="Loading billing data..."

      error={error}

      onRetry={loadData}

    >

      <div className="sa-toolbar">

        <span className="sa-toolbar-meta">{transactions.length} transactions loaded</span>

        <button type="button" className="filter-btn" onClick={loadData}>

          <RefreshCw size={14} />

          Refresh

        </button>

      </div>



      <div className="sa-stats-row">

        {statTiles.map((tile) => (

          <div key={tile.label} className={`sa-stat-tile ${tile.accent}`.trim()}>

            <div className="sa-stat-tile__icon">

              <tile.icon size={20} />

            </div>

            <div>

              <div className="sa-stat-tile__value">{tile.value}</div>

              <div className="sa-stat-tile__label">{tile.label}</div>

              <div className="sa-stat-tile__meta">{tile.meta}</div>

            </div>

          </div>

        ))}

      </div>



      <div className="sa-panel" style={{ marginBottom: 14 }}>

        <div className="sa-panel__head">

          <span className="sa-panel__head-icon sa-panel__head-icon--warning">

            <Star size={16} />

          </span>

          Most popular plan

        </div>

        <div className="sa-panel__body">

          <span className="sa-badge sa-badge--primary" style={{ fontSize: 13, padding: '6px 14px' }}>

            {safeStats.mostPopularPlan || 'No data yet'}

          </span>

        </div>

      </div>



      <div className="sa-panel">

        <div className="sa-panel__head">Recent transactions</div>

        <div className="sa-panel__body sa-panel__body--flush">

          <div className="employee-table-container">

            <table className="employee-table">

              <thead>

                <tr>

                  <th>Tenant</th>

                  <th>Plan</th>

                  <th>Amount</th>

                  <th>Status</th>

                  <th>Gateway</th>

                  <th>Date</th>

                </tr>

              </thead>

              <tbody>

                {transactions.map((tx) => (

                  <tr key={tx.id}>

                    <td style={{ fontWeight: 600 }}>{tx.tenantName || 'N/A'}</td>

                    <td>{tx.planName || 'N/A'}</td>

                    <td style={{ fontWeight: 700, color: 'var(--primary-600)' }}>{formatAmount(tx.amount)}</td>

                    <td>

                      <span className={`sa-badge ${tx.status === 'PAID' ? 'sa-badge--success' : 'sa-badge--warning'}`}>

                        {tx.status || 'N/A'}

                      </span>

                    </td>

                    <td>{tx.paymentGateway || 'N/A'}</td>

                    <td>{formatDate(tx.transactionDate)}</td>

                  </tr>

                ))}

                {transactions.length === 0 && (

                  <tr>

                    <td colSpan={6}>

                      <p className="sa-empty-hint">No transactions found.</p>

                    </td>

                  </tr>

                )}

              </tbody>

            </table>

          </div>

        </div>

      </div>

    </SuperAdminPageShell>

  );

}


