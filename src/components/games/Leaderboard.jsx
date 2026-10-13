
import React, { useState, useEffect } from 'react';
import {
    Trophy,
    ArrowLeft,
    RotateCw,
    Medal,
    Timer,
    Gamepad2,
    Filter,
    BarChart,
    Globe,
    List,
    AlertCircle
} from 'lucide-react';
import { gameScoreAPI } from '../../services/api';
import Header from '../Header';
import '../../pages/Games.css';

const Leaderboard = ({ onBack, isStandalone }) => {
    const [leaderboardData, setLeaderboardData] = useState([]);
    const [summaryData, setSummaryData] = useState([]);
    const [games, setGames] = useState([
        { id: 'all', name: 'All Games' },
        { id: 'Quiz', name: 'Quiz' },
        { id: 'REALTIME_QUIZ', name: 'Realtime Quiz' },
        { id: 'Puzzle', name: 'Puzzle' },
        { id: 'Memory Match', name: 'Memory Match' },
        { id: 'Sudoku', name: 'Sudoku' },
        { id: 'Tic Tac Toe', name: 'Tic Tac Toe' },
        { id: 'Word Search', name: 'Word Search' },
        { id: 'Math Challenge', name: 'Math Challenge' },
        { id: 'Color Match', name: 'Color Match' }
    ]);
    const [selectedGame, setSelectedGame] = useState('all');
    const [selectedDifficulty, setSelectedDifficulty] = useState('all');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [viewMode, setViewMode] = useState('summary'); // 'summary', 'global', 'by-game'

    useEffect(() => {
        loadData();
    }, []);

    useEffect(() => {
        if (selectedGame !== 'all' || selectedDifficulty !== 'all') {
            loadFilteredLeaderboard();
        } else {
            loadGlobalLeaderboard();
        }
    }, [selectedGame, selectedDifficulty]);

    const loadData = async () => {
        try {
            setLoading(true);
            setError(null);
            const leaderboardResponse = await gameScoreAPI.getGlobalLeaderboard();
            setLeaderboardData(leaderboardResponse.data);
            generateSummaryData(leaderboardResponse.data);
            setLoading(false);
        } catch (err) {
            console.error(err);
            setError('Failed to load leaderboard data');
            setLoading(false);
        }
    };

    const loadGlobalLeaderboard = async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await gameScoreAPI.getGlobalLeaderboard();
            setLeaderboardData(response.data);
            generateSummaryData(response.data);
            setLoading(false);
        } catch (err) {
            console.error(err);
            setError('Failed to load global leaderboard');
            setLoading(false);
        }
    };

    const loadFilteredLeaderboard = async () => {
        try {
            setLoading(true);
            setError(null);
            let data;
            if (selectedDifficulty !== 'all') {
                const res = await gameScoreAPI.getGlobalLeaderboardByDifficulty(selectedDifficulty);
                data = res.data;
            } else {
                const res = await gameScoreAPI.getGlobalLeaderboard();
                data = res.data;
            }

            // Filter by game if specific game is selected
            if (selectedGame !== 'all') {
                data = data.filter(score => {
                    const gameName = String(score.gameName).toLowerCase();
                    const selectedGameLower = selectedGame.toLowerCase();

                    if (selectedGame === 'REALTIME_QUIZ') {
                        return gameName.startsWith('realtime_quiz');
                    }
                    return gameName === selectedGameLower;
                });
            }

            setLeaderboardData(data);
            generateSummaryData(data);
            setLoading(false);
        } catch (err) {
            console.error(err);
            setError('Failed to load filtered leaderboard');
            setLoading(false);
        }
    };

    const generateSummaryData = (data) => {
        const employeeSummary = {};

        data.forEach(score => {
            const employeeName = score.employeeName;

            if (!employeeSummary[employeeName]) {
                employeeSummary[employeeName] = {
                    employeeName,
                    totalScore: 0,
                    totalGames: 0,
                    gamesPlayed: new Set(),
                    averageScore: 0,
                    bestScore: 0,
                    totalTime: 0,
                    totalMoves: 0
                };
            }

            employeeSummary[employeeName].totalScore += score.score;
            employeeSummary[employeeName].totalGames += 1;
            employeeSummary[employeeName].gamesPlayed.add(score.gameName);
            employeeSummary[employeeName].bestScore = Math.max(employeeSummary[employeeName].bestScore, score.score);
            employeeSummary[employeeName].totalTime += score.timeTaken;
            employeeSummary[employeeName].totalMoves += score.movesCount;
        });

        const summaryArray = Object.values(employeeSummary).map(emp => ({
            ...emp,
            averageScore: Math.round(emp.totalScore / emp.totalGames),
            gamesPlayed: Array.from(emp.gamesPlayed),
            gamesPlayedCount: emp.gamesPlayed.size
        }));

        // Sort by total score descending
        summaryArray.sort((a, b) => b.totalScore - a.totalScore);

        setSummaryData(summaryArray);
    };

    const getRankIcon = (rank) => {
        const cls =
            rank === 1 ? 'gm-rank gm-rank-1' :
            rank === 2 ? 'gm-rank gm-rank-2' :
            rank === 3 ? 'gm-rank gm-rank-3' :
            'gm-rank gm-rank-default';
        if (rank <= 3) {
            return (
                <div className={cls} aria-label={`Rank ${rank}`}>
                    <Medal size={18} />
                </div>
            );
        }
        return <div className={cls}>{rank}</div>;
    };

    const getDifficultyClass = (difficulty) => {
        switch (difficulty) {
            case 'EASY': return 'gm-diff-badge gm-diff-easy';
            case 'MEDIUM': return 'gm-diff-badge gm-diff-medium';
            case 'HARD': return 'gm-diff-badge gm-diff-hard';
            case 'EXPERT': return 'gm-diff-badge gm-diff-expert';
            default: return 'gm-diff-badge gm-diff-medium';
        }
    };

    // Helper function to format time
    const formatTime = (seconds) => {
        if (!seconds) return '0s';
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;

        if (hours > 0) return `${hours}h ${minutes}m ${secs}s`;
        if (minutes > 0) return `${minutes}m ${secs}s`;
        return `${secs}s`;
    };

    const renderContent = () => {
        if (loading) {
            return (
                <div className="gm-loading">
                    <div className="gm-spinner" aria-hidden="true" />
                    <p>Loading leaderboard…</p>
                </div>
            );
        }

        if (error) {
            return (
                <div className="gm-empty" style={{ minHeight: 280 }}>
                    <AlertCircle size={36} style={{ color: '#dc2626', marginBottom: 12 }} />
                    <h3 style={{ margin: '0 0 8px', fontWeight: 700 }}>Could not load scores</h3>
                    <p style={{ margin: '0 0 16px' }}>{error}</p>
                    <button type="button" className="gm-btn-cta" onClick={loadData}>
                        <RotateCw size={16} /> Retry
                    </button>
                </div>
            );
        }

        return (
            <div className="gm-table-wrap">
                {viewMode === 'summary' ? (
                    // Summary View
                    summaryData.length === 0 ? (
                        <div className="p-12 text-center text-gray-500">
                            No scores found for the selected filters.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="gm-table">
                                <thead>
                                    <tr>
                                        <th>Rank</th>
                                        <th>Player</th>
                                        <th className="text-right">Total score</th>
                                        <th className="text-center">Games</th>
                                        <th className="text-center">Avg score</th>
                                        <th className="text-center">Best</th>
                                        <th className="text-right">Time</th>
                                        <th>Activities</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {summaryData.map((employee, index) => (
                                        <tr key={`summary-${employee.employeeName}-${index}`}>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center justify-center w-8 h-8">
                                                    {getRankIcon(index + 1)}
                                                </div>
                                            </td>
                                            <td><strong>{employee.employeeName}</strong></td>
                                            <td className="text-right">
                                                <span className="gm-score-highlight">{employee.totalScore.toLocaleString()}</span>
                                            </td>
                                            <td className="text-center">
                                                <span className="gm-tag">{employee.totalGames}</span>
                                            </td>
                                            <td className="text-center">{employee.averageScore}</td>
                                            <td className="text-center" style={{ color: '#15803d', fontWeight: 700 }}>{employee.bestScore}</td>
                                            <td className="text-right" style={{ fontFamily: 'monospace', fontSize: 12 }}>{formatTime(employee.totalTime)}</td>
                                            <td>
                                                <span style={{ fontSize: 12, fontWeight: 600 }}>{employee.gamesPlayedCount} played</span>
                                                <br />
                                                <span style={{ fontSize: 11, color: 'var(--gm-text-muted)' }} title={employee.gamesPlayed.join(', ')}>
                                                    {employee.gamesPlayed.slice(0, 2).join(', ')}
                                                    {employee.gamesPlayed.length > 2 && ` +${employee.gamesPlayed.length - 2}`}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )
                ) : viewMode === 'global' ? (
                    // Global View
                    leaderboardData.length === 0 ? (
                        <div className="p-12 text-center text-gray-500">
                            No scores found for the selected filters.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="gm-table">
                                <thead>
                                    <tr>
                                        <th>Rank</th>
                                        <th>Player</th>
                                        <th>Game</th>
                                        <th>Difficulty</th>
                                        <th className="text-right">Score</th>
                                        <th className="text-right">Time</th>
                                        <th className="text-center">Moves</th>
                                        <th className="text-right">Date</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {leaderboardData.map((score, index) => (
                                        <tr key={`global-${index}-${score.playedAt || index}`}>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center justify-center w-8 h-8">
                                                    {getRankIcon(index + 1)}
                                                </div>
                                            </td>
                                            <td><strong>{score.employeeName}</strong></td>
                                            <td>{score.gameName}</td>
                                            <td>
                                                <span className={getDifficultyClass(score.difficulty)}>
                                                    {score.difficulty}
                                                </span>
                                            </td>
                                            <td className="text-right"><span className="gm-score-highlight">{score.score}</span></td>
                                            <td className="text-right" style={{ fontFamily: 'monospace', fontSize: 12 }}>{formatTime(score.timeTaken)}</td>
                                            <td className="text-center">{score.movesCount}</td>
                                            <td className="text-right" style={{ fontSize: 12 }}>
                                                {score.playedAt ? new Date(score.playedAt).toLocaleDateString() : '-'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )
                ) : (
                    <div className="p-12 text-center text-gray-500">
                        By Game view coming soon...
                    </div>
                )}
            </div>
        );
    };

    const renderLeaderboardBody = () => (
            <>
                {!isStandalone && (
                    <div className="gm-toolbar" style={{ marginBottom: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            {onBack && (
                                <button type="button" className="gm-btn-back" onClick={onBack}>
                                    <ArrowLeft size={16} /> Arcade
                                </button>
                            )}
                            <div>
                                <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--gm-text)' }}>
                                    <Trophy size={18} style={{ verticalAlign: 'middle', marginRight: 6, color: '#eab308' }} />
                                    Hall of fame
                                </h2>
                                <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--gm-text-muted)' }}>
                                    Top players and recent high scores
                                </p>
                            </div>
                        </div>
                        <button type="button" className="gm-btn-back" onClick={loadData}>
                            <RotateCw size={16} /> Refresh
                        </button>
                    </div>
                )}

                <div className="gm-lb-filters">
                    <label>
                        <Filter size={14} aria-hidden="true" />
                        Game
                    </label>
                    <select
                        className="gm-lb-select"
                        value={selectedGame}
                        onChange={(e) => setSelectedGame(e.target.value)}
                        aria-label="Filter by game"
                    >
                        {games.map((game) => (
                            <option key={game.id} value={game.id}>{game.name}</option>
                        ))}
                    </select>

                    <label>Difficulty</label>
                    <select
                        className="gm-lb-select"
                        value={selectedDifficulty}
                        onChange={(e) => setSelectedDifficulty(e.target.value)}
                        aria-label="Filter by difficulty"
                    >
                        <option value="all">All difficulties</option>
                        <option value="EASY">Easy</option>
                        <option value="MEDIUM">Medium</option>
                        <option value="HARD">Hard</option>
                        <option value="EXPERT">Expert</option>
                    </select>

                    <div className="gm-lb-view-toggle">
                        <button
                            type="button"
                            className={viewMode === 'summary' ? 'active' : ''}
                            onClick={() => setViewMode('summary')}
                        >
                            <BarChart size={14} /> Summary
                        </button>
                        <button
                            type="button"
                            className={viewMode === 'global' ? 'active' : ''}
                            onClick={() => setViewMode('global')}
                        >
                            <Globe size={14} /> All scores
                        </button>
                    </div>
                </div>

                {renderContent()}
            </>
        );

    return (
        <div className={`games-page ${isStandalone ? 'main-content flex flex-col min-h-screen' : ''}`}>
            {isStandalone && (
                <>
                    <Header title="Fun & Wellness" subtitle="Leaderboard — top scores across the arcade" />
                    <div className="page-content p-6 md:p-8 overflow-y-auto custom-scrollbar">
                        <section className="gm-hero" style={{ padding: '32px 24px 64px', marginBottom: 0 }}>
                            <div className="gm-hero-glow gm-hero-glow-1" aria-hidden="true" />
                            <div className="gm-hero-inner">
                                <div>
                                    <span className="gm-hero-badge">
                                        <Trophy size={14} /> Hall of fame
                                    </span>
                                    <h1 className="gm-hero-title" style={{ fontSize: '1.75rem' }}>Leaderboard</h1>
                                    <p className="gm-hero-sub">See who leads across games and difficulty levels.</p>
                                </div>
                                <button type="button" className="gm-btn-cta" style={{ background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.35)' }} onClick={loadData}>
                                    <RotateCw size={16} /> Refresh
                                </button>
                            </div>
                        </section>
                        <div className="gm-panel" style={{ marginTop: -40 }}>
                            {renderLeaderboardBody()}
                        </div>
                    </div>
                </>
            )}

            {!isStandalone && renderLeaderboardBody()}
        </div>
    );
};

export default Leaderboard;
