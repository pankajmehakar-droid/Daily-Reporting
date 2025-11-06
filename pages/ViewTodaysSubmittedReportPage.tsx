import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { User, ParsedCsvData, CsvRecord, ProductMetric, DailyAchievementRecord, StaffMember, Branch, Designation } from '../types';
import DataTable from '../components/DataTable';
import { FileDownIcon, FileTextIcon, Share2Icon, SearchIcon, LoaderIcon, XIcon } from '../components/icons';
import { getProductMetrics, getDailyAchievementRecords, getAllStaff, getBranches, getRecursiveSubordinateInfo } from '../services/dataService';
import { getTodayDateYYYYMMDD, convertYYYYMMDDtoDDMMYYYY, getMonthString, convertDDMMYYYYtoYYYYMMDD } from '../utils/dateHelpers';

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

const ViewTodaysSubmittedReportPage: React.FC<ViewTodaysSubmittedReportPageProps> = ({ user, data }) => {
    const todayYYYYMMDD = getTodayDateYYYYMMDD();
    const [startDateFilter, setStartDateFilter] = useState<string>(todayYYYYMMDD);
    const [endDateFilter, setEndDateFilter] = useState<string>(todayYYYYMMDD);
    
    // New filter states
    const [selectedStaffFilter, setSelectedStaffFilter] = useState<string>('all'); // employeeCode
    const [selectedBranchFilter, setSelectedBranchFilter] = useState<string>('all'); // branchName
    const [selectedDesignationFilter, setSelectedDesignationFilter] = useState<string>('all'); // designation

    const [productMetrics, setProductMetrics] = useState<ProductMetric[]>([]);
    const [allDailyRecords, setAllDailyRecords] = useState<DailyAchievementRecord[]>([]);
    const [allStaffData, setAllStaffData] = useState<StaffMember[]>([]); // All staff for filter options
    const [allBranchesData, setAllBranchesData] = useState<Branch[]>([]); // All branches for filter options

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
        const [metrics, records, staffList, branchList] = await Promise.all([
          getProductMetrics(),
          getDailyAchievementRecords(),
          getAllStaff(),
          getBranches(),
        ]);
        if (isMounted.current) {
          setProductMetrics(metrics);
          setAllDailyRecords(records);
          setAllStaffData(staffList);
          setAllBranchesData(branchList);
        }
      } catch (err) {
        console.error("Failed to fetch metadata or daily records:", err);
      } finally {
        if (isMounted.current) {
          setLoadingMetrics(false);
        }
      }
    }, [isMounted]);

    useEffect(() => {
      fetchMetaData();
    }, [fetchMetaData]);

    // Determine staff in current user's scope for filters
    const staffInScope = useMemo(() => {
        if (!allStaffData) return [];

        if (user.role === 'admin') {
            return allStaffData;
        } else if (user.role === 'manager') {
            const managerStaffNode = allStaffData.find(s => s.id === user.id);
            if (!managerStaffNode) return [];

            const relevantEmployeeCodes = new Set<string>();
            if (managerStaffNode.employeeCode) relevantEmployeeCodes.add(managerStaffNode.employeeCode);

            const { employeeCodes: subCodes } = getRecursiveSubordinateInfo(managerStaffNode, allStaffData);
            subCodes.forEach(code => relevantEmployeeCodes.add(code));

            const relevantBranches = new Set<string>();
            if (managerStaffNode.branchName && managerStaffNode.branchName !== 'N/A') relevantBranches.add(managerStaffNode.branchName);
            if (managerStaffNode.managedBranches) managerStaffNode.managedBranches.forEach(b => relevantBranches.add(b));
            if (managerStaffNode.managedZones) {
                allBranchesData.filter(b => managerStaffNode.managedZones!.includes(b.zone)).forEach(b => relevantBranches.add(b.branchName));
            }

            return allStaffData.filter(s =>
                (s.employeeCode && relevantEmployeeCodes.has(s.employeeCode)) ||
                (s.branchName && relevantBranches.has(s.branchName))
            );
        } else { // user role
            return allStaffData.filter(s => s.id === user.id);
        }
    }, [user, allStaffData, allBranchesData]);

    // Filter options for dropdowns
    const availableStaffOptions = useMemo(() => {
        const options = staffInScope.map(s => ({ value: s.employeeCode, label: `${s.employeeName} (${s.employeeCode})` }));
        return [{ value: 'all', label: '-- All Staff --' }, ...options];
    }, [staffInScope]);

    const availableBranchOptions = useMemo(() => {
        const branchesInScope = new Set<string>();
        if (user.role === 'admin') {
            allBranchesData.forEach(b => branchesInScope.add(b.branchName));
        } else if (user.role === 'manager') {
            if (user.branchName && user.branchName !== 'N/A') branchesInScope.add(user.branchName);
            if (user.managedBranches) user.managedBranches.forEach(b => branchesInScope.add(b));
            if (user.managedZones) {
                allBranchesData.filter(b => user.managedZones!.includes(b.zone)).forEach(b => branchesInScope.add(b.branchName));
            }
            staffInScope.forEach(s => { // Also include branches where managed staff are located
              if(s.branchName && s.branchName !== 'N/A') branchesInScope.add(s.branchName);
            });
        } else { // user role
            if (user.branchName && user.branchName !== 'N/A') branchesInScope.add(user.branchName);
        }

        const options = Array.from(branchesInScope).sort().map(bName => ({ value: bName, label: bName }));
        return [{ value: 'all', label: '-- All Branches --' }, ...options];
    }, [user, allBranchesData, staffInScope]);

    const availableDesignationOptions = useMemo(() => {
        const designationsInScope = new Set<Designation>();
        staffInScope.forEach(s => designationsInScope.add(s.function));
        const options = Array.from(designationsInScope).sort().map(d => ({ value: d, label: d }));
        return [{ value: 'all', label: '-- All Designations --' }, ...options];
    }, [staffInScope]);


    const filteredRecordsForTable = useMemo(() => {
        if (!allDailyRecords || allDailyRecords.length === 0) {
            return [];
        }

        // Parse filter dates explicitly as local dates to avoid timezone issues
        const [startY, startM, startD] = startDateFilter.split('-').map(Number);
        const start = new Date(startY, startM - 1, startD);
        start.setHours(0, 0, 0, 0); // Normalize to local midnight

        const [endY, endM, endD] = endDateFilter.split('-').map(Number);
        const end = new Date(endY, endM - 1, endD);
        end.setHours(23, 59, 59, 999); // Normalize to end of day


        let filtered = allDailyRecords.filter(record => {
            // Parse record date explicitly as local date
            const [recordY, recordM, recordD] = record.date.split('-').map(Number);
            const recordDate = new Date(recordY, recordM - 1, recordD);
            recordDate.setHours(0, 0, 0, 0); // Normalize to local midnight
            
            return recordDate >= start && recordDate <= end;
        });

        // Apply user role scoping first (e.g., manager sees their team)
        const employeeCodesInScope = new Set(staffInScope.map(s => s.employeeCode));
        const branchNamesInScope = new Set(availableBranchOptions.filter(b => b.value !== 'all').map(b => b.value));
        
        filtered = filtered.filter(record => {
          const recordEmployeeCode = allStaffData.find(s => s.employeeName === record['STAFF NAME'])?.employeeCode;
          const recordBranchName = record['BRANCH NAME'];

          return (recordEmployeeCode && employeeCodesInScope.has(recordEmployeeCode)) ||
                 (recordBranchName && branchNamesInScope.has(recordBranchName));
        });


        // Apply additional dropdown filters
        if (selectedStaffFilter !== 'all') {
            const staffMember = allStaffData.find(s => s.employeeCode === selectedStaffFilter);
            if (staffMember) {
                filtered = filtered.filter(record => 
                    String(record['STAFF NAME']).includes(staffMember.employeeName)
                );
            }
        }

        if (selectedBranchFilter !== 'all') {
            filtered = filtered.filter(record => 
                String(record['BRANCH NAME']).includes(selectedBranchFilter)
            );
        }

        if (selectedDesignationFilter !== 'all') {
            filtered = filtered.filter(record => {
                const staffMember = allStaffData.find(s => s.employeeName === record['STAFF NAME']);
                return staffMember && staffMember.function === selectedDesignationFilter;
            });
        }
        
        // Transform the date format for display in the table (from YYYY-MM-DD to DD/MM/YYYY)
        return filtered.map(record => ({
            ...record,
            'DATE': convertYYYYMMDDtoDDMMYYYY(record.date), // Convert date for display
        }));
    }, [allDailyRecords, startDateFilter, endDateFilter, selectedStaffFilter, selectedBranchFilter, selectedDesignationFilter, user, allStaffData, staffInScope, availableBranchOptions]);


    const handleShareOnWhatsApp = () => {
        let recordsToShare: DailyAchievementRecord[] = [];
        let overallReportTitle = '';
        let overallDateRangeText = '';

        if (shareOption === 'filtered') {
            const startDisplay = convertYYYYMMDDtoDDMMYYYY(startDateFilter);
            const endDisplay = convertYYYYMMDDtoDDMMYYYY(endDateFilter);

            if (startDateFilter === endDateFilter) {
                overallReportTitle = `Daily Report - ${startDisplay}`;
                overallDateRangeText = `*Date:* ${startDisplay}`;
            } else {
                overallReportTitle = `Report for ${startDisplay} to ${endDisplay}`;
                overallDateRangeText = `*Date Range:* ${startDisplay} to ${endDisplay}`;
            }
            // FIX: Use convertDDMMYYYYtoYYYYMMDD when mapping back to the internal YYYY-MM-DD format
            recordsToShare = filteredRecordsForTable.map(r => ({ ...r, date: convertDDMMYYYYtoYYYYMMDD(r['DATE'] as string) })); // Revert display date to YYYY-MM-DD for consistency

        } else if (shareOption === 'mtd') {
            const currentMonthYYYYMM = getMonthString(); // YYYY-MM
            const [currentYear, currentMonthNum] = currentMonthYYYYMM.split('-');
            const firstDay = new Date(parseInt(currentYear), parseInt(currentMonthNum) - 1, 1);
            const lastDay = new Date(); // Up to today
            
            const firstDayDisplay = convertYYYYMMDDtoDDMMYYYY(`${currentYear}-${currentMonthNum}-01`);
            const lastDayDisplay = getTodayDateYYYYMMDD(); // Use YYYY-MM-DD for filter start/end

            overallReportTitle = `MTD Report - ${getMonthString(new Date()).replace('-', '/')}`; // MM/YYYY
            overallDateRangeText = `*Period:* ${firstDayDisplay} to ${convertYYYYMMDDtoDDMMYYYY(lastDayDisplay)}`;

            recordsToShare = allDailyRecords.filter(record => {
                const recordDate = new Date(record.date);
                recordDate.setHours(0,0,0,0);
                firstDay.setHours(0,0,0,0);
                lastDay.setHours(23,59,59,999);
                return recordDate >= firstDay && recordDate <= lastDay;
            });
            // Apply user scope filtering to MTD records as well
            const employeeCodesInScope = new Set(staffInScope.map(s => s.employeeCode));
            const branchNamesInScope = new Set(availableBranchOptions.filter(b => b.value !== 'all').map(b => b.value));
            
            recordsToShare = recordsToShare.filter(record => {
              const recordEmployeeCode = allStaffData.find(s => s.employeeName === record['STAFF NAME'])?.employeeCode;
              const recordBranchName = record['BRANCH NAME'];

              return (recordEmployeeCode && employeeCodesInScope.has(recordEmployeeCode)) ||
                     (recordBranchName && branchNamesInScope.has(recordBranchName));
            });
        }

        if (recordsToShare.length === 0) {
            alert("No data available to share for the selected criteria.");
            return;
        }

        // Helper to format numbers without decimals and with commas
        const formatShareNumber = (value: number) => value.toLocaleString('en-IN', { maximumFractionDigits: 0 });

        let message = `*${overallReportTitle}*\n` +
                      `${overallDateRangeText}\n\n`;

        let grandTotalAmountAllRecords = 0;
        let grandTotalAccountsAllRecords = 0;

        recordsToShare.forEach((record, index) => {
            const formattedDate = convertYYYYMMDDtoDDMMYYYY(record.date);
            const staffMember = allStaffData.find(s => s.employeeName === record['STAFF NAME']);
            const staffRoleLine = staffMember ? 
                (staffMember.function === 'BRANCH MANAGER' || staffMember.function === 'SENIOR BRANCH MANAGER' ? 
                `BM - ${staffMember.employeeName}` : `Staff - ${staffMember.employeeName}`) : 
                `Staff - ${record['STAFF NAME']}`;
            
            const recordBranchName = record['BRANCH NAME'] || 'N/A';

            // Aggregate totals for the overall summary
            const recordTotalAmount = Number(record['GRAND TOTAL AMT']) || 0;
            const recordTotalAccounts = Number(record['GRAND TOTAL AC']) || 0;
            grandTotalAmountAllRecords += recordTotalAmount;
            grandTotalAccountsAllRecords += recordTotalAccounts;

            const shareMetrics: { [key: string]: { amt: number; ac: number } } = {
                'SS': { amt: 0, ac: 0 },
                'CG': { amt: 0, ac: 0 },
                'CW': { amt: 0, ac: 0 },
                'DD': { amt: 0, ac: 0 },
                'RD': { amt: 0, ac: 0 },
                'SMBG': { amt: 0, ac: 0 },
                'FD': { amt: 0, ac: 0 },
                'DAM/MIS': { amt: 0, ac: 0 }, // Combined
                'INSU': { amt: 0, ac: 0 },
                'TASC': { amt: 0, ac: 0 },
                'SHARE': { amt: 0, ac: 0 },
                'NEW AGENT': { amt: 0, ac: 0 }, // New entry
            };

            const metricMapping: { [key: string]: string } = {
                'SAVS-AMT': 'SS', 'SAVS-AC': 'SS',
                'CUR-GOLD-AMT': 'CG', 'CUR-GOLD-AC': 'CG',
                'CUR-WEL-AMT': 'CW', 'CUR-WEL-AC': 'CW',
                'DDS AMT': 'DD', 'DDS AC': 'DD',
                'RD AMT': 'RD', 'RD AC': 'RD',
                'SMBG AMT': 'SMBG', 'SMBG AC': 'SMBG',
                'FD AMT': 'FD', 'FD AC': 'FD',
                'DAM AMT': 'DAM/MIS', 'DAM AC': 'DAM/MIS',
                'MIS AMT': 'DAM/MIS', 'MIS AC': 'DAM/MIS',
                'INSU AMT': 'INSU', 'INSU AC': 'INSU',
                'TASC AMT': 'TASC', 'TASC AC': 'TASC',
                'SHARE AMT': 'SHARE', 'SHARE AC': 'SHARE',
                'NEW-SS/AGNT': 'NEW AGENT', // Changed from 'SS'
            };

            // Iterate over the currentAchievement metrics to populate shareMetrics
            for (const fullMetricName of Object.keys(record)) {
                const shortCode = metricMapping[fullMetricName];
                if (shortCode) {
                    const value = Number(record[fullMetricName as keyof DailyAchievementRecord]) || 0;
                    if (fullMetricName.includes('AMT')) {
                        shareMetrics[shortCode].amt += value;
                    } else if (fullMetricName.includes('AC') || fullMetricName === 'NEW-SS/AGNT') {
                        shareMetrics[shortCode].ac += value;
                    }
                }
            }

            // Build the metric lines in the specified order
            const metricLines: string[] = [];
            const orderedShortCodes = ['SS', 'CG', 'CW', 'DD', 'RD', 'SMBG', 'FD', 'DAM/MIS', 'INSU', 'TASC', 'SHARE', 'NEW AGENT'];
            for (const code of orderedShortCodes) {
                const data = shareMetrics[code];
                if (code === 'NEW AGENT') {
                  // NEW AGENT is just an account count, no amount
                  metricLines.push(`NEW AGENT:- ${formatShareNumber(data.ac)}`);
                } else {
                  metricLines.push(`${code}:- ${formatShareNumber(data.amt)}/- AC:- ${formatShareNumber(data.ac)}`);
                }
            }

            message += `--------------------\n` +
                       `DAILY ACHIEVEMENT REPORT\n\n` +
                       `DATE: ${formattedDate}\n\n` +
                       `BRANCH: ${recordBranchName}\n` +
                       `${staffRoleLine}\n\n` +
                       `${metricLines.join('\n')}\n\n` +
                       `TOTAL AC:- ${formatShareNumber(recordTotalAccounts)}\n` +
                       `TOTAL AMT:- ${formatShareNumber(recordTotalAmount)}\n`;
        });

        // Add overall grand total at the end
        message += `\n--- OVERALL GRAND TOTAL ---\n` +
                   `TOTAL AC:- ${formatShareNumber(grandTotalAccountsAllRecords)}\n` +
                   `TOTAL AMT:- ${formatShareNumber(grandTotalAmountAllRecords)}\n\n` +
                   `_Generated by Daily Reporting App_`;

        const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
        window.open(whatsappUrl, '_blank');
    };

    const handleClearFilters = () => {
      setStartDateFilter(todayYYYYMMDD);
      setEndDateFilter(todayYYYYMMDD);
      setSelectedStaffFilter('all');
      setSelectedBranchFilter('all');
      setSelectedDesignationFilter('all');
    };


    if (!data || loadingMetrics) {
        return (
            <div className="text-center py-20 px-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
                <h2 className="text-2xl font-semibold text-gray-700 dark:text-gray-200">Today's Submitted Report</h2>
                <p className="mt-2 text-gray-500 dark:text-gray-400">
                    {loadingMetrics ? <LoaderIcon className="inline-block w-6 h-6 text-indigo-500 animate-spin mr-2" /> : 'No data loaded. Please upload a report file via the Dashboard if you are an admin.'}
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
                
                {/* Date Range & New Filters */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                    <div>
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
                    <div>
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
                    <div>
                        <label htmlFor="staff-filter" className="label-style">Staff Name</label>
                        <select
                            id="staff-filter"
                            value={selectedStaffFilter}
                            onChange={(e) => setSelectedStaffFilter(e.target.value)}
                            className="mt-1 block w-full input-style"
                            aria-label="Filter by staff name"
                        >
                            {availableStaffOptions.map(option => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="branch-filter" className="label-style">Branch Name</label>
                        <select
                            id="branch-filter"
                            value={selectedBranchFilter}
                            onChange={(e) => setSelectedBranchFilter(e.target.value)}
                            className="mt-1 block w-full input-style"
                            aria-label="Filter by branch name"
                        >
                            {availableBranchOptions.map(option => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="designation-filter" className="label-style">Designation</label>
                        <select
                            id="designation-filter"
                            value={selectedDesignationFilter}
                            onChange={(e) => setSelectedDesignationFilter(e.target.value)}
                            className="mt-1 block w-full input-style"
                            aria-label="Filter by designation"
                        >
                            {availableDesignationOptions.map(option => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex items-end">
                      <button 
                        onClick={handleClearFilters}
                        className="btn btn-secondary flex items-center justify-center gap-2 w-full"
                        aria-label="Clear all filters"
                      >
                        <XIcon className="w-4 h-4" /> Clear Filters
                      </button>
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
