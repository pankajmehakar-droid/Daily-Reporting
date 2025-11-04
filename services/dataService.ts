import { StaffMember, Branch, Kra, ProductMetric, Projection, Demand, BranchTarget, CsvRecord, DemandRunRateResult, DailyAchievementRecord, CsvSummary, ParsedCsvData, User, DetailedMonthlyTargets, Designation, DesignationKRA, Zone, Region, District, TargetPeriodType } from '../types';
import { reinitializeAuth } from './authService'; // Now explicitly imported here
import { FULL_STAFF_DATA as initialFullStaffData, MOCK_PROJECTION_DATA, MOCK_DEMAND_DATA, MOCK_BRANCH_TARGETS, MOCK_DAILY_ACHIEVEMENT_RECORDS, MOCK_KRA_DATA, MOCK_DESIGNATION_KRAS as initialDesignationKras, MOCK_ZONES as initialZones, MOCK_REGIONS as initialRegions, MOCK_DISTRICTS as initialDistricts } from '../data'; // Import canonical staff data and new mock data arrays
import { getDaysInMonth, getDaysRemainingInMonth, getTodayDateYYYYMMDD, getMonthString, convertDDMMYYYYtoYYYYMMDD, getYearString } from '../utils/dateHelpers'; // FIX: Added convertDDMMYYYYtoYYYYMMDD, getYearString

// Admin user ID (must match the one in authService for preservation)
export const ADMIN_USER_ID = 'admin-user-0'; // Exported ADMIN_USER_ID
const ZONAL_MANAGER_USER_ID = 'zm-user-0'; // New ID for Zonal Manager

// MOCK_STAFF is now initialized from the canonical FULL_STAFF_DATA and remains mutable.
let MOCK_STAFF: StaffMember[] = initialFullStaffData.map((staff, index) => ({
    ...staff,
    id: `staff-${index + 1}`,
    districtName: staff.districtName || 'N/A', // Ensure districtName is always present
    contactNumber: staff.contactNumber || 'N/A', // Ensure contactNumber is always present
    // Ensure new managed fields are initialized if not present
    managedZones: staff.managedZones || [],
    managedBranches: staff.managedBranches || [],
    // Ensure reportsToEmployeeCode and subordinates are initialized
    reportsToEmployeeCode: staff.reportsToEmployeeCode || undefined,
    subordinates: [], // Will be populated by _buildHierarchyAndSyncStaff
}));

// Add a default admin staff member if not already present
if (!MOCK_STAFF.some(s => s.id === ADMIN_USER_ID)) {
    MOCK_STAFF.push({
        id: ADMIN_USER_ID,
        zone: 'N/A',
        region: 'N/A',
        branchName: 'N/A',
        employeeName: 'System Admin',
        employeeCode: 'ADMIN',
        function: 'ADMINISTRATOR', // Use Designation type
        districtName: 'HEADQUARTERS',
        contactNumber: '9923444173',
        managedZones: [],
        managedBranches: [],
        reportsToEmployeeCode: undefined,
        subordinates: [],
    });
}

// Add a default Zonal Manager staff member if not already present
if (!MOCK_STAFF.some(s => s.id === ZONAL_MANAGER_USER_ID)) {
    MOCK_STAFF.push({
        id: ZONAL_MANAGER_USER_ID,
        zone: 'Zone-1',
        region: 'Region-2', // Based on existing AMRAVATI data
        branchName: 'AMRAVATI', // A primary branch for the ZM
        employeeName: 'Zonal Manager',
        employeeCode: 'ZM001',
        function: 'ZONAL MANAGER', // Use Designation type
        districtName: 'AMRAVATI',
        contactNumber: '9876598763',
        managedZones: ['Zone-1', 'Zone-2'], // Zonal Manager manages these zones
        managedBranches: [],
        reportsToEmployeeCode: 'ADMIN', // Example: ZM reports to Admin
        subordinates: [],
    });
}


// Initial default product metrics (can be extended by admin)
let MOCK_PRODUCT_METRICS: ProductMetric[] = [
    { id: 'prod-1', name: 'GRAND TOTAL AMT', category: 'GRAND TOTAL', type: 'Amount', unitOfMeasure: 'INR', contributesToOverallGoals: true },
    { id: 'prod-2', name: 'GRAND TOTAL AC', category: 'GRAND TOTAL', type: 'Account', unitOfMeasure: 'Units', contributesToOverallGoals: true },
    { id: 'prod-3', name: 'DDS AMT', category: 'DDS', type: 'Amount', unitOfMeasure: 'INR', contributesToOverallGoals: true },
    { id: 'prod-4', name: 'DDS AC', category: 'DDS', type: 'Account', unitOfMeasure: 'Units', contributesToOverallGoals: true },
    { id: 'prod-5', name: 'FD AMT', category: 'FD', type: 'Amount', unitOfMeasure: 'INR', contributesToOverallGoals: true },
    { id: 'prod-6', name: 'FD AC', category: 'FD', type: 'Account', unitOfMeasure: 'Units', contributesToOverallGoals: true },
    { id: 'prod-7', name: 'RD AMT', category: 'RD', type: 'Amount', unitOfMeasure: 'INR', contributesToOverallGoals: true },
    { id: 'prod-8', name: 'RD AC', category: 'RD', type: 'Account', unitOfMeasure: 'Units', contributesToOverallGoals: true },
    { id: 'prod-9', name: 'SAVS-AMT', category: 'SAVS', type: 'Amount', unitOfMeasure: 'INR', contributesToOverallGoals: true },
    { id: 'prod-10', name: 'SAVS-AC', category: 'SAVS', type: 'Account', unitOfMeasure: 'Units', contributesToOverallGoals: true },
    { id: 'prod-11', name: 'DAM AMT', category: 'DAM', type: 'Amount', unitOfMeasure: 'INR', contributesToOverallGoals: true },
    { id: 'prod-12', name: 'DAM AC', category: 'DAM', type: 'Account', unitOfMeasure: 'Units', contributesToOverallGoals: true },
    { id: 'prod-13', name: 'MIS AMT', category: 'MIS', type: 'Amount', unitOfMeasure: 'INR', contributesToOverallGoals: true },
    { id: 'prod-14', name: 'MIS AC', category: 'MIS', type: 'Account', unitOfMeasure: 'Units', contributesToOverallGoals: true },
    { id: 'prod-15', name: 'SMBG AMT', category: 'SMBG', type: 'Amount', unitOfMeasure: 'INR', contributesToOverallGoals: true },
    { id: 'prod-16', name: 'SMBG AC', category: 'SMBG', type: 'Account', unitOfMeasure: 'Units', contributesToOverallGoals: true },
    { id: 'prod-17', name: 'CUR-GOLD-AMT', category: 'CUR-GOLD', type: 'Amount', unitOfMeasure: 'INR', contributesToOverallGoals: true },
    { id: 'prod-18', name: 'CUR-GOLD-AC', category: 'CUR-GOLD', type: 'Account', unitOfMeasure: 'Units', contributesToOverallGoals: true },
    { id: 'prod-19', name: 'CUR-WEL-AMT', category: 'CUR-WEL', type: 'Amount', unitOfMeasure: 'INR', contributesToOverallGoals: true },
    { id: 'prod-20', name: 'CUR-WEL-AC', category: 'CUR-WEL', type: 'Account', unitOfMeasure: 'Units', contributesToOverallGoals: true },
    { id: 'prod-21', name: 'NEW-SS/AGNT', category: 'NEW-SS/AGNT', type: 'Other', unitOfMeasure: 'Units', contributesToOverallGoals: true }, // Consider 'Other' for metrics that aren't strictly AMT/AC pairs
    { id: 'prod-22', name: 'INSU AC', category: 'INSU', type: 'Account', unitOfMeasure: 'Units', contributesToOverallGoals: true },
    { id: 'prod-23', name: 'INSU AMT', category: 'INSU', type: 'Amount', unitOfMeasure: 'INR', contributesToOverallGoals: true },
    { id: 'prod-24', name: 'TASC AC', category: 'TASC', type: 'Account', unitOfMeasure: 'Units', contributesToOverallGoals: true },
    { id: 'prod-25', name: 'TASC AMT', category: 'TASC', type: 'Amount', unitOfMeasure: 'INR', contributesToOverallGoals: true },
    { id: 'prod-26', name: 'SHARE AC', category: 'SHARE', type: 'Account', unitOfMeasure: 'Units', contributesToOverallGoals: true },
    { id: 'prod-27', name: 'SHARE AMT', category: 'SHARE', type: 'Amount', unitOfMeasure: 'INR', contributesToOverallGoals: true },
    { id: 'prod-28', name: 'DDS Target', category: 'DDS', type: 'Account', unitOfMeasure: 'Units', contributesToOverallGoals: true },
];

// New: Mock data for Zones, Regions, Districts
let MOCK_ZONES: Zone[] = [...initialZones];
let MOCK_REGIONS: Region[] = [...initialRegions];
let MOCK_DISTRICTS: District[] = [...initialDistricts];


// Helper function to derive initial branches from staff list
const deriveBranchesFromStaff = (): Branch[] => {
    const branchesMap = new Map<string, Partial<Branch>>();
    MOCK_STAFF.forEach(staff => {
        if (!staff.branchName || staff.branchName === 'N/A') return;

        // Ensure that staff's zone, region, district are consistent with MOCK_ZONES/REGIONS/DISTRICTS
        const existingZone = MOCK_ZONES.find(z => z.name === staff.zone);
        const existingRegion = MOCK_REGIONS.find(r => r.name === staff.region);
        const existingDistrict = MOCK_DISTRICTS.find(d => d.name === staff.districtName);
        
        const effectiveZone = existingZone ? existingZone.name : (MOCK_ZONES[0]?.name || 'N/A');
        const effectiveRegion = existingRegion ? existingRegion.name : (MOCK_REGIONS[0]?.name || 'N/A');
        const effectiveDistrict = existingDistrict ? existingDistrict.name : (MOCK_DISTRICTS[0]?.name || 'N/A');


        if (!branchesMap.has(staff.branchName)) {
            branchesMap.set(staff.branchName, {
                id: `branch-${branchesMap.size + 1}`,
                zone: effectiveZone,
                region: effectiveRegion,
                branchName: staff.branchName,
                districtName: effectiveDistrict,
            });
        }

        // Initially, set manager from staff, this will be reconciled by _buildHierarchyAndSyncStaff
        // Do not assign mobileNumber here, it's a branch property and should be managed separately.
        if (staff.function.toUpperCase() === 'BRANCH MANAGER') { 
            const branch = branchesMap.get(staff.branchName);
            if (branch && !branch.branchManagerCode) { // Only set if no manager explicitly assigned yet
                branch.branchManagerName = staff.employeeName;
                branch.branchManagerCode = staff.employeeCode;
            }
        }
    });
    
    const derivedBranches = Array.from(branchesMap.values()) as Branch[];
    derivedBranches.forEach(b => {
        if (!b.branchManagerName) {
            b.branchManagerName = 'N/A';
            b.branchManagerCode = 'N/A';
        }
        b.mobileNumber = b.mobileNumber || 'N/A'; // Ensure mobileNumber is set as a default, and is no longer auto-set from manager contact.
    });
    
    return derivedBranches.sort((a,b) => a.branchName.localeCompare(b.branchName));
};

// MOCK_BRANCHES is now the single source of truth for branch metadata.
// It will be kept consistent with MOCK_STAFF via _buildHierarchyAndSyncStaff.
let MOCK_BRANCHES: Branch[] = deriveBranchesFromStaff();

// MOCK_KRA_DATA stores Key Result Area targets
// It's already imported from data.ts so no `let` declaration here.

// New: MOCK_DESIGNATION_KRAS for storing KRA definitions per designation
let MOCK_DESIGNATION_KRAS: DesignationKRA[] = [...initialDesignationKras];


/**
 * Helper function to recursively get all subordinate employee codes (direct and indirect)
 * reporting to a given staff member, along with their primary branch names.
 * @param staffMember The staff member whose subordinates are to be found.
 * @param allStaff The complete list of all staff members.
 * @returns An object containing sets of subordinate employee codes and branch names.
 */
export const getRecursiveSubordinateInfo = (staffMember: StaffMember, allStaff: StaffMember[]): { employeeCodes: Set<string>, branchNames: Set<string> } => {
    const info = { employeeCodes: new Set<string>(), branchNames: new Set<string>() };
    
    if (staffMember.employeeCode) {
        info.employeeCodes.add(staffMember.employeeCode); // Include self in the codes set
    }
    if (staffMember.branchName && staffMember.branchName !== 'N/A') {
        info.branchNames.add(staffMember.branchName); // Include self's branch in the branch set
    }

    const directSubordinates = allStaff.filter(s => s.reportsToEmployeeCode === staffMember.employeeCode);

    directSubordinates.forEach(sub => {
        // Recursive call
        const subInfo = getRecursiveSubordinateInfo(sub, allStaff);
        subInfo.employeeCodes.forEach(code => info.employeeCodes.add(code));
        subInfo.branchNames.forEach(name => info.branchNames.add(name));
    });

    return info;
};

/**
 * Helper function to recursively get only subordinate employee codes.
 * This is specifically for circular reporting checks where only codes are needed.
 * @param staffMember The staff member whose subordinates' codes are to be found.
 * @param allStaff The complete list of all staff members.
 * @returns A Set of all subordinate employee codes (direct and indirect).
 */
