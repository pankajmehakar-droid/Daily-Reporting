import React, { useMemo, useEffect, useState, useRef, useCallback } from 'react';
import { ParsedCsvData, CsvRecord, User, DemandRunRateResult } from '../types';
import CollapsibleSection from './CollapsibleSection';
import { TargetIcon, TrendingUpIcon, CalendarIcon, DollarSignIcon, HashIcon, LoaderIcon } from './icons';
import SummaryCard from './SummaryCard';
import { calculateDemandRunRateForSingleEntity, calculateDemandRunRateForOverall } from '../services/dataService';
import { getMonthString } from '../utils/dateHelpers';
// Fix: Import the specific BarChart component from its new dedicated file
import RunRateBarChart from './RunRateBarChart';

interface TargetAchievementAnalyticsProps {
  data: ParsedCsvData | null; // This 'data' object will contain the raw CsvRecords for run-rate calculation
  user: User; // Pass current user for role-based calculations
}

const formatCurrency = (value: number) => {
  if (isNaN(value)) return 'N/A';
  return new Intl.NumberFormat('en-IN', {
    style: 'decimal',
    maximumFractionDigits: 0,
  }).format(value);
};

const formatPercentage = (value: number) => {
  if (isNaN(value) || !isFinite(value)) return '0%';
  return `${value.toFixed(1)}%`;
};

const getProgressBarColor = (percentage: number) => {
    if (percentage >= 100) return 'bg-green-500';
    if (percentage >= 75) return 'bg-yellow-500';
    if (percentage >= 50) return 'bg-orange-500';
    return 'bg-red-500';
};

