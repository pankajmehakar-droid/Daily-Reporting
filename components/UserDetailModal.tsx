import React from 'react';
import { User, StaffMember } from '../types';
import { XIcon, UsersIcon } from './icons';

interface UserDetailModalProps {
  user: User;
  onClose: () => void;
  allStaff: StaffMember[]; // Pass all staff for manager name lookup
}

const UserDetailModal: React.FC<UserDetailModalProps> = ({ user, onClose, allStaff }) => {
  
  // A helper function to render each detail row consistently
  const renderDetailItem = (label: string, content: React.ReactNode) => (
    <div className="flex flex-col sm:flex-row sm:items-baseline sm:space-x-2">
      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 w-32 sm:w-40 flex-shrink-0">{label}</dt>
      <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100 sm:mt-0 flex-1">{content}</dd>
    </div>
  );
  
  // Helper for simple text values that might be empty
  const renderTextItem = (label: string, value: string | undefined | null) => {
    return renderDetailItem(label, value || <span className="text-gray-400 italic">Not specified</span>);
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
              {renderTextItem('Staff Name', user.staffName)}
              {renderTextItem('Employee Code', user.employeeCode)}
              {renderTextItem('Role', user.role)}
              {renderTextItem('Designation', user.designation)}
              {renderTextItem('Contact Number', user.contactNumber)}
            </dl>
          </div>

          <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-md shadow-sm">
            <h4 className="text-md font-semibold text-gray-800 dark:text-gray-100 mb-3">Organizational Details</h4>
            <dl className="space-y-2">
              {renderTextItem('Branch Name', user.branchName)}
              {renderTextItem('District Name', user.districtName)}
              {renderTextItem('Zone', user.zone)}
              {renderTextItem('Region', user.region)}
            </dl>
          </div>

          <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-md shadow-sm">
            <h4 className="text-md font-semibold text-gray-800 dark:text-gray-100 mb-3">Management & Reporting</h4>
            <dl className="space-y-2">
              {renderDetailItem('Managed Zones', 
                user.managedZones && user.managedZones.length > 0 
                ? user.managedZones.join(', ') 
                : <span className="text-gray-400 italic">None assigned</span>
              )}
              {renderDetailItem('Managed Branches', 
                user.managedBranches && user.managedBranches.length > 0 
                ? user.managedBranches.join(', ') 
                : <span className="text-gray-400 italic">None assigned</span>
              )}
              {renderDetailItem('Reports To', 
                user.reportsToEmployeeCode 
                ? (allStaff.find(s => s.employeeCode === user.reportsToEmployeeCode)?.employeeName + ` (${user.reportsToEmployeeCode})` || `${user.reportsToEmployeeCode} (Unknown)`)
                : <span className="text-gray-400 italic">No manager</span>
              )}
              {renderDetailItem('Subordinates', user.subordinates ? user.subordinates.length.toString() : '0')}
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