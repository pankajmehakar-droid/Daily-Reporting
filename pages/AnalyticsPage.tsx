

import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI } from "@google/genai";
import { ParsedCsvData, ChartDataPoint } from '../types';
import SummaryCard from '../components/SummaryCard';
import PieChart from '../components/PieChart';
import BarChart from '../components/BarChart'; // Import BarChart
import { DollarSignIcon, CalendarIcon, HashIcon, BotIcon, LoaderIcon, TrendingUpIcon, XIcon, AlertTriangleIcon } from '../components/icons';
import { convertDDMMYYYYtoYYYYMMDD, convertYYYYMMDDtoDDMMYYYY, getDateRangeFromRecords } from '../utils/dateHelpers';

interface AnalyticsPageProps {
  data: ParsedCsvData | null;
}

// FIX: Initialize GoogleGenAI once outside the component
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });

const parseAndFormatDate = (dateString: string, options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }) => {
    try {
        let date: Date;
        // Handle dd/mm/yyyy format
        if (dateString.includes('/')) {
            const [day, month, year] = dateString.split('/');
            date = new Date(Number(year), Number(month) - 1, Number(day));
        } else {
            // Assume YYYY-MM-DD
            date = new Date(dateString);
        }

        if (isNaN(date.getTime())) return dateString;
        return date.toLocaleDateString('en-US', options);
    } catch(e) {
        return dateString;
    }
}

