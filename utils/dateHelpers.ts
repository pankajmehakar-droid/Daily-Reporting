export const getMonthString = (date = new Date()): string => {
    return date.toISOString().slice(0, 7); // YYYY-MM
};

export const getYearString = (date = new Date()): string => {
    return date.getFullYear().toString(); // YYYY
};

export const getTodayDateYYYYMMDD = (): string => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
};

export const getDaysInMonth = (year: number, month: number): number => {
    // Month is 1-indexed here (e.g., 1 for January, 12 for December)
    // Date(year, month, 0) gives the last day of the previous month
    // Date(year, month + 1, 0) gives the last day of the current month
    return new Date(year, month, 0).getDate();
};

export const getDaysRemainingInMonth = (date: Date = new Date()): number => {
    const today = new Date(date);
    today.setHours(0, 0, 0, 0); // Normalize to start of day

    const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    lastDayOfMonth.setHours(0, 0, 0, 0); // Normalize to start of day

    const diffTime = lastDayOfMonth.getTime() - today.getTime();
    // Add 1 to include the current day if it's not past the last day
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return Math.max(0, diffDays); // Ensure it's not negative
};

// Converts DD/MM/YYYY to YYYY-MM-DD
export const convertDDMMYYYYtoYYYYMMDD = (dateStr: string): string => {
    if (!dateStr || !/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
        return '';
    }
    const [day, month, year] = dateStr.split('/');
    return `${year}-${month}-${day}`;
};

// Converts YYYY-MM-DD to DD/MM/YYYY
export const convertYYYYMMDDtoDDMMYYYY = (dateStr: string): string => {
    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        return '';
    }
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
};

// Converts YYYY-MM to MM/YYYY
export const convertYYYYMMtoMMYYYY = (monthStr: string): string => {
    if (!monthStr || !/^\d{4}-\d{2}$/.test(monthStr)) {
        return '';
    }
    const [year, month] = monthStr.split('-');
    return `${month}/${year}`;
};


// Finds the earliest and latest date from a list of records based on the 'DATE' column (dd/mm/yyyy)
export const getDateRangeFromRecords = (records: { [key: string]: string | number }[]): { earliest: string, latest: string } => {
    let earliestDate: Date | null = null;
    let latestDate: Date | null = null;

    records.forEach(record => {
        const dateStr = record['DATE'] as string;
        if (dateStr && /^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
            const [day, month, year] = dateStr.split('/').map(Number);
            const recordDate = new Date(year, month - 1, day);

            if (!earliestDate || recordDate < earliestDate) {
                earliestDate = recordDate;
            }
            if (!latestDate || recordDate > latestDate) {
                latestDate = recordDate;
            }
        }
    });

    const formatToYYYYMMDD = (date: Date | null): string => {
        if (!date) return '';
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    };

    return {
        earliest: formatToYYYYMMDD(earliestDate),
        latest: formatToYYYYMMDD(latestDate)
    };
};

export const formatDisplayDate = (dateString: string | undefined) => {
    if (!dateString) return 'N/A';
    // dateString is YYYY-MM-DD
    const date = new Date(dateString + 'T00:00:00'); // To avoid timezone issues
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

// Updated getKraStatus to handle periodType
import { TargetPeriodType } from '../types'; // Ensure TargetPeriodType is imported

export const getKraStatus = (dueDate: string | undefined, periodType?: TargetPeriodType, period?: string) => {
    if (periodType === 'ytd') {
        // YTD targets typically don't have a strict "due date" status in the same way
        // and are cumulative. We can show "Ongoing" or "Cumulative"
        return { text: `Cumulative for ${period}`, color: 'text-gray-500 dark:text-gray-400' };
    }
    
    if (!dueDate) return { text: 'No due date', color: 'text-gray-500 dark:text-gray-400' };
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDate + 'T00:00:00');
    
    if (due < today) {
        return { text: `Overdue (Due: ${formatDisplayDate(dueDate)})`, color: 'text-red-500 font-semibold' };
    }
    const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays <= 0) { // Due today
        return { text: `Due Today`, color: 'text-orange-500 font-semibold' };
    }
    if (diffDays <= 7) {
        return { text: `Due in ${diffDays} day(s)`, color: 'text-yellow-600 dark:text-yellow-400' };
    }
    return { text: `On Track (Due: ${formatDisplayDate(dueDate)})`, color: 'text-green-600 dark:text-green-400' };