const TargetAchievementAnalytics: React.FC<TargetAchievementAnalyticsProps> = ({ data, user }) => {
  const [demandRunRate, setDemandRunRate] = useState<DemandRunRateResult | null>(null);
  const [loadingRunRate, setLoadingRunRate] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isMounted = useRef(false);

  const currentMonth = getMonthString();

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const fetchDemandRunRate = useCallback(async () => {
      // Ensure data.records is CsvRecord[] for run-rate calculation
      const achievementRecords = data?.records as CsvRecord[] || [];

      if (!achievementRecords || achievementRecords.length === 0 || !user.employeeCode) {
          setDemandRunRate(null);
          setLoadingRunRate(false);
          return;
      }

      setLoadingRunRate(true);
      setError(null);
      try {
          let result: DemandRunRateResult;
          if (user.role === 'admin') {
              result = await calculateDemandRunRateForOverall({
                  currentMonth: currentMonth,
                  achievementRecords: achievementRecords, // Pass raw records
              });
          } else if (user.role === 'manager' && user.branchName) {
              result = await calculateDemandRunRateForSingleEntity({
                  entityId: user.branchName,
                  isBranch: true,
                  currentMonth: currentMonth,
                  achievementRecords: achievementRecords, // Pass raw records
              });
          } else { // user role or no branch for manager
              result = await calculateDemandRunRateForSingleEntity({
                  entityId: user.employeeCode,
                  isBranch: false,
                  currentMonth: currentMonth,
                  achievementRecords: achievementRecords, // Pass raw records
              });
          }
          
          if (isMounted.current) {
              setDemandRunRate(result);
          }
      } catch (err) {
          console.error("Failed to calculate demand run rate:", err);
          if (isMounted.current) {
              setError(err instanceof Error ? err.message : 'Failed to calculate demand daily run rate.');
          }
      } finally {
          if (isMounted.current) {
              setLoadingRunRate(false);
          }
      }
  }, [data, user, currentMonth, isMounted]);

  useEffect(() => {
      fetchDemandRunRate();
  }, [fetchDemandRunRate]);

  const analyticsData = useMemo(() => {
    if (!data || !data.targets || !data.previousYearAchievement) {
      return null;
    }

    const { targets, previousYearAchievement, records } = data;

    // 1. Previous Year Data
    // Filter product keys more carefully to only include those relevant and not grand totals
    const targetKeys = Object.keys(targets).filter(key => 
        (key.endsWith('AMT') || key.endsWith('AC')) && 
        !key.includes('GRAND TOTAL') &&
        (key.includes('DDS') || key.includes('DAM') || key.includes('MIS') || key.includes('FD') || key.includes('RD') || key.includes('SMBG') || key.includes('CUR-GOLD') || key.includes('CUR-WEL') || key.includes('SAVS') || key.includes('NEW-SS/AGNT') || key.includes('INSU') || key.includes('TASC') || key.includes('SHARE'))
    );

    const products = Array.from(new Set(targetKeys.map(key => key.replace(/ AMT|-AMT| AC|-AC/g, ''))));
    
    const previousYearPerformance = products.map(product => {
      const amountTarget = Number(targets[`${product} AMT`] || targets[`${product}-AMT`] || 0);
      const amountAchieved = Number(previousYearAchievement[`${product} AMT`] || previousYearAchievement[`${product}-AMT`] || 0);
      const amountPercentage = amountTarget > 0 ? (amountAchieved / amountTarget) * 100 : 0;

      const acTarget = Number(targets[`${product} AC`] || targets[`${product}-AC`] || 0);
      const acAchieved = Number(previousYearAchievement[`${product} AC`] || previousYearAchievement[`${product}-AC`] || 0);
      const acPercentage = acTarget > 0 ? (acAchieved / acTarget) * 100 : 0;
      
      return {
        product,
        amountTarget,
        amountAchieved,
        amountPercentage,
        acTarget,
        acAchieved,
        acPercentage,
      };
    });

    // 2. Current Year (YTD) and Month (MTD) Data
    let latestDate = new Date(0);
    records.forEach(record => {
      const dateStr = record['DATE'] as string;
      if (dateStr && /^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
        const [day, month, year] = dateStr.split('/').map(Number);
        const recordDate = new Date(year, month - 1, day);
        if (recordDate > latestDate) {
          latestDate = recordDate;
        }
      }
    });

    if (latestDate.getTime() === new Date(0).getTime()) {
      return { previousYearPerformance, ytdAchievement: null, mtdAchievement: null };
    }

    const currentYear = latestDate.getFullYear();
    const currentMonthNum = latestDate.getMonth(); // 0-indexed
    
    const ytdRecords = records.filter(record => {
        const dateStr = record['DATE'] as string;
        if (!dateStr || !/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) return false;
        const [, , year] = dateStr.split('/').map(Number);
        return year === currentYear;
    });

    const mtdRecords = ytdRecords.filter(record => {
        const dateStr = record['DATE'] as string;
        const [, month] = dateStr.split('/').map(Number);
        return month - 1 === currentMonthNum;
    });

    const calculateTotals = (rec: CsvRecord[]) => ({
        totalAmount: rec.reduce((sum, r) => sum + (Number(r['GRAND TOTAL AMT']) || Number(r['TOTAL AMOUNTS']) || 0), 0),
        totalAc: rec.reduce((sum, r) => sum + (Number(r['GRAND TOTAL AC']) || Number(r['TOTAL ACCOUNTS']) || 0), 0),
    });

    const ytdAchievement = calculateTotals(ytdRecords);
    const mtdAchievement = calculateTotals(mtdRecords);

    return { previousYearPerformance, ytdAchievement, mtdAchievement };

  }, [data]);

  if (!analyticsData) {
    return (
       <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 text-center">
            <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">Target Analytics Not Available</h3>
            <p className="text-gray-500 dark:text-gray-400 mt-2">
              The uploaded file does not contain the required "TARGET" and "ACHIEVEMENT" summary rows for this analysis.
            </p>
      </div>
    );
  }
  
  const { previousYearPerformance, ytdAchievement, mtdAchievement } = analyticsData;

  return (
    <CollapsibleSection title="Target vs. Achievement Analytics" icon={TargetIcon} defaultOpen>
        <div className="space-y-8">
            {/* New: Current Month Demand Run Rate */}
            {loadingRunRate ? (
                <div className="flex justify-center items-center py-8"><LoaderIcon className="w-6 h-6" /></div>
            ) : demandRunRate && (demandRunRate.monthlyTargetAmount > 0 || demandRunRate.monthlyTargetAccount > 0) ? (
                <div>
                    <h4 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Current Month Demand Run Rate ({currentMonth})</h4>
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
                        Days Remaining in {currentMonth}: <span className="font-semibold">{demandRunRate.daysRemainingInMonth}</span>
                    </div>
                </div>
            ) : (
                <p className="text-center text-gray-500 dark:text-gray-400 py-4">
                    No relevant targets or achievement data found for {currentMonth} to calculate demand run rate.
                </p>
            )}

            {/* Previous Year */}
            <div>
                <h4 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Previous Year Performance (from uploaded CSV)</h4>
                 <div className="overflow-x-auto bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-100 dark:bg-gray-700">
                            <tr>
                                <th className="th-style">Product</th>
                                <th className="th-style text-right">Amount Target</th>
                                <th className="th-style text-right">Amount Achieved</th>
                                <th className="th-style w-[150px]">Amount %</th>
                                <th className="th-style text-right">A/C Target</th>
                                <th className="th-style text-right">A/C Achieved</th>
                                <th className="th-style w-[150px]">A/C %</th>
                            </tr>
                        </thead>
                         <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                             {previousYearPerformance.map(item => (
                                <tr key={item.product}>
                                    <td className="td-style font-medium">{item.product}</td>
                                    <td className="td-style text-right">{formatCurrency(item.amountTarget)}</td>
                                    <td className="td-style text-right">{formatCurrency(item.amountAchieved)}</td>
                                    <td className="td-style">
                                        <div className="flex items-center gap-2">
                                            <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2.5">
                                                <div className={`${getProgressBarColor(item.amountPercentage)} h-2.5 rounded-full`} style={{ width: `${Math.min(item.amountPercentage, 100)}%` }}></div>
                                            </div>
                                            <span className="text-xs font-semibold w-12 text-right">{formatPercentage(item.amountPercentage)}</span>
                                        </div>
                                    </td>
                                    <td className="td-style text-right">{item.acTarget}</td>
                                    <td className="td-style text-right">{item.acAchieved}</td>
                                     <td className="td-style">
                                        <div className="flex items-center gap-2">
                                            <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2.5">
                                                 <div className={`${getProgressBarColor(item.acPercentage)} h-2.5 rounded-full`} style={{ width: `${Math.min(item.acPercentage, 100)}%` }}></div>
                                            </div>
                                            <span className="text-xs font-semibold w-12 text-right">{formatPercentage(item.acPercentage)}</span>
                                        </div>
                                    </td>
                                </tr>
                             ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* This Year */}
            <div>
                 <h4 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">This Year's Achievement (from uploaded CSV)</h4>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {ytdAchievement && <SummaryCard title="Year-to-Date (YTD) Amount" value={formatCurrency(ytdAchievement.totalAmount)} icon={<TrendingUpIcon />} color="text-indigo-500" />}
                    {mtdAchievement && <SummaryCard title="Month-to-Date (MTD) Amount" value={formatCurrency(mtdAchievement.totalAmount)} icon={<CalendarIcon />} color="text-purple-500" />}
                    {ytdAchievement && <SummaryCard title="Year-to-Date (YTD) A/C" value={ytdAchievement.totalAc.toString()} icon={<HashIcon />} color="text-indigo-500" />}
                    {mtdAchievement && <SummaryCard title="Month-to-Date (MTD) A/C" value={mtdAchievement.totalAc.toString()} icon={<HashIcon />} color="text-purple-500" />}
                 </div>
            </div>
        </div>
    </CollapsibleSection>
  );
};

export default TargetAchievementAnalytics;