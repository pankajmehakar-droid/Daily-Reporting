
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { User, Projection, PROJECTION_DEMAND_METRIC_NAMES } from '../types';
import { getProjectionsForStaff, saveProjection, updateProjection } from '../services/dataService';
import { LoaderIcon, CheckCircleIcon, AlertTriangleIcon, Share2Icon } from '../components/icons';
import { getTodayDateYYYYMMDD, convertYYYYMMDDtoDDMMYYYY } from '../utils/dateHelpers';


interface ProjectionFormData {
    [key: string]: string | number;
    date: string;
    staffEmployeeCode: string;
}

interface SubmitProjectionPageProps {
  user: User;
  onNavigate: (page: 'reports_today_submitted') => void; // Added onNavigate to redirect
}

const SubmitProjectionPage: React.FC<SubmitProjectionPageProps> = ({ user, onNavigate }) => {
  const [formData, setFormData] = useState<ProjectionFormData>({
      date: getTodayDateYYYYMMDD(),
      staffEmployeeCode: user.employeeCode || '',
  });
  const [currentProjections, setCurrentProjections] = useState<Projection[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isMounted = useRef(false);

  const { grandTotalAmount, grandTotalAccount } = useMemo(() => {
    let totalAmount = 0;
    let totalAccount = 0;
    PROJECTION_DEMAND_METRIC_NAMES.forEach(metric => {
        const value = Number(formData[metric]) || 0;
        if (metric.includes('AMT')) {
            totalAmount += value;
        } else if (metric.includes('AC') || metric === 'NEW-SS/AGNT') {
            totalAccount += value;
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

  const fetchCurrentProjections = useCallback(async (employeeCode: string, date: string) => {
      try {
          const projections = await getProjectionsForStaff(employeeCode, date);
          if (isMounted.current) {
              setCurrentProjections(projections);
              // Populate form data from existing projections
              const newFormData: ProjectionFormData = {
                  date: date,
                  staffEmployeeCode: employeeCode,
              };
              projections.forEach(p => {
                  newFormData[p.metric] = p.value;
              });
              setFormData(newFormData);
          }
      } catch (err) {
          if (isMounted.current) {
              setError(err instanceof Error ? err.message : 'Failed to fetch current projections.');
          }
      }
  }, [isMounted]);

  useEffect(() => {
      if (user.employeeCode && formData.date) {
          fetchCurrentProjections(user.employeeCode, formData.date);
      }
  }, [user.employeeCode, formData.date, fetchCurrentProjections]);


  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? (value === '' ? 0 : parseFloat(value)) : value,
    }));
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
        const promises: Promise<Projection>[] = [];
        
        PROJECTION_DEMAND_METRIC_NAMES.forEach(metric => {
            const existingProjection = currentProjections.find(p => p.metric === metric);
            
            // Only process if the metric has an existing projection or was touched in the form
            if (existingProjection || formData.hasOwnProperty(metric)) {
                const value = Number(formData[metric]) || 0;

                if (existingProjection) {
                    // Update if value is different
                    if (existingProjection.value !== value) {
                        promises.push(updateProjection(existingProjection.id, { value }));
                    }
                } else {
                    // Create a new one since it was touched and didn't exist before.
                    // This will save projections for 0 if the user explicitly interacted with the field.
                    promises.push(saveProjection({
                        staffEmployeeCode: user.employeeCode || '',
                        date: formData.date,
                        metric: metric,
                        value: value,
                    }));
                }
            }
        });

        await Promise.all(promises);
        
        if (isMounted.current) {
            setSubmitSuccess(true);
            await fetchCurrentProjections(user.employeeCode || '', formData.date);
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
    if (!user.staffName || !formData.date || currentProjections.length === 0) {
      alert("No projection data to share for this date.");
      return;
    }

    const formattedDate = convertYYYYMMDDtoDDMMYYYY(formData.date);
    let totalAmount = 0;
    let totalAccounts = 0;
    const metricSummary: string[] = [];

    currentProjections.forEach(p => {
      const value = p.value || 0;
      if (p.metric.includes('AMT')) {
        totalAmount += value;
      } else if (p.metric.includes('AC') || p.metric === 'NEW-SS/AGNT') {
        totalAccounts += value;
      }
      metricSummary.push(`*${p.metric}:* ${value.toLocaleString('en-IN')}`);
    });

    const message = `*Daily Projection Report*\n\n` +
                    `*Staff Name:* ${user.staffName}\n` +
                    `*Date:* ${formattedDate}\n\n` +
                    `*Summary:*\n` +
                    `Total Projected Amount: ₹${totalAmount.toLocaleString('en-IN')}\n` +
                    `Total Projected Accounts: ${totalAccounts.toLocaleString('en-IN')}\n\n` +
                    `*Metrics Breakdown:*\n` +
                    `${metricSummary.join('\n')}\n\n` +
                    `_Generated by Daily Reporting App_`;

    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  const productPrefixes = [
    'DDS', 'DAM', 'MIS', 'FD', 'RD', 'SMBG', 'CUR-GOLD', 'CUR-WEL', 'SAVS', 'INSU', 'TASC', 'SHARE'
  ];
  const standaloneMetrics = ['NEW-SS/AGNT'];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
        <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100 mb-6">Submit Daily Projection</h2>

        {submitSuccess && (
            <div className="bg-green-100 dark:bg-green-900/30 border-l-4 border-green-500 text-green-700 dark:text-green-300 p-4 rounded-md flex items-start space-x-3 mb-6" role="alert">
                <CheckCircleIcon className="w-6 h-6 flex-shrink-0" />
                <div>
                    <p className="font-bold">Success!</p>
                    <p>Your daily projections have been submitted successfully.</p>
                </div>
                {currentProjections.length > 0 && (
                    <button
                        onClick={handleShareOnWhatsApp}
                        className="ml-auto btn btn-green flex items-center gap-2"
                        aria-label="Share projection on WhatsApp"
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
                    <label htmlFor="staffEmployeeCode" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Staff Name
                    </label>
                    <input
                        type="text"
                        id="staffEmployeeCode"
                        name="staffEmployeeCode"
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
                        name="branchName"
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

            {/* --- Projections --- */}
            <div className="space-y-6">
                <h3 className="text-lg font-medium leading-6 text-gray-900 dark:text-gray-100">Projections (Product Wise & Account Wise)</h3>
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
                                        <label htmlFor={amtMetric} className="sr-only">{amtMetric}</label>
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
                                            aria-label={amtMetric}
                                        />
                                    </div>
                                    {/* Account Input */}
                                    <div className="flex-1">
                                        <label htmlFor={acMetric} className="sr-only">{acMetric}</label>
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
                                            aria-label={acMetric}
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
            <div className="pt-5 border-t border-gray-200 dark:border-gray-700">
                <div className="flex justify-end">
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
                            currentProjections.length > 0 ? 'Update Projections' : 'Submit Projections'
                        )}
                    </button>
                </div>
            </div>
        </form>
    </div>
  );
};

export default SubmitProjectionPage;