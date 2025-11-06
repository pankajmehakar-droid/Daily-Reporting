

export type Role = 'admin' | 'user' | 'manager';
export type TaskPriority = 'High' | 'Medium' | 'Low';

export interface User {
  id: string; // The underlying StaffMember ID
  username: string;
  role: Role;
  staffName: string;
  designation: Designation; // Changed to Designation type
  contactNumber: string;
  branchName?: string;
  employeeCode?: string;
  zone?: string;
  region?: string;
  districtName?: string;
  // New: For multi-unit management roles
  managedZones?: string[];
  managedBranches?: string[];
  // New: For reporting hierarchy
  reportsToEmployeeCode?: string; // FIX: Added reportsToEmployeeCode to User interface
  subordinates?: User[];
}

export interface Zone {
  id: string;
  name: string;
}

export interface Region {
  id: string;
  name: string;
  zoneId?: string; // Optional: Link region to a zone
}

export interface District {
  id: string;
  name: string;
  regionId?: string; // Optional: Link district to a region
}

export interface Branch {
  id: string;
  zone: string;
  region: string;
  branchName: string;
  districtName: string;
  // These are now direct properties of a branch, not derived.
  branchManagerName: string;
  branchManagerCode: string;
  mobileNumber: string;
}

export interface StaffMember {
  id: string;
  zone: string;
  region: string;
  branchName: string;
  employeeName: string;
  employeeCode: string;
  function: Designation; // Changed to Designation type
  districtName: string; 
  contactNumber: string; 
  // New: For multi-unit management roles
  managedZones?: string[]; // For ZONAL MANAGER
  managedBranches?: string[]; // For DISTRICT HEAD, ASSISTANT DISTRICT HEAD
  // New: For reporting hierarchy
  reportsToEmployeeCode?: string;
  subordinates?: StaffMember[];
}

export const DESIGNATIONS = [
  'ASSISTANT BRANCH MANAGER',
  'AREA SALES MANAGER',
  'BRANCH CREDIT MANAGER',
  'BUSINESS DEVELOPMENT EXECUTIVE',
  'BUSINESS DEVELOPMENT OFFICER',
  'BRANCH MANAGER',
  'SENIOR BRANCH MANAGER',
  'BRANCH OFFICER',
  'BRANCH OPERATIONS MANAGER',
  'BRANCH SALES MANAGER',
  'CUSTOMER SERVICE OFFICER',
  'RO-CASA',
  'ZONAL MANAGER',
  'DISTRICT HEAD',
  'SENIOR DISTRICT HEAD',
  'ASSISTANT DISTRICT HEAD',
  'SALES MANAGER-CASA',
  'SALES MANAGER-DDS',
  'SALES MANAGER-SMBG',
  'TL-CASA',
  'TL-DDS',
  'TL-SMBG',
  'FUNCTION', // This generic "FUNCTION" should be removed or made more specific. Keeping it for now if existing data uses it.
  'ADMINISTRATOR' // Added for admin profile display
] as const;

export type Designation = typeof DESIGNATIONS[number];


export interface CsvSummary {
  staffCount: string;
  branchCount: number;
  startDate: string;
  endDate: string;
  totalAmount: number;
  totalAc: number;
}

export type CsvRecord = Record<string, string | number | undefined>;

export interface ParsedCsvData {
  summary: CsvSummary;
  headers: string[];
  records: CsvRecord[];
  targets?: CsvRecord;
  previousYearAchievement?: CsvRecord;
}

export interface ChartDataPoint {
  label: string;
  value: number;
  originalLabel?: string; // Added for interactive charts (e.g., for dates in BarChart)
}

export type TargetPeriodType = 'monthly' | 'mtd' | 'ytd';

export interface Target {
  id: string;
  staffEmployeeCode: string;
  metric: string;
  target: number;
  period: string; // YYYY-MM for monthly/mtd, YYYY for ytd
  periodType: TargetPeriodType; // New field
  dueDate?: string; // YYYY-MM-DD
}