export const getRecursiveSubordinateEmployeeCodes = (staffMember: StaffMember, allStaff: StaffMember[]): Set<string> => {
    const subordinateCodes = new Set<string>();
    const directSubordinates = allStaff.filter(s => s.reportsToEmployeeCode === staffMember.employeeCode);

    directSubordinates.forEach(sub => {
        if (sub.employeeCode) {
            subordinateCodes.add(sub.employeeCode);
            // Recursively add codes from this subordinate's subordinates
            getRecursiveSubordinateEmployeeCodes(sub, allStaff).forEach(code => subordinateCodes.add(code));
        }
    });
    return subordinateCodes;
};


// Centralized synchronization for staff, branch manager roles, and reporting hierarchy
const _buildHierarchyAndSyncStaff = () => {
    // 1. Reset manager info on all branches and clear all subordinates initially
    MOCK_BRANCHES.forEach(b => {
        b.branchManagerName = 'N/A';
        b.branchManagerCode = 'N/A';
        // Preserve mobile number as it's a branch property now, not derived from manager
        b.mobileNumber = b.mobileNumber || 'N/A'; 
    });
    MOCK_STAFF.forEach(s => s.subordinates = []); // Clear subordinates before rebuilding

    // 2. Adjust staff's primary branch details based on MOCK_BRANCHES and enforce 'N/A' if branch is gone.
    //    Also, enforce `managedZones`/`managedBranches` consistency with `function`.
    MOCK_STAFF.forEach(staff => {
        const correspondingBranch = MOCK_BRANCHES.find(b => b.branchName === staff.branchName);
        
        if (!correspondingBranch) {
            // If staff's assigned primary branch is no longer in MOCK_BRANCHES, clear its primary branch details.
            if (staff.branchName !== 'N/A') { 
                staff.branchName = 'N/A';
                staff.zone = 'N/A';
                staff.region = 'N/A';
                staff.districtName = 'N/A';
            }
        } else {
            // If primary branch exists, ensure primary location details match.
            staff.zone = correspondingBranch.zone;
            staff.region = correspondingBranch.region;
            staff.districtName = correspondingBranch.districtName; // District is now a mandatory string
        }

        // Enforce managed* fields consistency with function
        // Designations that are not multi-unit managers should have empty managed lists.
        const isZonalManager = staff.function.toUpperCase() === 'ZONAL MANAGER';
        const isDistrictHead = staff.function.toUpperCase() === 'DISTRICT HEAD';
        const isAssistantDistrictHead = staff.function.toUpperCase() === 'ASSISTANT DISTRICT HEAD';
        const isTL = staff.function.toUpperCase().startsWith('TL-');

        if (!isZonalManager) {
            staff.managedZones = [];
        }
        if (!isDistrictHead && !isAssistantDistrictHead && !isTL) {
            staff.managedBranches = [];
        }
        // If a Team Leader, ensure their managedBranches include their own branch by default if none are set
        if (isTL && staff.branchName && staff.branchName !== 'N/A' && (!staff.managedBranches || staff.managedBranches.length === 0)) {
            staff.managedBranches = [staff.branchName];
        }

        // If a multi-unit manager has no managed units, try to assign a default based on their primary location
        if (isZonalManager && (!staff.managedZones || staff.managedZones.length === 0)) {
            // Default to primary zone if available, otherwise first zone in MOCK_ZONES
            staff.managedZones = staff.zone && staff.zone !== 'N/A' ? [staff.zone] : (MOCK_ZONES[0]?.name ? [MOCK_ZONES[0].name] : []);
        }
        if ((isDistrictHead || isAssistantDistrictHead) && (!staff.managedBranches || staff.managedBranches.length === 0)) {
            // Default to primary branch if available, otherwise first branch in MOCK_BRANCHES
            staff.managedBranches = staff.branchName && staff.branchName !== 'N/A' ? [staff.branchName] : (MOCK_BRANCHES[0]?.branchName ? [MOCK_BRANCHES[0].branchName] : []);
        }
    });

    // 3. Identify and assign actual primary managers from MOCK_STAFF to MOCK_BRANCHES
    //    (The first staff member with function 'BRANCH MANAGER' found for a branch
    //    in the staff list becomes the official manager for that branch).
    const managersAssignedToBranches = new Set<string>(); // Tracks branches that have had a manager assigned in this pass.
    MOCK_STAFF.forEach(staff => {
        if (staff.function.toUpperCase() === 'BRANCH MANAGER' && staff.branchName && staff.branchName !== 'N/A' && !managersAssignedToBranches.has(staff.branchName)) {
            const branch = MOCK_BRANCHES.find(b => b.branchName === staff.branchName);
            if (branch) {
                branch.branchManagerName = staff.employeeName;
                branch.branchManagerCode = staff.employeeCode;
                // Preserve the branch's mobile number, as it's a branch property and not the manager's contact.
                managersAssignedToBranches.add(branch.branchName); // Mark branch as having an assigned manager
            }
        }
    });

    // 4. Demote any staff still marked as 'BRANCH MANAGER' who were NOT assigned as the official manager
    //    to their branch in the previous step (e.g., duplicate managers for the same branch or misassigned).
    MOCK_STAFF.forEach(staff => {
        // Only target staff explicitly with 'BRANCH MANAGER' function for potential demotion.
        // Other designations like 'ASSISTANT BRANCH MANAGER' are preserved.
        if (staff.function.toUpperCase() === 'BRANCH MANAGER' && staff.branchName && staff.branchName !== 'N/A') {
            const branch = MOCK_BRANCHES.find(b => b.branchName === staff.branchName);
            
            // If the branch exists but the staff member's employeeCode does not match the branch's assigned manager code, demote.
            if (branch && branch.branchManagerCode !== staff.employeeCode) {
                staff.function = 'BRANCH OFFICER'; // Demote to full designation
            }
            // If the branch does not exist (and it wasn't caught in step 2 for some reason),
            // this 'BRANCH MANAGER' cannot manage a non-existent branch.
            if (!branch && staff.branchName !== 'N/A') {
                staff.function = 'BRANCH OFFICER';
                staff.branchName = 'N/A';
                staff.zone = 'N/A';
                staff.region = 'N/A';
                staff.districtName = 'N/A';
            }
        }
    });

    // 5. Build the reporting hierarchy (subordinates)
    const staffMap = new Map<string, StaffMember>();
    MOCK_STAFF.forEach(s => staffMap.set(s.employeeCode, s));

    MOCK_STAFF.forEach(s => {
        if (s.reportsToEmployeeCode) {
            const manager = staffMap.get(s.reportsToEmployeeCode);
            if (manager && manager.employeeCode !== s.employeeCode) { // Prevent self-reporting
                if (!manager.subordinates) {
                    manager.subordinates = [];
                }
                // Ensure no duplicate subordinates
                if (!manager.subordinates.some(sub => sub.id === s.id)) {
                    manager.subordinates.push(s);
                }
            } else if (!manager) {
                // If the reported manager doesn't exist, clear reportsToEmployeeCode
                s.reportsToEmployeeCode = undefined;
            }
        }
    });

    reinitializeAuth(MOCK_STAFF); // Finally, reinitialize auth after all sync with the current MOCK_STAFF
};

// Removed: _buildHierarchyAndSyncStaff(); // Removed immediate call

// New: Function to initialize data and auth services once at app startup
export const initializeDataAndAuthServices = () => {
    _buildHierarchyAndSyncStaff(); // This will now trigger reinitializeAuth(MOCK_STAFF)
};


// Custom error for branch deletion
export class BranchDeletionError extends Error {
    public staff: StaffMember[];
    constructor(message: string, staff: StaffMember[]) {
        super(message);
        this.name = 'BranchDeletionError';
        this.staff = staff;
    }
}


// --- Public API ---

export const getStaffData = (): StaffMember[] => {
    return [...MOCK_STAFF];
};

export const getStaffById = (id: string): Promise<StaffMember | undefined> => {
    return Promise.resolve(MOCK_STAFF.find(s => s.id === id));
};

export const getAllStaff = (): Promise<StaffMember[]> => {
    return Promise.resolve([...MOCK_STAFF]);
};


export const getStaffByBranch = (branchName: string): Promise<StaffMember[]> => {
     return new Promise((resolve) => {
        const staff = MOCK_STAFF.filter(s => s.branchName === branchName);
        resolve(staff);
    });
}

// Get all branches
export const getBranches = (): Promise<Branch[]> => {
    return Promise.resolve([...MOCK_BRANCHES]);
};

export const addStaff = (staffData: Omit<StaffMember, 'id' | 'subordinates'>): Promise<StaffMember> => {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            if (MOCK_STAFF.some(s => s.employeeCode === staffData.employeeCode)) {
                return reject(new Error('Employee Code must be unique.'));
            }
            // Ensure districtName and contactNumber have defaults if not provided
            staffData.districtName = staffData.districtName || 'N/A';
            staffData.contactNumber = staffData.contactNumber || 'N/A';
            staffData.reportsToEmployeeCode = staffData.reportsToEmployeeCode || undefined; // Ensure default for new field

            // Validate and enforce managed units consistency
            const isZonalManager = staffData.function.toUpperCase() === 'ZONAL MANAGER';
            const isDistrictHead = staffData.function.toUpperCase() === 'DISTRICT HEAD';
            const isAssistantDistrictHead = staffData.function.toUpperCase() === 'ASSISTANT DISTRICT HEAD';
            const isTL = staffData.function.toUpperCase().startsWith('TL-');

            if (isZonalManager) {
                if (!staffData.managedZones || staffData.managedZones.length === 0) {
                    return reject(new Error('Zonal Manager must have at least one zone assigned.'));
                }
                staffData.managedBranches = []; // Clear managedBranches for Zonal Managers
            } else if (isDistrictHead || isAssistantDistrictHead || isTL) {
                if (!staffData.managedBranches || staffData.managedBranches.length === 0) {
                    return reject(new Error('District Head / Assistant District Head / Team Leader must have at least one branch assigned.'));
                }
                staffData.managedZones = []; // Clear managedZones for these roles
            } else {
                staffData.managedZones = [];
                staffData.managedBranches = [];
            }
            
            const newStaff: StaffMember = {
                ...staffData,
                id: `staff-${Date.now()}`,
                subordinates: [], // Initialize empty, will be populated by _buildHierarchyAndSyncStaff
            };
            MOCK_STAFF.push(newStaff);
            _buildHierarchyAndSyncStaff(); // Sync after staff change
            resolve(newStaff);
        }, 300);
    });
};

export const addMultipleStaff = (staffData: Omit<StaffMember, 'id' | 'subordinates'>[]): Promise<{ added: number; skipped: number }> => {
    return new Promise((resolve) => {
        setTimeout(() => {
            const existingCodes = new Set(MOCK_STAFF.map(s => s.employeeCode));
            let added = 0;
            let skipped = 0;
            // No longer directly handling managers during bulk staff import here,
            // as branch manager status is derived from staff function in _buildHierarchyAndSyncStaff.
            // Branch manager assignment is now done via the StaffManagement page or UserManagement.

            staffData.forEach(staff => {
                if (staff.employeeCode && !existingCodes.has(staff.employeeCode)) {
                    // Ensure districtName and contactNumber have defaults if not provided
                    staff.districtName = staff.districtName || 'N/A';
                    staff.contactNumber = staff.contactNumber || 'N/A';
                    staff.managedZones = staff.managedZones || [];
                    staff.managedBranches = staff.managedBranches || [];
                    staff.reportsToEmployeeCode = staff.reportsToEmployeeCode || undefined; // Ensure new field is included

                    // Enforce consistency for managed units
                    const isZonalManager = staff.function.toUpperCase() === 'ZONAL MANAGER';
                    const isDistrictHead = staff.function.toUpperCase() === 'DISTRICT HEAD';
                    const isAssistantDistrictHead = staff.function.toUpperCase() === 'ASSISTANT DISTRICT HEAD';
                    const isTL = staff.function.toUpperCase().startsWith('TL-');


                    if (!isZonalManager) {
                        staff.managedZones = [];
                    }
                    if (!isDistrictHead && !isAssistantDistrictHead && !isTL) {
                        staff.managedBranches = [];
                    }

                    const newStaff: StaffMember = {
                        ...staff,
                        id: `staff-${Date.now()}-${Math.random()}`,
                        subordinates: [], // Initialize empty, will be populated by _buildHierarchyAndSyncStaff
                    };
                    MOCK_STAFF.push(newStaff);
                    existingCodes.add(newStaff.employeeCode); // Use newStaff.employeeCode to track
                    added++;
                } else {
                    skipped++;
                }
            });
            
            _buildHierarchyAndSyncStaff(); // Sync after all staff changes
            resolve({ added, skipped });
        }, 300);
    });
};


