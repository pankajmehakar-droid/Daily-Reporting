import React, { useState, useEffect, useCallback, useRef } from 'react';
import { StaffMember } from '../types';
import { getStaffByBranch, getAllStaff } from '../services/dataService'; // Also need getAllStaff for manager lookup
import { XIcon, UsersIcon, LoaderIcon } from './icons';

interface BranchStaffDetailModalProps {
  branchName: string;
  onClose: () => void;
}

const BranchStaffDetailModal: React.FC<BranchStaffDetailModalProps> = ({ branchName, onClose }) => {
  const [staffInBranch, setStaffInBranch] = useState<StaffMember[]>([]);
  const [allStaff, setAllStaff] = useState<StaffMember[]>([]); // To resolve reportsToEmployeeCode names
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isMounted = useRef(false);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const fetchStaffDetails = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [staffList, allStaffList] = await Promise.all([
        getStaffByBranch(branchName),
        getAllStaff(), // Fetch all staff to resolve manager names for 'Reports To'
      ]);
      if (isMounted.current) {
        setStaffInBranch(staffList);
        setAllStaff(allStaffList);
      }
    } catch (err) {
      if (isMounted.current) {
        setError(err instanceof Error ? err.message : 'Failed to load staff for this branch.');
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  }, [branchName, isMounted]);

  useEffect(() => {
    fetchStaffDetails();
  }, [fetchStaffDetails]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" aria-modal="true" role="dialog">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <UsersIcon className="w-5 h-5 text-indigo-500" /> Staff in Branch: {branchName}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" aria-label="Close staff details modal">
            <XIcon className="w-6 h-6"/>
          </button>
        </div>
        <div className="overflow-y-auto p-6 flex-grow">
          {loading ? (
            <div className="flex justify-center items-center py-10">
              <LoaderIcon className="w-8 h-8 text-indigo-500" />
            </div>
          ) : error ? (
            <div className="p-4 bg-red-100 dark:bg-red-900/30 border-l-4 border-red-500 text-red-700 dark:text-red-300 rounded-md" role="alert">
              <p>{error}</p>
            </div>
          ) : staffInBranch.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th scope="col" className="th-style">Employee Name</th>
                    <th scope="col" className="th-style">Employee Code</th>
                    <th scope="col" className="th-style">Designation</th>
                    <th scope="col" className="th-style">Contact Number</th>
                    <th scope="col" className="th-style">Reports To</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {staffInBranch.map(staff => {
                    const reportsToManager = allStaff.find(s => s.employeeCode === staff.reportsToEmployeeCode);
                    return (
                      <tr key={staff.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td className="td-style font-medium">{staff.employeeName}</td>
                        <td className="td-style">{staff.employeeCode}</td>
                        <td className="td-style">{staff.function}</td>
                        <td className="td-style">{staff.contactNumber}</td>
                        <td className="td-style">
                          {reportsToManager ? `${reportsToManager.employeeName} (${reportsToManager.employeeCode})` : 'N/A'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-center text-gray-500 dark:text-gray-400 py-10">
              No staff members found assigned to "{branchName}".
            </p>
          )}
        </div>
        <div className="flex justify-end items-center gap-3 p-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-700">
          <button type="button" onClick={onClose} className="btn btn-secondary">Close</button>
        </div>
      </div>
    </div>
  );
};

export default BranchStaffDetailModal;