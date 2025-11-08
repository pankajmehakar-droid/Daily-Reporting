import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { BranchTarget, Branch, ProductMetric, User } from '../types';
import { getBranches, getProductMetrics, getBranchTargets, saveBranchTarget, updateBranchTarget, deleteBranchTarget } from '../services/dataService';
import { LoaderIcon, AlertTriangleIcon, XIcon, PlusIcon, TrashIcon, TargetIcon, CalendarIcon, CheckCircleIcon, DollarSignIcon, HashIcon, EditIcon } from '../components/icons'; // Added EditIcon
import SummaryCard from '../components/SummaryCard';
import { getMonthString, formatDisplayDate, getKraStatus } from '../utils/dateHelpers'; // Import from new utility


const formatDate = (dateString: string | undefined) => {
    if (!dateString) return 'N/A';
    // dateString is YYYY-MM-DD
    const date = new Date(dateString + 'T00:00:00'); // To avoid timezone issues
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

// New type for bulk form data
interface BulkTargetFormData {
    branchName: string;
    month: string;
    dueDate: string;
    metrics: { [metricName: string]: string | number }; // Stores target values for each metric
}

interface BranchTargetMappingPageProps {
    currentUser: User; // Need current user for manager role logic
}

const BranchTargetMappingPage: React.FC<BranchTargetMappingPageProps> = ({ currentUser }) => {
    const [allBranches, setAllBranches] = useState<Branch[]>([]);
    const [productMetrics, setProductMetrics] = useState<ProductMetric[]>([]);
    const [branchTargets, setBranchTargets] = useState<BranchTarget[]>([]); // All targets
    const [displayedTargets, setDisplayedTargets] = useState<BranchTarget[]>([]); // Filtered for selected branch/month

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    // Main page controls for selected branch and month
    const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
    const [selectedMonth, setSelectedMonth] = useState<string>(getMonthString());

    // Bulk target entry modal states
    const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
    const [bulkFormData, setBulkFormData] = useState<BulkTargetFormData>({
        branchName: '',
        month: getMonthString(),
        dueDate: '',
        metrics: {},
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [targetToDelete, setTargetToDelete] = useState<BranchTarget | null>(null); // State for delete confirmation

    const isMounted = useRef(false);

    useEffect(() => {
        isMounted.current = true;
        return () => {
            isMounted.current = false;
        };
    }, []);

    const fetchInitialData = useCallback(async () => {
        setError(null);
        setNotification(null);
        setLoading(true);
        try {
            const [branches, metrics, allTargets] = await Promise.all([
                getBranches(),
                getProductMetrics(),
                getBranchTargets() // Fetch all branch targets
            ]);
            if (!isMounted.current) return;

            // Filter branches for manager role
            let accessibleBranches = branches;
            if (currentUser.role === 'manager' && currentUser.branchName) {
                accessibleBranches = branches.filter(b => b.branchName === currentUser.branchName);
            }
            
            setAllBranches(accessibleBranches);
            setProductMetrics(metrics);
            setBranchTargets(allTargets); // Store all targets

            // Set default selected branch
            if (!selectedBranch || !accessibleBranches.find(b => b.id === selectedBranch.id)) {
                setSelectedBranch(accessibleBranches.length > 0 ? accessibleBranches[0] : null);
            }


        } catch (err) {
            if (isMounted.current) {
                setError("Failed to fetch initial data: " + (err instanceof Error ? err.message : String(err)));
            }
        } finally {
            if (isMounted.current) {
                setLoading(false);
            }
        }
    }, [currentUser, isMounted, selectedBranch]);

    useEffect(() => {
        fetchInitialData();
    }, [fetchInitialData]);

    const fetchAndFilterTargets = useCallback(async (branchName: string, month: string) => {
        setLoading(true); // Indicate loading for target display
        try {
            const allTargets = await getBranchTargets(); // Re-fetch all targets to ensure freshest data
            if (!isMounted.current) return;
            setBranchTargets(allTargets); // Update the global list
            setDisplayedTargets(allTargets.filter(t => t.branchName === branchName && t.month === month));
        } catch (err) {
            if (isMounted.current) {
                setError("Failed to fetch branch target data.");
            }
        } finally {
            if (isMounted.current) {
                setLoading(false);
            }
        }
    }, [isMounted]);

    useEffect(() => {
        if (selectedBranch && selectedMonth) {
            fetchAndFilterTargets(selectedBranch.branchName, selectedMonth);
        } else {
            setDisplayedTargets([]);
        }
    }, [selectedBranch, selectedMonth, fetchAndFilterTargets]); // Depend on selectedBranch/Month

    // Effect to pre-fill bulk form data when modal opens or selected branch/month changes
    useEffect(() => {
        if (!isBulkModalOpen || !bulkFormData.branchName || !bulkFormData.month || productMetrics.length === 0) {
            return;
        }

        const currentMonthTargets = branchTargets.filter(
            t => t.branchName === bulkFormData.branchName && t.month === bulkFormData.month
        );

        const newMetricsData: { [metricName: string]: string | number } = {};
        productMetrics.forEach(metric => {
            const existingTarget = currentMonthTargets.find(t => t.metric === metric.name);
            newMetricsData[metric.name] = existingTarget ? existingTarget.target : ''; // Pre-fill or empty
        });

        const existingDueDate = currentMonthTargets[0]?.dueDate || '';

        setBulkFormData(prev => ({
            ...prev,
            metrics: newMetricsData,
            dueDate: existingDueDate,
        }));
    }, [isBulkModalOpen, bulkFormData.branchName, bulkFormData.month, productMetrics, branchTargets]);


    // Handlers for main page dropdowns
    const handleBranchChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const branchId = e.target.value;
        const branch = allBranches.find(b => b.id === branchId) || null;
        setSelectedBranch(branch);
    };

    const handleMonthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSelectedMonth(e.target.value);
    };
    
    // Handlers for bulk modal form
    const openBulkModal = () => {
        setError(null);
        setNotification(null);
        // Initialize with values from main page selectors
        setBulkFormData({
            branchName: selectedBranch?.branchName || (allBranches.length > 0 ? allBranches[0].branchName : ''),
            month: selectedMonth,
            dueDate: '',
            metrics: {}, // This will be populated by the useEffect immediately after opening
        });
        setIsBulkModalOpen(true);
    };

    const closeBulkModal = () => {
        setIsBulkModalOpen(false);
        setError(null);
    };

    const handleBulkFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        if (name === 'branchName' || name === 'month' || name === 'dueDate') {
            setBulkFormData(prev => ({ ...prev, [name]: value }));
        } else if (name.startsWith('metric-')) {
            const metricName = name.replace('metric-', '');
            setBulkFormData(prev => ({
                ...prev,
                metrics: {
                    ...prev.metrics,
                    [metricName]: value === '' ? '' : Number(value),
                },
            }));
        }
        setError(null); // Clear error on input change
    };
    
    const handleBulkSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setNotification(null);
        setError(null);

        if (!bulkFormData.branchName || !bulkFormData.month) {
            setError("Branch Name and Month are required for bulk submission.");
            setIsSubmitting(false);
            return;
        }

        const operations: Promise<any>[] = [];
        const targetsForCurrentBranchAndMonth = branchTargets.filter(
            t => t.branchName === bulkFormData.branchName && t.month === bulkFormData.month
        );

        productMetrics.forEach(metric => {
            let valueToSave = Number(bulkFormData.metrics[metric.name]);

            // Override values for GRAND TOTAL metrics with calculated totals
            if (metric.name === 'GRAND TOTAL AMT') {
                const totalAmount = productMetrics.filter(m => m.type === 'Amount' && m.name !== 'GRAND TOTAL AMT')
                                    .reduce((sum, m) => sum + (Number(bulkFormData.metrics[m.name]) || 0), 0);
                valueToSave = totalAmount;
            } else if (metric.name === 'GRAND TOTAL AC') {
                 const totalAccount = productMetrics.filter(m => m.type === 'Account' && m.name !== 'GRAND TOTAL AC' && m.name !== 'NEW-SS/AGNT')
                                    .reduce((sum, m) => sum + (Number(bulkFormData.metrics[m.name]) || 0), 0);
                valueToSave = totalAccount;
            }
            
            const existingTarget = targetsForCurrentBranchAndMonth.find(t => t.metric === metric.name);

            if (valueToSave > 0) {
                const payload = {
                    branchName: bulkFormData.branchName,
                    metric: metric.name,
                    target: valueToSave,
                    month: bulkFormData.month,
                    dueDate: bulkFormData.dueDate || undefined,
                };

                if (existingTarget) {
                    operations.push(updateBranchTarget(existingTarget.id, payload));
                } else {
                    operations.push(saveBranchTarget(payload));
                }
            } else {
                if (existingTarget) {
                    operations.push(deleteBranchTarget(existingTarget.id));
                }
            }
        });

        try {
            await Promise.all(operations);
            if (!isMounted.current) return;
            setNotification({ message: `Bulk branch targets for ${bulkFormData.branchName} (${bulkFormData.month}) submitted successfully.`, type: 'success' });
            if (isMounted.current) {
                closeBulkModal();
                // Re-fetch all targets and update displayed ones
                fetchAndFilterTargets(selectedBranch?.branchName || '', selectedMonth);
            }
        } catch (err) {
            if (isMounted.current) {
                setError(err instanceof Error ? err.message : 'An unexpected error occurred during bulk submission.');
            }
        } finally {
            if (isMounted.current) {
                setIsSubmitting(false);
            }
        }
    };

    const confirmDeleteTarget = async () => {
        if (!targetToDelete) return;

        const originalTargets = [...branchTargets]; // Create a shallow copy for restoration
        const target = targetToDelete;

        // 1. Optimistically remove the item from the UI state.
        setBranchTargets(prevTargets => prevTargets.filter(t => t.id !== target.id));
        setDisplayedTargets(prevTargets => prevTargets.filter(t => t.id !== target.id)); // Also update filtered list
        setNotification(null); // Clear previous notifications
        setTargetToDelete(null); // Close the confirmation modal
    
        try {
            // 2. Perform the actual deletion.
            await deleteBranchTarget(target.id);
            
            // 3. On success, the optimistic update was correct. Show a success message.
            if (isMounted.current) {
                setNotification({ 
                    message: `Target for ${target.metric} deleted successfully.`, 
                    type: 'success' 
                });
                // Re-fetch and filter to ensure data consistency after deletion, especially for totals calculation
                fetchAndFilterTargets(selectedBranch?.branchName || '', selectedMonth);
            }
    
        } catch (err) {
            // 4. On failure, revert the UI state and show a persistent error.
            if (isMounted.current) {
                // Restore the full list from the backup copy
                setBranchTargets(originalTargets);
                setNotification({ 
                    message: err instanceof Error ? err.message : "Failed to delete target. The item has been restored.", 
                    type: 'error' 
                });
            }
        }
    };


    // Calculate totals for the main DISPLAY
    const { displayTotalAmount, displayTotalAccount, groupedDisplayTargets, grandTotalAmountTarget, grandTotalAccountTarget } = useMemo(() => {
        let totalAmount = 0;
        let totalAccount = 0;
        
        let localAmountTargets: BranchTarget[] = [];
        let localAccountTargets: BranchTarget[] = [];
        let localOtherTargets: BranchTarget[] = [];

        // Extract grand total targets first
        const foundGrandTotalAmtTarget = displayedTargets.find(t => t.metric === 'GRAND TOTAL AMT');
        const foundGrandTotalAcTarget = displayedTargets.find(t => t.metric === 'GRAND TOTAL AC');

        const nonGrandTotalTargets = displayedTargets.filter(t => t.metric !== 'GRAND TOTAL AMT' && t.metric !== 'GRAND TOTAL AC');

        nonGrandTotalTargets.forEach(target => {
            const metricDef = productMetrics.find(pm => pm.name === target.metric);
            if (metricDef) {
                if (metricDef.type === 'Amount') {
                    localAmountTargets.push(target);
                    totalAmount += target.target;
                } else if (metricDef.type === 'Account') {
                    localAccountTargets.push(target);
                    // Sum only if not 'NEW-SS/AGNT' (which is handled in 'other')
                    if (metricDef.name !== 'NEW-SS/AGNT') { 
                        totalAccount += target.target;
                    }
                } else { // Type 'Other', e.g., NEW-SS/AGNT
                    localOtherTargets.push(target);
                    if (metricDef.name === 'NEW-SS/AGNT') { // Special handling for NEW-SS/AGNT
                        totalAccount += target.target;
                    }
                }
            }
        });

        // Use defined grand totals if present, otherwise use calculated sums
        const finalDisplayTotalAmount = foundGrandTotalAmtTarget ? foundGrandTotalAmtTarget.target : totalAmount;
        const finalDisplayTotalAccount = foundGrandTotalAcTarget ? foundGrandTotalAcTarget.target : totalAccount;

        // Sort for consistent display
        localAmountTargets.sort((a, b) => a.metric.localeCompare(b.metric));
        localAccountTargets.sort((a, b) => a.metric.localeCompare(b.metric));
        localOtherTargets.sort((a, b) => a.metric.localeCompare(b.metric));

        return {
            displayTotalAmount: finalDisplayTotalAmount,
            displayTotalAccount: finalDisplayTotalAccount,
            groupedDisplayTargets: { amount: localAmountTargets, account: localAccountTargets, other: localOtherTargets },
            grandTotalAmountTarget: foundGrandTotalAmtTarget,
            grandTotalAccountTarget: foundGrandTotalAcTarget,
        };
    }, [displayedTargets, productMetrics]);

    // Filter product metrics for the bulk modal display (excluding grand totals for direct input)
    const editableAmountMetrics = useMemo(() => productMetrics.filter(m => m.type === 'Amount' && m.name !== 'GRAND TOTAL AMT'), [productMetrics]);
    const editableAccountMetrics = useMemo(() => productMetrics.filter(m => m.type === 'Account' && m.name !== 'GRAND TOTAL AC' && m.name !== 'NEW-SS/AGNT'), [productMetrics]);
    // Include NEW-SS/AGNT separately for input, but not in auto-calculated total AC
    const otherMetrics = useMemo(() => productMetrics.filter(m => m.type === 'Other'), [productMetrics]);


    // Calculate dynamic totals for the BULK MODAL
    const { calculatedTotalAmount, calculatedTotalAccount } = useMemo(() => {
        let totalAmount = 0;
        let totalAccount = 0;

        editableAmountMetrics.forEach(metric => {
            const value = Number(bulkFormData.metrics[metric.name]);
            if (!isNaN(value) && value > 0) {
                totalAmount += value;
            }
        });

        editableAccountMetrics.forEach(metric => {
            const value = Number(bulkFormData.metrics[metric.name]);
            if (!isNaN(value) && value > 0) {
                totalAccount += value;
            }
        });
        
        otherMetrics.forEach(metric => {
             // For NEW-SS/AGNT, which is of type 'Other' but behaves like an account
            if (metric.name === 'NEW-SS/AGNT') {
                const value = Number(bulkFormData.metrics[metric.name]);
                if (!isNaN(value) && value > 0) {
                    totalAccount += value;
                }
            }
        });

        return { calculatedTotalAmount: totalAmount, calculatedTotalAccount: totalAccount };
    }, [bulkFormData.metrics, editableAmountMetrics, editableAccountMetrics, otherMetrics]);

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100">Branch Targets (Monthly Assignment)</h2>

            <div className="flex flex-col sm:flex-row justify-end gap-3 mb-4">
                <button 
                    onClick={() => openBulkModal()} 
                    className="btn btn-blue flex items-center gap-2"
                    disabled={allBranches.length === 0 || productMetrics.length === 0}
                >
                    <TargetIcon className="w-5 h-5" /> Bulk Add/Edit Targets
                </button>
            </div>

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
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                    <div>
                        <label htmlFor="branch-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Select Branch
                        </label>
                        <select
                            id="branch-select"
                            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md dark:bg-gray-700 dark:border-gray-600"
                            onChange={handleBranchChange}
                            value={selectedBranch?.id || ""}
                            disabled={loading || allBranches.length === 0 || currentUser.role === 'manager'} // Disable for managers
                        >
                            <option value="" disabled>-- Select a branch --</option>
                            {allBranches.map(b => <option key={b.id} value={b.id}>{b.branchName}</option>)}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="month-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Select Month
                        </label>
                        <input
                            type="month"
                            id="month-select"
                            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md dark:bg-gray-700 dark:border-gray-600"
                            onChange={handleMonthChange}
                            value={selectedMonth}
                            disabled={loading}
                        />
                    </div>
                    {/* Placeholder for alignment */}
                    <div className="hidden lg:block"></div>
                </div>
            </div>

            {selectedBranch && (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md">
                    <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                            Targets for {selectedBranch.branchName} ({selectedMonth})
                        </h3>
                    </div>
                    {/* Summary Cards for overall totals */}
                    <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <SummaryCard
                            title="Total Amount for Month"
                            value={displayTotalAmount.toLocaleString('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 })}
                            icon={<DollarSignIcon className="w-6 h-6" />}
                            color="text-green-500"
                        />
                        <SummaryCard
                            title="Total Accounts for Month"
                            value={displayTotalAccount.toLocaleString()}
                            icon={<HashIcon className="w-6 h-6" />}
                            color="text-blue-500"
                        />
                    </div>

                    {loading ? (
                         <div className="p-10 text-center"><LoaderIcon className="w-6 h-6 mx-auto" /></div>
                    ) : (
                        <div className="p-6 text-center text-gray-700 dark:text-gray-300">
                            {displayedTargets.length > 0 ? (
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                        <thead className="bg-gray-50 dark:bg-gray-700">
                                            <tr>
                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Metric</th>
                                                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Target</th>
                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Due Date</th>
                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                            {groupedDisplayTargets.amount.length > 0 && (
                                                <tr><td colSpan={5} className="px-4 py-2 bg-gray-100 dark:bg-gray-700 font-semibold text-gray-700 dark:text-gray-200 text-left">Amount Targets</td></tr>
                                            )}
                                            {groupedDisplayTargets.amount.map(target => {
                                                const status = getKraStatus(target.dueDate, 'monthly', target.month); // Assuming monthly period type for display
                                                return (
                                                    <tr key={target.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100 text-left">{target.metric}</td>
                                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300 text-right">{target.target.toLocaleString('en-IN')}</td>
                                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300 text-left">{formatDisplayDate(target.dueDate)}</td>
                                                        <td className={`px-4 py-3 whitespace-nowrap text-sm text-left ${status.color}`}>{status.text}</td>
                                                        <td className="px-4 py-3 whitespace-nowrap text-left text-sm font-medium">
                                                            <button 
                                                                onClick={() => openBulkModal()} // Direct to bulk edit for now
                                                                className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300 mx-2" 
                                                                aria-label={`Edit ${target.metric}`}
                                                            >
                                                                <EditIcon className="w-5 h-5"/>
                                                            </button>
                                                            <button onClick={() => setTargetToDelete(target)} className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300" aria-label={`Delete ${target.metric}`}><TrashIcon className="w-5 h-5"/></button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                            {groupedDisplayTargets.account.length > 0 && (
                                                <tr><td colSpan={5} className="px-4 py-2 bg-gray-100 dark:bg-gray-700 font-semibold text-gray-700 dark:text-gray-200 text-left">Account Targets</td></tr>
                                            )}
                                            {groupedDisplayTargets.account.map(target => {
                                                const status = getKraStatus(target.dueDate, 'monthly', target.month);
                                                return (
                                                    <tr key={target.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100 text-left">{target.metric}</td>
                                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300 text-right">{target.target.toLocaleString('en-IN')}</td>
                                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300 text-left">{formatDisplayDate(target.dueDate)}</td>
                                                        <td className={`px-4 py-3 whitespace-nowrap text-sm text-left ${status.color}`}>{status.text}</td>
                                                        <td className="px-4 py-3 whitespace-nowrap text-left text-sm font-medium">
                                                            <button 
                                                                onClick={() => openBulkModal()} 
                                                                className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300 mx-2" 
                                                                aria-label={`Edit ${target.metric}`}
                                                            >
                                                                <EditIcon className="w-5 h-5"/>
                                                            </button>
                                                            <button onClick={() => setTargetToDelete(target)} className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300" aria-label={`Delete ${target.metric}`}><TrashIcon className="w-5 h-5"/></button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                            {groupedDisplayTargets.other.length > 0 && (
                                                <tr><td colSpan={5} className="px-4 py-2 bg-gray-100 dark:bg-gray-700 font-semibold text-gray-700 dark:text-gray-200 text-left">Other Targets</td></tr>
                                            )}
                                            {groupedDisplayTargets.other.map(target => {
                                                const status = getKraStatus(target.dueDate, 'monthly', target.month);
                                                return (
                                                    <tr key={target.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100 text-left">{target.metric}</td>
                                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300 text-right">{target.target.toLocaleString('en-IN')}</td>
                                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300 text-left">{formatDisplayDate(target.dueDate)}</td>
                                                        <td className={`px-4 py-3 whitespace-nowrap text-sm text-left ${status.color}`}>{status.text}</td>
                                                        <td className="px-4 py-3 whitespace-nowrap text-left text-sm font-medium">
                                                            <button 
                                                                onClick={() => openBulkModal()} 
                                                                className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300 mx-2" 
                                                                aria-label={`Edit ${target.metric}`}
                                                            >
                                                                <EditIcon className="w-5 h-5"/>
                                                            </button>
                                                            <button onClick={() => setTargetToDelete(target)} className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300" aria-label={`Delete ${target.metric}`}><TrashIcon className="w-5 h-5"/></button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                            {/* Render GRAND TOTAL AMT and GRAND TOTAL AC at the bottom */}
                                            {grandTotalAmountTarget && (
                                                <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/50 font-bold bg-gray-50 dark:bg-gray-700">
                                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 text-left">{grandTotalAmountTarget.metric}</td>
                                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-800 dark:text-gray-100 text-right">{grandTotalAmountTarget.target.toLocaleString('en-IN')}</td>
                                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300 text-left">{formatDisplayDate(grandTotalAmountTarget.dueDate)}</td>
                                                    <td className={`px-4 py-3 whitespace-nowrap text-sm text-left ${getKraStatus(grandTotalAmountTarget.dueDate, 'monthly', grandTotalAmountTarget.month).color}`}>{getKraStatus(grandTotalAmountTarget.dueDate, 'monthly', grandTotalAmountTarget.month).text}</td>
                                                    <td className="px-4 py-3 whitespace-nowrap text-left text-sm font-medium">
                                                        <button 
                                                            onClick={() => openBulkModal()} 
                                                            className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300 mx-2" 
                                                            aria-label={`Edit ${grandTotalAmountTarget.metric}`}
                                                        >
                                                            <EditIcon className="w-5 h-5"/>
                                                        </button>
                                                        <button onClick={() => setTargetToDelete(grandTotalAmountTarget)} className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300" aria-label={`Delete ${grandTotalAmountTarget.metric}`}><TrashIcon className="w-5 h-5"/></button>
                                                    </td>
                                                </tr>
                                            )}
                                            {grandTotalAccountTarget && (
                                                <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/50 font-bold bg-gray-50 dark:bg-gray-700">
                                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 text-left">{grandTotalAccountTarget.metric}</td>
                                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-800 dark:text-gray-100 text-right">{grandTotalAccountTarget.target.toLocaleString('en-IN')}</td>
                                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300 text-left">{formatDisplayDate(grandTotalAccountTarget.dueDate)}</td>
                                                    <td className={`px-4 py-3 whitespace-nowrap text-sm text-left ${getKraStatus(grandTotalAccountTarget.dueDate, 'monthly', grandTotalAccountTarget.month).color}`}>{getKraStatus(grandTotalAccountTarget.dueDate, 'monthly', grandTotalAccountTarget.month).text}</td>
                                                    <td className="px-4 py-3 whitespace-nowrap text-left text-sm font-medium">
                                                        <button 
                                                            onClick={() => openBulkModal()} 
                                                            className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300 mx-2" 
                                                            aria-label={`Edit ${grandTotalAccountTarget.metric}`}
                                                        >
                                                            <EditIcon className="w-5 h-5"/>
                                                        </button>
                                                        <button onClick={() => setTargetToDelete(grandTotalAccountTarget)} className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300" aria-label={`Delete ${grandTotalAccountTarget.metric}`}><TrashIcon className="w-5 h-5"/></button>
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <p className="text-base">
                                    No Target defined for this branch for the current month.
                                </p>
                            )}
                        </div>
                    )}
                </div>
            )}
            
            {/* NEW: Bulk Target Submission Modal */}
            {isBulkModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-40 flex items-center justify-center p-4" aria-modal="true" role="dialog">
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
                        <div className="flex justify-between items-center p-4 border-b dark:border-gray-700">
                            <h3 className="text-lg font-semibold dark:text-gray-100">Bulk Branch Target Submission</h3>
                            <button onClick={closeBulkModal} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" aria-label="Close modal"><XIcon className="w-6 h-6" /></button>
                        </div>
                        <form onSubmit={handleBulkSubmit} className="flex-grow flex flex-col overflow-hidden">
                            <div className="p-6 space-y-4 overflow-y-auto">
                                {error && <div className="p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-md text-sm flex items-center gap-2" role="alert"><AlertTriangleIcon className="w-5 h-5 flex-shrink-0" />{error}</div>}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label htmlFor="bulkBranchName" className="label-style">Branch Name</label>
                                        <select
                                            name="branchName"
                                            id="bulkBranchName"
                                            value={bulkFormData.branchName}
                                            onChange={handleBulkFormChange}
                                            className="input-style w-full"
                                            required
                                            disabled={true} // Always disabled, uses selectedBranch from main page
                                        >
                                            {allBranches.length > 0 ? (
                                                allBranches.map(b => <option key={b.id} value={b.branchName}>{b.branchName}</option>)
                                            ) : (
                                                <option value="" disabled>No branches available</option>
                                            )}
                                        </select>
                                    </div>
                                    <div>
                                        <label htmlFor="bulkMonth" className="label-style">Month</label>
                                        <input
                                            type="month"
                                            name="month"
                                            id="bulkMonth"
                                            value={bulkFormData.month}
                                            onChange={handleBulkFormChange}
                                            required
                                            className="input-style w-full"
                                        />
                                    </div>
                                    <div className="sm:col-span-2">
                                        <label htmlFor="bulkDueDate" className="label-style">Overall Due Date (Optional)</label>
                                        <input
                                            type="date"
                                            name="dueDate"
                                            id="bulkDueDate"
                                            value={bulkFormData.dueDate}
                                            onChange={handleBulkFormChange}
                                            className="input-style w-full"
                                        />
                                    </div>
                                </div>
                                <h4 className="text-md font-semibold text-gray-800 dark:text-gray-100 mt-6">Product Wise Targets</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                     {/* Amount Targets Column */}
                                    <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-700/30 rounded-md">
                                        <h5 className="font-bold text-gray-700 dark:text-gray-200">Amount Targets</h5>
                                        {editableAmountMetrics.length > 0 ? (
                                            editableAmountMetrics.map(metric => (
                                                <div key={metric.id}>
                                                    <label htmlFor={`metric-${metric.name}`} className="label-style">{metric.name} ({metric.unitOfMeasure})</label>
                                                    <input
                                                        type="number"
                                                        name={`metric-${metric.name}`}
                                                        id={`metric-${metric.name}`}
                                                        value={bulkFormData.metrics[metric.name] ?? ''}
                                                        onChange={handleBulkFormChange}
                                                        className="input-style w-full"
                                                        min="0"
                                                        placeholder="0"
                                                    />
                                                </div>
                                            ))
                                        ) : (
                                            <p className="text-sm text-gray-500 dark:text-gray-400">No amount metrics configured.</p>
                                        )}
                                        <div className="pt-4 mt-4 border-t border-gray-200 dark:border-gray-600">
                                            <label htmlFor="metric-GRAND TOTAL AMT" className="label-style font-bold">GRAND TOTAL AMT (INR)</label>
                                            <input
                                                type="text"
                                                id="metric-GRAND TOTAL AMT"
                                                value={calculatedTotalAmount.toLocaleString()}
                                                readOnly
                                                className="input-style w-full font-bold text-gray-800 dark:text-gray-100 bg-transparent border-none"
                                            />
                                        </div>
                                    </div>

                                    {/* Account Targets Column */}
                                    <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-700/30 rounded-md">
                                        <h5 className="font-bold text-gray-700 dark:text-gray-200">Account & Other Targets</h5>
                                        {editableAccountMetrics.length > 0 ? (
                                            editableAccountMetrics.map(metric => (
                                                <div key={metric.id}>
                                                    <label htmlFor={`metric-${metric.name}`} className="label-style">{metric.name} ({metric.unitOfMeasure})</label>
                                                    <input
                                                        type="number"
                                                        name={`metric-${metric.name}`}
                                                        id={`metric-${metric.name}`}
                                                        value={bulkFormData.metrics[metric.name] ?? ''}
                                                        onChange={handleBulkFormChange}
                                                        className="input-style w-full"
                                                        min="0"
                                                        placeholder="0"
                                                    />
                                                </div>
                                            ))
                                        ) : (
                                            <p className="text-sm text-gray-500 dark:text-gray-400">No account metrics configured.</p>
                                        )}
                                        {otherMetrics.map(metric => (
                                            <div key={metric.id}>
                                                <label htmlFor={`metric-${metric.name}`} className="label-style">{metric.name} ({metric.unitOfMeasure})</label>
                                                <input
                                                    type="number"
                                                    name={`metric-${metric.name}`}
                                                    id={`metric-${metric.name}`}
                                                    value={bulkFormData.metrics[metric.name] ?? ''}
                                                    onChange={handleBulkFormChange}
                                                    className="input-style w-full"
                                                    min="0"
                                                    placeholder="0"
                                                />
                                            </div>
                                        ))}
                                        <div className="pt-4 mt-4 border-t border-gray-200 dark:border-gray-600">
                                            <label htmlFor="metric-GRAND TOTAL AC" className="label-style font-bold">GRAND TOTAL AC (Units)</label>
                                            <input
                                                type="text"
                                                id="metric-GRAND TOTAL AC"
                                                value={calculatedTotalAccount.toLocaleString()}
                                                readOnly
                                                className="input-style w-full font-bold text-gray-800 dark:text-gray-100 bg-transparent border-none"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="flex justify-end gap-3 p-4 bg-gray-50 dark:bg-gray-800/50 border-t dark:border-gray-700 flex-shrink-0">
                                <button type="button" onClick={closeBulkModal} className="btn-secondary">Cancel</button>
                                <button type="submit" disabled={isSubmitting || !selectedBranch || productMetrics.length === 0} className="btn-primary flex items-center gap-2">
                                    {isSubmitting && <LoaderIcon className="w-4 h-4" />}
                                    {isSubmitting ? 'Saving...' : 'Save All Targets'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {targetToDelete && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" aria-modal="true" role="dialog">
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md">
                        <div className="p-6 text-center">
                            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/30">
                                <AlertTriangleIcon className="h-6 w-6 text-red-600 dark:text-red-400" aria-hidden="true" />
                            </div>
                            <h3 className="mt-5 text-lg font-medium text-gray-900 dark:text-gray-100">Delete Target</h3>
                            <div className="mt-2">
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    Are you sure you want to delete the target for <strong>{targetToDelete.metric}</strong> ({targetToDelete.month})? This action cannot be undone.
                                </p>
                            </div>
                        </div>
                        <div className="flex justify-center items-center gap-3 p-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-700">
                            <button type="button" onClick={() => setTargetToDelete(null)} className="btn btn-secondary" disabled={isSubmitting}>
                                Cancel
                            </button>
                            <button type="button" onClick={confirmDeleteTarget} className="btn btn-danger flex items-center gap-2" disabled={isSubmitting}>
                                {isSubmitting && <LoaderIcon className="w-4 h-4" />}Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BranchTargetMappingPage;