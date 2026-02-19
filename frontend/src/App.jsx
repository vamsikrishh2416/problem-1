import { useState } from 'react';
import LandingPage from './pages/LandingPage';
import StudentDashboard from './pages/StudentDashboard';
import InstructorDashboard from './pages/InstructorDashboard';

function App() {
  const [role, setRole] = useState(null);

  if (role === 'student') return <StudentDashboard onBack={() => setRole(null)} />;
  if (role === 'instructor') return <InstructorDashboard onBack={() => setRole(null)} />;
  return <LandingPage onSelectRole={setRole} />;
}

export default App;
