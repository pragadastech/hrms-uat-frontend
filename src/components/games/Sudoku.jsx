import { useEffect, useState, useCallback } from 'react';
import { gameScoreAPI, employeeAPI } from '../../services/api';
import { RefreshCw, Lightbulb, Timer, Zap, Trophy } from 'lucide-react';
import {
  GameShell,
  GameStartScreen,
  GameHud,
  GameFooter,
  formatGameTime,
} from './gameUi';
import '../../pages/Games.css';

// Generates a valid Sudoku board
const generateSolvedSudoku = () => {
    const board = Array(9).fill(null).map(() => Array(9).fill(0));
    const fillBoard = (b) => {
        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                if (b[r][c] === 0) {
                    const nums = [1, 2, 3, 4, 5, 6, 7, 8, 9].sort(() => Math.random() - 0.5);
                    for (let n of nums) {
                        if (isValid(b, r, c, n)) {
                            b[r][c] = n;
                            if (fillBoard(b)) return true;
                            b[r][c] = 0;
                        }
                    }
                    return false;
                }
            }
        }
        return true;
    };
    fillBoard(board);
    return board;
};

const isValid = (board, r, c, n) => {
    for (let i = 0; i < 9; i++) {
        if (board[r][i] === n || board[i][c] === n) return false;
    }
    const br = Math.floor(r / 3) * 3;
    const bc = Math.floor(c / 3) * 3;
    for (let i = br; i < br + 3; i++) {
        for (let j = bc; j < bc + 3; j++) {
            if (board[i][j] === n) return false;
        }
    }
    return true;
};

const removeCells = (solved, difficulty) => {
    const puzzle = solved.map(r => [...r]);
    const attempts = { EASY: 30, MEDIUM: 45, HARD: 55, EXPERT: 62 }[difficulty] || 40;
    let count = 0;
    while (count < attempts) {
        const r = Math.floor(Math.random() * 9);
        const c = Math.floor(Math.random() * 9);
        if (puzzle[r][c] !== 0) {
            puzzle[r][c] = 0;
            count++;
        }
    }
    return puzzle;
};