export const updateStaff = (id: string, updateData: Partial<Omit<StaffMember, 'id' | 'subordinates'>>): Promise<StaffMember> => {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            const staffIndex = MOCK_STAFF.findIndex(s => s.id === id);
            if (staffIndex === -1) {
                return reject(new Error('Staff member not found.'));
            }

            const oldStaff = MOCK_STAFF[staffIndex];
            const updatedStaff = { ...oldStaff, ...updateData };

            if (updateData.employeeCode && MOCK_STAFF.some(s => s.employeeCode === updateData.employeeCode && s.id !== id)) {
                return reject(new Error('Employee Code must be unique.'));
            }

            // Ensure districtName and contactNumber have defaults if not provided (for partial updates)
            updatedStaff.districtName = updatedStaff.districtName; // District is now a mandatory string
            updatedStaff.contactNumber = updatedStaff.contactNumber || 'N/A';
            updatedStaff.managedZones = updatedStaff.managedZones || [];
            updatedStaff.managedBranches = updatedStaff.managedBranches || [];
            // FIX: Ensure reportsToEmployeeCode is explicitly set, if updateData.reportsToEmployeeCode is undefined, it means "No Manager" was selected
            // Use updateData.reportsToEmployeeCode directly; if it's undefined, it will propagate.
            updatedStaff.reportsToEmployeeCode = updateData.reportsToEmployeeCode !== undefined ? updateData.reportsToEmployeeCode : oldStaff.reportsToEmployeeCode;


            // Validate and enforce managed units consistency based on updated function
            const isZonalManager = updatedStaff.function.toUpperCase() === 'ZONAL MANAGER';
            const isDistrictHead = updatedStaff.function.toUpperCase() === 'DISTRICT HEAD';
            const isAssistantDistrictHead = updatedStaff.function.toUpperCase() === 'ASSISTANT DISTRICT HEAD';
            const isTL = updatedStaff.function.toUpperCase().startsWith('TL-');


            if (isZonalManager) {
                if (!updatedStaff.managedZones || updatedStaff.managedZones.length === 0) {
                    return reject(new Error('Zonal Manager must have at least one zone assigned.'));
                }
                updatedStaff.managedBranches = [];
            } else if (isDistrictHead || isAssistantDistrictHead || isTL) {
                if (!updatedStaff.managedBranches || updatedStaff.managedBranches.length === 0) {
                    return reject(new Error('District Head / Assistant District Head / Team Leader must have at least one branch assigned.'));
                }
                updatedStaff.managedZones = [];
            } else {
                updatedStaff.managedZones = [];
                updatedStaff.managedBranches = [];
            }

            // The logic for demoting/promoting branch managers is handled by _buildHierarchyAndSyncStaff
            // based on the `function` and `branchName` of the staff.
            // This `updateStaff` function should not directly modify `MOCK_BRANCHES` manager fields.
            
            MOCK_STAFF[staffIndex] = updatedStaff;
            _buildHierarchyAndSyncStaff(); // Sync after staff change
            resolve(updatedStaff);
        }, 300);
    });
};

export const removeStaff = (id: string): Promise<void> => {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            const staffIndex = MOCK_STAFF.findIndex(s => s.id === id);
            if (staffIndex === -1) {
                return reject(new Error('Staff member not found.'));
            }

            const removedStaffCode = MOCK_STAFF[staffIndex].employeeCode;
            MOCK_STAFF.splice(staffIndex, 1);

            // Clear reportsToEmployeeCode for any staff who reported to the removed staff
            MOCK_STAFF.forEach(s => {
                if (s.reportsToEmployeeCode === removedStaffCode) {
                    s.reportsToEmployeeCode = undefined;
                }
            });
            // Also remove any KRAs assigned to the removed staff
            MOCK_KRA_DATA.splice(0, MOCK_KRA_DATA.length, ...MOCK_KRA_DATA.filter(k => k.staffEmployeeCode !== removedStaffCode));

            _buildHierarchyAndSyncStaff(); // Sync after staff change
            resolve();
        }, 300);
    });
};

export const removeMultipleStaff = (ids: string[]): Promise<void> => {
    return new Promise((resolve) => {
        setTimeout(() => {
            const initialLength = MOCK_STAFF.length;
            const removedStaffCodes: string[] = MOCK_STAFF.filter(s => ids.includes(s.id)).map(s => s.employeeCode);

            MOCK_STAFF = MOCK_STAFF.filter(s => !ids.includes(s.id));
            
            // Clear reportsToEmployeeCode for any staff who reported to the removed staff
            MOCK_STAFF.forEach(s => {
                if (s.reportsToEmployeeCode && removedStaffCodes.includes(s.reportsToEmployeeCode)) {
                    s.reportsToEmployeeCode = undefined;
                }
            });
            // Also remove any KRAs assigned to the removed staff
            MOCK_KRA_DATA.splice(0, MOCK_KRA_DATA.length, ...MOCK_KRA_DATA.filter(k => !removedStaffCodes.includes(k.staffEmployeeCode)));


            if (MOCK_STAFF.length < initialLength) {
                _buildHierarchyAndSyncStaff(); // Sync if actual deletions occurred
            }
            resolve();
        }, 300);
    });
};

export const removeAllStaff = (adminUserIdToKeep: string): Promise<void> => {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            const adminStaff = MOCK_STAFF.find(s => s.id === adminUserIdToKeep);
            const zonalManagerStaff = MOCK_STAFF.find(s => s.id === ZONAL_MANAGER_USER_ID); // Preserve ZM too

            if (!adminStaff) {
                console.warn('Error: Admin user not found to preserve during removeAllStaff. Clearing all staff.');
                MOCK_STAFF = []; // If admin not found, clear all anyway
            } else {
                // Clear any managed units for the admin if they were accidentally set.
                adminStaff.managedZones = [];
                adminStaff.managedBranches = [];
                adminStaff.reportsToEmployeeCode = undefined; // Admin has no manager
                MOCK_STAFF = [adminStaff];

                if (zonalManagerStaff && zonalManagerStaff.id !== adminUserIdToKeep) {
                    // If ZM is distinct from Admin, add them back
                    zonalManagerStaff.managedZones = ['Zone-1', 'Zone-2']; // Reset ZM's managed zones
                    zonalManagerStaff.managedBranches = [];
                    zonalManagerStaff.reportsToEmployeeCode = adminStaff.employeeCode; // ZM reports to Admin
                    MOCK_STAFF.push(zonalManagerStaff);
                }
            }
            // Clear all KRAs after staff reset
            MOCK_KRA_DATA.splice(0, MOCK_KRA_DATA.length);
            _buildHierarchyAndSyncStaff(); // Sync after mass deletion
            // reinitializeAuth(); // Moved inside _buildHierarchyAndSyncStaff
            resolve();
        }, 300);
    });
};


// Branch mutations are now enabled to modify MOCK_BRANCHES directly.
export const addBranch = (branchData: Omit<Branch, 'id'>): Promise<Branch> => {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            if (MOCK_BRANCHES.some(b => b.branchName.toLowerCase() === branchData.branchName.toLowerCase())) {
                return reject(new Error('Branch name must be unique.'));
            }
            // Validate zone, region, district against existing master data
            if (!MOCK_ZONES.some(z => z.name === branchData.zone)) return reject(new Error(`Zone "${branchData.zone}" not found in master data.`));
            if (!MOCK_REGIONS.some(r => r.name === branchData.region)) return reject(new Error(`Region "${branchData.region}" not found in master data.`));
            if (!MOCK_DISTRICTS.some(d => d.name === branchData.districtName)) return reject(new Error(`District "${branchData.districtName}" not found in master data.`));

            const newBranch: Branch = {
                ...branchData,
                id: `branch-${Date.now()}`,
                districtName: branchData.districtName,
                // Ensure manager details and mobile number are set to N/A or defaults, 
                // as they are no longer assigned via this form directly.
                branchManagerName: branchData.branchManagerName || 'N/A',
                branchManagerCode: branchData.branchManagerCode || 'N/A',
                mobileNumber: branchData.mobileNumber || 'N/A', 
            };
            MOCK_BRANCHES.push(newBranch);
            
            // Removed logic to create/update staff for primary branch manager.
            // Manager assignment is now handled via StaffManagementPage/UserManagement.
            
            _buildHierarchyAndSyncStaff(); // Sync after branch change
            resolve(newBranch);
        }, 300);
    });
}
export const addMultipleBranches = (branchesData: Omit<Branch, 'id'>[]): Promise<{ added: number; skipped: number }> => {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            const existingBranchNames = new Set(MOCK_BRANCHES.map(b => b.branchName.toLowerCase().trim()));
            let added = 0;
            let skipped = 0;

            // Managers are no longer directly updated here from branch data.
            // Their status as primary branch managers is derived in _buildHierarchyAndSyncStaff.

            for (const branchData of branchesData) { // Use for...of for better loop control and potential early exit on error
                const trimmedName = branchData.branchName.trim();
                if (trimmedName && !existingBranchNames.has(trimmedName.toLowerCase())) {
                    // Validate zone, region, district against existing master data
                    if (!MOCK_ZONES.some(z => z.name === branchData.zone)) { skipped++; continue; } // Skip if invalid
                    if (!MOCK_REGIONS.some(r => r.name === branchData.region)) { skipped++; continue; }
                    if (!MOCK_DISTRICTS.some(d => d.name === branchData.districtName)) { skipped++; continue; }

                    const newBranch: Branch = {
                        ...branchData,
                        branchName: trimmedName, // Use trimmed name
                        id: `branch-${Date.now()}-${Math.random()}`,
                        districtName: branchData.districtName,
                        // Ensure manager details and mobile number are set to N/A or defaults
                        branchManagerName: branchData.branchManagerName || 'N/A',
                        branchManagerCode: branchData.branchManagerCode || 'N/A',
                        mobileNumber: branchData.mobileNumber || 'N/A',
                    };
                    MOCK_BRANCHES.push(newBranch);
                    existingBranchNames.add(trimmedName.toLowerCase()); // Avoid duplicates within the same import file
                    added++;
                } else {
                    skipped++;
                }
            }
            
            _buildHierarchyAndSyncStaff(); // Sync after all branch changes
            resolve({ added, skipped });
        }, 300);
    });
};

export const updateBranch = (id: string, updateData: Partial<Omit<Branch, 'id'>>): Promise<Branch> => {
     return new Promise((resolve, reject) => {
        setTimeout(() => {
            const branchIndex = MOCK_BRANCHES.findIndex(b => b.id === id);
            if (branchIndex === -1) {
                return reject(new Error('Branch not found.'));
            }
            
            const oldBranch = MOCK_BRANCHES[branchIndex];
            const updatedBranch = { ...oldBranch, ...updateData };

            if (updateData.branchName && updateData.branchName.toLowerCase() !== oldBranch.branchName.toLowerCase() &&
                MOCK_BRANCHES.some(b => b.branchName.toLowerCase() === updateData.branchName?.toLowerCase() && b.id !== id)) {
                return reject(new Error('Branch name must be unique.'));
            }

            // Validate zone, region, district against existing master data
            if (updateData.zone && !MOCK_ZONES.some(z => z.name === updateData.zone)) return reject(new Error(`Zone "${updateData.zone}" not found in master data.`));
            if (updateData.region && !MOCK_REGIONS.some(r => r.name === updateData.region)) return reject(new Error(`Region "${updateData.region}" not found in master data.`));
            if (updateData.districtName && !MOCK_DISTRICTS.some(d => d.name === updateData.districtName)) return reject(new Error(`District "${updateData.districtName}" not found in master data.`));

            // Manager assignment and mobile number are now derived/managed elsewhere.
            // Preserve existing values if not explicitly updated in `updateData`.
            updatedBranch.branchManagerName = updateData.branchManagerName || oldBranch.branchManagerName;
            updatedBranch.branchManagerCode = updateData.branchManagerCode || oldBranch.branchManagerCode;
            updatedBranch.mobileNumber = updateData.mobileNumber || oldBranch.mobileNumber;

            // Removed logic to demote old manager or promote new manager based on branch update.
            // This is now handled by StaffManagementPage and _buildHierarchyAndSyncStaff.

            MOCK_BRANCHES[branchIndex] = updatedBranch;
            _buildHierarchyAndSyncStaff(); // Sync after branch change
            resolve(updatedBranch);
        }, 300);
    });
};

export const removeBranch = (id: string): Promise<void> => {
     return new Promise((resolve, reject) => {
        setTimeout(() => {
            const branchIndex = MOCK_BRANCHES.findIndex(b => b.id === id);
            if (branchIndex === -1) {
                return reject(new Error('Branch not found.'));
            }

            const branchToDelete = MOCK_BRANCHES[branchIndex];
            const assignedStaff = MOCK_STAFF.filter(staff => staff.branchName === branchToDelete.branchName);

            // Special case: If the only staff assigned to this branch is its primary manager, delete both
            const isOnlyManagerLeft = assignedStaff.length === 1 && assignedStaff[0].employeeCode === branchToDelete.branchManagerCode;

            if (assignedStaff.length > 0 && !isOnlyManagerLeft) {
                const message = `Cannot delete branch "${branchToDelete.branchName}" as it has ${assignedStaff.length} staff member(s) assigned.`;
                console.warn('BranchDeletionError:', message, assignedStaff); // Log error internally
                return reject(new BranchDeletionError(message, assignedStaff));
            }
            
            // If only the primary manager is left, or no staff, proceed with deletion
            if (isOnlyManagerLeft) {
                MOCK_STAFF = MOCK_STAFF.filter(s => s.employeeCode !== branchToDelete.branchManagerCode);
            }

            MOCK_BRANCHES.splice(branchIndex, 1);
            // Also remove any branch targets associated with this branch
            MOCK_BRANCH_TARGETS.splice(0, MOCK_BRANCH_TARGETS.length, ...MOCK_BRANCH_TARGETS.filter(bt => bt.branchName !== branchToDelete.branchName));

            _buildHierarchyAndSyncStaff(); // Sync after branch change
            // reinitializeAuth(); // Moved inside _buildHierarchyAndSyncStaff
            resolve();
        }, 300);
    });
};