// Added MtdData interface based on its usage
export interface MtdData {
  mtdTotalAmount: number;
  mtdTotalAc: number;
  mtdDdsAc: number;
  mtdFdAc: number;
}

// New: Interface for detailed monthly targets
export interface DetailedMonthlyTargets {
  totalAmount: number;
  totalAc: number;
  ddsAc: number;
  fdAc: number;
}

export interface ProductMetric {
  id: string;
  name: string; // Display name, e.g., 'DDS Amount', 'FD Accounts'
  category: string; // The base category, e.g., 'DDS', 'FD', 'GRAND TOTAL'
  type: 'Amount' | 'Account' | 'Other'; // 'Amount', 'Account', or 'Other'
  unitOfMeasure: string; // New: e.g., 'INR', 'Units', '%'
  contributesToOverallGoals: boolean; // New: whether this metric contributes to overall goals
}

// New: Interface for product-wise target vs achievement data
export interface ProductWiseTargetVsAchievement {
  product: string;
  amountTarget: number;
  amountAchieved: number;
  amountPercentage: number;
  acTarget: number;
  acAchieved: number;
  acPercentage: number;
}

// FIX: Added missing type definitions
export interface BranchTarget {
  id: string;
  branchName: string;
  metric: string;
  target: number;
  month: string; // YYYY-MM
  dueDate?: string; // YYYY-MM-DD
}

export interface DailyAchievementRecord {
  id: string;
  date: string; // YYYY-MM-DD
  priority?: TaskPriority;
  'STAFF NAME': string;
  'BRANCH NAME': string;
  'DDS AMT': number;
  'DAM AMT': number;
  'MIS AMT': number;
  'FD AMT': number;
  'RD AMT': number;
  'SMBG AMT': number;
  'CUR-GOLD-AMT': number;
  'CUR-WEL-AMT': number;
  'SAVS-AMT': number;
  'INSU AMT': number;
  'TASC AMT': number;
  'SHARE AMT': number;
  'DDS AC': number;
  'DAM AC': number;
  'MIS AC': number;
  'FD AC': number;
  'RD AC': number;
  'SMBG AC': number;
  'CUR-GOLD-AC': number;
  'CUR-WEL-AC': number;
  'SAVS-AC': number;
  'NEW-SS/AGNT': number;
  'INSU AC': number;
  'TASC AC': number;
  'SHARE AC': number;
  'TOTAL ACCOUNTS': number;
  'TOTAL AMOUNTS': number;
  'GRAND TOTAL AC': number;
  'GRAND TOTAL AMT': number;
  [key: string]: string | number | undefined;
}

export interface DesignationTarget {
  id: string;
  designation: Designation;
  metricIds: string[];
}

export interface DailyRunRateResult {
  monthlyTargetAmount: number;
  monthlyTargetAccount: number;
  mtdAchievementAmount: number;
  mtdAchievementAccount: number;
  remainingTargetAmount: number;
  remainingTargetAccount: number;
  daysInMonth: number;
  daysRemainingInMonth: number;
  dailyRunRateAmount: number;
  dailyRunRateAccount: number;
}


