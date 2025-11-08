// FIX: Import useMemo from React
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ChartPieIcon, DashboardIcon, AnalyticsIcon, SettingsIcon, UsersIcon, ChevronDownIcon, LockIcon, OfficeBuildingIcon, FileTextIcon, TargetIcon, FileDownIcon, EditIcon, Share2Icon } from './icons';
import { User, Designation } from '../types'; // Import Designation type

type ActivePage = 'dashboard' | 'dailytask_achievement' | 'dailytask_projection' | 'dailytask_demand' | 'analytics' | 'reports_full' | 'reports_today_submitted' | 'reports_projection' | 'settings' | 'usermanagement' | 'branchmanagement' | 'targetmapping' | 'productsettings' | 'managerassignments' | 'staffassignments' | 'profilesettings' | 'admin_target_branch' | 'organizationmanagement' | 'productmapping' | 'dailytask_new_achievement_form';

interface NavItem {
  title: string;
  icon: React.FC<React.SVGProps<SVGSVGElement>>;
  page?: ActivePage;
  roles: string[];
  submenu?: NavItem[];
  designations?: Designation[]; // Add optional 'designations' property here
}

interface LeftPanelProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  activePage: ActivePage;
  onNavigate: (page: ActivePage) => void;
}

const NavLink: React.FC<{
  isActive: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
  isParentActive?: boolean; // New prop to indicate if a parent menu is active
}> = ({ isActive, onClick, children, className = '', isParentActive = false }) => {
  const activeClasses = 'text-white bg-indigo-500';
  const inactiveClasses = 'text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700';
  const parentActiveClasses = 'font-semibold text-gray-800 dark:text-gray-100';

  return (
    <a
      href="#"
      onClick={(e) => { e.preventDefault(); onClick(); }}
      className={`flex items-center px-4 py-2.5 text-sm rounded-md transition-colors duration-150 ${isActive ? activeClasses : inactiveClasses} ${isParentActive && !isActive ? parentActiveClasses : ''} ${className}`}
    >
      {children}
    </a>
  );
};

