import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { User, ParsedCsvData, CsvRecord, MtdData, Kra, ProductMetric, DailyAchievementRecord, StaffMember, Branch, Projection, Demand, BranchTarget, DetailedMonthlyTargets } from '../types';
import { parseCsvData } from '../services/csvParser';
import { csvData } from '../data';
import { getStaffData, getBranches, getAllKras, getAllProjections, getAllDemands, getAllBranchTargets, getProductMetrics, getDailyAchievementRecords, transformDailyAchievementsToParsedCsvData, calculateDemandRunRateForUserScope, getDetailedMonthlyTargetsForUserScope, getRecursiveSubordinateInfo } from '../services/dataService'; // Added getKrasForStaff, getProductMetrics, getDailyAchievementRecords, transformDailyAchievementsToParsedCsvData, and new global getters
import { login, MOCK_PASSWORDS } from '../services/authService';
import { getMonthString, convertYYYYMMDDtoDDMMYYYY, getTodayDateYYYYMMDD } from '../utils/dateHelpers'; // Import from new utility


import Header from '../components/Header';
import LeftPanel from '../components/LeftPanel';
import SummaryCard from '../components/SummaryCard';
import DataTable from '../components/DataTable';
import FileUploadButton from '../components/FileUploadButton';
import BarChart from '../components/BarChart';
import PieChart from '../components/PieChart';
import SubmitDailyAchievementPage from './SubmitDailyAchievementPage'; // New Import
import SubmitProjectionPage from './SubmitProjectionPage'; // New Import
import { ViewTodaysDemandPage } from './ViewTodaysDemandPage'; // New Import
import AnalyticsPage from './AnalyticsPage';
import ReportPage from './ReportPage';
import ProjectionReportPage from './ProjectionReportPage'; // New Import
import ViewTodaysSubmittedReportPage from './ViewTodaysSubmittedReportPage'; // New Import
import SettingsPage from './SettingsPage';
import { BranchManagementPage } from './BranchManagementPage'; // FIX: Changed import to named export
// FIX: Changed import to named export for StaffManagementPage
import { StaffManagementPage } from './StaffManagementPage';
// FIX: Corrected import of KraMappingPage to be a default export
import { KraMappingPage } from './KraMappingPage'; // FIX: Changed import to named export
import ProductSettingsPage from './ProductSettingsPage';
// FIX: Changed import to named export for ManagerAssignmentsPage
import { ManagerAssignmentsPage } from './ManagerAssignmentsPage';
import StaffAssignmentsPage from './StaffAssignmentsPage';
import ProfileSettingsPage from './ProfileSettingsPage'; // New Import
import BranchTargetMappingPage from './BranchTargetMappingPage'; // New Import
import ZoneManagementPage from './ZoneManagementPage'; // New Import
import RegionManagementPage from './RegionManagementPage'; // CORRECTED PATH
import DistrictManagementPage from './DistrictManagementPage'; // CORRECTED PATH
import { UserManagementPage } from './UserManagementPage'; // FIX: Changed import to named export
import DesignationKraSettingsPage from './DesignationKraSettingsPage'; // New page
import TargetAchievementAnalytics from '../components/TargetAchievementAnalytics'; // New component

// FIX: Declare XLSX from the global scope (assuming it's loaded via script tag in index.html)
declare const XLSX: any;

type ActivePage = 'dashboard' | 'dailytask_achievement' | 'dailytask_projection' | 'dailytask_demand' | 'analytics' | 'reports_full' | 'reports_today_submitted' | 'reports_projection' | 'settings' | 'usermanagement' | 'branchmanagement' | 'staffmanagement' | 'kramapping' | 'productsettings' | 'managerassignments' | 'staffassignments' | 'profilesettings' | 'admin_target_branch' | 'zonemanagement' | 'regionmanagement' | 'districtmanagement' | 'designationkrasettings';


interface DashboardPageProps {
  user: User;
  onLogout: () => void;
  onUserUpdate: (user: User) => void;
}

// Dashboard content component - MOVED OUTSIDE DashboardPage
interface DashboardContentProps {
    currentUser: User;
    parsedCsvData: ParsedCsvData | null; // Renamed to avoid collision with prop 'data'
    mtdData: DetailedMonthlyTargets;
    loading: boolean; // Added loading prop
    error: string | null; // Added error prop
    refreshDashboardData: () => void; // Added refresh callback
}

