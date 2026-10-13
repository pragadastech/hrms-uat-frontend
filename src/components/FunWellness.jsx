import { useState, useMemo, useDeferredValue } from 'react';
import Header from './Header';
import '../pages/Games.css';
import { useAuth } from '../contexts/AuthContext';
import {
  Gamepad2,
  Heart,
  Grid3x3,
  Scissors,
  BrainCircuit,
  BookOpen,
  Calculator,
  Palette,
  Search,
  Puzzle as PuzzleIcon,
  Trophy,
  Keyboard,
  Zap,
  ChevronRight,
  Sparkles,
  Filter,
} from 'lucide-react';
import TicTacToe from './games/TicTacToe';
import Sudoku from './games/Sudoku';
import Quiz from './games/Quiz';
import MemoryMatch from './games/MemoryMatch';
import RockPaperScissors from './games/RockPaperScissors';
import ColorMatch from './games/ColorMatch';
import MathChallenge from './games/MathChallenge';
import WordSearch from './games/WordSearch';
import Puzzle from './games/Puzzle';
import Snake from './games/Snake';
import Game2048 from './games/Game2048';
import TypingTest from './games/TypingTest';
import Leaderboard from './games/Leaderboard';
import QuizAdminPanel from './games/QuizAdminPanel';

const CATEGORIES = [
  { id: 'all', label: 'All games' },
  { id: 'brain', label: 'Brain' },
  { id: 'arcade', label: 'Arcade' },
  { id: 'words', label: 'Words' },
  { id: 'speed', label: 'Speed' },
];

const GAMES = [
  {
    id: 'quiz',
    name: 'Quiz',
    description: 'Test your knowledge with timed multiple-choice questions.',
    icon: BookOpen,
    accent: '#4f46e5',
    accentSoft: '#eef2ff',
    category: 'brain',
    component: Quiz,
    hasDifficulty: true,
  },
  {
    id: 'puzzle',
    name: 'Puzzle',
    description: 'Logic and spatial puzzles to sharpen problem-solving.',
    icon: PuzzleIcon,
    accent: '#059669',
    accentSoft: '#ecfdf5',
    category: 'brain',
    component: Puzzle,
  },
  {
    id: 'memory',
    name: 'Memory Match',
    description: 'Flip cards and match pairs before time runs out.',
    icon: BrainCircuit,
    accent: '#db2777',
    accentSoft: '#fdf2f8',
    category: 'brain',
    component: MemoryMatch,
  },
  {
    id: 'sudoku',
    name: 'Sudoku',
    description: 'Classic 9×9 number placement with hints and validation.',
    icon: Grid3x3,
    accent: '#d97706',
    accentSoft: '#fffbeb',
    category: 'brain',
    component: Sudoku,
    hasDifficulty: true,
  },
  {
    id: 'tictactoe',
    name: 'Tic Tac Toe',
    description: 'Play against the computer on a classic 3×3 board.',
    icon: Grid3x3,
    accent: '#7c3aed',
    accentSoft: '#f5f3ff',
    category: 'arcade',
    component: TicTacToe,
    difficulty: 'MEDIUM',
  },
  {
    id: 'wordsearch',
    name: 'Word Search',
    description: 'Find hidden words across the letter grid.',
    icon: Search,
    accent: '#0891b2',
    accentSoft: '#ecfeff',
    category: 'words',
    component: WordSearch,
  },
  {
    id: 'math',
    name: 'Math Challenge',
    description: 'Rapid arithmetic drills for mental agility.',
    icon: Calculator,
    accent: '#ec4899',
    accentSoft: '#fdf2f8',
    category: 'brain',
    component: MathChallenge,
  },
  {
    id: 'colormatch',
    name: 'Color Match',
    description: 'Match color names to swatches under pressure.',
    icon: Palette,
    accent: '#ea580c',
    accentSoft: '#fff7ed',
    category: 'speed',
    component: ColorMatch,
  },
  {
    id: 'rps',
    name: 'Rock Paper Scissors',
    description: 'Quick rounds against the machine.',
    icon: Scissors,
    accent: '#2563eb',
    accentSoft: '#eff6ff',
    category: 'arcade',
    component: RockPaperScissors,
  },
  {
    id: 'snake',
    name: 'Snake',
    description: 'Grow the snake and beat your high score.',
    icon: Zap,
    accent: '#16a34a',
    accentSoft: '#f0fdf4',
    category: 'arcade',
    component: Snake,
  },
  {
    id: '2048',
    name: '2048',
    description: 'Merge tiles until you reach 2048.',
    icon: Grid3x3,
    accent: '#ca8a04',
    accentSoft: '#fefce8',
    category: 'arcade',
    component: Game2048,
  },
  {
    id: 'typing',
    name: 'Typing Test',
    description: 'Measure words per minute and accuracy.',
    icon: Keyboard,
    accent: '#0284c7',
    accentSoft: '#f0f9ff',
    category: 'words',
    component: TypingTest,
  },
];

