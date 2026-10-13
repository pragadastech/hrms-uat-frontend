import { useState, useEffect } from 'react';
import { gameScoreAPI, employeeAPI } from '../../services/api';
import {
  BrainCircuit,
  Trophy,
  Heart,
  Zap,
  Star,
  Sparkles,
  Flame,
  Moon,
  Sun,
  Ghost,
} from 'lucide-react';
import {
  GameShell,
  GameHud,
  GameFooter,
  GameResultModal,
  formatGameTime,
} from './gameUi';
import '../../pages/Games.css';

const PAIRS = [
  { id: 'heart', icon: Heart, color: '#e11d48' },
  { id: 'zap', icon: Zap, color: '#eab308' },
  { id: 'star', icon: Star, color: '#f59e0b' },
  { id: 'sparkles', icon: Sparkles, color: '#4f46e5' },
  { id: 'flame', icon: Flame, color: '#ea580c' },
  { id: 'moon', icon: Moon, color: '#7c3aed' },
  { id: 'sun', icon: Sun, color: '#fbbf24' },
  { id: 'ghost', icon: Ghost, color: '#64748b' },
];

const MemoryMatch = ({ game, onBack }) => {
  const [employeeDbId, setEmployeeDbId] = useState(null);
  const [cards, setCards] = useState([]);
  const [flipped, setFlipped] = useState([]);
  const [matched, setMatched] = useState([]);
  const [moves, setMoves] = useState(0);
  const [gameState, setGameState] = useState('PLAYING');
  const [timeLeft, setTimeLeft] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const initializeGame = () => {
    const deck = [...PAIRS, ...PAIRS]
      .sort(() => Math.random() - 0.5)
      .map((item, index) => ({ ...item, key: index }));
    setCards(deck);
    setFlipped([]);
    setMatched([]);
    setMoves(0);
    setTimeLeft(0);
    setGameState('PLAYING');
  };

  useEffect(() => {
    employeeAPI.getEmployeeProfile().then((res) => {
      if (res?.data?.id) setEmployeeDbId(res.data.id);
    }).catch(() => {});
    initializeGame();
  }, []);

  useEffect(() => {
    let timer;
    if (gameState === 'PLAYING') {
      timer = setInterval(() => setTimeLeft((p) => p + 1), 1000);
    }
    return () => clearInterval(timer);
  }, [gameState]);

  const finishGame = async (finalMoves) => {
    setGameState('WON');
    if (employeeDbId) {
      setIsSubmitting(true);
      try {
        await gameScoreAPI.submitScore({
          employeeId: employeeDbId,
          gameName: 'Memory Match',
          difficulty: game?.difficulty || 'MEDIUM',
          score: Math.max(10, 500 - finalMoves * 5 - timeLeft),
          timeTaken: timeLeft,
          movesCount: finalMoves,
        });
      } catch { /* ignore */ }
      setIsSubmitting(false);
    }
  };

  const handleCardClick = (index) => {
    if (
      flipped.length >= 2 ||
      flipped.includes(index) ||
      matched.includes(index) ||
      gameState !== 'PLAYING'
    ) {
      return;
    }

    const newFlipped = [...flipped, index];
    setFlipped(newFlipped);

    if (newFlipped.length === 2) {
      const nextMoves = moves + 1;
      setMoves(nextMoves);
      const [f, s] = newFlipped;
      if (cards[f].id === cards[s].id) {
        const newMatched = [...matched, f, s];
        setMatched(newMatched);
        setFlipped([]);
        if (newMatched.length === cards.length) finishGame(nextMoves);
      } else {
        setTimeout(() => setFlipped([]), 800);
      }
    }
  };

  return (
    <GameShell gameName="Memory Match" difficulty={game?.difficulty} onBack={onBack}>
      <div className="gm-screen">
        <GameHud
          items={[
            { label: 'Time', value: formatGameTime(timeLeft) },
            { label: 'Moves', value: moves },
            { label: 'Pairs', value: `${matched.length / 2}/8`, highlight: true },
          ]}
        />

        <div className="gm-memory-grid">
          {cards.map((card, idx) => {
            const isFlipped = flipped.includes(idx) || matched.includes(idx);
            const isMatched = matched.includes(idx);
            const Icon = card.icon;
            return (
              <button
                key={card.key}
                type="button"
                className={`gm-memory-card ${isFlipped ? 'flipped' : ''} ${isMatched ? 'matched' : ''}`}
                onClick={() => handleCardClick(idx)}
                disabled={isMatched || isFlipped}
                aria-label={isFlipped ? card.id : 'Hidden card'}
              >
                {isFlipped ? (
                  <Icon size={28} style={{ color: card.color }} aria-hidden="true" />
                ) : (
                  <BrainCircuit size={28} style={{ opacity: 0.5 }} aria-hidden="true" />
                )}
              </button>
            );
          })}
        </div>

        <GameFooter onBack={onBack} onReset={initializeGame} />
      </div>

      <GameResultModal
        open={gameState === 'WON'}
        variant="win"
        title="Board cleared!"
        subtitle={`${moves} moves in ${formatGameTime(timeLeft)}`}
        icon={Trophy}
        onPrimary={initializeGame}
        primaryLabel="Play again"
        onSecondary={onBack}
        secondaryLabel="Back to arcade"
      />

      {isSubmitting && (
        <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--gm-text-muted)', marginTop: 8 }}>
          Saving score…
        </p>
      )}
    </GameShell>
  );
};

export default MemoryMatch;
