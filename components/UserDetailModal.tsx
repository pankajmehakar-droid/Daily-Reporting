
import React from 'react';
import { User, StaffMember } from '../types';
import { XIcon, UsersIcon } from './icons';

interface UserDetailModalProps {
  user: User;
  onClose: () => void;
  allStaff: StaffMember[]; // Pass all staff for manager name lookup
}

const UserDetailModal: React.FC<UserDetailModalProps> = ({ user, onClose, allStaff }) => {
  const getLabelValue = (label: string, value: string | string[] | undefined) => {
    if (Array.isArray(value)) {
      return (
        <div className="flex flex-col sm:flex-row sm:items-baseline sm:space-x-2">
          <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 w-32 sm:w-40">{label}</dt>
          <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100 sm:mt-0 flex-1">
            {value.length > 0 ? value.join(', ') : 'N/A'}
          </dd>
        </div>
      );
    }
    
    // For reportsToEmployeeCode, display the manager's name if found
    let displayValue: string | undefined = value as string; // Cast to string for initial assignment
    if (label === "Reports To") {
        if (value === undefined || value === "") { // Explicitly check for undefined or empty string
            displayValue = 'N/A';
        } else {
            const manager = allStaff.find(s => s.employeeCode === value);
            if (manager) {
                displayValue = `${manager.employeeName} (${manager.employeeCode})`;
            } else {
                displayValue = `${value} (Unknown)`;
            }
        }
    }

    return (
      <div className="flex flex-col sm:flex-row sm:items-baseline sm:space-x-2">
        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 w-32 sm:w-40">{label}</dt>
        <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100 sm:mt-0 flex-1">{displayValue || 'N/A'}</dd>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-40 flex items-center justify-center p-4" aria-modal="true" role="dialog">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <UsersIcon className="w-5 h-5 text-indigo-500" /> User Details: {user.staffName}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" aria-label="Close user details modal">
            <XIcon className="w-6 h-6"/>
          </button>
        </div>
        <div className="overflow-y-auto p-6 space-y-4">
          <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-md shadow-sm">
            <h4 className="text-md font-semibold text-gray-800 dark:text-gray-100 mb-3">Basic Information</h4>
            <dl className="space-y-2">
              {getLabelValue('Staff Name', user.staffName)}
              {getLabelValue('Employee Code', user.employeeCode)}
              {getLabelValue('Role', user.role)}
              {getLabelValue('Designation', user.designation)}
              {getLabelValue('Contact Number', user.contactNumber)}
            </dl>
          </div>

          <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-md shadow-sm">
            <h4 className="text-md font-semibold text-gray-800 dark:text-gray-100 mb-3">Organizational Details</h4>
            <dl className="space-y-2">
              {getLabelValue('Branch Name', user.branchName)}
              {getLabelValue('District Name', user.districtName)}
              {getLabelValue('Zone', user.zone)}
              {getLabelValue('Region', user.region)}
            </dl>
          </div>

          <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-md shadow-sm">
            <h4 className="text-md font-semibold text-gray-800 dark:text-gray-100 mb-3">Management & Reporting</h4>
            <dl className="space-y-2">
              {getLabelValue('Managed Zones', user.managedZones)}
              {getLabelValue('Managed Branches', user.managedBranches)}
              {getLabelValue('Reports To', user.reportsToEmployeeCode)}
              {getLabelValue('Subordinates', user.subordinates ? user.subordinates.length.toString() : '0')}
            </dl>
          </div>
        </div>
        <div className="flex justify-end items-center gap-3 p-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-700">
          <button type="button" onClick={onClose} className="btn btn-secondary">Close</button>
        </div>
      </div>
    </div>
  );
};

export default UserDetailModal;
