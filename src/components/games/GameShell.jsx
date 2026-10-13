import { ArrowLeft } from 'lucide-react';

/**
 * Consistent chrome when a mini-game is active.
 */
export default function GameShell({ gameName, difficulty, onBack, children }) {
  return (
    <div className="gm-play-wrap">
      <header className="gm-play-header">
        <div>
          <h2 className="gm-play-title">{gameName}</h2>
          {difficulty && (
            <p className="gm-play-sub">
              Difficulty: {difficulty.charAt(0) + difficulty.slice(1).toLowerCase()}
            </p>
          )}
        </div>
        <button type="button" className="gm-btn-back" onClick={onBack}>
          <ArrowLeft size={16} aria-hidden="true" />
          Back to arcade
        </button>
      </header>
      <div className="gm-play-body">{children}</div>
    </div>
  );
}