export const removeAllBranches = (): Promise<void> => {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            // First, check if any staff members are assigned to branches that are NOT the primary managers of those branches.
            // Managers will be handled by demoting their function to 'BRANCH OFFICER' implicitly by _buildHierarchyAndSyncStaff.
            const staffAssignedToBranches = MOCK_STAFF.filter(staff => 
                staff.branchName !== 'N/A' && MOCK_BRANCHES.some(b => b.branchName === staff.branchName) && staff.function.toUpperCase() !== 'BRANCH MANAGER'
            );

            if (staffAssignedToBranches.length > 0) {
                const message = 'Cannot delete all branches because some still have non-manager staff assigned. Please reassign or delete staff first.';
                console.warn('removeAllBranches failed:', message, staffAssignedToBranches); // Log error internally
                return reject(new Error(message));
            }
            
            // All staff who were primary branch managers should have their function changed to 'BRANCH OFFICER'
            MOCK_STAFF.forEach(staff => {
                if (staff.function.toUpperCase() === 'BRANCH MANAGER') {
                    staff.function = 'BRANCH OFFICER';
                    staff.branchName = 'N/A';
                    staff.zone = 'N/A';
                    staff.region = 'N/A';
                    staff.districtName = 'N/A';
                }
                // Also clear any managed units for all staff and reportsTo
                staff.managedZones = [];
                staff.managedBranches = [];
                staff.reportsToEmployeeCode = undefined;
            });

            MOCK_BRANCHES = [];
            MOCK_BRANCH_TARGETS.splice(0, MOCK_BRANCH_TARGETS.length); // Clear all branch targets as well
            _buildHierarchyAndSyncStaff(); // Sync after mass deletion
            // reinitializeAuth(); // Moved inside _buildHierarchyAndSyncStaff
            resolve();
        }, 300);
    });
};


// --- KRA Functions ---
export const getKrasForStaff = (staffEmployeeCode: string, periodType?: TargetPeriodType, period?: string): Promise<Kra[]> => {
    return new Promise((resolve) => {
        let kras = MOCK_KRA_DATA.filter(k => k.staffEmployeeCode === staffEmployeeCode);
        if (periodType) {
            kras = kras.filter(k => k.periodType === periodType);
        }
        if (period) {
            kras = kras.filter(k => k.period === period);
        }
        resolve(kras);
    });
};

export const getAllKras = (): Promise<Kra[]> => {
    return Promise.resolve([...MOCK_KRA_DATA]);
};

export const saveKra = (kraData: Omit<Kra, 'id'>): Promise<Kra> => {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            // Check for existing KRA for the same staff, metric, period, and periodType to prevent duplicates
            const existing = MOCK_KRA_DATA.find(k => 
                k.staffEmployeeCode === kraData.staffEmployeeCode &&
                k.metric === kraData.metric &&
                k.period === kraData.period &&
                k.periodType === kraData.periodType
            );

            if (existing) {
                return reject(new Error(`A KRA for "${kraData.metric}" already exists for this period and type. Please edit the existing one.`));
            }

            const newKra: Kra = {
                ...kraData,
                id: `kra-${Date.now()}-${Math.random()}`
            };
            MOCK_KRA_DATA.push(newKra);
            resolve(newKra);
        }, 300);
    });
};

export const updateKra = (id: string, updateData: Partial<Omit<Kra, 'id'>>): Promise<Kra> => {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            const kraIndex = MOCK_KRA_DATA.findIndex(k => k.id === id);
            if (kraIndex === -1) {
                return reject(new Error('KRA not found.'));
            }
            const updatedKra = { ...MOCK_KRA_DATA[kraIndex], ...updateData };
            MOCK_KRA_DATA[kraIndex] = updatedKra;
            resolve(updatedKra);
        }, 300);
    });
};

export const deleteKra = (id: string): Promise<void> => {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            const kraIndex = MOCK_KRA_DATA.findIndex(k => k.id === id);
            if (kraIndex === -1) {
                return reject(new Error('KRA not found.'));
            }
            MOCK_KRA_DATA.splice(kraIndex, 1);
            resolve();
        }, 300);
    });
};

/**
 * Resets all application data: deletes all staff (except admin), all branches, all KRAs, and all product metrics.
 * @param adminUserIdToKeep The ID of the admin user to preserve.
 */
export const resetAppData = (adminUserIdToKeep: string): Promise<void> => {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            try {
                // 1. Preserve admin user and Zonal Manager user
                const adminStaff = MOCK_STAFF.find(s => s.id === adminUserIdToKeep);
                const zonalManagerStaff = MOCK_STAFF.find(s => s.id === ZONAL_MANAGER_USER_ID);

                MOCK_STAFF = []; // Start with an empty staff list

                if (adminStaff) {
                    // Clean and add admin back
                    adminStaff.managedZones = [];
                    adminStaff.managedBranches = [];
                    adminStaff.reportsToEmployeeCode = undefined;
                    MOCK_STAFF.push(adminStaff);
                }

                if (zonalManagerStaff && zonalManagerStaff.id !== adminUserIdToKeep) {
                    // Clean and add ZM back, ensuring they report to Admin
                    zonalManagerStaff.managedZones = ['Zone-1', 'Zone-2']; // Default managed zones
                    zonalManagerStaff.managedBranches = [];
                    zonalManagerStaff.reportsToEmployeeCode = adminStaff?.employeeCode; // ZM reports to Admin
                    MOCK_STAFF.push(zonalManagerStaff);
                }


                // 2. Clear all branches
                MOCK_BRANCHES = [];

                // 3. Clear all KRAs
                MOCK_KRA_DATA.splice(0, MOCK_KRA_DATA.length);

                // 4. Reset product metrics to default
                MOCK_PRODUCT_METRICS = [
                    { id: 'prod-1', name: 'GRAND TOTAL AMT', category: 'GRAND TOTAL', type: 'Amount', unitOfMeasure: 'INR', contributesToOverallGoals: true },
                    { id: 'prod-2', name: 'GRAND TOTAL AC', category: 'GRAND TOTAL', type: 'Account', unitOfMeasure: 'Units', contributesToOverallGoals: true },
                    { id: 'prod-3', name: 'DDS AMT', category: 'DDS', type: 'Amount', unitOfMeasure: 'INR', contributesToOverallGoals: true },
                    { id: 'prod-4', name: 'DDS AC', category: 'DDS', type: 'Account', unitOfMeasure: 'Units', contributesToOverallGoals: true },
                    { id: 'prod-5', name: 'FD AMT', category: 'FD', type: 'Amount', unitOfMeasure: 'INR', contributesToOverallGoals: true },
                    { id: 'prod-6', name: 'FD AC', category: 'FD', type: 'Account', unitOfMeasure: 'Units', contributesToOverallGoals: true },
                    { id: 'prod-7', name: 'RD AMT', category: 'RD', type: 'Amount', unitOfMeasure: 'INR', contributesToOverallGoals: true },
                    { id: 'prod-8', name: 'RD AC', category: 'RD', type: 'Account', unitOfMeasure: 'Units', contributesToOverallGoals: true },
                    { id: 'prod-9', name: 'SAVS-AMT', category: 'SAVS', type: 'Amount', unitOfMeasure: 'INR', contributesToOverallGoals: true },
                    { id: 'prod-10', name: 'SAVS-AC', category: 'SAVS', type: 'Account', unitOfMeasure: 'Units', contributesToOverallGoals: true },
                    { id: 'prod-11', name: 'DAM AMT', category: 'DAM', type: 'Amount', unitOfMeasure: 'INR', contributesToOverallGoals: true },
                    { id: 'prod-12', name: 'DAM AC', category: 'DAM', type: 'Account', unitOfMeasure: 'Units', contributesToOverallGoals: true },
                    { id: 'prod-13', name: 'MIS AMT', category: 'MIS', type: 'Amount', unitOfMeasure: 'INR', contributesToOverallGoals: true },
                    { id: 'prod-14', name: 'MIS AC', category: 'MIS', type: 'Account', unitOfMeasure: 'Units', contributesToOverallGoals: true },
                    { id: 'prod-15', name: 'SMBG AMT', category: 'SMBG', type: 'Amount', unitOfMeasure: 'INR', contributesToOverallGoals: true },
                    { id: 'prod-16', name: 'SMBG AC', category: 'SMBG', type: 'Account', unitOfMeasure: 'Units', contributesToOverallGoals: true },
                    { id: 'prod-17', name: 'CUR-GOLD-AMT', category: 'CUR-GOLD', type: 'Amount', unitOfMeasure: 'INR', contributesToOverallGoals: true },
                    { id: 'prod-18', name: 'CUR-GOLD-AC', category: 'CUR-GOLD', type: 'Account', unitOfMeasure: 'Units', contributesToOverallGoals: true },
                    { id: 'prod-19', name: 'CUR-WEL-AMT', category: 'CUR-WEL', type: 'Amount', unitOfMeasure: 'INR', contributesToOverallGoals: true },
                    { id: 'prod-20', name: 'CUR-WEL-AC', category: 'CUR-WEL', type: 'Account', unitOfMeasure: 'Units', contributesToOverallGoals: true },
                    { id: 'prod-21', name: 'NEW-SS/AGNT', category: 'NEW-SS/AGNT', type: 'Other', unitOfMeasure: 'Units', contributesToOverallGoals: true },
                    { id: 'prod-22', name: 'INSU AC', category: 'INSU', type: 'Account', unitOfMeasure: 'Units', contributesToOverallGoals: true },
                    { id: 'prod-23', name: 'INSU AMT', category: 'INSU', type: 'Amount', unitOfMeasure: 'INR', contributesToOverallGoals: true },
                    { id: 'prod-24', name: 'TASC AC', category: 'TASC', type: 'Account', unitOfMeasure: 'Units', contributesToOverallGoals: true },
                    { id: 'prod-25', name: 'TASC AMT', category: 'TASC', type: 'Amount', unitOfMeasure: 'INR', contributesToOverallGoals: true },
                    { id: 'prod-26', name: 'SHARE AC', category: 'SHARE', type: 'Account', unitOfMeasure: 'Units', contributesToOverallGoals: true },
                    { id: 'prod-27', name: 'SHARE AMT', category: 'SHARE', type: 'Amount', unitOfMeasure: 'INR', contributesToOverallGoals: true },
                    { id: 'prod-28', name: 'DDS Target', category: 'DDS', type: 'Account', unitOfMeasure: 'Units', contributesToOverallGoals: true }, // Added DDS Target
                ];

                // 5. Clear Projection and Demand data
                MOCK_PROJECTION_DATA.splice(0, MOCK_PROJECTION_DATA.length);
                MOCK_DEMAND_DATA.splice(0, MOCK_DEMAND_DATA.length);
                MOCK_BRANCH_TARGETS.splice(0, MOCK_BRANCH_TARGETS.length); // Clear all branch targets
                MOCK_DAILY_ACHIEVEMENT_RECORDS.splice(0, MOCK_DAILY_ACHIEVEMENT_RECORDS.length); // Clear daily achievements
                MOCK_DESIGNATION_KRAS.splice(0, MOCK_DESIGNATION_KRAS.length); // Clear designation KRA mappings
                MOCK_DESIGNATION_KRAS.push(...initialDesignationKras); // Re-add initial mappings
                
                // 6. Reset Zone, Region, District data to default
                MOCK_ZONES = [...initialZones];
                MOCK_REGIONS = [...initialRegions];
                MOCK_DISTRICTS = [...initialDistricts];

                // 7. Synchronize and reinitialize authentication
                _buildHierarchyAndSyncStaff();
                // reinitializeAuth(); // Moved inside _buildHierarchyAndSyncStaff

                console.log('App data reset successfully. Admin user preserved.');
                resolve();
            } catch (error) {
                console.error('Error during resetAppData:', error);
                reject(new Error('Failed to reset app data.'));
            }
        }, 500); // Simulate network delay
    });
};

// --- Product Metric Functions ---

export const getProductMetrics = (): Promise<ProductMetric[]> => {
    return Promise.resolve([...MOCK_PRODUCT_METRICS]);
};

export const addProductMetric = (metricData: Omit<ProductMetric, 'id'>): Promise<ProductMetric> => {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            if (MOCK_PRODUCT_METRICS.some(m => m.name.toLowerCase() === metricData.name.toLowerCase())) {
                return reject(new Error('Product metric name must be unique.'));
            }
            const newMetric: ProductMetric = {
                ...metricData,
                id: `prod-${Date.now()}`
            };
            MOCK_PRODUCT_METRICS.push(newMetric);
            resolve(newMetric);
        }, 300);
    });
};

