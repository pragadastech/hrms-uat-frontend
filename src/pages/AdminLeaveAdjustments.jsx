import Header from '../components/Header';
import LeaveAdjustmentsPanel from '../components/LeaveAdjustmentsPanel';
import './Leaves.css';

export default function AdminLeaveAdjustments() {
  return (
    <div className="main-content leaves-page">
      <Header
        title="Leave Adjustments"
        subtitle="Adjust employee leave balances and review the organization audit log"
      />
      <div className="page-content" style={{ padding: '14px 16px 20px' }}>
        <LeaveAdjustmentsPanel />
      </div>
    </div>
  );
}
