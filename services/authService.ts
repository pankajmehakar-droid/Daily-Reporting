import { User, Role, StaffMember } from '../types';
// Removed: import { getStaffData } from './dataService';

export let MOCK_PASSWORDS: { [username: string]: string } = {};
let MOCK_USERS: User[] = [];

// New: Define system user IDs for consistent lookup
const ADMIN_USER_ID = 'admin-user-0';
const ZONAL_MANAGER_USER_ID = 'zm-user-0';

// Updated reinitializeAuth to accept staffList as an argument
export const reinitializeAuth = (staffList: StaffMember[]) => {
    // const staffList = getStaffData(); // Removed this line
    const passwords: { [username: string]: string } = {};
    const users: User[] = [];

    // Add the default system admin
    const adminStaffMember = staffList.find(s => s.id === ADMIN_USER_ID);
    if (adminStaffMember) {
        users.push({ 
            id: adminStaffMember.id, 
            username: 'admin', 
            role: 'admin',
            staffName: adminStaffMember.employeeName,
            designation: 'ADMINISTRATOR', // Always display "Administrator" for admin role
            contactNumber: adminStaffMember.contactNumber,
            employeeCode: adminStaffMember.employeeCode,
            districtName: adminStaffMember.districtName,
            managedZones: adminStaffMember.managedZones,
            managedBranches: adminStaffMember.managedBranches,
            subordinates: adminStaffMember.subordinates?.map(s => ({ 
                id: s.id, username: s.employeeCode, role: s.function.toUpperCase().includes('MANAGER') || s.function.toUpperCase().includes('HEAD') || s.function.toUpperCase().includes('TL') ? 'manager' : 'user', staffName: s.employeeName, designation: s.function, contactNumber: s.contactNumber, branchName: s.branchName, employeeCode: s.employeeCode, zone: s.zone, region: s.region, districtName: s.districtName, managedZones: s.managedZones, managedBranches: s.managedBranches, subordinates: [], 
            })) || [], 
        });
        passwords['admin'] = 'admin123';
    }
    
    // Add the default Zonal Manager user
    const zonalManagerStaffMember = staffList.find(s => s.id === ZONAL_MANAGER_USER_ID);
    if (zonalManagerStaffMember) {
        users.push({
            id: zonalManagerStaffMember.id,
            username: 'zm', // Hardcoded username for ZM
            role: 'manager', // ZM is a manager role
            staffName: zonalManagerStaffMember.employeeName,
            designation: zonalManagerStaffMember.function,
            contactNumber: zonalManagerStaffMember.contactNumber,
            branchName: zonalManagerStaffMember.branchName,
            employeeCode: zonalManagerStaffMember.employeeCode,
            zone: zonalManagerStaffMember.zone,
            region: zonalManagerStaffMember.region,
            districtName: zonalManagerStaffMember.districtName,
            managedZones: zonalManagerStaffMember.managedZones,
            managedBranches: zonalManagerStaffMember.managedBranches,
            subordinates: zonalManagerStaffMember.subordinates?.map(s => ({
                id: s.id, username: s.employeeCode, role: s.function.toUpperCase().includes('MANAGER') || s.function.toUpperCase().includes('HEAD') || s.function.toUpperCase().includes('TL') ? 'manager' : 'user', staffName: s.employeeName, designation: s.function, contactNumber: s.contactNumber, branchName: s.branchName, employeeCode: s.employeeCode, zone: s.zone, region: s.region, districtName: s.districtName, managedZones: s.managedZones, managedBranches: s.managedBranches, subordinates: [],
            })) || [],
        });
        passwords['zm'] = 'zm123'; // Hardcoded password for ZM
    }


    // Generate users from staff list (excluding the already handled system users)
    staffList.forEach(staff => {
        if (staff.id === ADMIN_USER_ID || staff.id === ZONAL_MANAGER_USER_ID) return; // Skip if already added

        const username = staff.employeeCode;
        if (!username) return;

        let role: Role = 'user';
        // Updated to check for exact 'MANAGER', 'HEAD', or 'TL' string for manager role assignment
        if (staff.function.toUpperCase().includes('MANAGER') || 
            staff.function.toUpperCase().includes('HEAD') ||
            staff.function.toUpperCase().includes('TL') // Include Team Leaders as managers
        ) { 
            role = 'manager';
        }

        users.push({
            id: staff.id, // Link user to staff member ID
            username: username,
            role: role,
            staffName: staff.employeeName,
            designation: staff.function,
            contactNumber: staff.contactNumber, // Populated from StaffMember
            branchName: staff.branchName,
            employeeCode: staff.employeeCode,
            zone: staff.zone,
            region: staff.region,
            districtName: staff.districtName, // Include districtName
            managedZones: staff.managedZones, // Include managed zones
            managedBranches: staff.managedBranches, // Include managed branches
            // Map StaffMember subordinates to User subordinates
            subordinates: staff.subordinates?.map(s => ({
                id: s.id,
                username: s.employeeCode,
                role: s.function.toUpperCase().includes('MANAGER') || s.function.toUpperCase().includes('HEAD') || s.function.toUpperCase().includes('TL') ? 'manager' : 'user',
                staffName: s.employeeName,
                designation: s.function,
                contactNumber: s.contactNumber,
                branchName: s.branchName,
                employeeCode: s.employeeCode,
                zone: s.zone,
                region: s.region,
                districtName: s.districtName,
                managedZones: s.managedZones,
                managedBranches: s.managedBranches,
                // Do not recursively add subordinates to prevent deep nested objects.
                // If a full hierarchy walk is needed, it should be done dynamically.
                subordinates: [], 
            })),
        });
        passwords[username] = username; // Password is the same as the employee code
    });

    MOCK_USERS = users;
    MOCK_PASSWORDS = passwords;
};

// Removed: reinitializeAuth(); // Removed immediate call

// Mock login function
export const login = (username: string, password: string): Promise<User> => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const user = MOCK_USERS.find(u => u.username === username);
      if (user && MOCK_PASSWORDS[username] === password) {
        resolve(user);
      } else {
        reject(new Error('Invalid Employee Code or password.'));
      }
    }, 500);
  });
};

// Get all users
export const getUsers = (): Promise<User[]> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve([...MOCK_USERS]);
    }, 300);
  });
};

// Note: User mutations are disabled here because user accounts are now derived 
// directly from the staff data managed in the Staff Management page.
// Changes there will automatically reflect here after re-initialization.