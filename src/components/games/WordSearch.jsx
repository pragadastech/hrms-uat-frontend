import { useState, useEffect, useCallback } from 'react';
import { Search, Timer, Trophy, Zap, CheckCircle2 } from 'lucide-react';
import { gameScoreAPI, employeeAPI } from '../../services/api';
import {
  GameShell,
  GameStartScreen,
  GameHud,
  GameFooter,
  formatGameTime,
} from './gameUi';
import '../../pages/Games.css';

const WordSearch = ({ game, onBack }) => {
    const [employeeDbId, setEmployeeDbId] = useState(null);
    const [grid, setGrid] = useState([]);
    const [words, setWords] = useState([]);
    const [foundWords, setFoundWords] = useState([]);
    const [selection, setSelection] = useState({ start: null, end: null, active: false });
    const [gameState, setGameState] = useState('START'); // START, PLAYING, FINISHED
    const [timeLeft, setTimeLeft] = useState(0);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [highScore, setHighScore] = useState(0);

    const GRID_SIZE = 10;
    const WORD_LISTS = {
        MEDIUM: ['REACT', 'NODE', 'CSS', 'JAVASCRIPT', 'VITE', 'TAILWIND', 'HTML', 'PRAGVA', 'HRMS', 'OFFICE'],
        HARD: ['DEVELOPMENT', 'ENGINEERING', 'ARCHITECTURE', 'MANAGEMENT', 'PERFORMANCE', 'ANALYTICS', 'CLOUD', 'DATABASE', 'SECURITY', 'INFRASTRUCTURE'],
    };

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const res = await employeeAPI.getEmployeeProfile();
                if (res?.data?.id) setEmployeeDbId(res.data.id);
            } catch (err) { }
        };
        fetchProfile();
    }, []);

    const generateGrid = useCallback(() => {
        const difficulty = game?.difficulty || 'MEDIUM';
        const list = WORD_LISTS[difficulty === 'EXPERT' || difficulty === 'HARD' ? 'HARD' : 'MEDIUM'];
        const selectedWords = [...list].sort(() => Math.random() - 0.5).slice(0, 6);
        
        const newGrid = Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(''));
        const placedWords = [];

        selectedWords.forEach(word => {
            let placed = false;
            let attempts = 0;
            while (!placed && attempts < 100) {
                const direction = Math.floor(Math.random() * 3); // 0: horizontal, 1: vertical, 2: diagonal
                const row = Math.floor(Math.random() * GRID_SIZE);
                const col = Math.floor(Math.random() * GRID_SIZE);
                
                if (canPlaceWord(newGrid, word, row, col, direction)) {
                    placeWord(newGrid, word, row, col, direction);
                    placedWords.push(word);
                    placed = true;
                }
                attempts++;
            }
        });

        // Fill empty cells
        const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        for (let r = 0; r < GRID_SIZE; r++) {
            for (let c = 0; c < GRID_SIZE; c++) {
                if (newGrid[r][c] === '') {
                    newGrid[r][c] = alphabet[Math.floor(Math.random() * alphabet.length)];
                }
            }
        }

        setGrid(newGrid);
        setWords(placedWords);
        setFoundWords([]);
        setTimeLeft(0);
        setGameState('PLAYING');
    }, [game]);

    const canPlaceWord = (grid, word, r, c, dir) => {
        if (dir === 0) { // Horizontal
            if (c + word.length > GRID_SIZE) return false;
            for (let i = 0; i < word.length; i++) {
                if (grid[r][c + i] !== '' && grid[r][c + i] !== word[i]) return false;
            }
        } else if (dir === 1) { // Vertical
            if (r + word.length > GRID_SIZE) return false;
            for (let i = 0; i < word.length; i++) {
                if (grid[r + i][c] !== '' && grid[r + i][c] !== word[i]) return false;
            }
        } else { // Diagonal
            if (r + word.length > GRID_SIZE || c + word.length > GRID_SIZE) return false;
            for (let i = 0; i < word.length; i++) {
                if (grid[r + i][c + i] !== '' && grid[r + i][c + i] !== word[i]) return false;
            }
        }
        return true;
    };

    const placeWord = (grid, word, r, c, dir) => {
        for (let i = 0; i < word.length; i++) {
            if (dir === 0) grid[r][c + i] = word[i];
            else if (dir === 1) grid[r + i][c] = word[i];
            else grid[r + i][c + i] = word[i];
        }
    };

    useEffect(() => {
        let timer;
        if (gameState === 'PLAYING') {
            timer = setInterval(() => setTimeLeft(prev => prev + 1), 1000);
        }
        return () => clearInterval(timer);
    }, [gameState]);

    const handleCellAction = (r, c, type) => {
        if (gameState !== 'PLAYING') return;

        if (type === 'START') {
            setSelection({ start: { r, c }, end: { r, c }, active: true });
        } else if (type === 'MOVE' && selection.active) {
            setSelection(prev => ({ ...prev, end: { r, c } }));
        } else if (type === 'END') {
            checkSelection();
            setSelection({ start: null, end: null, active: false });
        }
    };

    const checkSelection = () => {
        const { start, end } = selection;
        if (!start || !end) return;

        let selectedWord = '';
        const coords = [];

        if (start.r === end.r) { // Horizontal
            const minC = Math.min(start.c, end.c);
            const maxC = Math.max(start.c, end.c);
            for (let c = minC; c <= maxC; c++) {
                selectedWord += grid[start.r][c];
                coords.push(`${start.r}-${c}`);
            }
        } else if (start.c === end.c) { // Vertical
            const minR = Math.min(start.r, end.r);
            const maxR = Math.max(start.r, end.r);
            for (let r = minR; r <= maxR; r++) {
                selectedWord += grid[r][start.c];
                coords.push(`${r}-${start.c}`);
            }
        } else if (Math.abs(start.r - end.r) === Math.abs(start.c - end.c)) { // Diagonal
            const rDir = end.r > start.r ? 1 : -1;
            const cDir = end.c > start.c ? 1 : -1;
            const length = Math.abs(start.r - end.r);
            for (let i = 0; i <= length; i++) {
                const r = start.r + i * rDir;
                const c = start.c + i * cDir;
                selectedWord += grid[r][c];
                coords.push(`${r}-${c}`);
            }
        }

        const reversed = selectedWord.split('').reverse().join('');
        if (words.includes(selectedWord) && !foundWords.includes(selectedWord)) {
            markWordFound(selectedWord, coords);
        } else if (words.includes(reversed) && !foundWords.includes(reversed)) {
            markWordFound(reversed, coords);
        }
    };

    const markWordFound = (word, coords) => {
        setFoundWords(prev => {
            const newFound = [...prev, word];
            if (newFound.length === words.length) {
                setTimeout(finishGame, 500);
            }
            return newFound;
        });
    };

    const finishGame = async () => {
        setGameState('FINISHED');
        const finalScore = Math.max(100, 2000 - timeLeft * 5);
        if (finalScore > highScore) setHighScore(finalScore);

        if (employeeDbId) {
            setIsSubmitting(true);
            try {
                await gameScoreAPI.submitScore({
                    employeeId: employeeDbId,
                    gameName: 'Word Search',
                    difficulty: game?.difficulty || 'MEDIUM',
                    score: finalScore,
                    timeTaken: timeLeft,
                    movesCount: foundWords.length
                });
            } catch (err) { }
            setIsSubmitting(false);
        }
    };

    return (
        <GameShell gameName="Word Search" difficulty={game?.difficulty} onBack={onBack}>
            {gameState === 'START' && (
                <GameStartScreen
                    icon={Search}
                    title="Word search"
                    description="Drag across letters to find hidden words. Horizontal, vertical, or diagonal."
                    accent="#0d9488"
                    accentSoft="#f0fdfa"
                    onStart={generateGrid}
                    onBack={onBack}
                    startLabel="Start search"
                />
            )}

            {gameState === 'PLAYING' && (
                <div className="gm-screen gm-play-layout">
                    <div style={{ flex: '1 1 280px', maxWidth: 400 }}>
                        <GameHud
                            items={[
                                {
                                    label: 'Time',
                                    value: formatGameTime(timeLeft),
                                    icon: <Timer size={18} />,
                                },
                                {
                                    label: 'Found',
                                    value: `${foundWords.length}/${words.length}`,
                                    highlight: true,
                                },
                            ]}
                        />
                        <div
                            className="gm-letter-grid"
                            style={{ gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)` }}
                            onMouseLeave={() =>
                                selection.active && setSelection({ start: null, end: null, active: false })
                            }
                        >
                            {grid.map((row, r) =>
                                row.map((char, c) => {
                                    const isSelected =
                                        selection.active && checkInSelection(r, c, selection);
                                    return (
                                        <div
                                            key={`${r}-${c}`}
                                            role="button"
                                            tabIndex={0}
                                            onMouseDown={() => handleCellAction(r, c, 'START')}
                                            onMouseEnter={() => handleCellAction(r, c, 'MOVE')}
                                            onMouseUp={() => handleCellAction(r, c, 'END')}
                                            className={`gm-letter-cell ${isSelected ? 'selected' : ''}`}
                                        >
                                            {char}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                    <div style={{ flex: '0 1 200px', minWidth: 180 }}>
                        <div className="gm-word-list">
                            <h4>Words to find</h4>
                            {words.map((word) => (
                                <div
                                    key={word}
                                    className={`gm-word-item ${foundWords.includes(word) ? 'found' : ''}`}
                                >
                                    {foundWords.includes(word) ? (
                                        <CheckCircle2 size={16} />
                                    ) : (
                                        <span style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid var(--gm-border)' }} />
                                    )}
                                    {word}
                                </div>
                            ))}
                        </div>
                        <GameFooter onBack={onBack} onReset={() => setGameState('START')} />
                    </div>
                </div>
            )}

            {gameState === 'FINISHED' && (
                <div className="gm-finish-card">
                    <Trophy size={48} style={{ color: '#0d9488', marginBottom: 12 }} />
                    <h2 className="gm-start-title">All words found!</h2>
                    <p className="gm-start-desc">Completed in {formatGameTime(timeLeft)}.</p>
                    <div className="gm-start-actions">
                        <button type="button" className="gm-btn-play" style={{ background: '#0d9488' }} onClick={generateGrid}>
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

// Helper to check if a cell is within current selection
const checkInSelection = (r, c, selection) => {
    const { start, end } = selection;
    if (!start || !end) return false;

    if (start.r === end.r) { // Horizontal
        return r === start.r && c >= Math.min(start.c, end.c) && c <= Math.max(start.c, end.c);
    } else if (start.c === end.c) { // Vertical
        return c === start.c && r >= Math.min(start.r, end.r) && r <= Math.max(start.r, end.r);
    } else if (Math.abs(start.r - end.r) === Math.abs(start.c - end.c)) { // Diagonal
        const rDir = end.r > start.r ? 1 : -1;
        const cDir = end.c > start.c ? 1 : -1;
        const length = Math.abs(start.r - end.r);
        for (let i = 0; i <= length; i++) {
            if (r === start.r + i * rDir && c === start.c + i * cDir) return true;
        }
    }
    return false;
};

export default WordSearch;
