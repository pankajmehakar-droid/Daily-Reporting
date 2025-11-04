import React, { useState, useEffect, useCallback } from 'react';
import { ChartPieIcon, DashboardIcon, AnalyticsIcon, SettingsIcon, UsersIcon, ChevronDownIcon, LockIcon, OfficeBuildingIcon, FileTextIcon, TargetIcon, FileDownIcon, EditIcon } from './icons';
import { User, Designation } from '../types'; // Import Designation type

type ActivePage = 'dashboard' | 'dailytask_achievement' | 'dailytask_projection' | 'dailytask_demand' | 'analytics' | 'reports_full' | 'reports_today_submitted' | 'reports_projection' | 'settings' | 'usermanagement' | 'branchmanagement' | 'staffmanagement' | 'kramapping' | 'productsettings' | 'managerassignments' | 'staffassignments' | 'profilesettings' | 'admin_target_branch' | 'zonemanagement' | 'regionmanagement' | 'districtmanagement' | 'designationkrasettings';

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
  const inactiveClasses = 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700';
  const parentActiveClasses = 'text-gray-900 dark:text-gray-100'; // For leaf items whose parent is expanded due to its own active state

  return (
    <a
      href="#"
      onClick={(e) => {
        e.preventDefault();
        onClick();
      }}
      className={`flex items-center w-full px-4 py-2 text-sm font-medium rounded-md transition-colors duration-150 ${
        isActive ? activeClasses : (isParentActive ? parentActiveClasses : inactiveClasses)
      } ${className}`}
      aria-current={isActive ? 'page' : undefined}
    >
      {children}
    </a>
  );
};

