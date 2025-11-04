import React, { useState, useMemo } from 'react';
import { CsvRecord } from '../types';
import { SearchIcon, FileDownIcon } from './icons'; // Import FileDownIcon

// Declare XLSX from the global scope (assuming it's loaded via script tag in index.html)
declare const XLSX: any;

interface DataTableProps {
  headers: string[];
  records: CsvRecord[];
  title: string;
  action?: React.ReactNode | React.ReactNode[]; // Updated to accept single node or array of nodes
  tableId?: string; // New prop for table ID
  exportFileName?: string; // New prop for CSV export
}

const DataTable: React.FC<DataTableProps> = ({ headers, records, title, action, tableId, exportFileName }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) {
      return records;
    }
    const lowercasedTerm = searchTerm.toLowerCase();
    return records.filter(record =>
      Object.values(record).some(value =>
        String(value).toLowerCase().includes(lowercasedTerm)
      )
    );
  }, [records, searchTerm]);

  const handleExportCsv = () => {
    if (!filteredRecords || filteredRecords.length === 0) {
      alert("No data available to export.");
      return;
    }
    const worksheet = XLSX.utils.json_to_sheet(filteredRecords);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Data");
    XLSX.writeFile(workbook, `${exportFileName}.xlsx`);
  };

  if (records.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 text-center">
        <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">No Data Records Found</h3>
        <p className="text-gray-500 dark:text-gray-400 mt-2">
          The uploaded file does not contain any valid data rows after the header.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
      <div className="px-4 py-3 sm:px-6 flex flex-col sm:flex-row justify-between items-center gap-3 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 self-start sm:self-center">{title}</h3>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto flex-wrap">
          <div className="relative w-full sm:w-auto">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <SearchIcon className="w-5 h-5 text-gray-400" />
            </span>
            <input
              type="text"
              placeholder="Search records..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full sm:w-56 pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
              aria-label="Search data records"
            />
          </div>
          <div className="flex gap-3"> {/* Container for actions */}
            {exportFileName && (
              <button
                onClick={handleExportCsv}
                className="flex items-center gap-2 px-3 py-1.5 bg-green-500 text-white text-sm font-semibold rounded-md shadow-sm hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                aria-label="Export to CSV"
              >
                <FileDownIcon className="w-4 h-4" />
                Export CSV
              </button>
            )}
            {/* Render custom actions */}
            {Array.isArray(action) ? action.map((act, idx) => <React.Fragment key={idx}>{act}</React.Fragment>) : action}
          </div>
        </div>
      </div>
      
      {filteredRecords.length > 0 ? (
        <div className="overflow-x-auto">
          <table id={tableId} className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                {headers.map((header) => (
                  <th
                    key={header}
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredRecords.map((record, rowIndex) => (
                <tr key={rowIndex} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  {headers.map((header) => (
                    <td
                      key={`${rowIndex}-${header}`}
                      className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300"
                    >
                      {record[header] ?? ''}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="p-6 text-center">
            <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">No Matching Records Found</h3>
            <p className="text-gray-500 dark:text-gray-400 mt-2">
                Your search for "{searchTerm}" did not yield any results. Try a different query.
            </p>
        </div>
      )}
    </div>
  );
};

export default DataTable;