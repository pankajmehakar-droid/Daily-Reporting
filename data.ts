import { StaffMember, Projection, Demand, BranchTarget, DailyAchievementRecord, Kra, DesignationKRA, Zone, Region, District, TargetPeriodType } from './types';

export const csvData = ``;

// New: Mock data for Zones
export const MOCK_ZONES: Zone[] = [
  { id: 'zone-1', name: 'Zone-1' },
  { id: 'zone-2', name: 'Zone-2' },
  { id: 'zone-3', name: 'Zone-3' },
  { id: 'zone-4', name: 'Zone-4' },
  { id: 'zone-5', name: 'Zone-5' },
];

// New: Mock data for Regions
export const MOCK_REGIONS: Region[] = [
  { id: 'region-1', name: 'Region-1', zoneId: 'zone-1' },
  { id: 'region-2', name: 'Region-2', zoneId: 'zone-1' },
  { id: 'region-3', name: 'Region-3', zoneId: 'zone-2' },
  { id: 'region-4', name: 'Region-4', zoneId: 'zone-2' },
  { id: 'region-5', name: 'Region-5', zoneId: 'zone-3' },
];

// New: Mock data for Districts
export const MOCK_DISTRICTS: District[] = [
  { id: 'district-1', name: 'YAVATMAL', regionId: 'region-2' },
  { id: 'district-2', name: 'NAGPUR', regionId: 'region-1' },
  { id: 'district-3', name: 'AMRAVATI', regionId: 'region-2' },
  { id: 'district-4', name: 'NANDED', regionId: 'region-2' },
  { id: 'district-5', name: 'AKOLA', regionId: 'region-1' },
];

export const FULL_STAFF_DATA: Omit<StaffMember, 'id'>[] = [
  {
    // Corrected property names to match StaffMember interface
    zone: "Zone-1",
    region: "Region-2",
    districtName: "NAGPUR",
    branchName: "NAGPUR",
    employeeName: "NISHANT SHELARE",
    employeeCode: "100",
    function: "ZONAL MANAGER",
    contactNumber: "9876543210",
    managedZones: ["Zone-1", "Zone-2"] // Example: Zonal Manager manages multiple zones
  },
  {
    zone: "Zone-1",
    region: "Region-2",
    districtName: "YAVATMAL",
    branchName: "YAVATMAL",
    employeeName: "GAURAV WAKODIKAR",
    employeeCode: "270",
    // Fix: Corrected typo from 'SR DISTRICT HEAD' to 'SENIOR DISTRICT HEAD'
    function: "SENIOR DISTRICT HEAD",
    contactNumber: "8765432109",
    managedBranches: ["NER", "DARWHA", "ARNI","UMARKHED","MAHAGAON","MAREGAON","DIGRAS","PUSAD","PANDHARKAWADA","KALAMB","RALEGAON","YAVATMAL","GHATANJI","ZARI JAMNI","WANI"], // Example: District Head manages multiple branches
    reportsToEmployeeCode: "100" // Reports to NISHANT SHELARE (Zonal Manager)
  },
  {
    zone: "Zone-1",
    region: "Region-2",
    districtName: "YAVATMAL",
    branchName: "UMARKHED",
    employeeName: "AMOL JAGTAP",
    employeeCode: "2003",
    function: "ASSISTANT DISTRICT HEAD",
    contactNumber: "7654321098",
    managedBranches: ["NER", "DARWHA", "ARNI","UMARKHED","MAHAGAON","MAREGAON","DIGRAS"], // Example: Assistant District Head manages multiple branches
    reportsToEmployeeCode: "270" // Reports to GAURAV WAKODIKAR (District Head)
  },
  {
    zone: "Zone-1",
    region: "Region-2",
    districtName: "YAVATMAL", 
    branchName: "NER",
    employeeName: "PANKAJ MEHAKAR",
    employeeCode: "6642",
    function: "BRANCH MANAGER",
    contactNumber: "9000011111",
    reportsToEmployeeCode: "270" // Reports to GAURAV WAKODIKAR (District Head)
  },
  {
    zone: "Zone-1",
    region: "Region-2",
    districtName: "YAVATMAL", 
    branchName: "NER",
    employeeName: "TRISHUL KOSHTI",
    employeeCode: "2266",
    function: "ASSISTANT BRANCH MANAGER",
    contactNumber: "9000011111",
    reportsToEmployeeCode: "6642" // Reports to Pankaj Mehakar (Branch Manager)
  },
  {
    zone: "Zone-1",
    region: "Region-2",
    districtName: "YAVATMAL", 
    branchName: "DIGRAS",
    employeeName: "SUSHIL GAIKWAD",
    employeeCode: "6642", // Duplicate employee code, intentional for mock data to show behavior
    function: "BRANCH MANAGER",
    contactNumber: "9000011111",
    reportsToEmployeeCode: "270" // Reports to GAURAV WAKODIKAR (District Head)
  },
  {
    zone: "Zone-1",
    region: "Region-2",
    districtName: "YAVATMAL", 
    branchName: "NER",
    employeeName: "VIJENDRA PATMASE",
    employeeCode: "3531",
    function: "SALES MANAGER-CASA",
    contactNumber: "9876512345",
    reportsToEmployeeCode: "270" // Reports to GAURAV WAKODIKAR (District Head)

  },
  {
    zone: "Zone-1",
    region: "Region-2",
    districtName: "YAVATMAL", 
    branchName: "YAVATMAL",
    employeeName: "NILESH INGALE",
    employeeCode: "2004",
    function: "SALES MANAGER-DDS",
    contactNumber: "9876512345",
    reportsToEmployeeCode: "270" // Reports to GAURAV WAKODIKAR (District Head)
  },
  {
    zone: "Zone-1",
    region: "Region-2",
    districtName: "YAVATMAL", 
    branchName: "NER",
    employeeName: "DATTA GIRI",
    employeeCode: "3937",
    // Fix: Corrected typo from 'BUSINESS DEVLOPMENT EXCECUTIVE' to 'BUSINESS DEVELOPMENT EXECUTIVE'
    function: "BUSINESS DEVELOPMENT EXECUTIVE",
    contactNumber: "9988776611",
    reportsToEmployeeCode: "6642" // Reports to Pankaj Mehakar (Branch Manager) - This is an example, should map to their actual BM
  },
];

