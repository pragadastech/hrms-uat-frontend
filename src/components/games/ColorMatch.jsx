import { useState, useEffect, useCallback } from 'react';
import { Palette, Timer, Trophy, Zap } from 'lucide-react';
import { gameScoreAPI, employeeAPI } from '../../services/api';
import {
  GameShell,
  GameStartScreen,
  GameHud,
  GameFooter,
} from './gameUi';
import '../../pages/Games.css';

const COLORS = [
  { name: 'Red', hex: '#EF4444' },
  { name: 'Blue', hex: '#3B82F6' },
  { name: 'Green', hex: '#10B981' },
  { name: 'Yellow', hex: '#F59E0B' },
  { name: 'Purple', hex: '#8B5CF6' },
  { name: 'Pink', hex: '#EC4899' },
];

const ColorMatch = ({ game, onBack }) => {
  const [employeeDbId, setEmployeeDbId] = useState(null);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(30);
  const [gameState, setGameState] = useState('START');
  const [currentChallenge, setCurrentChallenge] = useState(null);
  const [isWrong, setIsWrong] = useState(false);
  const [highScore, setHighScore] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    employeeAPI.getEmployeeProfile().then((res) => {
      if (res?.data?.id) setEmployeeDbId(res.data.id);
    }).catch(() => {});
  }, []);

  const generateChallenge = useCallback(() => {
    const textIndex = Math.floor(Math.random() * COLORS.length);
    const colorIndex = Math.floor(Math.random() * COLORS.length);
    setCurrentChallenge({
      text: COLORS[textIndex].name,
      color: COLORS[colorIndex],
      colorIndex,
    });
  }, []);

  useEffect(() => {
    let timer;
    if (gameState === 'PLAYING' && timeLeft > 0) {
      timer = setInterval(() => setTimeLeft((p) => p - 1), 1000);
    } else if (timeLeft === 0 && gameState === 'PLAYING') {
      finishGame();
    }
    return () => clearInterval(timer);
  }, [gameState, timeLeft]);

  const startGame = () => {
    setScore(0);
    setTimeLeft(30);
    setGameState('PLAYING');
    generateChallenge();
  };

  const finishGame = async () => {
    setGameState('FINISHED');
    if (score > highScore) setHighScore(score);
    if (employeeDbId) {
      setIsSubmitting(true);
      try {
        await gameScoreAPI.submitScore({
          employeeId: employeeDbId,
          gameName: 'Color Match',
          difficulty: game?.difficulty || 'MEDIUM',
          score,
          timeTaken: 30,
          movesCount: score,
        });
      } catch { /* ignore */ }
      setIsSubmitting(false);
    }
  };

  const handleAnswer = (colorIndex) => {
    if (gameState !== 'PLAYING') return;
    if (colorIndex === currentChallenge.colorIndex) {
      setScore((p) => p + 1);
      generateChallenge();
    } else {
      setIsWrong(true);
      setTimeout(() => setIsWrong(false), 300);
      setTimeLeft((p) => Math.max(0, p - 2));
    }
  };

  return (
    <GameShell gameName="Color Match" difficulty={game?.difficulty} onBack={onBack}>
      {gameState === 'START' && (
        <GameStartScreen
          icon={Palette}
          title="Stroop challenge"
          description="Tap the swatch that matches the ink color, not the word."
          accent="#8b5cf6"
          accentSoft="#f5f3ff"
          onStart={startGame}
          onBack={onBack}
          startLabel="Start (30s)"
        />
      )}

      {gameState === 'PLAYING' && currentChallenge && (
        <div className="gm-screen">
          <GameHud
            items={[
              { label: 'Score', value: score, highlight: true },
              {
                label: 'Time',
                value: `${timeLeft}s`,
                icon: <Timer size={18} />,
                alert: timeLeft < 10,
              },
            ]}
          />

          <div
            className="gm-stroop-display"
            style={{ transform: isWrong ? 'translateX(4px)' : undefined }}
          >
            <span
              className="gm-stroop-word"
              style={{ color: currentChallenge.color.hex }}
            >
              {currentChallenge.text}
            </span>
          </div>

          <div className="gm-options-grid">
            {COLORS.map((color, index) => (
              <button
                key={color.name}
                type="button"
                className="gm-option-btn"
                onClick={() => handleAnswer(index)}
              >
                <div
                  className="gm-option-icon"
                  style={{ background: color.hex, width: 48, height: 48 }}
                />
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--gm-text-muted)' }}>
                  {color.name}
                </span>
              </button>
            ))}
          </div>

          <GameFooter onBack={() => setGameState('START')} />
        </div>
      )}

      {gameState === 'FINISHED' && (
        <div className="gm-finish-card">
          <Trophy size={48} style={{ color: '#8b5cf6', marginBottom: 12 }} />
          <h2 className="gm-start-title">Time&apos;s up!</h2>
          <p className="gm-start-desc">You matched {score} colors correctly.</p>
          <div className="gm-finish-stats">
            <div className="gm-finish-stat">
              <span>Score</span>
              <strong>{score}</strong>
            </div>
            <div className="gm-finish-stat">
              <span>Best</span>
              <strong>{Math.max(score, highScore)}</strong>
            </div>
          </div>
          <div className="gm-start-actions">
            <button type="button" className="gm-btn-play" style={{ background: '#8b5cf6' }} onClick={startGame}>
              <Zap size={18} /> Play again
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

export default ColorMatch;
