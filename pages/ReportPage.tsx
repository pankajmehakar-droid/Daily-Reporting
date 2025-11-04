import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { ParsedCsvData, CsvRecord, StaffMember, Branch } from '../types';
import CollapsibleSection from '../components/CollapsibleSection';
import DataTable from '../components/DataTable';
import SummaryCard from '../components/SummaryCard';
import { AnalyticsIcon, FileDownIcon, CalendarIcon, DollarSignIcon, HashIcon, UsersIcon, OfficeBuildingIcon, SearchIcon, LoaderIcon } from '../components/icons';
import { getStaffData, getBranches } from '../services/dataService'; // Import necessary data services
import { getMonthString } from '../utils/dateHelpers';

// Declare XLSX from the script tag in index.html
declare const XLSX: any;

// Declare jsPDF and autoTable from the script tags in index.html
declare const jsPDF: any;
declare const autoTable: any;


interface ReportPageProps {
  data: ParsedCsvData | null;
}

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
        style: 'decimal',
        maximumFractionDigits: 0,
    }).format(value);
};

// Reverted handleExportCsv to its original standalone use, now DataTable handles its own CSV export
// with a more generic action prop.
const handleExportPdf = (tableId: string, fileName: string, title: string) => {
  const inputTable = document.getElementById(tableId);
  if (!inputTable) {
    alert("Table not found for PDF export.");
    return;
  }

  const doc = new jsPDF.jsPDF({
    orientation: 'landscape', // or 'portrait'
    unit: 'pt',
    format: 'a4',
  });

  doc.text(title, 40, 40); // Add a title to the PDF

  doc.autoTable({
    html: `#${tableId}`,
    startY: 60, // Start table below the title
    theme: 'striped', // or 'grid', 'plain'
    styles: {
      overflow: 'linebreak',
      fontSize: 8,
      cellPadding: 4,
    },
    headStyles: {
      fillColor: [79, 70, 229], // Indigo 600
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    margin: { top: 30 },
  });

  doc.save(`${fileName}.pdf`);
};


const ReportPage: React.FC<ReportPageProps> = ({ data }) => {
  const [allStaff, setAllStaff] = useState<StaffMember[]>([]);
  const [allBranches, setAllBranches] = useState<Branch[]>([]);
  const [loadingMetadata, setLoadingMetadata] = useState(true);
  const [metadataError, setMetadataError] = useState<string | null>(null);

  const isMounted = useRef(false);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const fetchMetadata = useCallback(async () => {
    setLoadingMetadata(true);
    try {
      const staffList = await getStaffData();
      const branchList = await getBranches();
      if (isMounted.current) {
        setAllStaff(staffList);
        setAllBranches(branchList);
      }
    } catch (err) {
      if (isMounted.current) {
        setMetadataError(err instanceof Error ? err.message : 'Failed to fetch staff and branch data.');
      }
    } finally {
      if (isMounted.current) {
        setLoadingMetadata(false);
      }
    }
  }, [isMounted]);

  useEffect(() => {
    fetchMetadata();
  }, [fetchMetadata]);

  const mtdReportData = useMemo(() => {
      if (!data) return { records: [], summary: null };
      
      let latestDate = new Date(0);
      data.records.forEach(record => {
        const dateStr = record['DATE'] as string;
        if (dateStr && /^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
            const [day, month, year] = dateStr.split('/').map(Number);
            const recordDate = new Date(year, month - 1, day);
            if (recordDate > latestDate) {
                latestDate = recordDate;
            }
        }
      });

      if (latestDate.getTime() === new Date(0).getTime()){
        return { records: [], summary: null };
      }

      const currentMonth = latestDate.getMonth();
      const currentYear = latestDate.getFullYear();

      const records = data.records.filter(record => {
        const dateStr = record['DATE'] as string;
        if (!dateStr || !/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) return false;

        const [day, month, year] = dateStr.split('/').map(Number);
        const recordDate = new Date(year, month - 1, day);
        
        return recordDate.getMonth() === currentMonth && recordDate.getFullYear() === currentYear;
      });
      
      const summary: { mtdTotalAmount: number; mtdTotalAc: number; mtdDdsAc: number; mtdFdAc: number; } = {
        mtdTotalAmount: records.reduce((sum, r) => sum + (Number(r['GRAND TOTAL AMT']) || 0), 0),
        mtdTotalAc: records.reduce((sum, r) => sum + (Number(r['GRAND TOTAL AC']) || 0), 0),
        mtdDdsAc: records.reduce((sum, r) => sum + (Number(r['DDS AC']) || 0), 0),
        mtdFdAc: records.reduce((sum, r) => sum + (Number(r['FD AC']) || 0), 0),
      };

      return { records, summary };
  }, [data]);

  const analyticsData = useMemo(() => {
    if (!data || data.records.length === 0) return null;
    
    const dailyTotals: { [date: string]: number } = {};
    data.records.forEach(record => {
      const date = record['DATE'] as string;
      const amount = record['GRAND TOTAL AMT'] as number;
      if (date && typeof amount === 'number') {
        dailyTotals[date] = (dailyTotals[date] || 0) + amount;
      }
    });
    const uniqueDays = Object.keys(dailyTotals).length;
    const averageDailyAmount = uniqueDays > 0 ? data.summary.totalAmount / uniqueDays : 0;
    
    return {
        totalAmount: data.summary.totalAmount,
        totalAc: data.summary.totalAc,
        averageDailyAmount,
        totalTransactions: data.records.length
    }
  }, [data]);

  // New: MTD Achievement by Staff Member
  const staffMtdAchievements = useMemo(() => {
    if (!mtdReportData.records || mtdReportData.records.length === 0 || allStaff.length === 0) return [];

    const achievementsMap = new Map<string, { staffName: string; employeeCode: string; mtdAmount: number; mtdAccounts: number; branchName: string; }>();

    allStaff.forEach(staff => {
      achievementsMap.set(staff.employeeCode, {
        staffName: staff.employeeName,
        employeeCode: staff.employeeCode,
        mtdAmount: 0,
        mtdAccounts: 0,
        branchName: staff.branchName,
      });
    });

    mtdReportData.records.forEach(record => {
      const staffName = record['STAFF NAME'] as string;
      const staffCode = allStaff.find(s => s.employeeName === staffName)?.employeeCode;
      
      if (staffCode && achievementsMap.has(staffCode)) {
        const current = achievementsMap.get(staffCode)!;
        current.mtdAmount += (Number(record['GRAND TOTAL AMT']) || 0);
        current.mtdAccounts += (Number(record['GRAND TOTAL AC']) || 0);
        achievementsMap.set(staffCode, current);
      }
    });

    return Array.from(achievementsMap.values()).filter(a => a.mtdAmount > 0 || a.mtdAccounts > 0);
  }, [mtdReportData.records, allStaff]);

  // New: MTD Achievement by Manager/Branch (for admin view)
  const managerMtdAchievements = useMemo(() => {
    if (!mtdReportData.records || mtdReportData.records.length === 0 || allBranches.length === 0) return [];

    const achievementsMap = new Map<string, { branchName: string; managerName: string; managerCode: string; mtdAmount: number; mtdAccounts: number; }>();

    allBranches.forEach(branch => {
      achievementsMap.set(branch.branchName, {
        branchName: branch.branchName,
        managerName: branch.branchManagerName,
        managerCode: branch.branchManagerCode,
        mtdAmount: 0,
        mtdAccounts: 0,
      });
    });

    mtdReportData.records.forEach(record => {
      const branchName = record['BRANCH NAME'] as string;
      if (branchName && achievementsMap.has(branchName)) {
        const current = achievementsMap.get(branchName)!;
        current.mtdAmount += (Number(record['GRAND TOTAL AMT']) || 0);
        current.mtdAccounts += (Number(record['GRAND TOTAL AC']) || 0);
        achievementsMap.set(branchName, current);
      }
    });

    return Array.from(achievementsMap.values()).filter(a => a.mtdAmount > 0 || a.mtdAccounts > 0);
  }, [mtdReportData.records, allBranches]);


  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100">Reports</h2>
      
      {!data ? (
         <div className="text-center py-20 px-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
            <p className="mt-2 text-gray-500 dark:text-gray-400">
            No data loaded. Please upload a report file via the Dashboard if you are an admin.
            </p>
        </div>
      ) : (
        <>
            <CollapsibleSection title="Analytics Summary" icon={AnalyticsIcon} defaultOpen>
                {analyticsData ? (
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            <SummaryCard title="Total Amount" value={formatCurrency(analyticsData.totalAmount)} icon={<DollarSignIcon />} color="text-green-500" />
                            <SummaryCard title="Total A/C" value={analyticsData.totalAc.toString()} icon={<HashIcon />} color="text-blue-500" />
                            <SummaryCard title="Avg. Daily Amount" value={formatCurrency(analyticsData.averageDailyAmount)} icon={<DollarSignIcon />} color="text-yellow-500" />
                            <SummaryCard title="Total Entries" value={analyticsData.totalTransactions.toString()} icon={<HashIcon />} color="text-purple-500" />
                        </div>
                    </div>
                ) : <p>No analytics to display.</p>}
            </CollapsibleSection>

            <CollapsibleSection title="Full Submitted Report" icon={FileDownIcon}>
                <DataTable
                    title="All Submitted Records"
                    headers={data.headers}
                    records={data.records}
                    tableId="full-submitted-report-table"
                    exportFileName="full-report" // Enable CSV export for this table
                    action={
                        <button
                            onClick={() => handleExportPdf('full-submitted-report-table', 'full-report', 'Full Submitted Report')}
                            className="flex items-center gap-2 px-3 py-1.5 bg-red-500 text-white text-sm font-semibold rounded-md shadow-sm hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                        >
                            <FileDownIcon className="w-4 h-4" />
                            Export PDF
                        </button>
                    }
                />
            </CollapsibleSection>

             <CollapsibleSection title="Month-to-Date (MTD) Report" icon={CalendarIcon}>
                {mtdReportData.summary ? (
                     <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                            <SummaryCard title="MTD Amount" value={formatCurrency(mtdReportData.summary.mtdTotalAmount)} icon={<DollarSignIcon />} color="text-green-500" />
                            <SummaryCard title="MTD A/C" value={mtdReportData.summary.mtdTotalAc.toString()} icon={<HashIcon />} color="text-blue-500" />
                            <SummaryCard title="MTD DDS A/C" value={mtdReportData.summary.mtdDdsAc.toString()} icon={<HashIcon />} color="text-orange-500" />
                            <SummaryCard title="MTD FD A/C" value={mtdReportData.summary.mtdFdAc.toString()} icon={<HashIcon />} color="text-purple-500" />
                        </div>
                         <DataTable
                            title="MTD Records"
                            headers={data.headers}
                            records={mtdReportData.records}
                            tableId="mtd-records-table"
                            exportFileName="mtd-report" // Enable CSV export for this table
                            action={
                                <button
                                    onClick={() => handleExportPdf('mtd-records-table', 'mtd-report', 'Month-to-Date Report')}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-red-500 text-white text-sm font-semibold rounded-md shadow-sm hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                                >
                                    <FileDownIcon className="w-4 h-4" />
                                    Export PDF
                                </button>
                            }
                        />
                    </div>
                ) : (
                    <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                        No data available for the current month.
                    </p>
                )}
            </CollapsibleSection>

            {/* New: Staff-wise MTD Achievement Report */}
            <CollapsibleSection title="Staff-wise MTD Achievement" icon={UsersIcon}>
                {loadingMetadata ? (
                    <div className="flex justify-center items-center py-8"><LoaderIcon className="w-6 h-6" /></div>
                ) : metadataError ? (
                    <p className="text-center text-red-500 dark:text-red-400 py-8">{metadataError}</p>
                ) : staffMtdAchievements.length > 0 ? (
                    <DataTable
                        title={`Staff-wise MTD Achievements for ${getMonthString()}`}
                        headers={['Staff Name', 'Employee Code', 'Branch Name', 'MTD Amount', 'MTD Accounts']}
                        records={staffMtdAchievements.map(s => ({
                            'Staff Name': s.staffName,
                            'Employee Code': s.employeeCode,
                            'Branch Name': s.branchName,
                            'MTD Amount': formatCurrency(s.mtdAmount),
                            'MTD Accounts': s.mtdAccounts.toLocaleString(),
                        }))}
                        tableId="staff-mtd-achievement-table"
                        exportFileName={`staff-mtd-report-${getMonthString()}`} // Enable CSV export
                        action={
                            <button
                                onClick={() => handleExportPdf('staff-mtd-achievement-table', `staff-mtd-report-${getMonthString()}`, `Staff-wise MTD Achievement - ${getMonthString()}`)}
                                className="flex items-center gap-2 px-3 py-1.5 bg-red-500 text-white text-sm font-semibold rounded-md shadow-sm hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                            >
                                <FileDownIcon className="w-4 h-4" />
                                Export PDF
                            </button>
                        }
                    />
                ) : (
                    <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                        No staff-wise MTD achievement data available for the current month.
                    </p>
                )}
            </CollapsibleSection>

            {/* New: Manager-wise/Branch-wise MTD Achievement Report (Admin only) */}
            <CollapsibleSection title="Branch-wise MTD Achievement" icon={OfficeBuildingIcon}>
                {loadingMetadata ? (
                    <div className="flex justify-center items-center py-8"><LoaderIcon className="w-6 h-6" /></div>
                ) : metadataError ? (
                    <p className="text-center text-red-500 dark:text-red-400 py-8">{metadataError}</p>
                ) : managerMtdAchievements.length > 0 ? (
                    <DataTable
                        title={`Branch-wise MTD Achievements for ${getMonthString()}`}
                        headers={['Branch Name', 'Branch Manager', 'Manager Emp Code', 'MTD Amount', 'MTD Accounts']}
                        records={managerMtdAchievements.map(m => ({
                            'Branch Name': m.branchName,
                            'Branch Manager': m.managerName,
                            'Manager Emp Code': m.managerCode,
                            'MTD Amount': formatCurrency(m.mtdAmount),
                            'MTD Accounts': m.mtdAccounts.toLocaleString(),
                        }))}
                        tableId="branch-mtd-achievement-table"
                        exportFileName={`branch-mtd-report-${getMonthString()}`} // Enable CSV export
                        action={
                            <button
                                onClick={() => handleExportPdf('branch-mtd-achievement-table', `branch-mtd-report-${getMonthString()}`, `Branch-wise MTD Achievement - ${getMonthString()}`)}
                                className="flex items-center gap-2 px-3 py-1.5 bg-red-500 text-white text-sm font-semibold rounded-md shadow-sm hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                            >
                                <FileDownIcon className="w-4 h-4" />
                                Export PDF
                            </button>
                        }
                    />
                ) : (
                    <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                        No branch-wise MTD achievement data available for the current month.
                    </p>
                )}
            </CollapsibleSection>
        </>
      )}
    </div>
  );
};

export default ReportPage;