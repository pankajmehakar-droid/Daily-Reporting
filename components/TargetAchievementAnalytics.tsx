import React, { useMemo, useEffect, useState, useRef, useCallback } from 'react';
import { ParsedCsvData, CsvRecord, User, DailyRunRateResult, Target, BranchTarget, ProductMetric, ProductWiseTargetVsAchievement } from '../types';
import CollapsibleSection from './CollapsibleSection';
import { TargetIcon, TrendingUpIcon, CalendarIcon, DollarSignIcon, HashIcon, LoaderIcon } from './icons';
import SummaryCard from './SummaryCard';
import {
  calculateDailyRunRateForUserScope,
  getUserScope,
  getAllTargets,
  getAllBranchTargets,
  getProductMetrics,
} from '../services/dataService';
import { getMonthString } from '../utils/dateHelpers';
import RunRateBarChart from './RunRateBarChart';

interface TargetAchievementAnalyticsProps {
  data: ParsedCsvData | null;
  user: User;
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
  const [demandRunRate, setDemandRunRate] = useState<DailyRunRateResult | null>(null);
  const [loadingRunRate, setLoadingRunRate] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [monthlyData, setMonthlyData] = useState<ProductWiseTargetVsAchievement[]>([]);
  const [loadingMonthlyData, setLoadingMonthlyData] = useState(true);

  const isMounted = useRef(false);
  const currentMonth = getMonthString();

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const fetchMonthlyTargetVsAchievement = useCallback(async () => {
    if (!data) { // Wait for achievement data from parent
        setLoadingMonthlyData(false);
        return;
    }

    setLoadingMonthlyData(true);
    setError(null);
    try {
      const { employeeCodes, branchNames } = await getUserScope(user);
      const [allStaffTargets, allBranchTargets, allProductMetrics] = await Promise.all([
        getAllTargets(),
        getAllBranchTargets(),
        getProductMetrics(),
      ]);

      if (!isMounted.current) return;

      // 1. Aggregate Targets for the scope
      const aggregatedTargets: { [metric: string]: number } = {};
      
      allStaffTargets
        .filter(t => t.period === currentMonth && t.periodType === 'monthly' && employeeCodes.has(t.staffEmployeeCode))
        .forEach(target => {
          aggregatedTargets[target.metric] = (aggregatedTargets[target.metric] || 0) + target.target;
        });
      
      allBranchTargets
        .filter(t => t.month === currentMonth && branchNames.has(t.branchName))
        .forEach(target => {
          aggregatedTargets[target.metric] = (aggregatedTargets[target.metric] || 0) + target.target;
        });

      // 2. Aggregate MTD Achievements from scoped data passed via props
      const mtdAchievements: { [metric: string]: number } = {};
      const mtdRecords = data.records.filter(r => {
        const dateStr = r['DATE'] as string; // dd/mm/yyyy
        if (!dateStr || !/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) return false;
        const [day, month, year] = dateStr.split('/').map(Number);
        const recordMonth = `${year}-${String(month).padStart(2, '0')}`;
        return recordMonth === currentMonth;
      });

      allProductMetrics.forEach(metric => {
        mtdAchievements[metric.name] = mtdRecords.reduce((sum, record) => sum + (Number(record[metric.name]) || 0), 0);
      });
      
      // 3. Combine into final data structure
      const productDataMap: { [product: string]: { amountTarget: number; amountAchieved: number; acTarget: number; acAchieved: number; } } = {};

      allProductMetrics.forEach(metric => {
        const category = metric.category;
        if (!productDataMap[category]) {
          productDataMap[category] = { amountTarget: 0, amountAchieved: 0, acTarget: 0, acAchieved: 0 };
        }
      });
      
      for (const metricName in aggregatedTargets) {
        const metricDef = allProductMetrics.find(pm => pm.name === metricName);
        if (metricDef) {
          const category = metricDef.category;
          if (productDataMap[category]) {
            if (metricDef.type === 'Amount') {
              productDataMap[category].amountTarget += aggregatedTargets[metricName];
            } else if (metricDef.type === 'Account' || metricDef.type === 'Other') {
              productDataMap[category].acTarget += aggregatedTargets[metricName];
            }
          }
        }
      }

      for (const metricName in mtdAchievements) {
        const metricDef = allProductMetrics.find(pm => pm.name === metricName);
        if (metricDef) {
          const category = metricDef.category;
           if (productDataMap[category]) {
            if (metricDef.type === 'Amount') {
              productDataMap[category].amountAchieved += mtdAchievements[metricName];
            } else if (metricDef.type === 'Account' || metricDef.type === 'Other') {
              productDataMap[category].acAchieved += mtdAchievements[metricName];
            }
          }
        }
      }

      const finalData = Object.keys(productDataMap)
        .map(product => {
          const d = productDataMap[product];
          return {
            product: product,
            ...d,
            amountPercentage: d.amountTarget > 0 ? (d.amountAchieved / d.amountTarget) * 100 : (d.amountAchieved > 0 ? 100 : 0),
            acPercentage: d.acTarget > 0 ? (d.acAchieved / d.acTarget) * 100 : (d.acAchieved > 0 ? 100 : 0),
          };
        })
        .filter(d => d.amountTarget > 0 || d.acTarget > 0 || d.amountAchieved > 0 || d.acAchieved > 0)
        .sort((a, b) => {
            if (a.product === 'GRAND TOTAL') return -1;
            if (b.product === 'GRAND TOTAL') return 1;
            return a.product.localeCompare(b.product);
        });
        
        if (isMounted.current) {
            setMonthlyData(finalData);
        }

    } catch (err) {
      console.error("Failed to fetch monthly target data:", err);
      if (isMounted.current) {
        setError(err instanceof Error ? err.message : 'Failed to load target vs achievement data.');
      }
    } finally {
        if (isMounted.current) {
            setLoadingMonthlyData(false);
        }
    }
  }, [user, data, currentMonth]);