const DashboardContent: React.FC<DashboardContentProps> = ({ currentUser, parsedCsvData, mtdData, loading: isDashboardLoading, error }) => {
    // Helper for formatting currency
    const formatCurrency = (value: number) => {
      return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(value);
    };
  
    const formatNumber = (value: number) => {
      return new Intl.NumberFormat('en-IN', {
        maximumFractionDigits: 0,
      }).format(value);
    };

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100">Dashboard</h2>
            
            {error && (
                <div className="bg-red-100 dark:bg-red-900/30 border-l-4 border-red-500 text-red-700 dark:text-red-300 p-4 rounded-md flex items-start space-x-3" role="alert">
                    <svg className="h-6 w-6 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm-7-9a1 1 0 000 2h14a1 1 0 100-2H3z" clipRule="evenodd"></path></svg>
                    <div><p className="font-bold">Error</p><p>{error}</p></div>
                </div>
            )}

            {isDashboardLoading ? (
                <div className="flex justify-center items-center py-20">
                    <svg className="animate-spin h-8 w-8 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                </div>
            ) : (
                <>
                    {/* New: MTD Summary Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <SummaryCard 
                            title="MTD Total Amount"
                            value={formatCurrency(mtdData.totalAmount)} 
                            icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c1.621 0 3.242.825 4.148 2.302A.987.987 0 0017 11v1a1 1 0 001 1h1a1 1 0 001-1v-1a4 4 0 00-4-4h-2a4 4 0 00-4 4v1a1 1 0 001 1h1a1 1 0 001-1v-1a.987.987 0 00.852-.698A4.015 4.015 0 0012 8zM3 21h18M3 11V5a2 2 0 012-2h14a2 2 0 012 2v6"/></svg>} 
                            color="text-green-500" 
                        />
                        <SummaryCard 
                            title="MTD Total Accounts"
                            value={formatNumber(mtdData.totalAc)} 
                            icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354l-7.793 7.793a1 1 0 00-.293.707V20a2 2 0 002 2h4a2 2 0 002-2v-6h4v6a2 2 0 002 2h4a2 4 0 002-2v-7.146a1 1 0 00-.293-.707L12 4.354zM20 12h-4v-2a2 2 0 00-2-2H8a2 2 0 00-2 2v2H4"/></svg>} 
                            color="text-blue-500" 
                        />
                        <SummaryCard 
                            title="MTD DDS Accounts"
                            value={formatNumber(mtdData.ddsAc)} 
                            icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>} 
                            color="text-orange-500" 
                        />
                        <SummaryCard 
                            title="MTD FD Accounts"
                            value={formatNumber(mtdData.fdAc)} 
                            icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15 13l-3 3m0 0l-3-3m3 3V8m0 8h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>} 
                            color="text-purple-500" 
                        />
                    </div>
                    {/* Target Achievement Analytics */}
                    <TargetAchievementAnalytics data={parsedCsvData} user={currentUser} />
                </>
            )}

            {/* If data exists, show data table, otherwise prompt for upload */}
            {!parsedCsvData || parsedCsvData.records.length === 0 ? (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 text-center">
                    <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">No Data Available</h3>
                    <p className="text-gray-500 dark:text-gray-400 mt-2">
                        Please upload your daily report file to view data, or check "Today's Submitted Report" for your personal/team submissions.
                    </p>
                </div>
            ) : null}
        </div>
    );
};


