import { useState, useEffect, useRef } from 'react';
import { gameScoreAPI, employeeAPI } from '../../services/api';
import { RotateCcw, Trophy, Keyboard, CheckCircle, Zap } from 'lucide-react';
import {
  GameShell,
  GameStartScreen,
  GameHud,
  GameFooter,
} from './gameUi';
import '../../pages/Games.css';

const SAMPLE_TEXTS = [
  'The agility of the developer is reflected in the quality of the codebase.',
  'Artificial intelligence is not a substitute for human intuition but a powerful extension.',
  'User experience is the bridge between complex technology and meaningful human interaction.',
  'Sustainable productivity requires a balance between deep focus and intentional recovery.',
  'The most resilient systems are built on simple foundations and modular architecture.',
  'Innovation is the ability to see change as an opportunity rather than a threat.',
  'Clarity in communication is the cornerstone of effective team collaboration.',
];

const TypingTest = ({ game, onBack }) => {
  const [employeeDbId, setEmployeeDbId] = useState(null);
  const [currentText, setCurrentText] = useState('');
  const [userInput, setUserInput] = useState('');
  const [startTime, setStartTime] = useState(null);
  const [gameState, setGameState] = useState('idle');
  const [stats, setStats] = useState({ wpm: 0, accuracy: 0, time: 0 });
  const [highScore, setHighScore] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    employeeAPI.getEmployeeProfile().then((res) => {
      if (res?.data?.id) setEmployeeDbId(res.data.id);
    }).catch(() => {});
  }, []);

  const startTest = () => {
    setCurrentText(SAMPLE_TEXTS[Math.floor(Math.random() * SAMPLE_TEXTS.length)]);
    setUserInput('');
    setStartTime(null);
    setGameState('playing');
    setTimeout(() => inputRef.current?.focus(), 10);
  };

  const finishTest = async (input) => {
    const end = Date.now();
    const timeTaken = (end - (startTime || end)) / 1000;
    const words = currentText.length / 5;
    const wpm = Math.round(words / (timeTaken / 60));
    let correct = 0;
    for (let i = 0; i < input.length; i++) {
      if (input[i] === currentText[i]) correct++;
    }
    const accuracy = Math.round((correct / currentText.length) * 100);
    const finalWpm = Math.max(0, Math.round(wpm * (accuracy / 100)));
    setStats({ wpm: finalWpm, accuracy, time: Math.round(timeTaken) });
    setGameState('finished');
    if (finalWpm > highScore) setHighScore(finalWpm);

    if (employeeDbId) {
      setIsSubmitting(true);
      try {
        await gameScoreAPI.submitScore({
          employeeId: employeeDbId,
          gameName: 'Typing Test',
          difficulty: game?.difficulty || 'MEDIUM',
          score: finalWpm,
          timeTaken: Math.round(timeTaken),
          movesCount: accuracy,
        });
      } catch { /* ignore */ }
      setIsSubmitting(false);
    }
  };

  const handleInput = (e) => {
    const val = e.target.value;
    if (!startTime) setStartTime(Date.now());
    setUserInput(val);
    if (val.length === currentText.length) finishTest(val);
  };

  return (
    <GameShell gameName="Typing Test" difficulty={game?.difficulty} onBack={onBack}>
      {gameState === 'idle' && (
        <GameStartScreen
          icon={Keyboard}
          title="Speed typing"
          description="Type the passage as fast and accurately as you can."
          onStart={startTest}
          onBack={onBack}
          startLabel="Start test"
        />
      )}

      {gameState === 'playing' && (
        <div className="gm-screen">
          <GameHud
            items={[
              {
                label: 'Progress',
                value: `${Math.round((userInput.length / currentText.length) * 100)}%`,
                highlight: true,
              },
              { label: 'Live', value: <LiveTimer startTime={startTime} /> },
            ]}
          />

          <div className="gm-typing-panel">
            <p className="gm-typing-text">
              {currentText.split('').map((char, i) => {
                let color = 'var(--gm-text-muted)';
                if (i < userInput.length) {
                  color = userInput[i] === char ? 'var(--gm-primary)' : '#ef4444';
                }
                return (
                  <span key={i} style={{ color }}>
                    {char}
                  </span>
                );
              })}
            </p>
            <textarea
              ref={inputRef}
              value={userInput}
              onChange={handleInput}
              className="gm-typing-input"
              aria-label="Typing input"
            />
          </div>

          <GameFooter onBack={onBack} />
        </div>
      )}

      {gameState === 'finished' && (
        <div className="gm-finish-card">
          <CheckCircle size={48} style={{ color: '#22c55e', marginBottom: 12 }} />
          <h2 className="gm-start-title">Test complete</h2>
          <div className="gm-finish-stats" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            <div className="gm-finish-stat">
              <span>WPM</span>
              <strong>{stats.wpm}</strong>
            </div>
            <div className="gm-finish-stat">
              <span>Accuracy</span>
              <strong>{stats.accuracy}%</strong>
            </div>
            <div className="gm-finish-stat">
              <span>Time</span>
              <strong>{stats.time}s</strong>
            </div>
          </div>
          <div className="gm-start-actions">
            <button type="button" className="gm-btn-play" onClick={startTest}>
              <RotateCcw size={18} /> Try again
            </button>
            <button type="button" className="gm-btn-ghost" onClick={onBack}>
              Back to arcade
            </button>
          </div>
          {isSubmitting && (
            <p style={{ marginTop: 12, fontSize: 12, color: 'var(--gm-text-muted)' }}>Saving score…</p>
          )}
        </div>
      )}
    </GameShell>
  );
};

function LiveTimer({ startTime }) {
  const [ms, setMs] = useState(0);
  useEffect(() => {
    let id;
    if (startTime) id = setInterval(() => setMs(Date.now() - startTime), 100);
    else setMs(0);
    return () => clearInterval(id);
  }, [startTime]);
  return <>{(ms / 1000).toFixed(1)}s</>;
}

export default TypingTest;