export const updateProductMetric = (id: string, updateData: Partial<Omit<ProductMetric, 'id'>>): Promise<ProductMetric> => {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            const metricIndex = MOCK_PRODUCT_METRICS.findIndex(m => m.id === id);
            if (metricIndex === -1) {
                return reject(new Error('Product metric not found.'));
            }
            const oldMetric = MOCK_PRODUCT_METRICS[metricIndex];
            if (updateData.name && updateData.name.toLowerCase() !== oldMetric.name.toLowerCase() &&
                MOCK_PRODUCT_METRICS.some(m => m.name.toLowerCase() === updateData.name?.toLowerCase() && m.id !== id)) {
                return reject(new Error('Product metric name must be unique.'));
            }
            const updatedMetric = { ...oldMetric, ...updateData };
            MOCK_PRODUCT_METRICS[metricIndex] = updatedMetric;
            resolve(updatedMetric);
        }, 300);
    });
};

export const removeProductMetric = (id: string): Promise<void> => {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            const metricIndex = MOCK_PRODUCT_METRICS.findIndex(m => m.id === id);
            if (metricIndex === -1) {
                return reject(new Error('Product metric not found.'));
            }
            // Store the metric before removing it
            const oldMetric = MOCK_PRODUCT_METRICS[metricIndex]; 
            MOCK_PRODUCT_METRICS.splice(metricIndex, 1);
            // Also remove this metric from any DesignationKRA mappings
            MOCK_DESIGNATION_KRAS.forEach(dkra => {
                dkra.metricIds = dkra.metricIds.filter(metricId => metricId !== id);
            });
            // Also remove any KRAs using this metric
            MOCK_KRA_DATA.splice(0, MOCK_KRA_DATA.length, ...MOCK_KRA_DATA.filter(k => k.metric !== oldMetric.name));
            // Also remove any Branch Targets using this metric
            MOCK_BRANCH_TARGETS.splice(0, MOCK_BRANCH_TARGETS.length, ...MOCK_BRANCH_TARGETS.filter(bt => bt.metric !== oldMetric.name));


            resolve();
        }, 300);
    });
};

// --- Designation KRA Functions ---
export const getDesignationKras = (): Promise<DesignationKRA[]> => {
    return Promise.resolve([...MOCK_DESIGNATION_KRAS]);
};

export const getDesignationKraByDesignation = (designation: Designation): Promise<DesignationKRA | undefined> => {
    return Promise.resolve(MOCK_DESIGNATION_KRAS.find(dkra => dkra.designation === designation));
};

export const saveDesignationKra = (dkraData: Omit<DesignationKRA, 'id'>): Promise<DesignationKRA> => {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            if (MOCK_DESIGNATION_KRAS.some(dkra => dkra.designation === dkraData.designation)) {
                return reject(new Error(`KRA mapping for designation "${dkraData.designation}" already exists.`));
            }
            const newDkra: DesignationKRA = {
                ...dkraData,
                id: `dkra-${Date.now()}`
            };
            MOCK_DESIGNATION_KRAS.push(newDkra);
            resolve(newDkra);
        }, 300);
    });
};

export const updateDesignationKra = (id: string, updateData: Partial<Omit<DesignationKRA, 'id'>>): Promise<DesignationKRA> => {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            const dkraIndex = MOCK_DESIGNATION_KRAS.findIndex(dkra => dkra.id === id);
            if (dkraIndex === -1) {
                return reject(new Error('Designation KRA mapping not found.'));
            }
            const updatedDkra = { ...MOCK_DESIGNATION_KRAS[dkraIndex], ...updateData };
            MOCK_DESIGNATION_KRAS[dkraIndex] = updatedDkra;
            resolve(updatedDkra);
        }, 300);
    });
};

export const removeDesignationKra = (id: string): Promise<void> => {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            const dkraIndex = MOCK_DESIGNATION_KRAS.findIndex(dkra => dkra.id === id);
            if (dkraIndex === -1) {
                return reject(new Error('Designation KRA mapping not found.'));
            }
            MOCK_DESIGNATION_KRAS.splice(dkraIndex, 1);
            resolve();
        }, 300);
    });
};


// --- Projection Functions ---
export const getProjectionsForStaff = (staffEmployeeCode: string, date: string): Promise<Projection[]> => {
    return new Promise((resolve) => {
        const projections = MOCK_PROJECTION_DATA.filter(p => p.staffEmployeeCode === staffEmployeeCode && p.date === date);
        resolve(projections);
    });
};

export const getAllProjections = (): Promise<Projection[]> => {
    return Promise.resolve([...MOCK_PROJECTION_DATA]);
};

export const saveProjection = (projectionData: Omit<Projection, 'id'>): Promise<Projection> => {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            // Check for existing projection for the same staff, date, and metric
            const existing = MOCK_PROJECTION_DATA.find(p =>
                p.staffEmployeeCode === projectionData.staffEmployeeCode &&
                p.date === projectionData.date &&
                p.metric === projectionData.metric
            );

            if (existing) {
                return reject(new Error(`A projection for "${projectionData.metric}" already exists for this date. Please edit the existing one.`));
            }

            const newProjection: Projection = {
                ...projectionData,
                id: `proj-${Date.now()}-${Math.random()}`
            };
            MOCK_PROJECTION_DATA.push(newProjection);
            resolve(newProjection);
        }, 300);
    });
};

export const updateProjection = (id: string, updateData: Partial<Omit<Projection, 'id'>>): Promise<Projection> => {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            const projectionIndex = MOCK_PROJECTION_DATA.findIndex(p => p.id === id);
            if (projectionIndex === -1) {
                return reject(new Error('Projection not found.'));
            }
            const updatedProjection = { ...MOCK_PROJECTION_DATA[projectionIndex], ...updateData };
            MOCK_PROJECTION_DATA[projectionIndex] = updatedProjection;
            resolve(updatedProjection);
        }, 300);
    });
};

export const deleteProjection = (id: string): Promise<void> => {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            const projectionIndex = MOCK_PROJECTION_DATA.findIndex(p => p.id === id);
            if (projectionIndex === -1) {
                return reject(new Error('Projection not found.'));
            }
            MOCK_PROJECTION_DATA.splice(projectionIndex, 1);
            resolve();
        }, 300);
    });
};

// --- Demand Functions ---
export const getDemandsForStaff = (staffEmployeeCode: string, date: string): Promise<Demand[]> => {
    return new Promise((resolve) => {
        const demands = MOCK_DEMAND_DATA.filter(d => d.staffEmployeeCode === staffEmployeeCode && d.date === date);
        resolve(demands);
    });
};

export const getAllDemands = (): Promise<Demand[]> => {
    return Promise.resolve([...MOCK_DEMAND_DATA]);
};

export const saveDemand = (demandData: Omit<Demand, 'id'>): Promise<Demand> => {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            // Check for existing demand for the same staff, date, and metric
            const existing = MOCK_DEMAND_DATA.find(d =>
                d.staffEmployeeCode === demandData.staffEmployeeCode &&
                d.date === demandData.date &&
                d.metric === demandData.metric
            );

            if (existing) {
                return reject(new Error(`A demand for "${demandData.metric}" already exists for this date. Please edit the existing one.`));
            }

            const newDemand: Demand = {
                ...demandData,
                id: `demand-${Date.now()}-${Math.random()}`
            };
            MOCK_DEMAND_DATA.push(newDemand);
            resolve(newDemand);
        }, 300);
    });
};

export const updateDemand = (id: string, updateData: Partial<Omit<Demand, 'id'>>): Promise<Demand> => {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            const demandIndex = MOCK_DEMAND_DATA.findIndex(d => d.id === id);
            if (demandIndex === -1) {
                return reject(new Error('Demand not found.'));
            }
            const updatedDemand = { ...MOCK_DEMAND_DATA[demandIndex], ...updateData };
            MOCK_DEMAND_DATA[demandIndex] = updatedDemand;
            resolve(updatedDemand);
        }, 300);
    });
};

export const deleteDemand = (id: string): Promise<void> => {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            const demandIndex = MOCK_DEMAND_DATA.findIndex(d => d.id === id);
            if (demandIndex === -1) {
                return reject(new Error('Demand not found.'));
            }
            MOCK_DEMAND_DATA.splice(demandIndex, 1);
            resolve();
        }, 300);
    });
};


// --- Branch Target Functions ---
export const getBranchTargets = (branchName?: string, month?: string): Promise<BranchTarget[]> => {
    return new Promise((resolve) => {
        let targets = [...MOCK_BRANCH_TARGETS];
        if (branchName) {
            targets = targets.filter(bt => bt.branchName === branchName);
        }
        if (month) {
            targets = targets.filter(bt => bt.month === month);
        }
        resolve(targets);
    });
};

export const getAllBranchTargets = (): Promise<BranchTarget[]> => {
    return Promise.resolve([...MOCK_BRANCH_TARGETS]);
};

export const saveBranchTarget = (targetData: Omit<BranchTarget, 'id'>): Promise<BranchTarget> => {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            const existing = MOCK_BRANCH_TARGETS.find(bt => 
                bt.branchName === targetData.branchName &&
                bt.metric === targetData.metric &&
                bt.month === targetData.month
            );

            if (existing) {
                return reject(new Error(`A target for "${targetData.metric}" already exists for this branch and month.`));
            }

            const newTarget: BranchTarget = {
                ...targetData,
                id: `bt-${Date.now()}-${Math.random()}`
            };
            MOCK_BRANCH_TARGETS.push(newTarget);
            resolve(newTarget);
        }, 300);
    });
};

export const updateBranchTarget = (id: string, updateData: Partial<Omit<BranchTarget, 'id'>>): Promise<BranchTarget> => {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            const targetIndex = MOCK_BRANCH_TARGETS.findIndex(bt => bt.id === id);
            if (targetIndex === -1) {
                return reject(new Error('Branch target not found.'));
            }
            const updatedTarget = { ...MOCK_BRANCH_TARGETS[targetIndex], ...updateData };
            MOCK_BRANCH_TARGETS[targetIndex] = updatedTarget;
            resolve(updatedTarget);
        }, 300);
    });
};

export const deleteBranchTarget = (id: string): Promise<void> => {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            const targetIndex = MOCK_BRANCH_TARGETS.findIndex(bt => bt.id === id);
            if (targetIndex === -1) {
                return reject(new Error('Branch target not found.'));
            }
            MOCK_BRANCH_TARGETS.splice(targetIndex, 1);
            resolve();
        }, 300);
    });
};

interface DemandRunRateParams {
    entityId: string; // employeeCode or branchName
    isBranch: boolean;
    currentMonth: string; // YYYY-MM
    achievementRecords: CsvRecord[];
}

const initializeDemandRunRateResult = (currentMonth: string): DemandRunRateResult => {
    const [year, month] = currentMonth.split('-').map(Number);
    const totalDaysInMonth = getDaysInMonth(year, month);
    const remainingDays = getDaysRemainingInMonth(new Date());

    return {
        monthlyTargetAmount: 0,
        monthlyTargetAccount: 0,
        mtdAchievementAmount: 0,
        mtdAchievementAccount: 0,
        remainingTargetAmount: 0,
        remainingTargetAccount: 0,
        daysInMonth: totalDaysInMonth,
        daysRemainingInMonth: remainingDays,
        dailyRunRateAmount: 0,
        dailyRunRateAccount: 0,
    };
};

/**
 * Calculates demand run rate for a single staff member or a single branch.
 * @param params DemandRunRateParams
 * @returns DemandRunRateResult
 */
export const calculateDemandRunRateForSingleEntity = async ({ entityId, isBranch, currentMonth, achievementRecords }: DemandRunRateParams): Promise<DemandRunRateResult> => {
    const result = initializeDemandRunRateResult(currentMonth);
    
    const productMetrics = await getProductMetrics();
    const amountMetrics = productMetrics.filter(m => m.type === 'Amount' && m.name !== 'GRAND TOTAL AMT' && m.contributesToOverallGoals);
    const accountMetrics = productMetrics.filter(m => m.type === 'Account' && m.name !== 'GRAND TOTAL AC' && m.name !== 'NEW-SS/AGNT' && m.contributesToOverallGoals);
    const otherAccountMetrics = productMetrics.filter(m => m.type === 'Other' && m.name === 'NEW-SS/AGNT' && m.contributesToOverallGoals); // Special handling for NEW-SS/AGNT

    // 1. Calculate Monthly Targets
    let targets: Kra[] | BranchTarget[] = [];
    if (isBranch) {
        targets = await getBranchTargets(entityId, currentMonth);
    } else {
        // Fetch only monthly KRA targets for run rate calculations
        targets = await getKrasForStaff(entityId, 'monthly', currentMonth); // Explicitly request 'monthly' targets for the current month
    }

    const grandTotalAmtTarget = targets.find(t => t.metric === 'GRAND TOTAL AMT'); // Assuming these are already filtered for month
    const grandTotalAcTarget = targets.find(t => t.metric === 'GRAND TOTAL AC');

    if (grandTotalAmtTarget) {
        result.monthlyTargetAmount = grandTotalAmtTarget.target;
    } else {
        result.monthlyTargetAmount = targets
            .filter(t => amountMetrics.some(m => m.name === t.metric))
            .reduce((sum, t) => sum + t.target, 0);
    }

    if (grandTotalAcTarget) {
        result.monthlyTargetAccount = grandTotalAcTarget.target;
    } else {
        result.monthlyTargetAccount = targets
            .filter(t => (accountMetrics.some(m => m.name === t.metric) || otherAccountMetrics.some(m => m.name === t.metric)))
            .reduce((sum, t) => sum + t.target, 0);
    }

    // 2. Calculate MTD Achievements
    const todayYYYYMMDD = getTodayDateYYYYMMDD();
    const currentMonthRecords = achievementRecords.filter(record => {
        const recordDateStr = record['DATE'] as string; // dd/mm/yyyy
        if (!recordDateStr) return false;
        const [day, month, year] = recordDateStr.split('/').map(Number);
        const recordMonth = getMonthString(new Date(year, month - 1, day)); // YYYY-MM
        const recordDate = new Date(year, month - 1, day);
        const todayDate = new Date(todayYYYYMMDD); // YYYY-MM-DD
        
        return recordMonth === currentMonth && recordDate <= todayDate;
    });

    let filteredAchievementRecords = currentMonthRecords;
    if (isBranch) {
        filteredAchievementRecords = filteredAchievementRecords.filter(record => String(record['BRANCH NAME']) === entityId);
    } else {
        filteredAchievementRecords = filteredAchievementRecords.filter(record => String(record['STAFF NAME']).includes(entityId)); // Using includes for partial match from employeeCode
    }

    result.mtdAchievementAmount = filteredAchievementRecords.reduce((sum, record) => sum + (Number(record['GRAND TOTAL AMT']) || 0), 0);
    result.mtdAchievementAccount = filteredAchievementRecords.reduce((sum, record) => sum + (Number(record['GRAND TOTAL AC']) || 0), 0);

    // 3. Calculate Remaining Targets and Daily Run Rate
    result.remainingTargetAmount = Math.max(0, result.monthlyTargetAmount - result.mtdAchievementAmount);
    result.remainingTargetAccount = Math.max(0, result.monthlyTargetAccount - result.mtdAchievementAccount);

    if (result.daysRemainingInMonth > 0) {
        result.dailyRunRateAmount = result.remainingTargetAmount / result.daysRemainingInMonth;
        result.dailyRunRateAccount = result.remainingTargetAccount / result.daysRemainingInMonth;
    }

    return result;
};


