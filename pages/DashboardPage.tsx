import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { GoogleGenAI } from "@google/genai";
import { User, ParsedCsvData, CsvRecord, MtdData, Target, ProductMetric, DailyAchievementRecord, StaffMember, Branch, Projection, Demand, BranchTarget, DetailedMonthlyTargets, Highlight, DailyRunRateResult, ChartDataPoint } from '../types';
import { parseCsvData } from '../services/csvParser';
import { csvData } from '../data';
import { getStaffData, getBranches, getAllTargets, getAllProjections, getAllDemands, getAllBranchTargets, getProductMetrics, getDailyAchievementRecords, transformDailyAchievementsToParsedCsvData, calculateDailyRunRateForUserScope, getDetailedMonthlyTargetsForUserScope, getRecursiveSubordinateInfo, getUserScope, getAllStaff, getHighlights, removeHighlight } from '../services/dataService'; // Added getTargetsForStaff, getProductMetrics, getDailyAchievementRecords, transformDailyAchievementsToParsedCsvData, and new global getters
import { login } from '../services/authService';
import { getMonthString, convertYYYYMMDDtoDDMMYYYY, getTodayDateYYYYMMDD, getYearString, convertDDMMYYYYtoYYYYMMDD } from '../utils/dateHelpers'; // Import from new utility


import Header from '../components/Header';
import LeftPanel from '../components/LeftPanel';
import SummaryCard from '../components/SummaryCard';
import DataTable from '../components/DataTable';
import FileUploadButton from '../components/FileUploadButton';
import BarChart from '../components/BarChart';
// FIX: Corrected import statements for PieChart and removed SubmitDailyAchievementPage
import PieChart from '../components/PieChart'; 
import SubmitDailyAchievementForm from './SubmitDailyAchievementForm'; // NEW IMPORT
import SubmitProjectionPage from './SubmitProjectionPage'; // New Import
import { ViewTodaysDemandPage } from './ViewTodaysDemandPage'; // New Import
import AnalyticsPage from './AnalyticsPage';
import ReportPage from './ReportPage';
import ProjectionReportPage from './ProjectionReportPage'; // New Import
import ViewTodaysSubmittedReportPage from './ViewTodaysSubmittedReportPage'; // New Import
import SettingsPage from './SettingsPage';
import { BranchManagementPage } from './BranchManagementPage'; // FIX: Changed import to named export
// FIX: Corrected import of TargetMappingPage to be a named export from the renamed component
import { TargetMappingPage } from './KraMappingPage';
import ProductSettingsPage from './ProductSettingsPage';
// FIX: Changed import to named export for ManagerAssignmentsPage
import { ManagerAssignmentsPage } from './ManagerAssignmentsPage';
import StaffAssignmentsPage from './StaffAssignmentsPage';
import ProfileSettingsPage from './ProfileSettingsPage'; // New Import
import BranchTargetMappingPage from './BranchTargetMappingPage'; // New Import
import OrganizationManagementPage from './OrganizationManagementPage'; // Corrected Import Path
import { UserManagementPage } from './UserManagementPage'; // FIX: Changed import to named export
import ProductMappingPage from './DesignationKraSettingsPage'; // New page
import TargetAchievementAnalytics from '../components/TargetAchievementAnalytics'; // New component
import HighlightUploadModal from '../components/HighlightUploadModal'; // New Import
import { UploadIcon, TrashIcon, DollarSignIcon, UsersIcon, BotIcon, LoaderIcon } from '../components/icons';
import RunRateBarChart from '../components/RunRateBarChart';

// FIX: Declare XLSX from the global scope (assuming it's loaded via script tag in index.html)
declare const XLSX: any;
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });

type ActivePage = 'dashboard' | 'dailytask_achievement' | 'dailytask_projection' | 'dailytask_demand' | 'analytics' | 'reports_full' | 'reports_today_submitted' | 'reports_projection' | 'settings' | 'usermanagement' | 'branchmanagement' | 'targetmapping' | 'productsettings' | 'managerassignments' | 'staffassignments' | 'profilesettings' | 'admin_target_branch' | 'organizationmanagement' | 'productmapping' | 'dailytask_new_achievement_form';


interface DashboardPageProps {
  user: User;
  onLogout: () => void;
  onUserUpdate: (user: User) => void;
}

