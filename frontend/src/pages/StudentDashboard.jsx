import { useState, useEffect, useRef } from 'react';
import api from '../api/axios';
import Toast from '../components/Toast';

export default function StudentDashboard({ onBack }) {
  const [studentName, setStudentName] = useState(() => localStorage.getItem('studentName') || '');
  const [nameInput, setNameInput] = useState('');
  const [assignments, setAssignments] = useState([]);
  const [activeTab, setActiveTab] = useState('assignments');
  const [mySubmissions, setMySubmissions] = useState(() => {
    try { return JSON.parse(localStorage.getItem('mySubmissions') || '[]'); }
    catch { return []; }
  });

  // Per-assignment submission state
  const [submittingFor, setSubmittingFor] = useState(null);
  const [submitType, setSubmitType] = useState('text'); // 'text' | 'pdf'
  const [submitContent, setSubmitContent] = useState('');
  const [pdfFile, setPdfFile] = useState(null);
  const fileInputRef = useRef(null);

  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (studentName) loadAssignments();
  }, [studentName]);

  async function loadAssignments() {
    try {
      const res = await api.get('/assignments');
      setAssignments(res.data?.assignments || []);
    } catch {
      showToast('Failed to load assignments', 'error');
    }
  }

  function showToast(message, type = 'success') {
    setToast({ message, type });
  }

  function saveName() {
    const name = nameInput.trim();
    if (!name) return;
    setStudentName(name);
    localStorage.setItem('studentName', name);
  }

  function openSubmitForm(assignmentId) {
    setSubmittingFor(assignmentId);
    setSubmitType('text');
    setSubmitContent('');
    setPdfFile(null);
  }

  function cancelSubmit() {
    setSubmittingFor(null);
    setSubmitContent('');
    setPdfFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleSubmit(assignment) {
    if (submitType === 'text' && !submitContent.trim()) {
      showToast('Please enter your submission content', 'error');
      return;
    }
    if (submitType === 'pdf' && !pdfFile) {
      showToast('Please select a PDF file', 'error');
      return;
    }

    setLoading(true);
    try {
      let res;
      if (submitType === 'text') {
        res = await api.post('/submissions', {
          assignment_id: assignment.assignment_id,
          student_name: studentName,
          content: submitContent,
        });
      } else {
        const formData = new FormData();
        formData.append('assignment_id', assignment.assignment_id);
        formData.append('student_name', studentName);
        formData.append('file', pdfFile);
        res = await api.post('/submissions/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }

      const newSub = {
        submission_id: res.data.submission_id,
        assignment_title: assignment.title,
        assignment_id: assignment.assignment_id,
        submitted_at: new Date().toISOString(),
        status: 'pending',
      };
      const updated = [newSub, ...mySubmissions];
      setMySubmissions(updated);
      localStorage.setItem('mySubmissions', JSON.stringify(updated));
      cancelSubmit();
      showToast('Submission received! Check "My Submissions" for feedback.');
      setActiveTab('submissions');
    } catch (err) {
      showToast(err.response?.data?.error || 'Submission failed', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function refreshSubmission(submissionId, index) {
    try {
      const res = await api.get(`/submissions/${submissionId}`);
      const updated = [...mySubmissions];
      updated[index] = {
        ...updated[index],
        status: res.data.status,
        feedback: res.data.feedback,
      };
      setMySubmissions(updated);
      localStorage.setItem('mySubmissions', JSON.stringify(updated));
      if (res.data.status === 'evaluated') showToast('Feedback received!');
    } catch {
      showToast('Failed to refresh', 'error');
    }
  }

  // ── Name entry screen ──────────────────────────────────────────────────────
  if (!studentName) {
    return (
      <div className="dashboard">
        <header className="dashboard-header">
          <button className="btn-back" onClick={onBack}>← Back</button>
          <h1>Student Dashboard</h1>
        </header>
        <div className="name-entry">
          <div className="card name-card">
            <div className="name-card-icon">🎓</div>
            <h2>Enter Your Name</h2>
            <p>Please enter your name to continue</p>
            <div className="input-row">
              <input
                type="text"
                placeholder="Your full name"
                value={nameInput}
                onChange={e => setNameInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && saveName()}
                autoFocus
              />
              <button className="btn-primary" onClick={saveName}>Continue</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Main dashboard ─────────────────────────────────────────────────────────
  return (
    <div className="dashboard">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <header className="dashboard-header">
        <button className="btn-back" onClick={onBack}>← Back</button>
        <h1>Student Dashboard</h1>
        <span className="welcome-badge">👤 {studentName}</span>
      </header>

      <div className="tabs">
        <button
          className={`tab${activeTab === 'assignments' ? ' active' : ''}`}
          onClick={() => setActiveTab('assignments')}
        >
          Assignments
          <span className="tab-count">{assignments?.length || 0}</span>
        </button>
        <button
          className={`tab${activeTab === 'submissions' ? ' active' : ''}`}
          onClick={() => setActiveTab('submissions')}
        >
          My Submissions
          <span className="tab-count">{mySubmissions.length}</span>
        </button>
      </div>

      {/* ── Assignments Tab ── */}
      {activeTab === 'assignments' && (
        <div className="cards-list">
          {(assignments?.length || 0) === 0 ? (
            <div className="empty-state">
              <span>📭</span>
              <p>No assignments available yet.</p>
            </div>
          ) : (
            assignments.map(a => (
              <div key={a.assignment_id} className="card assignment-card">
                <div className="assignment-info">
                  <h3>{a.title}</h3>
                  <p>{a.description}</p>
                  <span className="date-label">Posted {new Date(a.created_at).toLocaleDateString()}</span>
                </div>

                {submittingFor === a.assignment_id ? (
                  <div className="submit-form">
                    {/* Type toggle */}
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <button
                        type="button"
                        className={submitType === 'text' ? 'btn-primary' : 'btn-secondary'}
                        style={{ flex: 1, padding: '0.4rem', fontSize: '0.85rem' }}
                        onClick={() => { setSubmitType('text'); setPdfFile(null); }}
                      >
                        ✏️ Text
                      </button>
                      <button
                        type="button"
                        className={submitType === 'pdf' ? 'btn-primary' : 'btn-secondary'}
                        style={{ flex: 1, padding: '0.4rem', fontSize: '0.85rem' }}
                        onClick={() => { setSubmitType('pdf'); setSubmitContent(''); }}
                      >
                        📄 PDF Upload
                      </button>
                    </div>

                    {submitType === 'text' ? (
                      <textarea
                        placeholder="Type your submission here..."
                        value={submitContent}
                        onChange={e => setSubmitContent(e.target.value)}
                        rows={6}
                      />
                    ) : (
                      <div
                        style={{
                          border: '2px dashed var(--border)',
                          borderRadius: 'var(--radius)',
                          padding: '1.5rem',
                          textAlign: 'center',
                          cursor: 'pointer',
                          background: pdfFile ? '#f0fdf4' : undefined,
                          borderColor: pdfFile ? 'var(--success)' : undefined,
                        }}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <div style={{ fontSize: '1.5rem', marginBottom: '0.4rem' }}>
                          {pdfFile ? '✅' : '📤'}
                        </div>
                        {pdfFile ? (
                          <p style={{ color: 'var(--success)', fontWeight: 600 }}>{pdfFile.name}</p>
                        ) : (
                          <>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                              Click to select a PDF file
                            </p>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.2rem' }}>
                              Max size: 10MB
                            </p>
                          </>
                        )}
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept=".pdf"
                          style={{ display: 'none' }}
                          onChange={e => setPdfFile(e.target.files[0] || null)}
                        />
                      </div>
                    )}

                    {submitType === 'text' && submitContent.trim() && (
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {submitContent.trim().split(/\s+/).length} words
                      </p>
                    )}

                    <div className="form-actions">
                      <button className="btn-secondary" onClick={cancelSubmit}>Cancel</button>
                      <button
                        className="btn-primary"
                        onClick={() => handleSubmit(a)}
                        disabled={loading}
                      >
                        {loading ? 'Submitting…' : 'Submit'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    className="btn-primary submit-btn"
                    onClick={() => openSubmitForm(a.assignment_id)}
                  >
                    Submit Assignment
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* ── My Submissions Tab ── */}
      {activeTab === 'submissions' && (
        <div className="cards-list">
          {mySubmissions.length === 0 ? (
            <div className="empty-state">
              <span>📝</span>
              <p>No submissions yet. Go to Assignments to submit your work.</p>
            </div>
          ) : (
            mySubmissions.map((sub, i) => (
              <div key={sub.submission_id} className="card submission-card">
                <div className="submission-header">
                  <h3>{sub.assignment_title}</h3>
                  <div className="submission-meta">
                    <span className={`status-badge status-${sub.status}`}>{sub.status}</span>
                    {sub.status !== 'evaluated' && (
                      <button className="btn-refresh" onClick={() => refreshSubmission(sub.submission_id, i)}>
                        ↻ Refresh
                      </button>
                    )}
                  </div>
                </div>
                <span className="date-label">Submitted {new Date(sub.submitted_at).toLocaleString()}</span>

                {sub.feedback ? (
                  <div className="feedback-box">
                    <h4>AI Evaluation</h4>
                    <div className="feedback-grid">
                      <div className="feedback-stat">
                        <span className="stat-label">Score</span>
                        <span className="stat-value score-value">
                          {sub.feedback.score}<small>/100</small>
                        </span>
                      </div>
                      <div className="feedback-stat">
                        <span className="stat-label">Plagiarism Risk</span>
                        <span className="stat-value">{sub.feedback.plagiarism_risk}</span>
                      </div>
                    </div>
                    <p className="feedback-summary">{sub.feedback.feedback_summary}</p>
                  </div>
                ) : (
                  sub.status === 'pending' && (
                    <p className="pending-msg">⏳ Your submission is being evaluated. Click Refresh to check.</p>
                  )
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