export const MOCK_PROJECTION_DATA: Projection[] = [];
export const MOCK_DEMAND_DATA: Demand[] = [];
export const MOCK_BRANCH_TARGETS: BranchTarget[] = [];
export const MOCK_DAILY_ACHIEVEMENT_RECORDS: DailyAchievementRecord[] = [
  {
    id: 'ach-1',
    date: '2024-07-20',
    'STAFF NAME': 'PANKAJ MEHAKAR',
    'BRANCH NAME': 'NER',
    'DDS AMT': 150000,
    'DAM AMT': 0,
    'MIS AMT': 0,
    'FD AMT': 500000,
    'RD AMT': 0,
    'SMBG AMT': 0,
    'CUR-GOLD-AMT': 0,
    'CUR-WEL-AMT': 0,
    'SAVS-AMT': 20000,
    'INSU AMT': 0,
    'TASC AMT': 0,
    'SHARE AMT': 0,
    'DDS AC': 3,
    'DAM AC': 0,
    'MIS AC': 0,
    'FD AC': 1,
    'RD AC': 0,
    'SMBG AC': 0,
    'CUR-GOLD-AC': 0,
    'CUR-WEL-AC': 0,
    'SAVS-AC': 1,
    'NEW-SS/AGNT': 0,
    'INSU AC': 0,
    'TASC AC': 0,
    'SHARE AC': 0,
    'TOTAL ACCOUNTS': 5,
    'TOTAL AMOUNTS': 670000,
    'GRAND TOTAL AC': 5,
    'GRAND TOTAL AMT': 670000,
  },
  {
    id: 'ach-2',
    date: '2024-07-21',
    'STAFF NAME': 'PANKAJ MEHAKAR',
    'BRANCH NAME': 'NER',
    'DDS AMT': 100000,
    'DAM AMT': 0,
    'MIS AMT': 0,
    'FD AMT': 300000,
    'RD AMT': 0,
    'SMBG AMT': 0,
    'CUR-GOLD-AMT': 0,
    'CUR-WEL-AMT': 0,
    'SAVS-AMT': 10000,
    'INSU AMT': 0,
    'TASC AMT': 0,
    'SHARE AMT': 0,
    'DDS AC': 2,
    'DAM AC': 0,
    'MIS AC': 0,
    'FD AC': 1,
    'RD AC': 0,
    'SMBG AC': 0,
    'CUR-GOLD-AC': 0,
    'CUR-WEL-AC': 0,
    'SAVS-AC': 1,
    'NEW-SS/AGNT': 0,
    'INSU AC': 0,
    'TASC AC': 0,
    'SHARE AC': 0,
    'TOTAL ACCOUNTS': 4,
    'TOTAL AMOUNTS': 410000,
    'GRAND TOTAL AC': 4,
    'GRAND TOTAL AMT': 410000,
  },
  {
    id: 'ach-3',
    date: '2024-07-20',
    'STAFF NAME': 'TRISHUL KOSHTI',
    'BRANCH NAME': 'NER',
    'DDS AMT': 50000,
    'DAM AMT': 0,
    'MIS AMT': 0,
    'FD AMT': 0,
    'RD AMT': 0,
    'SMBG AMT': 0,
    'CUR-GOLD-AMT': 0,
    'CUR-WEL-AMT': 0,
    'SAVS-AMT': 5000,
    'INSU AMT': 0,
    'TASC AMT': 0,
    'SHARE AMT': 0,
    'DDS AC': 1,
    'DAM AC': 0,
    'MIS AC': 0,
    'FD AC': 0,
    'RD AC': 0,
    'SMBG AC': 0,
    'CUR-GOLD-AC': 0,
    'CUR-WEL-AC': 0,
    'SAVS-AC': 1,
    'NEW-SS/AGNT': 0,
    'INSU AC': 0,
    'TASC AC': 0,
    'SHARE AC': 0,
    'TOTAL ACCOUNTS': 2,
    'TOTAL AMOUNTS': 55000,
    'GRAND TOTAL AC': 2,
    'GRAND TOTAL AMT': 55000,
  }
];
export const MOCK_KRA_DATA: Kra[] = [
  // Existing data, updated to include period and periodType
  {
    id: 'kra-1',
    staffEmployeeCode: '3937',
    metric: 'DDS AMT',
    target: 500000,
    period: '2024-07',
    periodType: 'monthly',
    dueDate: '2024-07-31'
  },
  {
    id: 'kra-2',
    staffEmployeeCode: '3937',
    metric: 'DDS AC',
    target: 10,
    period: '2024-07',
    periodType: 'monthly',
    dueDate: '2024-07-31'
  },
  {
    id: 'kra-3',
    staffEmployeeCode: '6642',
    metric: 'FD AMT',
    target: 1500000,
    period: '2024-07',
    periodType: 'monthly',
    dueDate: '2024-07-31'
  },
  {
    id: 'kra-4',
    staffEmployeeCode: '6642',
    metric: 'FD AC',
    target: 5,
    period: '2024-07',
    periodType: 'monthly',
    dueDate: '2024-07-31'
  },
  {
    id: 'kra-5',
    staffEmployeeCode: '270', // GAURAV WAKODIKAR (SENIOR DISTRICT HEAD)
    metric: 'GRAND TOTAL AMT',
    target: 5000000,
    period: '2024-07',
    periodType: 'monthly',
    dueDate: '2024-07-31'
  },
  {
    id: 'kra-6',
    staffEmployeeCode: '270', // GAURAV WAKODIKAR (SENIOR DISTRICT HEAD)
    metric: 'GRAND TOTAL AC',
    target: 50,
    period: '2024-07',
    periodType: 'monthly',
    dueDate: '2024-07-31'
  },
  {
    id: 'kra-7',
    staffEmployeeCode: '3937',
    metric: 'SAVS-AMT',
    target: 200000,
    period: '2024-06',
    periodType: 'monthly',
    dueDate: '2024-06-30'
  },
  {
    id: 'kra-8',
    staffEmployeeCode: '3937',
    metric: 'SAVS-AC',
    target: 5,
    period: '2024-06',
    periodType: 'monthly',
    dueDate: '2024-06-30'
  },
  {
    id: 'kra-9',
    staffEmployeeCode: '2004', // NILESH INGALE (SALES MANAGER-DDS)
    metric: 'DDS AMT',
    target: 1000000,
    period: '2024-07',
    periodType: 'monthly',
    dueDate: '2024-07-31'
  },
  {
    id: 'kra-10',
    staffEmployeeCode: '2004', // NILESH INGALE (SALES MANAGER-DDS)
    metric: 'DDS AC',
    target: 20,
    period: '2024-07',
    periodType: 'monthly',
    dueDate: '2024-07-31'
  },
  {
    id: 'kra-11',
    staffEmployeeCode: '100', // NISHANT SHELARE (ZONAL MANAGER)
    metric: 'GRAND TOTAL AMT',
    target: 10000000,
    period: '2024-07',
    periodType: 'monthly',
    dueDate: '2024-07-31'
  },
  {
    id: 'kra-12',
    staffEmployeeCode: '100', // NISHANT SHELARE (ZONAL MANAGER)
    metric: 'GRAND TOTAL AC',
    target: 100,
    period: '2024-07',
    periodType: 'monthly',
    dueDate: '2024-07-31'
  },
  // Example MTD target
  {
    id: 'kra-mtd-1',
    staffEmployeeCode: '3937',
    metric: 'DDS AMT',
    target: 250000,
    period: '2024-07',
    periodType: 'mtd',
    dueDate: '2024-07-15' 
  },
  // Example YTD target
  {
    id: 'kra-ytd-1',
    staffEmployeeCode: '3937',
    metric: 'DDS AMT',
    target: 3000000,
    period: '2024',
    periodType: 'ytd',
    dueDate: undefined // YTD might not have a specific due date
  },
  {
    id: 'kra-ytd-2',
    staffEmployeeCode: '6642',
    metric: 'FD AC',
    target: 15,
    period: '2024',
    periodType: 'ytd',
    dueDate: undefined
  },
];