// Helper for formatting currency
const formatCurrency = (value: number) => {
  if (isNaN(value)) return '₹ 0';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const formatNumber = (value: number) => {
  if (isNaN(value)) return '0';
  return new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 0,
  }).format(value);
};

// --- NEW: User-specific Dashboard Content ---
const UserDashboardContent: React.FC<{ currentUser: User; parsedCsvData: ParsedCsvData | null }> = ({ currentUser, parsedCsvData }) => {
    const [runRate, setRunRate] = useState<DailyRunRateResult | null>(null);
    const [loadingRunRate, setLoadingRunRate] = useState(true);
    const [aiTip, setAiTip] = useState('');
    const [loadingAiTip, setLoadingAiTip] = useState(false);
    const [aiError, setAiError] = useState<string | null>(null);
    const isMounted = useRef(false);
    
    useEffect(() => {
        isMounted.current = true;
        return () => { isMounted.current = false; };
    }, []);

    const fetchRunRate = useCallback(async () => {
        if (!parsedCsvData?.records || !currentUser.employeeCode) {
            setLoadingRunRate(false);
            return;
        }
        setLoadingRunRate(true);
        try {
            const result = await calculateDailyRunRateForUserScope(currentUser, getMonthString(), parsedCsvData.records);
            if (isMounted.current) {
                setRunRate(result);
            }
        } catch (err) {
            console.error("Failed to fetch run rate for user dashboard", err);
        } finally {
            if (isMounted.current) {
                setLoadingRunRate(false);
            }
        }
    }, [currentUser, parsedCsvData]);
    
    useEffect(() => {
        fetchRunRate();
    }, [fetchRunRate]);

    const generateAiTip = useCallback(async () => {
        if (!runRate || runRate.remainingTargetAmount <= 0) return;
        setLoadingAiTip(true);
        setAiError(null);
        try {
            const prompt = `You are a helpful sales coach for a bank. A user has these remaining targets for the month: ${formatCurrency(runRate.remainingTargetAmount)} amount, and ${runRate.remainingTargetAccount.toFixed(1)} accounts. There are ${runRate.daysRemainingInMonth} days left in the month. Give them a concise, positive, and actionable tip (2-3 sentences) for today to help them meet their goal. Address them directly.`;

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
            });

            if (isMounted.current) {
                setAiTip(response.text);
            }
        } catch (err) {
            if (isMounted.current) {
                setAiError('Could not generate AI tip.');
            }
        } finally {
            if (isMounted.current) {
                setLoadingAiTip(false);
            }
        }
    }, [runRate, isMounted]);

    useEffect(() => {
        if (runRate) {
            generateAiTip();
        }
    }, [runRate, generateAiTip]);

    const dailyPerformanceChartData = useMemo(() => {
        if (!parsedCsvData?.records) return [];

        const currentMonthStr = getMonthString();
        const currentUserRecords = parsedCsvData.records.filter(r => {
            const staffName = (r['STAFF NAME'] as string || '').trim().toUpperCase();
            return staffName === currentUser.staffName.toUpperCase();
        });

        const dailyTotals: { [date: string]: number } = {}; // date is DD/MM/YYYY

        currentUserRecords.forEach(record => {
            const dateStr = record['DATE'] as string; // dd/mm/yyyy
            if (!dateStr || !/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) return;

            const [day, month, year] = dateStr.split('/').map(Number);
            const recordMonthStr = `${year}-${String(month).padStart(2, '0')}`;

            if (recordMonthStr === currentMonthStr) {
                const amount = record['GRAND TOTAL AMT'] as number;
                if (dateStr && typeof amount === 'number') {
                    dailyTotals[dateStr] = (dailyTotals[dateStr] || 0) + amount;
                }
            }
        });

        return Object.entries(dailyTotals)
            .map(([dateDDMMYYYY, amount]) => ({
                label: dateDDMMYYYY.substring(0, 5), // "DD/MM"
                value: amount,
                originalLabel: dateDDMMYYYY,
            }))
            .sort((a, b) => {
                // FIX: Use the correct function name: convertDDMMYYYYtoYYYYMMDD
                const dateA = new Date(convertDDMMYYYYtoYYYYMMDD(a.originalLabel!)).getTime();
                const dateB = new Date(convertDDMMYYYYtoYYYYMMDD(b.originalLabel!)).getTime();
                return dateA - dateB;
            });
    }, [parsedCsvData, currentUser.staffName]);

    const AchievementProgressBar = ({ title, achieved, target }: { title: string; achieved: number; target: number }) => {
        const percentage = target > 0 ? (achieved / target) * 100 : (achieved > 0 ? 100 : 0);
        const getProgressBarColor = (p: number) => {
            if (p >= 100) return 'bg-green-500';
            if (p >= 75) return 'bg-yellow-500';
            if (p >= 50) return 'bg-orange-500';
            return 'bg-red-500';
        };

        return (
            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md">
                <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</h4>
                <div className="flex justify-between items-baseline mt-1">
                    <span className="text-lg font-bold text-gray-800 dark:text-gray-100">{formatCurrency(achieved)}</span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">/ {formatCurrency(target)}</span>
                </div>
                <div className="mt-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                    <div className={`${getProgressBarColor(percentage)} h-2.5 rounded-full`} style={{ width: `${Math.min(percentage, 100)}%` }}></div>
                </div>
                <p className="text-right text-sm font-semibold text-gray-700 dark:text-gray-200 mt-1">{percentage.toFixed(1)}%</p>
            </div>
        );
    };

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100">Welcome, {currentUser.staffName}!</h2>

            {loadingRunRate ? (
                <div className="flex justify-center py-8"><LoaderIcon /></div>
            ) : runRate ? (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <AchievementProgressBar title="MTD Amount Achievement" achieved={runRate.mtdAchievementAmount} target={runRate.monthlyTargetAmount} />
                        <AchievementProgressBar title="MTD Account Achievement" achieved={runRate.mtdAchievementAccount} target={runRate.monthlyTargetAccount} />
                    </div>
                    
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md">
                        <h4 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2 text-center">Daily Run Rate</h4>
                        <div className="mt-6 flex flex-wrap justify-around">
                            <RunRateBarChart
                                monthlyTarget={runRate.monthlyTargetAmount}
                                mtdAchievement={runRate.mtdAchievementAmount}
                                dailyRunRate={runRate.dailyRunRateAmount}
                                label="Amount"
                                unit="INR"
                            />
                            <RunRateBarChart
                                monthlyTarget={runRate.monthlyTargetAccount}
                                mtdAchievement={runRate.mtdAchievementAccount}
                                dailyRunRate={runRate.dailyRunRateAccount}
                                label="Accounts"
                                unit="Units"
                            />
                        </div>
                        <div className="mt-4 text-center text-sm text-gray-600 dark:text-gray-300">
                            Days Remaining in {getMonthString()}: <span className="font-semibold">{runRate.daysRemainingInMonth}</span>
                        </div>
                    </div>
                </>
            ) : (
                <p className="text-center text-gray-500 dark:text-gray-400 py-4">
                    Monthly targets not set. Achievement progress cannot be displayed.
                </p>
            )}

            {(loadingAiTip || aiTip || aiError) && (
                 <div className="bg-indigo-50 dark:bg-gray-800 p-4 rounded-xl shadow-md flex items-start space-x-4">
                    <div className="flex-shrink-0 p-3 rounded-full bg-indigo-100 dark:bg-gray-700 text-indigo-500 dark:text-indigo-400">
                        <BotIcon className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-indigo-800 dark:text-indigo-200">Focus for Today</p>
                        {loadingAiTip && <div className="mt-2 flex items-center gap-2"><LoaderIcon className="w-4 h-4" /><span className="text-sm text-gray-500">Generating tip...</span></div>}
                        {aiError && <p className="mt-1 text-sm text-red-500">{aiError}</p>}
                        {aiTip && <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">{aiTip}</p>}
                    </div>
                </div>
            )}
            
            <TargetAchievementAnalytics data={parsedCsvData} user={currentUser} showRunRateAnalysis={false} />

            {dailyPerformanceChartData.length > 0 && (
                <BarChart
                    title="Your Daily Performance This Month (Amount)"
                    data={dailyPerformanceChartData}
                />
            )}
        </div>
    );
};