  const fetchDailyRunRate = useCallback(async () => {
    const achievementRecords = data?.records as CsvRecord[] || [];

    if (!achievementRecords || !user.employeeCode) {
      setDemandRunRate(null);
      setLoadingRunRate(false);
      return;
    }

    setLoadingRunRate(true);
    setError(null);
    try {
      const result = await calculateDailyRunRateForUserScope(user, currentMonth, achievementRecords);
      if (isMounted.current) {
        setDemandRunRate(result);
      }
    } catch (err) {
      console.error("Failed to calculate daily run rate:", err);
      if (isMounted.current) {
        setError(err instanceof Error ? err.message : 'Failed to calculate daily run rate.');
      }
    } finally {
      if (isMounted.current) {
        setLoadingRunRate(false);
      }
    }
  }, [data, user, currentMonth, isMounted]);

  useEffect(() => {
    fetchMonthlyTargetVsAchievement();
    fetchDailyRunRate();
  }, [fetchMonthlyTargetVsAchievement, fetchDailyRunRate]);


  const renderTargetTable = () => {
    if (loadingMonthlyData) {
      return <div className="flex justify-center items-center py-8"><LoaderIcon className="w-6 h-6" /></div>;
    }
    if (error) {
       return <p className="text-center text-red-500 dark:text-red-400 py-4">{error}</p>
    }
    if (monthlyData.length === 0) {
      return <p className="text-center text-gray-500 dark:text-gray-400 py-4">No monthly targets have been set for your scope, or no achievements have been recorded this month.</p>;
    }
    return (
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
            {monthlyData.map(item => (
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
                <td className="td-style text-right">{item.acTarget.toLocaleString()}</td>
                <td className="td-style text-right">{item.acAchieved.toLocaleString()}</td>
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
    );
  };


  return (
    <CollapsibleSection title="Target vs. Achievement Analytics" icon={TargetIcon} defaultOpen>
      <div className="space-y-8">
        <div>
          <h4 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">This Month's Target vs. Achievement ({currentMonth})</h4>
          {renderTargetTable()}
        </div>

        {/* Current Month Daily Run Rate */}
        {loadingRunRate ? (
          <div className="flex justify-center items-center py-8"><LoaderIcon className="w-6 h-6" /></div>
        ) : demandRunRate && (demandRunRate.monthlyTargetAmount > 0 || demandRunRate.monthlyTargetAccount > 0) ? (
          <div>
            <h4 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Current Month Daily Run Rate ({currentMonth})</h4>
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
                No relevant targets or achievement data found for {currentMonth} to calculate daily run rate.
            </p>
        )}
      </div>
    </CollapsibleSection>
  );
};

export default TargetAchievementAnalytics;