export const BRANCH_NAMES = [
  'AHERI', 'AHMADNAGAR', 'AKOLA', 'AKOT', 'ALMORA', 'Ambad', 'AMGAON', 'AMRAVATI', 'ANJANGAON SURJI', 'ARMORI', 'ARNI', 'ARVI', 'ASHTI', 'AURANGABAD', 'BADDI', 'Badlapur', 'Balaghat', 'BALLARPUR', 'Beed', 'Belagavi', 'Belapur', 'Betul', 'BHADRAVATI', 'BHANDARA', 'Bhayander', 'BHIWANDI', 'BHIWAPUR', 'Bhopal', 'Bidar', 'Borivali', 'BRAMHPURI', 'BULDHANA', 'Burhanpur', 'CHAMORSHI', 'CHAMPAWAT', 'CHANDRAPUR', 'CHANDUR BAZAR', 'CHANDUR RAILWAY', 'Chembur', 'Chhindwara', 'CHIKHALI', 'Chitradurga', 'Dadar', 'DARWHA', 'DARYAPUR', 'Davangere', 'Dehradun', 'DEOLI', 'DEORI', 'DEULGAONRAJA', 'Dhamangaon Railway', 'DHANORA', 'Dhar', 'Dharashiv', 'Dharwad', 'Dhule', 'DIGRAS', 'Doddaballapura', 'Dombivali', 'GADCHIROLI', 'GANDHIBAG', 'GHATANJI', 'GHATKOPAR', 'GONDIA', 'GONDIA GOLD BRANCH', 'GONDPIPARI', 'GOREGAON', 'HALDWANI', 'Harda', 'HARIDWAR', 'Hassan', 'Haveri', 'HINGANGHAT', 'HINGNA', 'Hingoli', 'Hubli', 'Indore', 'Jabalpur', 'Jalgaon', 'JALGAON JAMOD', 'JALNA', 'Jhabua', 'Jintur', 'Kalaburagi', 'KALAMB', 'Kalamboli', 'KALMESHWAR', 'Kalyan', 'KANDIVALI', 'KANHAN', 'KANNAD', 'KARANJA GHADGE', 'KARANJA LAD', 'KASHIPUR', 'KATNI', 'KATOL', 'Khairlanji', 'KHAMGAON', 'Khandwa', 'Kharadi', 'Kharghar', 'KHATIMA', 'KICHHA', 'KIRNAPUR', 'Kolar', 'KOLHAPUR', 'KOPERKHAIRNE', 'Koppal', 'KORCHI', 'KOTDWAR', 'KUHI', 'KULLU', 'KURKHEDA', 'LAKHANDUR', 'LAKHANI', 'LANJI', 'Latur', 'LONAR', 'MAHAGAON', 'Malad', 'MALEGAON', 'Malegaon (Nashik)', 'MALKAPUR', 'Mandideep', 'Mandla', 'Mandsaur', 'Mandya', 'Mangalore', 'Mangrulpir', 'MANORA', 'MAREGAON', 'Marol - Andheri', 'MAUDA', 'MEHKAR', 'Millers Road', 'MIRA ROAD', 'MOHADI', 'MORGAON ARJUNI', 'MORSHI', 'MUL', 'MULCHERA', 'Mulund', 'MURTIJAPUR', 'Mysore', 'NAGBHID', 'NAGPUR', 'NAGPUR WEALTH BRANCH', 'Nalasopara', 'NANDED', 'NANDURA', 'NANDURBAR', 'NARKHED', 'Narmadapuram', 'Narshingpur', 'NASHIK', 'NER', 'Nerul', 'Palghar', 'PANDHARKAWADA', 'PANDHURNA', 'PANVEL', 'Paratwada', 'PARBHANI', 'PARSHIVNI', 'PATUR', 'PAUNI', 'PITHORAGARH', 'Puducherry', 'PUNE AUNDH', 'PUSAD', 'Rajgarh', 'RALEGAON', 'RAMTEK', 'Ranebennur', 'RATHI NAGAR', 'Ratnagiri', 'RISHIKESH', 'RISOD', 'ROORKEE', 'RUDRAPUR', 'SADAK ARJUNI', 'SAKOLI', 'SALEKASA', 'SAMUDRAPUR', 'Sangli', 'Sangrampur', 'SAONER', 'SATARA', 'SAWALI', 'Seawood', 'Sehore', 'SELOO', 'SHEGAON', 'Shimla', 'Shivamogga', 'SINDEWAHI', 'Sion', 'Sirsi', 'SITARGANJ', 'SOLAN', 'Solapur', 'Srinagar', 'TANAKPUR', 'Thane', 'TIRODA', 'Titwala', 'TULJAPUR', 'TUMSAR', 'Udgir', 'Udupi', 'Ujjain', 'Ulhasnagar', 'UMARKHED', 'UMRED', 'VAIJAPUR', 'VARTAKNAGAR', 'VASAI', 'Vashi', 'Vidisha', 'Vijaypura', 'VIKASNAGAR', 'Virar', 'WADSA', 'WANI', 'Waraseoni', 'WARDHA', 'WARUD', 'WASHIM', 'Yadgir', 'YAVATMAL', 'ZARI JAMNI'
] as const;

