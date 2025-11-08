import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { User, DailyAchievementRecord, ALL_DAILY_ACHIEVEMENT_NUMBER_METRICS } from '../types'; // Updated to use DailyAchievementRecord and ALL_DAILY_ACHIEVEMENT_NUMBER_METRICS
import { getDailyAchievementRecord, addDailyAchievementRecord, updateDailyAchievementRecord, addMultipleDailyAchievementRecords, getAllStaff } from '../services/dataService'; // Updated to use achievement data services, added addMultipleDailyAchievementRecords and getAllStaff
import { LoaderIcon, CheckCircleIcon, AlertTriangleIcon, Share2Icon, UploadIcon } from '../components/icons'; // Added UploadIcon
import { getTodayDateYYYYMMDD, convertYYYYMMDDtoDDMMYYYY, convertDDMMYYYYtoYYYYMMDD } from '../utils/dateHelpers';

// Declare XLSX from the script tag in index.html
declare const XLSX: any;

interface AchievementFormData {
    [key: string]: string | number;
    date: string;
    'STAFF NAME': string; // Key name for DailyAchievementRecord
    'BRANCH NAME': string; // Key name for DailyAchievementRecord
}

interface SubmitDailyAchievementFormProps {
  user: User;
  onNavigate: (page: 'reports_today_submitted') => void; // Added onNavigate to redirect
}

