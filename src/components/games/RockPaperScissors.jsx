import { useState, useEffect } from 'react';
import { gameScoreAPI, employeeAPI } from '../../services/api';
import { Zap, Scissors, Hand, Mountain } from 'lucide-react';
import { GameShell, GameFooter, difficultyLabel } from './gameUi';
import '../../pages/Games.css';

const CHOICES = [
  { id: 'rock', name: 'Rock', icon: Mountain, color: '#4f46e5', beats: 'scissors' },
  { id: 'paper', name: 'Paper', icon: Hand, color: '#059669', beats: 'rock' },
  { id: 'scissors', name: 'Scissors', icon: Scissors, color: '#db2777', beats: 'paper' },
];

const RockPaperScissors = ({ game, onBack }) => {
  const [employeeDbId, setEmployeeDbId] = useState(null);
  const [gameState, setGameState] = useState('CHOOSING');
  const [playerChoice, setPlayerChoice] = useState(null);
  const [computerChoice, setComputerChoice] = useState(null);
  const [result, setResult] = useState(null);
  const [score, setScore] = useState({ player: 0, computer: 0 });

  useEffect(() => {
    employeeAPI.getEmployeeProfile().then((res) => {
      if (res?.data?.id) setEmployeeDbId(res.data.id);
    }).catch(() => {});
  }, []);

  const submitWin = async () => {
    if (!employeeDbId) return;
    try {
      await gameScoreAPI.submitScore({
        employeeId: employeeDbId,
        gameName: 'Rock Paper Scissors',
        difficulty: game?.difficulty || 'MEDIUM',
        score: 50,
        timeTaken: 0,
        movesCount: 1,
      });
    } catch { /* ignore */ }
  };

  const handlePlay = (choice) => {
    setPlayerChoice(choice);
    setGameState('REVEAL');
    setTimeout(() => {
      const computer = CHOICES[Math.floor(Math.random() * CHOICES.length)];
      setComputerChoice(computer);
      let res = 'draw';
      if (choice.id === computer.id) res = 'draw';
      else if (choice.beats === computer.id) res = 'win';
      else res = 'lose';
      setResult(res);
      setGameState('RESULT');
      if (res === 'win') {
        setScore((s) => ({ ...s, player: s.player + 1 }));
        submitWin();
      } else if (res === 'lose') {
        setScore((s) => ({ ...s, computer: s.computer + 1 }));
      }
    }, 700);
  };

  const resetScores = () => {
    setScore({ player: 0, computer: 0 });
    setGameState('CHOOSING');
    setPlayerChoice(null);
    setComputerChoice(null);
    setResult(null);
  };

  return (
    <GameShell gameName="Rock Paper Scissors" difficulty={game?.difficulty} onBack={onBack}>
      <div className="gm-screen">
        <div className="gm-hud" style={{ maxWidth: 400, margin: '0 auto 24px' }}>
          <div className="gm-hud-item gm-hud-highlight">
            <span className="gm-hud-label">You</span>
            <span className="gm-hud-value">{score.player}</span>
          </div>
          <div className="gm-hud-item">
            <span className="gm-hud-label">CPU</span>
            <span className="gm-hud-value">{score.computer}</span>
          </div>
        </div>

        {gameState === 'CHOOSING' && (
          <div className="gm-options-grid">
            {CHOICES.map((c) => {
              const Icon = c.icon;
              return (
                <button key={c.id} type="button" className="gm-option-btn" onClick={() => handlePlay(c)}>
                  <div className="gm-option-icon" style={{ background: c.color }}>
                    <Icon size={32} aria-hidden="true" />
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--gm-text-muted)' }}>{c.name}</span>
                </button>
              );
            })}
          </div>
        )}

        {gameState !== 'CHOOSING' && playerChoice && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 32, flexWrap: 'wrap' }}>
            <ChoiceReveal label="You" choice={playerChoice} />
            <div style={{ textAlign: 'center', minWidth: 100 }}>
              {gameState === 'REVEAL' ? (
                <Zap size={32} className="gm-spinner" style={{ width: 32, height: 32, border: 'none' }} />
              ) : (
                <span
                  className="gm-tag"
                  style={{
                    fontSize: 13,
                    padding: '8px 14px',
                    background:
                      result === 'win' ? '#dcfce7' : result === 'lose' ? '#fee2e2' : '#f1f5f9',
                    color: result === 'win' ? '#166534' : result === 'lose' ? '#991b1b' : '#475569',
                  }}
                >
                  {result === 'win' ? 'You win' : result === 'lose' ? 'CPU wins' : 'Draw'}
                </span>
              )}
            </div>
            <ChoiceReveal label="CPU" choice={computerChoice} hidden={gameState === 'REVEAL'} />
          </div>
        )}

        {gameState === 'RESULT' && (
          <div style={{ textAlign: 'center', marginTop: 20 }}>
            <button type="button" className="gm-btn-play" onClick={() => setGameState('CHOOSING')}>
              Next round
            </button>
          </div>
        )}

        <GameFooter
          onBack={onBack}
          onReset={resetScores}
          center={difficultyLabel(game?.difficulty)}
        />
      </div>
    </GameShell>
  );
};

function ChoiceReveal({ label, choice, hidden }) {
  if (!choice) return null;
  const Icon = choice.icon;
  return (
    <div style={{ textAlign: 'center' }}>
      <div
        className="gm-option-icon"
        style={{
          background: hidden ? '#94a3b8' : choice.color,
          width: 88,
          height: 88,
          margin: '0 auto',
        }}
      >
        {hidden ? <Zap size={36} color="#fff" /> : <Icon size={36} aria-hidden="true" />}
      </div>
      <p className="gm-turn-pill-label" style={{ marginTop: 8 }}>{label}</p>
    </div>
  );
}

export default RockPaperScissors;
