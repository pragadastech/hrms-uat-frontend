import { useState, useEffect, useCallback } from 'react';
import { Puzzle as PuzzleIcon, Trophy, RefreshCw } from 'lucide-react';
import { gameScoreAPI, employeeAPI } from '../../services/api';
import {
  GameShell,
  GameStartScreen,
  GameHud,
  GameFooter,
  formatGameTime,
} from './gameUi';
import '../../pages/Games.css';

const Puzzle = ({ game, onBack }) => {
    const [employeeDbId, setEmployeeDbId] = useState(null);
    const [gridSize, setGridSize] = useState(3); // 3x3 or 4x4
    const [tiles, setTiles] = useState([]);
    const [moves, setMoves] = useState(0);
    const [timeLeft, setTimeLeft] = useState(0);
    const [gameState, setGameState] = useState('START'); // START, PLAYING, FINISHED
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [highScore, setHighScore] = useState(0);

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const res = await employeeAPI.getEmployeeProfile();
                if (res?.data?.id) setEmployeeDbId(res.data.id);
            } catch (err) { }
        };
        fetchProfile();
    }, []);

    const isSolvable = (arr, size) => {
        let inversions = 0;
        const flat = arr.filter(n => n !== 0);
        for (let i = 0; i < flat.length; i++) {
            for (let j = i + 1; j < flat.length; j++) {
                if (flat[i] > flat[j]) inversions++;
            }
        }
        
        if (size % 2 !== 0) {
            return inversions % 2 === 0;
        } else {
            const emptyRow = Math.floor(arr.indexOf(0) / size);
            const rowFromBottom = size - emptyRow;
            return (rowFromBottom % 2 === 0) ? (inversions % 2 !== 0) : (inversions % 2 === 0);
        }
    };

    const initializePuzzle = useCallback((size) => {
        let newTiles;
        do {
            newTiles = [...Array(size * size).keys()];
            // Shuffle
            for (let i = newTiles.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [newTiles[i], newTiles[j]] = [newTiles[j], newTiles[i]];
            }
        } while (!isSolvable(newTiles, size) || isSolved(newTiles));
        
        setTiles(newTiles);
        setMoves(0);
        setTimeLeft(0);
        setGameState('PLAYING');
    }, []);

    const isSolved = (arr) => {
        if (arr.length === 0) return false;
        for (let i = 0; i < arr.length - 1; i++) {
            if (arr[i] !== i + 1) return false;
        }
        return arr[arr.length - 1] === 0;
    };

    useEffect(() => {
        let timer;
        if (gameState === 'PLAYING') {
            timer = setInterval(() => {
                setTimeLeft(prev => prev + 1);
            }, 1000);
        }
        return () => clearInterval(timer);
    }, [gameState]);

    const handleTileClick = (index) => {
        if (gameState !== 'PLAYING') return;

        const emptyIndex = tiles.indexOf(0);
        const row = Math.floor(index / gridSize);
        const col = index % gridSize;
        const emptyRow = Math.floor(emptyIndex / gridSize);
        const emptyCol = emptyIndex % gridSize;

        const isAdjacent = (Math.abs(row - emptyRow) === 1 && col === emptyCol) ||
                          (Math.abs(col - emptyCol) === 1 && row === emptyRow);

        if (isAdjacent) {
            const newTiles = [...tiles];
            [newTiles[index], newTiles[emptyIndex]] = [newTiles[emptyIndex], newTiles[index]];
            setTiles(newTiles);
            setMoves(prev => prev + 1);

            if (isSolved(newTiles)) {
                finishGame();
            }
        }
    };

    const finishGame = async () => {
        setGameState('FINISHED');
        const finalScore = Math.max(10, 1000 - moves - timeLeft);
        if (finalScore > highScore) setHighScore(finalScore);

        if (employeeDbId) {
            setIsSubmitting(true);
            try {
                await gameScoreAPI.submitScore({
                    employeeId: employeeDbId,
                    gameName: 'Puzzle',
                    difficulty: gridSize === 3 ? 'MEDIUM' : 'HARD',
                    score: finalScore,
                    timeTaken: timeLeft,
                    movesCount: moves
                });
            } catch (err) { }
            setIsSubmitting(false);
        }
    };

    return (
        <GameShell gameName="Slide Puzzle" difficulty={game?.difficulty} onBack={onBack}>
            {gameState === 'START' && (
                <GameStartScreen
                    icon={PuzzleIcon}
                    title="Slide puzzle"
                    description="Slide tiles into the empty space until numbers are in order."
                    accent="#ea580c"
                    accentSoft="#fff7ed"
                    onStart={() => initializePuzzle(gridSize)}
                    onBack={onBack}
                    startLabel="Start puzzle"
                >
                    <div className="gm-diff-grid" style={{ marginTop: 16 }}>
                        {[3, 4].map((size) => (
                            <button
                                key={size}
                                type="button"
                                className={`gm-diff-btn ${gridSize === size ? 'active' : ''}`}
                                onClick={() => setGridSize(size)}
                            >
                                {size}×{size}
                            </button>
                        ))}
                    </div>
                </GameStartScreen>
            )}

            {gameState === 'PLAYING' && (
                <div className="gm-screen">
                    <GameHud
                        items={[
                            { label: 'Moves', value: moves, highlight: true },
                            { label: 'Time', value: formatGameTime(timeLeft) },
                            { label: 'Size', value: `${gridSize}×${gridSize}` },
                        ]}
                    />
                    <div
                        className="gm-slide-grid"
                        style={{ gridTemplateColumns: `repeat(${gridSize}, 1fr)` }}
                    >
                        {tiles.map((tile, index) => {
                            const isCorrect = tile !== 0 && tile === index + 1;
                            if (tile === 0) {
                                return <div key={index} className="gm-slide-tile" style={{ visibility: 'hidden' }} />;
                            }
                            return (
                                <button
                                    key={index}
                                    type="button"
                                    className={`gm-slide-tile ${isCorrect ? 'correct' : ''}`}
                                    onClick={() => handleTileClick(index)}
                                >
                                    {tile}
                                </button>
                            );
                        })}
                    </div>
                    <GameFooter onBack={onBack} onReset={() => initializePuzzle(gridSize)} />
                </div>
            )}

            {gameState === 'FINISHED' && (
                <div className="gm-finish-card">
                    <Trophy size={48} style={{ color: '#ea580c', marginBottom: 12 }} />
                    <h2 className="gm-start-title">Solved!</h2>
                    <p className="gm-start-desc">{moves} moves in {formatGameTime(timeLeft)}.</p>
                    <div className="gm-finish-stats">
                        <div className="gm-finish-stat">
                            <span>Score</span>
                            <strong>{Math.max(10, 1000 - moves - timeLeft)}</strong>
                        </div>
                        <div className="gm-finish-stat">
                            <span>Moves</span>
                            <strong>{moves}</strong>
                        </div>
                    </div>
                    <div className="gm-start-actions">
                        <button type="button" className="gm-btn-play" style={{ background: '#ea580c' }} onClick={() => initializePuzzle(gridSize)}>
                            <RefreshCw size={18} /> Play again
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

export default Puzzle;