const DashboardPage: React.FC<DashboardPageProps> = ({ user, onLogout, onUserUpdate }) => {
  const [activePage, setActivePage] = useState<ActivePage>('dashboard');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [parsedCsvData, setParsedCsvData] = useState<ParsedCsvData | null>(null);
  const [fileName, setFileName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mtdData, setMtdData] = useState<DetailedMonthlyTargets>({
      totalAmount: 0,
      totalAc: 0,
      ddsAc: 0,
      fdAc: 0,
  });


  const isMounted = useRef(false);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const handleMenuToggle = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const handleNavigate = (page: ActivePage) => {
    setActivePage(page);
    setIsMenuOpen(false); // Close menu on navigation
  };

  const processFile = useCallback(async (file: File) => {
    setLoading(true);
    setError(null);
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const csv = XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName]);
        
        if (isMounted.current) {
            const parsedData = parseCsvData(csv);
            setParsedCsvData(parsedData);
            setError(null);
        }
      } catch (err: any) {
        if (isMounted.current) {
            setError(err.message || 'Failed to process file.');
            setParsedCsvData(null); // Clear any old data
        }
      } finally {
        if (isMounted.current) {
            setLoading(false);
        }
      }
    };
    reader.onerror = () => {
        if (isMounted.current) {
            setError('Failed to read file.');
            setLoading(false);
            setParsedCsvData(null);
        }
    };
    reader.readAsArrayBuffer(file);
  }, [isMounted]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      processFile(file);
    }
    event.target.value = ''; // Clear input to allow re-uploading the same file
  };

  // New function to refresh data for MTD calculation on dashboard
  const refreshDashboardData = useCallback(async () => {
    setLoading(true); // Indicate loading for dashboard data refresh
    setError(null); // Clear previous errors
    const currentMonth = getMonthString();
    try {
        const allRecords = await getDailyAchievementRecords();
        const parsedAllRecords = transformDailyAchievementsToParsedCsvData(allRecords);
        
        const detailedMtd = await getDetailedMonthlyTargetsForUserScope(user, currentMonth);

        if (isMounted.current) {
          setParsedCsvData(parsedAllRecords); // Set the parsed data from actual records for analytics/reports
          setMtdData(detailedMtd);
        }
    } catch (err) {
        if (isMounted.current) {
            setError(err instanceof Error ? err.message : 'Failed to refresh dashboard data.');
        }
    } finally {
        if (isMounted.current) {
            setLoading(false);
        }
    }
  }, [user, isMounted]);

  useEffect(() => {
      refreshDashboardData();
  }, [refreshDashboardData]);


    
  const pagesMap = useMemo(() => {
    const commonProps = { currentUser: user, data: parsedCsvData };
    // Removed commonManagerProps as it was not consistently used
    const dailyTaskProps = { user: user, onDataUpdate: refreshDashboardData, onNavigate: handleNavigate }; // Pass refresh callback and onNavigate

    return {
      dashboard: <DashboardContent {...commonProps} parsedCsvData={parsedCsvData} mtdData={mtdData} loading={loading} error={error} refreshDashboardData={refreshDashboardData} />,
      dailytask_achievement: <SubmitDailyAchievementPage {...dailyTaskProps} />,
      dailytask_projection: <SubmitProjectionPage {...dailyTaskProps} />,
      dailytask_demand: <ViewTodaysDemandPage user={user} data={parsedCsvData} />,
      analytics: <AnalyticsPage data={parsedCsvData} />,
      reports_full: <ReportPage data={parsedCsvData} />,
      reports_today_submitted: <ViewTodaysSubmittedReportPage user={user} data={parsedCsvData} />,
      reports_projection: <ProjectionReportPage currentUser={user} />, // New page here
      settings: <SettingsPage user={user} onLogout={onLogout} />,
      profilesettings: <ProfileSettingsPage currentUser={user} refreshCurrentUser={async () => {
        // Find the most up-to-date user record from dataService after profile update
        const updatedStaff = await getStaffData();
        const updatedUserRecord = updatedStaff.find(s => s.id === user.id);
        if (updatedUserRecord) {
          onUserUpdate({ // Use onUserUpdate to update the user in App.tsx
            ...user, // Keep existing User properties
            staffName: updatedUserRecord.employeeName,
            designation: updatedUserRecord.function,
            contactNumber: updatedUserRecord.contactNumber,
            employeeCode: updatedUserRecord.employeeCode,
          });
        }
      }} />,
      usermanagement: <UserManagementPage currentUser={user} />,
      branchmanagement: <BranchManagementPage currentUser={user} />,
      staffmanagement: <StaffManagementPage manager={user} />,
      kramapping: <KraMappingPage currentUser={user} />,
      productsettings: <ProductSettingsPage currentUser={user} onMetricsUpdated={refreshDashboardData} />,
      managerassignments: <ManagerAssignmentsPage currentUser={user} />,
      staffassignments: <StaffAssignmentsPage currentUser={user} />,
      admin_target_branch: <BranchTargetMappingPage currentUser={user} />,
      zonemanagement: <ZoneManagementPage currentUser={user} />,
      regionmanagement: <RegionManagementPage currentUser={user} />,
      districtmanagement: <DistrictManagementPage currentUser={user} />,
      designationkrasettings: <DesignationKraSettingsPage currentUser={user} />, // New page
    };
  }, [user, parsedCsvData, mtdData, onLogout, onUserUpdate, refreshDashboardData, loading, error, handleNavigate]);

  // Main content display based on activePage
  const renderPage = () => {
    const PageComponent = pagesMap[activePage];
    if (!PageComponent) {
      return (
        <div className="text-center py-20">
          <h2 className="text-2xl font-semibold text-gray-700 dark:text-gray-200">Page Not Found</h2>
          <p className="mt-2 text-gray-500 dark:text-gray-400">The requested page does not exist.</p>
        </div>
      );
    }
    return PageComponent;
  };


  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      <LeftPanel 
        isOpen={isMenuOpen} 
        onClose={handleMenuToggle} 
        user={user} 
        activePage={activePage} 
        onNavigate={handleNavigate} 
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header 
          user={user} 
          onLogout={onLogout} 
          onMenuToggle={handleMenuToggle} 
          onNavigate={handleNavigate}
        />

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 bg-gray-100 dark:bg-gray-900">
          {renderPage()}
        </main>
      </div>

      <FileUploadButton onChange={handleFileUpload} fileName={fileName} user={user} />
    </div>
  );
};

export default DashboardPage;