// Dashboard content component - MOVED OUTSIDE DashboardPage
interface DashboardContentProps {
    currentUser: User;
    parsedCsvData: ParsedCsvData | null; // Renamed to avoid collision with prop 'data'
    mtdAchievements: DetailedMonthlyTargets;
    ytdAchievements: DetailedMonthlyTargets; // New prop for YTD data
    highlights: Highlight[];
    loading: boolean; // Added loading prop
    error: string | null; // Added error prop
    refreshDashboardData: () => void; // Added refresh callback
    onUploadHighlightClick: () => void;
    onDeleteHighlight: (id: string) => void;
    demandRunRate: DailyRunRateResult | null;
    loadingRunRate: boolean;
    runRateError: string | null;
}

const DashboardContent: React.FC<DashboardContentProps> = ({ currentUser, parsedCsvData, mtdAchievements, ytdAchievements, highlights, loading: isDashboardLoading, error, onUploadHighlightClick, onDeleteHighlight, demandRunRate, loadingRunRate, runRateError }) => {
    const latestHighlight = highlights && highlights.length > 0 ? highlights[0] : null;

    // Check if the latest highlight has any images
    const hasImagesInLatestHighlight = useMemo(() => {
        return latestHighlight?.items.some(item => item.imageUrl) ?? false;
    }, [latestHighlight]);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100">Dashboard</h2>
                {(currentUser.role === 'admin' || currentUser.role === 'manager') && (
                    <button onClick={onUploadHighlightClick} className="btn btn-secondary flex items-center gap-2">
                        <UploadIcon className="w-5 h-5" /> Upload Highlight
                    </button>
                )}
            </div>
            
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
                    {/* Highlight Display - Conditional Rendering for Image vs. Text Only */}
                    {latestHighlight && latestHighlight.items.length > 0 && (
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md relative">
                            <div className="p-4">
                                <h3 className="text-lg font-semibold text-indigo-600 dark:text-indigo-400 mb-2">Latest Highlight</h3>
                                
                                {hasImagesInLatestHighlight ? (
                                    // Render as grid with images if any image is present
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {latestHighlight.items.map((item, index) => (
                                            <div key={index} className="flex flex-col items-center">
                                                {item.imageUrl && (
                                                    <img src={item.imageUrl} alt={`Highlight ${index + 1}`} className="w-full h-48 object-contain rounded-md mb-2" />
                                                )}
                                                {item.description && (
                                                    <p className="text-sm text-gray-700 dark:text-gray-300 text-center">{item.description}</p>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    // Render as animated text marquee if only text items
                                    <div className="bg-indigo-50 dark:bg-gray-700 p-3 rounded-md">
                                        <div className="marquee-container">
                                            <span className="marquee-text text-lg font-medium text-indigo-800 dark:text-indigo-200">
                                                {latestHighlight.items.map(item => item.description).join(' •  •  •  ')}
                                            </span>
                                        </div>
                                    </div>
                                )}

                                <div className="mt-4 text-xs text-gray-500 dark:text-gray-400">
                                    Uploaded by {latestHighlight.uploadedBy} on {new Date(latestHighlight.timestamp).toLocaleDateString()}
                                </div>
                            </div>
                            {(currentUser.role === 'admin' || currentUser.staffName === latestHighlight.uploadedBy) && (
                                <button
                                    onClick={() => onDeleteHighlight(latestHighlight.id)}
                                    className="absolute top-2 right-2 p-1.5 bg-black bg-opacity-50 rounded-full text-white hover:bg-opacity-75 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-white"
                                    aria-label="Delete highlight"
                                >
                                    <TrashIcon className="w-5 h-5" />
                                </button>
                            )}
                        </div>
                    )}

                    {/* New: MTD and YTD Summary Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <SummaryCard 
                            title="MTD Total Amount"
                            value={formatCurrency(mtdAchievements.totalAmount)} 
                            icon={<DollarSignIcon className="h-6 w-6" />} 
                            color="text-green-500" 
                        />
                        <SummaryCard 
                            title="MTD Total Accounts"
                            value={formatNumber(mtdAchievements.totalAc)} 
                            icon={<UsersIcon className="h-6 w-6" />} 
                            color="text-blue-500" 
                        />
                        <SummaryCard 
                            title="YTD Total Amount"
                            value={formatCurrency(ytdAchievements.totalAmount)} 
                            icon={<DollarSignIcon className="h-6 w-6" />} 
                            color="text-purple-500" 
                        />
                        <SummaryCard 
                            title="YTD Total Accounts"
                            value={formatNumber(ytdAchievements.totalAc)} 
                            icon={<UsersIcon className="h-6 w-6" />} 
                            color="text-orange-500" 
                        />
                    </div>

                     {/* NEW: Run Rate section for admin/manager */}
                    {loadingRunRate ? (
                        <div className="flex justify-center py-8"><LoaderIcon /></div>
                    ) : runRateError ? (
                        <div className="bg-red-100 dark:bg-red-900/30 p-4 rounded-xl shadow-md text-red-700 dark:text-red-300">{runRateError}</div>
                    ) : demandRunRate && (demandRunRate.monthlyTargetAmount > 0 || demandRunRate.monthlyTargetAccount > 0) ? (
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md">
                            <h4 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2 text-center">Daily Run Rate</h4>
                            <div className="flex flex-wrap justify-around">
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
                                Days Remaining in {getMonthString()}: <span className="font-semibold">{demandRunRate.daysRemainingInMonth}</span>
                            </div>
                        </div>
                    ) : (
                         <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md">
                            <p className="text-center text-gray-500 dark:text-gray-400 py-4">
                                No relevant targets or achievement data found for {getMonthString()} to calculate daily run rate for your scope.
                            </p>
                        </div>
                    )}

                    {/* Target Achievement Analytics */}
                    <TargetAchievementAnalytics data={parsedCsvData} user={currentUser} showRunRateAnalysis={false} />
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
  const [mtdAchievements, setMtdAchievements] = useState<DetailedMonthlyTargets>({
      totalAmount: 0,
      totalAc: 0,
      ddsAc: 0,
      fdAc: 0,
  });
   const [ytdAchievements, setYtdAchievements] = useState<DetailedMonthlyTargets>({
      totalAmount: 0,
      totalAc: 0,
      ddsAc: 0,
      fdAc: 0,
  });
  const [isHighlightModalOpen, setIsHighlightModalOpen] = useState(false);
  const [highlights, setHighlights] = useState<Highlight[]>([]);

  const [demandRunRate, setDemandRunRate] = useState<DailyRunRateResult | null>(null);
  const [loadingRunRate, setLoadingRunRate] = useState(true);
  const [runRateError, setRunRateError] = useState<string | null>(null);


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
    setLoadingRunRate(true);
    setError(null); // Clear previous errors
    setRunRateError(null);
    const currentMonth = getMonthString();
    const currentYear = getYearString();

    try {
        const [allRecords, allStaff, highlightsData] = await Promise.all([
          getDailyAchievementRecords(),
          getAllStaff(),
          getHighlights()
        ]);

        if (!isMounted.current) return;
        setHighlights(highlightsData);

        // 1. Get user scope
        const { employeeCodes, branchNames } = await getUserScope(user);

        // 2. Filter records based on a scope that's appropriate for the user's role dashboard
        let scopedRecords;
        if (user.role === 'user') {
            // For a 'user', the dashboard summary should only show their personal achievements.
            scopedRecords = allRecords.filter(record => {
                const staffMember = allStaff.find(s => s.employeeName === record['STAFF NAME']);
                return staffMember?.employeeCode === user.employeeCode;
            });
        } else {
            // For 'manager' and 'admin', use the broader scope from getUserScope.
            scopedRecords = allRecords.filter(record => {
                const staffMember = allStaff.find(s => s.employeeName === record['STAFF NAME']);
                const staffCode = staffMember?.employeeCode;
                const branchName = record['BRANCH NAME'];
                return (staffCode && employeeCodes.has(staffCode)) || (branchName && branchNames.has(branchName));
            });
        }
        
        // 3. Calculate MTD achievements from scoped records
        const mtdScopedRecords = scopedRecords.filter(record => record.date.startsWith(currentMonth));
        let mtdTotalAmount = 0;
        let mtdTotalAc = 0;
        let mtdDdsAc = 0;
        let mtdFdAc = 0;
        mtdScopedRecords.forEach(record => {
            mtdTotalAmount += record['GRAND TOTAL AMT'];
            mtdTotalAc += record['GRAND TOTAL AC'];
            mtdDdsAc += record['DDS AC'];
            mtdFdAc += record['FD AC'];
        });
        const mtdAch: DetailedMonthlyTargets = { totalAmount: mtdTotalAmount, totalAc: mtdTotalAc, ddsAc: mtdDdsAc, fdAc: mtdFdAc };

        // 4. Calculate YTD achievements from scoped records
        const ytdScopedRecords = scopedRecords.filter(record => record.date.startsWith(currentYear));
        let ytdTotalAmount = 0;
        let ytdTotalAc = 0;
        let ytdDdsAc = 0;
        let ytdFdAc = 0;
        ytdScopedRecords.forEach(record => {
            ytdTotalAmount += record['GRAND TOTAL AMT'];
            ytdTotalAc += record['GRAND TOTAL AC'];
            ytdDdsAc += record['DDS AC'];
            ytdFdAc += record['FD AC'];
        });
        const ytdAch: DetailedMonthlyTargets = { totalAmount: ytdTotalAmount, totalAc: ytdTotalAc, ddsAc: ytdDdsAc, fdAc: ytdFdAc };
        

        // 5. Create parsed data from all scoped records for other components like Analytics
        const parsedScopedRecords = transformDailyAchievementsToParsedCsvData(scopedRecords);

        if (isMounted.current) {
          setParsedCsvData(parsedScopedRecords);
          setMtdAchievements(mtdAch);
          setYtdAchievements(ytdAch);
        }

        const runRateResult = await calculateDailyRunRateForUserScope(user, currentMonth, allRecords);
        if (isMounted.current) {
          setDemandRunRate(runRateResult);
        }

    } catch (err) {
        if (isMounted.current) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to refresh dashboard data.';
            setError(errorMessage);
            setRunRateError(errorMessage);
        }
    } finally {
        if (isMounted.current) {
            setLoading(false);
            setLoadingRunRate(false);
        }
    }
  }, [user, isMounted]);

  useEffect(() => {
      refreshDashboardData();
  }, [refreshDashboardData]);

  const handleDeleteHighlight = async (id: string) => {
    try {
        await removeHighlight(id);
        if (isMounted.current) {
            refreshDashboardData(); // Re-fetch all data to update the UI
        }
    } catch (err) {
        if (isMounted.current) {
            setError(err instanceof Error ? err.message : 'Failed to delete highlight.');
        }
    }
  };
    
  const pagesMap = useMemo(() => {
    const commonProps = { currentUser: user, data: parsedCsvData };
    // Removed commonManagerProps as it was not consistently used
    const dailyTaskProps = { user: user, onDataUpdate: refreshDashboardData, onNavigate: handleNavigate }; // Pass refresh callback and onNavigate
    const newAchievementFormProps = { user: user, onNavigate: handleNavigate }; // For the new form

    return {
      dashboard: user.role === 'user'
        ? <UserDashboardContent currentUser={user} parsedCsvData={parsedCsvData} />
        : <DashboardContent {...commonProps} parsedCsvData={parsedCsvData} mtdAchievements={mtdAchievements} ytdAchievements={ytdAchievements} highlights={highlights} loading={loading} error={error} refreshDashboardData={refreshDashboardData} onUploadHighlightClick={() => setIsHighlightModalOpen(true)} onDeleteHighlight={handleDeleteHighlight} demandRunRate={demandRunRate} loadingRunRate={loadingRunRate} runRateError={runRateError} />,
      // Removed the original SubmitDailyAchievementPage (Excel import)
      // dailytask_achievement: <SubmitDailyAchievementPage {...dailyTaskProps} />,
      // The NEW SubmitDailyAchievementForm (mimics SubmitProjectionPage) is now the primary
      dailytask_new_achievement_form: <SubmitDailyAchievementForm {...newAchievementFormProps} />, 
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
      targetmapping: <TargetMappingPage currentUser={user} />,
      productsettings: <ProductSettingsPage currentUser={user} onMetricsUpdated={refreshDashboardData} />,
      managerassignments: <ManagerAssignmentsPage currentUser={user} />,
      staffassignments: <StaffAssignmentsPage currentUser={user} />,
      admin_target_branch: <BranchTargetMappingPage currentUser={user} />,
      organizationmanagement: <OrganizationManagementPage currentUser={user} />, // Corrected path and now accessible via submenu
      productmapping: <ProductMappingPage currentUser={user} />, // New page
    };
  }, [user, parsedCsvData, mtdAchievements, ytdAchievements, onLogout, onUserUpdate, refreshDashboardData, loading, error, handleNavigate, highlights, handleDeleteHighlight, demandRunRate, loadingRunRate, runRateError]);

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

      {isHighlightModalOpen && (
        <HighlightUploadModal
          currentUser={user}
          onClose={() => setIsHighlightModalOpen(false)}
          onUploadSuccess={() => {
            setIsHighlightModalOpen(false);
            refreshDashboardData(); // Refresh to show the new highlight
          }}
        />
      )}

      <FileUploadButton onChange={handleFileUpload} fileName={fileName} user={user} />
    </div>
  );
};

export default DashboardPage;