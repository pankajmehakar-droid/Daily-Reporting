import {
  StaffMember,
  Projection,
  Demand,
  BranchTarget,
  DailyAchievementRecord,
  Target,
  DesignationTarget,
  Zone,
  Region,
  District,
  TargetPeriodType,
  Highlight,
} from './types';

export const csvData = ``;

// Mock data for Zones
export const MOCK_ZONES: Zone[] = [
  { id: 'zone-1', name: 'Zone-1' },
  { id: 'zone-2', name: 'Zone-2' },
  { id: 'zone-3', name: 'Zone-3' },
  { id: 'zone-4', name: 'Zone-4' },
  { id: 'zone-5', name: 'Zone-5' },
];

// Mock data for Regions
export const MOCK_REGIONS: Region[] = [
  { id: 'region-1', name: 'Region-1', zoneId: 'zone-1' },
  { id: 'region-2', name: 'Region-2', zoneId: 'zone-1' },
  { id: 'region-3', name: 'Region-3', zoneId: 'zone-2' },
  { id: 'region-4', name: 'Region-4', zoneId: 'zone-2' },
  { id: 'region-5', name: 'Region-5', zoneId: 'zone-3' },
];

// Mock data for Districts
export const MOCK_DISTRICTS: District[] = [
  { id: 'district-1', name: 'YAVATMAL', regionId: 'region-2' },
  { id: 'district-2', name: 'NAGPUR', regionId: 'region-1' },
  { id: 'district-3', name: 'AMRAVATI', regionId: 'region-2' },
  { id: 'district-4', name: 'NANDED', regionId: 'region-2' },
  { id: 'district-5', name: 'AKOLA', regionId: 'region-1' },
];

// Staff hierarchy data
export const FULL_STAFF_DATA: Omit<StaffMember, 'id'>[] = [
  {
    zone: 'Zone-1',
    region: 'Region-2',
    districtName: 'NAGPUR',
    branchName: 'NAGPUR',
    employeeName: 'NISHANT SHELARE',
    employeeCode: '100',
    function: 'ZONAL MANAGER',
    contactNumber: '9876543210',
    managedZones: ['Zone-1', 'Zone-2'],
  },
  {
    zone: 'Zone-1',
    region: 'Region-2',
    districtName: 'YAVATMAL',
    branchName: 'YAVATMAL',
    employeeName: 'GAURAV WAKODIKAR',
    employeeCode: '270',
    function: 'SENIOR DISTRICT HEAD',
    contactNumber: '8765432109',
    managedBranches: [
      'NER', 'DARWHA', 'ARNI', 'UMARKHED', 'MAHAGAON', 'MAREGAON', 'DIGRAS',
      'PUSAD', 'PANDHARKAWADA', 'KALAMB', 'RALEGAON', 'YAVATMAL', 'GHATANJI',
      'ZARI JAMNI', 'WANI',
    ],
    reportsToEmployeeCode: '100',
  },
  {
    zone: 'Zone-1',
    region: 'Region-2',
    districtName: 'YAVATMAL',
    branchName: 'UMARKHED',
    employeeName: 'AMOL JAGTAP',
    employeeCode: '2003',
    function: 'ASSISTANT DISTRICT HEAD',
    contactNumber: '7654321098',
    managedBranches: ['NER', 'DARWHA', 'ARNI', 'UMARKHED', 'MAHAGAON', 'MAREGAON', 'DIGRAS'],
    reportsToEmployeeCode: '270',
  },
  {
    zone: 'Zone-1',
    region: 'Region-2',
    districtName: 'YAVATMAL',
    branchName: 'NER',
    employeeName: 'PANKAJ MEHAKAR',
    employeeCode: '1734',
    function: 'BRANCH MANAGER',
    contactNumber: '9000011111',
    reportsToEmployeeCode: '270',
  },
  {
    zone: 'Zone-1',
    region: 'Region-2',
    districtName: 'YAVATMAL',
    branchName: 'NER',
    employeeName: 'TRISHUL KOSHTI',
    employeeCode: '2266',
    function: 'ASSISTANT BRANCH MANAGER',
    contactNumber: '9000011111',
    reportsToEmployeeCode: '1734',
  },
  {
    zone: 'Zone-1',
    region: 'Region-2',
    districtName: 'YAVATMAL',
    branchName: 'DIGRAS',
    employeeName: 'SUSHIL GAIKWAD',
    employeeCode: '1347',
    function: 'BRANCH MANAGER',
    contactNumber: '9000011111',
    reportsToEmployeeCode: '270',
  },
  {
    zone: 'Zone-1',
    region: 'Region-2',
    districtName: 'YAVATMAL',
    branchName: 'NER',
    employeeName: 'VIJENDRA PATMASE',
    employeeCode: '3531',
    function: 'SALES MANAGER-CASA',
    contactNumber: '9876512345',
    reportsToEmployeeCode: '270',
  },
  {
    zone: 'Zone-1',
    region: 'Region-2',
    districtName: 'YAVATMAL',
    branchName: 'YAVATMAL',
    employeeName: 'NILESH INGALE',
    employeeCode: '2004',
    function: 'SALES MANAGER-DDS',
    contactNumber: '9876512345',
    reportsToEmployeeCode: '270',
  },
  {
    zone: 'Zone-1',
    region: 'Region-2',
    districtName: 'YAVATMAL',
    branchName: 'NER',
    employeeName: 'DATTA GIRI',
    employeeCode: '3937',
    function: 'BUSINESS DEVELOPMENT EXECUTIVE',
    contactNumber: '9988776611',
    reportsToEmployeeCode: '1734',
  },
];

