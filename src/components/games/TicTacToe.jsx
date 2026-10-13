import { useState, useEffect, useCallback } from 'react';
import { gameScoreAPI, employeeAPI } from '../../services/api';
import { Trophy, User, Monitor, X, Circle } from 'lucide-react';
import { GameShell, GameFooter, GameResultModal, difficultyLabel } from './gameUi';
import '../../pages/Games.css';

const TicTacToe = ({ game, onBack }) => {
  const [employeeDbId, setEmployeeDbId] = useState(null);
  const [board, setBoard] = useState(Array(9).fill(null));
  const [isPlayerTurn, setIsPlayerTurn] = useState(true);
  const [startTime, setStartTime] = useState(Date.now());
  const [moves, setMoves] = useState(0);
  const [scoreSubmitted, setScoreSubmitted] = useState(false);
  const [gameStatus, setGameStatus] = useState('playing');
  const [winningLine, setWinningLine] = useState(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await employeeAPI.getEmployeeProfile();
        if (res?.data?.id) setEmployeeDbId(res.data.id);
      } catch { /* ignore */ }
    };
    fetchProfile();
  }, []);

  const checkWinResult = useCallback((b) => {
    const lines = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8],
      [0, 3, 6], [1, 4, 7], [2, 5, 8],
      [0, 4, 8], [2, 4, 6],
    ];
    for (const [w1, w2, w3] of lines) {
      if (b[w1] && b[w1] === b[w2] && b[w1] === b[w3]) {
        return { winner: b[w1], line: lines.find((l) => l.includes(w1)) };
      }
    }
    return null;
  }, []);

  const submitScore = async (isWinner, status) => {
    try {
      if (!employeeDbId) return;
      const timeTaken = Math.max(0, Math.floor((Date.now() - startTime) / 1000));
      const finalScore = isWinner ? 100 : status === 'draw' ? 50 : 10;
      await gameScoreAPI.submitScore({
        employeeId: employeeDbId,
        gameName: 'Tic Tac Toe',
        difficulty: game?.difficulty || 'EASY',
        score: finalScore,
        timeTaken,
        movesCount: moves + 1,
      });
    } catch { /* ignore */ }
  };

  const handleGameEnd = (status, line = null) => {
    setGameStatus(status);
    if (line) setWinningLine(line);
    if (!scoreSubmitted) {
      submitScore(status === 'won', status);
      setScoreSubmitted(true);
    }
  };

  const makeCPUMove = useCallback(() => {
    const availableMoves = board
      .map((cell, index) => (cell === null ? index : null))
      .filter((i) => i !== null);
    if (availableMoves.length === 0) return;

    let bestMove = availableMoves[0];
    const difficulty = game?.difficulty || 'EASY';

    if (difficulty === 'EASY') {
      bestMove = availableMoves[Math.floor(Math.random() * availableMoves.length)];
    } else {
      let cpuWin = null;
      let playerBlock = null;
      for (const move of availableMoves) {
        const b = [...board];
        b[move] = 'O';
        if (checkWinResult(b)) {
          cpuWin = move;
          break;
        }
      }
      if (cpuWin !== null) bestMove = cpuWin;
      else {
        for (const move of availableMoves) {
          const b = [...board];
          b[move] = 'X';
          if (checkWinResult(b)) {
            playerBlock = move;
            break;
          }
        }
        if (playerBlock !== null) bestMove = playerBlock;
        else if (board[4] === null) bestMove = 4;
        else bestMove = availableMoves[Math.floor(Math.random() * availableMoves.length)];
      }
    }

    const newBoard = [...board];
    newBoard[bestMove] = 'O';
    setBoard(newBoard);
    setMoves((m) => m + 1);

    const win = checkWinResult(newBoard);
    if (win) handleGameEnd('lost', win.line);
    else if (newBoard.every((cell) => cell !== null)) handleGameEnd('draw');
    else setIsPlayerTurn(true);
  }, [board, game?.difficulty, checkWinResult]);

  useEffect(() => {
    if (!isPlayerTurn && gameStatus === 'playing') {
      const t = setTimeout(makeCPUMove, 500);
      return () => clearTimeout(t);
    }
  }, [isPlayerTurn, gameStatus, makeCPUMove]);

  const handleClick = (i) => {
    if (board[i] || gameStatus !== 'playing' || !isPlayerTurn) return;
    const newBoard = [...board];
    newBoard[i] = 'X';
    setBoard(newBoard);
    setMoves((m) => m + 1);
    const win = checkWinResult(newBoard);
    if (win) handleGameEnd('won', win.line);
    else if (newBoard.every((cell) => cell !== null)) handleGameEnd('draw');
    else setIsPlayerTurn(false);
  };

  const reset = () => {
    setBoard(Array(9).fill(null));
    setIsPlayerTurn(true);
    setStartTime(Date.now());
    setMoves(0);
    setScoreSubmitted(false);
    setGameStatus('playing');
    setWinningLine(null);
  };

  const resultVariant =
    gameStatus === 'won' ? 'win' : gameStatus === 'lost' ? 'lose' : 'draw';

  return (
    <GameShell gameName="Tic Tac Toe" difficulty={game?.difficulty} onBack={onBack}>
      <div className="gm-screen">
        <p className="gm-start-desc" style={{ textAlign: 'center', marginBottom: 16 }}>
          {difficultyLabel(game?.difficulty)} vs CPU — you are X
        </p>

        <div className="gm-turn-pills">
          <div className={`gm-turn-pill ${isPlayerTurn && gameStatus === 'playing' ? 'active' : ''}`}>
            <User size={20} style={{ color: '#4f46e5', margin: '0 auto 6px' }} />
            <span className="gm-turn-pill-label">You (X)</span>
          </div>
          <div className={`gm-turn-pill ${!isPlayerTurn && gameStatus === 'playing' ? 'active' : ''}`}>
            <Monitor size={20} style={{ color: '#ea580c', margin: '0 auto 6px' }} />
            <span className="gm-turn-pill-label">CPU (O)</span>
          </div>
        </div>

        <div className="gm-board">
          <div className="gm-board-grid-3">
            {board.map((cell, idx) => {
              const win = winningLine?.includes(idx);
              return (
                <button
                  key={idx}
                  type="button"
                  className={`gm-cell ${win ? 'gm-cell-win' : ''}`}
                  onClick={() => handleClick(idx)}
                  disabled={!!cell || !isPlayerTurn || gameStatus !== 'playing'}
                  aria-label={cell ? `Cell ${cell}` : 'Empty cell'}
                >
                  {cell === 'X' && <X size={48} strokeWidth={2.5} color={win ? '#fff' : '#4f46e5'} />}
                  {cell === 'O' && <Circle size={44} strokeWidth={2.5} color={win ? '#fff' : '#ea580c'} />}
                </button>
              );
            })}
          </div>
        </div>

        <GameFooter onBack={onBack} onReset={reset} center={`Moves: ${moves}`} />
      </div>

      <GameResultModal
        open={gameStatus !== 'playing'}
        variant={resultVariant}
        title={gameStatus === 'won' ? 'You win!' : gameStatus === 'lost' ? 'CPU wins' : 'Draw'}
        subtitle="Score saved to the leaderboard"
        icon={Trophy}
        onPrimary={reset}
        primaryLabel="Play again"
        onSecondary={onBack}
        secondaryLabel="Back to arcade"
      />
    </GameShell>
  );
};

export default TicTacToe;
