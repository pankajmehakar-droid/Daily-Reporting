import React from 'react';
import { User } from '../types';
import { LogOutIcon, MenuIcon, ChartPieIcon } from './icons'; // Added ChartPieIcon

interface HeaderProps {
  user: User;
  onLogout: () => void;
  onMenuToggle: () => void;
  onNavigate: (page: 'profilesettings') => void; // Added onNavigate prop
}

const Header: React.FC<HeaderProps> = ({ user, onLogout, onMenuToggle, onNavigate }) => {
  const getInitials = (name: string): string => {
    if (!name) return '?';
    const parts = name.split(' ').filter(Boolean);
    if (parts.length > 1 && parts[0] && parts[parts.length - 1]) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    if (parts.length === 1 && parts[0]) {
      return parts[0][0].toUpperCase();
    }
    return '?';
  };

  const initials = getInitials(user.staffName);

  return (
    <header className="bg-white dark:bg-gray-800 shadow-md sticky top-0 z-10 flex-shrink-0">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Menu button for mobile */}
          <button
            onClick={onMenuToggle}
            className="p-2 rounded-md text-gray-500 dark:text-gray-400 lg:hidden focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500"
            aria-label="Open sidebar"
          >
            <MenuIcon className="w-6 h-6" />
          </button>
          
          {/* Mobile-only app title */}
          <div className="flex items-center lg:hidden">
            <ChartPieIcon className="w-6 h-6 text-indigo-500 mr-2" />
            <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
              Daily Reporting
            </h1>
          </div>

          {/* Desktop header title */}
          <div className="hidden lg:flex items-center">
             <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
              Dashboard
            </h1>
          </div>

          <div className="flex items-center space-x-4">
            {/* Clickable User Info */}
            <button
              onClick={() => onNavigate('profilesettings')} // Navigate to profile settings
              className="flex items-center space-x-3 group cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-100 dark:focus:ring-offset-gray-800 focus:ring-indigo-500 rounded-full p-1 -m-1"
              aria-label="View Profile Settings"
            >
              <div className="text-right hidden sm:block flex-shrink-0">
                <p className="text-sm font-medium text-gray-800 dark:text-gray-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors duration-150">{user.staffName}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">{user.role}</p>
              </div>
              
              {/* Avatar */}
              <div className="flex-shrink-0">
                <div className={`w-10 h-10 rounded-full bg-indigo-500 text-white flex items-center justify-center font-bold ${initials.length > 1 ? 'text-base' : 'text-lg'}`}>
                  {initials}
                </div>
              </div>
            </button>

            <button
              onClick={onLogout}
              className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-100 dark:focus:ring-offset-gray-800 focus:ring-indigo-500"
              aria-label="Logout"
            >
              <LogOutIcon className="w-6 h-6" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;