export const calculateDemandRunRateForOverall = async ({ currentMonth, achievementRecords }: { currentMonth: string; achievementRecords: CsvRecord[] }): Promise<DemandRunRateResult> => {
    const result = initializeDemandRunRateResult(currentMonth);

    const productMetrics = await getProductMetrics();
    const amountMetrics = productMetrics.filter(m => m.type === 'Amount' && m.name !== 'GRAND TOTAL AMT' && m.contributesToOverallGoals);
    const accountMetrics = productMetrics.filter(m => m.type === 'Account' && m.name !== 'GRAND TOTAL AC' && m.name !== 'NEW-SS/AGNT' && m.contributesToOverallGoals);
    const otherAccountMetrics = productMetrics.filter(m => m.type === 'Other' && m.name === 'NEW-SS/AGNT' && m.contributesToOverallGoals);

    // 1. Calculate Overall Monthly Targets (sum of all branch targets)
    const allBranchTargets = await getBranchTargets(undefined, currentMonth); // Get all branch targets for the month

    const overallGrandTotalAmtTarget = allBranchTargets.find(t => t.metric === 'GRAND TOTAL AMT' && t.month === currentMonth);
    const overallGrandTotalAcTarget = allBranchTargets.find(t => t.metric === 'GRAND TOTAL AC' && t.month === currentMonth);

    if (overallGrandTotalAmtTarget) {
        result.monthlyTargetAmount = overallGrandTotalAmtTarget.target;
    } else {
        result.monthlyTargetAmount = allBranchTargets
            .filter(t => amountMetrics.some(m => m.name === t.metric) && t.month === currentMonth)
            .reduce((sum, t) => sum + t.target, 0);
    }

    if (overallGrandTotalAcTarget) {
        result.monthlyTargetAccount = overallGrandTotalAcTarget.target;
    } else {
        result.monthlyTargetAccount = allBranchTargets
            .filter(t => (accountMetrics.some(m => m.name === t.metric) || otherAccountMetrics.some(m => m.name === t.metric)))
            .reduce((sum, t) => sum + t.target, 0);
    }

    // 2. Calculate Overall MTD Achievements
    const todayYYYYMMDD = getTodayDateYYYYMMDD();
    const currentMonthRecords = achievementRecords.filter(record => {
        const recordDateStr = record['DATE'] as string; // dd/mm/yyyy
        if (!recordDateStr) return false;
        const [day, month, year] = recordDateStr.split('/').map(Number);
        const recordMonth = getMonthString(new Date(year, month - 1, day)); // YYYY-MM
        const recordDate = new Date(year, month - 1, day);
        const todayDate = new Date(todayYYYYMMDD); // YYYY-MM-DD

        return recordMonth === currentMonth && recordDate <= todayDate;
    });

    result.mtdAchievementAmount = currentMonthRecords.reduce((sum, record) => sum + (Number(record['GRAND TOTAL AMT']) || 0), 0);
    result.mtdAchievementAccount = currentMonthRecords.reduce((sum, record) => sum + (Number(record['GRAND TOTAL AC']) || 0), 0);

    // 3. Calculate Remaining Targets and Daily Run Rate
    result.remainingTargetAmount = Math.max(0, result.monthlyTargetAmount - result.mtdAchievementAmount);
    result.remainingTargetAccount = Math.max(0, result.monthlyTargetAccount - result.mtdAchievementAccount);

    if (result.daysRemainingInMonth > 0) {
        result.dailyRunRateAmount = result.remainingTargetAmount / result.daysRemainingInMonth;
        result.dailyRunRateAccount = result.remainingTargetAccount / result.daysRemainingInMonth;
    }

    return result;
};


/**
 * Calculates demand run rate dynamically based on the user's role and their assigned management scope.
 * This includes direct subordinates if the user has any.
 * @param user The current logged-in user.
 * @param currentMonth The current month in YYYY-MM format.
 * @param achievementRecords All achievement records for the calculations.
 * @returns DemandRunRateResult
 */
export const calculateDemandRunRateForUserScope = async (user: User, currentMonth: string, achievementRecords: CsvRecord[]): Promise<DemandRunRateResult> => {
    const allStaffMembers = await getAllStaff(); // Get the full staff list for hierarchy traversal
    const allBranches = await getBranches(); // Get all branches for zone/branch lookup

    if (user.role === 'admin') {
        return calculateDemandRunRateForOverall({ currentMonth, achievementRecords });
    }

    const aggregatedResult: DemandRunRateResult = initializeDemandRunRateResult(currentMonth);

    // 1. Determine the scope of staff and branches
    const relevantEmployeeCodes = new Set<string>();
    const relevantBranchNames = new Set<string>();

    // Include the current user's own employee code and primary branch (if they are a direct contributor or a primary branch manager)
    if (user.employeeCode) {
        relevantEmployeeCodes.add(user.employeeCode);
    }
    if (user.branchName && user.branchName !== 'N/A') {
        // Only add primary branch if user is a direct contributor or manager of that branch
        const userStaffRecord = allStaffMembers.find(s => s.id === user.id);
        if (userStaffRecord && (userStaffRecord.function.toUpperCase().includes('MANAGER') || userStaffRecord.function.toUpperCase().includes('HEAD') || userStaffRecord.function.toUpperCase().startsWith('TL-') || user.role === 'user')) {
             relevantBranchNames.add(user.branchName);
        }
    }


    // Add all subordinates (and their subordinates) to the scope
    const userStaffNode = allStaffMembers.find(s => s.id === user.id);
    if (userStaffNode) {
        const { employeeCodes: subCodes, branchNames: subBranches } = getRecursiveSubordinateInfo(userStaffNode, allStaffMembers);
        subCodes.forEach(code => relevantEmployeeCodes.add(code));
        subBranches.forEach(name => relevantBranchNames.add(name));
    }


    // Add branches from managedZones or managedBranches for multi-unit managers
    if (user.designation.toUpperCase() === 'ZONAL MANAGER' && user.managedZones && user.managedZones.length > 0) {
        allBranches.filter(b => user.managedZones!.includes(b.zone)).forEach(b => relevantBranchNames.add(b.branchName));
    } else if ((user.designation.toUpperCase() === 'DISTRICT HEAD' || user.designation.toUpperCase() === 'ASSISTANT DISTRICT HEAD' || user.designation.toUpperCase().startsWith('TL-')) && user.managedBranches && user.managedBranches.length > 0) {
        user.managedBranches.forEach(bName => relevantBranchNames.add(bName));
    }

    // If, after all considerations, no specific scope is determined, this might indicate an edge case or misconfiguration.
    // In such cases, the aggregatedResult will remain at its initialized zero values.
    if (relevantEmployeeCodes.size === 0 && relevantBranchNames.size === 0) {
        return aggregatedResult;
    }

    // 2. Aggregate Monthly Targets
    const productMetrics = await getProductMetrics();
    const amountMetrics = productMetrics.filter(m => m.type === 'Amount' && m.name !== 'GRAND TOTAL AMT' && m.contributesToOverallGoals);
    const accountMetrics = productMetrics.filter(m => m.type === 'Account' && m.name !== 'GRAND TOTAL AC' && m.name !== 'NEW-SS/AGNT' && m.contributesToOverallGoals);
    const otherAccountMetrics = productMetrics.filter(m => m.type === 'Other' && m.name === 'NEW-SS/AGNT' && m.contributesToOverallGoals);

    // Combine all relevant KRA targets from individual staff members
    let totalKRAAmountTarget = 0;
    let totalKRAAccountTarget = 0;
    for (const empCode of Array.from(relevantEmployeeCodes)) {
        // Fetch only monthly KRA targets for run rate calculations
        const staffKras = await getKrasForStaff(empCode, 'monthly', currentMonth);
        
        const staffGrandTotalAmtTarget = staffKras.find(t => t.metric === 'GRAND TOTAL AMT');
        const staffGrandTotalAcTarget = staffKras.find(t => t.metric === 'GRAND TOTAL AC');

        if (staffGrandTotalAmtTarget) {
            totalKRAAmountTarget += staffGrandTotalAmtTarget.target;
        } else {
            totalKRAAmountTarget += staffKras
                .filter(t => amountMetrics.some(m => m.name === t.metric))
                .reduce((sum, t) => sum + t.target, 0);
        }

        if (staffGrandTotalAcTarget) {
            totalKRAAccountTarget += staffGrandTotalAcTarget.target;
        } else {
            totalKRAAccountTarget += staffKras
                .filter(t => (accountMetrics.some(m => m.name === t.metric) || otherAccountMetrics.some(m => m.name === t.metric)))
                .reduce((sum, t) => sum + t.target, 0);
        }
    }
    aggregatedResult.monthlyTargetAmount += totalKRAAmountTarget;
    aggregatedResult.monthlyTargetAccount += totalKRAAccountTarget;

    // Combine all relevant Branch Targets from managed branches (avoiding double-counting if individual KRAs already cover it)
    // This is a simplification for the mock. In a real system, you might have specific rules for how branch targets and individual KRAs sum up.
    // Here, we add branch targets only if no individual KRAs were found, or if they represent a separate, higher-level target.
    // Or, more robustly, if the user's role is primarily a multi-unit manager, prioritize summing branch targets for their scope.
    if (relevantBranchNames.size > 0 && (user.designation.toUpperCase() === 'ZONAL MANAGER' || user.designation.toUpperCase() === 'DISTRICT HEAD' || user.designation.toUpperCase() === 'ASSISTANT DISTRICT HEAD' || user.designation.toUpperCase().startsWith('TL-'))) {
        let totalBranchTargetAmount = 0;
        let totalBranchTargetAccount = 0;
        for (const branchName of Array.from(relevantBranchNames)) {
            const branchTargetsForMonth = await getBranchTargets(branchName, currentMonth);
            
            const branchGrandTotalAmtTarget = branchTargetsForMonth.find(t => t.metric === 'GRAND TOTAL AMT');
            const branchGrandTotalAcTarget = branchTargetsForMonth.find(t => t.metric === 'GRAND TOTAL AC');

            if (branchGrandTotalAmtTarget) {
                totalBranchTargetAmount += branchGrandTotalAmtTarget.target;
            } else {
                totalBranchTargetAmount += branchTargetsForMonth
                    .filter(t => amountMetrics.some(m => m.name === t.metric))
                    .reduce((sum, t) => sum + t.target, 0);
            }

            if (branchGrandTotalAcTarget) {
                totalBranchTargetAccount += branchGrandTotalAcTarget.target;
            } else {
                totalBranchTargetAccount += branchTargetsForMonth
                    .filter(t => (accountMetrics.some(m => m.name === t.metric) || otherAccountMetrics.some(m => m.name === t.metric)))
                    .reduce((sum, t) => sum + t.target, 0);
            }
        }
        // Add branch targets. If staff KRAs were also found for some of these, there might be double counting.
        // A real system would have clear rules on precedence (e.g., if staff KRAs exist, don't use branch targets for those staff/metrics).
        // For simplicity in mock: assume branch targets are "umbrella" targets.
        // If relevantEmployeeCodes had targets, and also relevantBranchNames have targets, these might sum up.
        // Let's decide a simple rule: if a role manages *units* (zones/branches), their primary target view should be the sum of those units' targets.
        // If they *also* have individual KRAs, these contribute.
        // The most robust way is to aggregate from the lowest level (individual staff KRAs) and then add any "uncovered" higher-level targets.
        // For now, let's take a simple approach: sum all relevant staff KRAs, then sum all relevant branch targets separately.
        // This *might* lead to overcounting if staff KRAs are direct components of branch targets, but it's simple.
        // A better mock would be to:
        // 1. Calculate sum of all staff KRAs in scope.
        // 2. Calculate sum of all branch targets in scope.
        // 3. The final target is MAX(sum of staff KRAs, sum of branch targets) or a more complex hierarchical sum/dedupe.
        // For now, let's prioritize branch targets for multi-unit managers if they have managed units, and otherwise staff KRAs.
        if (relevantBranchNames.size > 0 && (user.designation.toUpperCase() === 'ZONAL MANAGER' || user.designation.toUpperCase() === 'DISTRICT HEAD' || user.designation.toUpperCase() === 'ASSISTANT DISTRICT HEAD' || user.designation.toUpperCase().startsWith('TL-'))) {
            aggregatedResult.monthlyTargetAmount = Math.max(aggregatedResult.monthlyTargetAmount, totalBranchTargetAmount);
            aggregatedResult.monthlyTargetAccount = Math.max(aggregatedResult.monthlyTargetAccount, totalBranchTargetAccount);
        }
    }


    // 3. Filter Achievement Records by relevant scope
    const filteredAchievementRecords = achievementRecords.filter(record => {
        const staffNameInRecord = String(record['STAFF NAME']);
        const branchNameInRecord = String(record['BRANCH NAME']);
        const recordMonth = getMonthString(new Date(convertDDMMYYYYtoYYYYMMDD(String(record['DATE']))));

        // Only consider records for the current month
        if (recordMonth !== currentMonth) return false;

        // Check if the record belongs to any of the relevant employee codes or branches
        const isRelevantStaff = Array.from(relevantEmployeeCodes).some(empCode => staffNameInRecord.includes(empCode));
        const isRelevantBranch = Array.from(relevantBranchNames).some(bName => branchNameInRecord.includes(bName));
        
        return isRelevantStaff || isRelevantBranch;
    });

    const todayYYYYMMDD = getTodayDateYYYYMMDD();
    const currentMonthFilteredAchievementRecords = filteredAchievementRecords.filter(record => {
        const recordDate = new Date(convertDDMMYYYYtoYYYYMMDD(String(record['DATE'])));
        const todayDate = new Date(todayYYYYMMDD);
        return recordDate <= todayDate;
    });


    aggregatedResult.mtdAchievementAmount = currentMonthFilteredAchievementRecords.reduce((sum, record) => sum + (Number(record['GRAND TOTAL AMT']) || 0), 0);
    aggregatedResult.mtdAchievementAccount = currentMonthFilteredAchievementRecords.reduce((sum, record) => sum + (Number(record['GRAND TOTAL AC']) || 0), 0);

    aggregatedResult.remainingTargetAmount = Math.max(0, aggregatedResult.monthlyTargetAmount - aggregatedResult.mtdAchievementAmount);
    aggregatedResult.remainingTargetAccount = Math.max(0, aggregatedResult.monthlyTargetAccount - aggregatedResult.mtdAchievementAccount);

    if (aggregatedResult.daysRemainingInMonth > 0) {
        aggregatedResult.dailyRunRateAmount = aggregatedResult.remainingTargetAmount / aggregatedResult.daysRemainingInMonth;
        aggregatedResult.dailyRunRateAccount = aggregatedResult.remainingTargetAccount / aggregatedResult.daysRemainingInMonth;
    }
    return aggregatedResult;
};