const LeftPanel: React.FC<LeftPanelProps> = ({ isOpen, onClose, user, activePage, onNavigate }) => {
  const [openMenus, setOpenMenus] = useState<string[]>([]);

  const toggleMenu = (title: string) => {
    setOpenMenus(prev => prev.includes(title) ? prev.filter(t => t !== title) : [...prev, title]);
  };

  const isSubmenuActive = useCallback((submenu: NavItem[]): boolean => {
    return submenu.some(item => item.page === activePage || (item.submenu && isSubmenuActive(item.submenu)));
  }, [activePage]);

  const navItems: NavItem[] = [
    { title: 'Dashboard', icon: DashboardIcon, page: 'dashboard', roles: ['admin', 'manager', 'user'] },
    { 
      title: 'Daily Tasks', 
      icon: EditIcon,
      roles: ['admin', 'manager', 'user'],
      submenu: [
        // Removed the "Submit Achievement (Excel)" entry
        // { title: 'Submit Achievement (Excel)', icon: FileDownIcon, page: 'dailytask_achievement', roles: ['admin', 'manager', 'user'] },
        { title: 'Submit Daily Achievement', icon: FileDownIcon, page: 'dailytask_new_achievement_form', roles: ['admin', 'manager', 'user'] }, // Kept as the primary entry
        { title: 'Submit Projection', icon: FileDownIcon, page: 'dailytask_projection', roles: ['admin', 'manager', 'user'] },
        { title: 'View Today\'s Demand', icon: FileDownIcon, page: 'dailytask_demand', roles: ['admin', 'manager', 'user'] },
      ]
    },
    { title: 'Analytics', icon: AnalyticsIcon, page: 'analytics', roles: ['admin', 'manager', 'user'] },
    { 
      title: 'Reports', 
      icon: FileTextIcon,
      roles: ['admin', 'manager', 'user'],
      submenu: [
        { title: 'Full Submitted Report', icon: FileDownIcon, page: 'reports_full', roles: ['admin', 'manager', 'user'] },
        { title: 'Today\'s Submitted Report', icon: FileDownIcon, page: 'reports_today_submitted', roles: ['admin', 'manager', 'user'] },
        { title: 'Projection Report', icon: FileDownIcon, page: 'reports_projection', roles: ['admin', 'manager', 'user'] },
      ]
    },
    { 
      title: 'Admin', 
      icon: LockIcon,
      roles: ['admin', 'manager'],
      submenu: [
        { title: 'User Management', icon: UsersIcon, page: 'usermanagement', roles: ['admin', 'manager'] },
        { title: 'Branch Management', icon: OfficeBuildingIcon, page: 'branchmanagement', roles: ['admin', 'manager'] },
        { title: 'Organization Management', icon: OfficeBuildingIcon, page: 'organizationmanagement', roles: ['admin'] }, // NEW ENTRY
      ]
    },
    // The previous standalone 'Organization' entry is now moved under 'Admin' submenu
    /*
    { 
      title: 'Organization', 
      icon: OfficeBuildingIcon,
      page: 'organizationmanagement',
      roles: ['admin'],
    },
    */
    { 
      title: 'Mappings', 
      icon: Share2Icon,
      roles: ['admin', 'manager'],
      submenu: [
        { title: 'Target Mapping', icon: TargetIcon, page: 'targetmapping', roles: ['admin', 'manager'] },
        { title: 'Manager Assignments', icon: UsersIcon, page: 'managerassignments', roles: ['admin', 'manager'] },
        { title: 'Staff Assignments', icon: UsersIcon, page: 'staffassignments', roles: ['admin', 'manager'] },
        { title: 'Branch Target Mapping', icon: TargetIcon, page: 'admin_target_branch', roles: ['admin', 'manager'] },
      ]
    },
    { 
      title: 'Product Setting', 
      icon: SettingsIcon,
      roles: ['admin'],
      submenu: [
        { title: 'Product Metric', icon: SettingsIcon, page: 'productsettings', roles: ['admin'] },
        { title: 'Product Mapping', icon: UsersIcon, page: 'productmapping', roles: ['admin'] },
      ]
    },
    { title: 'Settings', icon: SettingsIcon, page: 'settings', roles: ['admin', 'manager', 'user'] },
  ];

  useEffect(() => {
    const findActiveParent = (items: NavItem[], currentPath: string[]): string[] => {
        for (const item of items) {
            if (item.page === activePage) {
                return currentPath;
            }
            if (item.submenu) {
                const result = findActiveParent(item.submenu, [...currentPath, item.title]);
                if (result.length > currentPath.length) {
                    return result;
                }
            }
        }
        return currentPath;
    };

    const activePath = findActiveParent(navItems, []);
    setOpenMenus(prev => [...new Set([...prev, ...activePath])]);
  }, [activePage, navItems]);

  const filteredNavItems = useMemo(() => {
    const filterItems = (items: NavItem[]): NavItem[] => {
        return items.reduce((acc: NavItem[], item) => {
            // Check if user has at least one of the required roles AND if the item is for the current user's role OR a wider scope (e.g., admin role matches manager role item)
            const userHasRole = item.roles.includes(user.role);
            
            if (userHasRole) {
                if (item.submenu) {
                    const filteredSubmenu = filterItems(item.submenu);
                    if (filteredSubmenu.length > 0) {
                        acc.push({ ...item, submenu: filteredSubmenu });
                    }
                } else {
                    acc.push(item);
                }
            }
            return acc;
        }, []);
    };
    return filterItems(navItems);
  }, [user.role, navItems]);


  const renderNavItems = (items: NavItem[], level = 0) => {
    return items.map(item => {
      if (item.submenu) {
        const isParentActive = isSubmenuActive(item.submenu);
        return (
          <div key={item.title}>
            <NavLink
              isActive={false} // A parent is never "active" itself
              isParentActive={isParentActive}
              onClick={() => toggleMenu(item.title)}
              className="justify-between"
            >
              <div className="flex items-center">
                <item.icon className="w-5 h-5 mr-3" />
                <span>{item.title}</span>
              </div>
              <ChevronDownIcon className={`w-5 h-5 transform transition-transform duration-200 ${openMenus.includes(item.title) ? 'rotate-180' : ''}`} />
            </NavLink>
            {openMenus.includes(item.title) && (
              <div className={`pl-6 transition-all duration-300 ease-in-out ${level > 0 ? 'border-l border-gray-200 dark:border-gray-600 ml-4' : ''}`}>
                {renderNavItems(item.submenu, level + 1)}
              </div>
            )}
          </div>
        );
      }
      return (
        <NavLink
          key={item.page}
          isActive={activePage === item.page}
          onClick={() => item.page && onNavigate(item.page)}
        >
          <item.icon className="w-5 h-5 mr-3" />
          <span>{item.title}</span>
        </NavLink>
      );
    });
  };
  
  return (
    <>
      {/* Overlay for mobile */}
      <div
        className={`fixed inset-0 bg-black bg-opacity-30 z-30 lg:hidden transition-opacity ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      ></div>

      <aside
        className={`fixed top-0 left-0 w-64 h-full bg-white dark:bg-gray-800 shadow-lg z-40 transform transition-transform duration-300 lg:translate-x-0 lg:relative lg:flex-shrink-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="flex items-center justify-center h-16 border-b border-gray-200 dark:border-gray-700">
          <ChartPieIcon className="w-8 h-8 text-indigo-500" />
          <span className="ml-3 text-xl font-semibold text-gray-800 dark:text-gray-100">Daily Reporting</span>
        </div>
        <nav className="p-4 space-y-2 overflow-y-auto" style={{ height: 'calc(100% - 4rem)' }}>
          {renderNavItems(filteredNavItems)}
        </nav>
      </aside>
    </>
  );
};

export default LeftPanel;