

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { StaffMember, Branch, User } from '../types';
import { getAllStaff, getBranches, updateStaff } from '../services/dataService';
import { LoaderIcon, AlertTriangleIcon, CheckCircleIcon, UsersIcon, SearchIcon, EditIcon } from '../components/icons';

type StaffWithPending = StaffMember & { pendingBranchName?: string; };

const StaffAssignmentsPage: React.FC<{ currentUser: User }> = ({ currentUser }) => {
    const [allStaff, setAllStaff] = useState<StaffWithPending[]>([]);
    const [allBranches, setAllBranches] = useState<Branch[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    const [searchTerm, setSearchTerm] = useState('');
    const [selectedBranchFilter, setSelectedBranchFilter] = useState('all'); // 'all' or branch.id
    const [selectedDesignationFilter, setSelectedDesignationFilter] = useState('all'); // 'all' or designation

    const [isSaving, setIsSaving] = useState(false);

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
        if (selectedBranchFilter !== 'all') {
            const targetBranchName = allBranches.find(b => b.id === selectedBranchFilter)?.branchName;
            if (targetBranchName) {
                filtered = filtered.filter(staff => staff.branchName === targetBranchName || staff.pendingBranchName === targetBranchName);
            }
        }

        // Apply designation filter
        if (selectedDesignationFilter !== 'all') {
            filtered = filtered.filter(staff => staff.function === selectedDesignationFilter);
        }

        // Apply search term filter
        if (searchTerm.trim()) {
            const lowercasedTerm = searchTerm.toLowerCase();
            filtered = filtered.filter(staff =>
                staff.employeeName.toLowerCase().includes(lowercasedTerm) ||
                staff.employeeCode.toLowerCase().includes(lowercasedTerm) ||
                staff.function.toLowerCase().includes(lowercasedTerm) ||
                (staff.pendingBranchName || staff.branchName).toLowerCase().includes(lowercasedTerm)
            );
        }

        return filtered;
    }, [allStaff, allBranches, selectedBranchFilter, selectedDesignationFilter, searchTerm]);

    const handleStaffBranchChange = (staffId: string, newBranchName: string) => {
        setAllStaff(prevStaff => prevStaff.map(s =>
            s.id === staffId ? { ...s, pendingBranchName: newBranchName } : s
        ));
    };

    const handleSaveChanges = async () => {
        setIsSaving(true);
        setError(null);
        setNotification(null);
        let updatedCount = 0;

        try {
            const updatePromises = allStaff.map(staff => {
                const newBranchName = staff.pendingBranchName;

                if (newBranchName && newBranchName !== staff.branchName) {
                    updatedCount++;
                    const updatePayload: Partial<StaffMember> = { branchName: newBranchName };

                    const targetBranch = allBranches.find(b => b.branchName === newBranchName);
                    if (targetBranch) {
                        updatePayload.zone = targetBranch.zone;
                        updatePayload.region = targetBranch.region;
                        updatePayload.districtName = targetBranch.districtName;
                    } else {
                        // If branch doesn't exist (e.g., set to 'N/A'), clear location data
                        updatePayload.zone = 'N/A';
                        updatePayload.region = 'N/A';
                        updatePayload.districtName = 'N/A';
                    }
                    return updateStaff(staff.id, updatePayload);
                }
                return Promise.resolve(null);
            }).filter(Boolean);

            await Promise.all(updatePromises);
            if (!isMounted.current) return;
            // Removed: reinitializeAuth(); // Re-sync user roles and branches after staff changes
            await fetchAllData(); // Re-fetch all data to show updated state and clear pending changes
            if (!isMounted.current) return;
            setNotification({ message: `Successfully updated ${updatedCount} staff assignments.`, type: 'success' });

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

    const hasPendingChanges = useMemo(() => {
        return allStaff.some(staff =>
            staff.pendingBranchName && staff.pendingBranchName !== staff.branchName
        );
    }, [allStaff]);

    const branchFilterOptions = useMemo(() => {
        // Ensure that if allBranches is empty, the filter still provides an 'all' option.
        return [{ id: 'all', branchName: '-- All Branches --' }, ...allBranches];
    }, [allBranches]);

    const designationFilterOptions = useMemo(() => {
        const uniqueDesignations = Array.from(new Set(allStaff.map(s => s.function)));
        return [{ value: 'all', label: '-- All Designations --' }, ...uniqueDesignations.map(d => ({ value: d, label: d }))];
    }, [allStaff]);


    if (loading) {
        return (
            <div className="flex justify-center items-center py-20">
                <LoaderIcon className="w-8 h-8 text-indigo-500" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100">Staff Assignments</h2>

            {notification && (
                <div className={`p-4 rounded-md flex items-start space-x-3 border-l-4 ${notification.type === 'success' ? 'bg-green-100 dark:bg-green-900/30 border-green-500 text-green-700 dark:text-green-300' : 'bg-red-100 dark:bg-red-900/30 border-red-500 text-red-700 dark:text-red-300'}`} role="alert">
                    {notification.type === 'success' ? <CheckCircleIcon className="w-6 h-6 flex-shrink-0" /> : <AlertTriangleIcon className="w-6 h-6 flex-shrink-0" />}
                    <div><p className="font-bold">{notification.type === 'success' ? 'Success' : 'Error'}</p><p>{notification.message}</p></div>
                </div>
            )}
            {error && !notification && (
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
                            onChange={(e) => setSelectedBranchFilter(e.target.value)}
                            value={selectedBranchFilter}
                            disabled={isSaving}
                        >
                            {branchFilterOptions.map(branch => (
                                <option key={branch.id} value={branch.id}>{branch.branchName}</option>
                            ))}
                        </select>
                    </div>

                    <div className="w-full sm:w-auto flex-grow">
                        <label htmlFor="designation-filter" className="label-style">
                            Filter by Designation
                        </label>
                        <select
                            id="designation-filter"
                            className="mt-1 block w-full input-style"
                            onChange={(e) => setSelectedDesignationFilter(e.target.value)}
                            value={selectedDesignationFilter}
                            disabled={isSaving}
                        >
                            {designationFilterOptions.map(option => (
                                <option key={option.value} value={option.value}>{option.label}</option>
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
                                disabled={isSaving}
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
                                <th className="th-style">Designation</th>
                                <th className="th-style">Current Branch</th>
                                <th className="th-style">Zone</th>
                                <th className="th-style">Region</th>
                                <th className="th-style">District</th>
                                <th className="th-style">Reassign to New Branch</th>
                                <th className="th-style">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                            {displayedStaff.length > 0 ? (
                                displayedStaff.map(staff => {
                                    const currentBranchName = staff.pendingBranchName || staff.branchName;
                                    const isChanged = staff.pendingBranchName && staff.pendingBranchName !== staff.branchName;
                                    return (
                                        <tr key={staff.id} className={`${isChanged ? 'bg-yellow-50 dark:bg-yellow-900/20' : ''} hover:bg-gray-50 dark:hover:bg-gray-700/50`}>
                                            <td className="td-style font-medium">{staff.employeeName}</td>
                                            <td className="td-style">{staff.employeeCode}</td>
                                            <td className="td-style">{staff.function}</td>
                                            <td className="td-style">{staff.branchName}</td>
                                            <td className="td-style">{staff.zone}</td>
                                            <td className="td-style">{staff.region}</td>
                                            <td className="td-style">{staff.districtName}</td>
                                            <td className="td-style">
                                                <select
                                                    value={currentBranchName}
                                                    onChange={(e) => handleStaffBranchChange(staff.id, e.target.value)}
                                                    className="w-full input-style"
                                                    disabled={isSaving}
                                                    aria-label={`New branch for ${staff.employeeName}`}
                                                >
                                                    {/* Option for no branch */}
                                                    <option value="N/A">-- No Branch --</option>
                                                    {allBranches
                                                        .map(b => (
                                                            <option key={b.id} value={b.branchName}>{b.branchName}</option>
                                                        ))}
                                                </select>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                                <EditIcon className="w-5 h-5 text-gray-400" />
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan={9} className="text-center py-8 text-gray-500 dark:text-gray-400">
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

export default StaffAssignmentsPage;