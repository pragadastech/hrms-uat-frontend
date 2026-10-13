import { Sparkles } from 'lucide-react';
import Header from '../components/Header';

export default function PlaceholderPage({
  title = 'Coming soon',
  subtitle = 'We are building something useful for your team',
  message,
}) {
  const displaySubtitle = message || subtitle;
  return (
    <div className="main-content placeholder-page">
      <Header title={title} subtitle={displaySubtitle} />
      <div className="page-content" style={{ padding: '14px 16px 20px' }}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            minHeight: 'min(52vh, 420px)',
            padding: '28px 20px',
            background: 'linear-gradient(160deg, #f8fafc 0%, #eef2ff 55%, #ecfeff 100%)',
            border: '1px solid #e2e8f0',
            borderRadius: 12,
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(79, 70, 229, 0.1)',
              color: '#4f46e5',
              marginBottom: 16,
            }}
            aria-hidden
          >
            <Sparkles size={26} />
          </div>
          <h2
            style={{
              margin: '0 0 8px',
              fontSize: '1.35rem',
              fontWeight: 700,
              color: '#0f172a',
              letterSpacing: '-0.02em',
            }}
          >
            Coming soon
          </h2>
          <p
            style={{
              margin: 0,
              fontSize: 12,
              fontWeight: 600,
              color: '#94a3b8',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            Stay tuned
          </p>
        </div>
      </div>
    </div>
  );
}
