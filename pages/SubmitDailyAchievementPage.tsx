
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { User, DailyAchievementRecord, PROJECTION_DEMAND_METRIC_NAMES } from '../types';
import { LoaderIcon, CheckCircleIcon, UploadIcon, FileDownIcon, AlertTriangleIcon, XIcon, TrashIcon, Share2Icon } from '../components/icons'; // Added Share2Icon
import { getDailyAchievementRecord, addDailyAchievementRecord, updateDailyAchievementRecord, addMultipleDailyAchievementRecords, getDailyAchievementRecords, clearDailyAchievementRecords, getAllStaff } from '../services/dataService'; // Added getAllStaff for staff name validation
import { getTodayDateYYYYMMDD, convertYYYYMMDDtoDDMMYYYY, convertDDMMYYYYtoYYYYMMDD } from '../utils/dateHelpers';

// Declare XLSX from the script tag in index.html
declare const XLSX: any;

interface AchievementFormData {
  [key: string]: string | number; // For dynamic metric fields
  date: string;
  'STAFF NAME': string; // Stored as 'STAFF NAME' in records
  'BRANCH NAME': string; // Stored as 'BRANCH NAME' in records
}

interface SubmitDailyAchievementPageProps {
  user: User;
  onDataUpdate: () => void; // Callback to trigger dashboard data refresh
  onNavigate: (page: 'reports_today_submitted') => void; // Added onNavigate to redirect
}

// Define all required numeric metric names from DailyAchievementRecord for payload construction
const ALL_DAILY_ACHIEVEMENT_NUMBER_METRICS = [
    'DDS AMT', 'DAM AMT', 'MIS AMT', 'FD AMT', 'RD AMT', 'SMBG AMT', 'CUR-GOLD-AMT', 'CUR-WEL-AMT', 'SAVS-AMT', 'INSU AMT', 'TASC AMT', 'SHARE AMT',
    'DDS AC', 'DAM AC', 'MIS AC', 'FD AC', 'RD AC', 'SMBG AC', 'CUR-GOLD-AC', 'CUR-WEL-AC', 'SAVS-AC', 'NEW-SS/AGNT', 'INSU AC', 'TASC AC', 'SHARE AC',
    'TOTAL ACCOUNTS', 'TOTAL AMOUNTS', 'GRAND TOTAL AC', 'GRAND TOTAL AMT'
] as const; // Use as const to get a tuple type