const Sudoku = ({ game, onBack }) => {
    const [employeeDbId, setEmployeeDbId] = useState(null);
    const [grid, setGrid] = useState([]);
    const [fixed, setFixed] = useState([]);
    const [solved, setSolved] = useState([]);
    const [selected, setSelected] = useState(null);
    const [gameState, setGameState] = useState('START'); // START, PLAYING, FINISHED
    const [timeLeft, setTimeLeft] = useState(0);
    const [moves, setMoves] = useState(0);
    const [hints, setHints] = useState(3);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const res = await employeeAPI.getEmployeeProfile();
                if (res?.data?.id) setEmployeeDbId(res.data.id);
            } catch { }
        };
        fetchProfile();
    }, []);

    const startNewGame = useCallback(() => {
        const full = generateSolvedSudoku();
        const puzzle = removeCells(full, game?.difficulty || 'MEDIUM');
        setSolved(full);
        setGrid(puzzle);
        setFixed(puzzle.map(r => r.map(c => c !== 0)));
        setTimeLeft(0);
        setMoves(0);
        setHints(3);
        setGameState('PLAYING');
        setSelected(null);
    }, [game]);

    useEffect(() => {
        let timer;
        if (gameState === 'PLAYING') {
            timer = setInterval(() => setTimeLeft(prev => prev + 1), 1000);
        }
        return () => clearInterval(timer);
    }, [gameState]);

    const handleCellClick = (r, c) => {
        if (gameState !== 'PLAYING') return;
        setSelected([r, c]);
    };

    const handleNumberInput = (num) => {
        if (!selected || fixed[selected[0]][selected[1]] || gameState !== 'PLAYING') return;
        const [r, c] = selected;
        const newGrid = grid.map(row => [...row]);
        newGrid[r][c] = num === grid[r][c] ? 0 : num;
        setGrid(newGrid);
        setMoves(prev => prev + 1);

        // Check completion
        if (newGrid.every((row, ri) => row.every((val, ci) => val === solved[ri][ci]))) {
            finishGame();
        }
    };

    const handleHint = () => {
        if (!selected || hints <= 0 || fixed[selected[0]][selected[1]] || gameState !== 'PLAYING') return;
        const [r, c] = selected;
        const newGrid = grid.map(row => [...row]);
        newGrid[r][c] = solved[r][c];
        setGrid(newGrid);
        setHints(prev => prev - 1);
        
        if (newGrid.every((row, ri) => row.every((val, ci) => val === solved[ri][ci]))) {
            finishGame();
        }
    };

    const finishGame = async () => {
        setGameState('FINISHED');
        if (employeeDbId) {
            setIsSubmitting(true);
            try {
                await gameScoreAPI.submitScore({
                    employeeId: employeeDbId,
                    gameName: 'Sudoku',
                    difficulty: game?.difficulty || 'MEDIUM',
                    score: Math.max(100, 2000 - timeLeft),
                    timeTaken: timeLeft,
                    movesCount: moves
                });
            } catch { }
            setIsSubmitting(false);
        }
    };

    return (
        <GameShell gameName="Sudoku" difficulty={game?.difficulty} onBack={onBack}>
            {gameState === 'START' && (
                <GameStartScreen
                    icon={Zap}
                    title="Sudoku"
                    description={`Logic puzzle at ${game?.difficulty || 'MEDIUM'} difficulty. Fill every row, column, and box.`}
                    accent="#7c3aed"
                    accentSoft="#f5f3ff"
                    onStart={startNewGame}
                    onBack={onBack}
                    startLabel="New puzzle"
                />
            )}

            {gameState === 'PLAYING' && (
                <div className="gm-screen gm-play-layout">
                    <div style={{ flex: '1 1 320px', maxWidth: 440 }}>
                        <GameHud
                            items={[
                                {
                                    label: 'Time',
                                    value: formatGameTime(timeLeft),
                                    icon: <Timer size={18} />,
                                },
                                { label: 'Moves', value: moves },
                                { label: 'Hints', value: hints },
                            ]}
                        />
                        <div style={{ display: 'flex', gap: 8, marginBottom: 12, justifyContent: 'flex-end' }}>
                            <button
                                type="button"
                                className="gm-btn-icon"
                                onClick={handleHint}
                                disabled={hints <= 0}
                                title="Hint"
                            >
                                <Lightbulb size={18} /> {hints}
                            </button>
                            <button type="button" className="gm-btn-icon" onClick={startNewGame} title="New game">
                                <RefreshCw size={18} />
                            </button>
                        </div>
                        <div className="gm-sudoku-grid">
                            {grid.map((row, r) =>
                                row.map((cell, c) => {
                                    const isSelected = selected?.[0] === r && selected?.[1] === c;
                                    const highlight =
                                        selected &&
                                        (selected[0] === r ||
                                            selected[1] === c ||
                                            (Math.floor(selected[0] / 3) === Math.floor(r / 3) &&
                                                Math.floor(selected[1] / 3) === Math.floor(c / 3)));
                                    const isInitial = fixed[r]?.[c];
                                    const isWrong = cell !== 0 && cell !== solved[r][c];
                                    let cls = 'gm-sudoku-cell';
                                    if (isSelected) cls += ' selected';
                                    else if (highlight) cls += ' hint-zone';
                                    if (isInitial) cls += ' fixed';
                                    if (isWrong && !isSelected) cls += ' wrong';
                                    return (
                                        <button
                                            key={`${r}-${c}`}
                                            type="button"
                                            className={cls}
                                            onClick={() => handleCellClick(r, c)}
                                        >
                                            {cell !== 0 ? cell : ''}
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    </div>
                    <div>
                        <div className="gm-numpad">
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                                <button
                                    key={num}
                                    type="button"
                                    className="gm-numpad-btn"
                                    onClick={() => handleNumberInput(num)}
                                >
                                    {num}
                                </button>
                            ))}
                        </div>
                        <button
                            type="button"
                            className="gm-btn-ghost"
                            style={{ width: '100%', marginTop: 10 }}
                            onClick={() => handleNumberInput(0)}
                        >
                            Clear cell
                        </button>
                        <GameFooter onBack={onBack} onReset={startNewGame} />
                    </div>
                </div>
            )}

            {gameState === 'FINISHED' && (
                <div className="gm-finish-card">
                    <Trophy size={48} style={{ color: '#7c3aed', marginBottom: 12 }} />
                    <h2 className="gm-start-title">Puzzle solved!</h2>
                    <p className="gm-start-desc">Completed in {formatGameTime(timeLeft)} with {moves} moves.</p>
                    <div className="gm-finish-stats">
                        <div className="gm-finish-stat">
                            <span>Time</span>
                            <strong>{formatGameTime(timeLeft)}</strong>
                        </div>
                        <div className="gm-finish-stat">
                            <span>Moves</span>
                            <strong>{moves}</strong>
                        </div>
                    </div>
                    <div className="gm-start-actions">
                        <button type="button" className="gm-btn-play" style={{ background: '#7c3aed' }} onClick={startNewGame}>
                            <Zap size={18} /> New puzzle
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

export default Sudoku;
