import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { User, Role, DESIGNATIONS, StaffMember, Branch, Zone, Region, District, Designation } from '../types'; // Import Zone, Region, District
import { getUsers, reinitializeAuth } from '../services/authService';
import { addStaff, updateStaff, removeStaff, addMultipleStaff, getBranches, removeAllStaff, removeMultipleStaff, getAllStaff, getRecursiveSubordinateEmployeeCodes, getZones, getRegions, getDistricts } from '../services/dataService'; // Corrected import for getRecursiveSubordinateEmployeeCodes, and new org unit getters
import { LoaderIcon, PlusIcon, EditIcon, TrashIcon, AlertTriangleIcon, XIcon, CheckCircleIcon, FileDownIcon, UploadIcon, SearchIcon, EyeIcon } from '../components/icons';
import UserDetailModal from '../components/UserDetailModal'; // New Import

// Declare XLSX from the script tag in index.html
declare const XLSX: any;

const emptyFormData: Omit<StaffMember, 'id' | 'subordinates'> = { // Exclude subordinates as it's computed
    zone: 'N/A', // Updated default
    region: 'N/A', // Updated default
    branchName: '',
    districtName: 'N/A', // Default districtName to 'N/A'
    employeeName: '',
    employeeCode: '',
    function: 'BRANCH OFFICER', // Changed from 'BO' to 'BRANCH OFFICER'
    contactNumber: 'N/A', // Default contactNumber to 'N/A'
    managedZones: [],
    managedBranches: [],
    reportsToEmployeeCode: undefined, // New field
};

// Admin user ID (ensure this matches the ID in authService.ts)
const ADMIN_USER_ID = 'admin-user-0';


// Form validation function
const validateForm = (
    formData: Omit<StaffMember, 'id' | 'subordinates'>,
    manualBranchName: string,
    isOtherBranch: boolean,
    manualDistrictName: string,
    isDistrictManualEditable: boolean,
    allStaff: StaffMember[],
    editingUser: User | null, // Pass editing user for unique checks, and current user id.
    currentUserRole: User['role'],
    allZones: Zone[], // For validation
    allRegions: Region[], // For validation
    allDistricts: District[], // For validation
): Record<string, string> => {
    const errors: Record<string, string> = {};

    // Staff Details
    if (!formData.employeeName.trim()) {
        errors.employeeName = 'Staff Name is required.';
    } else if (formData.employeeName.trim().length < 3) {
        errors.employeeName = 'Staff Name must be at least 3 characters.';
    }

    if (!formData.employeeCode.trim()) {
        errors.employeeCode = 'Employee Code is required.';
    } else if (formData.employeeCode.trim().length < 3) {
        errors.employeeCode = 'Employee Code must be at least 3 characters.';
    } else if (!editingUser || editingUser.employeeCode !== formData.employeeCode) {
        // Check uniqueness only if adding or if code is changing
        if (allStaff.some(s => s.employeeCode === formData.employeeCode)) {
            errors.employeeCode = 'Employee Code must be unique.';
        }
    }

    if (!formData.contactNumber.trim()) {
        errors.contactNumber = 'Contact Number is required.';
    } else if (!/^\d{10}$/.test(formData.contactNumber)) {
        errors.contactNumber = 'Please enter a valid 10-digit mobile number.';
    }

    // Organizational Assignment
    const finalBranchName = isOtherBranch ? manualBranchName.trim() : formData.branchName.trim();
    if (!finalBranchName || finalBranchName === 'N/A') { // Added 'N/A' check
        errors.branchName = 'Branch Name is required.';
    }

    const finalDistrictName = isDistrictManualEditable ? manualDistrictName.trim() : formData.districtName.trim();
    if (!finalDistrictName || finalDistrictName === 'N/A') { // Added 'N/A' check
        errors.districtName = 'District Name is required.';
    } else if (!isDistrictManualEditable && !allDistricts.some(d => d.name === finalDistrictName)) {
        errors.districtName = 'Selected District does not exist in master data.';
    } else if (isDistrictManualEditable && !manualDistrictName.trim()) {
         errors.districtName = 'Custom District name is required.';
    }


    // RBAC: Managers cannot change Zone/Region/District/Primary Branch
    if (currentUserRole === 'manager') {
        // These fields are expected to be derived or pre-filled for managers, so validation
        // for *changes* (if the UI allowed it) would be handled here.
        // For now, they are read-only, so validation simply checks if they have a value.
        if (!formData.zone.trim() || formData.zone === 'N/A') errors.zone = 'Zone is required.';
        if (!formData.region.trim() || formData.region === 'N/A') errors.region = 'Region is required.';
    } else { // Admin can change these freely IF NOT DERIVED FROM STANDARD BRANCH
        // Only validate if not 'Other' branch OR if it's explicitly editable (for custom district)
        if (!isOtherBranch || (isOtherBranch && isDistrictManualEditable)) {
            if (!formData.zone.trim() || formData.zone === 'N/A') {
                errors.zone = 'Zone is required.';
            } else if (!allZones.some(z => z.name === formData.zone)) {
                errors.zone = 'Selected Zone does not exist in master data.';
            }

            if (!formData.region.trim() || formData.region === 'N/A') {
                errors.region = 'Region is required.';
            } else if (!allRegions.some(r => r.name === formData.region)) {
                errors.region = 'Selected Region does not exist in master data.';
            }
        }
    }


    // Managerial Assignments
    if (formData.function.toUpperCase() === 'ZONAL MANAGER' && (!formData.managedZones || formData.managedZones.length === 0)) {
        errors.managedZones = 'Zonal Manager must have at least one zone assigned.';
    }
    if ((formData.function.toUpperCase() === 'DISTRICT HEAD' || formData.function.toUpperCase() === 'ASSISTANT DISTRICT HEAD' || formData.function.toUpperCase().startsWith('TL-')) && (!formData.managedBranches || formData.managedBranches.length === 0)) {
        errors.managedBranches = 'District Head / Assistant District Head / Team Leader must have at least one branch assigned.';
    }

    // Reports To (Self-reporting and Circular check)
    // Only validate if reportsToEmployeeCode is actually set (not undefined, which represents "No Manager")
    if (formData.reportsToEmployeeCode) { 
        if (editingUser && formData.reportsToEmployeeCode === editingUser.employeeCode) {
            errors.reportsToEmployeeCode = 'A staff member cannot report to themselves.';
        } else if (editingUser) {
            // Find the staff member being edited in the allStaff list to get its full structure
            const currentStaffNode = allStaff.find(s => s.id === editingUser.id);
            const managerToReportTo = allStaff.find(s => s.employeeCode === formData.reportsToEmployeeCode);

            if (currentStaffNode && managerToReportTo) {
                // Check if the current staff member is already a subordinate of the managerToReportTo
                // This is a simplified circular check: prevent reporting to direct/indirect subordinates.
                const managerSubordinates = getRecursiveSubordinateEmployeeCodes(currentStaffNode, allStaff);
                if (managerSubordinates.has(managerToReportTo.employeeCode)) {
                    errors.reportsToEmployeeCode = 'Cannot report to a subordinate in the hierarchy.';
                }
            }
        }
    }


    return errors;
};


