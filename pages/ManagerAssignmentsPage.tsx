


import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { StaffMember, User, Branch, DESIGNATIONS, ZONES, Designation } from '../types';
import { getAllStaff, getBranches, updateStaff } from '../services/dataService';
import { LoaderIcon, AlertTriangleIcon, CheckCircleIcon, UsersIcon, SearchIcon, EditIcon } from '../components/icons';

// FIX: Update StaffWithPending type to include pendingFunction as Designation
type StaffWithPending = StaffMember & { pendingBranchName?: string; pendingFunction?: Designation; };

// FIX: Changed to named export
export const ManagerAssignmentsPage: React.FC<{ currentUser: User }> = ({ currentUser }) => {
    const [allStaff, setAllStaff] = useState<StaffWithPending[]>([]
    );
    const [allBranches, setAllBranches] = useState<Branch[]>([]);
    const [allManagers, setAllManagers] = useState<StaffMember[]>([]); // For Reports To lookup
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    const [searchTerm, setSearchTerm] = useState('');
    const [selectedBranchFilter, setSelectedBranchFilter] = useState('all'); // 'all' or branch.id
    const [selectedRoleFilter, setSelectedRoleFilter] = useState('all'); // 'all', 'manager', 'non-manager'

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
            // Populate allManagers for Reports To lookup
            setAllManagers(staffList.filter(s => (
                s.function.toUpperCase().includes('MANAGER') || 
                s.function.toUpperCase().includes('HEAD') ||
                s.function.toUpperCase().includes('TL')
            )));
            // Set default selected branch filter if none exists
            if (selectedBranchFilter === 'all' && branchList.length > 0) {
                 setSelectedBranchFilter(branchList[0].id);
            } else if (selectedBranchFilter === 'all' && branchList.length === 0) {
                // Keep 'all' selected if no branches available
                setSelectedBranchFilter('all');
            }


        } catch (err) {
            if (isMounted.current) {
                setError(err instanceof Error ? err.message : 'Failed to fetch initial data.');
            }
        } finally {
            if (isMounted.current) {
                setLoading(false);
            }
        }
    }, [isMounted, selectedBranchFilter]);

    useEffect(() => {
        fetchAllData();
    }, [fetchAllData]);

    const displayedStaff = useMemo(() => {
        let filtered = allStaff;

        // Apply branch filter
        if (selectedBranchFilter !== 'all') {
            const targetBranchName = allBranches.find(b => b.id === selectedBranchFilter)?.branchName;
            if (targetBranchName) {
                filtered = filtered.filter(staff => 
                    (staff.branchName === targetBranchName || staff.pendingBranchName === targetBranchName) || // Primary branch
                    (staff.managedBranches && staff.managedBranches.includes(targetBranchName)) // Managed branch
                );
            }
        }

        // Apply role filter
        if (selectedRoleFilter === 'manager') {
            filtered = filtered.filter(staff => 
                (staff.pendingFunction || staff.function).toUpperCase().includes('MANAGER') || // Any manager role
                (staff.pendingFunction || staff.function).toUpperCase().includes('HEAD') || // District Head, Asst. District Head
                (staff.pendingFunction || staff.function).toUpperCase().includes('TL') // Team Leaders
            );
        } else if (selectedRoleFilter === 'non-manager') {
            filtered = filtered.filter(staff => 
                !((staff.pendingFunction || staff.function).toUpperCase().includes('MANAGER')) && 
                !((staff.pendingFunction || staff.function).toUpperCase().includes('HEAD')) &&
                !((staff.pendingFunction || staff.function).toUpperCase().includes('TL'))
            );
        }

        // Apply search term filter
        if (searchTerm.trim()) {
            const lowercasedTerm = searchTerm.toLowerCase();
            filtered = filtered.filter(staff =>
                staff.employeeName.toLowerCase().includes(lowercasedTerm) ||
                staff.employeeCode.toLowerCase().includes(lowercasedTerm) ||
                (staff.pendingFunction || staff.function).toLowerCase().includes(lowercasedTerm) ||
                (staff.pendingBranchName || staff.branchName).toLowerCase().includes(lowercasedTerm) ||
                (staff.managedBranches && staff.managedBranches.some(b => b.toLowerCase().includes(lowercasedTerm))) ||
                (staff.managedZones && staff.managedZones.some(z => z.toLowerCase().includes(lowercasedTerm))) ||
                (staff.reportsToEmployeeCode && allManagers.find(m => m.employeeCode === staff.reportsToEmployeeCode)?.employeeName.toLowerCase().includes(lowercasedTerm))
            );
        }

        return filtered;
    }, [allStaff, allBranches, selectedBranchFilter, selectedRoleFilter, searchTerm, allManagers]);

    const handleFunctionChange = (staffId: string, newFunction: string) => {
        setAllStaff(prevStaff => prevStaff.map(s => {
            if (s.id === staffId) {
                // FIX: Cast newFunction to Designation as pendingFunction is typed as Designation
                const updatedStaff = { ...s, pendingFunction: newFunction as Designation };
                // Multi-unit roles are configured via UserManagement.
                // For 'BRANCH MANAGER' and other roles here, managed units should always be empty.
                // This page primarily manages `function` and `primary branchName`.
                // The actual clearing of managed units is handled by `updateStaff` in dataService.
                return updatedStaff;
            }
            return s;
        }));
    };

    const handleBranchAssignmentChange = (staffId: string, newBranchName: string) => {
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
                const newFunction = staff.pendingFunction;
                const newBranchName = staff.pendingBranchName;

                const isFunctionChanged = newFunction && newFunction !== staff.function;
                const isPrimaryBranchChanged = newBranchName && newBranchName !== staff.branchName;

                if (isFunctionChanged || isPrimaryBranchChanged) {
                    updatedCount++;
                    const updatePayload: Partial<StaffMember> = {};

                    if (isFunctionChanged) {
                        updatePayload.function = newFunction;
                        // Clear managed units if function no longer supports them (handled by dataService)
                    }

                    if (isPrimaryBranchChanged) {
                        updatePayload.branchName = newBranchName;
                        const targetBranch = allBranches.find(b => b.branchName === newBranchName);
                        if (targetBranch) {
                            updatePayload.zone = targetBranch.zone;
                            updatePayload.region = targetBranch.region;
                            updatePayload.districtName = targetBranch.districtName;
                        } else {
                            // If branch doesn't exist, clear location data
                            updatePayload.zone = 'N/A';
                            updatePayload.region = 'N/A';
                            updatePayload.districtName = 'N/A';
                        }
                    } else if (isFunctionChanged && newFunction.toUpperCase() === 'BRANCH MANAGER' && !newBranchName && staff.branchName) {
                        // If promoting to branch manager and no new branch specified, keep existing primary branch
                        updatePayload.branchName = staff.branchName;
                    } else if (isFunctionChanged && newFunction.toUpperCase() !== 'BRANCH MANAGER' && (staff.function.toUpperCase() === 'BRANCH MANAGER') && !isPrimaryBranchChanged) {
                        // If demoting from BRANCH MANAGER, and no new primary branch was set, clear their primary branch.
                        updatePayload.branchName = 'N/A';
                        updatePayload.zone = 'N/A';
                        updatePayload.region = 'N/A';
                        updatePayload.districtName = 'N/A';
                    }

                    // ManagedZones, ManagedBranches, ReportsToEmployeeCode are NOT modified by this page.
                    // They are passed through if existing, and dataService will ensure consistency.
                    if (staff.managedZones) updatePayload.managedZones = staff.managedZones;
                    if (staff.managedBranches) updatePayload.managedBranches = staff.managedBranches;
                    if (staff.reportsToEmployeeCode) updatePayload.reportsToEmployeeCode = staff.reportsToEmployeeCode;

                    return updateStaff(staff.id, updatePayload);
                }
                return Promise.resolve(null);
            }).filter(Boolean);

            await Promise.all(updatePromises);
            if (!isMounted.current) return;
            // Removed: reinitializeAuth(); // Re-sync user roles and branches after staff changes
            await fetchAllData(); // Re-fetch all data to show updated state and clear pending changes
            if (!isMounted.current) return;
            setNotification({ message: `Successfully updated ${updatedCount} manager assignments.`, type: 'success' });

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
            (staff.pendingFunction && staff.pendingFunction !== staff.function) ||
            (staff.pendingBranchName && staff.pendingBranchName !== staff.branchName)
        );
    }, [allStaff]);

    const branchOptions = useMemo(() => {
        // Ensure 'all' option is always first, followed by available branches
        const options = allBranches.map(branch => ({ id: branch.id, branchName: branch.branchName }));
        return [{ id: 'all', branchName: '-- All Branches --' }, ...options];
    }, [allBranches]);

    const roleFilterOptions = [
        { value: 'all', label: '-- All Roles --' },
        { value: 'manager', label: 'Managers & Heads' }, // Combined for simplicity
        { value: 'non-manager', label: 'Non-Managers' },
    ];

    if (loading) {
        return (
            <div className="flex justify-center items-center py-20">
                <LoaderIcon className="w-8 h-8 text-indigo-500" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100">Manager Assignments</h2>

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
                            Filter by Branch
                        </label>
                        <select
                            id="branch-filter"
                            className="mt-1 block w-full input-style"
                            onChange={(e) => setSelectedBranchFilter(e.target.value)}
                            value={selectedBranchFilter}
                            disabled={isSaving}
                        >
                            {branchOptions.map(branch => (
                                <option key={branch.id} value={branch.id}>{branch.branchName}</option>
                            ))}
                        </select>
                    </div>

                    <div className="w-full sm:w-auto flex-grow">
                        <label htmlFor="role-filter" className="label-style">
                            Filter by Role
                        </label>
                        <select
                            id="role-filter"
                            className="mt-1 block w-full input-style"
                            onChange={(e) => setSelectedRoleFilter(e.target.value)}
                            value={selectedRoleFilter}
                            disabled={isSaving}
                        >
                            {roleFilterOptions.map(option => (
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
                                <th className="th-style">Current Designation</th>
                                <th className="th-style">Assigned Designation</th>
                                <th className="th-style">Primary Branch</th>
                                <th className="th-style">Zone</th>
                                <th className="th-style">Region</th>
                                <th className="th-style">District</th>
                                <th className="th-style">Managed Zones</th>
                                <th className="th-style">Managed Branches</th>
                                <th className="th-style">Reports To</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                            {displayedStaff.length > 0 ? (
                                displayedStaff.map(staff => {
                                    const currentFunction = staff.pendingFunction || staff.function;
                                    const currentBranchName = staff.pendingBranchName || staff.branchName;
                                    const isFunctionChanged = staff.pendingFunction && staff.pendingFunction !== staff.function;
                                    const isPrimaryBranchChanged = staff.pendingBranchName && staff.pendingBranchName !== staff.branchName;
                                    const reportsToStaff = allManagers.find(m => m.employeeCode === staff.reportsToEmployeeCode);

                                    return (
                                        <tr key={staff.id} className={`${(isFunctionChanged || isPrimaryBranchChanged) ? 'bg-yellow-50 dark:bg-yellow-900/20' : ''} hover:bg-gray-50 dark:hover:bg-gray-700/50`}>
                                            <td className="td-style font-medium">{staff.employeeName}</td>
                                            <td className="td-style">{staff.employeeCode}</td>
                                            <td className="td-style">{staff.function}</td>
                                            <td className="td-style">
                                                <select
                                                    value={currentFunction}
                                                    onChange={(e) => handleFunctionChange(staff.id, e.target.value)}
                                                    className="w-full input-style"
                                                    disabled={isSaving}
                                                    aria-label={`Designation for ${staff.employeeName}`}
                                                >
                                                    {DESIGNATIONS.map(d => (
                                                        <option key={d} value={d}>{d}</option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td className="td-style">
                                                <select
                                                    value={currentBranchName}
                                                    onChange={(e) => handleBranchAssignmentChange(staff.id, e.target.value)}
                                                    className="w-full input-style"
                                                    disabled={isSaving}
                                                    aria-label={`Primary Branch for ${staff.employeeName}`}
                                                >
                                                    <option value="N/A">-- No Branch --</option>
                                                    {allBranches.map(b => (
                                                        <option key={b.id} value={b.branchName}>{b.branchName}</option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td className="td-style">{staff.zone}</td>
                                            <td className="td-style">{staff.region}</td>
                                            <td className="td-style">{staff.districtName}</td>
                                            <td className="td-style">{staff.managedZones && staff.managedZones.length > 0 ? staff.managedZones.join(', ') : 'N/A'}</td>
                                            <td className="td-style">{staff.managedBranches && staff.managedBranches.length > 0 ? staff.managedBranches.join(', ') : 'N/A'}</td>
                                            <td className="td-style">{reportsToStaff ? `${reportsToStaff.employeeName} (${reportsToStaff.employeeCode})` : 'N/A'}</td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan={11} className="text-center py-8 text-gray-500 dark:text-gray-400">
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