const AnalyticsPage: React.FC<AnalyticsPageProps> = ({ data }) => {
    // FIX: Moved AI query states from AIQueryBox to AnalyticsPage
    const [aiLoading, setAiLoading] = useState<boolean>(false);
    const [aiResponse, setAiResponse] = useState<string>('');
    const [aiQuery, setAiQuery] = useState<string>(''); // New state for user's AI question
    const [error, setError] = useState<string | null>(null); // Combined error state for both analytics calculations and AI queries

    const [startDateFilter, setStartDateFilter] = useState<string>(''); // YYYY-MM-DD
    const [endDateFilter, setEndDateFilter] = useState<string>('');   // YYYY-MM-DD

    const [selectedDateInChart, setSelectedDateInChart] = useState<string | null>(null); // DD/MM/YYYY
    const [selectedProductInChart, setSelectedProductInChart] = useState<string | null>(null); // e.g., "DDS"

    const isMounted = useRef(false);
    const initialDateRange = useRef<{ earliest: string, latest: string }>({ earliest: '', latest: '' });


    useEffect(() => {
      isMounted.current = true;
      return () => {
        isMounted.current = false;
      };
    }, []);

    // Initialize date filters when data loads
    useEffect(() => {
        if (data && data.records.length > 0) {
            const { earliest, latest } = getDateRangeFromRecords(data.records);
            initialDateRange.current = { earliest, latest }; // Store initial range
            setStartDateFilter(earliest);
            setEndDateFilter(latest);
            setSelectedDateInChart(null);
            setSelectedProductInChart(null);
        } else {
            setStartDateFilter('');
            setEndDateFilter('');
            initialDateRange.current = { earliest: '', latest: '' };
        }
    }, [data]);

    // Memoized filtered records based on date range AND chart selections
    const filteredRecords = useMemo(() => {
        if (!data || data.records.length === 0) return [];

        let records = data.records;
        const start = startDateFilter ? new Date(startDateFilter) : null;
        const end = endDateFilter ? new Date(endDateFilter) : null;

        // Apply date range filter from inputs
        if (start || end) {
            records = records.filter(record => {
                const dateStr = record['DATE'] as string; // dd/mm/yyyy
                if (!dateStr || !/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) return false;

                const [day, month, year] = dateStr.split('/').map(Number);
                const recordDate = new Date(year, month - 1, day);
                recordDate.setHours(0, 0, 0, 0); // Normalize to start of day

                const isAfterStart = !start || recordDate >= start;
                const isBeforeEnd = !end || recordDate <= end;

                return isAfterStart && isBeforeEnd;
            });
        }
        
        // Apply single date filter from Bar Chart click
        if (selectedDateInChart) {
            records = records.filter(record => record['DATE'] === selectedDateInChart);
        }

        // Apply product filter from Pie Chart click
        if (selectedProductInChart) {
            records = records.filter(record => {
                // Check if any metric related to the selected product has a non-zero value
                // Example: if selectedProductInChart is "DDS", check "DDS AMT" and "DDS AC"
                const productMetrics = data.headers.filter(h => h.startsWith(selectedProductInChart));
                return productMetrics.some(metric => {
                    const value = Number(record[metric]);
                    return !isNaN(value) && value > 0;
                });
            });
        }

        return records;
    }, [data, startDateFilter, endDateFilter, selectedDateInChart, selectedProductInChart]);


    const analytics = useMemo(() => {
        if (!filteredRecords || filteredRecords.length === 0) return null;
        
        const amountColumn = data?.headers.includes('GRAND TOTAL AMT') ? 'GRAND TOTAL AMT' : 'TOTAL AMOUNTS'; // Adjusted to use TOTAL AMOUNTS if GRAND TOTAL AMT not present

        // KPI 1: Average Daily Amount
        const dailyTotals: { [date: string]: number } = {}; // date here is DD/MM/YYYY
        filteredRecords.forEach(record => {
            const date = record['DATE'] as string;
            const amount = record[amountColumn] as number;
            if (date && typeof amount === 'number') {
                dailyTotals[date] = (dailyTotals[date] || 0) + amount;
            }
        });
        const uniqueDays = Object.keys(dailyTotals).length;
        const totalAmount = filteredRecords.reduce((sum, record) => sum + (Number(record[amountColumn]) || 0), 0);
        const averageDailyAmount = uniqueDays > 0 ? totalAmount / uniqueDays : 0;

        // KPI 2: Highest Performing Day
        const highestDay = Object.entries(dailyTotals).reduce(
            (max, entry) => (entry[1] > max.amount ? { date: entry[0], amount: entry[1] } : max),
            { date: 'N/A', amount: 0 }
        );

        // KPI 3: Total Transactions (valid rows)
        const totalTransactions = filteredRecords.length;
        
        // Data for Pie Chart: Contribution by Product
        // Filter out "GRAND TOTAL AMT" and "GRAND TOTAL AC" for individual product contribution
        const amountHeaders = data?.headers.filter(h => h.endsWith('AMT') && h !== amountColumn) || [];
        const accountHeaders = data?.headers.filter(h => h.endsWith('AC') && h !== 'GRAND TOTAL AC') || [];
        const relevantHeaders = [...new Set([...amountHeaders, ...accountHeaders])]; // Unique headers

        const productContributions: { [product: string]: number } = {};
        relevantHeaders.forEach(header => {
            // Extract product name (e.g., "DDS AMT" -> "DDS")
            const productName = header.replace(/ (AMT|AC)$/, '');
            const total = filteredRecords.reduce((sum, record) => {
                const value = record[header];
                return sum + (typeof value === 'number' ? value : 0);
            }, 0);
            productContributions[productName] = (productContributions[productName] || 0) + total;
        });

        const pieChartData: ChartDataPoint[] = Object.entries(productContributions)
            .map(([label, value]) => ({ label, value }))
            .filter(d => d.value > 0)
            .sort((a,b) => b.value - a.value);

        // KPI 4: Top Product
        const topProduct = pieChartData[0] ? pieChartData[0].label : 'N/A';

        // Data for Daily Performance Bar Chart
        const dailyPerformanceChartData: ChartDataPoint[] = Object.entries(dailyTotals)
            .map(([dateDDMMYYYY, amount]) => ({
                label: parseAndFormatDate(dateDDMMYYYY, { day: 'numeric', month: 'short' }), // Formatted for x-axis display
                value: amount,
                originalLabel: dateDDMMYYYY // Store original DD/MM/YYYY date
            }))
            .sort((a, b) => {
                const dateA = new Date(convertDDMMYYYYtoYYYYMMDD(a.originalLabel!)).getTime();
                const dateB = new Date(convertDDMMYYYYtoYYYYMMDD(b.originalLabel!)).getTime();
                return dateA - dateB;
            });


        return {
            averageDailyAmount,
            highestDay,
            totalTransactions,
            topProduct,
            pieChartData,
            totalAmount,
            dailyPerformanceChartData
        };
    }, [filteredRecords, data]);

    const handleBarClick = (originalDateDDMMYYYY: string) => {
        setSelectedDateInChart(prev => prev === originalDateDDMMYYYY ? null : originalDateDDMMYYYY);
        // When a bar is clicked, also update the main date filters to match the clicked date
        setStartDateFilter(convertDDMMYYYYtoYYYYMMDD(originalDateDDMMYYYY));
        setEndDateFilter(convertDDMMYYYYtoYYYYMMDD(originalDateDDMMYYYY));
        setSelectedProductInChart(null); // Clear product filter when date filter is applied
    };

    const handleSliceClick = (productLabel: string) => {
        setSelectedProductInChart(prev => prev === productLabel ? null : productLabel);
        setSelectedDateInChart(null); // Clear date filter when product filter is applied
        // Reset main date filters to the full range when a product filter is applied
        if (data) {
            const { earliest, latest } = getDateRangeFromRecords(data.records);
            setStartDateFilter(earliest);
            setEndDateFilter(latest);
        }
    };

    const handleClearDateFilter = () => {
        setSelectedDateInChart(null);
        // Reset main date filters to the full range when clearing chart filter
        if (data) {
            const { earliest, latest } = getDateRangeFromRecords(data.records);
            setStartDateFilter(earliest);
            setEndDateFilter(latest);
        }
    };
    const handleClearProductFilter = () => setSelectedProductInChart(null);

    const handleClearAllChartFilters = () => {
        setSelectedDateInChart(null);
        setSelectedProductInChart(null);
        // Reset date range filters to initial loaded range
        setStartDateFilter(initialDateRange.current.earliest);
        setEndDateFilter(initialDateRange.current.latest);
    };


    const handleManualDateFilterChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'start' | 'end') => {
        if (type === 'start') {
            setStartDateFilter(e.target.value);
        } else {
            setEndDateFilter(e.target.value);
        }
        setSelectedDateInChart(null); // Clear chart selection on manual date filter change
    };

    // FIX: Moved handleAiQuery function from AIQueryBox.tsx
    const handleAiQuery = async () => {
        if (!aiQuery.trim() || !data || !analytics) { // Ensure analytics data is also available
            setError("Please enter a question and ensure data is loaded.");
            return;
        }

        setAiLoading(true);
        setAiResponse('');
        setError(null);
        
        try {
            const recordsSample = data.records.slice(0, 5).map(r => JSON.stringify(r)).join('\n'); // Smaller sample for brevity
            const prompt = `
                You are an expert data analyst. Based on the provided CSV data summary, analytics, and a small sample of records, answer the user's question. Be concise, insightful, and directly address the question.

                --- Data Overview ---
                Dataset Title: Daily Reporting Data
                Date Range Covered: ${data.summary.startDate} to ${data.summary.endDate}
                Total Staff Records: ${data.summary.staffCount}
                Total Branches Involved: ${data.summary.branchCount}
                Overall Total Amount Achieved: ${data.summary.totalAmount.toLocaleString('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 })}
                Overall Total Accounts Achieved: ${data.summary.totalAc.toLocaleString()}

                --- Current Filtered Analytics ---
                (Based on selected date range: ${startDateFilter} to ${endDateFilter})
                Average Daily Amount: ${analytics.averageDailyAmount.toLocaleString('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 })}
                Highest Performing Day: ${analytics.highestDay.date} with ${analytics.highestDay.amount.toLocaleString('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 })}
                Total Transactions in Filter: ${analytics.totalTransactions}
                Top Product by Value: ${analytics.topProduct}
                Total Amount in Filtered Range: ${analytics.totalAmount.toLocaleString('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 })}

                --- Data Structure (Headers) ---
                Available Headers: ${data.headers.join(', ')}

                --- Sample Data Records (first 5) ---
                ${recordsSample}

                --- User's Question ---
                "${aiQuery}"

                --- AI Answer ---
            `;
            
            // FIX: Use ai.models.generateContent instead of deprecated direct call
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
            });

            if (isMounted.current) {
                setAiResponse(response.text);
            }

        } catch (err) {
            if (isMounted.current) {
                setError(err instanceof Error ? err.message : 'An error occurred while communicating with the AI.');
            }
        } finally {
            if (isMounted.current) {
                setAiLoading(false);
            }
        }
    };


    if (!data) {
        return (
            <div className="text-center py-20 px-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
                <h2 className="text-2xl font-semibold text-gray-700 dark:text-gray-200">Analytics</h2>
                <p className="mt-2 text-gray-500 dark:text-gray-400">
                    Upload a report CSV to see performance analytics.
                </p>
            </div>
        );
    }

    if (!analytics) {
        return (
            <div className="text-center py-20 px-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
                <h2 className="text-2xl font-semibold text-gray-700 dark:text-gray-200">Performance Analytics</h2>
                <p className="mt-2 text-gray-500 dark:text-gray-400">
                    No data available for the selected date range or the uploaded file is empty.
                </p>
            </div>
        );
    }

    // Dynamic titles for charts
    const dailyPerformanceTitle = `Daily Performance (Amount) ${selectedProductInChart ? `for ${selectedProductInChart} ` : ''}from ${parseAndFormatDate(convertYYYYMMDDtoDDMMYYYY(startDateFilter))} to ${parseAndFormatDate(convertYYYYMMDDtoDDMMYYYY(endDateFilter))}`;
    const productContributionTitle = `Contribution by Product${selectedDateInChart ? ` on ${parseAndFormatDate(selectedDateInChart, { year: 'numeric', month: 'long', day: 'numeric' })}` : ''}`;


    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100">Performance Analytics</h2>
            
            {/* Date Range Filters */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md flex flex-col sm:flex-row items-center gap-4">
                <div className="flex-1 w-full">
                    <label htmlFor="startDate" className="label-style">Start Date</label>
                    <input
                        type="date"
                        id="startDate"
                        value={startDateFilter}
                        onChange={(e) => handleManualDateFilterChange(e, 'start')}
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
                        onChange={(e) => handleManualDateFilterChange(e, 'end')}
                        className="mt-1 block w-full input-style"
                        aria-label="End date filter"
                    />
                </div>
                 {(selectedDateInChart || selectedProductInChart || startDateFilter !== initialDateRange.current.earliest || endDateFilter !== initialDateRange.current.latest) && (
                    <div className="flex-initial w-full sm:w-auto">
                        <label className="label-style opacity-0 pointer-events-none">Clear Filters</label>
                        <button
                            onClick={handleClearAllChartFilters}
                            className="mt-1 btn btn-secondary flex items-center justify-center gap-2 w-full"
                        >
                            <XIcon className="w-4 h-4" /> Clear All Chart Filters
                        </button>
                    </div>
                )}
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <SummaryCard title="Avg. Daily Amount" value={analytics.averageDailyAmount.toLocaleString('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 })} icon={<DollarSignIcon className="w-6 h-6" />} color="text-yellow-500" />
                <SummaryCard title="Highest Day" value={analytics.highestDay.date === 'N/A' ? 'No Data' : parseAndFormatDate(analytics.highestDay.date)} icon={<CalendarIcon className="w-6 h-6" />} color="text-green-500" />
                <SummaryCard title="Total Transactions" value={analytics.totalTransactions.toString()} icon={<HashIcon className="w-6 h-6" />} color="text-blue-500" />
                <SummaryCard title="Top Product" value={analytics.topProduct} icon={<TrendingUpIcon className="w-6 h-6" />} color="text-indigo-500" />
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                 {/* Daily Performance Bar Chart */}
                <div className="relative">
                    <BarChart
                        title={dailyPerformanceTitle}
                        data={analytics.dailyPerformanceChartData}
                        onBarClick={handleBarClick}
                        highlightedLabel={selectedDateInChart}
                    />
                    {selectedDateInChart && (
                        <button 
                            onClick={handleClearDateFilter}
                            className="absolute top-8 right-8 btn btn-secondary btn-sm flex items-center gap-1"
                        >
                            <XIcon className="w-3 h-3"/> Clear Date Filter
                        </button>
                    )}
                </div>
                
                <div className="relative">
                    <PieChart 
                        title={productContributionTitle} 
                        data={analytics.pieChartData} 
                        onSliceClick={handleSliceClick}
                        highlightedLabel={selectedProductInChart}
                    />
                    {selectedProductInChart && (
                        <button 
                            onClick={handleClearProductFilter}
                            className="absolute top-8 right-8 btn btn-secondary btn-sm flex items-center gap-1"
                        >
                            <XIcon className="w-3 h-3"/> Clear Product Filter
                        </button>
                    )}
                </div>
            </div>

            {/* FIX: Integrated AIQueryBox logic directly into AnalyticsPage */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 flex flex-col">
                <div className="flex items-center space-x-3 mb-4">
                    <BotIcon className="w-7 h-7 text-indigo-500" />
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">AI-Powered Summary</h3>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch gap-2">
                    <input
                        type="text"
                        value={aiQuery}
                        onChange={(e) => setAiQuery(e.target.value)}
                        placeholder="e.g., 'Who had the highest amount?'"
                        className="flex-grow w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                        onKeyDown={(e) => e.key === 'Enter' && handleAiQuery()}
                        disabled={aiLoading}
                    />
                    <button
                        onClick={handleAiQuery}
                        disabled={aiLoading || !aiQuery.trim()}
                        className="px-4 py-2 flex items-center justify-center bg-indigo-600 text-white font-semibold rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-400 disabled:cursor-not-allowed"
                    >
                        {aiLoading ? <LoaderIcon className="w-5 h-5" /> : 'Ask'}
                    </button>
                </div>
                <div className="mt-4 flex-grow">
                    {(aiResponse || error) && (
                        <div className="h-full max-h-48 overflow-y-auto p-4 bg-gray-50 dark:bg-gray-700/50 rounded-md border border-gray-200 dark:border-gray-600">
                            {aiResponse && <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{aiResponse}</p>}
                            {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AnalyticsPage;