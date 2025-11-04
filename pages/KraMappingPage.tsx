import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { User, StaffMember, Kra, ProductMetric, DesignationKRA, Designation, TargetPeriodType } from '../types';
import { getAllStaff, getBranches, getStaffByBranch, getKrasForStaff, saveKra, updateKra, deleteKra, getProductMetrics, getRecursiveSubordinateInfo, getDesignationKraByDesignation } from '../services/dataService'; // Import getRecursiveSubordinateInfo, getDesignationKraByDesignation
import { LoaderIcon, AlertTriangleIcon, EditIcon, XIcon, PlusIcon, TrashIcon, TargetIcon, CalendarIcon, DollarSignIcon, HashIcon, SettingsIcon, CheckCircleIcon } from '../components/icons'; // Added CheckCircleIcon and SettingsIcon
import SummaryCard from '../components/SummaryCard'; // Import SummaryCard
import { getMonthString, getKraStatus, formatDisplayDate, getYearString } from '../utils/dateHelpers'; // Import from new utility
import ProductSettingsPage from './ProductSettingsPage'; // Import ProductSettingsPage
import { ADMIN_USER_ID } from '../services/dataService'; // Import ADMIN_USER_ID

interface BulkKraFormData {
    staffId: string;
    periodType: TargetPeriodType; // New: monthly, mtd, ytd
    period: string; // YYYY-MM for monthly/mtd, YYYY for ytd
    dueDate: string;
    metrics: { [metricName: string]: string | number }; // Stores target values for each metric
}