// New: Mock data for Designation KRA mappings
export const MOCK_DESIGNATION_KRAS: DesignationKRA[] = [
  {
    id: 'dkra-bm',
    designation: 'BRANCH MANAGER',
    metricIds: [
      'prod-1', 'prod-2', // GRAND TOTALS
      'prod-3', 'prod-4', // DDS
      'prod-5', 'prod-6', // FD
      'prod-9', 'prod-10', // SAVS
      'prod-22', 'prod-23', // INSU
    ],
  },
  {
    id: 'dkra-smds',
    designation: 'SALES MANAGER-DDS',
    metricIds: [
      'prod-1', 'prod-2', // GRAND TOTALS
      'prod-3', 'prod-4', // DDS
      'prod-5', 'prod-6', // FD
    ],
  },
  {
    id: 'dkra-bde',
    designation: 'BUSINESS DEVELOPMENT EXECUTIVE',
    metricIds: [
      'prod-3', 'prod-4', // DDS
      'prod-9', 'prod-10', // SAVS
    ],
  },
  {
    id: 'dkra-bo',
    designation: 'BRANCH OFFICER',
    metricIds: [
      'prod-3', 'prod-4', // DDS
      'prod-9', 'prod-10', // SAVS
    ],
  },
  {
    id: 'dkra-dh',
    designation: 'DISTRICT HEAD',
    metricIds: [
      'prod-1', 'prod-2', // GRAND TOTALS (Overall for district)
      'prod-3', 'prod-4', // DDS
      'prod-5', 'prod-6', // FD
      'prod-11', 'prod-12', // DAM
      'prod-13', 'prod-14', // MIS
      'prod-15', 'prod-16', // SMBG
    ],
  },
  {
    id: 'dkra-zm',
    designation: 'ZONAL MANAGER',
    metricIds: [
      'prod-1', 'prod-2', // GRAND TOTALS (Overall for zone)
      'prod-3', 'prod-4', // DDS
      'prod-5', 'prod-6', // FD
      'prod-11', 'prod-12', // DAM
      'prod-13', 'prod-14', // MIS
      'prod-15', 'prod-16', // SMBG
      'prod-17', 'prod-18', // CUR-GOLD
      'prod-19', 'prod-20', // CUR-WEL
    ],
  },
  {
    id: 'dkra-abm',
    designation: 'ASSISTANT BRANCH MANAGER',
    metricIds: [
      'prod-3', 'prod-4', // DDS
      'prod-5', 'prod-6', // FD
    ],
  },
  {
    id: 'dkra-tlcasa',
    designation: 'TL-CASA',
    metricIds: [
      'prod-9', 'prod-10', // SAVS
      'prod-11', 'prod-12', // DAM
    ],
  },
  {
    id: 'dkra-tldds',
    designation: 'TL-DDS',
    metricIds: [
      'prod-3', 'prod-4', // DDS
      'prod-13', 'prod-14', // MIS
    ],
  },
  {
    id: 'dkra-tlsdbg',
    designation: 'TL-SMBG',
    metricIds: [
      'prod-15', 'prod-16', // SMBG
      'prod-17', 'prod-18', // CUR-GOLD
    ],
  },
  {
    id: 'dkra-cso',
    designation: 'CUSTOMER SERVICE OFFICER',
    metricIds: [
      'prod-9', 'prod-10', // SAVS
      'prod-22', 'prod-23', // INSU
    ],
  },
  {
    id: 'dkra-ro',
    designation: 'RO-CASA',
    metricIds: [
      'prod-9', 'prod-10', // SAVS
    ],
  },
  {
    id: 'dkra-admin', // Admin has access to all metrics by default via special handling, but this entry can exist.
    designation: 'ADMINISTRATOR',
    metricIds: [
      'prod-1', 'prod-2', 'prod-3', 'prod-4', 'prod-5', 'prod-6', 'prod-7', 'prod-8', 'prod-9', 'prod-10',
      'prod-11', 'prod-12', 'prod-13', 'prod-14', 'prod-15', 'prod-16', 'prod-17', 'prod-18', 'prod-19', 'prod-20',
      'prod-21', 'prod-22', 'prod-23', 'prod-24', 'prod-25', 'prod-26', 'prod-27', 'prod-28'
    ],
  },
];