// Mock Daily Achievement Records
export const MOCK_DAILY_ACHIEVEMENT_RECORDS: DailyAchievementRecord[] = [
  {
    id: 'ach-1',
    date: '2024-07-20',
    priority: 'High',
    'STAFF NAME': 'PANKAJ MEHAKAR',
    'BRANCH NAME': 'NER',
    'DDS AMT': 150000, 'DAM AMT': 0, 'MIS AMT': 0, 'FD AMT': 500000, 'RD AMT': 0, 'SMBG AMT': 0, 'CUR-GOLD-AMT': 0, 'CUR-WEL-AMT': 0, 'SAVS-AMT': 20000, 'INSU AMT': 0, 'TASC AMT': 0, 'SHARE AMT': 0,
    'DDS AC': 3, 'DAM AC': 0, 'MIS AC': 0, 'FD AC': 1, 'RD AC': 0, 'SMBG AC': 0, 'CUR-GOLD-AC': 0, 'CUR-WEL-AC': 0, 'SAVS-AC': 1, 'NEW-SS/AGNT': 0, 'INSU AC': 0, 'TASC AC': 0, 'SHARE AC': 0,
    'TOTAL ACCOUNTS': 5, 'TOTAL AMOUNTS': 670000, 'GRAND TOTAL AC': 5, 'GRAND TOTAL AMT': 670000,
  },
  {
    id: 'ach-2',
    date: '2024-07-21',
    priority: 'Medium',
    'STAFF NAME': 'PANKAJ MEHAKAR',
    'BRANCH NAME': 'NER',
    'DDS AMT': 100000, 'DAM AMT': 0, 'MIS AMT': 0, 'FD AMT': 300000, 'RD AMT': 0, 'SMBG AMT': 0, 'CUR-GOLD-AMT': 0, 'CUR-WEL-AMT': 0, 'SAVS-AMT': 10000, 'INSU AMT': 0, 'TASC AMT': 0, 'SHARE AMT': 0,
    'DDS AC': 2, 'DAM AC': 0, 'MIS AC': 0, 'FD AC': 1, 'RD AC': 0, 'SMBG AC': 0, 'CUR-GOLD-AC': 0, 'CUR-WEL-AC': 0, 'SAVS-AC': 1, 'NEW-SS/AGNT': 0, 'INSU AC': 0, 'TASC AC': 0, 'SHARE AC': 0,
    'TOTAL ACCOUNTS': 4, 'TOTAL AMOUNTS': 410000, 'GRAND TOTAL AC': 4, 'GRAND TOTAL AMT': 410000,
  },
  {
    id: 'ach-3',
    date: '2024-07-20',
    priority: 'Low',
    'STAFF NAME': 'TRISHUL KOSHTI',
    'BRANCH NAME': 'NER',
    'DDS AMT': 50000, 'DAM AMT': 0, 'MIS AMT': 0, 'FD AMT': 0, 'RD AMT': 0, 'SMBG AMT': 0, 'CUR-GOLD-AMT': 0, 'CUR-WEL-AMT': 0, 'SAVS-AMT': 5000, 'INSU AMT': 0, 'TASC AMT': 0, 'SHARE AMT': 0,
    'DDS AC': 1, 'DAM AC': 0, 'MIS AC': 0, 'FD AC': 0, 'RD AC': 0, 'SMBG AC': 0, 'CUR-GOLD-AC': 0, 'CUR-WEL-AC': 0, 'SAVS-AC': 1, 'NEW-SS/AGNT': 0, 'INSU AC': 0, 'TASC AC': 0, 'SHARE AC': 0,
    'TOTAL ACCOUNTS': 2, 'TOTAL AMOUNTS': 55000, 'GRAND TOTAL AC': 2, 'GRAND TOTAL AMT': 55000,
  },
];

