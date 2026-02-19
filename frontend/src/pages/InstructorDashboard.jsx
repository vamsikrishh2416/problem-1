import { useState, useEffect } from 'react';
import api from '../api/axios';
import Toast from '../components/Toast';

export default function InstructorDashboard({ onBack }) {
  const [assignments, setAssignments] = useState([]);
  const [form, setForm] = useState({ title: '', description: '' });
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [submissions, setSubmissions] = useState({});
  const [loadingSubs, setLoadingSubs] = useState({});
  const [toast, setToast] = useState(null);

  useEffect(() => {
    loadAssignments();
  }, []);

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

  async function handleCreate(e) {
    e.preventDefault();
    if (!form.title.trim() || !form.description.trim()) {
      showToast('Title and description are required', 'error');
      return;
    }
    setCreating(true);
    try {
      const res = await api.post('/assignments', form);
      setAssignments([res.data, ...assignments]);
      setForm({ title: '', description: '' });
      setShowForm(false);
      showToast('Assignment created successfully!');
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to create assignment', 'error');
    } finally {
      setCreating(false);
    }
  }

  async function toggleAssignment(assignmentId) {
    if (expandedId === assignmentId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(assignmentId);
    await fetchSubmissions(assignmentId);
  }

  async function fetchSubmissions(assignmentId) {
    setLoadingSubs(prev => ({ ...prev, [assignmentId]: true }));
    try {
      const res = await api.get(`/submissions/assignment/${assignmentId}`);
      setSubmissions(prev => ({ ...prev, [assignmentId]: res.data.submissions }));
    } catch {
      showToast('Failed to load submissions', 'error');
    } finally {
      setLoadingSubs(prev => ({ ...prev, [assignmentId]: false }));
    }
  }

  return (
    <div className="dashboard">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <header className="dashboard-header">
        <button className="btn-back" onClick={onBack}>← Back</button>
        <h1>Instructor Dashboard</h1>
        <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : '+ New Assignment'}
        </button>
      </header>

      {showForm && (
        <div className="card form-card">
          <h2>Create New Assignment</h2>
          <form onSubmit={handleCreate}>
            <div className="form-group">
              <label>Title</label>
              <input
                type="text"
                placeholder="e.g. Essay on Climate Change"
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
                autoFocus
              />
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea
                placeholder="Describe the assignment requirements, expectations, and grading criteria..."
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                rows={4}
              />
            </div>
            <div className="form-actions">
              <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={creating}>
                {creating ? 'Creating...' : 'Create Assignment'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="section-header">
        <h2>All Assignments</h2>
        <span className="section-count">{assignments?.length || 0} total</span>
      </div>

      <div className="cards-list">
        {(assignments?.length || 0) === 0 ? (
          <div className="empty-state">
            <span>📋</span>
            <p>No assignments yet. Create your first one above.</p>
          </div>
        ) : (
          assignments.map(a => {
            const isOpen = expandedId === a.assignment_id;
            const subs = submissions[a.assignment_id];
            const loadingThis = loadingSubs[a.assignment_id];

            return (
              <div key={a.assignment_id} className={`card assignment-card${isOpen ? ' expanded' : ''}`}>
                <div className="assignment-info clickable" onClick={() => toggleAssignment(a.assignment_id)}>
                  <div className="assignment-top-row">
                    <h3>{a.title}</h3>
                    <span className="expand-icon">{isOpen ? '▲' : '▼'}</span>
                  </div>
                  <p>{a.description}</p>
                  <span className="date-label">Created {new Date(a.created_at).toLocaleDateString()}</span>
                </div>

                {isOpen && (
                  <div className="submissions-panel">
                    <div className="submissions-panel-header">
                      <h4>Submissions</h4>
                      <button className="btn-refresh" onClick={() => fetchSubmissions(a.assignment_id)}>
                        ↻ Refresh
                      </button>
                    </div>

                    {loadingThis ? (
                      <div className="loading-msg">Loading submissions...</div>
                    ) : !subs || subs.length === 0 ? (
                      <div className="empty-state small">
                        <p>No submissions yet for this assignment.</p>
                      </div>
                    ) : (
                      <div className="submissions-list">
                        {subs.map(sub => (
                          <div key={sub.submission_id} className="submission-row">
                            <div className="sub-row-header">
                              <span className="student-name">👤 {sub.student_name}</span>
                              <span className={`status-badge status-${sub.status}`}>{sub.status}</span>
                            </div>
                            <span className="date-label">{new Date(sub.submitted_at).toLocaleString()}</span>

                            {sub.feedback && (
                              <div className="feedback-inline">
                                <div className="feedback-inline-stats">
                                  <span>Score: <strong>{sub.feedback.score}/100</strong></span>
                                  <span>Plagiarism: <strong>{sub.feedback.plagiarism_risk}</strong></span>
                                </div>
                                <p className="feedback-summary">{sub.feedback.feedback_summary}</p>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
