import { ParsedCsvData, CsvRecord } from '../types';

export const parseCsvData = (csvText: string): ParsedCsvData => {
  const lines = csvText.split('\n').filter(line => line.trim() !== '');
  if (lines.length < 5) {
    throw new Error('Invalid or incomplete CSV file. Not enough lines to parse.');
  }

  let summaryLineIndex = -1;
  let tableHeaderIndex = -1;
  let isBranchReportFormat = false; // Flag to distinguish between formats

  // Strategy: Prioritize finding the main data table header first, then look for summary above it.

  // 1. Find the main data table header (e.g., "DATE,STAFF NAME" or "BRANCH NAME,DDS AMT")
  // Search for "DATE" and "STAFF NAME" as primary table header
  for (let i = 0; i < lines.length; i++) {
    const lineUpper = lines[i].trim().toUpperCase();
    const parts = lineUpper.split(',').map(p => p.trim().replace(/"/g, '')); // Remove quotes for robust matching
    if (parts.includes('DATE') && parts.includes('STAFF NAME')) {
      tableHeaderIndex = i;
      // This is likely a staff-level achievement report data table
      isBranchReportFormat = false; // Explicitly mark as not the branch-report-format if this is found
      break;
    }
  }

  // If "DATE,STAFF NAME" header is not found, check for "BRANCH NAME,DDS AMT" format which also acts as a data header
  if (tableHeaderIndex === -1) {
      for (let i = 0; i < lines.length; i++) {
          const lineUpper = lines[i].trim().toUpperCase();
          const parts = lineUpper.split(',').map(p => p.trim().replace(/"/g, '')); // Remove quotes for robust matching
          if (parts.includes('BRANCH NAME') && parts.some(p => p.includes('AMT') || p.includes('AC'))) { // Check for any metric
              tableHeaderIndex = i;
              isBranchReportFormat = true; // This is a branch-report-format, where its "header" is also its "summary-like" header
              break;
          }
      }
  }
  
  if (tableHeaderIndex === -1) {
    throw new Error('Could not find a valid data table header row (expected "DATE,STAFF NAME" or "BRANCH NAME,DDS AMT,...").');
  }

  // 2. Find the overall summary line, typically *above* the main data table, if it's a staff report.
  if (!isBranchReportFormat) { // Only look for a separate "STAFF COUNT" summary if it's not the branch-report-format
      for (let i = 0; i < tableHeaderIndex; i++) {
          const lineUpper = lines[i].trim().toUpperCase();
          const parts = lineUpper.split(',').map(p => p.trim().replace(/"/g, ''));
          // Look for line containing "STAFF" and "COUNT" keywords
          if (parts.includes('STAFF') && parts.includes('COUNT')) {
              summaryLineIndex = i;
              break;
          }
      }
  }

  // --- Parse Summary Data ---
  const summary = {
    staffCount: 'N/A',
    branchCount: 0,
    startDate: 'N/A',
    endDate: 'N/A',
    totalAmount: 0,
    totalAc: 0,
  };

  if (isBranchReportFormat) {
    // For branch-report-format, the "summary" is derived from the tableHeaderIndex line itself or the first data row (more complex).
    // The original logic was: summary.startDate = summaryHeader[1]?.trim() || 'N/A';
    // This implies that the DATE is at index 1 of the header, and totals are further along.
    // Let's refine this to be based on the actual detected header if possible, or leave N/A if it's truly a table header.
    // For now, let's keep it simple: if it's this format, the overall summary might not be available in a single line.
    // The DashboardPage's `mtdData` processing will handle dynamic totals.
    // For initial `summary` object, set sensible defaults or N/A.
    const headerParts = lines[tableHeaderIndex].split(',').map(p => p.trim().replace(/"/g, ''));
    const firstDataRowParts = lines[tableHeaderIndex + 1]?.split(',').map(p => p.trim().replace(/"/g, ''));

    if (headerParts.includes('DATE') && firstDataRowParts && firstDataRowParts.length > 1) {
        summary.startDate = firstDataRowParts[headerParts.indexOf('DATE')] || 'N/A';
        summary.endDate = summary.startDate; // Assume single date if only one date column in header
    }

    // Try to find overall totals if present below the data, but this parser is mainly for records.
    // Leaving `summary.totalAmount` and `totalAc` to 0 or N/A here is acceptable,
    // as DashboardPage's `processMtdData` can recalculate from `records`.

  } else if (summaryLineIndex !== -1) {
    // This is the staff-centric report with a dedicated summary line
    const summaryHeaderValues = lines[summaryLineIndex].split(',').map(p => p.trim().replace(/"/g, ''));
    // Attempt to parse 'STAFF COUNT', 'START DATE', 'END DATE', 'TOTAL AMOUNT', 'TOTAL ACCOUNT' from this line
    const staffCountIdx = summaryHeaderValues.indexOf('STAFF COUNT');
    const startDateIdx = summaryHeaderValues.indexOf('START DATE');
    const endDateIdx = summaryHeaderValues.indexOf('END DATE');
    const totalAmountIdx = summaryHeaderValues.indexOf('TOTAL AMOUNT');
    const totalAcIdx = summaryHeaderValues.indexOf('TOTAL ACCOUNT');

    summary.staffCount = summaryHeaderValues[staffCountIdx + 1] || '0'; // Assuming value is next to key
    summary.startDate = summaryHeaderValues[startDateIdx + 1] || 'N/A';
    summary.endDate = summaryHeaderValues[endDateIdx + 1] || 'N/A';
    summary.totalAmount = parseFloat(summaryHeaderValues[totalAmountIdx + 1]?.replace(/,/g, '') || '0') || 0;
    summary.totalAc = parseInt(summaryHeaderValues[totalAcIdx + 1]?.replace(/,/g, '') || '0', 10) || 0;
  }
  // Note: if no explicit summary line is found for !isBranchReportFormat, summary values remain N/A or 0.
  // This is okay as DashboardPage uses `processMtdData` which computes from `records`.


  // --- Parse Main Table Data ---
  const headers = lines[tableHeaderIndex].split(',').map(h => h.trim().replace(/"/g, ''));
  const records: CsvRecord[] = [];
  
  for (let i = tableHeaderIndex + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('#N/A') || line.toUpperCase().startsWith('GRAND TOTAL') || line.toUpperCase().startsWith('TOTAL') || line.startsWith('"SELECT') || line.toUpperCase().startsWith('STAFF NAME,') || line.toUpperCase().startsWith('TARGET,') || line.toUpperCase().startsWith('ACHIEVEMENT,') || line.toUpperCase().startsWith('BALANCE,') || line.toUpperCase().startsWith('DEMAND,') || line.toUpperCase().startsWith('BRANCH,') || line.startsWith(',"')) {
      continue;
    }
    
    const values = line.split(',').map(v => v.trim().replace(/"/g, '')); // Remove quotes from values
    // Ensure the line has enough values for the headers
    if (values.length < headers.length) {
        // Log a warning or error for malformed line, but don't stop parsing
        console.warn(`Skipping malformed data line ${i + 1}: Expected ${headers.length} values, got ${values.length}. Line: "${line}"`);
        continue;
    }

    const record: CsvRecord = {};
    let hasValue = false; // Check if the record actually contains data other than empty strings

    headers.forEach((header, index) => {
        const value = values[index] || '';
        if(value && value !== '0') hasValue = true; // A "0" is still a valid value

        // Attempt to convert to number if it looks like one, otherwise keep as string
        const numValue = Number(value.replace(/,/g, '')); // Remove commas before converting to number
        record[header] = !isNaN(numValue) && value !== '' ? numValue : value;
    });

    // Only add records that actually contain some meaningful data
    if (hasValue || Object.values(record).some(v => v !== '' && v !== null && v !== undefined && v !== 0)) {
        records.push(record);
    }
  }

  // --- Parse Branch Count --- (This section might be specific to certain report types)
  // Re-evaluating this: the dashboard might process branch count directly from the `records` list now.
  // If `records` contains a 'BRANCH NAME' column, we can derive `branchCount` from unique entries in `records`.
  // The original parsing here might be for a very specific table format that's not always present.
  // Let's make this part optional and derive from `records` if needed by Dashboard.
  
  // For now, I'll update the `branchCount` from the `records` if possible.
  if (records.length > 0 && headers.includes('BRANCH NAME')) {
      const uniqueBranchesInRecords = new Set<string>();
      records.forEach(r => {
          const branch = String(r['BRANCH NAME']);
          if (branch) uniqueBranchesInRecords.add(branch);
      });
      summary.branchCount = uniqueBranchesInRecords.size;
  }


  // --- Parse Target and Previous Year Achievement --- (This section is also very specific)
  // This seems to look for a specific block of data `BRANCH NAME,DDS AMT,...` followed by `TARGET,` and `ACHIEVEMENT,`
  // The original `ParsedCsvData` structure includes `targets` and `previousYearAchievement`.
  // This block should only execute if this specific `targetHeaderIndex` is found.
  let targets: CsvRecord | undefined = undefined;
  let previousYearAchievement: CsvRecord | undefined = undefined;

  const targetHeaderLineCandidates = [
    'BRANCH NAME,DDS AMT,DAM AMT,MIS AMT,FD AMT,RD AMT,SMBG AMT,CUR-GOLD-AMT,CUR-WEL-AMT,SAVS-AMT,DDS AC,DAM AC,MIS AC,FD AC,RD AC,SMBG AC,CUR-GOLD-AC,CUR-WEL-AC,SAVS-AC,GRAND TOTAL AC,GRAND TOTAL AMT',
    'BRANCH NAME,DDS AMT,DAM AMT,MIS AMT,FD AMT,RD AMT,SMBG AMT,CUR-GOLD-AMT,CUR-WEL-AMT,SAVS-AMT,INSU AMT,TASC AMT,SHARE AMT,DDS AC,DAM AC,MIS AC,FD AC,RD AC,SMBG AC,CUR-GOLD-AC,CUR-WEL-AC,SAVS-AC,NEW-SS/AGNT,INSU AC,TASC AC,SHARE AC,GRAND TOTAL AC,GRAND TOTAL AMT' // More comprehensive header from DashboardPage export
  ];
  let targetHeaderMatchIndex = -1;
  let actualTargetHeader = '';

  for (let j = 0; j < lines.length; j++) {
    const lineUpper = lines[j].trim().toUpperCase();
    for (const candidate of targetHeaderLineCandidates) {
      if (lineUpper === candidate.toUpperCase()) {
        targetHeaderMatchIndex = j;
        actualTargetHeader = candidate;
        break;
      }
    }
    if (targetHeaderMatchIndex !== -1) break;
  }


  if (targetHeaderMatchIndex !== -1) {
      const targetHeaders = actualTargetHeader.split(',').map(h => h.trim());
      // Adjust findIndex to search *after* the `targetHeaderMatchIndex`
      const targetLineIndex = lines.findIndex((line, idx) => idx > targetHeaderMatchIndex && line.trim().toUpperCase().startsWith('TARGET,'));
      const achievementLineIndex = lines.findIndex((line, idx) => idx > targetHeaderMatchIndex && line.trim().toUpperCase().startsWith('ACHIEVEMENT,'));

      const parseRow = (lineIndex: number): CsvRecord => {
          const values = lines[lineIndex].split(',').map(v => v.trim().replace(/"/g, ''));
          const record: CsvRecord = {};
          targetHeaders.forEach((header, index) => {
              const value = values[index] || '';
              const cleanedValue = value.replace(/,/g, '');
              const numValue = Number(cleanedValue);
              record[header] = !isNaN(numValue) && cleanedValue !== '' ? numValue : value;
          });
          return record;
      };

      if (targetLineIndex !== -1) {
          targets = parseRow(targetLineIndex);
      }

      if (achievementLineIndex !== -1) {
          previousYearAchievement = parseRow(achievementLineIndex);
      }
  }

  return { summary, headers, records, targets, previousYearAchievement };
};