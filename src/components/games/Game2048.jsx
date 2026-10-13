import { useState, useEffect, useCallback } from 'react';
import { gameScoreAPI, employeeAPI } from '../../services/api';
import { Trophy, ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  GameShell,
  GameHud,
  GameFooter,
  GameResultModal,
} from './gameUi';
import '../../pages/Games.css';

const GRID_SIZE = 4;

const tileBg = (v) => {
  const map = {
    0: '#e2e8f0',
    2: '#eef2ff',
    4: '#e0e7ff',
    8: '#c7d2fe',
    16: '#a5b4fc',
    32: '#818cf8',
    64: '#6366f1',
    128: '#8b5cf6',
    256: '#7c3aed',
    512: '#6d28d9',
    1024: '#db2777',
    2048: '#f97316',
  };
  return map[v] || '#1e1b4b';
};

const Game2048 = ({ game, onBack }) => {
  const [employeeDbId, setEmployeeDbId] = useState(null);
  const [grid, setGrid] = useState(() => initializeGrid());
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(0);
  const [gameState, setGameState] = useState('PLAYING');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    employeeAPI.getEmployeeProfile().then((res) => {
      if (res?.data?.id) setEmployeeDbId(res.data.id);
    }).catch(() => {});
  }, []);

  function initializeGrid() {
    const newGrid = Array(GRID_SIZE)
      .fill(null)
      .map(() => Array(GRID_SIZE).fill(0));
    addRandomTile(newGrid);
    addRandomTile(newGrid);
    return newGrid;
  }

  function addRandomTile(g) {
    const emptyCells = [];
    for (let i = 0; i < GRID_SIZE; i++) {
      for (let j = 0; j < GRID_SIZE; j++) {
        if (g[i][j] === 0) emptyCells.push({ r: i, c: j });
      }
    }
    if (emptyCells.length > 0) {
      const { r, c } = emptyCells[Math.floor(Math.random() * emptyCells.length)];
      g[r][c] = Math.random() < 0.9 ? 2 : 4;
    }
  }

  const moveRight = (g) => {
    let newGrid = [];
    let scoreAdd = 0;
    for (let i = 0; i < GRID_SIZE; i++) {
      let row = g[i].filter((v) => v !== 0);
      for (let j = row.length - 1; j > 0; j--) {
        if (row[j] === row[j - 1]) {
          row[j] *= 2;
          scoreAdd += row[j];
          row[j - 1] = 0;
          if (row[j] === 2048) setGameState('WON');
        }
      }
      row = row.filter((v) => v !== 0);
      while (row.length < GRID_SIZE) row.unshift(0);
      newGrid.push(row);
    }
    return { grid: newGrid, scoreAdd };
  };

  const rotate = (g) => {
    const newGrid = Array(GRID_SIZE)
      .fill(null)
      .map(() => Array(GRID_SIZE).fill(0));
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        newGrid[c][GRID_SIZE - 1 - r] = g[r][c];
      }
    }
    return newGrid;
  };

  const isDead = (g) => {
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        if (g[r][c] === 0) return false;
        if (c < 3 && g[r][c] === g[r][c + 1]) return false;
        if (r < 3 && g[r][c] === g[r + 1][c]) return false;
      }
    }
    return true;
  };

  const finishGame = async (finalScore) => {
    setGameState('GAMEOVER');
    if (employeeDbId) {
      setIsSubmitting(true);
      try {
        await gameScoreAPI.submitScore({
          employeeId: employeeDbId,
          gameName: '2048',
          difficulty: game?.difficulty || 'MEDIUM',
          score: finalScore,
          timeTaken: 0,
          movesCount: 0,
        });
      } catch { /* ignore */ }
      setIsSubmitting(false);
    }
  };

  const handleMove = useCallback(
    (dir) => {
      if (gameState === 'GAMEOVER') return;
      let currentGrid = grid.map((r) => [...r]);
      const rotations = { right: 0, down: 1, left: 2, up: 3 }[dir];

      for (let i = 0; i < rotations; i++) currentGrid = rotate(currentGrid);
      const { grid: moved, scoreAdd } = moveRight(currentGrid);

      let backRotated = moved;
      for (let i = 0; i < (4 - rotations) % 4; i++) backRotated = rotate(backRotated);

      if (JSON.stringify(grid) !== JSON.stringify(backRotated)) {
        addRandomTile(backRotated);
        const newScore = score + scoreAdd;
        setScore(newScore);
        if (newScore > bestScore) setBestScore(newScore);
        setGrid(backRotated);
        if (isDead(backRotated)) finishGame(newScore);
      }
    },
    [grid, score, gameState, bestScore]
  );

  useEffect(() => {
    const keys = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
    const listener = (e) => {
      if (keys[e.key]) {
        e.preventDefault();
        handleMove(keys[e.key]);
      }
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, [handleMove]);

  const reset = () => {
    setGrid(initializeGrid());
    setScore(0);
    setGameState('PLAYING');
  };

  return (
    <GameShell gameName="2048" difficulty={game?.difficulty} onBack={onBack}>
      <div className="gm-screen">
        <GameHud
          items={[
            { label: 'Score', value: score, highlight: true },
            { label: 'Best', value: Math.max(score, bestScore) },
          ]}
        />

        <div className="gm-grid-2048">
          {grid.map((row, r) =>
            row.map((cell, c) => (
              <div
                key={`${r}-${c}`}
                className="gm-tile-2048"
                style={{
                  background: tileBg(cell),
                  color: cell >= 8 ? '#fff' : 'var(--gm-text)',
                  fontSize: cell >= 1000 ? 14 : undefined,
                }}
              >
                {cell !== 0 ? cell : ''}
              </div>
            ))
          )}
        </div>

        <div className="gm-dpad" style={{ marginTop: 16 }}>
          <button type="button" className="gm-dpad-btn" onClick={() => handleMove('up')} aria-label="Up">
            <ChevronUp size={22} />
          </button>
          <div className="gm-dpad-row">
            <button type="button" className="gm-dpad-btn" onClick={() => handleMove('left')} aria-label="Left">
              <ChevronLeft size={22} />
            </button>
            <button type="button" className="gm-dpad-btn" onClick={() => handleMove('down')} aria-label="Down">
              <ChevronDown size={22} />
            </button>
            <button type="button" className="gm-dpad-btn" onClick={() => handleMove('right')} aria-label="Right">
              <ChevronRight size={22} />
            </button>
          </div>
        </div>

        <GameFooter onBack={onBack} onReset={reset} center="Arrow keys or pad" />
      </div>

      <GameResultModal
        open={gameState === 'WON' || gameState === 'GAMEOVER'}
        variant={gameState === 'WON' ? 'win' : 'default'}
        title={gameState === 'WON' ? 'You reached 2048!' : 'No moves left'}
        subtitle={`Final score: ${score}`}
        icon={Trophy}
        onPrimary={reset}
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

export default Game2048;
