import { useState, useEffect, useCallback, useRef } from 'react';
import { gameScoreAPI, employeeAPI } from '../../services/api';
import { Play, Trophy, ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  GameShell,
  GameStartScreen,
  GameHud,
  GameFooter,
  GameResultModal,
} from './gameUi';
import '../../pages/Games.css';

const GRID_SIZE = 20;
const INITIAL_SPEED = 140;

const Snake = ({ game, onBack }) => {
  const [employeeDbId, setEmployeeDbId] = useState(null);
  const [snake, setSnake] = useState([{ x: 10, y: 10 }]);
  const [food, setFood] = useState({ x: 15, y: 15 });
  const [direction, setDirection] = useState({ x: 1, y: 0 });
  const [gameState, setGameState] = useState('idle');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [speed, setSpeed] = useState(INITIAL_SPEED);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const gameLoopRef = useRef(null);
  const directionRef = useRef(direction);

  useEffect(() => {
    employeeAPI.getEmployeeProfile().then((res) => {
      if (res?.data?.id) setEmployeeDbId(res.data.id);
    }).catch(() => {});
  }, []);

  const generateFood = useCallback((currentSnake) => {
    let newFood;
    do {
      newFood = {
        x: Math.floor(Math.random() * GRID_SIZE),
        y: Math.floor(Math.random() * GRID_SIZE),
      };
    } while (currentSnake.some((s) => s.x === newFood.x && s.y === newFood.y));
    return newFood;
  }, []);

  const finishGame = useCallback(
    async (finalScore) => {
      setGameState('gameover');
      if (finalScore > highScore) setHighScore(finalScore);
      if (employeeDbId) {
        setIsSubmitting(true);
        try {
          await gameScoreAPI.submitScore({
            employeeId: employeeDbId,
            gameName: 'Snake',
            difficulty: game?.difficulty || 'MEDIUM',
            score: finalScore,
            timeTaken: 0,
            movesCount: Math.floor(finalScore / 10),
          });
        } catch { /* ignore */ }
        setIsSubmitting(false);
      }
    },
    [employeeDbId, game?.difficulty, highScore]
  );

  const resetGame = useCallback(() => {
    const startSnake = [{ x: 10, y: 10 }];
    setSnake(startSnake);
    setFood(generateFood(startSnake));
    setDirection({ x: 1, y: 0 });
    directionRef.current = { x: 1, y: 0 };
    setScore(0);
    setSpeed(INITIAL_SPEED);
    setGameState('idle');
  }, [generateFood]);

  const setDir = (d) => {
    if (directionRef.current.x + d.x === 0 && directionRef.current.y + d.y === 0) return;
    directionRef.current = d;
    setDirection(d);
  };

  useEffect(() => {
    if (gameState !== 'playing') {
      if (gameLoopRef.current) clearInterval(gameLoopRef.current);
      return;
    }

    gameLoopRef.current = setInterval(() => {
      setSnake((prevSnake) => {
        const head = prevSnake[0];
        const newHead = {
          x: (head.x + directionRef.current.x + GRID_SIZE) % GRID_SIZE,
          y: (head.y + directionRef.current.y + GRID_SIZE) % GRID_SIZE,
        };

        if (prevSnake.some((s) => s.x === newHead.x && s.y === newHead.y)) {
          finishGame(score);
          return prevSnake;
        }

        const newSnake = [newHead, ...prevSnake];
        if (newHead.x === food.x && newHead.y === food.y) {
          setScore((p) => p + 10);
          setFood(generateFood(newSnake));
          setSpeed((p) => Math.max(60, p - 2));
        } else {
          newSnake.pop();
        }
        return newSnake;
      });
    }, speed);

    return () => {
      if (gameLoopRef.current) clearInterval(gameLoopRef.current);
    };
  }, [gameState, speed, food, generateFood, score, finishGame]);

  useEffect(() => {
    const keys = {
      ArrowUp: { x: 0, y: -1 },
      ArrowDown: { x: 0, y: 1 },
      ArrowLeft: { x: -1, y: 0 },
      ArrowRight: { x: 1, y: 0 },
    };
    const handleKeyDown = (e) => {
      const newDir = keys[e.key];
      if (!newDir) return;
      e.preventDefault();
      if (gameState !== 'playing') return;
      setDir(newDir);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState]);

  const cellMap = new Map();
  snake.forEach((seg, i) => cellMap.set(`${seg.x}-${seg.y}`, i === 0 ? 'head' : 'body'));
  cellMap.set(`${food.x}-${food.y}`, 'food');

  return (
    <GameShell gameName="Snake" difficulty={game?.difficulty} onBack={onBack}>
      {gameState === 'idle' && (
        <GameStartScreen
          icon={Play}
          title="Snake"
          description="Use arrow keys or the pad below. Eat food, avoid your tail."
          accent="#059669"
          accentSoft="#ecfdf5"
          onStart={() => setGameState('playing')}
          onBack={onBack}
          startLabel="Start"
        />
      )}

      {(gameState === 'playing' || gameState === 'gameover') && (
        <div className="gm-screen">
          <GameHud
            items={[
              { label: 'Score', value: score, highlight: true },
              { label: 'Best', value: Math.max(score, highScore) },
              { label: 'Length', value: snake.length },
            ]}
          />

          <div className="gm-snake-canvas-wrap" tabIndex={-1} aria-label="Snake game board">
            <div
              className="gm-snake-grid"
              style={{
                gridTemplateColumns: `repeat(${GRID_SIZE}, 16px)`,
                gridTemplateRows: `repeat(${GRID_SIZE}, 16px)`,
              }}
            >
              {Array.from({ length: GRID_SIZE * GRID_SIZE }).map((_, i) => {
                const x = i % GRID_SIZE;
                const y = Math.floor(i / GRID_SIZE);
                const type = cellMap.get(`${x}-${y}`);
                let cls = 'gm-snake-cell';
                if (type === 'head') cls += ' gm-snake-head';
                else if (type === 'body') cls += ' gm-snake-body';
                else if (type === 'food') cls += ' gm-snake-food';
                return <div key={i} className={cls} />;
              })}
            </div>
          </div>

          <div className="gm-dpad">
            <button type="button" className="gm-dpad-btn" onClick={() => setDir({ x: 0, y: -1 })} aria-label="Up">
              <ChevronUp size={22} />
            </button>
            <div className="gm-dpad-row">
              <button type="button" className="gm-dpad-btn" onClick={() => setDir({ x: -1, y: 0 })} aria-label="Left">
                <ChevronLeft size={22} />
              </button>
              <button type="button" className="gm-dpad-btn" onClick={() => setDir({ x: 0, y: 1 })} aria-label="Down">
                <ChevronDown size={22} />
              </button>
              <button type="button" className="gm-dpad-btn" onClick={() => setDir({ x: 1, y: 0 })} aria-label="Right">
                <ChevronRight size={22} />
              </button>
            </div>
          </div>

          <GameFooter onBack={onBack} onReset={resetGame} />
        </div>
      )}

      <GameResultModal
        open={gameState === 'gameover'}
        variant="lose"
        title="Game over"
        subtitle={`Score: ${score}`}
        icon={Trophy}
        onPrimary={resetGame}
        primaryLabel="Play again"
        onSecondary={onBack}
        secondaryLabel="Back to arcade"
      />

      {isSubmitting && (
        <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--gm-text-muted)' }}>Saving score…</p>
      )}
    </GameShell>
  );
};

export default Snake;
