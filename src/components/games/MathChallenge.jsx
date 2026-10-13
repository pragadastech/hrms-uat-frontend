import { useState, useEffect, useCallback } from 'react';
import { Calculator, Timer, Trophy, Zap, CheckCircle2, XCircle } from 'lucide-react';
import { gameScoreAPI, employeeAPI } from '../../services/api';
import {
  GameShell,
  GameStartScreen,
  GameHud,
  GameFooter,
  GameResultModal,
  difficultyLabel,
} from './gameUi';
import '../../pages/Games.css';

const MathChallenge = ({ game, onBack }) => {
  const [employeeDbId, setEmployeeDbId] = useState(null);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(30);
  const [gameState, setGameState] = useState('START');
  const [currentProblem, setCurrentProblem] = useState(null);
  const [userAnswer, setUserAnswer] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [highScore, setHighScore] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [level, setLevel] = useState(1);

  useEffect(() => {
    employeeAPI.getEmployeeProfile().then((res) => {
      if (res?.data?.id) setEmployeeDbId(res.data.id);
    }).catch(() => {});
  }, []);

  const generateProblem = useCallback((currentLevel) => {
    const operators = ['+', '-', '*'];
    const op = operators[Math.floor(Math.random() * (currentLevel > 5 ? 3 : 2))];
    let num1, num2, answer;
    if (op === '+') {
      num1 = Math.floor(Math.random() * (10 + currentLevel * 5)) + 1;
      num2 = Math.floor(Math.random() * (10 + currentLevel * 5)) + 1;
      answer = num1 + num2;
    } else if (op === '-') {
      num1 = Math.floor(Math.random() * (10 + currentLevel * 5)) + 5;
      num2 = Math.floor(Math.random() * num1) + 1;
      answer = num1 - num2;
    } else {
      num1 = Math.floor(Math.random() * (5 + currentLevel)) + 2;
      num2 = Math.floor(Math.random() * 10) + 2;
      answer = num1 * num2;
    }
    setCurrentProblem({ num1, num2, op, answer });
    setUserAnswer('');
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
    setLevel(1);
    setTimeLeft(30);
    setGameState('PLAYING');
    generateProblem(1);
  };

  const finishGame = async () => {
    setGameState('FINISHED');
    if (score > highScore) setHighScore(score);
    if (employeeDbId) {
      setIsSubmitting(true);
      try {
        await gameScoreAPI.submitScore({
          employeeId: employeeDbId,
          gameName: 'Math Challenge',
          difficulty: game?.difficulty || 'MEDIUM',
          score,
          timeTaken: 30,
          movesCount: score,
        });
      } catch { /* ignore */ }
      setIsSubmitting(false);
    }
  };

  const handleAnswerChange = (e) => {
    const val = e.target.value;
    setUserAnswer(val);
    if (parseInt(val, 10) === currentProblem?.answer) {
      setFeedback('CORRECT');
      const nextScore = score + 1;
      setScore(nextScore);
      const nextLevel = (nextScore) % 5 === 0 ? level + 1 : level;
      if ((nextScore) % 5 === 0) setLevel((l) => l + 1);
      setTimeout(() => {
        setFeedback(null);
        generateProblem(nextLevel);
      }, 200);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && userAnswer !== '' && parseInt(userAnswer, 10) !== currentProblem?.answer) {
      setFeedback('WRONG');
      setTimeout(() => setFeedback(null), 400);
      setUserAnswer('');
    }
  };

  return (
    <GameShell gameName="Math Challenge" difficulty={game?.difficulty} onBack={onBack}>
      {gameState === 'START' && (
        <GameStartScreen
          icon={Calculator}
          title="Math blitz"
          description="Solve as many problems as you can in 30 seconds. Difficulty ramps up as you progress."
          accent="#ec4899"
          accentSoft="#fdf2f8"
          onStart={startGame}
          onBack={onBack}
          startLabel="Start blitz"
        />
      )}

      {gameState === 'PLAYING' && currentProblem && (
        <div className="gm-screen">
          <GameHud
            items={[
              { label: 'Solved', value: score, highlight: true },
              { label: 'Level', value: level },
              {
                label: 'Time',
                value: `${timeLeft}s`,
                icon: <Timer size={18} />,
                alert: timeLeft < 10,
              },
            ]}
          />
          <div className="gm-problem-display">
            <div className="expr">
              <span>{currentProblem.num1}</span>
              <span className="expr-op">{currentProblem.op === '*' ? '×' : currentProblem.op}</span>
              <span>{currentProblem.num2}</span>
            </div>
            <input
              type="number"
              className={`gm-answer-input ${feedback === 'CORRECT' ? 'correct' : feedback === 'WRONG' ? 'wrong' : ''}`}
              value={userAnswer}
              onChange={handleAnswerChange}
              onKeyDown={handleKeyDown}
              autoFocus
              aria-label="Your answer"
            />
            {feedback === 'CORRECT' && (
              <CheckCircle2 size={28} style={{ color: '#22c55e', marginTop: 12 }} aria-hidden="true" />
            )}
            {feedback === 'WRONG' && (
              <XCircle size={28} style={{ color: '#ef4444', marginTop: 12 }} aria-hidden="true" />
            )}
          </div>
          <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--gm-text-muted)' }}>
            Press Enter to confirm multi-digit answers
          </p>
          <GameFooter onBack={() => setGameState('START')} center={difficultyLabel(game?.difficulty)} />
        </div>
      )}

      {gameState === 'FINISHED' && (
        <div className="gm-finish-card">
          <Trophy size={48} style={{ color: '#ec4899', marginBottom: 12 }} />
          <h2 className="gm-start-title">Time&apos;s up!</h2>
          <p className="gm-start-desc">You solved {score} problems.</p>
          <div className="gm-finish-stats">
            <div className="gm-finish-stat">
              <span>Solved</span>
              <strong>{score}</strong>
            </div>
            <div className="gm-finish-stat">
              <span>Best</span>
              <strong>{Math.max(score, highScore)}</strong>
            </div>
          </div>
          <div className="gm-start-actions">
            <button type="button" className="gm-btn-play" style={{ background: '#ec4899' }} onClick={startGame}>
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

export default MathChallenge;