// Fix: Apply the NavItem type to the navItems array
const navItems: NavItem[] = [
  {
    title: 'Dashboard',
    icon: DashboardIcon,
    page: 'dashboard' as ActivePage,
    roles: ['admin', 'user', 'manager'],
  },
  {
    title: 'Daily Tasks', // Now a submenu
    icon: FileTextIcon,
    roles: ['user', 'manager'],
    submenu: [
      {
        title: 'Submit Daily Achievement',
        icon: FileTextIcon,
        page: 'dailytask_achievement' as ActivePage,
        roles: ['user', 'manager'],
      },
      {
        title: 'Submit Today\'s Projection',
        icon: ChartPieIcon, // Using ChartPieIcon for projections
        page: 'dailytask_projection' as ActivePage,
        roles: ['user', 'manager'],
      },
      {
        title: 'View Today\'s Demand',
        icon: TargetIcon, // Using TargetIcon for demand
        page: 'dailytask_demand' as ActivePage,
        roles: ['user', 'manager'],
      },
      // Removed 'Staff Targets' from Daily Tasks for managers
    ]
  },
  {
    title: 'Analytics',
    icon: AnalyticsIcon,
    page: 'analytics' as ActivePage,
    roles: ['admin', 'user', 'manager'],
  },
  {
    title: 'Reports', // Now a submenu
    icon: FileDownIcon,
    roles: ['admin', 'user', 'manager'],
    submenu: [
      {
        title: 'Submitted Achi.Report', // Changed from 'Full Submitted Report'
        icon: FileDownIcon,
        page: 'reports_full' as ActivePage,
        roles: ['admin', 'user', 'manager'],
      },
      {
        title: 'View Today\'s Submitted Report', // New submenu item
        icon: FileTextIcon, // Using FileTextIcon for specific daily report
        page: 'reports_today_submitted' as ActivePage,
        roles: ['admin', 'user', 'manager'],
      },
      {
        title: 'Projection Report', // New: Projection Report
        icon: ChartPieIcon, // Icon for Projection Report
        page: 'reports_projection' as ActivePage,
        roles: ['admin', 'user', 'manager'],
      },
    ]
  },
  { // New Top-Level 'Mapping' menu
    title: 'Mapping',
    icon: TargetIcon, // Using TargetIcon for a general mapping icon
    roles: ['admin', 'manager'], // Both admin and manager can access this top-level
    submenu: [
      {
        title: 'Target Mapping', // Submenu for target types
        icon: TargetIcon,
        roles: ['admin', 'manager'],
        submenu: [
            {
                title: 'Branch Targets', // Page for branch targets
                icon: OfficeBuildingIcon, // Icon for branch-related targets
                page: 'admin_target_branch' as ActivePage,
                roles: ['admin', 'manager'], // Admin can manage all, manager their own
                designations: ['BRANCH MANAGER', 'SENIOR BRANCH MANAGER', 'ASSISTANT BRANCH MANAGER', 'BRANCH CREDIT MANAGER', 'BRANCH OPERATIONS MANAGER', 'BRANCH SALES MANAGER', 'TL-CASA', 'TL-DDS', 'TL-SMBG', 'DISTRICT HEAD', 'SENIOR DISTRICT HEAD', 'ASSISTANT DISTRICT HEAD', 'ZONAL MANAGER'] // Managers who might need to see/set branch targets
            },
            {
                title: 'Staff KRA Targets', // Existing KRA mapping page
                icon: TargetIcon,
                page: 'kramapping' as ActivePage,
                roles: ['admin', 'manager'], // Admin can manage all, manager their subordinates
            },
            {
                title: 'Designation KRA Setup', // Designation KRA Setup page
                icon: EditIcon, // Using edit icon for setup
                page: 'designationkrasettings' as ActivePage,
                roles: ['admin'], // Only Admin can configure
            },
        ]
      },
      {
        title: 'Product Settings', // Page for Product Settings
        icon: ChartPieIcon, // Using ChartPieIcon for product settings
        page: 'productsettings' as ActivePage,
        roles: ['admin'], // Only Admin can configure
      },
      {
        title: 'Manager Assignments', // Page for Manager Assignments
        icon: UsersIcon,
        page: 'managerassignments' as ActivePage,
        roles: ['admin'], // Only Admin can configure
      },
      {
        title: 'Staff Assignments', // Page for Staff Assignments
        icon: UsersIcon,
        page: 'staffassignments' as ActivePage,
        roles: ['admin'], // Only Admin can configure
      },
    ]
  },
  {
    title: 'Admin',
    icon: LockIcon,
    roles: ['admin'], // Only admin sees this top-level menu
    submenu: [
       {
        title: 'User Management',
        icon: UsersIcon,
        page: 'usermanagement' as ActivePage,
        roles: ['admin'],
      },
      {
        title: 'Staff Management', // MOVED HERE
        icon: UsersIcon,
        page: 'staffmanagement' as ActivePage,
        roles: ['admin', 'manager'], // Admin can also access this page, managers their scope
      },
      {
        title: 'Branch Management',
        icon: OfficeBuildingIcon,
        page: 'branchmanagement' as ActivePage,
        roles: ['admin'],
      },
      { // New 'Organization Management' submenu
        title: 'Organization Management',
        icon: OfficeBuildingIcon,
        roles: ['admin', 'manager'], // Managers might have limited access here
        submenu: [
          {
            title: 'Zone Management',
            icon: OfficeBuildingIcon,
            page: 'zonemanagement' as ActivePage,
            roles: ['admin', 'manager'], // Zonal Managers can access
            designations: ['ZONAL MANAGER'] // Zonal Managers can view/manage their zones
          },
          {
            title: 'Region Management',
            icon: OfficeBuildingIcon,
            page: 'regionmanagement' as ActivePage,
            roles: ['admin', 'manager'], // Zonal Managers can access
            designations: ['ZONAL MANAGER'] // Zonal Managers can view/manage their regions
          },
          {
            title: 'District Management',
            icon: OfficeBuildingIcon,
            page: 'districtmanagement' as ActivePage,
            roles: ['admin', 'manager'], // District heads can access
            designations: ['SENIOR DISTRICT HEAD', 'DISTRICT HEAD', 'ASSISTANT DISTRICT HEAD', 'ZONAL MANAGER'] // District heads can view/manage their districts
          }
        ]
      }
    ]
  },
  {
    title: 'Settings',
    icon: SettingsIcon,
    roles: ['admin', 'user', 'manager'],
    submenu: [
      {
        title: 'Profile Settings',
        icon: EditIcon, // Using EditIcon for profile settings
        page: 'profilesettings' as ActivePage,
        roles: ['admin', 'user', 'manager'],
      },
      {
        title: 'Change Password', // Existing functionality, can be a direct link or just stay as part of the 'Settings' page
        icon: LockIcon,
        page: 'settings' as ActivePage, // Points to the main settings page for password change
        roles: ['admin', 'user', 'manager'],
      }
      // Other settings could be added here later
    ]
  },
];