const SubmitDailyAchievementForm: React.FC<SubmitDailyAchievementFormProps> = ({ user, onNavigate }) => {
  const [formData, setFormData] = useState<AchievementFormData>({
      date: getTodayDateYYYYMMDD(),
      'STAFF NAME': user.staffName, // Initialize with user's staff name
      'BRANCH NAME': user.branchName || 'N/A', // Initialize with user's branch name
  });
  const [currentAchievement, setCurrentAchievement] = useState<DailyAchievementRecord | null>(null); // Changed type
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [allStaff, setAllStaff] = useState<any[]>([]); // For validation in import
  const importFileInputRef = useRef<HTMLInputElement>(null);


  const isMounted = useRef(false);

  // Calculate grand totals dynamically based on current form data
  const { grandTotalAmount, grandTotalAccount } = useMemo(() => {
    let totalAmount = 0;
    let totalAccount = 0;
    
    // Use ALL_DAILY_ACHIEVEMENT_NUMBER_METRICS for calculation to ensure consistency
    ALL_DAILY_ACHIEVEMENT_NUMBER_METRICS.forEach(metric => {
        // Exclude the 'TOTAL' and 'GRAND TOTAL' metrics from individual summation
        if (!metric.includes('TOTAL') && !metric.includes('GRAND TOTAL')) {
            const value = Number(formData[metric]) || 0;
            if (metric.includes('AMT')) {
                totalAmount += value;
            } else if (metric.includes('AC') || metric === 'NEW-SS/AGNT') { // NEW-SS/AGNT counts as an account
                totalAccount += value;
            }
        }
    });
    return { grandTotalAmount: totalAmount, grandTotalAccount: totalAccount };
  }, [formData]);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Function to fetch current achievement record for the staff and date
  const fetchCurrentAchievement = useCallback(async (staffName: string, date: string) => { // Changed params for achievement
      try {
          const achievement = await getDailyAchievementRecord(date, staffName); // Uses achievement service
          if (isMounted.current) {
              setCurrentAchievement(achievement);
              // Populate form data from existing achievement
              const newFormData: AchievementFormData = {
                  date: date,
                  'STAFF NAME': staffName,
                  'BRANCH NAME': user.branchName || 'N/A',
              };
              // Initialize all metrics to 0 first, then overwrite with existing values
              ALL_DAILY_ACHIEVEMENT_NUMBER_METRICS.forEach(metric => {
                  newFormData[metric] = 0; // Default to 0
              });

              if (achievement) {
                  ALL_DAILY_ACHIEVEMENT_NUMBER_METRICS.forEach(metric => {
                      newFormData[metric] = achievement[metric as keyof DailyAchievementRecord] ?? 0;
                  });
              }
              setFormData(newFormData);
          }
      } catch (err) {
          if (isMounted.current) {
              setError(err instanceof Error ? err.message : 'Failed to fetch current daily achievement.');
          }
      }
  }, [isMounted, user.branchName]);

    const fetchAllStaff = useCallback(async () => {
      try {
        const staffList = await getAllStaff();
        if (isMounted.current) {
          setAllStaff(staffList);
        }
      } catch (err) {
        console.error("Failed to fetch all staff for import validation:", err);
      }
    }, [isMounted]);

  useEffect(() => {
      if (user.staffName && formData.date) { // Uses staffName for achievement lookup
          fetchCurrentAchievement(user.staffName, formData.date);
          fetchAllStaff(); // Fetch staff for import validation
      }
  }, [user.staffName, formData.date, fetchCurrentAchievement, fetchAllStaff]);


  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => {
        const updatedFormData = {
            ...prev,
            [name]: type === 'number' ? (value === '' ? 0 : parseFloat(value)) : value,
        };
        // Also update the calculated grand totals immediately
        // This is done by triggering the `useMemo` dependency for `grandTotalAmount`/`grandTotalAccount`
        return updatedFormData;
    });
    // Clear error for this specific field if it was set
    setError(null);
    setSubmitSuccess(false); // Clear success message on input change
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitSuccess(false);
    setError(null);
    
    try {
        // Prepare the payload for submission
        const payloadMetrics = ALL_DAILY_ACHIEVEMENT_NUMBER_METRICS.reduce((acc, metric) => {
            (acc as any)[metric] = Number(formData[metric]) || 0;
            return acc;
        }, {} as { [key: string]: number });

        // Explicitly set the GRAND TOTALS based on calculation, overriding any manual input
        payloadMetrics['TOTAL ACCOUNTS'] = grandTotalAccount;
        payloadMetrics['TOTAL AMOUNTS'] = grandTotalAmount;
        payloadMetrics['GRAND TOTAL AC'] = grandTotalAccount;
        payloadMetrics['GRAND TOTAL AMT'] = grandTotalAmount;

        const payload: Omit<DailyAchievementRecord, 'id'> = {
            date: formData.date,
            'STAFF NAME': formData['STAFF NAME'],
            'BRANCH NAME': formData['BRANCH NAME'],
            ...payloadMetrics,
        } as DailyAchievementRecord; // Cast to DailyAchievementRecord

        // Update existing or add new record
        if (currentAchievement) {
            await updateDailyAchievementRecord(currentAchievement.id, payload);
        } else {
            await addDailyAchievementRecord(payload);
        }
        
        if (isMounted.current) {
            setSubmitSuccess(true);
            await fetchCurrentAchievement(user.staffName, formData.date); // Re-fetch to confirm latest state
            // Redirect to ViewTodaysSubmittedReportPage after a short delay for notification to be visible
            setTimeout(() => {
                if (isMounted.current) {
                    onNavigate('reports_today_submitted');
                }
            }, 1000);
        }
    } catch (err) {
        if (isMounted.current) {
            setError(err instanceof Error ? err.message : 'An unknown error occurred during submission.');
        }
    } finally {
        if (isMounted.current) {
            setIsSubmitting(false);
        }
    }
  };

  const handleShareOnWhatsApp = () => {
    if (!user.staffName || !formData.date || !currentAchievement) { // Check for currentAchievement data
      alert("No achievement data to share for this date.");
      return;
    }

    const formattedDate = convertYYYYMMDDtoDDMMYYYY(formData.date);
    let totalAmount = Number(currentAchievement['GRAND TOTAL AMT']) || 0; 
    let totalAccounts = Number(currentAchievement['GRAND TOTAL AC']) || 0; 
    
    const branchName = currentAchievement['BRANCH NAME'] || 'N/A';
    let staffRoleLine = '';
    if (user.designation === 'BRANCH MANAGER' || user.designation === 'SENIOR BRANCH MANAGER') {
        staffRoleLine = `BM - ${user.staffName}`;
    } else {
        staffRoleLine = `Staff - ${user.staffName}`;
    }

    // Helper to format numbers without decimals and with commas, matching the example's style
    const formatShareNumber = (value: number) => value.toLocaleString('en-IN', { maximumFractionDigits: 0 });

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

    // Map full metric names to short codes and aggregate values
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
        'NEW-SS/AGNT': 'NEW AGENT', // Changed from 'SS' to new category
    };

    // Iterate over the currentAchievement metrics to populate shareMetrics
    for (const fullMetricName of Object.keys(currentAchievement)) {
        const shortCode = metricMapping[fullMetricName];
        if (shortCode) {
            const value = Number(currentAchievement[fullMetricName as keyof DailyAchievementRecord]) || 0;
            if (fullMetricName.endsWith('AMT')) {
                shareMetrics[shortCode].amt += value;
            } else if (fullMetricName.endsWith('AC') || fullMetricName === 'NEW-SS/AGNT') {
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

    const message = `DAILY ACHIEVEMENT REPORT\n\n` +
                    `DATE: ${formattedDate}\n\n` +
                    `BRANCH: ${branchName}\n` +
                    `${staffRoleLine}\n\n` +
                    `${metricLines.join('\n')}\n\n` +
                    `TOTAL AC:- ${formatShareNumber(totalAccounts)}\n` +
                    `TOTAL AMT:- ${formatShareNumber(totalAmount)}`;

    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  const handleImportClick = () => {
    setError(null); // Clear notification
    importFileInputRef.current?.click();
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsSubmitting(true);
    setError(null); // Clear notification

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });
        const json: any[] = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);

        if (json.length === 0) throw new Error("No data found in the uploaded file.");

        const recordsToImport: Omit<DailyAchievementRecord, 'id'>[] = json.map((row, index) => {
          const rowNumber = index + 2; // +1 for header, +1 for 0-indexed array
          const dateString = String(row['DATE'] || '').trim(); // Expected DD/MM/YYYY
          const staffName = String(row['STAFF NAME'] || '').trim();
          const branchName = String(row['BRANCH NAME'] || '').trim();

          if (!dateString) throw new Error(`Missing 'DATE' for row ${rowNumber}.`);
          if (!staffName) throw new Error(`Missing 'STAFF NAME' for row ${rowNumber}.`);
          if (!branchName) throw new Error(`Missing 'BRANCH NAME' for row ${rowNumber}.`);

          // Validate date format and convert to YYYY-MM-DD
          if (!/^\d{2}\/\d{2}\/\d{4}$/.test(dateString)) {
            throw new Error(`Invalid date format (expected DD/MM/YYYY) for row ${rowNumber}: ${dateString}`);
          }
          const formattedDate = convertDDMMYYYYtoYYYYMMDD(dateString);
          if (!formattedDate) { // Check if conversion failed for some reason
            throw new Error(`Could not parse date for row ${rowNumber}: ${dateString}`);
          }

          // Validate staff name exists
          if (!allStaff.some(s => s.employeeName === staffName)) {
            console.warn(`Staff member "${staffName}" from row ${rowNumber} not found in master data.`);
            // Optionally, throw error instead of warning: throw new Error(`Staff member "${staffName}" not found for row ${rowNumber}.`);
          }
          
          // Initialize all metrics to 0
          const record: DailyAchievementRecord = {
            id: '', // Will be set by dataService
            date: formattedDate,
            'STAFF NAME': staffName,
            'BRANCH NAME': branchName,
            ...ALL_DAILY_ACHIEVEMENT_NUMBER_METRICS.reduce((acc, metric) => {
                (acc as any)[metric] = 0; // Initialize all as 0
                return acc;
            }, {} as { [key: string]: number }),
          } as DailyAchievementRecord; // Cast to DailyAchievementRecord

          let currentTotalAccounts = 0;
          let currentTotalAmounts = 0;

          // Populate with values from CSV row, calculating totals from individual metrics
          // Use ALL_DAILY_ACHIEVEMENT_NUMBER_METRICS here, but filter out totals to sum individual fields
          const individualCsvMetrics = ALL_DAILY_ACHIEVEMENT_NUMBER_METRICS.filter(
              metric => !metric.includes('TOTAL') && !metric.includes('GRAND TOTAL')
          );

          individualCsvMetrics.forEach(metric => { // Only iterate over individual metrics from CSV input
            const value = Number(row[metric]) || 0;
            (record as any)[metric] = value;
            if (metric.includes('AC') || metric === 'NEW-SS/AGNT') {
              currentTotalAccounts += value;
            } else if (metric.includes('AMT')) {
              currentTotalAmounts += value;
            }
          });

          // Ensure TOTAL ACCOUNTS and TOTAL AMOUNTS are calculated from individual metrics, overriding CSV values if inconsistent
          record['TOTAL ACCOUNTS'] = currentTotalAccounts;
          record['TOTAL AMOUNTS'] = currentTotalAmounts;
          record['GRAND TOTAL AC'] = currentTotalAccounts;
          record['GRAND TOTAL AMT'] = currentTotalAmounts;

          return record as Omit<DailyAchievementRecord, 'id'>;
        });

        if (recordsToImport.length === 0) throw new Error("No valid daily achievement records found in the file after processing.");

        const { added, updated } = await addMultipleDailyAchievementRecords(recordsToImport);
        if (!isMounted.current) return;

        setSubmitSuccess(true); // Indicate success for the import operation
        setError(`Import complete. Added: ${added}, Updated: ${updated} records.`); // Use error state to display combined message
        // Redirect to ViewTodaysSubmittedReportPage after a short delay for notification to be visible
        setTimeout(() => {
            if (isMounted.current) {
                onNavigate('reports_today_submitted');
            }
        }, 1000);

      } catch (err: any) {
        if (isMounted.current) {
          setError(err.message || 'Failed to process import file.');
        }
      } finally {
        if (isMounted.current) {
          setIsSubmitting(false);
        }
      }
    };
    reader.onerror = () => {
      if (isMounted.current) {
        setError('Failed to read file.');
        setIsSubmitting(false);
      }
    };
    reader.readAsArrayBuffer(file);
    event.target.value = ''; // Clear input to allow re-uploading the same file
  };
  
    const productPrefixes = [
    'DDS', 'DAM', 'MIS', 'FD', 'RD', 'SMBG', 'CUR-GOLD', 'CUR-WEL', 'SAVS', 'INSU', 'TASC', 'SHARE'
  ];
  const standaloneMetrics = ['NEW-SS/AGNT'];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
        <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100 mb-6">Submit Daily Achievement</h2>

        {submitSuccess && (
            <div className="bg-green-100 dark:bg-green-900/30 border-l-4 border-green-500 text-green-700 dark:text-green-300 p-4 rounded-md flex items-start space-x-3 mb-6" role="alert">
                <CheckCircleIcon className="w-6 h-6 flex-shrink-0" />
                <div>
                    <p className="font-bold">Success!</p>
                    <p>Your daily achievement has been submitted successfully.</p>
                </div>
                {currentAchievement && (
                    <button
                        onClick={handleShareOnWhatsApp}
                        className="ml-auto btn btn-green flex items-center gap-2"
                        aria-label="Share achievement on WhatsApp"
                    >
                        <Share2Icon className="w-5 h-5" /> Share on WhatsApp
                    </button>
                )}
            </div>
        )}

        {error && (
            <div className="bg-red-100 dark:bg-red-900/30 border-l-4 border-red-500 text-red-700 dark:text-red-300 p-4 rounded-md flex items-start space-x-3 mb-6" role="alert">
                <AlertTriangleIcon className="w-6 h-6 flex-shrink-0" />
                <div>
                    <p className="font-bold">Error</p>
                    <p>{error}</p>
                </div>
            </div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-8">
            {/* --- General Info --- */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                 <div>
                    <label htmlFor="staffName" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Staff Name
                    </label>
                    <input
                        type="text"
                        id="staffName"
                        name="STAFF NAME"
                        value={user.staffName}
                        readOnly
                        className="mt-1 block w-full px-3 py-2 bg-gray-200 dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm sm:text-sm cursor-not-allowed"
                    />
                </div>
                <div>
                    <label htmlFor="branchName" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Branch Name
                    </label>
                    <input
                        type="text"
                        id="branchName"
                        name="BRANCH NAME"
                        value={user.branchName || 'N/A'}
                        readOnly
                        className="mt-1 block w-full px-3 py-2 bg-gray-200 dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm sm:text-sm cursor-not-allowed"
                    />
                </div>
                <div>
                    <label htmlFor="date" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Date
                    </label>
                    <input
                        type="date"
                        id="date"
                        name="date"
                        value={formData.date}
                        onChange={handleInputChange}
                        required
                        className="mt-1 block w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    />
                </div>
            </div>

            {/* --- Achievement Metrics --- */}
            <div className="space-y-6">
                <h3 className="text-lg font-medium leading-6 text-gray-900 dark:text-gray-100">Achievement Metrics (Product Wise & Account Wise)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-8">
                    {productPrefixes.map(prefix => {
                        const amtMetric = `${prefix} AMT`;
                        const acMetric = `${prefix} AC`;
                        
                        return (
                            <div key={prefix}>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                    {prefix}
                                </label>
                                <div className="mt-1 flex items-center gap-2">
                                    {/* Amount Input */}
                                    <div className="flex-1">
                                        <label htmlFor={amtMetric} className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Amount</label>
                                        <input
                                            type="number"
                                            id={amtMetric}
                                            name={amtMetric}
                                            value={formData[amtMetric] ?? 0}
                                            onChange={handleInputChange}
                                            required
                                            className="mt-1 block w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                            min="0"
                                            placeholder="0"
                                            aria-label={`${prefix} Amount`}
                                        />
                                    </div>
                                    {/* Account Input */}
                                    <div className="flex-1">
                                        <label htmlFor={acMetric} className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Account</label>
                                        <input
                                            type="number"
                                            id={acMetric}
                                            name={acMetric}
                                            value={formData[acMetric] ?? 0}
                                            onChange={handleInputChange}
                                            required
                                            className="mt-1 block w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                            min="0"
                                            placeholder="0"
                                            aria-label={`${prefix} Account`}
                                        />
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                    {/* Render standalone metrics */}
                    {standaloneMetrics.map(metric => (
                        <div key={metric}>
                            <label htmlFor={metric} className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                {metric}
                            </label>
                            <input
                                type="number"
                                id={metric}
                                name={metric}
                                value={formData[metric] ?? 0}
                                onChange={handleInputChange}
                                required
                                className="mt-1 block w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                min="0"
                                placeholder="0"
                                aria-label={metric}
                            />
                        </div>
                    ))}
                </div>

                {/* Grand Total section */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                    <div>
                        <label htmlFor="GRAND TOTAL AMT" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            GRAND TOTAL AMT
                        </label>
                        <input
                            type="text"
                            id="GRAND TOTAL AMT"
                            name="GRAND TOTAL AMT"
                            value={grandTotalAmount.toLocaleString('en-IN')}
                            readOnly
                            className="mt-1 block w-full px-3 py-2 bg-gray-200 dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm sm:text-sm cursor-not-allowed font-bold text-indigo-700 dark:text-indigo-300"
                        />
                    </div>
                    <div>
                        <label htmlFor="GRAND TOTAL AC" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            GRAND TOTAL AC
                        </label>
                        <input
                            type="text"
                            id="GRAND TOTAL AC"
                            name="GRAND TOTAL AC"
                            value={grandTotalAccount.toLocaleString('en-IN')}
                            readOnly
                            className="mt-1 block w-full px-3 py-2 bg-gray-200 dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm sm:text-sm cursor-not-allowed font-bold text-indigo-700 dark:text-indigo-300"
                        />
                    </div>
                </div>
            </div>

            {/* --- Submission Button --- */}
            <div className="pt-5 border-t border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row justify-between items-center gap-4">
                {(user.role === 'admin' || user.role === 'manager') && (
                    <button
                        type="button"
                        onClick={handleImportClick}
                        disabled={isSubmitting}
                        className="w-full sm:w-auto btn btn-blue flex items-center justify-center gap-2"
                        aria-label="Import daily achievement records from Excel"
                    >
                        <UploadIcon className="w-5 h-5" /> Import Excel
                    </button>
                )}
                <input
                    type="file"
                    ref={importFileInputRef}
                    onChange={handleImport}
                    className="hidden"
                    accept=".xlsx, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                />
                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full sm:w-auto flex justify-center items-center gap-2 py-2 px-6 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-400 disabled:cursor-not-allowed"
                >
                    {isSubmitting ? (
                        <>
                            <LoaderIcon className="w-5 h-5" />
                            Submitting...
                        </>
                    ) : (
                        currentAchievement ? 'Update Achievement' : 'Submit Achievement'
                    )}
                </button>
            </div>
        </form>
    </div>
  );
};

export default SubmitDailyAchievementForm;