const SubmitDailyAchievementPage: React.FC<SubmitDailyAchievementPageProps> = ({ user, onDataUpdate, onNavigate }) => {
  const [formData, setFormData] = useState<AchievementFormData>({
    date: getTodayDateYYYYMMDD(),
    'STAFF NAME': user.staffName,
    'BRANCH NAME': user.branchName || 'N/A',
  });
  const [currentAchievement, setCurrentAchievement] = useState<DailyAchievementRecord | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null); // FIX: Added notification state
  const [allStaff, setAllStaff] = useState<any[]>([]); // For validation in import
  const importFileInputRef = useRef<HTMLInputElement>(null);


  const isMounted = useRef(false);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const fetchCurrentAchievement = useCallback(async (staffName: string, date: string) => {
    try {
      const achievement = await getDailyAchievementRecord(date, staffName);
      if (isMounted.current) {
        setCurrentAchievement(achievement);
        // Populate form data from existing achievement
        const newFormData: AchievementFormData = {
          date: date,
          'STAFF NAME': staffName,
          'BRANCH NAME': user.branchName || 'N/A', // Ensure branch name is present
        };
        if (achievement) {
          // Iterate through all metrics, not just PROJECTION_DEMAND_METRIC_NAMES
          ALL_DAILY_ACHIEVEMENT_NUMBER_METRICS.forEach(metric => {
            newFormData[metric] = achievement[metric as keyof DailyAchievementRecord] || 0;
          });
        }
        setFormData(newFormData);
      }
    } catch (err) {
      if (isMounted.current) {
        setNotification({ message: err instanceof Error ? err.message : 'Failed to fetch current daily achievement.', type: 'error' });
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
    if (user.staffName && formData.date) {
      fetchCurrentAchievement(user.staffName, formData.date);
      fetchAllStaff(); // Fetch staff for import validation
    }
  }, [user.staffName, formData.date, fetchCurrentAchievement, fetchAllStaff]);

  const calculateTotals = (currentFormData: AchievementFormData) => {
    let totalAccounts = 0;
    let totalAmounts = 0;

    // Only sum metrics that contribute to totals, excluding the grand total fields themselves
    const individualMetricNames = PROJECTION_DEMAND_METRIC_NAMES.filter(
        metric => !metric.includes('TOTAL') && !metric.includes('GRAND TOTAL')
    );

    individualMetricNames.forEach(metric => {
      const value = Number(currentFormData[metric]) || 0;
      if (metric.includes('AC') || metric === 'NEW-SS/AGNT') {
        totalAccounts += value;
      } else if (metric.includes('AMT')) {
        totalAmounts += value;
      }
    });

    return { totalAccounts, totalAmounts };
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const newFormData: AchievementFormData = { ...formData, [name]: type === 'number' ? (value === '' ? '' : parseFloat(value)) : value };

    // Automatically calculate totals for display fields
    const { totalAccounts, totalAmounts } = calculateTotals(newFormData);
    newFormData['TOTAL ACCOUNTS'] = totalAccounts;
    newFormData['TOTAL AMOUNTS'] = totalAmounts;
    newFormData['GRAND TOTAL AC'] = totalAccounts;
    newFormData['GRAND TOTAL AMT'] = totalAmounts;

    setFormData(newFormData);
    setNotification(null); // Clear notification on input change
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setNotification(null); // Clear notification

    try {
      // Ensure all required fields are present
      if (!formData.date || !formData['STAFF NAME'] || !formData['BRANCH NAME']) {
        throw new Error("Date, Staff Name, and Branch Name are required.");
      }

      // Initialize all numeric metrics to 0 if not present in formData, then convert to numbers
      const payloadMetrics = ALL_DAILY_ACHIEVEMENT_NUMBER_METRICS.reduce((acc, metric) => {
        (acc as any)[metric] = Number(formData[metric]) || 0;
        return acc;
      }, {} as { [key: string]: number }); // Explicitly type as an object with string keys and number values
      
      // Recalculate totals just before submission to ensure consistency (overwrites manual entry if any)
      const { totalAccounts, totalAmounts } = calculateTotals(formData);
      payloadMetrics['TOTAL ACCOUNTS'] = totalAccounts;
      payloadMetrics['TOTAL AMOUNTS'] = totalAmounts;
      payloadMetrics['GRAND TOTAL AC'] = totalAccounts;
      payloadMetrics['GRAND TOTAL AMT'] = totalAmounts;

      // FIX: Ensure all properties defined in DailyAchievementRecord are present in the payload
      const payload: Omit<DailyAchievementRecord, 'id'> = {
        date: formData.date,
        'STAFF NAME': formData['STAFF NAME'],
        'BRANCH NAME': formData['BRANCH NAME'],
        ...payloadMetrics, // Spread all required numeric metrics
      } as DailyAchievementRecord; // FIX: Cast to DailyAchievementRecord to satisfy interface


      // Update existing or add new record
      if (currentAchievement) {
        await updateDailyAchievementRecord(currentAchievement.id, payload);
      } else {
        await addDailyAchievementRecord(payload);
      }

      if (isMounted.current) {
        setNotification({ message: 'Your daily achievement has been submitted successfully.', type: 'success' }); // FIX: Use setNotification
        onDataUpdate(); // Refresh data on dashboard/reports
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
        setNotification({ message: err instanceof Error ? err.message : 'An unknown error occurred during submission.', type: 'error' }); // FIX: Use setNotification
      }
    } finally {
      if (isMounted.current) {
        setIsSubmitting(false);
      }
    }
  };

  const handleShareOnWhatsApp = () => {
    if (!user.staffName || !formData.date || !currentAchievement) {
      alert("No achievement data to share for this date.");
      return;
    }

    const formattedDate = convertYYYYMMDDtoDDMMYYYY(formData.date);
    let totalAmount = Number(currentAchievement['GRAND TOTAL AMT']) || 0; // FIX: Explicitly cast to Number
    let totalAccounts = Number(currentAchievement['GRAND TOTAL AC']) || 0; // FIX: Explicitly cast to Number
    const metricSummary: string[] = [];

    // FIX: Iterate through all relevant number metrics (excluding totals) to build summary
    ALL_DAILY_ACHIEVEMENT_NUMBER_METRICS.filter(metric => !metric.includes('TOTAL') && !metric.includes('GRAND TOTAL')).forEach(metric => {
        const value = Number(currentAchievement[metric as keyof DailyAchievementRecord]) || 0; // FIX: Explicitly cast to Number()
        if (value > 0) { // Only include metrics with positive values
            metricSummary.push(`*${metric}:* ${value.toLocaleString('en-IN')}`);
        }
    });

    const message = `*Daily Achievement Report*\n\n` +
                    `*Staff Name:* ${user.staffName}\n` +
                    `*Branch Name:* ${currentAchievement['BRANCH NAME'] || 'N/A'}\n` +
                    `*Date:* ${formattedDate}\n\n` +
                    `*Summary:*\n` +
                    `Total Achieved Amount: ₹${totalAmount.toLocaleString('en-IN')}\n` +
                    `Total Achieved Accounts: ${totalAccounts.toLocaleString('en-IN')}\n\n` +
                    (metricSummary.length > 0 ? `*Metrics Breakdown:*\n${metricSummary.join('\n')}\n\n` : '') +
                    `_Generated by Daily Reporting App_`;

    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  const handleImportClick = () => {
    setNotification(null); // FIX: Clear notification
    importFileInputRef.current?.click();
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsSubmitting(true);
    setNotification(null); // FIX: Clear notification

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
          PROJECTION_DEMAND_METRIC_NAMES.forEach(metric => { // Only iterate over PROJECTION_DEMAND_METRIC_NAMES from CSV input
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

        setNotification({ message: `Import complete. Added: ${added}, Updated: ${updated} records.`, type: 'success' }); // FIX: Use setNotification
        onDataUpdate(); // Trigger data refresh on dashboard
        await fetchCurrentAchievement(user.staffName, formData.date); // Re-fetch for current user/date

      } catch (err: any) {
        if (isMounted.current) {
          setNotification({ message: err.message || 'Failed to process import file.', type: 'error' }); // FIX: Use setNotification
        }
      } finally {
        if (isMounted.current) {
          setIsSubmitting(false);
        }
      }
    };
    reader.onerror = () => {
      if (isMounted.current) {
        setNotification({ message: 'Failed to read file.', type: 'error' }); // FIX: Use setNotification
        setIsSubmitting(false);
      }
    };
    reader.readAsArrayBuffer(file);
    event.target.value = ''; // Clear input to allow re-uploading the same file
  };

  const renderInputField = (name: string) => {
    // Determine if it's a calculated total field
    const isTotalField = name.includes('TOTAL') || name.includes('GRAND TOTAL');
    const isGrandTotalField = name.includes('GRAND TOTAL');

    return (
      <div key={name}>
        <label htmlFor={name} className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          {name}
        </label>
        <input
          type={isTotalField ? 'text' : 'number'} // Total fields are text (read-only)
          id={name}
          name={name}
          value={
            isTotalField
              ? (Number(formData[name]) || 0).toLocaleString('en-IN') // Format calculated totals
              : (formData[name] === undefined || formData[name] === null || formData[name] === '' ? '' : parseFloat(String(formData[name])).toFixed(0)) // Ensure integer input for others, empty string if no value
          }
          onChange={isTotalField ? () => {} : handleInputChange} // Only allow change for non-total fields
          readOnly={isTotalField} // Make total fields read-only
          disabled={isTotalField || isSubmitting} // Disable during submission
          className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm sm:text-sm
                      ${isTotalField ? 'bg-gray-200 dark:bg-gray-600 border-gray-300 dark:border-gray-500 cursor-not-allowed font-bold' : 'bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500'}
                      ${isGrandTotalField ? 'text-indigo-700 dark:text-indigo-300' : 'text-gray-700 dark:text-gray-300'}
                      ${notification?.type === 'error' ? 'border-red-500' : ''}`}
          min="0"
          placeholder="0"
          aria-label={name}
        />
      </div>
    );
  };

  const renderProductMetrics = useMemo(() => {
    // We want to render ALL_DAILY_ACHIEVEMENT_NUMBER_METRICS, as these are the fields in the interface.
    // The PROJECTION_DEMAND_METRIC_NAMES are individual metrics, and then there are the total fields.
    // Let's ensure the order is logical: individual metrics first, then totals.
    
    const individualMetrics = PROJECTION_DEMAND_METRIC_NAMES.filter(
        metric => !metric.includes('TOTAL') && !metric.includes('GRAND TOTAL')
    );
    const totalMetrics = ALL_DAILY_ACHIEVEMENT_NUMBER_METRICS.filter(
        metric => metric.includes('TOTAL') || metric.includes('GRAND TOTAL')
    );

    const allFieldsToRender = [...individualMetrics, ...totalMetrics];

    return allFieldsToRender.map(renderInputField);
  }, [formData, notification, isSubmitting]); // Re-render if formData or notification/submitting state changes

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100 mb-6">Submit Daily Achievement</h2>

      {notification && ( // FIX: Render notification
        <div className={`p-4 rounded-md flex items-start space-x-3 border-l-4 ${notification.type === 'success' ? 'bg-green-100 dark:bg-green-900/30 border-green-500 text-green-700 dark:text-green-300' : 'bg-red-100 dark:bg-red-900/30 border-red-500 text-red-700 dark:text-red-300'}`} role="alert">
          {notification.type === 'success' ? <CheckCircleIcon className="w-6 h-6 flex-shrink-0" /> : <AlertTriangleIcon className="w-6 h-6 flex-shrink-0" />}
          <div>
            <p className="font-bold">{notification.type === 'success' ? 'Success!' : 'Error'}</p>
            <p>{notification.message}</p>
          </div>
          {notification.type === 'success' && currentAchievement && (
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

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* --- General Info --- */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
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
              disabled={isSubmitting}
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
              disabled={isSubmitting}
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
              disabled={isSubmitting}
              className="mt-1 block w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            />
          </div>
        </div>

        {/* --- Achievement Metrics --- */}
        <div className="space-y-6">
          <h3 className="text-lg font-medium leading-6 text-gray-900 dark:text-gray-100">Achievement Metrics (Product Wise & Account Wise)</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {renderProductMetrics}
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

export default SubmitDailyAchievementPage;