export const UserManagementPage: React.FC<{ currentUser: User }> = ({ currentUser }) => {
    const [users, setUsers] = useState<User[]>([]);
    const [allBranches, setAllBranches] = useState<Branch[]>([]); // Store full branch objects
    const [allPossibleManagers, setAllPossibleManagers] = useState<StaffMember[]>([]); // For 'Reports To' dropdown (full staff list)
    const [allRawStaff, setAllRawStaff] = useState<StaffMember[]>([]); // Full staff list, for validation and hierarchy
    const [allZones, setAllZones] = useState<Zone[]>([]); // New state
    const [allRegions, setAllRegions] = useState<Region[]>([]); // New state
    const [allDistricts, setAllDistricts] = useState<District[]>([]); // New state

    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // Modals and Forms
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [formData, setFormData] = useState<Omit<StaffMember, 'id' | 'subordinates'>>(emptyFormData);
    const [userToDelete, setUserToDelete] = useState<User | null>(null);
    const [isDeleteAllModalOpen, setIsDeleteAllModalOpen] = useState(false);
    const [isDeleteSelectedModalOpen, setIsDeleteSelectedModalOpen] = useState<boolean>(false); // New state for multi-delete modal
    const [userToView, setUserToView] = useState<User | null>(null); // New state for user to view
    const [isViewModalOpen, setIsViewModalOpen] = useState(false); // New state for view modal


    // Notifications and Errors
    const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [modalError, setModalError] = useState<string | null>(null);
    const [formErrors, setFormErrors] = useState<Record<string, string>>({}); // New state for granular form errors
    
    const importFileInputRef = React.useRef<HTMLInputElement>(null);

    const isMounted = useRef(false);

    // New state for selected users
    const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
        
    // State for "Other" branch name input
    const [isOtherBranch, setIsOtherBranch] = useState(false);
    const [manualBranchName, setManualBranchName] = useState('');

    // State for "Other" district name input management
    const [isDistrictManualEditable, setIsDistrictManualEditable] = useState(false); // True if "Other" is selected for district and is editable
    const [manualDistrictName, setSearchManualDistrictName] = useState(''); // Renamed to avoid collision with global search.

    // Pagination states
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10); // Default items per page
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedRoleFilter, setSelectedRoleFilter] = useState('all');
    const [selectedDesignationFilter, setSelectedDesignationFilter] = useState('all');

    useEffect(() => {
      isMounted.current = true;
      return () => {
        isMounted.current = false;
      };
    }, []);

    const fetchUsers = useCallback(async () => {
        try {
            setLoading(true);
            setNotification(null);
            let userList = await getUsers();
            const allStaffList = await getAllStaff(); // Get full staff for manager dropdown and hierarchy

            if (!isMounted.current) return;

            setAllRawStaff(allStaffList); // Store full staff list for validation

            // Filter for 'Reports To' dropdown: these are potential managers.
            // Exclude admin from being reported to, and the current user being edited.
            setAllPossibleManagers(allStaffList.filter(s => s.id !== 'admin-user-0' && ( // Exclude admin by ID
                s.function.toUpperCase().includes('MANAGER') || 
                s.function.toUpperCase().includes('HEAD') ||
                s.function.toUpperCase().startsWith('TL-') // Include Team Leaders as managers
            )));

            if (currentUser.role === 'manager') {
                // If the current user is a manager, they should only see staff within their managed scope.
                // This includes themselves, their direct subordinates, and staff in their managed branches/zones.
                const relevantEmployeeCodes = new Set<string>();
                if (currentUser.employeeCode) relevantEmployeeCodes.add(currentUser.employeeCode);

                // Recursively get all subordinate employee codes (direct and indirect)
                const collectSubordinates = (userNode: User) => {
                    allStaffList.filter(s => s.reportsToEmployeeCode === userNode.employeeCode).forEach(sub => {
                        if (sub.employeeCode) relevantEmployeeCodes.add(sub.employeeCode);
                        const subAsUser: User = { // Create a temporary User object for recursion
                            id: sub.id, username: sub.employeeCode, role: 'user', staffName: sub.employeeName, designation: sub.function, contactNumber: sub.contactNumber, employeeCode: sub.employeeCode, subordinates: [],
                            reportsToEmployeeCode: sub.reportsToEmployeeCode,
                        };
                        collectSubordinates(subAsUser);
                    });
                };
                collectSubordinates(currentUser);

                // Filter by managed branches/zones
                const relevantBranchNames = new Set<string>();
                if (currentUser.branchName) relevantBranchNames.add(currentUser.branchName);
                if (currentUser.managedBranches) currentUser.managedBranches.forEach(b => relevantBranchNames.add(b));
                if (currentUser.managedZones) {
                    const allBranchesData = await getBranches(); // Ensure latest branches
                    allBranchesData.filter(b => currentUser.managedZones!.includes(b.zone)).forEach(b => relevantBranchNames.add(b.branchName));
                }

                userList = userList.filter(u => 
                    (u.employeeCode && relevantEmployeeCodes.has(u.employeeCode)) ||
                    (u.branchName && relevantBranchNames.has(u.branchName))
                );
            }
            setUsers(userList);
            setSelectedUserIds([]); // Clear selection on data refresh
        } catch (err) {
            if (isMounted.current) {
                setNotification({ message: err instanceof Error ? err.message : 'Failed to fetch users.', type: 'error' });
            }
        } finally {
            if (isMounted.current) {
                setLoading(false);
            }
        }
    }, [currentUser, isMounted]);

    const fetchInitialData = useCallback(async () => {
        try {
            await fetchUsers(); // This already handles isMounted internally
            const [branchList, zones, regions, districts] = await Promise.all([
                getBranches(),
                getZones(),
                getRegions(),
                getDistricts(),
            ]);
            if (isMounted.current) {
                setAllBranches(branchList);
                setAllZones(zones);
                setAllRegions(regions);
                setAllDistricts(districts);
            }
        } catch (err) {
            if (isMounted.current) {
                setNotification({ message: err instanceof Error ? err.message : 'Failed to fetch initial data (branches or organizational units).', type: 'error' });
            }
        }
    }, [fetchUsers, isMounted]);

    useEffect(() => {
        fetchInitialData();
    }, [fetchInitialData]);
    
    const getBranchNames = useMemo(() => {
        return allBranches.map(b => b.branchName);
    }, [allBranches]);

    const openModal = (user: User | null = null) => {
        setModalError(null);
        setFormErrors({}); // Clear form errors on modal open

        let initialFormData: Omit<StaffMember, 'id' | 'subordinates'>;
        let initialIsOtherBranch = false;
        let initialManualBranchName = '';
        let initialIsDistrictManualEditable = false;
        let initialManualDistrictName = '';

        if (user) { // Editing existing user
            setEditingUser(user);
            initialFormData = {
                zone: user.zone || 'N/A',
                region: user.region || 'N/A',
                branchName: user.branchName || '',
                districtName: user.districtName || 'N/A',
                employeeName: user.staffName,
                employeeCode: user.employeeCode || '',
                function: user.designation,
                contactNumber: user.contactNumber || '9XXXXXXXXX',
                managedZones: user.managedZones || [],
                managedBranches: user.managedBranches || [],
                reportsToEmployeeCode: user.reportsToEmployeeCode || undefined,
            };

            // Handle 'Other' for Branch Name when editing
            if (user.branchName && user.branchName !== 'N/A' && !getBranchNames.includes(user.branchName)) {
                initialIsOtherBranch = true;
                initialManualBranchName = user.branchName;
                initialFormData.branchName = 'Other'; // Set dropdown to 'Other'
            }

            // Handle 'Other' for District Name when editing
            if (user.districtName && user.districtName !== 'N/A' && !allDistricts.some(d => d.name === user.districtName)) {
                initialIsDistrictManualEditable = true;
                initialManualDistrictName = user.districtName;
                initialFormData.districtName = 'Other'; // Set dropdown to 'Other'
            }

        } else { // Adding new user
            setEditingUser(null);
            
            // Determine sensible defaults for new user
            let defaultBranchName = 'N/A';
            let defaultZone = 'N/A';
            let defaultRegion = 'N/A';
            let defaultDistrict = 'N/A';

            if (allBranches.length > 0) {
                // If there are branches, pick the first one as default for dropdown, but keep 'N/A' initially for calculation
                defaultBranchName = allBranches[0].branchName;
                const selectedBranch = allBranches[0];
                defaultZone = selectedBranch.zone;
                defaultRegion = selectedBranch.region;
                defaultDistrict = selectedBranch.districtName;
            } else if (allZones.length > 0) {
                defaultZone = allZones[0].name;
                const selectedZone = allZones[0];
                const defaultRegionForZone = allRegions.find(r => r.zoneId === selectedZone.id);
                if (defaultRegionForZone) {
                    defaultRegion = defaultRegionForZone.name;
                    const defaultDistrictForRegion = allDistricts.find(d => d.regionId === defaultRegionForZone.id);
                    if (defaultDistrictForRegion) defaultDistrict = defaultDistrictForRegion.name;
                }
            }


            initialFormData = { ...emptyFormData };
            if (currentUser.role === 'manager') {
                // Manager adds staff under their own branch by default (read-only for them)
                initialFormData = {
                    ...emptyFormData,
                    branchName: currentUser.branchName && currentUser.branchName !== 'N/A' ? currentUser.branchName : defaultBranchName,
                    districtName: currentUser.districtName && currentUser.districtName !== 'N/A' ? currentUser.districtName : defaultDistrict,
                    zone: currentUser.zone && currentUser.zone !== 'N/A' ? currentUser.zone : defaultZone,
                    region: currentUser.region && currentUser.region !== 'N/A' ? currentUser.region : defaultRegion,
                    contactNumber: '9XXXXXXXXX', // Placeholder for new staff
                    reportsToEmployeeCode: currentUser.employeeCode, // Default to reporting to current manager
                };
            } else { // Admin adding user
                initialFormData = { 
                    ...emptyFormData, 
                    branchName: defaultBranchName,
                    districtName: defaultDistrict,
                    zone: defaultZone,
                    region: defaultRegion,
                    contactNumber: '9XXXXXXXXX', // Placeholder for new staff
                };
            }
        }
        setFormData(initialFormData);
        setIsOtherBranch(initialIsOtherBranch);
        setManualBranchName(initialManualBranchName);
        setIsDistrictManualEditable(initialIsDistrictManualEditable);
        setSearchManualDistrictName(initialManualDistrictName);

        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingUser(null);
        setFormData(emptyFormData);
        setModalError(null);
        setFormErrors({});
        setIsOtherBranch(false);
        setManualBranchName('');
        setIsDistrictManualEditable(false);
        setSearchManualDistrictName('');
    };

    // New: Functions to handle view modal
    const openViewModal = (user: User) => {
        setUserToView(user);
        setIsViewModalOpen(true);
    };

    const closeViewModal = () => {
        setUserToView(null);
        setIsViewModalOpen(false);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        let { name, value } = e.target;
        
        // Clear error for this field
        setFormErrors(prev => {
            const newErrors = { ...prev };
            delete newErrors[name];
            return newErrors;
        });

        if (name === 'employeeName') {
            value = value.toUpperCase();
        } else if (name === 'manualBranchName') {
            setManualBranchName(value.toUpperCase());
            return;
        } else if (name === 'manualDistrictName') {
            setSearchManualDistrictName(value.toUpperCase());
            return;
        }

        if (name === 'branchName') {
            const newIsOtherBranch = value === 'Other';
            setIsOtherBranch(newIsOtherBranch);
            
            let newZone = 'N/A';
            let newRegion = 'N/A';
            let newDistrictName = 'N/A';

            if (!newIsOtherBranch) {
                const selectedBranch = allBranches.find(b => b.branchName === value);
                newZone = selectedBranch?.zone || 'N/A';
                newRegion = selectedBranch?.region || 'N/A';
                newDistrictName = selectedBranch?.districtName || 'N/A';
                // When a standard branch is selected, reset district to its derived value and disable manual input
                setIsDistrictManualEditable(false);
                setSearchManualDistrictName('');
            } else { // If 'Other' branch is selected
                // Set default for district, zone, region from first available master data, or 'N/A'
                newDistrictName = allDistricts[0]?.name || 'N/A';
                newZone = allZones[0]?.name || 'N/A';
                newRegion = allRegions.find(r => r.zoneId === allZones[0]?.id)?.name || 'N/A';
            }
            
            setFormData(prev => ({
                ...prev,
                branchName: value,
                zone: newZone, 
                region: newRegion, 
                districtName: newDistrictName,
            }));
            
        } else if (name === 'districtName') { // This is for the dropdown select for District Name
            const newIsDistrictManualEditable = value === 'Other';
            setIsDistrictManualEditable(newIsDistrictManualEditable);
            setFormData(prev => ({ ...prev, districtName: value }));
        } else if (name === 'zone') {
            setFormData(prev => ({ ...prev, [name]: value }));
            const selectedZoneId = allZones.find(z => z.name === value)?.id;
            const defaultRegion = allRegions.find(r => r.zoneId === selectedZoneId);
            setFormData(prev => ({
                ...prev,
                region: defaultRegion?.name || 'N/A',
                districtName: (allDistricts.find(d => d.regionId === defaultRegion?.id)?.name || 'N/A'),
            }));
        } else if (name === 'region') {
            setFormData(prev => ({ ...prev, [name]: value }));
            const selectedRegionId = allRegions.find(r => r.name === value)?.id;
            setFormData(prev => ({
                ...prev,
                districtName: (allDistricts.find(d => d.regionId === selectedRegionId)?.name || 'N/A'),
            }));
        }
        else if (name === 'function') {
            // When function changes, clear managed units if new function doesn't support them
            const newFunction = value as Designation;
            const updatedFormData = { ...formData, [name]: newFunction };

            if (newFunction.toUpperCase() !== 'ZONAL MANAGER') {
                updatedFormData.managedZones = [];
            }
            if (!['DISTRICT HEAD', 'ASSISTANT DISTRICT HEAD'].includes(newFunction.toUpperCase()) && !newFunction.toUpperCase().startsWith('TL-')) { 
                updatedFormData.managedBranches = [];
            }
            setFormData(updatedFormData);
            return;
        } else if (name === 'reportsToEmployeeCode') {
            // FIX: Set to undefined if value is empty string, otherwise use the value.
            setFormData(prev => ({ ...prev, reportsToEmployeeCode: value === '' ? undefined : value }));
            return;
        }
        setFormData(prev => ({ ...prev, [name]: value }));
    };
    
    // Multi-select handlers for managed units
    const handleMultiSelectChange = (e: React.ChangeEvent<HTMLSelectElement>, field: 'managedZones' | 'managedBranches') => {
        const options = Array.from(e.target.selectedOptions).map(option => (option as HTMLOptionElement).value);
        setFormData(prev => ({ ...prev, [field]: options }));
        // Clear error for this field
        setFormErrors(prev => {
            const newErrors = { ...prev };
            delete newErrors[field];
            return newErrors;
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setModalError(null);
        setNotification(null);

        const finalBranchName = isOtherBranch ? manualBranchName.trim() : formData.branchName;
        const finalDistrictName = isDistrictManualEditable ? manualDistrictName.trim() : formData.districtName;

        const validationErrors = validateForm(
            { ...formData, branchName: finalBranchName, districtName: finalDistrictName },
            manualBranchName, isOtherBranch, finalDistrictName, isDistrictManualEditable,
            allRawStaff, // Pass full staff list for uniqueness and hierarchy checks
            editingUser,
            currentUser.role,
            allZones, allRegions, allDistricts
        );

        if (Object.keys(validationErrors).length > 0) {
            setFormErrors(validationErrors);
            setIsSubmitting(false);
            return;
        }


        const payload: Omit<StaffMember, 'id' | 'subordinates'> = { 
            ...formData, 
            branchName: finalBranchName,
            districtName: finalDistrictName,
            // Ensure these are explicitly included for submission
            managedZones: formData.managedZones || [],
            managedBranches: formData.managedBranches || [],
            reportsToEmployeeCode: formData.reportsToEmployeeCode, // Correctly sends undefined or value
        };
        
        try {
            if (editingUser) {
                await updateStaff(editingUser.id, payload);
                if (!isMounted.current) return;
                setNotification({ message: `User "${payload.employeeName}" updated successfully.`, type: 'success' });
            } else {
                await addStaff(payload);
                if (!isMounted.current) return;
                setNotification({ message: `User "${payload.employeeName}" added successfully.`, type: 'success' });
            }
            if (isMounted.current) {
                closeModal();
                fetchUsers(); // Re-fetch users, which also reinitializes auth
            }
        } catch (err) {
            if (isMounted.current) {
                setModalError(err instanceof Error ? err.message : 'An unexpected error occurred.');
            }
        } finally {
            if (isMounted.current) {
                setIsSubmitting(false);
            }
        }
    };
    
    const handleDelete = async () => {
        if (!userToDelete) return;
        
        setIsSubmitting(true);
        setNotification(null);
        
        try {
            await removeStaff(userToDelete.id);
            if (!isMounted.current) return;
            setNotification({ message: `User "${userToDelete.staffName}" has been deleted.`, type: 'success' });
            fetchUsers(); // Re-fetch users, which also reinitializes auth
        } catch(err) {
            if (isMounted.current) {
                setNotification({ message: err instanceof Error ? err.message : 'Failed to delete user.', type: 'error' });
            }
        } finally {
            if (isMounted.current) {
                setIsSubmitting(false);
                setUserToDelete(null);
            }
        }
    }
    
    const handleDeleteAllUsers = async () => {
        setIsSubmitting(true);
        setNotification(null);
        try {
            await removeAllStaff(ADMIN_USER_ID);
            if (!isMounted.current) return;
            setNotification({ message: 'All users (except admin) have been deleted.', type: 'success' });
            fetchUsers(); // Re-fetch users, which also reinitializes auth
        } catch (err) {
            if (isMounted.current) {
                setNotification({ message: err instanceof Error ? err.message : 'Failed to delete all users.', type: 'error' });
            }
        } finally {
            if (isMounted.current) {
                setIsSubmitting(false);
                setIsDeleteAllModalOpen(false);
            }
        }
    };
    
    const handleExport = () => {
        const dataToExport = users.map(({ staffName, employeeCode, designation, branchName, districtName, zone, region, contactNumber, managedZones, managedBranches, reportsToEmployeeCode, subordinates }) => ({
            'Staff Name': staffName,
            'Employee Code': employeeCode,
            'Designation': designation,
            'Branch Name': branchName,
            'District Name': districtName, // Export districtName
            'Zone': zone,
            'Region': region,
            'Contact Number': contactNumber, // Export contactNumber
            'Managed Zones': managedZones?.join(', ') || '',
            'Managed Branches': managedBranches?.join(', ') || '',
            'Reports To Employee Code': reportsToEmployeeCode || '',
            'Subordinates Count': subordinates?.length || 0, // Export count, full list would be complex
        }));
        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Users");
        XLSX.writeFile(workbook, "user_export.xlsx");
    };

    const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setLoading(true);
        setNotification(null);
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = e.target?.result;
                const workbook = XLSX.read(data, { type: 'array' });
                const json: any[] = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
                
                if (json.length === 0) throw new Error("No data found in the uploaded file.");

                // FIX: Ensure contactNumber, districtName, managedZones, managedBranches, reportsToEmployeeCode are included when importing staff
                const staffToImport = json.map((row, index) => {
                    const rowNumber = index + 2; // +1 for header, +1 for 0-indexed array
                    const employeeName = String(row['Staff Name'] || '').trim().toUpperCase(); // Import as uppercase
                    const employeeCode = String(row['Employee Code'] || '').trim();
                    let designationString = String(row['Designation'] || 'BRANCH OFFICER').trim().toUpperCase(); // Convert to uppercase for consistent validation
                    
                    // Validate designation against DESIGNATIONS array
                    if (!DESIGNATIONS.includes(designationString as Designation)) { // FIX: Cast as Designation here
                        console.warn(`Invalid designation "${designationString}" for row ${rowNumber}. Defaulting to 'BRANCH OFFICER'.`);
                        designationString = 'BRANCH OFFICER';
                    }

                    if (!employeeName) {
                        throw new Error(`Missing 'Staff Name' for row ${rowNumber}.`);
                    }
                    if (!employeeCode) {
                        throw new Error(`Missing 'Employee Code' for row ${rowNumber}.`);
                    }
                    
                    // Validate location data during import
                    const importZone = String(row['Zone'] || 'N/A').trim();
                    const importRegion = String(row['Region'] || 'N/A').trim();
                    const importDistrict = String(row['District Name'] || 'N/A').trim();

                    if (!allZones.some(z => z.name === importZone) && importZone !== 'N/A') {
                        throw new Error(`Invalid Zone "${importZone}" for row ${rowNumber}. Zone not found in master data.`);
                    }
                    if (!allRegions.some(r => r.name === importRegion) && importRegion !== 'N/A') {
                        throw new Error(`Invalid Region "${importRegion}" for row ${rowNumber}. Region not found in master data.`);
                    }
                    if (!allDistricts.some(d => d.name === importDistrict) && importDistrict !== 'N/A') {
                        throw new Error(`Invalid District "${importDistrict}" for row ${rowNumber}. District not found in master data.`);
                    }


                    const managedZonesRaw = String(row['Managed Zones'] || '').trim();
                    const managedBranchesRaw = String(row['Managed Branches'] || '').trim();
                    const reportsToEmployeeCodeRaw = String(row['Reports To Employee Code'] || '').trim();

                    return {
                        employeeName: employeeName,
                        employeeCode: employeeCode,
                        function: designationString as Designation, // FIX: Explicitly cast to Designation
                        branchName: String(row['Branch Name'] || '').trim(),
                        districtName: importDistrict, 
                        zone: importZone,
                        region: importRegion,
                        contactNumber: String(row['Contact Number'] || 'N/A').trim(), 
                        managedZones: managedZonesRaw ? managedZonesRaw.split(',').map((s: string) => s.trim()) : [],
                        managedBranches: managedBranchesRaw ? managedBranchesRaw.split(',').map((s: string) => s.trim()) : [],
                        reportsToEmployeeCode: reportsToEmployeeCodeRaw || undefined,
                    };
                }).filter(s => s.employeeName && s.employeeCode); // This filter might now be redundant if errors are thrown for missing fields

                if (staffToImport.length === 0) throw new Error("No valid user data found in the file after processing.");


                const { added, skipped } = await addMultipleStaff(staffToImport);
                if (!isMounted.current) return;
                setNotification({ message: `Import complete. Added: ${added} new users. Skipped: ${skipped} duplicates.`, type: 'success'});
                fetchUsers(); // Re-fetch users, which also reinitializes auth
            } catch (err: any) { // Explicitly type err as any to access message property
                if (isMounted.current) {
                    setNotification({ message: err.message || 'Failed to process file.', type: 'error' });
                }
            } finally {
                if (isMounted.current) {
                    setLoading(false);
                }
            }
        };
        reader.onerror = () => { 
            if (isMounted.current) {
                setLoading(false); 
                setNotification({ message: 'Failed to read file.', type: 'error' }); 
            }
        };
        reader.readAsArrayBuffer(file);
        event.target.value = '';
    };

    // Filtered staff based on search term (before pagination)
    const filteredStaff = useMemo(() => {
        setCurrentPage(1); // Reset page to 1 when filters change
        
        let currentFilteredUsers = users;

        // Apply role filter
        if (selectedRoleFilter !== 'all') {
            currentFilteredUsers = currentFilteredUsers.filter(user => {
                const isManagerRole = user.designation.toUpperCase().includes('MANAGER') ||
                                      user.designation.toUpperCase().includes('HEAD') ||
                                      user.designation.toUpperCase().includes('TL');
                if (selectedRoleFilter === 'manager') {
                    return isManagerRole;
                }
                // if selectedRoleFilter === 'user'
                return !isManagerRole;
            });
        }

        // Apply designation filter
        if (selectedDesignationFilter !== 'all') {
            currentFilteredUsers = currentFilteredUsers.filter(user => user.designation === selectedDesignationFilter);
        }
        
        // Apply search term filter
        if (searchTerm.trim()) {
            const lowercasedTerm = searchTerm.toLowerCase();
            currentFilteredUsers = currentFilteredUsers.filter(user =>
                Object.values(user).some(value => {
                    if (Array.isArray(value)) {
                        return value.some(item => String(item).toLowerCase().includes(lowercasedTerm));
                    }
                    return String(value).toLowerCase().includes(lowercasedTerm)
                })
            );
        }

        return currentFilteredUsers;
    }, [users, searchTerm, selectedRoleFilter, selectedDesignationFilter]);

    // Pagination calculations
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = filteredStaff.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(filteredStaff.length / itemsPerPage);

    // Derived flags for disabled/read-only logic in the modal form
    // Location fields (Zone, Region, District) are derived/disabled if it's a manager's view
    // OR if an admin has selected a specific named branch (not 'Other').
    const isLocationFieldsDerivedAndDisabled = useMemo(() => {
        return currentUser.role === 'manager' || (formData.branchName !== 'Other' && formData.branchName !== 'N/A' && !!formData.branchName);
    }, [currentUser.role, formData.branchName]);

    // New multi-select handlers
    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            // Select all filtered users, excluding the admin user
            const allSelectableUserIds = filteredStaff.filter(user => user.id !== ADMIN_USER_ID).map(user => user.id);
            setSelectedUserIds(allSelectableUserIds);
        } else {
            setSelectedUserIds([]);
        }
    };

    const handleSelectUser = (userId: string) => {
        setSelectedUserIds(prev =>
            prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
        );
    };

    const confirmDeleteSelected = async () => {
        setIsSubmitting(true);
        setNotification(null);
        setIsDeleteSelectedModalOpen(false);

        const deletableUserIds = selectedUserIds.filter(id => id !== ADMIN_USER_ID);

        try {
            if (deletableUserIds.length > 0) {
                await removeMultipleStaff(deletableUserIds);
                if (!isMounted.current) return;
                setNotification({ message: `Successfully deleted ${deletableUserIds.length} user(s).`, type: 'success' });
                fetchUsers(); // Re-fetch users to update the table, also reinitializes auth
            } else {
                setNotification({ message: 'No deletable users selected.', type: 'error' });
            }
        } catch (err) {
            if (isMounted.current) {
                setNotification({ message: err instanceof Error ? err.message : 'Failed to delete selected users.', type: 'error' });
            }
        } finally {
            if (isMounted.current) {
                setIsSubmitting(false);
                setSelectedUserIds([]); // Clear selection regardless of success/failure
            }
        }
    };

    // Memoized list of selected user names for the confirmation modal
    const selectedUserNames = useMemo(() => {
        return users.filter(user => selectedUserIds.includes(user.id)).map(user => user.staffName);
    }, [users, selectedUserIds]);


    const isSelectAllChecked = selectedUserIds.length > 0 && 
                               filteredStaff.filter(u => u.id !== ADMIN_USER_ID).length === selectedUserIds.length;
    const isSelectAllIndeterminate = selectedUserIds.length > 0 && 
                                     selectedUserIds.length < filteredStaff.filter(u => u.id !== ADMIN_USER_ID).length;

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100">User Management</h2>
                <div className="flex items-center gap-3 flex-wrap">
                    <div className="relative w-full sm:w-auto">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                            <SearchIcon className="w-5 h-5 text-gray-400" />
                        </span>
                        <input
                            type="text"
                            placeholder="Search users..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full sm:w-56 pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                            aria-label="Search staff members"
                        />
                    </div>
                    <div className="w-full sm:w-auto">
                        <label htmlFor="role-filter" className="sr-only">Filter by Role</label>
                        <select
                            id="role-filter"
                            value={selectedRoleFilter}
                            onChange={e => setSelectedRoleFilter(e.target.value)}
                            className="w-full sm:w-48 px-4 py-2 text-sm border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                        >
                            <option value="all">All Roles</option>
                            <option value="manager">Manager</option>
                            <option value="user">User</option>
                        </select>
                    </div>
                    <div className="w-full sm:w-auto">
                        <label htmlFor="designation-filter" className="sr-only">Filter by Designation</label>
                        <select
                            id="designation-filter"
                            value={selectedDesignationFilter}
                            onChange={e => setSelectedDesignationFilter(e.target.value)}
                            className="w-full sm:w-48 px-4 py-2 text-sm border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                        >
                            <option value="all">All Designations</option>
                            {DESIGNATIONS.map(designation => (
                                <option key={designation} value={designation}>{designation}</option>
                            ))}
                        </select>
                    </div>
                    {currentUser.role === 'admin' && ( // RBAC: Only admin can import
                        <button onClick={() => importFileInputRef.current?.click()} className="btn btn-blue"><UploadIcon className="w-5 h-5" />Import</button>
                    )}
                    <input type="file" ref={importFileInputRef} onChange={handleImport} className="hidden" accept=".xlsx, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" />
                    {currentUser.role === 'admin' && ( // RBAC: Only admin can export
                        <button onClick={handleExport} className="btn btn-green"><FileDownIcon className="w-5 h-5" />Export</button>
                    )}
                    {(currentUser.role === 'admin' || currentUser.role === 'manager') && ( // RBAC: Admin or manager can add user
                        <button onClick={() => openModal()} className="btn btn-indigo"><PlusIcon className="w-5 h-5" />Add User</button>
                    )}
                    {selectedUserIds.length > 0 && (currentUser.role === 'admin' || currentUser.role === 'manager') && ( // RBAC: Admin or manager can delete selected
                        <button 
                            onClick={() => setIsDeleteSelectedModalOpen(true)} 
                            className="btn btn-danger"
                            disabled={isSubmitting || selectedUserIds.filter(id => id !== ADMIN_USER_ID).length === 0} // Cannot delete admin
                        >
                            <TrashIcon className="w-5 h-5" />Delete Selected ({selectedUserIds.filter(id => id !== ADMIN_USER_ID).length})
                        </button>
                    )}
                     {currentUser.role === 'admin' && ( // RBAC: Only admin can delete all
                        <button onClick={() => setIsDeleteAllModalOpen(true)} className="btn btn-danger"><TrashIcon className="w-5 h-5" />Delete All</button>
                    )}
                </div>
            </div>

            {notification && (
                 <div className={`p-4 rounded-md flex items-start space-x-3 border-l-4 ${notification.type === 'success' ? 'bg-green-100 dark:bg-green-900/30 border-green-500 text-green-700 dark:text-green-300' : 'bg-red-100 dark:bg-red-900/30 border-red-500 text-red-700 dark:text-red-300'}`} role="alert">
                    {notification.type === 'success' ? <CheckCircleIcon className="w-6 h-6 flex-shrink-0" /> : <AlertTriangleIcon className="w-6 h-6 flex-shrink-0" />}
                    <div><p className="font-bold">{notification.type === 'success' ? 'Success' : 'Error'}</p><p>{notification.message}</p></div>
                </div>
            )}

            {loading ? <div className="flex justify-center items-center py-20"><LoaderIcon className="w-8 h-8 text-indigo-500" /></div> : (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                            <thead className="bg-gray-50 dark:bg-gray-700">
                                <tr>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                        <input
                                            type="checkbox"
                                            className="form-checkbox h-4 w-4 text-indigo-600 transition duration-150 ease-in-out dark:bg-gray-700 dark:border-gray-600"
                                            onChange={handleSelectAll}
                                            checked={isSelectAllChecked}
                                            ref={input => {
                                                if (input) input.indeterminate = isSelectAllIndeterminate;
                                            }}
                                            aria-label="Select all users"
                                        />
                                    </th>
                                    {['Staff Name', 'Employee Code', 'Role', 'Designation', 'Branch', 'District', 'Zone', 'Region', 'Managed Zones', 'Managed Branches', 'Reports To', 'Subordinates', 'Actions'].map(header => (<th key={header} scope="col" className="th-style">{header}</th>))}
                                </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                {currentItems.map(user => {
                                    const reportsToStaff = allPossibleManagers.find(s => s.employeeCode === user.reportsToEmployeeCode);
                                    return (
                                        <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                                <input
                                                    type="checkbox"
                                                    className="form-checkbox h-4 w-4 text-indigo-600 transition duration-150 ease-in-out dark:bg-gray-700 dark:border-gray-600"
                                                    checked={selectedUserIds.includes(user.id)}
                                                    onChange={() => handleSelectUser(user.id)}
                                                    disabled={user.id === ADMIN_USER_ID} // Disable checkbox for admin
                                                    aria-label={`Select user ${user.staffName}`}
                                                />
                                            </td>
                                            <td className="td-style font-medium">{user.staffName}</td>
                                            <td className="td-style">{user.employeeCode}</td>
                                            <td className="td-style"><span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full capitalize ${user.role === 'admin' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : user.role === 'manager' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'}`}>{user.role}</span></td>
                                            <td className="td-style">{user.designation}</td>
                                            <td className="td-style">{user.branchName}</td>
                                            <td className="td-style">{user.districtName}</td> {/* Display District Name */}
                                            <td className="td-style">{user.zone}</td>
                                            <td className="td-style">{user.region}</td>
                                            <td className="td-style">{user.managedZones && user.managedZones.length > 0 ? user.managedZones.join(', ') : 'N/A'}</td>
                                            <td className="td-style">{user.managedBranches && user.managedBranches.length > 0 ? user.managedBranches.join(', ') : 'N/A'}</td>
                                            <td className="td-style">{reportsToStaff ? `${reportsToStaff.employeeName} (${reportsToStaff.employeeCode})` : 'N/A'}</td>
                                            <td className="td-style">{user.subordinates?.length || 0}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                                <div className="flex items-center space-x-3">
                                                    <button onClick={() => openViewModal(user)} className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-300" aria-label={`View ${user.staffName}`}><EyeIcon className="w-5 h-5"/></button>
                                                    {user.id !== ADMIN_USER_ID && (currentUser.role === 'admin' || currentUser.role === 'manager') && ( // RBAC: Admin or manager can edit non-admin users
                                                        <button onClick={() => openModal(user)} className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300" aria-label={`Edit ${user.staffName}`}><EditIcon className="w-5 h-5"/></button>
                                                    )}
                                                    {user.id !== currentUser.id && user.id !== ADMIN_USER_ID && (currentUser.role === 'admin' || currentUser.role === 'manager') && ( // RBAC: Admin or manager can delete non-admin users, not themselves
                                                        <button onClick={() => setUserToDelete(user)} className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300" aria-label={`Delete ${user.staffName}`}><TrashIcon className="w-5 h-5"/></button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    {/* Pagination Controls */}
                    {totalPages > 1 && (
                        <nav
                            className="bg-white dark:bg-gray-800 px-4 py-3 flex items-center justify-between border-t border-gray-200 dark:border-gray-700 sm:px-6"
                            aria-label="Pagination"
                        >
                            <div className="flex-1 flex justify-between sm:hidden">
                                <button
                                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                    disabled={currentPage === 1}
                                    className="relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
                                >
                                    Previous
                                </button>
                                <button
                                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                    disabled={currentPage === totalPages}
                                    className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
                                >
                                    Next
                                </button>
                            </div>
                            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                                <div>
                                    <p className="text-sm text-gray-700 dark:text-gray-300">
                                        Showing <span className="font-medium">{indexOfFirstItem + 1}</span> to{' '}
                                        <span className="font-medium">{Math.min(indexOfLastItem, filteredStaff.length)}</span> of{' '}
                                        <span className="font-medium">{filteredStaff.length}</span> results
                                    </p>
                                </div>
                                <div>
                                    <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                                        <button
                                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                            disabled={currentPage === 1}
                                            className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm font-medium text-gray-500 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600"
                                        >
                                            <span className="sr-only">Previous</span>
                                            <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                                <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                                            </svg>
                                        </button>
                                        {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                                            <button
                                                key={page}
                                                onClick={() => setCurrentPage(page)}
                                                aria-current={currentPage === page ? 'page' : undefined}
                                                className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                                                    currentPage === page
                                                        ? 'z-10 bg-indigo-50 dark:bg-indigo-900 border-indigo-500 text-indigo-600 dark:text-indigo-300'
                                                        : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                                                }`}
                                            >
                                                {page}
                                            </button>
                                        ))}
                                        <button
                                            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                            disabled={currentPage === totalPages}
                                            className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm font-medium text-gray-500 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600"
                                        >
                                            <span className="sr-only">Next</span>
                                            <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                                            </svg>
                                        </button>
                                    </nav>
                                </div>
                            </div>
                        </nav>
                    )}
                </div>
            )}
            
            {isModalOpen && (
                 <div className="fixed inset-0 bg-black bg-opacity-50 z-40 flex items-center justify-center p-4" aria-modal="true" role="dialog">
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
                         <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700"><h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{editingUser ? 'Edit User' : 'Add New User'}</h3><button onClick={closeModal} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"><XIcon className="w-6 h-6"/></button></div>
                         <form onSubmit={handleSubmit} className="overflow-y-auto">
                            <div className="p-6 space-y-6">
                                {modalError && (
                                    <div className="bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-600 text-red-700 dark:text-red-300 p-3 rounded-md flex items-start space-x-2 text-sm" role="alert">
                                        <AlertTriangleIcon className="w-5 h-5 flex-shrink-0" />
                                        <span>{modalError}</span>
                                    </div>
                                )}
                                
                                {/* Staff Details */}
                                <fieldset className="space-y-4">
                                    <legend className="text-base font-semibold text-gray-900 dark:text-gray-100">Staff Details</legend>
                                    <div>
                                        <label htmlFor="employeeName" className="label-style">Staff Name</label>
                                        <input type="text" name="employeeName" id="employeeName" value={formData.employeeName} onChange={handleInputChange} required className={`mt-1 block w-full input-style ${formErrors.employeeName ? 'input-error' : ''}`}/>
                                        {formErrors.employeeName && <p className="error-text">{formErrors.employeeName}</p>}
                                    </div>
                                    <div>
                                        <label htmlFor="employeeCode" className="label-style">Employee Code</label>
                                        <input 
                                            type="text" 
                                            name="employeeCode" 
                                            id="employeeCode" 
                                            value={formData.employeeCode} 
                                            onChange={handleInputChange} 
                                            required 
                                            disabled={editingUser !== null && (currentUser.role !== 'admin' || editingUser.id === ADMIN_USER_ID || editingUser.id === currentUser.id)} // Allow admin to edit others' employee codes
                                            className={`mt-1 block w-full input-style disabled:bg-gray-200 dark:disabled:bg-gray-700 ${formErrors.employeeCode ? 'input-error' : ''}`}
                                        />
                                        {formErrors.employeeCode && <p className="error-text">{formErrors.employeeCode}</p>}
                                    </div>
                                    <div>
                                        <label htmlFor="contactNumber" className="label-style">Contact Number</label>
                                        <input type="tel" name="contactNumber" id="contactNumber" value={formData.contactNumber} onChange={handleInputChange} required maxLength={10} pattern="^\d{10}$" className={`mt-1 block w-full input-style ${formErrors.contactNumber ? 'input-error' : ''}`}/>
                                        {formErrors.contactNumber && <p className="error-text">{formErrors.contactNumber}</p>}
                                    </div>
                                </fieldset>

                                {/* Organizational Assignment */}
                                <fieldset className="space-y-4">
                                    <legend className="text-base font-semibold text-gray-900 dark:text-gray-100">Organizational Assignment</legend>
                                    <div>
                                        <label htmlFor="function" className="label-style">Designation</label>
                                        <select 
                                            name="function" 
                                            id="function" 
                                            value={formData.function} 
                                            onChange={handleInputChange} 
                                            required 
                                            disabled={editingUser?.id === ADMIN_USER_ID} // Admin user's function is not editable
                                            className={`mt-1 block w-full input-style ${formErrors.function ? 'input-error' : ''} ${editingUser?.id === ADMIN_USER_ID ? 'disabled:bg-gray-200 dark:disabled:bg-gray-700 cursor-not-allowed' : ''}`}
                                        >
                                            {DESIGNATIONS.map(d => <option key={d} value={d}>{d}</option>)}
                                        </select>
                                        {formErrors.function && <p className="error-text">{formErrors.function}</p>}
                                    </div>
                                    <div>
                                        <label htmlFor="branchName" className="label-style">Primary Branch Name</label>
                                        <select 
                                            name="branchName" 
                                            id="branchName" 
                                            value={isOtherBranch ? 'Other' : formData.branchName} 
                                            onChange={handleInputChange} 
                                            required 
                                            disabled={currentUser.role === 'manager'} // RBAC: Managers cannot change primary branch
                                            className={`mt-1 block w-full input-style ${formErrors.branchName && !isOtherBranch ? 'input-error' : ''} ${currentUser.role === 'manager' ? 'disabled:bg-gray-200 dark:disabled:bg-gray-700 cursor-not-allowed' : ''}`}
                                        >
                                            <option value="N/A">-- Select Branch --</option> {/* Added N/A option */}
                                            {getBranchNames.map(b => <option key={b} value={b}>{b}</option>)}
                                            {currentUser.role === 'admin' && <option value="Other">Other...</option>}
                                        </select>
                                        {formErrors.branchName && !isOtherBranch && <p className="error-text">{formErrors.branchName}</p>}
                                    </div>
                                    {isOtherBranch && (
                                        <div>
                                            <label htmlFor="manualBranchName" className="label-style">Enter Custom Branch Name</label>
                                            <input type="text" name="manualBranchName" id="manualBranchName" value={manualBranchName} onChange={handleInputChange} required disabled={currentUser.role === 'manager'} className={`mt-1 block w-full input-style ${formErrors.branchName ? 'input-error' : ''} ${currentUser.role === 'manager' ? 'disabled:bg-gray-200 dark:disabled:bg-gray-700 cursor-not-allowed' : ''}`}/>
                                            {formErrors.branchName && <p className="error-text">{formErrors.branchName}</p>}
                                        </div>
                                    )}
                                    <div>
                                        <label htmlFor="districtName" className="label-style">District Name</label>
                                        {isLocationFieldsDerivedAndDisabled ? ( 
                                            <input 
                                                type="text" 
                                                name="districtName" 
                                                id="districtName" 
                                                value={formData.districtName} 
                                                readOnly 
                                                disabled={true} // Always disabled when derived
                                                className={`mt-1 block w-full input-style disabled:bg-gray-200 dark:disabled:bg-gray-700 cursor-not-allowed`}
                                            />
                                        ) : ( // Admin editing 'Other' branch allows full control over district
                                            <select 
                                                name="districtName" 
                                                id="districtName" 
                                                value={isDistrictManualEditable ? 'Other' : formData.districtName}
                                                onChange={handleInputChange} 
                                                required 
                                                className={`mt-1 block w-full input-style ${formErrors.districtName && !isDistrictManualEditable ? 'input-error' : ''}`}
                                            >
                                                <option value="N/A">-- Select District --</option>
                                                {allDistricts.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                                                <option value="Other">Other...</option>
                                            </select>
                                        )}
                                        {formErrors.districtName && !isDistrictManualEditable && <p className="error-text">{formErrors.districtName}</p>}
                                    </div>
                                    {(!isLocationFieldsDerivedAndDisabled && isDistrictManualEditable) ? ( // Only visible for Admin when Branch is 'Other' and District is 'Other'
                                        <div>
                                            <label htmlFor="manualDistrictName" className="label-style">Enter Custom District Name</label>
                                            <input 
                                                type="text" 
                                                name="manualDistrictName" 
                                                id="manualDistrictName" 
                                                value={manualDistrictName} 
                                                onChange={handleInputChange} 
                                                required={isOtherBranch && isDistrictManualEditable} 
                                                className={`mt-1 block w-full input-style ${formErrors.districtName ? 'input-error' : ''}`}
                                            />
                                            {formErrors.districtName && <p className="error-text">{formErrors.districtName}</p>}
                                        </div>
                                    ) : null}
                                    <div>
                                        <label htmlFor="zone" className="label-style">Zone</label>
                                        <select 
                                            name="zone" 
                                            id="zone" 
                                            value={formData.zone} 
                                            onChange={handleInputChange} 
                                            required 
                                            disabled={isLocationFieldsDerivedAndDisabled} // RBAC: Managers cannot change zone
                                            className={`mt-1 block w-full input-style ${formErrors.zone ? 'input-error' : ''} ${isLocationFieldsDerivedAndDisabled ? 'disabled:bg-gray-200 dark:disabled:bg-gray-700 cursor-not-allowed' : ''}`}
                                        >
                                            <option value="N/A">-- Select Zone --</option>
                                            {allZones.map(z => <option key={z.id} value={z.name}>{z.name}</option>)}
                                        </select>
                                        {formErrors.zone && <p className="error-text">{formErrors.zone}</p>}
                                    </div>
                                    <div>
                                        <label htmlFor="region" className="label-style">Region</label>
                                        <select 
                                            name="region" 
                                            id="region" 
                                            value={formData.region} 
                                            onChange={handleInputChange} 
                                            required 
                                            disabled={isLocationFieldsDerivedAndDisabled} // RBAC: Managers cannot change region
                                            className={`mt-1 block w-full input-style ${formErrors.region ? 'input-error' : ''} ${isLocationFieldsDerivedAndDisabled ? 'disabled:bg-gray-200 dark:disabled:bg-gray-700 cursor-not-allowed' : ''}`}
                                        >
                                            <option value="N/A">-- Select Region --</option>
                                            {allRegions.filter(r => allZones.find(z => z.name === formData.zone)?.id === r.zoneId).map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
                                        </select>
                                        {formErrors.region && <p className="error-text">{formErrors.region}</p>}
                                    </div>
                                </fieldset>

                                {/* Reports To */}
                                <fieldset className="space-y-4 border-t border-gray-200 dark:border-gray-700 pt-6">
                                    <legend className="text-base font-semibold text-gray-900 dark:text-gray-100">Reporting Structure</legend>
                                    <div>
                                        <label htmlFor="reportsToEmployeeCode" className="label-style">Reports To (Manager's Employee Code)</label>
                                        <select
                                            name="reportsToEmployeeCode"
                                            id="reportsToEmployeeCode"
                                            value={formData.reportsToEmployeeCode || ""} // Bind to empty string if undefined
                                            onChange={handleInputChange}
                                            className={`mt-1 block w-full input-style ${formErrors.reportsToEmployeeCode ? 'input-error' : ''}`}
                                            disabled={editingUser?.id === ADMIN_USER_ID} // Admin cannot report to anyone
                                        >
                                            <option value="">-- No Manager --</option> {/* Value is empty string */}
                                            {allPossibleManagers
                                                .filter(manager => manager.employeeCode !== formData.employeeCode) // Cannot report to self
                                                .map(manager => (
                                                    <option key={manager.id} value={manager.employeeCode}>
                                                        {manager.employeeName} ({manager.employeeCode}) - {manager.function}
                                                    </option>
                                                ))}
                                        </select>
                                        {formErrors.reportsToEmployeeCode && <p className="error-text">{formErrors.reportsToEmployeeCode}</p>}
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Select the employee code of this staff member's direct manager.</p>
                                    </div>
                                </fieldset>

                                {/* Managed Units for specific roles (editable for Admin, read-only/hidden for others) */}
                                {currentUser.role === 'admin' && ( // RBAC: Only Admin can configure managed units
                                    <>
                                        {(formData.function.toUpperCase() === 'ZONAL MANAGER') && (
                                            <fieldset className="space-y-4 border-t border-gray-200 dark:border-gray-700 pt-6">
                                                <legend className="text-base font-semibold text-gray-900 dark:text-gray-100">Managed Zones (Zonal Manager)</legend>
                                                <div>
                                                    <label htmlFor="managedZones" className="label-style">Select Zones</label>
                                                    <select
                                                        name="managedZones"
                                                        id="managedZones"
                                                        multiple
                                                        value={formData.managedZones}
                                                        onChange={(e) => handleMultiSelectChange(e, 'managedZones')}
                                                        required={formData.function.toUpperCase() === 'ZONAL MANAGER'}
                                                        className={`mt-1 block w-full input-style h-32 ${formErrors.managedZones ? 'input-error' : ''}`} // Increased height for multi-select
                                                        aria-describedby="managed-zones-description"
                                                    >
                                                        {allZones.map(z => <option key={z.id} value={z.name}>{z.name}</option>)}
                                                    </select>
                                                    {formErrors.managedZones && <p className="error-text">{formErrors.managedZones}</p>}
                                                    <p id="managed-zones-description" className="text-xs text-gray-500 dark:text-gray-400 mt-1">Hold Ctrl/Cmd to select multiple zones.</p>
                                                </div>
                                            </fieldset>
                                        )}
                                        {(['DISTRICT HEAD', 'ASSISTANT DISTRICT HEAD'].includes(formData.function.toUpperCase()) || formData.function.toUpperCase().startsWith('TL-')) && (
                                            <fieldset className="space-y-4 border-t border-gray-200 dark:border-gray-700 pt-6">
                                                <legend className="text-base font-semibold text-gray-900 dark:text-gray-100">Managed Branches (District Head / Asst. District Head / Team Leader)</legend>
                                                <div>
                                                    <label htmlFor="managedBranches" className="label-style">Select Branches</label>
                                                    <select
                                                        name="managedBranches"
                                                        id="managedBranches"
                                                        multiple
                                                        value={formData.managedBranches}
                                                        onChange={(e) => handleMultiSelectChange(e, 'managedBranches')}
                                                        required={['DISTRICT HEAD', 'ASSISTANT DISTRICT HEAD'].includes(formData.function.toUpperCase()) || formData.function.toUpperCase().startsWith('TL-')}
                                                        className={`mt-1 block w-full input-style h-32 ${formErrors.managedBranches ? 'input-error' : ''}`}
                                                        aria-describedby="managed-branches-description"
                                                    >
                                                        {allBranches.map(b => <option key={b.id} value={b.branchName}>{b.branchName}</option>)}
                                                    </select>
                                                    {formErrors.managedBranches && <p className="error-text">{formErrors.managedBranches}</p>}
                                                    <p id="managed-branches-description" className="text-xs text-gray-500 dark:text-gray-400 mt-1">Hold Ctrl/Cmd to select multiple branches.</p>
                                                </div>
                                            </fieldset>
                                        )}
                                    </>
                                )}
                            </div>
                            <div className="flex justify-end items-center gap-3 p-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-700">
                                <button type="button" onClick={closeModal} className="btn btn-secondary">Cancel</button>
                                <button type="submit" disabled={isSubmitting || Object.keys(formErrors).length > 0} className="btn btn-indigo flex items-center gap-2">{isSubmitting && <LoaderIcon className="w-4 h-4" />}{isSubmitting ? 'Saving...' : 'Save Changes'}</button>
                            </div>
                        </form>
                    </div>
                 </div>
            )}
            {userToDelete && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" aria-modal="true" role="dialog">
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md">
                        <div className="p-6 text-center">
                            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/30">
                                <AlertTriangleIcon className="h-6 w-6 text-red-600 dark:text-red-400" aria-hidden="true" />
                            </div>
                            <h3 className="mt-5 text-lg font-medium text-gray-900 dark:text-gray-100">Delete User</h3>
                            <div className="mt-2">
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    Are you sure you want to delete <strong>{userToDelete.staffName} ({userToDelete.employeeCode})</strong>? This action cannot be undone.
                                </p>
                            </div>
                        </div>
                        <div className="flex justify-center items-center gap-3 p-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-700">
                            <button type="button" onClick={() => setUserToDelete(null)} className="btn btn-secondary">
                                Cancel
                            </button>
                            <button type="button" onClick={handleDelete} className="btn btn-danger flex items-center gap-2" disabled={isSubmitting}>
                                {isSubmitting && <LoaderIcon className="w-4 h-4" />}Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isDeleteAllModalOpen && (
                 <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" aria-modal="true" role="dialog">
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md">
                        <div className="p-6 text-center"><div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/30"><AlertTriangleIcon className="h-6 w-6 text-red-600 dark:text-red-400" aria-hidden="true" /></div><h3 className="mt-5 text-lg font-medium text-gray-900 dark:text-gray-100">Delete All Users</h3><div className="mt-2"><p className="text-sm text-gray-500 dark:text-gray-400">Are you sure you want to delete <strong>ALL</strong> users (except the admin)? This action is irreversible.</p></div></div>
                        <div className="flex justify-center items-center gap-3 p-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-700"><button type="button" onClick={() => setIsDeleteAllModalOpen(false)} className="btn btn-secondary" disabled={isSubmitting}>Cancel</button><button type="button" onClick={handleDeleteAllUsers} className="btn btn-danger flex items-center gap-2" disabled={isSubmitting}>{isSubmitting && <LoaderIcon className="w-4 h-4" />}Delete All</button></div>
                    </div>
                </div>
            )}

            {isDeleteSelectedModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" aria-modal="true" role="dialog">
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md">
                        <div className="p-6 text-center">
                            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/30">
                                <AlertTriangleIcon className="h-6 w-6 text-red-600 dark:text-red-400" aria-hidden="true" />
                            </div>
                            <h3 className="mt-5 text-lg font-medium text-gray-900 dark:text-gray-100">Delete Selected Users</h3>
                            <div className="mt-2">
                                <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                                    Are you sure you want to delete the following {selectedUserNames.length} user(s)? This action is irreversible.
                                </p>
                                <ul className="list-disc list-inside text-sm text-gray-600 dark:text-gray-300 max-h-24 overflow-y-auto px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-md">
                                    {selectedUserNames.map(name => <li key={name}>{name}</li>)}
                                </ul>
                            </div>
                        </div>
                        <div className="flex justify-center items-center gap-3 p-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-700">
                            <button type="button" onClick={() => setIsDeleteSelectedModalOpen(false)} className="btn btn-secondary">
                                Cancel
                            </button>
                            <button type="button" onClick={confirmDeleteSelected} className="btn btn-danger flex items-center gap-2" disabled={isSubmitting}>
                                {isSubmitting && <LoaderIcon className="w-4 h-4" />}Delete Selected
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {userToView && (
                <UserDetailModal user={userToView} onClose={closeViewModal} allStaff={allRawStaff} />
            )}
        </div>
    );
};