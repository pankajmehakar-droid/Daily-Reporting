import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { User, ParsedCsvData, CsvRecord, ProductMetric, DailyAchievementRecord } from '../types';
import DataTable from '../components/DataTable';
import { FileDownIcon, FileTextIcon, Share2Icon } from '../components/icons';
import { getProductMetrics, getDailyAchievementRecords } from '../services/dataService'; // Import getDailyAchievementRecords
import { getTodayDateYYYYMMDD, convertYYYYMMDDtoDDMMYYYY, getMonthString } from '../utils/dateHelpers';

declare const XLSX: any;

interface ViewTodaysSubmittedReportPageProps {
  user: User;
  data: ParsedCsvData | null;
}

const getTodaysDateFormatted = () => {
    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const year = today.getFullYear();
    return `${day}/${month}/${year}`;
};

// Removed handleExport to let DataTable handle its own CSV export
const ViewTodaysSubmittedReportPage: React.FC<ViewTodaysSubmittedReportPageProps> = ({ user, data }) => {
    const todayYYYYMMDD = getTodayDateYYYYMMDD();
    const [startDateFilter, setStartDateFilter] = useState<string>(todayYYYYMMDD);
    const [endDateFilter, setEndDateFilter] = useState<string>(todayYYYYMMDD);
    const [productMetrics, setProductMetrics] = useState<ProductMetric[]>([]);
    const [allDailyRecords, setAllDailyRecords] = useState<DailyAchievementRecord[]>([]);
    const [loadingMetrics, setLoadingMetrics] = useState(true);
    const [shareOption, setShareOption] = useState<'filtered' | 'mtd'>('filtered');

    const isMounted = useRef(false);

    useEffect(() => {
      isMounted.current = true;
      return () => {
        isMounted.current = false;
      };
    }, []);

    const fetchMetaData = useCallback(async () => {
      setLoadingMetrics(true);
      try {
        const [metrics, records] = await Promise.all([
          getProductMetrics(),
          getDailyAchievementRecords(),
        ]);
        if (isMounted.current) {
          setProductMetrics(metrics);
          setAllDailyRecords(records);
        }
      } catch (err) {
        console.error("Failed to fetch product metrics or daily records:", err);
      } finally {
        if (isMounted.current) {
          setLoadingMetrics(false);
        }
      }
    }, [isMounted]);

    useEffect(() => {
      fetchMetaData();
    }, [fetchMetaData]);

    const filteredRecordsForTable = useMemo(() => {
        if (!allDailyRecords || allDailyRecords.length === 0) {
            return [];
        }

        const start = new Date(startDateFilter);
        const end = new Date(endDateFilter);
        end.setDate(end.getDate() + 1); // Include the end date fully

        let filtered = allDailyRecords.filter(record => {
            const recordDate = new Date(record.date);
            recordDate.setHours(0, 0, 0, 0); // Normalize to start of day
            
            return recordDate >= start && recordDate < end;
        });

        // Further filter for specific user if role is 'user'
        if (user.role === 'user') {
            filtered = filtered.filter(record => 
                String(record['STAFF NAME']).includes(user.staffName)
            );
        }
        // For managers, filter by their branch
        else if (user.role === 'manager' && user.branchName) {
            filtered = filtered.filter(record => 
                String(record['BRANCH NAME']).includes(user.branchName!)
            );
        }
        
        // Transform the date format for display in the table (from YYYY-MM-DD to DD/MM/YYYY)
        return filtered.map(record => ({
            ...record,
            'DATE': convertYYYYMMDDtoDDMMYYYY(record.date), // Convert date for display
        }));
    }, [allDailyRecords, startDateFilter, endDateFilter, user.role, user.staffName, user.branchName]);


    const handleShareOnWhatsApp = () => {
        let recordsToShare: DailyAchievementRecord[] = [];
        let reportTitle = '';
        let dateRangeText = '';

        if (shareOption === 'filtered') {
            const startDisplay = convertYYYYMMDDtoDDMMYYYY(startDateFilter);
            const endDisplay = convertYYYYMMDDtoDDMMYYYY(endDateFilter);

            if (startDateFilter === endDateFilter) {
                reportTitle = `Daily Report - ${startDisplay}`;
                dateRangeText = `*Date:* ${startDisplay}`;
            } else {
                reportTitle = `Report for ${startDisplay} to ${endDisplay}`;
                dateRangeText = `*Date Range:* ${startDisplay} to ${endDisplay}`;
            }
            // Use the already filtered records for table display
            recordsToShare = filteredRecordsForTable.map(r => ({
                ...r,
                date: r.date, // Keep original YYYY-MM-DD for consistency
                'DATE': convertYYYYMMDDtoDDMMYYYY(r.date), // For display in message if needed
            }));

        } else if (shareOption === 'mtd') {
            const currentMonthYYYYMM = getMonthString(); // YYYY-MM
            const [currentYear, currentMonthNum] = currentMonthYYYYMM.split('-');
            const firstDay = new Date(parseInt(currentYear), parseInt(currentMonthNum) - 1, 1);
            const lastDay = new Date(); // Up to today
            
            const firstDayDisplay = convertYYYYMMDDtoDDMMYYYY(`${currentYear}-${currentMonthNum}-01`);
            const lastDayDisplay = convertYYYYMMDDtoDDMMYYYY(getTodayDateYYYYMMDD());

            reportTitle = `MTD Report - ${getMonthString(new Date()).replace('-', '/')}`; // MM/YYYY
            dateRangeText = `*Period:* ${firstDayDisplay} to ${lastDayDisplay}`;

            recordsToShare = allDailyRecords.filter(record => {
                const recordDate = new Date(record.date);
                return recordDate >= firstDay && recordDate <= lastDay;
            });
            // Apply user scope filtering to MTD records as well
             if (user.role === 'user') {
                recordsToShare = recordsToShare.filter(record => 
                    String(record['STAFF NAME']).includes(user.staffName)
                );
            }
            else if (user.role === 'manager' && user.branchName) {
                recordsToShare = recordsToShare.filter(record => 
                    String(record['BRANCH NAME']).includes(user.branchName!)
                );
            }
        }

        if (recordsToShare.length === 0) {
            alert("No data available to share for the selected criteria.");
            return;
        }
        
        let totalAmount = 0;
        let totalAccounts = 0;
        const keyMetrics: { [key: string]: number } = {};

        recordsToShare.forEach(record => {
            totalAmount += (Number(record['GRAND TOTAL AMT']) || 0);
            totalAccounts += (Number(record['GRAND TOTAL AC']) || 0);

            // Aggregate key metrics (DDS, FD, New SS/Agents) from all records for today
            for (const metricName of ['DDS AMT', 'FD AC', 'NEW-SS/AGNT', 'SAVS-AMT']) { // Include more as needed
                const value = Number((record as any)[metricName]) || 0;
                keyMetrics[metricName] = (keyMetrics[metricName] || 0) + value;
            }
        });

        const staffScope = user.role === 'user' ? user.staffName : user.role === 'manager' ? `Team (${user.branchName})` : 'All Staff';

        let message = `*${reportTitle}*\n` +
                      `\n` +
                      `${dateRangeText}\n` +
                      `*Scope:* ${staffScope}\n` +
                      `\n` +
                      `*Summary:*\n` +
                      `Total Amount: ₹${totalAmount.toLocaleString('en-IN')}\n` +
                      `Total Accounts: ${totalAccounts.toLocaleString('en-IN')}\n`;
        
        const metricLines = Object.entries(keyMetrics)
            .filter(([, value]) => value > 0)
            .map(([metricName, value]) => {
                const metricDef = productMetrics.find(pm => pm.name === metricName);
                let unit = metricDef?.unitOfMeasure || '';
                // Specific overrides for commonly shared metrics
                if (metricName.includes('AMT')) unit = '₹';
                if (metricName.includes('AC')) unit = 'Units';
                if (metricName === 'NEW-SS/AGNT') unit = 'Units';
                
                return `${metricName}: ${unit}${value.toLocaleString('en-IN')}`;
            });

        if (metricLines.length > 0) {
            message += `\n*Key Metrics:*\n` + metricLines.join('\n');
        }

        message += `\n\n_Generated by Daily Reporting App_`;

        const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
        window.open(whatsappUrl, '_blank');
    };

    if (!data || loadingMetrics) {
        return (
            <div className="text-center py-20 px-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
                <h2 className="text-2xl font-semibold text-gray-700 dark:text-gray-200">Today's Submitted Report</h2>
                <p className="mt-2 text-gray-500 dark:text-gray-400">
                    {loadingMetrics ? 'Loading data...' : 'No data loaded. Please upload a report file via the Dashboard if you are an admin.'}
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100">Today's Submitted Report</h2>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
                <div className="flex items-center space-x-3 mb-4">
                    <FileTextIcon className="w-6 h-6 text-indigo-500" />
                    <h3 className="text-lg font-medium leading-6 text-gray-900 dark:text-gray-100">
                        Submissions by {user.role === 'user' ? 'You' : user.role === 'manager' && user.branchName ? `Your Team (${user.branchName})` : 'All Staff'}
                    </h3>
                </div>
                
                {/* Date Range Filters */}
                <div className="flex flex-col sm:flex-row items-center gap-4 mb-4">
                    <div className="flex-1 w-full">
                        <label htmlFor="startDate" className="label-style">Start Date</label>
                        <input
                            type="date"
                            id="startDate"
                            value={startDateFilter}
                            onChange={(e) => setStartDateFilter(e.target.value)}
                            className="mt-1 block w-full input-style"
                            aria-label="Start date filter"
                        />
                    </div>
                    <div className="flex-1 w-full">
                        <label htmlFor="endDate" className="label-style">End Date</label>
                        <input
                            type="date"
                            id="endDate"
                            value={endDateFilter}
                            onChange={(e) => setEndDateFilter(e.target.value)}
                            className="mt-1 block w-full input-style"
                            aria-label="End date filter"
                        />
                    </div>
                </div>

                {filteredRecordsForTable.length > 0 ? (
                    <>
                        <DataTable
                            title=""
                            // Headers should be derived dynamically from the transformed records, or fixed to relevant ones
                            headers={Object.keys(filteredRecordsForTable[0] || {}).filter(header => header !== 'id')}
                            records={filteredRecordsForTable}
                            exportFileName={`daily-report-${startDateFilter}-to-${endDateFilter}`} // Enable CSV export
                            action={null} // No additional custom actions needed, DataTable handles CSV export
                        />
                        <div className="flex flex-col sm:flex-row justify-end mt-4 gap-3">
                            <div>
                                <label htmlFor="shareOption" className="label-style sr-only">Share Option</label>
                                <select
                                    id="shareOption"
                                    value={shareOption}
                                    onChange={(e) => setShareOption(e.target.value as 'filtered' | 'mtd')}
                                    className="input-style w-full sm:w-auto"
                                    aria-label="Select report share option"
                                >
                                    <option value="filtered">Filtered Report</option>
                                    <option value="mtd">Month-to-Date Report</option>
                                </select>
                            </div>
                            <button
                                onClick={handleShareOnWhatsApp}
                                className="btn btn-green flex items-center gap-2"
                                aria-label="Share report on WhatsApp"
                            >
                                <Share2Icon className="w-5 h-5" /> Share Report on WhatsApp
                            </button>
                        </div>
                    </>
                ) : (
                    <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                        No reports submitted {user.role === 'user' ? 'by you' : user.role === 'manager' ? 'by your team' : ''} for the selected date range.
                    </p>
                )}
            </div>
        </div>
    );
};

export default ViewTodaysSubmittedReportPage;