// New: Function to get detailed monthly targets for the user's scope
export const getDetailedMonthlyTargetsForUserScope = async (user: User, currentMonth: string): Promise<DetailedMonthlyTargets> => {
    const allStaffMembers = await getAllStaff();
    const allBranches = await getBranches();
    const productMetrics = await getProductMetrics();

    let aggregatedTargets: DetailedMonthlyTargets = {
        totalAmount: 0,
        totalAc: 0,
        ddsAc: 0,
        fdAc: 0,
    };

    // Determine the scope of staff and branches
    const relevantEmployeeCodes = new Set<string>();
    const relevantBranchNames = new Set<string>();

    if (user.role === 'admin') {
        // Admin sees everything for overall calculation, sum all branch targets
        allBranches.forEach(b => relevantBranchNames.add(b.branchName));
    } else {
        // For non-admin, always include their own employee code if exists
        if (user.employeeCode) {
            relevantEmployeeCodes.add(user.employeeCode);
        }

        // Add all subordinates (and their subordinates) to the scope
        const userStaffNode = allStaffMembers.find(s => s.id === user.id);
        if (userStaffNode) {
            const { employeeCodes: subCodes, branchNames: subBranches } = getRecursiveSubordinateInfo(userStaffNode, allStaffMembers);
            subCodes.forEach(code => relevantEmployeeCodes.add(code));
            subBranches.forEach(name => relevantBranchNames.add(name));
        }

        // Add branches from managedZones or managedBranches for multi-unit managers
        if (user.designation.toUpperCase() === 'ZONAL MANAGER' && user.managedZones && user.managedZones.length > 0) {
            allBranches.filter(b => user.managedZones!.includes(b.zone)).forEach(b => relevantBranchNames.add(b.branchName));
        } else if ((user.designation.toUpperCase() === 'DISTRICT HEAD' || user.designation.toUpperCase() === 'ASSISTANT DISTRICT HEAD' || user.designation.toUpperCase().startsWith('TL-')) && user.managedBranches && user.managedBranches.length > 0) {
            user.managedBranches.forEach(bName => relevantBranchNames.add(bName));
        } else if (user.branchName && user.branchName !== 'N/A') {
            // For regular users/branch managers, their direct branch
            relevantBranchNames.add(user.branchName);
        }
    }
    
    // If no scope is determined for a non-admin, return zeros
    if (user.role !== 'admin' && relevantEmployeeCodes.size === 0 && relevantBranchNames.size === 0) {
        return aggregatedTargets;
    }


    // Aggregate KRA Targets for relevant staff
    let tempKRAAmount = 0;
    let tempKRAAccount = 0;
    let tempKRADdsAc = 0;
    let tempKRAFdAc = 0;

    for (const empCode of Array.from(relevantEmployeeCodes)) {
        // Fetch only monthly KRA targets for detailed monthly targets
        const staffKras = await getKrasForStaff(empCode, 'monthly', currentMonth);
        
        // Prioritize specific grand totals if available, otherwise sum individuals
        const staffGrandTotalAmtTarget = staffKras.find(t => t.metric === 'GRAND TOTAL AMT');
        const staffGrandTotalAcTarget = staffKras.find(t => t.metric === 'GRAND TOTAL AC');

        if (staffGrandTotalAmtTarget) {
            tempKRAAmount += staffGrandTotalAmtTarget.target;
        } else {
            tempKRAAmount += staffKras
                .filter(t => productMetrics.some(m => m.name === t.metric && m.type === 'Amount' && m.name !== 'GRAND TOTAL AMT'))
                .reduce((sum, t) => sum + t.target, 0);
        }

        if (staffGrandTotalAcTarget) {
            tempKRAAccount += staffGrandTotalAcTarget.target;
        } else {
            tempKRAAccount += staffKras
                .filter(t => productMetrics.some(m => m.name === t.metric && m.type === 'Account' && m.name !== 'GRAND TOTAL AC') || (productMetrics.some(m => m.name === t.metric && m.type === 'Other' && m.name === 'NEW-SS/AGNT')))
                .reduce((sum, t) => sum + t.target, 0);
        }
        
        // Specific metrics
        tempKRADdsAc += (staffKras.find(t => t.metric === 'DDS AC')?.target || 0);
        tempKRAFdAc += (staffKras.find(t => t.metric === 'FD AC')?.target || 0);
    }

    // Aggregate Branch Targets for relevant branches
    let tempBranchAmount = 0;
    let tempBranchAccount = 0;
    let tempBranchDdsAc = 0;
    let tempBranchFdAc = 0;

    for (const branchName of Array.from(relevantBranchNames)) {
        const branchTargetsForMonth = await getBranchTargets(branchName, currentMonth);

        const branchGrandTotalAmtTarget = branchTargetsForMonth.find(t => t.metric === 'GRAND TOTAL AMT');
        const branchGrandTotalAcTarget = branchTargetsForMonth.find(t => t.metric === 'GRAND TOTAL AC');

        if (branchGrandTotalAmtTarget) {
            tempBranchAmount += branchGrandTotalAmtTarget.target;
        } else {
            tempBranchAmount += branchTargetsForMonth
                .filter(t => productMetrics.some(m => m.name === t.metric && m.type === 'Amount' && m.name !== 'GRAND TOTAL AMT'))
                .reduce((sum, t) => sum + t.target, 0);
        }

        if (branchGrandTotalAcTarget) {
            tempBranchAccount += branchGrandTotalAcTarget.target;
        } else {
            tempBranchAccount += branchTargetsForMonth
                .filter(t => productMetrics.some(m => m.name === t.metric && m.type === 'Account' && m.name !== 'GRAND TOTAL AC') || (productMetrics.some(m => m.name === t.metric && m.type === 'Other' && m.name === 'NEW-SS/AGNT')))
                .reduce((sum, t) => sum + t.target, 0);
        }

        // Specific metrics
        tempBranchDdsAc += (branchTargetsForMonth.find(t => t.metric === 'DDS AC')?.target || 0);
        tempBranchFdAc += (branchTargetsForMonth.find(t => t.metric === 'FD AC')?.target || 0);
    }
    
    // Final aggregation logic:
    // For Admin: Sum of all branch targets found in scope (which is all branches for admin)
    if (user.role === 'admin') {
        aggregatedTargets.totalAmount = tempBranchAmount;
        aggregatedTargets.totalAc = tempBranchAccount;
        aggregatedTargets.ddsAc = tempBranchDdsAc;
        aggregatedTargets.fdAc = tempBranchFdAc;
    } else if (user.role === 'manager') {
        // Manager: Combine staff KRAs within their hierarchy and targets from managed branches/zones.
        // This is a simplified sum. In a real system, you might have specific deduplication rules.
        aggregatedTargets.totalAmount = tempKRAAmount + tempBranchAmount;
        aggregatedTargets.totalAc = tempKRAAccount + tempBranchAccount;
        aggregatedTargets.ddsAc = tempKRADdsAc + tempBranchDdsAc;
        aggregatedTargets.fdAc = tempKRAFdAc + tempBranchFdAc;
    } else { // 'user' role
        // User: Only their own KRA targets.
        aggregatedTargets.totalAmount = tempKRAAmount;
        aggregatedTargets.totalAc = tempKRAAccount;
        aggregatedTargets.ddsAc = tempKRADdsAc;
        aggregatedTargets.fdAc = tempKRAFdAc;
    }
    
    return aggregatedTargets;
};


// --- Daily Achievement Record Functions ---

export const getDailyAchievementRecords = (): Promise<DailyAchievementRecord[]> => {
    return Promise.resolve([...MOCK_DAILY_ACHIEVEMENT_RECORDS]);
};

export const getDailyAchievementRecord = (date: string, staffName: string): Promise<DailyAchievementRecord | undefined> => {
    return Promise.resolve(MOCK_DAILY_ACHIEVEMENT_RECORDS.find(r => r.date === date && r['STAFF NAME'] === staffName));
};

export const addDailyAchievementRecord = (recordData: Omit<DailyAchievementRecord, 'id'>): Promise<DailyAchievementRecord> => {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            const existingRecord = MOCK_DAILY_ACHIEVEMENT_RECORDS.find(
                r => r.date === recordData.date && r['STAFF NAME'] === recordData['STAFF NAME']
            );
            if (existingRecord) {
                return reject(new Error('A daily achievement record for this staff and date already exists. Please update it instead.'));
            }

            const newRecord: DailyAchievementRecord = {
                ...recordData,
                id: `daily-ach-${Date.now()}-${Math.random()}`
            };
            MOCK_DAILY_ACHIEVEMENT_RECORDS.push(newRecord);
            resolve(newRecord);
        }, 300);
    });
};

export const updateDailyAchievementRecord = (id: string, updateData: Partial<Omit<DailyAchievementRecord, 'id'>>): Promise<DailyAchievementRecord> => {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            const index = MOCK_DAILY_ACHIEVEMENT_RECORDS.findIndex(r => r.id === id);
            if (index === -1) {
                return reject(new Error('Daily achievement record not found.'));
            }
            const updatedRecord = { ...MOCK_DAILY_ACHIEVEMENT_RECORDS[index], ...updateData };
            MOCK_DAILY_ACHIEVEMENT_RECORDS[index] = updatedRecord;
            resolve(updatedRecord);
        }, 300);
    });
};

export const addMultipleDailyAchievementRecords = (recordsData: Omit<DailyAchievementRecord, 'id'>[]): Promise<{ added: number; updated: number; skipped: number }> => {
    return new Promise((resolve) => {
        setTimeout(() => {
            let added = 0;
            let updated = 0;
            let skipped = 0;

            recordsData.forEach(newRecordData => {
                const existingRecordIndex = MOCK_DAILY_ACHIEVEMENT_RECORDS.findIndex(
                    r => r.date === newRecordData.date && r['STAFF NAME'] === newRecordData['STAFF NAME']
                );

                if (existingRecordIndex !== -1) {
                    // Update existing record
                    MOCK_DAILY_ACHIEVEMENT_RECORDS[existingRecordIndex] = {
                        ...MOCK_DAILY_ACHIEVEMENT_RECORDS[existingRecordIndex],
                        ...newRecordData,
                        id: MOCK_DAILY_ACHIEVEMENT_RECORDS[existingRecordIndex].id // Preserve existing ID
                    };
                    updated++;
                } else {
                    // Add new record
                    const newRecord: DailyAchievementRecord = {
                        ...newRecordData,
                        id: `daily-ach-${Date.now()}-${Math.random()}`
                    };
                    MOCK_DAILY_ACHIEVEMENT_RECORDS.push(newRecord);
                    added++;
                }
            });
            resolve({ added, updated, skipped: 0 });
        }, 300);
    });
};

