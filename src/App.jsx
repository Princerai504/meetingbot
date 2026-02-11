import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import CreateMeeting from './pages/CreateMeeting';
import MeetingSummary from './pages/MeetingSummary';
import MeetingHistory from './pages/MeetingHistory';

function App() {
  return (
    <Router>
      <Navbar />
      <main>
        <Routes>
          <Route path="/" element={<CreateMeeting />} />
          <Route path="/summary/:id" element={<MeetingSummary />} />
          <Route path="/history" element={<MeetingHistory />} />
        </Routes>
      </main>
    </Router>
  );
}

export default App;