// Mock Target Data
export const MOCK_TARGET_DATA: Target[] = [
  {
    id: 'kra-1',
    staffEmployeeCode: '3937',
    metric: 'DDS AMT',
    target: 500000,
    period: '2024-07',
    periodType: 'monthly',
    dueDate: '2024-07-31',
  },
  {
    id: 'kra-2',
    staffEmployeeCode: '1347',
    metric: 'FD AMT',
    target: 1500000,
    period: '2024-07',
    periodType: 'monthly',
    dueDate: '2024-07-31',
  },
  {
    id: 'kra-3',
    staffEmployeeCode: '270',
    metric: 'GRAND TOTAL AMT',
    target: 5000000,
    period: '2024-07',
    periodType: 'monthly',
    dueDate: '2024-07-31',
  },
  {
    id: 'kra-4',
    staffEmployeeCode: '100',
    metric: 'GRAND TOTAL AMT',
    target: 10000000,
    period: '2024-07',
    periodType: 'monthly',
    dueDate: '2024-07-31',
  },
];

// Mock Designation Targets
export const MOCK_DESIGNATION_TARGETS: DesignationTarget[] = [
  {
    id: 'dkra-bm',
    designation: 'BRANCH MANAGER',
    metricIds: ['prod-1', 'prod-2', 'prod-3', 'prod-4', 'prod-5', 'prod-6', 'prod-9', 'prod-10'],
  },
  {
    id: 'dkra-dh',
    designation: 'DISTRICT HEAD',
    metricIds: ['prod-1', 'prod-2', 'prod-3', 'prod-4', 'prod-5', 'prod-6'],
  },
  {
    id: 'dkra-zm',
    designation: 'ZONAL MANAGER',
    metricIds: ['prod-1', 'prod-2', 'prod-3', 'prod-4', 'prod-5', 'prod-6', 'prod-9', 'prod-10'],
  },
  {
    id: 'dkra-admin',
    designation: 'ADMINISTRATOR',
    metricIds: Array.from({ length: 28 }, (_, i) => `prod-${i + 1}`),
  },
];

// Empty mocks for optional sections
export const MOCK_PROJECTION_DATA: Projection[] = [];
export const MOCK_DEMAND_DATA: Demand[] = [];
export const MOCK_BRANCH_TARGETS: BranchTarget[] = [];
export const MOCK_HIGHLIGHTS: Highlight[] = [];