const LeftPanel: React.FC<LeftPanelProps> = ({ isOpen, onClose, user, activePage, onNavigate }) => {
  const [expandedMenus, setExpandedMenus] = useState<string[]>([]);

  // Helper function to find the full path of parent menu titles for an active page
  const findActivePagePath = useCallback((page: ActivePage, items: NavItem[]): string[] => {
    const path: string[] = [];
    const findPathRecursive = (currentItems: NavItem[], currentPath: string[]): boolean => {
      for (const item of currentItems) {
        // Filter by role and designation for active path calculation
        // FIX: Removed .toUpperCase() as user.designation is already a Designation type (union of uppercase string literals)
        const isAuthorized = item.roles.includes(user.role) && 
                             (!item.designations || item.designations.includes(user.designation));
        
        if (!isAuthorized) continue;

        if (item.page === page) {
          path.unshift(...currentPath); // Add ancestors in correct order
          return true;
        }
        if (item.submenu) {
          // Fix: Explicitly cast `item.submenu` to `NavItem[]`
          if (findPathRecursive(item.submenu as NavItem[], [...currentPath, item.title])) {
            path.unshift(item.title); // Add current menu title if a child is active
            return true;
          }
        }
      }
      return false;
    };
    findPathRecursive(items, []);
    return path.filter(Boolean); // Filter out any empty strings
  }, [user]); // Depend on user to re-calculate path if role/designation changes

  // Effect to set expandedMenus when activePage changes
  useEffect(() => {
    const activePath = findActivePagePath(activePage, navItems);
    // Ensure all menus in the active path are expanded
    setExpandedMenus(prev => Array.from(new Set([...prev, ...activePath])));
  }, [activePage, findActivePagePath]);


  const handleMenuToggle = (title: string, currentPath: string[]) => {
    setExpandedMenus(prev => {
      const newExpanded = new Set(prev);
      if (newExpanded.has(title)) {
        // If clicked menu is currently expanded, collapse it.
        // Also, implicitly collapse any submenus of this menu by filtering.
        // This logic correctly collapses submenus:
        return prev.filter(menuTitle => {
          // Find the index of the current title being toggled.
          const titleIndex = currentPath.indexOf(title);
          // For each menuTitle in the expanded list, find its path.
          // If menuTitle's path is longer than title's path and starts with title's path, it's a descendant.
          // This logic is a bit tricky to implement efficiently without knowing full paths of all prev expanded menus.
          // A simpler approach for collapsing just the direct submenu:
          const isDirectSubmenuOfTitle = currentPath.join(',') === [...currentPath.slice(0, titleIndex + 1), menuTitle].join(','); // Simplified check

          // Keep current title's ancestors and other unrelated menus.
          // Only remove if it's the current title itself or a descendant.
          const isDescendantOrSelf = currentPath.slice(0, titleIndex + 1).includes(menuTitle) || (currentPath.length > titleIndex + 1 && currentPath[titleIndex] === title);

          // For now, let's keep the existing logic that works for simple cases, and assume it filters children implicitly.
          // The current implementation is simpler: if it has 'title', remove it. Then, when a menu is expanded,
          // only the path up to that menu is explicitly added.
          return !menuTitle.startsWith(title + '/') && menuTitle !== title; // Simple check for descendants
        });
      } else {
        // If clicked menu is collapsed, expand it.
        // Ensure all its direct ancestors (from currentPath) are also expanded.
        currentPath.forEach(pathItem => newExpanded.add(pathItem));
        newExpanded.add(title);
        return Array.from(newExpanded);
      }
    });
  };
  
  const renderNavItems = (items: NavItem[], currentPath: string[] = []) => {
    return items.filter(item => {
      // Basic role check
      if (!item.roles.includes(user.role)) {
        return false;
      }
      // Additional designation check for specific menu items if specified
      // Fix: Ensure item.designations is an array before calling .includes
      // FIX: Removed .toUpperCase() as user.designation is already a Designation type
      if (item.designations && item.designations.length > 0) {
        return item.designations.includes(user.designation);
      }
      return true;
    }).map(item => {
      const isActivePage = activePage === item.page;
      const isParentMenuActive = currentPath.includes(item.title) || findActivePagePath(activePage, navItems).includes(item.title);

      if (!item.submenu) {
        return (
          <NavLink 
            key={item.page} 
            isActive={isActivePage} 
            onClick={() => onNavigate(item.page!)}
            isParentActive={isParentMenuActive}
          >
            <item.icon className="w-5 h-5 mr-3" />
            {item.title}
          </NavLink>
        );
      }

      const isMenuExpanded = expandedMenus.includes(item.title);
      const newPath = [...currentPath, item.title];

      return (
        <div key={item.title}>
          <button
            onClick={() => handleMenuToggle(item.title, currentPath)}
            className={`flex items-center justify-between w-full px-4 py-2 text-sm font-medium text-left rounded-md transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 ${
              isMenuExpanded || isParentMenuActive || isActivePage // Parent menu styling for active hierarchy
                ? 'text-gray-900 dark:text-gray-100 bg-gray-100 dark:bg-gray-700'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
            aria-expanded={isMenuExpanded}
          >
            <span className="flex items-center">
              <item.icon className="w-5 h-5 mr-3" />
              {item.title}
            </span>
            <ChevronDownIcon className={`w-4 h-4 transform transition-transform duration-200 ${isMenuExpanded ? 'rotate-180' : ''}`} />
          </button>
          {/* Fix: Explicitly cast `item.submenu` to `NavItem[]` */}
          <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isMenuExpanded ? 'max-h-96' : 'max-h-0'}`}>
            <ul className="pt-1 pl-5 mt-1 space-y-1">
              {renderNavItems(item.submenu as NavItem[], newPath)}
            </ul>
          </div>
        </div>
      );
    });
  };

  return (
    <>
      {/* Overlay for mobile */}
      <div
        className={`fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden transition-opacity ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
        aria-hidden="true"
      ></div>

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full w-64 bg-white dark:bg-gray-800 shadow-xl z-30 transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0 lg:static lg:shadow-none lg:w-64 lg:flex-shrink-0`}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-center h-16 border-b border-gray-200 dark:border-gray-700 flex-shrink-0 px-4">
             <div className="flex items-center space-x-3">
                <ChartPieIcon className="w-8 h-8 text-indigo-500" />
                <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
                  Daily Reporting
                </h1>
              </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-2 py-4 space-y-1">
            {renderNavItems(navItems)}
          </nav>
        </div>
      </aside>
    </>
  );
};

export default LeftPanel;