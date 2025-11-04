
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { User, Projection, StaffMember, PROJECTION_DEMAND_METRIC_NAMES } from '../types';
import CollapsibleSection from '../components/CollapsibleSection';
import DataTable from '../components/DataTable';
import SummaryCard from '../components/SummaryCard';
import { LoaderIcon, DollarSignIcon, HashIcon, UsersIcon, CalendarIcon, FileDownIcon, AlertTriangleIcon, SearchIcon } from '../components/icons';
import { getAllProjections, getAllStaff, getRecursiveSubordinateInfo } from '../services/dataService';
import { getMonthString, getDateRangeFromRecords, formatDisplayDate, convertYYYYMMDDtoDDMMYYYY } from '../utils/dateHelpers';

// Declare jsPDF and autoTable from the script tags in index.html
declare const jsPDF: any;
declare const autoTable: any;

interface ProjectionReportPageProps {
  currentUser: User;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'decimal',
    maximumFractionDigits: 0,
  }).format(value);
};

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

const ProjectionReportPage: React.FC<ProjectionReportPageProps> = ({ currentUser }) => {
  const [allProjections, setAllProjections] = useState<Projection[]>([]);
  const [allStaff, setAllStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter states
  const [startDateFilter, setStartDateFilter] = useState<string>(''); // YYYY-MM-DD
  const [endDateFilter, setEndDateFilter] = useState<string>('');   // YYYY-MM-DD
  const [selectedStaffFilter, setSelectedStaffFilter] = useState<string>('all'); // 'all' or staff.id

  const isMounted = useRef(false);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const fetchInitialData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [projections, staffList] = await Promise.all([
        getAllProjections(),
        getAllStaff(),
      ]);
      if (!isMounted.current) return;

      setAllProjections(projections);
      setAllStaff(staffList);

      // Initialize date filters
      if (projections.length > 0) {
        // Transform projections to CsvRecord-like structure for getDateRangeFromRecords
        const tempRecords = projections.map(p => ({
          'DATE': convertYYYYMMDDtoDDMMYYYY(p.date), // Needs DD/MM/YYYY
          'VALUE': p.value,
        }));
        const { earliest, latest } = getDateRangeFromRecords(tempRecords);
        setStartDateFilter(earliest);
        setEndDateFilter(latest);
      }
    } catch (err) {
      if (isMounted.current) {
        setError(err instanceof Error ? err.message : 'Failed to fetch projection data.');
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  }, [isMounted]);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  // Filter staff based on currentUser's scope
  const accessibleStaff = useMemo(() => {
    if (currentUser.role === 'admin') {
      return allStaff; // Admin sees all staff
    } else if (currentUser.role === 'manager') {
      const managerStaffNode = allStaff.find(s => s.id === currentUser.id);
      if (!managerStaffNode) return [];

      const relevantEmployeeCodes = new Set<string>();
      if (managerStaffNode.employeeCode) relevantEmployeeCodes.add(managerStaffNode.employeeCode);

      // Get all subordinates (direct and indirect) using the utility function
      const { employeeCodes: subCodes } = getRecursiveSubordinateInfo(managerStaffNode, allStaff);
      subCodes.forEach(code => relevantEmployeeCodes.add(code));
      
      return allStaff.filter(s => relevantEmployeeCodes.has(s.employeeCode));
    }
    // Regular user only sees themselves
    return allStaff.filter(s => s.id === currentUser.id);
  }, [allStaff, currentUser]);

  const filteredProjections = useMemo(() => {
    let filtered = allProjections;

    // Apply date range filter
    const start = startDateFilter ? new Date(startDateFilter) : null;
    const end = endDateFilter ? new Date(endDateFilter) : null;
    if (start || end) {
      filtered = filtered.filter(p => {
        const projectionDate = new Date(p.date);
        projectionDate.setHours(0, 0, 0, 0);
        const isAfterStart = !start || projectionDate >= start;
        const isBeforeEnd = !end || projectionDate <= end;
        return isAfterStart && isBeforeEnd;
      });
    }

    // Apply staff filter (from accessible staff)
    if (selectedStaffFilter !== 'all') {
      const targetStaff = accessibleStaff.find(s => s.id === selectedStaffFilter);
      if (targetStaff) {
        filtered = filtered.filter(p => p.staffEmployeeCode === targetStaff.employeeCode);
      }
    } else {
        // If 'all' staff is selected, ensure we only show projections for accessible staff
        const accessibleEmployeeCodes = new Set(accessibleStaff.map(s => s.employeeCode));
        filtered = filtered.filter(p => accessibleEmployeeCodes.has(p.staffEmployeeCode));
    }

    // Add staff names to projections for display in DataTable
    return filtered.map(p => {
      const staff = allStaff.find(s => s.employeeCode === p.staffEmployeeCode);
      return {
        ...p,
        'Staff Name': staff?.employeeName || 'N/A',
        'Employee Code': p.staffEmployeeCode,
        'Metric': p.metric,
        'Projected Value': p.value,
        'Date': formatDisplayDate(p.date), // Format date for display
      };
    }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()); // Sort by date
  }, [allProjections, startDateFilter, endDateFilter, selectedStaffFilter, accessibleStaff, allStaff]);

  const projectionAnalytics = useMemo(() => {
    if (filteredProjections.length === 0) return null;

    let totalProjectedAmount = 0;
    let totalProjectedAccounts = 0;
    const dailyProjectedAmounts: { [date: string]: number } = {};

    filteredProjections.forEach(p => {
      const metricDef = PROJECTION_DEMAND_METRIC_NAMES.find(m => m === p.metric);
      if (metricDef) {
        if (metricDef.includes('AMT')) {
          totalProjectedAmount += p.value;
        } else if (metricDef.includes('AC') || metricDef === 'NEW-SS/AGNT') {
          totalProjectedAccounts += p.value;
        }
      }
      
      // For average daily calculation (use original YYYY-MM-DD date)
      const dateKey = p.date; // Use YYYY-MM-DD for aggregation
      const value = PROJECTION_DEMAND_METRIC_NAMES.some(m => m.includes('AMT') && m === p.metric) ? p.value : 0; // Only sum amounts
      dailyProjectedAmounts[dateKey] = (dailyProjectedAmounts[dateKey] || 0) + value;
    });

    const uniqueDays = Object.keys(dailyProjectedAmounts).length;
    const averageDailyProjectionAmount = uniqueDays > 0 ? totalProjectedAmount / uniqueDays : 0;

    return {
      totalProjectedAmount,
      totalProjectedAccounts,
      averageDailyProjectionAmount,
      totalEntries: filteredProjections.length,
    };
  }, [filteredProjections]);


  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100">Projection Report</h2>

      {error && (
        <div className="bg-red-100 dark:bg-red-900/30 border-l-4 border-red-500 text-red-700 dark:text-red-300 p-4 rounded-md flex items-start space-x-3" role="alert">
          <AlertTriangleIcon className="w-6 h-6 flex-shrink-0" />
          <div><p className="font-bold">Error</p><p>{error}</p></div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center py-20">
          <LoaderIcon className="w-8 h-8 text-indigo-500" />
        </div>
      ) : (
        <>
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
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
                <label htmlFor="staff-filter" className="label-style">Filter by Staff Member</label>
                <select
                  id="staff-filter"
                  className="mt-1 block w-full input-style"
                  onChange={(e) => setSelectedStaffFilter(e.target.value)}
                  value={selectedStaffFilter}
                  disabled={accessibleStaff.length === 0}
                >
                  <option value="all">-- All Accessible Staff --</option>
                  {accessibleStaff.map(s => (
                    <option key={s.id} value={s.id}>{s.employeeName} ({s.employeeCode})</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <CollapsibleSection title="Projection Summary" icon={CalendarIcon} defaultOpen>
            {projectionAnalytics ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <SummaryCard title="Total Projected Amount" value={formatCurrency(projectionAnalytics.totalProjectedAmount)} icon={<DollarSignIcon />} color="text-green-500" />
                  <SummaryCard title="Total Projected Accounts" value={projectionAnalytics.totalProjectedAccounts.toLocaleString()} icon={<HashIcon />} color="text-blue-500" />
                  <SummaryCard title="Avg. Daily Projection (Amt)" value={formatCurrency(projectionAnalytics.averageDailyProjectionAmount)} icon={<DollarSignIcon />} color="text-yellow-500" />
                  <SummaryCard title="Total Projection Entries" value={projectionAnalytics.totalEntries.toLocaleString()} icon={<UsersIcon />} color="text-purple-500" />
                </div>
              </div>
            ) : (
              <p className="text-center text-gray-500 dark:text-gray-400 py-8">No projection data to display for the current filters.</p>
            )}
          </CollapsibleSection>

          <CollapsibleSection title="Detailed Projection Records" icon={FileDownIcon}>
            {filteredProjections.length > 0 ? (
              <DataTable
                title="Filtered Projection Records"
                headers={['Date', 'Staff Name', 'Employee Code', 'Metric', 'Projected Value']}
                records={filteredProjections.map(p => ({
                    'Date': p['Date'], // Already formatted
                    'Staff Name': p['Staff Name'],
                    'Employee Code': p['Employee Code'],
                    'Metric': p['Metric'],
                    'Projected Value': formatCurrency(p['Projected Value']),
                }))}
                tableId="projection-report-table"
                exportFileName="projection-report"
                action={
                    <button
                        onClick={() => handleExportPdf('projection-report-table', 'projection-report', 'Projection Report')}
                        className="flex items-center gap-2 px-3 py-1.5 bg-red-500 text-white text-sm font-semibold rounded-md shadow-sm hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                    >
                        <FileDownIcon className="w-4 h-4" />
                        Export PDF
                    </button>
                }
              />
            ) : (
              <p className="text-center text-gray-500 dark:text-gray-400 py-8">No detailed projection records found for the current filters.</p>
            )}
          </CollapsibleSection>
        </>
      )}
    </div>
  );
};

export default ProjectionReportPage;
    