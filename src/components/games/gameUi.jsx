import { ArrowLeft, RefreshCw } from 'lucide-react';
import GameShell from './GameShell';

export { GameShell };

/** Centered start / intro screen */
export function GameStartScreen({
  icon: Icon,
  title,
  description,
  accent = '#4f46e5',
  accentSoft = '#eef2ff',
  onStart,
  onBack,
  startLabel = 'Start game',
  children,
}) {
  return (
    <div className="gm-screen gm-screen-center">
      <div className="gm-start-card">
        {Icon && (
          <div className="gm-start-icon" style={{ background: accentSoft, color: accent }}>
            <Icon size={40} aria-hidden="true" />
          </div>
        )}
        <h2 className="gm-start-title">{title}</h2>
        {description && <p className="gm-start-desc">{description}</p>}
        {children}
        <div className="gm-start-actions">
          <button type="button" className="gm-btn-play" style={{ background: accent }} onClick={onStart}>
            {startLabel}
          </button>
          {onBack && (
            <button type="button" className="gm-btn-ghost" onClick={onBack}>
              Back to arcade
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** Top HUD row: stat pills */
export function GameHud({ items = [] }) {
  return (
    <div className="gm-hud">
      {items.map((item) => (
        <div
          key={item.label}
          className={`gm-hud-item ${item.alert ? 'gm-hud-alert' : ''} ${item.highlight ? 'gm-hud-highlight' : ''}`}
        >
          {item.icon && <span className="gm-hud-icon">{item.icon}</span>}
          <div>
            <span className="gm-hud-label">{item.label}</span>
            <span className="gm-hud-value">{item.value}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export function GameFooter({ onBack, onReset, center, right }) {
  return (
    <footer className="gm-play-footer">
      {onBack && (
        <button type="button" className="gm-btn-back" onClick={onBack}>
          <ArrowLeft size={16} aria-hidden="true" />
          Arcade
        </button>
      )}
      {center && <div className="gm-footer-center">{center}</div>}
      <div className="gm-footer-right">
        {right}
        {onReset && (
          <button type="button" className="gm-btn-icon" onClick={onReset} title="Restart" aria-label="Restart">
            <RefreshCw size={18} />
          </button>
        )}
      </div>
    </footer>
  );
}

/** Full-screen result overlay */
export function GameResultModal({
  open,
  title,
  subtitle,
  icon: Icon,
  variant = 'default',
  onPrimary,
  primaryLabel = 'Play again',
  onSecondary,
  secondaryLabel,
}) {
  if (!open) return null;
  return (
    <div className="gm-result-overlay" role="dialog" aria-modal="true">
      <div className={`gm-result-card gm-result-${variant}`}>
        {Icon && (
          <div className="gm-result-icon">
            <Icon size={40} aria-hidden="true" />
          </div>
        )}
        <h2 className="gm-result-title">{title}</h2>
        {subtitle && <p className="gm-result-sub">{subtitle}</p>}
        <div className="gm-result-actions">
          {onSecondary && (
            <button type="button" className="gm-btn-ghost" onClick={onSecondary}>
              {secondaryLabel || 'Back'}
            </button>
          )}
          {onPrimary && (
            <button type="button" className="gm-btn-play" onClick={onPrimary}>
              {primaryLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function GameLoading({ message = 'Loading…', icon: Icon }) {
  return (
    <div className="gm-screen gm-screen-center">
      <div className="gm-loading">
        {Icon && <Icon size={48} style={{ color: 'var(--gm-primary)', marginBottom: 12 }} />}
        <div className="gm-spinner" aria-hidden="true" />
        <p>{message}</p>
      </div>
    </div>
  );
}

export function GameError({ message, onRetry, onBack }) {
  return (
    <div className="gm-screen gm-screen-center">
      <div className="gm-start-card">
        <p className="gm-start-desc" style={{ color: '#dc2626' }}>{message}</p>
        <div className="gm-start-actions">
          {onRetry && (
            <button type="button" className="gm-btn-play" onClick={onRetry}>
              Retry
            </button>
          )}
          {onBack && (
            <button type="button" className="gm-btn-ghost" onClick={onBack}>
              Back to arcade
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function formatGameTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function difficultyLabel(d) {
  if (!d) return '';
  return d.charAt(0) + d.slice(1).toLowerCase();
}
