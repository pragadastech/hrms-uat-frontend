import { useEffect, useState, useRef } from 'react';
import { quizQuestionAPI, gameScoreAPI, employeeAPI } from '../../services/api';
import {
  CheckCircle,
  XCircle,
  Timer,
  Trophy,
  GraduationCap,
  PlayCircle,
} from 'lucide-react';
import {
  GameShell,
  GameHud,
  GameFooter,
  GameLoading,
  GameError,
  formatGameTime,
} from './gameUi';
import '../../pages/Games.css';

const Quiz = ({ game, onBack }) => {
    const [employeeDbId, setEmployeeDbId] = useState(null);
    const [questions, setQuestions] = useState([]);
    const [current, setCurrent] = useState(0);
    const [choice, setChoice] = useState('');
    const [score, setScore] = useState(0);
    const [loading, setLoading] = useState(false);
    const [finished, setFinished] = useState(false);
    const [error, setError] = useState('');
    const [startTime, setStartTime] = useState(Date.now());
    const [answerSubmitted, setAnswerSubmitted] = useState(false);
    const [isCorrect, setIsCorrect] = useState(false);
    const [timeElapsed, setTimeElapsed] = useState(0);
    const [isShuffling, setIsShuffling] = useState(false);
    const [countdown, setCountdown] = useState(0);
    const [isSubmittingScore, setIsSubmittingScore] = useState(false);

    const currentQuestionRef = useRef(0);

    useEffect(() => {
        currentQuestionRef.current = current;
    }, [current]);

    useEffect(() => {
        if (countdown > 0) {
            const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [countdown]);

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const res = await employeeAPI.getEmployeeProfile();
                if (res?.data?.id) setEmployeeDbId(res.data.id);
            } catch { }
        };
        fetchProfile();
        loadQuestions();
    }, []);

    useEffect(() => {
        if (!loading && !finished && questions.length > 0) {
            const timer = setInterval(() => {
                setTimeElapsed(Math.floor((Date.now() - startTime) / 1000));
            }, 1000);
            return () => clearInterval(timer);
        }
    }, [loading, finished, questions.length, startTime]);

    const getQuizLoadError = (err) => {
        const data = err?.response?.data;
        if (data?.code === 'FEATURE_NOT_AVAILABLE') {
            return 'Quiz is not available on your current plan. Ask your administrator to enable Games & Wellness.';
        }
        if (typeof data?.error === 'string' && data.error.trim()) {
            return data.error;
        }
        if (err?.response?.status === 403) {
            return 'You do not have permission to load quiz questions.';
        }
        return null;
    };

    const loadQuestions = async () => {
        setError('');
        setFinished(false);
        setScore(0);
        setCurrent(0);
        setChoice('');
        setAnswerSubmitted(false);
        setIsCorrect(false);
        setTimeElapsed(0);
        setQuestions([]);
        setStartTime(Date.now());
        try {
            setLoading(true);
            const prefer = game?.difficulty || 'MEDIUM';
            let allQuestions = [];
            let loadError = '';

            try {
                const preferredRes = await quizQuestionAPI.getRandomQuestionsByDifficulty(prefer, 10);
                if (Array.isArray(preferredRes.data)) allQuestions.push(...preferredRes.data);
            } catch (err) {
                loadError = getQuizLoadError(err) || loadError;
            }

            if (allQuestions.length < 5) {
                const otherDifficulties = ['EASY', 'MEDIUM', 'HARD', 'EXPERT'].filter(d => d !== prefer);
                for (const difficulty of otherDifficulties) {
                    if (allQuestions.length >= 5) break;
                    try {
                        const res = await quizQuestionAPI.getRandomQuestionsByDifficulty(difficulty, 5);
                        if (Array.isArray(res.data)) allQuestions.push(...res.data.slice(0, 5 - allQuestions.length));
                    } catch (err) {
                        loadError = getQuizLoadError(err) || loadError;
                    }
                }
            }

            if (allQuestions.length === 0) {
                setError(loadError || 'No active quiz questions are available right now.');
                return;
            }

            const shuffledQuestions = allQuestions.sort(() => Math.random() - 0.5).slice(0, 5);
            setQuestions(shuffledQuestions);
        } catch (e) {
            setError('Failed to load quiz questions.');
        } finally {
            setLoading(false);
        }
    };

    const submitAnswer = (selectedOption) => {
        if (!questions[current] || answerSubmitted) return;

        setChoice(selectedOption);
        const q = questions[current];
        const correct = selectedOption === q.correctAnswer;
        const updatedScore = correct ? score + 1 : score;

        setIsCorrect(correct);
        setAnswerSubmitted(true);
        if (correct) setScore(s => s + 1);

        if (current + 1 >= questions.length) {
            const elapsedSec = Math.max(0, Math.floor((Date.now() - startTime) / 1000));
            setIsSubmittingScore(true);
            setCountdown(0);
            setTimeout(async () => {
                try {
                    await safelySubmitScore(updatedScore, elapsedSec);
                } catch {
                } finally {
                    setFinished(true);
                    setIsSubmittingScore(false);
                }
            }, 2000);
            return;
        }

        setCountdown(2);
        setTimeout(() => {
            if (currentQuestionRef.current === current) {
                setCurrent(c => c + 1);
                setChoice('');
                setAnswerSubmitted(false);
                setIsCorrect(false);
                setCountdown(0);
            }
        }, 2000);
    };

    const safelySubmitScore = async (finalScore, timeTaken) => {
        try {
            if (!employeeDbId) return;
            await gameScoreAPI.submitScore({
                employeeId: employeeDbId,
                gameId: null,
                gameName: 'Quiz',
                difficulty: game?.difficulty || 'MEDIUM',
                score: finalScore,
                timeTaken,
                movesCount: 0,
            });
        } catch { }
    };

    const shuffleCurrentQuestions = () => {
        if (questions.length === 0 || isShuffling) return;
        setIsShuffling(true);
        try {
            if (current >= questions.length) return;
            const head = questions.slice(0, current);
            const sub = questions.slice(current).sort(() => Math.random() - 0.5);
            setQuestions([...head, ...sub]);
            setChoice('');
            setAnswerSubmitted(false);
            setIsCorrect(false);
            setCountdown(0);
        } finally {
            setIsShuffling(false);
        }
    };

    if (loading) {
        return (
            <GameShell gameName="Quiz" difficulty={game?.difficulty} onBack={onBack}>
                <GameLoading message="Loading questions…" icon={GraduationCap} />
            </GameShell>
        );
    }

    if (error) {
        return (
            <GameShell gameName="Quiz" difficulty={game?.difficulty} onBack={onBack}>
                <GameError message={error} onRetry={loadQuestions} onBack={onBack} />
            </GameShell>
        );
    }

    if (isSubmittingScore) {
        return (
            <GameShell gameName="Quiz" difficulty={game?.difficulty} onBack={onBack}>
                <GameLoading message="Saving your score…" />
            </GameShell>
        );
    }

    if (finished) {
        const percentage = Math.round((score / questions.length) * 100);
        return (
            <GameShell gameName="Quiz" difficulty={game?.difficulty} onBack={onBack}>
                <div className="gm-finish-card">
                    <Trophy size={48} style={{ color: '#4f46e5', marginBottom: 12 }} />
                    <h2 className="gm-start-title">Quiz complete</h2>
                    <p className="gm-start-desc">
                        {percentage >= 90 ? 'Outstanding!' : percentage >= 70 ? 'Great job!' : 'Good effort!'}
                    </p>
                    <div className="gm-finish-stats">
                        <div className="gm-finish-stat">
                            <span>Score</span>
                            <strong>{score}/{questions.length}</strong>
                        </div>
                        <div className="gm-finish-stat">
                            <span>Time</span>
                            <strong>{formatGameTime(timeElapsed)}</strong>
                        </div>
                    </div>
                    <div className="gm-start-actions">
                        <button type="button" className="gm-btn-play" onClick={loadQuestions}>
                            <PlayCircle size={18} /> Play again
                        </button>
                        <button type="button" className="gm-btn-ghost" onClick={onBack}>
                            Back to arcade
                        </button>
                    </div>
                </div>
            </GameShell>
        );
    }

    const q = questions[current];
    if (!q) return null;

    const options = [q.optionA, q.optionB, q.optionC, q.optionD].filter(Boolean);
    const progress = ((current + (answerSubmitted ? 1 : 0)) / questions.length) * 100;

    return (
        <GameShell gameName="Quiz" difficulty={game?.difficulty} onBack={onBack}>
            <div className="gm-screen">
                <GameHud
                    items={[
                        {
                            label: 'Question',
                            value: `${current + 1}/${questions.length}`,
                            icon: <GraduationCap size={18} />,
                        },
                        {
                            label: 'Time',
                            value: formatGameTime(timeElapsed),
                            icon: <Timer size={18} />,
                        },
                        { label: 'Score', value: score, highlight: true },
                    ]}
                />

                <div className="gm-progress">
                    <div className="gm-progress-fill" style={{ width: `${progress}%` }} />
                </div>

                <div className="gm-quiz-card">
                    <h3 className="gm-quiz-question">{q.question}</h3>
                    <div className="gm-quiz-options">
                        {options.map((opt, idx) => {
                            const status = answerSubmitted
                                ? opt === q.correctAnswer
                                    ? 'correct'
                                    : opt === choice
                                      ? 'wrong'
                                      : ''
                                : choice === opt
                                  ? 'selected'
                                  : '';
                            return (
                                <button
                                    key={idx}
                                    type="button"
                                    className={`gm-quiz-opt ${status}`}
                                    onClick={() => !answerSubmitted && submitAnswer(opt)}
                                    disabled={answerSubmitted}
                                >
                                    <span>{opt}</span>
                                    {status === 'correct' && <CheckCircle size={22} />}
                                    {status === 'wrong' && <XCircle size={22} />}
                                </button>
                            );
                        })}
                    </div>
                    {answerSubmitted && (
                        <p
                            className="gm-quiz-feedback"
                            style={{ color: isCorrect ? '#166534' : '#991b1b' }}
                        >
                            {isCorrect ? 'Correct!' : 'Incorrect'}
                            {countdown > 0 ? ` — next in ${countdown}s` : ''}
                        </p>
                    )}
                </div>

                <GameFooter onBack={onBack} center={`${score} correct`} />
            </div>
        </GameShell>
    );
};

export default Quiz;
