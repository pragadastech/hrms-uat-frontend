import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { quizQuestionAPI } from '../../services/api';
import {
  BookOpen,
  Upload,
  Plus,
  RefreshCw,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Sparkles,
} from 'lucide-react';

const DIFFICULTIES = ['EASY', 'MEDIUM', 'HARD', 'EXPERT'];

const EMPTY_FORM = {
  question: '',
  optionA: '',
  optionB: '',
  optionC: '',
  optionD: '',
  correctAnswer: '',
  difficulty: 'MEDIUM',
  category: 'General',
};

const QuizAdminPanel = () => {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [csvFile, setCsvFile] = useState(null);
  const seedAttemptedRef = useRef(false);

  const loadQuestions = useCallback(async () => {
    setError('');
    try {
      setLoading(true);
      const res = await quizQuestionAPI.getAllQuestions();
      setQuestions(Array.isArray(res.data) ? res.data : []);
    } catch {
      setError('Failed to load quiz questions.');
      setQuestions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadQuestions();
  }, [loadQuestions]);

  useEffect(() => {
    if (!loading && questions.length === 0 && !actionLoading && !seedAttemptedRef.current) {
      seedAttemptedRef.current = true;
      handleSeedDefaults(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, questions.length, actionLoading]);

  const stats = useMemo(() => {
    const byDifficulty = DIFFICULTIES.reduce((acc, d) => {
      acc[d] = questions.filter((q) => q.difficulty === d && q.isActive !== false).length;
      return acc;
    }, {});
    return {
      total: questions.length,
      active: questions.filter((q) => q.isActive !== false).length,
      byDifficulty,
    };
  }, [questions]);

  const showMessage = (text) => {
    setMessage(text);
    setTimeout(() => setMessage(''), 4000);
  };

  const handleSeedDefaults = async (force = false) => {
    setActionLoading(true);
    setError('');
    try {
      const res = await quizQuestionAPI.seedDefaultQuestions(force);
      showMessage(res.data?.message || 'Default quiz pack loaded.');
      await loadQuestions();
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to load default quiz pack.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCsvUpload = async () => {
    if (!csvFile) {
      setError('Choose a CSV file first.');
      return;
    }
    setActionLoading(true);
    setError('');
    try {
      const res = await quizQuestionAPI.importQuestionsFromCSV(csvFile);
      showMessage(res.data?.message || 'CSV imported successfully.');
      setCsvFile(null);
      await loadQuestions();
    } catch (e) {
      setError(e.response?.data?.error || 'CSV import failed.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateQuestion = async (e) => {
    e.preventDefault();
    const options = [form.optionA, form.optionB, form.optionC, form.optionD];
    if (!form.question.trim() || options.some((o) => !o.trim()) || !form.correctAnswer.trim()) {
      setError('Fill in the question, all four options, and the correct answer.');
      return;
    }
    if (!options.includes(form.correctAnswer.trim())) {
      setError('Correct answer must match one of the four options exactly.');
      return;
    }

    setActionLoading(true);
    setError('');
    try {
      await quizQuestionAPI.createQuestion({
        ...form,
        question: form.question.trim(),
        optionA: form.optionA.trim(),
        optionB: form.optionB.trim(),
        optionC: form.optionC.trim(),
        optionD: form.optionD.trim(),
        correctAnswer: form.correctAnswer.trim(),
        category: form.category.trim() || 'General',
        isActive: true,
      });
      setForm(EMPTY_FORM);
      showMessage('Question added.');
      await loadQuestions();
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to add question.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggle = async (id) => {
    setActionLoading(true);
    setError('');
    try {
      await quizQuestionAPI.toggleQuestionStatus(id);
      await loadQuestions();
    } catch {
      setError('Failed to update question status.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this quiz question?')) return;
    setActionLoading(true);
    setError('');
    try {
      await quizQuestionAPI.deleteQuestion(id);
      showMessage('Question deleted.');
      await loadQuestions();
    } catch {
      setError('Failed to delete question.');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="gm-quiz-admin">
      <div className="gm-quiz-admin-header">
        <div>
          <h3>
            <BookOpen size={22} style={{ verticalAlign: 'middle', marginRight: 8 }} />
            Quiz bank
          </h3>
          <p>Manage questions for the Brain → Quiz game. Employees need active questions to play.</p>
        </div>
        <div className="gm-quiz-admin-actions">
          <button
            type="button"
            className="gm-btn-ghost"
            onClick={() => handleSeedDefaults(false)}
            disabled={actionLoading}
          >
            <Sparkles size={16} /> Load default pack
          </button>
          <button
            type="button"
            className="gm-btn-ghost"
            onClick={loadQuestions}
            disabled={loading || actionLoading}
          >
            <RefreshCw size={16} /> Refresh
          </button>
        </div>
      </div>

      <div className="gm-quiz-admin-stats">
        <div className="gm-quiz-admin-stat">
          <span>Total</span>
          <strong>{stats.total}</strong>
        </div>
        <div className="gm-quiz-admin-stat">
          <span>Active</span>
          <strong>{stats.active}</strong>
        </div>
        {DIFFICULTIES.map((d) => (
          <div key={d} className="gm-quiz-admin-stat">
            <span>{d}</span>
            <strong>{stats.byDifficulty[d]}</strong>
          </div>
        ))}
      </div>

      {message && <p className="gm-quiz-admin-msg success">{message}</p>}
      {error && <p className="gm-quiz-admin-msg error">{error}</p>}

      <div className="gm-quiz-admin-grid">
        <section className="gm-quiz-admin-card">
          <h4>Import from CSV</h4>
          <p className="gm-quiz-admin-hint">
            Columns: Question #, Category, Question, Option A–D, Correct Answer (text).
          </p>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
          />
          <button
            type="button"
            className="gm-btn-play"
            onClick={handleCsvUpload}
            disabled={actionLoading || !csvFile}
          >
            <Upload size={16} /> Upload CSV
          </button>
        </section>

        <section className="gm-quiz-admin-card">
          <h4>Add question</h4>
          <form onSubmit={handleCreateQuestion} className="gm-quiz-admin-form">
            <textarea
              placeholder="Question"
              value={form.question}
              onChange={(e) => setForm((f) => ({ ...f, question: e.target.value }))}
              rows={2}
              required
            />
            <div className="gm-quiz-admin-form-row">
              <input
                placeholder="Option A"
                value={form.optionA}
                onChange={(e) => setForm((f) => ({ ...f, optionA: e.target.value }))}
                required
              />
              <input
                placeholder="Option B"
                value={form.optionB}
                onChange={(e) => setForm((f) => ({ ...f, optionB: e.target.value }))}
                required
              />
            </div>
            <div className="gm-quiz-admin-form-row">
              <input
                placeholder="Option C"
                value={form.optionC}
                onChange={(e) => setForm((f) => ({ ...f, optionC: e.target.value }))}
                required
              />
              <input
                placeholder="Option D"
                value={form.optionD}
                onChange={(e) => setForm((f) => ({ ...f, optionD: e.target.value }))}
                required
              />
            </div>
            <input
              placeholder="Correct answer (must match an option)"
              value={form.correctAnswer}
              onChange={(e) => setForm((f) => ({ ...f, correctAnswer: e.target.value }))}
              required
            />
            <div className="gm-quiz-admin-form-row">
              <select
                value={form.difficulty}
                onChange={(e) => setForm((f) => ({ ...f, difficulty: e.target.value }))}
              >
                {DIFFICULTIES.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
              <input
                placeholder="Category"
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              />
            </div>
            <button type="submit" className="gm-btn-play" disabled={actionLoading}>
              <Plus size={16} /> Add question
            </button>
          </form>
        </section>
      </div>

      <section className="gm-quiz-admin-list">
        <h4>Questions ({questions.length})</h4>
        {loading ? (
          <p className="gm-quiz-admin-hint">Loading questions…</p>
        ) : questions.length === 0 ? (
          <div className="gm-empty">
            <BookOpen size={32} style={{ opacity: 0.35, marginBottom: 8 }} />
            <p>No quiz questions yet. Load the default pack or import a CSV.</p>
            <button
              type="button"
              className="gm-btn-play"
              onClick={() => handleSeedDefaults(false)}
              disabled={actionLoading}
            >
              <Sparkles size={16} /> Load default pack
            </button>
          </div>
        ) : (
          <div className="gm-quiz-admin-table-wrap">
            <table className="gm-quiz-admin-table">
              <thead>
                <tr>
                  <th>Question</th>
                  <th>Category</th>
                  <th>Difficulty</th>
                  <th>Status</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {questions.map((q) => (
                  <tr key={q.id} className={q.isActive === false ? 'inactive' : ''}>
                    <td title={q.question}>{q.question}</td>
                    <td>{q.category}</td>
                    <td>{q.difficulty}</td>
                    <td>{q.isActive === false ? 'Inactive' : 'Active'}</td>
                    <td>
                      <button
                        type="button"
                        className="gm-quiz-admin-icon-btn"
                        onClick={() => handleToggle(q.id)}
                        disabled={actionLoading}
                        title="Toggle active"
                      >
                        {q.isActive === false ? <ToggleLeft size={18} /> : <ToggleRight size={18} />}
                      </button>
                      <button
                        type="button"
                        className="gm-quiz-admin-icon-btn danger"
                        onClick={() => handleDelete(q.id)}
                        disabled={actionLoading}
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};

export default QuizAdminPanel;
