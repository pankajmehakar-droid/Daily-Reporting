import React, { useState, useEffect } from 'react';
import { User } from './types';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import { initializeDataAndAuthServices } from './services/dataService'; // Import the new initializer

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Call the initializer once on app startup
  useEffect(() => {
    initializeDataAndAuthServices();
  }, []); // Empty dependency array means this runs once on mount

  const handleLogin = (user: User) => {
    setCurrentUser(user);
  };

  const handleLogout = () => {
    setCurrentUser(null);
  };

  // Callback to update the current user in App.tsx state
  const handleUserUpdate = (user: User) => {
    setCurrentUser(user);
  };

  return (
    <div className="min-h-screen font-sans text-gray-800 bg-gray-100 dark:bg-gray-900 dark:text-gray-200 flex flex-col">
      {currentUser ? (
        <DashboardPage user={currentUser} onLogout={handleLogout} onUserUpdate={handleUserUpdate} />
      ) : (
        <LoginPage onLogin={handleLogin} />
      )}
    </div>
  );
};

export default App;