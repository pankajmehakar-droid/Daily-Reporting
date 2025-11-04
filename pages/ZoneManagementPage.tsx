import React from 'react';
import { User, ZONES } from '../types';
import { OfficeBuildingIcon } from '../components/icons';

interface ZoneManagementPageProps {
  currentUser: User;
}

const ZoneManagementPage: React.FC<ZoneManagementPageProps> = ({ currentUser }) => {
  const isAuthorized = currentUser.role === 'admin' || currentUser.designation.toUpperCase() === 'ZONAL MANAGER';

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
        <OfficeBuildingIcon className="w-7 h-7" /> Zone Management
      </h2>

      {!isAuthorized ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 text-center">
          <p className="text-red-500 dark:text-red-400 font-semibold">
            You do not have permission to view Zone Management.
          </p>
          <p className="text-gray-500 dark:text-gray-400 mt-2">
            This page is accessible only to Administrators and Zonal Managers.
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <p className="text-gray-700 dark:text-gray-300 mb-4">
            This page allows for the management of organizational zones.
            {currentUser.role === 'admin' && ' As an Administrator, you can manage all zones.'}
            {currentUser.designation.toUpperCase() === 'ZONAL MANAGER' && ' As a Zonal Manager, you can view and manage zones relevant to your scope.'}
          </p>

          <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-3">Current Zones</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Zone Name
                  </th>
                  {/* Future: Add actions like 'Edit', 'Delete' */}
                  {currentUser.role === 'admin' && (
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {ZONES.map((zone, index) => (
                  <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                      {zone}
                    </td>
                    {currentUser.role === 'admin' && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                        {/* Placeholder for Edit/Delete buttons */}
                        <span className="text-gray-400"> (Manage) </span>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Future: Add form for adding new zones */}
          {currentUser.role === 'admin' && (
            <div className="mt-6 p-4 border-t border-gray-200 dark:border-gray-700">
              <button className="btn btn-indigo">Add New Zone</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ZoneManagementPage;