const FunWellness = () => {
  const { sessionType, hasAdminAccess } = useAuth();
  const isQuizAdmin = sessionType === 'admin' || hasAdminAccess();
  const [activeTab, setActiveTab] = useState('arcade');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearch = useDeferredValue(searchQuery);
  const [selectedGame, setSelectedGame] = useState(null);
  const [difficultyDialogOpen, setDifficultyDialogOpen] = useState(false);
  const [pendingGame, setPendingGame] = useState(null);
  const [selectedDifficulty, setSelectedDifficulty] = useState('MEDIUM');

  const filteredGames = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase();
    return GAMES.filter((g) => {
      const matchesCategory = categoryFilter === 'all' || g.category === categoryFilter;
      const matchesSearch =
        !q ||
        g.name.toLowerCase().includes(q) ||
        g.description.toLowerCase().includes(q) ||
        g.category.includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [deferredSearch, categoryFilter]);

  const stats = useMemo(() => {
    const withDifficulty = GAMES.filter((g) => g.hasDifficulty).length;
    return { total: GAMES.length, categories: CATEGORIES.length - 1, withDifficulty };
  }, []);

  const handleGameSelect = (game) => {
    if (game.hasDifficulty || game.name === 'Tic Tac Toe') {
      setPendingGame(game);
      setSelectedDifficulty(game.difficulty || 'MEDIUM');
      setDifficultyDialogOpen(true);
    } else {
      setSelectedGame({ ...game, difficulty: 'MEDIUM' });
    }
  };

  const launchGameWithDifficulty = () => {
    if (pendingGame) {
      setSelectedGame({ ...pendingGame, difficulty: selectedDifficulty });
      setDifficultyDialogOpen(false);
      setPendingGame(null);
    }
  };

  if (selectedGame) {
    const GameComponent = selectedGame.component;
    const Icon = selectedGame.icon;
    return (
      <div className="main-content games-page flex flex-col min-h-screen">
        <Header title="Fun & Wellness" subtitle={selectedGame.name} />
        <div className="page-content flex-1 overflow-y-auto custom-scrollbar">
          {GameComponent ? (
            <GameComponent game={selectedGame} onBack={() => setSelectedGame(null)} />
          ) : (
            <div className="gm-empty">
              <Icon size={40} style={{ color: selectedGame.accent }} />
              <p>Coming soon.</p>
              <button type="button" className="gm-btn-back" onClick={() => setSelectedGame(null)}>
                Back to arcade
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="main-content games-page flex flex-col min-h-screen">
      <Header title="Fun & Wellness" subtitle="HR Arcade — games, scores, and wellness" />

      <div className="page-content flex-1 overflow-y-auto custom-scrollbar">
        <section className="gm-hero" aria-label="HR Arcade">
          <div className="gm-hero-glow gm-hero-glow-1" aria-hidden="true" />
          <div className="gm-hero-glow gm-hero-glow-2" aria-hidden="true" />
          <div className="gm-hero-inner">
            <div>
              <span className="gm-hero-badge">
                <Gamepad2 size={14} aria-hidden="true" />
                Engagement hub
              </span>
              <h1 className="gm-hero-title">HR Arcade</h1>
              <p className="gm-hero-sub">
                Take a mindful break, challenge colleagues on the leaderboard, and keep your
                mind sharp with quick games built for the workplace.
              </p>
              <div className="gm-hero-stats">
                <div className="gm-hero-stat">
                  <span className="gm-hero-stat-val">{stats.total}</span>
                  <span className="gm-hero-stat-lbl">Games</span>
                </div>
                <div className="gm-hero-stat">
                  <span className="gm-hero-stat-val">{stats.withDifficulty}</span>
                  <span className="gm-hero-stat-lbl">Ranked modes</span>
                </div>
                <div className="gm-hero-stat">
                  <span className="gm-hero-stat-val">{stats.categories}</span>
                  <span className="gm-hero-stat-lbl">Categories</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="gm-panel">
          <div className="gm-toolbar">
            <div className="gm-segmented" role="tablist" aria-label="Fun and wellness sections">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'arcade'}
                className={activeTab === 'arcade' ? 'active' : ''}
                onClick={() => setActiveTab('arcade')}
              >
                <Gamepad2 size={16} aria-hidden="true" />
                Arcade
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'leaderboard'}
                className={activeTab === 'leaderboard' ? 'active' : ''}
                onClick={() => setActiveTab('leaderboard')}
              >
                <Trophy size={16} aria-hidden="true" />
                Leaderboard
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'wellness'}
                className={activeTab === 'wellness' ? 'active' : ''}
                onClick={() => setActiveTab('wellness')}
              >
                <Heart size={16} aria-hidden="true" />
                Wellness
              </button>
              {isQuizAdmin && (
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'quiz-bank'}
                  className={activeTab === 'quiz-bank' ? 'active' : ''}
                  onClick={() => setActiveTab('quiz-bank')}
                >
                  <BookOpen size={16} aria-hidden="true" />
                  Quiz bank
                </button>
              )}
            </div>

            {activeTab === 'arcade' && (
              <div className="gm-search-wrap">
                <Search size={16} className="gm-search-icon" aria-hidden="true" />
                <input
                  type="search"
                  className="gm-search-input"
                  placeholder="Search games…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  aria-label="Search games"
                />
              </div>
            )}
          </div>

          {activeTab === 'arcade' && (
            <>
              <div className="gm-chips" role="group" aria-label="Game categories">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    className={`gm-chip ${categoryFilter === cat.id ? 'active' : ''}`}
                    onClick={() => setCategoryFilter(cat.id)}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              <div className="gm-grid">
                {filteredGames.length === 0 ? (
                  <div className="gm-empty">
                    <Filter size={32} style={{ opacity: 0.35, marginBottom: 8 }} />
                    <p>No games match your search. Try another keyword or category.</p>
                  </div>
                ) : (
                  filteredGames.map((game, index) => {
                    const Icon = game.icon;
                    return (
                      <button
                        key={game.id}
                        type="button"
                        className="gm-card"
                        style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
                        onClick={() => handleGameSelect(game)}
                      >
                        <div
                          className="gm-card-icon"
                          style={{ background: game.accentSoft, color: game.accent }}
                        >
                          <Icon size={26} aria-hidden="true" />
                        </div>
                        <div className="gm-card-body">
                          <h3 className="gm-card-title">{game.name}</h3>
                          <p className="gm-card-desc">{game.description}</p>
                          <div className="gm-card-meta">
                            <span className="gm-tag">{game.category}</span>
                            {game.hasDifficulty && <span className="gm-tag">Ranked</span>}
                          </div>
                        </div>
                        <span className="gm-card-arrow" aria-hidden="true">
                          <ChevronRight size={18} />
                        </span>
                      </button>
                    );
                  })
                )}
              </div>

              <p
                style={{
                  textAlign: 'center',
                  marginTop: 28,
                  fontSize: 12,
                  fontWeight: 700,
                  color: 'var(--gm-text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                }}
              >
                <Sparkles size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                Scores sync to the leaderboard automatically
              </p>
            </>
          )}

          {activeTab === 'leaderboard' && (
            <div className="gm-lb-page">
              <Leaderboard onBack={() => setActiveTab('arcade')} isStandalone={false} />
            </div>
          )}

          {activeTab === 'wellness' && (
            <div className="gm-wellness">
              <div className="gm-wellness-icon">
                <Heart size={40} aria-hidden="true" />
              </div>
              <h3>Wellness center</h3>
              <p>
                Guided breathing, micro-breaks, and mindfulness sessions are on the roadmap. We are
                building experiences that fit naturally into your workday.
              </p>
              <button type="button" className="gm-btn-cta" disabled>
                Coming soon
              </button>
            </div>
          )}

          {activeTab === 'quiz-bank' && isQuizAdmin && <QuizAdminPanel />}
        </div>
      </div>

      {difficultyDialogOpen && pendingGame && (() => {
        const PendingIcon = pendingGame.icon;
        return (
        <div
          className="gm-modal-overlay"
          role="presentation"
          onClick={() => setDifficultyDialogOpen(false)}
        >
          <div
            className="gm-modal"
            role="dialog"
            aria-labelledby="difficulty-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="gm-modal-head">
              <div
                className="gm-modal-icon"
                style={{
                  background: pendingGame.accentSoft,
                  color: pendingGame.accent,
                }}
              >
                <PendingIcon size={26} aria-hidden="true" />
              </div>
              <div>
                <h3 id="difficulty-title">{pendingGame.name}</h3>
                <p className="gm-modal-eyebrow">Choose difficulty</p>
              </div>
            </div>

            <div className="gm-diff-grid">
              {['EASY', 'MEDIUM', 'HARD', 'EXPERT'].map((level) => (
                <button
                  key={level}
                  type="button"
                  className={`gm-diff-btn ${selectedDifficulty === level ? 'active' : ''}`}
                  onClick={() => setSelectedDifficulty(level)}
                >
                  {level.charAt(0) + level.slice(1).toLowerCase()}
                </button>
              ))}
            </div>

            <div className="gm-modal-actions">
              <button
                type="button"
                className="gm-btn-cancel"
                onClick={() => setDifficultyDialogOpen(false)}
              >
                Cancel
              </button>
              <button type="button" className="gm-btn-launch" onClick={launchGameWithDifficulty}>
                Start game
              </button>
            </div>
          </div>
        </div>
        );
      })()}
    </div>
  );
};

export default FunWellness;
