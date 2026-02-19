export default function LandingPage({ onSelectRole }) {
  return (
    <div className="landing">
      <div className="landing-hero">
        <div className="landing-icon">📚</div>
        <h1>Assignment Evaluation Platform</h1>
        <p>AI-powered assignment submission and evaluation system</p>
      </div>

      <div className="role-cards">
        <div className="role-card" onClick={() => onSelectRole('student')}>
          <div className="role-icon">🎓</div>
          <h2>Student</h2>
          <p>View assignments, submit your work, and receive instant AI feedback</p>
          <button className="btn-primary role-btn">Enter as Student</button>
        </div>

        <div className="role-card" onClick={() => onSelectRole('instructor')}>
          <div className="role-icon">📋</div>
          <h2>Instructor</h2>
          <p>Create assignments, manage submissions, and review evaluations</p>
          <button className="btn-primary role-btn">Enter as Instructor</button>
        </div>
      </div>
    </div>
  );
}
