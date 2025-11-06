import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { User, ParsedCsvData, StaffMember, Target, Demand, PROJECTION_DEMAND_METRIC_NAMES, DailyRunRateResult, ProductMetric, CsvRecord } from '../types';
import { getStaffByBranch, getTargetsForStaff, getDemandsForStaff, calculateDailyRunRateForSingleEntity, getProductMetrics } from '../services/dataService';
import CollapsibleSection from '../components/CollapsibleSection';
import { CheckCircleIcon, FileTextIcon, LoaderIcon, TargetIcon, AlertTriangleIcon, DollarSignIcon, HashIcon, CalendarIcon } from '../components/icons';
import { getMonthString, getTodayDateYYYYMMDD, getKraStatus, formatDisplayDate } from '../utils/dateHelpers';
import SummaryCard from '../components/SummaryCard';
import RunRateBarChart from '../components/RunRateBarChart';

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
        style: 'decimal',
        maximumFractionDigits: 0,
    }).format(value);
};

// Reusable MonthlyTargets component
const MonthlyTargets: React.FC<{ user: User; productMetrics: ProductMetric[] }> = ({ user, productMetrics }) => {
    const [targets, setTargets] = useState<Target[]>([]);
    const [loading, setLoading] = useState(true);

    const isMounted = useRef(false);

    useEffect(() => {
      isMounted.current = true;
      return () => {
        isMounted.current = false;
      };
    }, []);

    const fetchTargets = useCallback(async () => {
        if (!user.employeeCode) return;
        setLoading(true);
        try {
            // Fetch only 'monthly' targets for the current month
            const currentMonth = getMonthString();
            const monthlyTargets = await getTargetsForStaff(user.employeeCode, 'monthly', currentMonth);
            if (isMounted.current) {
                setTargets(monthlyTargets);
            }
        } catch (e) {
            console.error("Failed to fetch target data", e);
        } finally {
            if (isMounted.current) {
                setLoading(false);
            }
        }
    }, [user.employeeCode, isMounted]);

    useEffect(() => {
        fetchTargets();
    }, [fetchTargets]);

    const { totalTargetAmount, totalTargetAccount, groupedTargets } = useMemo(() => {
        let totalAmount = 0;
        let totalAccount = 0;
        
        const amountTargets: Target[] = [];
        const accountTargets: Target[] = [];
        const otherTargets: Target[] = [];

        targets.forEach(target => {
            const metricDef = productMetrics.find(pm => pm.name === target.metric);
            if (metricDef) {
                if (metricDef.type === 'Amount') {
                    amountTargets.push(target);
                    if (metricDef.name !== 'GRAND TOTAL AMT') {
                        totalAmount += target.target;
                    }
                } else if (metricDef.type === 'Account') {
                    accountTargets.push(target);
                    if (metricDef.name !== 'GRAND TOTAL AC' && metricDef.name !== 'NEW-SS/AGNT') {
                        totalAccount += target.target;
                    }
                } else {
                    otherTargets.push(target);
                    if (metricDef.name === 'NEW-SS/AGNT') { // Special handling for NEW-SS/AGNT
                        totalAccount += target.target;
                    }
                }
            }
        });

        // Use defined grand totals if present
        const grandTotalAmtTarget = targets.find(k => k.metric === 'GRAND TOTAL AMT');
        if (grandTotalAmtTarget) {
            totalAmount = grandTotalAmtTarget.target;
        }
        const grandTotalAcTarget = targets.find(k => k.metric === 'GRAND TOTAL AC');
        if (grandTotalAcTarget) {
            totalAccount = grandTotalAcTarget.target;
        }

        amountTargets.sort((a, b) => a.metric.localeCompare(b.metric));
        accountTargets.sort((a, b) => a.metric.localeCompare(b.metric));
        otherTargets.sort((a, b) => a.metric.localeCompare(b.metric));

        return {
            totalTargetAmount: totalAmount,
            totalTargetAccount: totalAccount,
            groupedTargets: { amount: amountTargets, account: accountTargets, other: otherTargets },
        };
    }, [targets, productMetrics]);


    return (
        <CollapsibleSection title="This Month's Targets" icon={TargetIcon}>
             {loading ? (
                <div className="flex justify-center items-center py-8"><LoaderIcon /></div>
            ) : targets.length > 0 ? (
                <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <SummaryCard 
                            title="Monthly Target Amount"
                            value={totalTargetAmount.toLocaleString('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 })} 
                            icon={<DollarSignIcon className="w-6 h-6" />} 
                            color="text-indigo-500" 
                        />
                        <SummaryCard 
                            title="Monthly Target Accounts"
                            value={totalTargetAccount.toLocaleString()} 
                            icon={<HashIcon className="w-6 h-6" />} 
                            color="text-indigo-500" 
                        />
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                            <thead className="bg-gray-50 dark:bg-gray-700">
                                <tr>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Metric</th>
                                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Target</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                {groupedTargets.amount.length > 0 && (
                                    <tr><td colSpan={3} className="px-4 py-2 bg-gray-100 dark:bg-gray-700 font-semibold text-gray-700 dark:text-gray-200">Amount Targets</td></tr>
                                )}
                                {groupedTargets.amount.map(target => {
                                    const status = getKraStatus(target.dueDate, target.periodType, target.period);
                                    return (
                                        <tr key={target.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                            <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-700 dark:text-gray-200">{target.metric}</td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300 text-right">{target.target.toLocaleString('en-IN')}</td>
                                            <td className={`px-4 py-3 whitespace-nowrap text-sm ${status.color}`}>{status.text}</td>
                                        </tr>
                                    );
                                })}
                                {groupedTargets.account.length > 0 && (
                                    <tr><td colSpan={3} className="px-4 py-2 bg-gray-100 dark:bg-gray-700 font-semibold text-gray-700 dark:text-gray-200">Account Targets</td></tr>
                                )}
                                {groupedTargets.account.map(target => {
                                    const status = getKraStatus(target.dueDate, target.periodType, target.period);
                                    return (
                                        <tr key={target.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                            <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-700 dark:text-gray-200">{target.metric}</td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300 text-right">{target.target.toLocaleString('en-IN')}</td>
                                            <td className={`px-4 py-3 whitespace-nowrap text-sm ${status.color}`}>{status.text}</td>
                                        </tr>
                                    );
                                })}
                                {groupedTargets.other.length > 0 && (
                                    <tr><td colSpan={3} className="px-4 py-2 bg-gray-100 dark:bg-gray-700 font-semibold text-gray-700 dark:text-gray-200">Other Targets</td></tr>
                                )}
                                {groupedTargets.other.map(target => {
                                    const status = getKraStatus(target.dueDate, target.periodType, target.period);
                                    return (
                                        <tr key={target.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                            <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-700 dark:text-gray-200">{target.metric}</td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300 text-right">{target.target.toLocaleString('en-IN')}</td>
                                            <td className={`px-4 py-3 whitespace-nowrap text-sm ${status.color}`}>{status.text}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                <p className="text-center text-gray-500 dark:text-gray-400 py-8">No targets have been set for you this month.</p>
            )}
        </CollapsibleSection>
    );
};

// Reusable TeamStatus component
const TeamStatus: React.FC<{ manager: User; data: ParsedCsvData | null }> = ({ manager, data }) => {
    const [staff, setStaff] = useState<StaffMember[]>([]);
    const [loading, setLoading] = useState(true);

    const isMounted = useRef(false);

    useEffect(() => {
      isMounted.current = true;
      return () => {
        isMounted.current = false;
      };
    }, []);

    useEffect(() => {
        if (manager.branchName) {
            setLoading(true);
            getStaffByBranch(manager.branchName).then(staffList => {
                if (isMounted.current) {
                    setStaff(staffList);
                    setLoading(false);
                }
            }).catch(error => {
                console.error("Failed to fetch staff for branch:", error);
                if (isMounted.current) {
                    setLoading(false);
                }
            });
        }
    }, [manager.branchName, isMounted]);

    const teamSubmissionStatus = useMemo(() => {
        const todayStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }); // dd/mm/yyyy
        
        return staff.map(member => {
            const submission = data?.records.find(record => 
                String(record['STAFF NAME']).includes(member.employeeName) && 
                record['DATE'] === todayStr
            );
            return {
                name: member.employeeName,
                designation: member.function,
                status: submission ? 'Submitted' : 'Pending',
                amount: submission ? (Number(submission['GRAND TOTAL AMT']) || Number(submission['TOTAL AMOUNTS']) || 0) : 0
            };
        });
    }, [staff, data]);

    if (loading) {
        return <div className="flex items-center justify-center p-8"><LoaderIcon className="w-6 h-6" /></div>;
    }
    
    return (
        <CollapsibleSection title="Team Daily Submission Status" icon={CheckCircleIcon}>
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                        <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium">Employee Name</th>
                            <th className="px-4 py-2 text-left text-xs font-medium">Designation</th>
                            <th className="px-4 py-2 text-left text-xs font-medium">Status</th>
                            <th className="px-4 py-2 text-right text-xs font-medium">Amount Submitted Today</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {teamSubmissionStatus.map((s, index) => (
                            <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-700 dark:text-gray-200">{s.name}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{s.designation}</td>
                                <td className={`px-4 py-3 whitespace-nowrap text-sm font-semibold ${s.status === 'Submitted' ? 'text-green-600' : 'text-red-500'}`}>
                                    {s.status}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300 text-right">{formatCurrency(s.amount)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </CollapsibleSection>
    );
};

export interface ViewTodaysDemandPageProps {
  user: User;
  data: ParsedCsvData | null;
}

export const ViewTodaysDemandPage: React.FC<ViewTodaysDemandPageProps> = ({ user, data }) => {
    const [demands, setDemands] = useState<Demand[]>([]);
    const [loadingDemands, setLoadingDemands] = useState(true);
    const [loadingRunRate, setLoadingRunRate] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [demandRunRate, setDemandRunRate] = useState<DailyRunRateResult | null>(null);
    const [productMetrics, setProductMetrics] = useState<ProductMetric[]>([]);

    const isMounted = useRef(false);

    useEffect(() => {
      isMounted.current = true;
      return () => {
        isMounted.current = false;
      };
    }, []);

    const fetchAllData = useCallback(async () => {
        setLoadingDemands(true);
        setLoadingRunRate(true);
        setError(null);
        try {
            const today = getTodayDateYYYYMMDD();
            const fetchedDemands = await getDemandsForStaff(user.employeeCode || '', today);
            const fetchedMetrics = await getProductMetrics();
            if (isMounted.current) {
                setDemands(fetchedDemands);
                setProductMetrics(fetchedMetrics);
            }

            const achievementRecords = data?.records as CsvRecord[] || [];
            if (user.employeeCode && achievementRecords.length > 0) {
                const currentMonth = getMonthString();
                const runRateResult = await calculateDailyRunRateForSingleEntity({
                    entityId: user.employeeCode,
                    isBranch: false,
                    currentMonth: currentMonth,
                    achievementRecords: achievementRecords,
                });
                if (isMounted.current) {
                    setDemandRunRate(runRateResult);
                }
            } else {
                if (isMounted.current) {
                    setDemandRunRate(null);
                }
            }

        } catch (err) {
            if (isMounted.current) {
                setError(err instanceof Error ? err.message : 'Failed to fetch demand data.');
            }
        } finally {
            if (isMounted.current) {
                setLoadingDemands(false);
                setLoadingRunRate(false);
            }
        }
    }, [user.employeeCode, data, isMounted]);

    useEffect(() => {
        fetchAllData();
    }, [fetchAllData]);

    const todayDateFormatted = useMemo(() => formatDisplayDate(getTodayDateYYYYMMDD()), []);
    const currentMonthString = useMemo(() => getMonthString(), []);

    if (error) {
        return (
            <div className="bg-red-100 dark:bg-red-900/30 border-l-4 border-red-500 text-red-700 dark:text-red-300 p-4 rounded-md flex items-start space-x-3" role="alert">
                <AlertTriangleIcon className="w-6 h-6 flex-shrink-0" />
                <div><p className="font-bold">Error</p><p>{error}</p></div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100 mb-6">Today's Demand for {user.staffName}</h2>

            <MonthlyTargets user={user} productMetrics={productMetrics} />

            {loadingRunRate ? (
                <div className="flex justify-center items-center py-8"><LoaderIcon /></div>
            ) : demandRunRate && (demandRunRate.monthlyTargetAmount > 0 || demandRunRate.monthlyTargetAccount > 0) ? (
                <CollapsibleSection title="Daily Run Rate" icon={CalendarIcon} defaultOpen>
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            <SummaryCard
                                title="Monthly Target Amount"
                                value={formatCurrency(demandRunRate.monthlyTargetAmount)}
                                icon={<DollarSignIcon className="w-6 h-6" />}
                                color="text-indigo-500"
                            />
                            <SummaryCard
                                title="MTD Achievement Amount"
                                value={formatCurrency(demandRunRate.mtdAchievementAmount)}
                                icon={<DollarSignIcon className="w-6 h-6" />}
                                color="text-green-500"
                            />
                            <SummaryCard
                                title="Remaining Target Amount"
                                value={formatCurrency(demandRunRate.remainingTargetAmount)}
                                icon={<DollarSignIcon className="w-6 h-6" />}
                                color="text-red-500"
                            />
                            <SummaryCard
                                title="Daily Run Rate (Amt)"
                                value={formatCurrency(demandRunRate.dailyRunRateAmount)}
                                icon={<DollarSignIcon className="w-6 h-6" />}
                                color="text-blue-500"
                            />
                        </div>
                        <div className="mt-6 flex flex-wrap justify-around">
                            <RunRateBarChart 
                                monthlyTarget={demandRunRate.monthlyTargetAmount}
                                mtdAchievement={demandRunRate.mtdAchievementAmount}
                                dailyRunRate={demandRunRate.dailyRunRateAmount}
                                label="Amount"
                                unit="INR"
                            />
                            <RunRateBarChart 
                                monthlyTarget={demandRunRate.monthlyTargetAccount}
                                mtdAchievement={demandRunRate.mtdAchievementAccount}
                                dailyRunRate={demandRunRate.dailyRunRateAccount}
                                label="Accounts"
                                unit="Units"
                            />
                        </div>
                        <div className="mt-4 text-center text-sm text-gray-600 dark:text-gray-300">
                            Days Remaining in {currentMonthString}: <span className="font-semibold">{demandRunRate.daysRemainingInMonth}</span>
                        </div>
                    </div>
                </CollapsibleSection>
            ) : (
                <CollapsibleSection title="Daily Run Rate" icon={CalendarIcon}>
                    <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                        No targets or achievement data found for {currentMonthString} to calculate daily run rate.
                    </p>
                </CollapsibleSection>
            )}

            {user.role === 'manager' && user.branchName && (
                <TeamStatus manager={user} data={data} />
            )}

            <CollapsibleSection title={`Today's Demand (${todayDateFormatted})`} icon={FileTextIcon} defaultOpen>
                {loadingDemands ? (
                    <div className="flex justify-center items-center py-8"><LoaderIcon /></div>
                ) : demands.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                            <thead className="bg-gray-50 dark:bg-gray-700">
                                <tr>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Metric</th>
                                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Value</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Source</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                {demands.map(demand => (
                                    <tr key={demand.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-700 dark:text-gray-200">{demand.metric}</td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300 text-right">{demand.value.toLocaleString('en-IN')}</td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{demand.source}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                        No demand has been generated for you today.
                    </p>
                )}
            </CollapsibleSection>
        </div>
    );
};