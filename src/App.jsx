import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Toast from './components/Toast';
import ComplaintModal from './components/ComplaintModal';
import ProfileModal from './components/ProfileModal';
import NotificationModal from './components/NotificationModal';
import FloatingNotification from './components/FloatingNotification';
import TutorialModal from './components/TutorialModal';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import KpiBoard from './pages/KpiBoard';
import TeamStructure from './pages/TeamStructure';
import EmployeeMaster from './pages/EmployeeMaster';
import MarketingCalling from './pages/MarketingCalling';
import Prospects from './pages/Prospects';
import Followups from './pages/Followups';
import Reports from './pages/Reports';
import HrDesk from './pages/HrDesk';
import Settings from './pages/Settings';
import TeamLeadWorkspace from './pages/TeamLeadWorkspace';

const MainApp = () => {
  const { user, loading } = useAuth();
  const [activePage, setActivePage] = useState('dashboard');
  const [dateFilter, setDateFilter] = useState('Today');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isComplaintModalOpen, setIsComplaintModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isNotificationModalOpen, setIsNotificationModalOpen] = useState(false);
  const [isTutorialOpen, setIsTutorialOpen] = useState(false);
  
  // Global Toast State
  const [toastMessage, setToastMessage] = useState('');
  const [toastIsError, setToastIsError] = useState(false);

  const showToast = (message, isError = false) => {
    setToastMessage(message);
    setToastIsError(isError);
  };

  const handleCloseToast = () => {
    setToastMessage('');
  };

  const handleSubmitComplaint = async (complaintBody) => {
    try {
      const res = await fetch('/api/complaints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(complaintBody)
      });
      if (res.ok) {
        showToast(`Complaint submitted successfully to ${complaintBody.recipientRole}!`);
        setIsComplaintModalOpen(false);
      } else {
        const errData = await res.json();
        showToast(errData.message || 'Error submitting complaint.', true);
      }
    } catch (err) {
      showToast('Connection to server failed.', true);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', height: '100vh', width: '100vw', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, sans-serif', color: 'var(--text-muted)' }}>
        Loading Zeravia_beta---CRM session...
      </div>
    );
  }

  // Not logged in -> Show login view
  if (!user) {
    return <Login />;
  }

  return (
    <div id="app-layout" className="app-layout">
      {/* Sidebar Nav */}
      <Sidebar 
        activePage={activePage} 
        setActivePage={setActivePage}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
      />

      {/* Main Workspace Frame */}
      <div className="main-content">
        <Header 
          activePage={activePage}
          dateFilter={dateFilter}
          setDateFilter={setDateFilter}
          onOpenComplaintModal={() => setIsComplaintModalOpen(true)}
          onOpenProfile={() => setIsProfileModalOpen(true)}
          setSidebarOpen={setSidebarOpen}
          onOpenNotifications={() => setIsNotificationModalOpen(true)}
          onOpenHelp={() => setIsTutorialOpen(true)}
        />
        <style>{'#menu-toggle-btn { display: none; } @media (max-width: 1024px) { #menu-toggle-btn { display: inline-flex !important; } }'}</style>

        {/* Dynamic Pages Container */}
        <main className="content-body">
          {activePage === 'dashboard' && <Dashboard dateFilter={dateFilter} showToast={showToast} />}
          {activePage === 'kpi-board' && <KpiBoard dateFilter={dateFilter} showToast={showToast} />}
          {activePage === 'team-structure' && <TeamStructure showToast={showToast} />}
          {activePage === 'employee-master' && <EmployeeMaster showToast={showToast} />}
          {activePage === 'marketing-calling' && <MarketingCalling showToast={showToast} />}
          {activePage === 'prospects' && <Prospects showToast={showToast} />}
          {activePage === 'follow-ups' && <Followups showToast={showToast} />}
          {activePage === 'reports' && <Reports dateFilter={dateFilter} showToast={showToast} />}
          {activePage.startsWith('hr-') && <HrDesk showToast={showToast} activeHrTab={activePage} />}
          {activePage === 'settings' && <Settings showToast={showToast} />}
          {activePage === 'team-lead-workspace' && <TeamLeadWorkspace showToast={showToast} />}
        </main>
      </div>

      {/* Global Modals & Notifications */}
      <ComplaintModal 
        isOpen={isComplaintModalOpen}
        onClose={() => setIsComplaintModalOpen(false)}
        onSubmit={handleSubmitComplaint}
      />

      <ProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        showToast={showToast}
      />

      <NotificationModal
        isOpen={isNotificationModalOpen}
        onClose={() => setIsNotificationModalOpen(false)}
      />

      <TutorialModal
        isOpen={isTutorialOpen}
        onClose={() => setIsTutorialOpen(false)}
      />

      <FloatingNotification />

      <Toast 
        message={toastMessage}
        isError={toastIsError}
        onClose={handleCloseToast}
      />
    </div>
  );
};

const App = () => {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
};

export default App;
