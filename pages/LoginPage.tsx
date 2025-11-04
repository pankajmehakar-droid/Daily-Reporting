import React, { useState, useRef, useEffect } from 'react';
import { User } from '../types';
import { login } from '../services/authService';
import { getStaffData } from '../services/dataService';
import { ChartPieIcon, AlertTriangleIcon, XIcon, UsersIcon } from '../components/icons';

interface LoginPageProps {
  onLogin: (user: User) => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showLogins, setShowLogins] = useState(false); // Kept for potential manual triggering/debugging
  
  const isMounted = useRef(false);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const allStaff = getStaffData();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const user = await login(username, password);
      if (isMounted.current) {
        onLogin(user);
      }
    } catch (err) {
      if (isMounted.current) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred.');
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  };

  // The modal component is kept but not actively opened from the UI
  const LoginSuggestionsModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-40 flex items-center justify-center p-4" aria-modal="true" role="dialog">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Available Login Credentials</h3>
          <button onClick={() => setShowLogins(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" aria-label="Close login credentials modal">
            <XIcon className="w-6 h-6"/>
          </button>
        </div>
        <div className="overflow-y-auto p-2">
          <div className="p-2 bg-blue-50 dark:bg-blue-900/30 text-sm text-blue-700 dark:text-blue-200 rounded-md">
            Use the <strong>Employee Code</strong> for both username and password.
          </div>
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 mt-2">
            <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Staff Name</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Role</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Employee Code (Login ID)</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">System Admin</td>
                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">Admin</td>
                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300 font-mono">admin (pw: admin123)</td>
              </tr>
              <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">Zonal Manager User</td>
                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">Manager (Zonal)</td>
                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300 font-mono">zm (pw: zm123)</td>
              </tr>
              {allStaff.filter(s => s.employeeCode !== 'ADMIN' && s.employeeCode !== 'ZM001').map(staff => (
                <tr key={staff.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">{staff.employeeName}</td>
                  <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{staff.function.toUpperCase().includes('BRANCH MANAGER') || staff.function.toUpperCase().includes('HEAD') || staff.function.toUpperCase().includes('TL') ? 'Manager' : 'User'}</td>
                  <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300 font-mono">{staff.employeeCode}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4">
      {showLogins && <LoginSuggestionsModal />}
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-6">
            <div className="p-3 bg-indigo-500 rounded-full mb-3">
                <ChartPieIcon className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">Daily Reporting</h1>
            <p className="text-gray-600 dark:text-gray-400">Please sign in to continue</p>
        </div>

        <div className="bg-white dark:bg-gray-800 shadow-2xl rounded-2xl p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Employee Code
              </label>
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="mt-1 block w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                placeholder="Your Employee Code"
              />
            </div>

            <div>
              <label htmlFor="password"  className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                placeholder="Your Employee Code"
              />
            </div>
            
            {error && (
                <div className="flex items-start space-x-2 text-sm text-red-600 dark:text-red-400">
                    <AlertTriangleIcon className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    <span>{error}</span>
                </div>
            )}

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-400 disabled:cursor-not-allowed"
              >
                {loading ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                ) : (
                    'Sign In'
                )}
              </button>
            </div>
          </form>
        </div>
         {/* Removed: Login hints and "View All Login Credentials" button */}
      </div>
    </div>
  );
};

export default LoginPage;