export const clearDailyAchievementRecords = (): Promise<void> => {
    return new Promise((resolve) => {
        setTimeout(() => {
            MOCK_DAILY_ACHIEVEMENT_RECORDS.splice(0, MOCK_DAILY_ACHIEVEMENT_RECORDS.length);
            resolve();
        }, 300);
    });
};

// Helper to transform raw daily achievement records to ParsedCsvData format
export const transformDailyAchievementsToParsedCsvData = (records: DailyAchievementRecord[]): ParsedCsvData => {
    const rawRecords: CsvRecord[] = records.map(rec => {
        const { id, ...rest } = rec;
        // Convert YYYY-MM-DD date to DD/MM/YYYY for compatibility with existing CSV parsing logic
        const [year, month, day] = rec.date.split('-');
        return {
            ...rest,
            'DATE': `${day}/${month}/${year}`,
        };
    });

    if (rawRecords.length === 0) {
        return {
            summary: {
                staffCount: '0',
                branchCount: 0,
                startDate: 'N/A',
                endDate: 'N/A',
                totalAmount: 0,
                totalAc: 0,
            },
            headers: [],
            records: [],
        };
    }

    const allKeys = new Set<string>();
    rawRecords.forEach(record => {
        Object.keys(record).forEach(key => allKeys.add(key));
    });
    const headers = Array.from(allKeys);

    let totalAmount = 0;
    let totalAc = 0;
    let earliestDate: Date | null = null;
    let latestDate: Date | null = null;
    const uniqueStaff = new Set<string>();
    const uniqueBranches = new Set<string>();

    rawRecords.forEach(record => {
        totalAmount += (Number(record['GRAND TOTAL AMT']) || 0);
        totalAc += (Number(record['GRAND TOTAL AC']) || 0);
        
        if (record['STAFF NAME']) uniqueStaff.add(String(record['STAFF NAME']));
        if (record['BRANCH NAME']) uniqueBranches.add(String(record['BRANCH NAME']));

        const dateStr = record['DATE'] as string; // DD/MM/YYYY
        if (dateStr && /^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
            const [day, month, year] = dateStr.split('/').map(Number);
            const recordDate = new Date(year, month - 1, day);
            if (!earliestDate || recordDate < earliestDate) earliestDate = recordDate;
            if (!latestDate || recordDate > latestDate) latestDate = recordDate;
        }
    });

    const summary: CsvSummary = {
        staffCount: uniqueStaff.size.toString(),
        branchCount: uniqueBranches.size,
        startDate: earliestDate ? earliestDate.toLocaleDateString('en-GB') : 'N/A',
        endDate: latestDate ? latestDate.toLocaleDateString('en-GB') : 'N/A',
        totalAmount: totalAmount,
        totalAc: totalAc,
    };

    return {
        summary,
        headers,
        records: rawRecords,
    };
};

// --- Zone Management Functions ---
export const getZones = (): Promise<Zone[]> => {
    return Promise.resolve([...MOCK_ZONES]);
};

export const addZone = (zoneData: Omit<Zone, 'id'>): Promise<Zone> => {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            if (MOCK_ZONES.some(z => z.name.toLowerCase() === zoneData.name.toLowerCase())) {
                return reject(new Error('Zone name must be unique.'));
            }
            const newZone: Zone = {
                ...zoneData,
                id: `zone-${Date.now()}`
            };
            MOCK_ZONES.push(newZone);
            _buildHierarchyAndSyncStaff(); // Re-sync after adding a new organizational unit
            resolve(newZone);
        }, 300);
    });
};

export const updateZone = (id: string, updateData: Partial<Omit<Zone, 'id'>>): Promise<Zone> => {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            const zoneIndex = MOCK_ZONES.findIndex(z => z.id === id);
            if (zoneIndex === -1) {
                return reject(new Error('Zone not found.'));
            }
            const oldZone = MOCK_ZONES[zoneIndex];
            if (updateData.name && updateData.name.toLowerCase() !== oldZone.name.toLowerCase() &&
                MOCK_ZONES.some(z => z.name.toLowerCase() === updateData.name?.toLowerCase() && z.id !== id)) {
                return reject(new Error('Zone name must be unique.'));
            }
            const updatedZone = { ...oldZone, ...updateData };
            MOCK_ZONES[zoneIndex] = updatedZone;
            _buildHierarchyAndSyncStaff(); // Re-sync after updating an organizational unit
            resolve(updatedZone);
        }, 300);
    });
};

export const removeZone = (id: string): Promise<void> => {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            const zoneIndex = MOCK_ZONES.findIndex(z => z.id === id);
            if (zoneIndex === -1) {
                return reject(new Error('Zone not found.'));
            }
            const zoneToRemove = MOCK_ZONES[zoneIndex];

            // Check if any branches are still assigned to this zone
            if (MOCK_BRANCHES.some(b => b.zone === zoneToRemove.name)) {
                return reject(new Error(`Cannot delete zone "${zoneToRemove.name}" as branches are still assigned to it. Please reassign or delete branches first.`));
            }
            // Check if any staff (e.g., Zonal Managers) have this zone in their managedZones
            if (MOCK_STAFF.some(s => s.managedZones?.includes(zoneToRemove.name))) {
                return reject(new Error(`Cannot delete zone "${zoneToRemove.name}" as staff members are still managing it. Please update staff assignments first.`));
            }
            // Check if any regions are still assigned to this zone
            if (MOCK_REGIONS.some(r => r.zoneId === zoneToRemove.id)) {
                return reject(new Error(`Cannot delete zone "${zoneToRemove.name}" as regions are still assigned to it. Please reassign or delete regions first.`));
            }

            MOCK_ZONES.splice(zoneIndex, 1);
            _buildHierarchyAndSyncStaff(); // Re-sync after removing an organizational unit
            resolve();
        }, 300);
    });
};

// --- Region Management Functions ---
export const getRegions = (): Promise<Region[]> => {
    return Promise.resolve([...MOCK_REGIONS]);
};

export const addRegion = (regionData: Omit<Region, 'id'>): Promise<Region> => {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            if (MOCK_REGIONS.some(r => r.name.toLowerCase() === regionData.name.toLowerCase())) {
                return reject(new Error('Region name must be unique.'));
            }
            // Validate zoneId if provided
            if (regionData.zoneId && !MOCK_ZONES.some(z => z.id === regionData.zoneId)) {
                return reject(new Error(`Zone with ID "${regionData.zoneId}" not found.`));
            }

            const newRegion: Region = {
                ...regionData,
                id: `region-${Date.now()}`
            };
            MOCK_REGIONS.push(newRegion);
            _buildHierarchyAndSyncStaff(); // Re-sync after adding an organizational unit
            resolve(newRegion);
        }, 300);
    });
};

export const updateRegion = (id: string, updateData: Partial<Omit<Region, 'id'>>): Promise<Region> => {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            const regionIndex = MOCK_REGIONS.findIndex(r => r.id === id);
            if (regionIndex === -1) {
                return reject(new Error('Region not found.'));
            }
            const oldRegion = MOCK_REGIONS[regionIndex];
            if (updateData.name && updateData.name.toLowerCase() !== oldRegion.name.toLowerCase() &&
                MOCK_REGIONS.some(r => r.name.toLowerCase() === updateData.name?.toLowerCase() && r.id !== id)) {
                return reject(new Error('Region name must be unique.'));
            }
            // Validate zoneId if provided in update
            if (updateData.zoneId && !MOCK_ZONES.some(z => z.id === updateData.zoneId)) {
                return reject(new Error(`Zone with ID "${updateData.zoneId}" not found.`));
            }

            const updatedRegion = { ...oldRegion, ...updateData };
            MOCK_REGIONS[regionIndex] = updatedRegion;
            _buildHierarchyAndSyncStaff(); // Re-sync after updating an organizational unit
            resolve(updatedRegion);
        }, 300);
    });
};

export const removeRegion = (id: string): Promise<void> => {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            const regionIndex = MOCK_REGIONS.findIndex(r => r.id === id);
            if (regionIndex === -1) {
                return reject(new Error('Region not found.'));
            }
            const regionToRemove = MOCK_REGIONS[regionIndex];

            // Check if any branches are still assigned to this region
            if (MOCK_BRANCHES.some(b => b.region === regionToRemove.name)) {
                return reject(new Error(`Cannot delete region "${regionToRemove.name}" as branches are still assigned to it. Please reassign or delete branches first.`));
            }
            // Check if any districts are still assigned to this region
            if (MOCK_DISTRICTS.some(d => d.regionId === regionToRemove.id)) {
                return reject(new Error(`Cannot delete region "${regionToRemove.name}" as districts are still assigned to it. Please reassign or delete districts first.`));
            }
            // Check if any staff have this region in their primary region or managed branches/zones
            if (MOCK_STAFF.some(s => s.region === regionToRemove.name || s.managedZones?.some(z => MOCK_ZONES.find(mz => mz.name === z)?.id === regionToRemove.zoneId) || s.managedBranches?.some(b => MOCK_BRANCHES.find(mb => mb.branchName === b)?.region === regionToRemove.name))) {
                return reject(new Error(`Cannot delete region "${regionToRemove.name}" as staff or managed units are still associated with it. Please update staff/branch assignments first.`));
            }

            MOCK_REGIONS.splice(regionIndex, 1);
            _buildHierarchyAndSyncStaff(); // Re-sync after removing an organizational unit
            resolve();
        }, 300);
    });
};

// --- District Management Functions ---
export const getDistricts = (): Promise<District[]> => {
    return Promise.resolve([...MOCK_DISTRICTS]);
};

export const addDistrict = (districtData: Omit<District, 'id'>): Promise<District> => {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            if (MOCK_DISTRICTS.some(d => d.name.toLowerCase() === districtData.name.toLowerCase())) {
                return reject(new Error('District name must be unique.'));
            }
            // Validate regionId if provided
            if (districtData.regionId && !MOCK_REGIONS.some(r => r.id === districtData.regionId)) {
                return reject(new Error(`Region with ID "${districtData.regionId}" not found.`));
            }

            const newDistrict: District = {
                ...districtData,
                id: `district-${Date.now()}`
            };
            MOCK_DISTRICTS.push(newDistrict);
            _buildHierarchyAndSyncStaff(); // Re-sync after adding an organizational unit
            resolve(newDistrict);
        }, 300);
    });
};

export const updateDistrict = (id: string, updateData: Partial<Omit<District, 'id'>>): Promise<District> => {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            const districtIndex = MOCK_DISTRICTS.findIndex(d => d.id === id);
            if (districtIndex === -1) {
                return reject(new Error('District not found.'));
            }
            const oldDistrict = MOCK_DISTRICTS[districtIndex];
            if (updateData.name && updateData.name.toLowerCase() !== oldDistrict.name.toLowerCase() &&
                MOCK_DISTRICTS.some(d => d.name.toLowerCase() === updateData.name?.toLowerCase() && d.id !== id)) {
                return reject(new Error('District name must be unique.'));
            }
            // Validate regionId if provided in update
            if (updateData.regionId && !MOCK_REGIONS.some(r => r.id === updateData.regionId)) {
                return reject(new Error(`Region with ID "${updateData.regionId}" not found.`));
            }

            const updatedDistrict = { ...oldDistrict, ...updateData };
            MOCK_DISTRICTS[districtIndex] = updatedDistrict;
            _buildHierarchyAndSyncStaff(); // Re-sync after updating an organizational unit
            resolve(updatedDistrict);
        }, 300);
    });
};

export const removeDistrict = (id: string): Promise<void> => {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            const districtIndex = MOCK_DISTRICTS.findIndex(d => d.id === id);
            if (districtIndex === -1) {
                return reject(new Error('District not found.'));
            }
            const districtToRemove = MOCK_DISTRICTS[districtIndex];

            // Check if any branches are still assigned to this district
            if (MOCK_BRANCHES.some(b => b.districtName === districtToRemove.name)) {
                return reject(new Error(`Cannot delete district "${districtToRemove.name}" as branches are still assigned to it. Please reassign or delete branches first.`));
            }
             // Check if any staff have this district in their primary district or managed units
            if (MOCK_STAFF.some(s => s.districtName === districtToRemove.name || s.managedBranches?.some(b => MOCK_BRANCHES.find(mb => mb.branchName === b)?.districtName === districtToRemove.name))) {
                return reject(new Error(`Cannot delete district "${districtToRemove.name}" as staff or managed units are still associated with it. Please update staff/branch assignments first.`));
            }

            MOCK_DISTRICTS.splice(districtIndex, 1);
            _buildHierarchyAndSyncStaff(); // Re-sync after removing an organizational unit
            resolve();
        }, 300);
    });
};