// FIX: Changed to named export
export const KraMappingPage: React.FC<{ currentUser: User }> = ({ currentUser }) => { // Renamed from KraMappingPage
    const [branchStaff, setBranchStaff] = useState<StaffMember[]>([]);
    const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
    const [allStaffKras, setAllStaffKras] = useState<Kra[]>([]); // For all KRAs of selected staff
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    const [selectedPeriodFilter, setSelectedPeriodFilter] = useState('all'); // 'all' or YYYY-MM / YYYY string
    const [selectedPeriodTypeFilter, setSelectedPeriodTypeFilter] = useState<TargetPeriodType | 'all'>('all'); // New: 'all', 'monthly', 'mtd', 'ytd'

    // Bulk target entry modal states
    const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
    const [bulkFormData, setBulkFormData] = useState<BulkKraFormData>({
        staffId: '',
        periodType: 'monthly', // Default to monthly
        period: getMonthString(),
        dueDate: '',
        metrics: {},
    });

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [productMetrics, setProductMetrics] = useState<ProductMetric[]>([]);
    const [designationKras, setDesignationKras] = useState<DesignationKRA | null>(null); // New: KRA definitions for the selected staff's designation


    // State for ProductSettings modal
    const [isProductSettingsModalOpen, setIsProductSettingsModalOpen] = useState(false);


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
            const [metrics, fullStaffList, allBranchesList] = await Promise.all([
                getProductMetrics(),
                getAllStaff(), // Get all staff for hierarchy traversal
                getBranches() // Get all branches for zone/branch lookup
            ]);
            if (!isMounted.current) return;
            setProductMetrics(metrics);
            
            let staffList: StaffMember[] = [];
            if (currentUser.role === 'admin') {
                staffList = fullStaffList; // Admin sees all staff
            } else if (currentUser.role === 'manager') {
                const managerStaffNode = fullStaffList.find(s => s.id === currentUser.id);
                if (managerStaffNode) {
                    const relevantEmployeeCodes = new Set<string>();
                    // Include manager themselves
                    if (managerStaffNode.employeeCode) relevantEmployeeCodes.add(managerStaffNode.employeeCode);

                    // Add all subordinates (direct and indirect)
                    const { employeeCodes: subCodes } = getRecursiveSubordinateInfo(managerStaffNode, fullStaffList);
                    subCodes.forEach(code => relevantEmployeeCodes.add(code));

                    // Add staff from managed zones (for Zonal Managers, etc.)
                    if (managerStaffNode.managedZones && managerStaffNode.managedZones.length > 0) {
                        const accessibleBranchesInZones = allBranchesList.filter(b => managerStaffNode.managedZones!.includes(b.zone));
                        accessibleBranchesInZones.forEach(b => {
                            fullStaffList.filter(s => s.branchName === b.branchName).forEach(s => {
                                if (s.employeeCode) relevantEmployeeCodes.add(s.employeeCode);
                            });
                        });
                    }

                    // Add staff from managed branches (for District Heads, Asst. District Heads, Team Leaders, etc.)
                    if (managerStaffNode.managedBranches && managerStaffNode.managedBranches.length > 0) {
                        managerStaffNode.managedBranches.forEach(bName => {
                            fullStaffList.filter(s => s.branchName === bName).forEach(s => {
                                if (s.employeeCode) relevantEmployeeCodes.add(s.employeeCode);
                            });
                        });
                    }
                    
                    // Filter staff based on collected relevant employee codes
                    staffList = fullStaffList.filter(s => relevantEmployeeCodes.has(s.employeeCode));
                }
            } else { // Regular user can only see their own KRA mapping
                const userStaffNode = fullStaffList.find(s => s.id === currentUser.id);
                if (userStaffNode) {
                    staffList = [userStaffNode];
                }
            }
            
            if (!isMounted.current) return;
            setBranchStaff(staffList);
            // Set default selected staff if none selected or if previous selection is no longer valid
            if (!selectedStaff || !staffList.find(s => s.id === selectedStaff.id)) {
                setSelectedStaff(staffList.length > 0 ? staffList[0] : null);
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
    }, [currentUser, isMounted, selectedStaff]); 

    useEffect(() => {
        fetchInitialData();
    }, [fetchInitialData]);

    const fetchKrasAndDesignationKras = useCallback(async (staffMember: StaffMember) => {
        setLoading(true);
        try {
            const [kras, dkra] = await Promise.all([
                getKrasForStaff(staffMember.employeeCode), // Get all KRAs for the staff
                // FIX: Use staffMember.function directly, it's already of type Designation
                getDesignationKraByDesignation(staffMember.function) // Get KRA definitions for staff's designation
            ]);
            if (!isMounted.current) return;
            setAllStaffKras(kras); // Store all KRAs
            setDesignationKras(dkra || null); // Store designation-specific KRA metrics

        } catch (err) {
            if (isMounted.current) {
                setError("Failed to fetch KRA data or designation KRA definitions.");
            }
        } finally {
            if (isMounted.current) {
                setLoading(false);
            }
        }
    }, [isMounted]);

    useEffect(() => {
        if (selectedStaff) {
            fetchKrasAndDesignationKras(selectedStaff);
        } else {
            setAllStaffKras([]);
            setDesignationKras(null);
        }
    }, [selectedStaff, fetchKrasAndDesignationKras]);
    
    // Generate unique periods for filter dropdown
    const availablePeriods = useMemo(() => {
        const periods = new Set(allStaffKras.map(kra => kra.period));
        const sortedPeriods = Array.from(periods).sort((a: string, b: string) => b.localeCompare(a)); // Sort descending
        return ['all', ...sortedPeriods];
    }, [allStaffKras]);

    const availablePeriodTypes = useMemo(() => {
        const periodTypes = new Set(allStaffKras.map(kra => kra.periodType));
        const sortedPeriodTypes = Array.from(periodTypes).sort();
        return ['all', ...sortedPeriodTypes];
    }, [allStaffKras]);


    // Filter KRAs based on selectedPeriodFilter and selectedPeriodTypeFilter
    const filteredKras = useMemo(() => {
        let kras = allStaffKras;
        if (selectedPeriodFilter !== 'all') {
            kras = kras.filter(kra => kra.period === selectedPeriodFilter);
        }
        if (selectedPeriodTypeFilter !== 'all') {
            kras = kras.filter(kra => kra.periodType === selectedPeriodTypeFilter);
        }
        return kras;
    }, [allStaffKras, selectedPeriodFilter, selectedPeriodTypeFilter]);

    // Effect to pre-fill bulk form data when modal opens or selected staff/period changes
    useEffect(() => {
        if (!isBulkModalOpen || !bulkFormData.staffId || !bulkFormData.period || !bulkFormData.periodType || productMetrics.length === 0) {
            return;
        }

        const staffBeingTargeted = branchStaff.find(s => s.id === bulkFormData.staffId);
        if (!staffBeingTargeted) return;

        const currentPeriodTargets = allStaffKras.filter(
            k => k.staffEmployeeCode === staffBeingTargeted.employeeCode && k.period === bulkFormData.period && k.periodType === bulkFormData.periodType
        );

        const newMetricsData: { [metricName: string]: string | number } = {};
        
        // Filter product metrics based on designationKras.metricIds
        const applicableMetricIds = (staffBeingTargeted.id === ADMIN_USER_ID) ? // Admin sees all metrics
            productMetrics.map(pm => pm.id) :
            (designationKras?.metricIds || []);

        productMetrics.filter(metric => applicableMetricIds.includes(metric.id)).forEach(metric => {
            const existingTarget = currentPeriodTargets.find(t => t.metric === metric.name);
            newMetricsData[metric.name] = existingTarget ? existingTarget.target : ''; // Pre-fill or empty
        });

        // Use the dueDate of an existing target, or keep the default
        const existingDueDate = currentPeriodTargets[0]?.dueDate || '';

        setBulkFormData(prev => ({
            ...prev,
            metrics: newMetricsData,
            dueDate: existingDueDate,
        }));
    }, [isBulkModalOpen, bulkFormData.staffId, bulkFormData.period, bulkFormData.periodType, productMetrics, allStaffKras, selectedStaff, designationKras, branchStaff]);

    const handleStaffChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const staffId = e.target.value;
        const staff = branchStaff.find(s => s.id === staffId) || null;
        setSelectedStaff(staff);
        setSelectedPeriodFilter('all'); // Reset period filter when staff changes
        setSelectedPeriodTypeFilter('all'); // Reset period type filter when staff changes
    };
    
    // Bulk target modal handlers
    const openBulkModal = () => {
        setError(null);
        setNotification(null);
        // Initialize with default values, potentially pre-select current staff/period
        setBulkFormData({
            staffId: selectedStaff?.id || (branchStaff.length > 0 ? branchStaff[0].id : ''),
            periodType: 'monthly', // Default to monthly
            period: getMonthString(), // Always defaults to current month for bulk edit
            dueDate: '',
            metrics: {},
        });
        setIsBulkModalOpen(true);
    };

    const closeBulkModal = () => {
        setIsBulkModalOpen(false);
        setError(null);
    };

    const handleBulkFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        if (name === 'staffId' || name === 'dueDate') {
            setBulkFormData(prev => ({ ...prev, [name]: value }));
        } else if (name === 'periodType') {
            const newPeriodType = value as TargetPeriodType;
            setBulkFormData(prev => ({
                ...prev,
                periodType: newPeriodType,
                // Update default period based on new periodType
                period: newPeriodType === 'ytd' ? getYearString() : getMonthString(),
            }));
        } else if (name === 'period') {
            // Handle period input directly
            setBulkFormData(prev => ({ ...prev, period: value }));
        }
        else if (name.startsWith('metric-')) {
            const metricName = name.replace('metric-', '');
            setBulkFormData(prev => ({
                ...prev,
                metrics: {
                    ...prev.metrics,
                    [metricName]: value === '' ? '' : Number(value),
                },
            }));
        }
        setError(null);
    };

    // Filter product metrics for the bulk modal display based on designationKras
    const applicableMetricIds = (selectedStaff?.id === ADMIN_USER_ID) ?
        productMetrics.map(pm => pm.id) : // Admin sees all metrics
        (designationKras?.metricIds || []);

    const filteredBulkMetrics = useMemo(() => {
        return productMetrics.filter(metric => applicableMetricIds.includes(metric.id));
    }, [productMetrics, applicableMetricIds]);


    // Calculate dynamic totals for the BULK MODAL
    const { calculatedTotalAmount, calculatedTotalAccount } = useMemo(() => {
        let totalAmount = 0;
        let totalAccount = 0;

        filteredBulkMetrics.forEach(metric => {
            const value = Number(bulkFormData.metrics[metric.name]);
            if (!isNaN(value) && value > 0) {
                if (metric.type === 'Amount' && metric.name !== 'GRAND TOTAL AMT') {
                    totalAmount += value;
                } else if (metric.type === 'Account' && metric.name !== 'GRAND TOTAL AC' && metric.name !== 'NEW-SS/AGNT') {
                    // Exclude NEW-SS/AGNT from GRAND TOTAL AC
                    totalAccount += value;
                }
                else if (metric.type === 'Other' && metric.name === 'NEW-SS/AGNT') { // Special handling for NEW-SS/AGNT
                    totalAccount += value;
                }
            }
        });
        return { calculatedTotalAmount: totalAmount, calculatedTotalAccount: totalAccount };
    }, [bulkFormData.metrics, filteredBulkMetrics]);


    const handleBulkSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setNotification(null);
        setError(null);

        if (!bulkFormData.staffId || !bulkFormData.period || !bulkFormData.periodType) {
            setError("Staff Member, Period Type, and Period are required for bulk submission.");
            setIsSubmitting(false);
            return;
        }
        
        const operations: Promise<any>[] = [];
        const staffToTarget = branchStaff.find(s => s.id === bulkFormData.staffId);
        if (!staffToTarget) {
            setError("Selected staff member not found.");
            setIsSubmitting(false);
            return;
        }

        const currentPeriodTargets = allStaffKras.filter(
            k => k.staffEmployeeCode === staffToTarget.employeeCode && k.period === bulkFormData.period && k.periodType === bulkFormData.periodType
        );

        filteredBulkMetrics.forEach(metric => { // Iterate only over filtered/applicable metrics
            let valueToSave = Number(bulkFormData.metrics[metric.name]);

            // Override values for GRAND TOTAL metrics with calculated totals
            if (metric.name === 'GRAND TOTAL AMT') {
                valueToSave = calculatedTotalAmount;
            } else if (metric.name === 'GRAND TOTAL AC') {
                valueToSave = calculatedTotalAccount;
            }
            
            const existingTarget = currentPeriodTargets.find(t => t.metric === metric.name);

            if (valueToSave > 0) { // If a positive value is provided
                const payload = {
                    staffEmployeeCode: staffToTarget.employeeCode,
                    metric: metric.name,
                    target: valueToSave,
                    period: bulkFormData.period,
                    periodType: bulkFormData.periodType,
                    dueDate: bulkFormData.dueDate || undefined,
                };

                if (existingTarget) {
                    operations.push(updateKra(existingTarget.id, payload));
                } else {
                    operations.push(saveKra(payload));
                }
            } else { // If value is 0, empty, or invalid, and an existing target exists, delete it
                if (existingTarget) {
                    operations.push(deleteKra(existingTarget.id));
                }
            }
        });

        try {
            await Promise.all(operations);
            if (!isMounted.current) return;
            setNotification({ message: `Bulk targets for ${staffToTarget.employeeName} (${bulkFormData.periodType} - ${bulkFormData.period}) submitted successfully.`, type: 'success' });
            if (isMounted.current) {
                closeBulkModal();
                fetchKrasAndDesignationKras(staffToTarget); // Re-fetch to update table
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

    const handleDelete = async (kra: Kra) => {
        if(window.confirm(`Are you sure you want to delete the target for "${kra.metric}" (${kra.periodType} - ${kra.period})?`)){
            try {
                setNotification(null);
                await deleteKra(kra.id);
                if (!isMounted.current) return;
                setNotification({ message: `Target for ${kra.metric} (${kra.periodType} - ${kra.period}) deleted successfully.`, type: 'success' });
                // Re-fetch KRA data for selected staff after deletion
                if (selectedStaff) {
                    fetchKrasAndDesignationKras(selectedStaff);
                }
            } catch(err){
                if (isMounted.current) {
                    setNotification({ message: err instanceof Error ? err.message : "Failed to delete target.", type: 'error' });
                }
            }
        }
    };

    // Calculate totals for the DISPLAY TABLE (based on filteredKras)
    const { displayTotalAmount, displayTotalAccount, groupedDisplayKras } = useMemo(() => {
        let totalAmount = 0;
        let totalAccount = 0;
        
        const amountKras: Kra[] = [];
        const accountKras: Kra[] = [];
        const otherKras: Kra[] = []; // For any metrics not explicitly Amount or Account

        filteredKras.forEach(kra => {
            const metricDef = productMetrics.find(pm => pm.name === kra.metric);
            if (metricDef) {
                if (metricDef.type === 'Amount') {
                    amountKras.push(kra);
                    // Sum only if not 'GRAND TOTAL AMT'
                    if (metricDef.name !== 'GRAND TOTAL AMT') {
                        totalAmount += kra.target;
                    }
                } else if (metricDef.type === 'Account') {
                    accountKras.push(kra);
                     // Sum only if not 'GRAND TOTAL AC' and not 'NEW-SS/AGNT'
                    if (metricDef.name !== 'GRAND TOTAL AC' && metricDef.name !== 'NEW-SS/AGNT') {
                        totalAccount += kra.target;
                    }
                } else { // Type 'Other', e.g., NEW-SS/AGNT
                    otherKras.push(kra);
                    // For 'NEW-SS/AGNT' (type 'Other'), display it under accounts, but don't sum.
                    // This is handled by specific exclusion in `totalAccount` calculation.
                    // A better approach would be to have a 'contributesToGrandTotalAc' flag for such metrics
                    // and apply that here. For now, matching the previous logic.
                    if (metricDef.name === 'NEW-SS/AGNT') {
                        totalAccount += kra.target;
                    }
                }
            }
        });
        
        // Ensure Grand Totals reflect calculated sums
        const grandTotalAmtTarget = filteredKras.find(t => t.metric === 'GRAND TOTAL AMT');
        if (grandTotalAmtTarget) {
            totalAmount = grandTotalAmtTarget.target;
        }

        const grandTotalAcTarget = filteredKras.find(t => t.metric === 'GRAND TOTAL AC');
        if (grandTotalAcTarget) {
            totalAccount = grandTotalAcTarget.target;
        }


        // Sort for consistent display
        amountKras.sort((a, b) => a.metric.localeCompare(b.metric));
        accountKras.sort((a, b) => a.metric.localeCompare(b.metric));
        otherKras.sort((a, b) => a.metric.localeCompare(b.metric));

        return {
            displayTotalAmount: totalAmount,
            displayTotalAccount: totalAccount,
            groupedDisplayKras: { amount: amountKras, account: accountKras, other: otherKras },
        };
    }, [filteredKras, productMetrics]);


    // Filter product metrics for the bulk modal display (excluding grand totals for direct input)
    const editableAmountMetrics = useMemo(() => filteredBulkMetrics.filter(m => m.type === 'Amount' && m.name !== 'GRAND TOTAL AMT'), [filteredBulkMetrics]);
    const editableAccountMetrics = useMemo(() => filteredBulkMetrics.filter(m => m.type === 'Account' && m.name !== 'GRAND TOTAL AC'), [filteredBulkMetrics]);
    const otherMetrics = useMemo(() => filteredBulkMetrics.filter(m => m.type === 'Other'), [filteredBulkMetrics]);

    // Check if bulk submission should be disabled (e.g., no staff selected or no metrics configured for their designation)
    const isBulkSubmitDisabled = useMemo(() => {
        if (!selectedStaff || productMetrics.length === 0) return true; // No staff selected or no global metrics
        
        if (selectedStaff.id === ADMIN_USER_ID) return false; // Admin can always submit

        if (!designationKras || designationKras.metricIds.length === 0) return true; // No KRAs configured for designation

        return false;
    }, [selectedStaff, productMetrics.length, designationKras]);


    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100">Staff Targets (Monthly Assignment)</h2>

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
                        <label htmlFor="staff-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Select Staff Member
                        </label>
                        <select
                            id="staff-select"
                            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md dark:bg-gray-700 dark:border-gray-600"
                            onChange={handleStaffChange}
                            value={selectedStaff?.id || ""}
                            disabled={loading || branchStaff.length === 0}
                        >
                            <option value="" disabled>-- Select a staff member --</option>
                            {branchStaff.map(s => <option key={s.id} value={s.id}>{s.employeeName} ({s.employeeCode})</option>)}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="period-filter" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Filter by Period
                        </label>
                        <select
                            id="period-filter"
                            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md dark:bg-gray-700 dark:border-gray-600"
                            onChange={e => setSelectedPeriodFilter(e.target.value)}
                            value={selectedPeriodFilter}
                            disabled={loading || availablePeriods.length <= 1}
                        >
                            <option value="all">All Periods</option>
                            {availablePeriods.filter(period => period !== 'all').map(period => (
                                <option key={period} value={period}>{period}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="period-type-filter" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Filter by Period Type
                        </label>
                        <select
                            id="period-type-filter"
                            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md dark:bg-gray-700 dark:border-gray-600"
                            onChange={e => setSelectedPeriodTypeFilter(e.target.value as TargetPeriodType | 'all')}
                            value={selectedPeriodTypeFilter}
                            disabled={loading || availablePeriodTypes.length <= 1}
                        >
                            <option value="all">All Types</option>
                            {availablePeriodTypes.filter(type => type !== 'all').map(type => (
                                <option key={type} value={type}>{type.toUpperCase()}</option>
                            ))}
                        </select>
                    </div>
                </div>
                {selectedStaff && (
                    <div className="flex flex-col sm:flex-row justify-end gap-3 flex-wrap">
                         {currentUser.role === 'admin' && ( // RBAC: Only admin can manage product metrics
                            <button
                                onClick={() => setIsProductSettingsModalOpen(true)}
                                className="btn btn-secondary flex items-center gap-2"
                            >
                                <SettingsIcon className="w-5 h-5" /> Manage Product Metrics
                            </button>
                        )}
                         {(currentUser.role === 'admin' || currentUser.role === 'manager') && ( // RBAC: Admin or Manager can bulk add/edit targets
                            <button 
                                onClick={() => openBulkModal()} 
                                className="btn btn-blue flex items-center gap-2"
                                disabled={isBulkSubmitDisabled}
                            >
                                <TargetIcon className="w-5 h-5" /> Bulk Add/Edit Targets
                            </button>
                         )}
                    </div>
                )}
                {selectedStaff && selectedStaff.id !== ADMIN_USER_ID && currentUser.role === 'admin' && (!designationKras || designationKras.metricIds.length === 0) && (
                    <div className="mt-4 p-3 bg-yellow-100 dark:bg-yellow-900/30 border-l-4 border-yellow-500 text-yellow-700 dark:text-yellow-300 rounded-md">
                        <p className="text-sm">
                            <AlertTriangleIcon className="inline-block w-4 h-4 mr-2" />
                            No KRA metrics are configured for "{selectedStaff.function}". Please set them in "Admin &gt; Mapping &gt; Target Mapping &gt; Designation KRA Setup" to enable target submission.
                        </p>
                    </div>
                )}
            </div>

            {selectedStaff && (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md">
                    <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                            Targets for {selectedStaff.employeeName} ({selectedPeriodTypeFilter === 'all' ? 'All Types' : selectedPeriodTypeFilter.toUpperCase()} - {selectedPeriodFilter === 'all' ? 'All Periods' : selectedPeriodFilter})
                        </h3>
                    </div>
                    {/* Summary Cards for overall totals */}
                    <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <SummaryCard 
                            title={`Total Amount`}
                            value={displayTotalAmount.toLocaleString('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 })} 
                            icon={<DollarSignIcon className="w-6 h-6" />} 
                            color="text-green-500" 
                        />
                        <SummaryCard 
                            title={`Total Accounts`}
                            value={displayTotalAccount.toLocaleString()} 
                            icon={<HashIcon className="w-6 h-6" />} 
                            color="text-blue-500" 
                        />
                    </div>

                    {loading ? (
                         <div className="p-10 text-center"><LoaderIcon className="w-6 h-6 mx-auto" /></div>
                    ) : (
                        <div className="overflow-x-auto">
                            {filteredKras.length > 0 ? (
                                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                    <thead className="bg-gray-50 dark:bg-gray-700">
                                        <tr>
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Metric</th>
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Period</th>
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Period Type</th>
                                            <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Target</th>
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Due Date</th>
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
                                            {(currentUser.role === 'admin' || currentUser.role === 'manager') && ( // RBAC: Admin or Manager can modify
                                                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                                            )}
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                        {groupedDisplayKras.amount.length > 0 && (
                                            <tr><td colSpan={7} className="px-6 py-2 bg-gray-100 dark:bg-gray-700 font-semibold text-gray-700 dark:text-gray-200">Amount Targets</td></tr>
                                        )}
                                        {groupedDisplayKras.amount.map(kra => {
                                            const status = getKraStatus(kra.dueDate, kra.periodType, kra.period);
                                            return (
                                                <tr key={kra.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">{kra.metric}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{kra.period}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{kra.periodType.toUpperCase()}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300 text-right">{kra.target.toLocaleString('en-IN')}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{formatDisplayDate(kra.dueDate)}</td>
                                                    <td className={`px-6 py-4 whitespace-nowrap text-sm ${status.color}`}>{status.text}</td>
                                                    {(currentUser.role === 'admin' || currentUser.role === 'manager') && ( // RBAC: Admin or Manager can modify
                                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                            <button onClick={() => openBulkModal()} className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300 mx-2" aria-label={`Edit ${kra.metric}`}><EditIcon className="w-5 h-5"/></button>
                                                            <button onClick={() => handleDelete(kra)} className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300" aria-label={`Delete ${kra.metric}`}><TrashIcon className="w-5 h-5"/></button>
                                                        </td>
                                                    )}
                                                </tr>
                                            );
                                        })}
                                        {groupedDisplayKras.account.length > 0 && (
                                            <tr><td colSpan={7} className="px-6 py-2 bg-gray-100 dark:bg-gray-700 font-semibold text-gray-700 dark:text-gray-200">Account Targets</td></tr>
                                        )}
                                        {groupedDisplayKras.account.map(kra => {
                                            const status = getKraStatus(kra.dueDate, kra.periodType, kra.period);
                                            return (
                                                <tr key={kra.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">{kra.metric}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{kra.period}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{kra.periodType.toUpperCase()}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300 text-right">{kra.target.toLocaleString('en-IN')}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{formatDisplayDate(kra.dueDate)}</td>
                                                    <td className={`px-6 py-4 whitespace-nowrap text-sm ${status.color}`}>{status.text}</td>
                                                    {(currentUser.role === 'admin' || currentUser.role === 'manager') && ( // RBAC: Admin or Manager can modify
                                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                            <button onClick={() => openBulkModal()} className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300 mx-2" aria-label={`Edit ${kra.metric}`}><EditIcon className="w-5 h-5"/></button>
                                                            <button onClick={() => handleDelete(kra)} className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300" aria-label={`Delete ${kra.metric}`}><TrashIcon className="w-5 h-5"/></button>
                                                        </td>
                                                    )}
                                                </tr>
                                            );
                                        })}
                                        {groupedDisplayKras.other.length > 0 && (
                                            <tr><td colSpan={7} className="px-6 py-2 bg-gray-100 dark:bg-gray-700 font-semibold text-gray-700 dark:text-gray-200">Other Targets</td></tr>
                                        )}
                                        {groupedDisplayKras.other.map(kra => {
                                            const status = getKraStatus(kra.dueDate, kra.periodType, kra.period);
                                            return (
                                                <tr key={kra.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">{kra.metric}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{kra.period}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{kra.periodType.toUpperCase()}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300 text-right">{kra.target.toLocaleString('en-IN')}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{formatDisplayDate(kra.dueDate)}</td>
                                                    <td className={`px-6 py-4 whitespace-nowrap text-sm ${status.color}`}>{status.text}</td>
                                                    {(currentUser.role === 'admin' || currentUser.role === 'manager') && ( // RBAC: Admin or Manager can modify
                                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                            <button onClick={() => openBulkModal()} className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300 mx-2" aria-label={`Edit ${kra.metric}`}><EditIcon className="w-5 h-5"/></button>
                                                            <button onClick={() => handleDelete(kra)} className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300" aria-label={`Delete ${kra.metric}`}><TrashIcon className="w-5 h-5"/></button>
                                                        </td>
                                                    )}
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            ) : (
                                <p className="text-center text-gray-500 dark:text-gray-400 py-8">No KRA targets found for the selected staff and period.</p>
                            )}
                        </div>
                    )}
                </div>
            )}
            
            {/* Bulk Target Submission Modal */}
            {isBulkModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-40 flex items-center justify-center p-4" aria-modal="true" role="dialog">
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
                        <div className="flex justify-between items-center p-4 border-b dark:border-gray-700">
                            <h3 className="text-lg font-semibold dark:text-gray-100">Bulk KRA Target Submission</h3>
                            <button onClick={closeBulkModal} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" aria-label="Close modal"><XIcon className="w-6 h-6" /></button>
                        </div>
                        <form onSubmit={handleBulkSubmit} className="flex-grow flex flex-col overflow-hidden">
                            <div className="p-6 space-y-4 overflow-y-auto">
                                {error && <div className="p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-md text-sm flex items-center gap-2" role="alert"><AlertTriangleIcon className="w-5 h-5 flex-shrink-0" />{error}</div>}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label htmlFor="bulkStaffId" className="label-style">Staff Member</label>
                                        <select
                                            name="staffId"
                                            id="bulkStaffId"
                                            value={bulkFormData.staffId}
                                            onChange={handleBulkFormChange}
                                            className="input-style w-full"
                                            required
                                            disabled={true} // Always disabled, uses selectedStaff from main page
                                        >
                                            {branchStaff.length > 0 ? (
                                                branchStaff.map(s => <option key={s.id} value={s.id}>{s.employeeName} ({s.employeeCode})</option>)
                                            ) : (
                                                <option value="" disabled>No staff available</option>
                                            )}
                                        </select>
                                    </div>
                                    <div>
                                        <label htmlFor="bulkPeriodType" className="label-style">Target Period Type</label>
                                        <select
                                            name="periodType"
                                            id="bulkPeriodType"
                                            value={bulkFormData.periodType}
                                            onChange={handleBulkFormChange}
                                            className="input-style w-full"
                                            required
                                        >
                                            <option value="monthly">Monthly</option>
                                            <option value="mtd">Month-to-Date (MTD)</option>
                                            <option value="ytd">Year-to-Date (YTD)</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label htmlFor="bulkPeriod" className="label-style">Period</label>
                                        <input
                                            type={bulkFormData.periodType === 'ytd' ? 'number' : 'month'}
                                            name="period"
                                            id="bulkPeriod"
                                            value={bulkFormData.period}
                                            onChange={handleBulkFormChange}
                                            required
                                            className="input-style w-full"
                                            min={bulkFormData.periodType === 'ytd' ? "2000" : undefined} // Min year if YTD
                                            max={bulkFormData.periodType === 'ytd' ? getYearString() : undefined} // Max year if YTD
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="bulkDueDate" className="label-style">Due Date (Optional)</label>
                                        <input
                                            type="date"
                                            name="dueDate"
                                            id="bulkDueDate"
                                            value={bulkFormData.dueDate}
                                            onChange={handleBulkFormChange}
                                            className="input-style w-full"
                                            disabled={bulkFormData.periodType === 'ytd'} // YTD targets typically don't have a specific due date
                                        />
                                    </div>
                                </div>
                                <h4 className="text-md font-semibold text-gray-800 dark:text-gray-100 mt-6">Product Wise Targets</h4>
                                {filteredBulkMetrics.length === 0 && selectedStaff && selectedStaff.id !== ADMIN_USER_ID ? (
                                    <div className="p-3 bg-yellow-100 dark:bg-yellow-900/30 border-l-4 border-yellow-500 text-yellow-700 dark:text-yellow-300 rounded-md">
                                        <p className="text-sm">
                                            <AlertTriangleIcon className="inline-block w-4 h-4 mr-2" />
                                            No KRA metrics configured for "{selectedStaff.function}". Please set them in "Admin &gt; Mapping &gt; Target Mapping &gt; Designation KRA Setup".
                                        </p>
                                    </div>
                                ) : (
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
                                                            value={String(bulkFormData.metrics[metric.name] ?? '')}
                                                            onChange={handleBulkFormChange}
                                                            className="input-style w-full"
                                                            min="0"
                                                            placeholder="0"
                                                        />
                                                    </div>
                                                ))
                                            ) : (
                                                <p className="text-sm text-gray-500 dark:text-gray-400">No amount metrics configured for this designation.</p>
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
                                                            value={String(bulkFormData.metrics[metric.name] ?? '')}
                                                            onChange={handleBulkFormChange}
                                                            className="input-style w-full"
                                                            min="0"
                                                            placeholder="0"
                                                        />
                                                    </div>
                                                ))
                                            ) : (
                                                <p className="text-sm text-gray-500 dark:text-gray-400">No account metrics configured for this designation.</p>
                                            )}
                                             {/* Other metrics like NEW-SS/AGNT */}
                                            {otherMetrics.map(metric => (
                                                <div key={metric.id}>
                                                    <label htmlFor={`metric-${metric.name}`} className="label-style">{metric.name} ({metric.unitOfMeasure})</label>
                                                    <input
                                                        type="number"
                                                        name={`metric-${metric.name}`}
                                                        id={`metric-${metric.name}`}
                                                        value={String(bulkFormData.metrics[metric.name] ?? '')}
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
                                )}
                            </div>
                            <div className="flex justify-end gap-3 p-4 bg-gray-50 dark:bg-gray-800/50 border-t dark:border-gray-700 flex-shrink-0">
                                <button type="button" onClick={closeBulkModal} className="btn-secondary">Cancel</button>
                                <button type="submit" disabled={isSubmitting || !selectedStaff || filteredBulkMetrics.length === 0} className="btn-primary flex items-center gap-2">
                                    {isSubmitting && <LoaderIcon className="w-4 h-4" />}
                                    {isSubmitting ? 'Saving...' : 'Save All Targets'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {isProductSettingsModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" aria-modal="true" role="dialog">
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                        <div className="flex justify-between items-center p-4 border-b dark:border-gray-700">
                            <h3 className="text-lg font-semibold dark:text-gray-100">Manage Product Metrics</h3>
                            <button onClick={() => setIsProductSettingsModalOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" aria-label="Close product settings modal"><XIcon className="w-6 h-6" /></button>
                        </div>
                        <div className="flex-grow overflow-y-auto p-6">
                            <ProductSettingsPage onClose={() => setIsProductSettingsModalOpen(false)} onMetricsUpdated={fetchInitialData} currentUser={currentUser} />
                        </div>
                         <div className="flex justify-end items-center gap-3 p-4 bg-gray-50 dark:bg-gray-800/50 border-t dark:border-gray-700">
                            <button type="button" onClick={() => setIsProductSettingsModalOpen(false)} className="btn btn-secondary">Close</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};