export const DISTRICT_NAMES = [
  'AHMEDNAGAR', 'AKOLA', 'ALMORA', 'AMRAVATI', 'AURANGABAD', 'BALAGHAT', 'BEED', 'BELAGAVI', 'BENGALURU RURAL', 'BENGALURU URBAN', 'BETUL', 'BHANDARA', 'BHOPAL', 'BIDAR', 'BULDHANA', 'BURHANPUR', 'CHAMPAWAT', 'CHANDRAPUR', 'CHHINDWARA', 'CHITRADURGA', 'DAKSHINA KANNADA', 'DAVANGERE', 'DEHRADUN', 'DHAR', 'DHARASHIV', 'DHARWAD', 'DHULE', 'GADCHIROLI', 'GONDIA', 'HARDA', 'HARIDWAR', 'HASSAN', 'HAVERI', 'HINGOLI', 'INDORE', 'JABALPUR', 'JALGAON', 'JALNA', 'JHABUA', 'KALABURAGI', 'KATNI', 'KHANDWA', 'KOLAR', 'KOLHAPUR', 'KOPPAL', 'KULLU', 'LATUR', 'MANDLA', 'MANDSAUR', 'MANDYA', 'MUMBAI (SUBURBAN)', 'MYSORE', 'NAGPUR', 'NAINITAL', 'NANDED', 'NANDURA', 'NANDURBAR', 'NARMADAPURAM', 'NARSINGHPUR', 'NASHIK', 'PANDHURNA', 'PARBHANI', 'PAURI GARHWAL', 'PITHORAGARH', 'PUDUCHERRY', 'PUNE', 'RAISEN', 'RAJGARH', 'RATNAGIRI', 'SANGLI', 'SATARA', 'SEHORE', 'SHIMLA', 'SHIVAMOGGA', 'SOLAN', 'SOLAPUR', 'SRINAGAR', 'TULJAPUR', 'UDHAM SINGH NAGAR', 'UDUPI', 'UJJAIN', 'UTTARA KANNADA', 'VIDISHA', 'VIJAYPURA', 'WARDHA', 'WASHIM', 'YADGIR', 'YAVATMAL'
] as const;

export const ZONES = Array.from({ length: 15 }, (_, i) => `Zone-${i + 1}`);
export const REGIONS = Array.from({ length: 15 }, (_, i) => `Region-${i + 1}`);

// New interfaces for Projection and Demand
export interface Projection {
  id: string;
  staffEmployeeCode: string;
  date: string; // YYYY-MM-DD
  metric: string;
  value: number;
}

export interface Demand {
  id: string;
  staffEmployeeCode: string;
  date: string; // YYYY-MM-DD
  metric: string;
  value: number;
  source: string; // e.g., 'Target', 'Manual Input', 'System Generated'
}

export interface Highlight {
  id: string;
  imageUrl: string;
  uploadedBy: string;
  timestamp: string;
}

export const PROJECTION_DEMAND_METRIC_NAMES = [
  'DDS AMT', 'DAM AMT', 'MIS AMT', 'FD AMT', 'RD AMT', 'SMBG AMT', 'CUR-GOLD-AMT', 'CUR-WEL-AMT', 'SAVS-AMT', 'INSU AMT', 'TASC AMT', 'SHARE AMT',
  'DDS AC', 'DAM AC', 'MIS AC', 'FD AC', 'RD AC', 'SMBG AC', 'CUR-GOLD-AC', 'CUR-WEL-AC', 'SAVS-AC', 'NEW-SS/AGNT', 'INSU AC', 'TASC AC', 'SHARE AC'
] as const;