import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { employeeOfQuarterAPI, eoqAPI } from '../services/api';

export default function EOQWidget() {
  const [winner, setWinner] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    const fetch = async () => {
      try {
        setLoading(true);
        const res = await employeeOfQuarterAPI.getCurrentEmployeeOfTheQuarter();
        if (!mounted) return;
        if (res) {
          setWinner(res);
          return;
        }

        // Fallback: use most recent published nomination
        try {
          let listResp = await eoqAPI.getNominationsByStatus('PUBLISHED');
          if (!(listResp?.data?.length)) {
            listResp = await eoqAPI.getNominationsByStatus('APPROVED');
          }
          const list = (listResp?.data) || [];
          if (list.length) {
            // pick most recently updated or created
            list.sort((a, b) => {
              const ta = a.updatedAt || a.createdAt || 0;
              const tb = b.updatedAt || b.createdAt || 0;
              return new Date(tb).getTime() - new Date(ta).getTime();
            });
            setWinner(list[0]);
            return;
          }
        } catch (e) {
          // ignore fallback errors
        }
        setWinner(null);
      } catch (e) {
        console.error('EOQ widget fetch failed', e);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetch();
    return () => { mounted = false; };
  }, []);

  if (loading) return (
    <div className="dashboard-card dashboard-eoq-card">
      <div className="dashboard-card-content">Loading EOQ...</div>
    </div>
  );

  if (!winner) return (
    <div className="dashboard-card dashboard-eoq-card">
      <div className="dashboard-card-content">
        <h4 className="dashboard-card-title">Employee of the Quarter</h4>
        <p>No selection yet.</p>
        <button className="dashboard-link-btn" onClick={() => navigate('/eoq')}>View EOQ</button>
      </div>
    </div>
  );

  return (
    <div className="dashboard-card dashboard-eoq-card" onClick={() => navigate('/eoq')} style={{ cursor: 'pointer' }}>
      <div className="dashboard-card-content" style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
        <img src={winner.avatar || winner.profilePhoto || '/public/default-avatar.png'} alt="avatar" style={{ width: 64, height: 64, borderRadius: 8, objectFit: 'cover' }} />
        <div>
          <h4 className="dashboard-card-title">{winner.name || winner.employeeName || winner.candidateName}</h4>
          <p style={{ margin: 0, opacity: 0.8 }}>{winner.quarter ? `${winner.quarter} • ${winner.year || ''}` : ''}</p>
          {winner.reason && <p style={{ marginTop: 6, fontSize: 13, color: 'var(--muted-color)' }}>{winner.reason}</p>}
        </div>
      </div>
    </div>
  );
}
