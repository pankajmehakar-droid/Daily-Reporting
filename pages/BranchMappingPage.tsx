
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { StaffMember, Branch, User } from '../types';
import { getAllStaff, getBranches, updateStaff } from '../services/dataService';
import { LoaderIcon, AlertTriangleIcon, CheckCircleIcon, UsersIcon, SearchIcon } from '../components/icons';

interface BranchMappingPageProps {
  // No props currently, as it fetches its own data, but could take user role if needed for finer control.
}

const BranchMappingPage: React.FC<BranchMappingPageProps> = () => {
    const [allStaff, setAllStaff] = useState<StaffMember[]>([]);
    const [allBranches, setAllBranches] = useState<Branch[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    
    const [selectedBranchId, setSelectedBranchId] = useState<string>('all'); // 'all' or branch.id
    const [reassignmentChanges, setReassignmentChanges] = useState<Record<string, string>>({}); // {staffId: newBranchName}
    const [isSaving, setIsSaving] = useState(false);

    // New states for search and bulk reassignment
    const [searchTerm, setSearchTerm] = useState('');
    const [bulkReassignTargetBranch, setBulkReassignTargetBranch] = useState('');

    const isMounted = useRef(false);

    useEffect(() => {
      isMounted.current = true;
      return () => {
        isMounted.current = false;
      };
    }, []);

    const fetchAllData = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            setNotification(null);
            const [staffList, branchList] = await Promise.all([
                getAllStaff(),
                getBranches()
            ]);
            if (!isMounted.current) return;
            setAllStaff(staffList);
            setAllBranches(branchList);
            // Pre-populate reassignmentChanges for current branches, if staff exists
            const initialReassignments: Record<string, string> = {};
            staffList.forEach(staff => {
                initialReassignments[staff.id] = staff.branchName;
            });
            setReassignmentChanges(initialReassignments);

        } catch (err) {
            if (isMounted.current) {
                setError(err instanceof Error ? err.message : 'Failed to fetch initial data.');
            }
        } finally {
            if (isMounted.current) {
                setLoading(false);
            }
        }
    }, [isMounted]);

    useEffect(() => {
        fetchAllData();
    }, [fetchAllData]);

    const displayedStaff = useMemo(() => {
        let filtered = allStaff;

        // Apply branch filter
        if (selectedBranchId !== 'all') {
            const targetBranchName = allBranches.find(b => b.id === selectedBranchId)?.branchName;
            if (targetBranchName) {
                filtered = filtered.filter(staff => staff.branchName === targetBranchName);
            }
        }

        // Apply search term filter
        if (searchTerm.trim()) {
            const lowercasedTerm = searchTerm.toLowerCase();
            filtered = filtered.filter(staff =>
                staff.employeeName.toLowerCase().includes(lowercasedTerm) ||
                staff.employeeCode.toLowerCase().includes(lowercasedTerm) ||
                staff.function.toLowerCase().includes(lowercasedTerm) ||
                staff.branchName.toLowerCase().includes(lowercasedTerm)
            );
        }

        return filtered;
    }, [allStaff, allBranches, selectedBranchId, searchTerm]);

    const handleBranchFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setSelectedBranchId(e.target.value);
        // Do NOT reset reassignmentChanges on filter change, only on bulk apply or save.
        // This ensures pending changes for other filters are preserved if the user navigates.
        // If a staff is filtered out, its pending change remains in `reassignmentChanges`.
        // The `hasPendingChanges` and `handleSaveChanges` logic will correctly handle only
        // the *actual* differences from `allStaff` and filter for `displayedStaff`.
    };

    const handleStaffBranchChange = (staffId: string, newBranchName: string) => {
        setReassignmentChanges(prev => ({ ...prev, [staffId]: newBranchName }));
    };

    // New handler for bulk reassignment
    const handleBulkReassignFilteredStaff = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newBranchName = e.target.value;
        setBulkReassignTargetBranch(newBranchName);

        const updates: Record<string, string> = {};
        displayedStaff.forEach(staff => {
            updates[staff.id] = newBranchName;
        });
        
        setReassignmentChanges(prev => ({ ...prev, ...updates }));
    };

    const handleSaveChanges = async () => {
        setIsSaving(true);
        setError(null);
        setNotification(null);
        let updatedCount = 0;

        try {
            const updatePromises = allStaff.map(staff => { // Iterate over ALL staff
                const newBranchName = reassignmentChanges[staff.id];
                if (newBranchName && newBranchName !== staff.branchName) {
                    updatedCount++;
                    return updateStaff(staff.id, { branchName: newBranchName });
                }
                return Promise.resolve(null); // No change needed
            }).filter(Boolean); // Filter out null promises

            await Promise.all(updatePromises);
            if (!isMounted.current) return;
            // Removed: reinitializeAuth(); // Re-sync user roles and branches after staff changes
            await fetchAllData(); // Re-fetch all data to show updated state and clear pending changes
            if (!isMounted.current) return;
            setNotification({ message: `Successfully updated ${updatedCount} staff assignments.`, type: 'success' });
            setBulkReassignTargetBranch(''); // Reset bulk dropdown
            
        } catch (err) {
            if (isMounted.current) {
                setError(err instanceof Error ? err.message : 'An error occurred while saving changes.');
                setNotification({ message: 'Failed to save changes.', type: 'error' });
            }
        } finally {
            if (isMounted.current) {
                setIsSaving(false);
            }
        }
    };
    
    // Determine if there are any pending changes to save among all staff
    const hasPendingChanges = useMemo(() => {
        return allStaff.some(staff => 
            reassignmentChanges[staff.id] && reassignmentChanges[staff.id] !== staff.branchName
        );
    }, [allStaff, reassignmentChanges]);

    if (loading) {
        return (
            <div className="flex justify-center items-center py-20">
                <LoaderIcon className="w-8 h-8 text-indigo-500" />
            </div>
        );
    }

    // Prepare branch options for reassignment dropdowns
    const branchOptions = useMemo(() => {
        return allBranches.map(branch => ({ value: branch.branchName, label: branch.branchName }));
    }, [allBranches]);

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100">Branch Mapping</h2>

            {notification && (
                <div className={`p-4 rounded-md flex items-start space-x-3 border-l-4 ${notification.type === 'success' ? 'bg-green-100 dark:bg-green-900/30 border-green-500 text-green-700 dark:text-green-300' : 'bg-red-100 dark:bg-red-900/30 border-red-500 text-red-700 dark:text-red-300'}`} role="alert">
                    {notification.type === 'success' ? <CheckCircleIcon className="w-6 h-6 flex-shrink-0" /> : <AlertTriangleIcon className="w-6 h-6 flex-shrink-0" />}
                    <div><p className="font-bold">{notification.type === 'success' ? 'Success' : 'Error'}</p><p>{notification.message}</p></div>
                </div>
            )}
            {error && !notification && ( // Show general error if no specific notification is active
                <div className="bg-red-100 dark:bg-red-900/30 border-l-4 border-red-500 text-red-700 dark:text-red-300 p-4 rounded-md flex items-start space-x-3" role="alert">
                    <AlertTriangleIcon className="w-6 h-6 flex-shrink-0" />
                    <div><p className="font-bold">Error</p><p>{error}</p></div>
                </div>
            )}

            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-4 mb-6 flex-wrap">
                    <div className="w-full sm:w-auto flex-grow">
                        <label htmlFor="branch-filter" className="label-style">
                            Filter by Current Branch
                        </label>
                        <select
                            id="branch-filter"
                            className="mt-1 block w-full input-style"
                            onChange={handleBranchFilterChange}
                            value={selectedBranchId}
                        >
                            <option value="all">-- All Branches --</option>
                            {allBranches.map(branch => (
                                <option key={branch.id} value={branch.id}>{branch.branchName}</option>
                            ))}
                        </select>
                    </div>

                    <div className="w-full sm:w-auto flex-grow">
                        <label htmlFor="bulk-reassign" className="label-style">
                            Bulk Reassign filtered staff to:
                        </label>
                        <select
                            id="bulk-reassign"
                            className="mt-1 block w-full input-style"
                            onChange={handleBulkReassignFilteredStaff}
                            value={bulkReassignTargetBranch}
                            disabled={displayedStaff.length === 0}
                        >
                            <option value="">-- Select New Branch --</option>
                            {allBranches.map(branch => (
                                <option key={branch.id} value={branch.branchName}>{branch.branchName}</option>
                            ))}
                        </select>
                    </div>

                    <div className="relative w-full sm:w-auto flex-grow">
                        <label htmlFor="staff-search" className="label-style">Search Staff</label>
                        <div className="relative mt-1">
                            <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                                <SearchIcon className="w-5 h-5 text-gray-400" />
                            </span>
                            <input
                                type="text"
                                id="staff-search"
                                placeholder="Search staff..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="block w-full pl-10 pr-4 py-2 input-style"
                                aria-label="Search staff members"
                            />
                        </div>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-700">
                            <tr>
                                <th className="th-style">Staff Name</th>
                                <th className="th-style">Employee Code</th>
                                <th className="th-style">Current Branch</th>
                                <th className="th-style">Reassign to New Branch</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                            {displayedStaff.length > 0 ? (
                                displayedStaff.map(staff => {
                                    const hasUnsavedChange = reassignmentChanges[staff.id] && reassignmentChanges[staff.id] !== staff.branchName;
                                    return (
                                        <tr key={staff.id} className={`${hasUnsavedChange ? 'bg-yellow-50 dark:bg-yellow-900/20' : ''} hover:bg-gray-50 dark:hover:bg-gray-700/50`}>
                                            <td className="td-style font-medium">{staff.employeeName}</td>
                                            <td className="td-style">{staff.employeeCode}</td>
                                            <td className="td-style">{staff.branchName}</td>
                                            <td className="td-style">
                                                <select
                                                    value={reassignmentChanges[staff.id] || staff.branchName}
                                                    onChange={(e) => handleStaffBranchChange(staff.id, e.target.value)}
                                                    className="w-full input-style"
                                                    disabled={isSaving}
                                                    aria-label={`New branch for ${staff.employeeName}`}
                                                >
                                                    {/* Option for current branch */}
                                                    <option value={staff.branchName}>{staff.branchName} (Current)</option>
                                                    {/* Other branches for reassignment */}
                                                    {allBranches
                                                        .filter(b => b.branchName !== staff.branchName)
                                                        .map(b => (
                                                            <option key={b.id} value={b.branchName}>{b.branchName}</option>
                                                        ))}
                                                </select>
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan={4} className="text-center py-8 text-gray-500 dark:text-gray-400">
                                        No staff members found matching your criteria.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="mt-6 flex justify-end">
                    <button
                        onClick={handleSaveChanges}
                        disabled={isSaving || !hasPendingChanges}
                        className="btn btn-indigo flex items-center gap-2"
                    >
                        {isSaving && <LoaderIcon className="w-4 h-4" />}
                        {isSaving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default BranchMappingPage;
