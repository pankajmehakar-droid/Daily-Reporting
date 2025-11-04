import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { StaffMember, User, Branch, DESIGNATIONS, ZONES, REGIONS, DISTRICT_NAMES, Designation } from '../types';
import { getAllStaff, getBranches, addStaff, updateStaff, removeStaff, getStaffByBranch, getRecursiveSubordinateInfo, addMultipleStaff } from '../services/dataService';
import { reinitializeAuth } from '../services/authService';
// FIX: Added SearchIcon to the import list.
import { LoaderIcon, AlertTriangleIcon, EditIcon, XIcon, PlusIcon, TrashIcon, UploadIcon, CheckCircleIcon, FileDownIcon, SearchIcon } from '../components/icons';

// Declare XLSX from the script tag in index.html
declare const XLSX: any;

// FIX: Added contactNumber to emptyFormData to match StaffMember interface
const emptyFormData: Omit<StaffMember, 'id' | 'subordinates'> = { // Exclude subordinates from form data
    zone: 'Zone-1',
    region: 'Region-1',
    branchName: '',
    districtName: 'N/A', // Added districtName with default
    employeeName: '',
    employeeCode: '',
    function: 'BRANCH OFFICER', // Changed from 'BO' to 'BRANCH OFFICER'
    contactNumber: 'N/A', // Added missing contactNumber with default
    managedZones: [],
    managedBranches: [],
    reportsToEmployeeCode: undefined, // New: reportsToEmployeeCode field
};

// FIX: Update StaffWithPending type to include pendingFunction as Designation
type StaffWithPending = StaffMember & { pendingBranchName?: string; pendingFunction?: Designation; };

// Admin user ID (ensure this matches the ID in authService.ts)
const ADMIN_USER_ID = 'admin-user-0';

// Form validation function for StaffManagementPage
const validateForm = (
    formData: Omit<StaffMember, 'id' | 'subordinates'>,
    allStaffList: StaffMember[], // Full list of staff for uniqueness and hierarchy checks
    editingStaff: StaffMember | null, // The staff member being edited
    currentUserRole: User['role'], // Added currentUserRole for RBAC
    allBranches: Branch[], // Added to validate branchName
): Record<string, string> => {
    const errors: Record<string, string> = {};

    // Staff Details
    if (!formData.employeeName.trim()) {
        errors.employeeName = 'Employee Name is required.';
    } else if (formData.employeeName.trim().length < 3) {
        errors.employeeName = 'Employee Name must be at least 3 characters.';
    }

    if (!formData.employeeCode.trim()) {
        errors.employeeCode = 'Employee Code is required.';
    } else if (formData.employeeCode.trim().length < 3) {
        errors.employeeCode = 'Employee Code must be at least 3 characters.';
    } else if (!editingStaff || editingStaff.employeeCode !== formData.employeeCode) {
        // Check uniqueness only if adding or if code is changing
        if (allStaffList.some(s => s.employeeCode === formData.employeeCode)) {
            errors.employeeCode = 'Employee Code must be unique.';
        }
    }

    if (!formData.contactNumber.trim()) {
        errors.contactNumber = 'Contact Number is required.';
    } else if (!/^\d{10}$/.test(formData.contactNumber)) {
        errors.contactNumber = 'Please enter a valid 10-digit mobile number.';
    }

    // Organizational Assignment
    const primaryBranchName = formData.branchName.trim();
    if (!primaryBranchName || primaryBranchName === 'N/A') {
        errors.branchName = 'Primary Branch Name is required.';
    } else if (!allBranches.some(b => b.branchName === primaryBranchName)) {
        errors.branchName = 'Selected Primary Branch does not exist.';
    }
    // District, Zone, Region are derived, so their validation is implicitly tied to branchName
    // We can add a basic check that they aren't 'N/A' if a branch is selected.
    if (primaryBranchName !== 'N/A' && (!formData.zone.trim() || formData.zone === 'N/A')) {
        errors.zone = 'Zone is required (derived from branch).';
    }
    if (primaryBranchName !== 'N/A' && (!formData.region.trim() || formData.region === 'N/A')) {
        errors.region = 'Region is required (derived from branch).';
    }
    if (primaryBranchName !== 'N/A' && (!formData.districtName.trim() || formData.districtName === 'N/A')) {
        errors.districtName = 'District is required (derived from branch).';
    }

    // Reports To (Self-reporting and Circular check)
    if (formData.reportsToEmployeeCode) {
        if (editingStaff && formData.reportsToEmployeeCode === editingStaff.employeeCode) {
            errors.reportsToEmployeeCode = 'A staff member cannot report to themselves.';
        } else {
            // Find the staff member being edited (with full subordinate info available from `allStaffList`)
            const currentStaffNode = editingStaff ? allStaffList.find(s => s.id === editingStaff.id) : null;
            const managerToReportTo = allStaffList.find(s => s.employeeCode === formData.reportsToEmployeeCode);

            if (currentStaffNode && managerToReportTo) {
                // Check if the staff member being edited is a direct or indirect manager of the person they want to report to.
                // If the proposed manager is a subordinate of the current staff member, it's a circular hierarchy.
                const currentStaffSubordinates = getRecursiveSubordinateInfo(currentStaffNode, allStaffList).employeeCodes;
                if (currentStaffSubordinates.has(managerToReportTo.employeeCode)) {
                    errors.reportsToEmployeeCode = 'Cannot report to a subordinate in the hierarchy.';
                }
            }
        }
    }

    // Managed units are handled via UserManagement, so no specific validation here.

    return errors;
};


// FIX: Changed to named export
export const StaffManagementPage: React.FC<{ manager: User }> = ({ manager }) => {
    const [allStaff, setAllStaff] = useState<StaffWithPending[]>([]
    );
    const [allBranches, setAllBranches] = useState<Branch[]>([]); // Store full branch objects
    const [allPossibleManagers, setAllPossibleManagers] = useState<StaffMember[]>([]); // For 'Reports To' dropdown (full staff list)
    const [loading, setLoading] = useState(true);
    const [pageError, setPageError] = useState<string | null>(null); // Page-level error
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
    const [formData, setFormData] = useState<Omit<StaffMember, 'id' | 'subordinates'>>(emptyFormData);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formErrors, setFormErrors] = useState<Record<string, string>>({}); // Granular form errors
    const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    // Pagination states
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10); // Default items per page
    const [searchTerm, setSearchTerm] = useState(''); // Moved searchTerm here
    const [selectedDesignationFilter, setSelectedDesignationFilter] = useState('all'); // New: Designation filter state
    const [selectedBranchFilter, setSelectedBranchFilter] = useState('all'); // New: Branch filter state
    
    const importFileInputRef = useRef<HTMLInputElement>(null);


    const isMounted = useRef(false);

    useEffect(() => {
      isMounted.current = true;
      return () => {
        isMounted.current = false;
      };
    }, []);

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            setPageError(null);
            const [fullStaffList, branchData] = await Promise.all([
                getAllStaff(), // Get full staff list for filtering, hierarchy, and manager dropdown
                getBranches(),
            ]);
            if (!isMounted.current) return;

            // Populate allPossibleManagers for Reports To lookup
            // Exclude the currently logged-in manager from being assigned as a manager if they are promoting themselves.
            // But include them if someone else is assigning a manager.
            setAllPossibleManagers(fullStaffList.filter(s => (
                s.function.toUpperCase().includes('MANAGER') || 
                s.function.toUpperCase().includes('HEAD') ||
                s.function.toUpperCase().includes('TL')
            )));

            // Apply manager's scope filter
            let filteredStaffList = fullStaffList;
            if (manager.role === 'manager') {
                const relevantEmployeeCodes = new Set<string>();
                // Include the manager themselves in their scope
                if (manager.employeeCode) relevantEmployeeCodes.add(manager.employeeCode);

                // Get all subordinates (direct and indirect)
                const managerStaffNode = fullStaffList.find(s => s.id === manager.id);
                if (managerStaffNode) {
                    const { employeeCodes: subCodes, branchNames: subBranches } = getRecursiveSubordinateInfo(managerStaffNode, fullStaffList);
                    subCodes.forEach(code => relevantEmployeeCodes.add(code));
                    // subBranches will include branches managed by subordinates, but we also need branches directly managed by the manager.
                }

                // Add branches from managedZones or managedBranches for multi-unit managers
                const relevantBranchNames = new Set<string>();
                if (manager.branchName && manager.branchName !== 'N/A') relevantBranchNames.add(manager.branchName);
                if (manager.managedBranches) manager.managedBranches.forEach(b => relevantBranchNames.add(b));
                if (manager.managedZones) {
                    branchData.filter(b => manager.managedZones!.includes(b.zone)).forEach(b => relevantBranchNames.add(b.branchName));
                }

                filteredStaffList = fullStaffList.filter(s => 
                    (s.employeeCode && relevantEmployeeCodes.has(s.employeeCode)) ||
                    (s.branchName && relevantBranchNames.has(s.branchName))
                );
            }
            
            setAllStaff(filteredStaffList);
            setAllBranches(branchData); // Store full branch objects
        } catch (err) {
            if (isMounted.current) {
                setPageError(err instanceof Error ? err.message : 'Failed to fetch data.');
            }
        } finally {
            if (isMounted.current) {
                setLoading(false);
            }
        }
    }, [manager.employeeCode, manager.branchName, manager.managedBranches, manager.managedZones, manager.role, isMounted]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const openModalForEdit = (staffMember: StaffMember) => {
        setEditingStaff(staffMember);
        setFormErrors({}); // Clear errors on open
        // When editing, derive zone, region, district from the staffMember's current branch if available
        const staffBranch = allBranches.find(b => b.branchName === staffMember.branchName);

        setFormData({
            zone: (staffBranch?.zone || 'N/A'),
            region: (staffBranch?.region || 'N/A'),
            districtName: (staffBranch?.districtName || 'N/A'),
            branchName: staffMember.branchName,
            employeeName: staffMember.employeeName,
            employeeCode: staffMember.employeeCode,
            function: staffMember.function,
            contactNumber: staffMember.contactNumber || '9XXXXXXXXX', // Ensure contactNumber has default
            managedZones: staffMember.managedZones || [], // Pre-fill managed zones (read-only in this modal)
            managedBranches: staffMember.managedBranches || [], // Pre-fill managed branches (read-only in this modal)
            reportsToEmployeeCode: staffMember.reportsToEmployeeCode || undefined, // Pre-fill reportsToEmployeeCode
        });
        setIsModalOpen(true);
    };
    
    const openModalForAdd = () => {
        setEditingStaff(null);
        setFormErrors({}); // Clear errors on open
        
        let defaultBranchName = '';
        let defaultBranch: Branch | undefined;
        let defaultZone = 'N/A';
        let defaultRegion = 'N/A';
        let defaultDistrict = 'N/A';
        let defaultReportsToEmployeeCode: string | undefined = undefined;

        if (manager.role === 'manager' && manager.branchName && manager.branchName !== 'N/A') {
            // Manager adds staff to their own primary branch
            defaultBranchName = manager.branchName;
            defaultBranch = allBranches.find(b => b.branchName === defaultBranchName);
            defaultReportsToEmployeeCode = manager.employeeCode; // New staff reports to the current manager
        } else if (allBranches.length > 0) {
            // Admin or manager without a primary branch, pick the first available branch
            defaultBranchName = allBranches[0].branchName;
            defaultBranch = allBranches[0];
        }

        if (defaultBranch) {
            defaultZone = defaultBranch.zone;
            defaultRegion = defaultBranch.region;
            defaultDistrict = defaultBranch.districtName;
        }


        setFormData({
            ...emptyFormData,
            branchName: defaultBranchName,
            districtName: defaultDistrict,
            zone: defaultZone,
            region: defaultRegion,
            contactNumber: '9XXXXXXXXX', // Provide a placeholder for new staff
            reportsToEmployeeCode: defaultReportsToEmployeeCode,
        });
        setIsModalOpen(true);
    }

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingStaff(null);
        setFormData(emptyFormData);
        setPageError(null); // Clear modal-specific errors
        setFormErrors({});
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        
        setFormErrors(prev => {
            const newErrors = { ...prev };
            delete newErrors[name];
            return newErrors;
        });

        if (name === 'branchName') {
            const selectedBranch = allBranches.find(b => b.branchName === value);
            setFormData(prev => ({
                ...prev,
                branchName: value,
                zone: selectedBranch?.zone || 'N/A',
                region: selectedBranch?.region || 'N/A',
                districtName: selectedBranch?.districtName || 'N/A',
            }));
        } else if (name === 'reportsToEmployeeCode') {
            // If "No Manager" is selected (value === ""), set to undefined for data service
            setFormData(prev => ({ ...prev, reportsToEmployeeCode: value === "" ? undefined : value }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setPageError(null);
        setNotification(null);
        setFormErrors({});

        const validationErrors = validateForm(
            formData,
            allStaff, // Pass the full staff list for checks
            editingStaff,
            manager.role, // Pass current user's role for RBAC validation
            allBranches, // Pass allBranches for branch name validation
        );

        if (Object.keys(validationErrors).length > 0) {
            setFormErrors(validationErrors);
            setIsSubmitting(false);
            return;
        }

        try {
            // Ensure managedZones, managedBranches, and reportsToEmployeeCode are passed
            // These fields are read-only or derived in this modal, but dataService ensures consistency.
            const payload: Omit<StaffMember, 'id' | 'subordinates'> = {
                ...formData,
                // These are passed through if they exist on `editingStaff`, otherwise they'll be empty arrays or undefined
                managedZones: editingStaff?.managedZones || formData.managedZones || [],
                managedBranches: editingStaff?.managedBranches || formData.managedBranches || [],
                reportsToEmployeeCode: formData.reportsToEmployeeCode === '' ? undefined : formData.reportsToEmployeeCode,
            };

            if (editingStaff) {
                await updateStaff(editingStaff.id, payload);
                setNotification({ message: `Staff member "${payload.employeeName}" updated successfully.`, type: 'success' });
            } else {
                await addStaff(payload);
                setNotification({ message: `Staff member "${payload.employeeName}" added successfully.`, type: 'success' });
            }
            if (!isMounted.current) return;
            fetchData(); // This also reinitializes auth
            closeModal();
        } catch (err) {
            if (isMounted.current) {
                setPageError(err instanceof Error ? err.message : 'An unexpected error occurred.');
            }
        } finally {
            if (isMounted.current) {
                setIsSubmitting(false);
            }
        }
    };
    
    const handleDelete = async (id: string, name: string) => {
        if(window.confirm(`Are you sure you want to delete staff member "${name}"? This action cannot be undone.`)) {
            try {
                setNotification(null);
                await removeStaff(id);
                if (!isMounted.current) return;
                setNotification({ message: `Staff member "${name}" has been deleted.`, type: 'success' });
                fetchData(); // This also reinitializes auth
            } catch (err) {
                if (isMounted.current) {
                    setNotification({ message: err instanceof Error ? err.message : `Failed to delete ${name}.`, type: 'error' });
                }
            }
        }
    }
    
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

                const staffToImport = json.map((row, index) => {
                    const rowNumber = index + 2; // +1 for header, +1 for 0-indexed array
                    const employeeName = String(row['Staff Name'] || '').trim().toUpperCase(); // Import as uppercase
                    const employeeCode = String(row['Employee Code'] || '').trim();
                    let designationString = String(row['Designation'] || 'BRANCH OFFICER').trim().toUpperCase(); // Convert to uppercase for consistent validation
                    
                    // Validate designation against DESIGNATIONS array
                    if (!DESIGNATIONS.includes(designationString as Designation)) { // FIX: Explicitly cast as Designation here
                        console.warn(`Invalid designation "${designationString}" for row ${rowNumber}. Defaulting to 'BRANCH OFFICER'.`);
                        designationString = 'BRANCH OFFICER';
                    }

                    if (!employeeName) {
                        throw new Error(`Missing 'Staff Name' for row ${rowNumber}.`);
                    }
                    if (!employeeCode) {
                        throw new Error(`Missing 'Employee Code' for row ${rowNumber}.`);
                    }

                    const managedZonesRaw = String(row['Managed Zones'] || '').trim();
                    const managedBranchesRaw = String(row['Managed Branches'] || '').trim();
                    const reportsToEmployeeCodeRaw = String(row['Reports To Employee Code'] || '').trim();

                    return {
                        employeeName: employeeName,
                        employeeCode: employeeCode,
                        function: designationString as Designation, // FIX: Explicitly cast to Designation
                        branchName: String(row['Branch Name'] || '').trim(),
                        districtName: String(row['District Name'] || 'N/A').trim(),
                        zone: String(row['Zone'] || 'Zone-1').trim(),
                        region: String(row['Region'] || 'Region-1').trim(),
                        contactNumber: String(row['Contact Number'] || 'N/A').trim(),
                        managedZones: managedZonesRaw ? managedZonesRaw.split(',').map((s: string) => s.trim()) : [],
                        managedBranches: managedBranchesRaw ? managedBranchesRaw.split(',').map((s: string) => s.trim()) : [],
                        reportsToEmployeeCode: reportsToEmployeeCodeRaw || undefined,
                    };
                }).filter(s => s.employeeName && s.employeeCode);

                if (staffToImport.length === 0) throw new Error("No valid staff data found in the file after processing.");


                const { added, skipped } = await addMultipleStaff(staffToImport);
                if (!isMounted.current) return;
                setNotification({ message: `Import complete. Added: ${added} new staff members. Skipped: ${skipped} duplicates.`, type: 'success'});
                fetchData(); // Re-fetch staff data, which also reinitializes auth
            } catch (err: any) {
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
                setNotification({ message: 'Failed to read file.', type: 'error' }); 
                setIsSubmitting(false);
            }
        };
        reader.readAsArrayBuffer(file);
        event.target.value = ''; // Clear the input to allow re-uploading the same file
    };

    const handleExport = () => {
        const dataToExport = allStaff.map(({ employeeName, employeeCode, function: designation, branchName, districtName, zone, region, contactNumber, managedZones, managedBranches, reportsToEmployeeCode, subordinates }) => ({
            'Staff Name': employeeName,
            'Employee Code': employeeCode,
            'Designation': designation,
            'Branch Name': branchName,
            'District Name': districtName,
            'Zone': zone,
            'Region': region,
            'Contact Number': contactNumber,
            'Managed Zones': managedZones?.join(', ') || '',
            'Managed Branches': managedBranches?.join(', ') || '',
            'Reports To Employee Code': reportsToEmployeeCode || '',
            'Subordinates Count': subordinates?.length || 0,
        }));
        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Staff");
        XLSX.writeFile(workbook, "staff_export.xlsx");
        setNotification({ message: "Staff data exported successfully.", type: 'success' });
    };
    
    const filteredStaff = useMemo(() => {
        setCurrentPage(1); // Reset page to 1 when search term or filter changes
        let currentFilteredStaff = allStaff;

        // Apply search term filter
        if (searchTerm.trim()) {
          const lowercasedTerm = searchTerm.toLowerCase();
          currentFilteredStaff = currentFilteredStaff.filter(s =>
            s.employeeName.toLowerCase().includes(lowercasedTerm) ||
            s.employeeCode.toLowerCase().includes(lowercasedTerm) ||
            s.function.toLowerCase().includes(lowercasedTerm) ||
            s.branchName.toLowerCase().includes(lowercasedTerm) ||
            s.districtName.toLowerCase().includes(lowercasedTerm) ||
            s.zone.toLowerCase().includes(lowercasedTerm) ||
            s.region.toLowerCase().includes(lowercasedTerm) ||
            (s.managedZones && s.managedZones.some(z => z.toLowerCase().includes(lowercasedTerm))) ||
            (s.managedBranches && s.managedBranches.some(b => b.toLowerCase().includes(lowercasedTerm))) ||
            (s.reportsToEmployeeCode && allPossibleManagers.find(m => m.employeeCode === s.reportsToEmployeeCode)?.employeeName.toLowerCase().includes(lowercasedTerm))
          );
        }

        // Apply designation filter
        if (selectedDesignationFilter !== 'all') {
            currentFilteredStaff = currentFilteredStaff.filter(s => s.function === selectedDesignationFilter);
        }

        // Apply branch filter
        if (selectedBranchFilter !== 'all') {
            currentFilteredStaff = currentFilteredStaff.filter(s => s.branchName === selectedBranchFilter);
        }

        return currentFilteredStaff;
      }, [allStaff, searchTerm, selectedDesignationFilter, selectedBranchFilter, allPossibleManagers]);

    // Pagination calculations
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = filteredStaff.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(filteredStaff.length / itemsPerPage);

    // Determine if branch fields should be disabled/read-only (e.g., for managers or if a branch is already selected)
    // In StaffManagementPage, the primary branch is editable, but its derived zone/region/district are read-only.
    const isBranchAndLocationFieldsDisabledForManager = manager.role === 'manager'; 

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100">Staff Management</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Add, edit, and manage all company staff within your scope.</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center flex-wrap">
                     <div className="relative w-full sm:w-auto">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                          <SearchIcon className="w-5 h-5 text-gray-400" />
                        </span>
                        <input
                          type="text"
                          placeholder="Search staff..."
                          value={searchTerm}
                          onChange={e => setSearchTerm(e.target.value)}
                          className="w-full sm:w-56 pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                          aria-label="Search staff members"
                        />
                    </div>
                    {/* New Designation Filter */}
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
                    {/* New Branch Filter */}
                    <div className="w-full sm:w-auto">
                        <label htmlFor="branch-filter" className="sr-only">Filter by Branch</label>
                        <select
                            id="branch-filter"
                            value={selectedBranchFilter}
                            onChange={e => setSelectedBranchFilter(e.target.value)}
                            className="w-full sm:w-48 px-4 py-2 text-sm border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                        >
                            <option value="all">All Branches</option>
                            {allBranches.map(branch => (
                                <option key={branch.id} value={branch.branchName}>{branch.branchName}</option>
                            ))}
                        </select>
                    </div>
                    {/* RBAC: Admin or Manager can import staff */}
                    {(manager.role === 'admin' || manager.role === 'manager') && ( 
                        <>
                            <button onClick={() => importFileInputRef.current?.click()} className="btn btn-blue flex items-center gap-2" disabled={isSubmitting}>
                                <UploadIcon className="w-5 h-5" /> Import Excel
                            </button>
                            <input
                                type="file"
                                ref={importFileInputRef}
                                onChange={handleImport}
                                className="hidden"
                                accept=".xlsx, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                            />
                        </>
                    )}
                    {/* RBAC: Admin or Manager can export staff */}
                    {(manager.role === 'admin' || manager.role === 'manager') && ( 
                        <button onClick={handleExport} className="btn btn-green flex items-center gap-2" disabled={isSubmitting}>
                            <FileDownIcon className="w-5 h-5" /> Export
                        </button>
                    )}
                     {(manager.role === 'admin' || manager.role === 'manager') && ( // RBAC: Admin or Manager can add staff
                        <button
                            onClick={openModalForAdd}
                            className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                        >
                            <PlusIcon className="w-5 h-5" />
                            Add Staff
                        </button>
                     )}
                </div>
            </div>
            
            {notification && (
                <div className={`p-4 rounded-md flex items-start space-x-3 border-l-4 ${notification.type === 'success' ? 'bg-green-100 dark:bg-green-900/30 border-green-500 text-green-700 dark:text-green-300' : 'bg-red-100 dark:bg-red-900/30 border-red-500 text-red-700 dark:text-red-300'}`} role="alert">
                    {notification.type === 'success' ? <CheckCircleIcon className="w-6 h-6 flex-shrink-0" /> : <AlertTriangleIcon className="w-6 h-6 flex-shrink-0" />}
                    <div><p className="font-bold">{notification.type === 'success' ? 'Success' : 'Error'}</p><p>{notification.message}</p></div>
                </div>
            )}
            {pageError && !notification && (
                <div className="bg-red-100 dark:bg-red-900/30 border-l-4 border-red-500 text-red-700 dark:text-red-300 p-4 rounded-md flex items-start space-x-3" role="alert">
                    <AlertTriangleIcon className="w-6 h-6 flex-shrink-0" />
                    <div><p className="font-bold">Error</p><p>{pageError}</p></div>
                </div>
            )}

            {loading ? (
                 <div className="flex justify-center items-center py-20">
                    <LoaderIcon className="w-8 h-8 text-indigo-500" />
                </div>
            ) : (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                            <thead className="bg-gray-50 dark:bg-gray-700">
                                <tr>
                                    {['Employee Name', 'Employee Code', 'Designation', 'Branch', 'District', 'Zone', 'Region', 'Contact Number', 'Managed Zones', 'Managed Branches', 'Reports To', 'Subordinates', 'Actions'].map(header => (
                                         <th key={header} scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">{header}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                {currentItems.map(s => {
                                    const reportsToStaff = allPossibleManagers.find(m => m.employeeCode === s.reportsToEmployeeCode);
                                    return (
                                        <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">{s.employeeName}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{s.employeeCode}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{s.function}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{s.branchName}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{s.districtName}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{s.zone}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{s.region}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{s.contactNumber}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{s.managedZones && s.managedZones.length > 0 ? s.managedZones.join(', ') : 'N/A'}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{s.managedBranches && s.managedBranches.length > 0 ? s.managedBranches.join(', ') : 'N/A'}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{reportsToStaff ? `${reportsToStaff.employeeName} (${reportsToStaff.employeeCode})` : 'N/A'}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{s.subordinates?.length || 0}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                                <div className="flex items-center space-x-3">
                                                    {(manager.role === 'admin' || manager.role === 'manager') && ( // RBAC: Admin or Manager can edit staff
                                                        <button onClick={() => openModalForEdit(s)} className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300" aria-label={`Edit ${s.employeeName}`}><EditIcon className="w-5 h-5"/></button>
                                                    )}
                                                    {(manager.role === 'admin' || manager.role === 'manager') && ( // RBAC: Admin or Manager can delete staff
                                                        <button onClick={() => handleDelete(s.id, s.employeeName)} className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300" aria-label={`Delete ${s.employeeName}`}><TrashIcon className="w-5 h-5"/></button>
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
                         <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700"><h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{editingStaff ? 'Edit Staff Member' : 'Add Staff Member'}</h3><button onClick={closeModal} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"><XIcon className="w-6 h-6"/></button></div>
                         <form onSubmit={handleSubmit} className="flex-grow flex flex-col overflow-hidden">
                            <div className="p-6 space-y-6 overflow-y-auto">
                                {pageError && (
                                    <div className="bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-600 text-red-700 dark:text-red-300 p-3 rounded-md flex items-start space-x-2 text-sm" role="alert">
                                        <AlertTriangleIcon className="w-5 h-5 flex-shrink-0" />
                                        <span>{pageError}</span>
                                    </div>
                                )}
                                
                                {/* Staff Details */}
                                <fieldset className="space-y-4">
                                    <legend className="text-base font-semibold text-gray-900 dark:text-gray-100">Staff Details</legend>
                                    <div>
                                        <label htmlFor="employeeName" className="label-style">Employee Name</label>
                                        <input type="text" name="employeeName" id="employeeName" value={formData.employeeName} onChange={handleInputChange} required className={`input-style w-full ${formErrors.employeeName ? 'input-error' : ''}`}/>
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
                                            disabled={editingStaff !== null && (manager.role !== 'admin' || editingStaff.id === ADMIN_USER_ID || editingStaff.id === manager.id)} // Allow admin to edit others' employee codes
                                            className={`input-style w-full disabled:bg-gray-200 dark:disabled:bg-gray-700 ${formErrors.employeeCode ? 'input-error' : ''}`}
                                        />
                                        {formErrors.employeeCode && <p className="error-text">{formErrors.employeeCode}</p>}
                                    </div>
                                    <div>
                                        <label htmlFor="contactNumber" className="label-style">Contact Number</label>
                                        <input type="tel" name="contactNumber" id="contactNumber" value={formData.contactNumber} onChange={handleInputChange} required maxLength={10} pattern="^\d{10}$" className={`input-style w-full ${formErrors.contactNumber ? 'input-error' : ''}`}/>
                                        {formErrors.contactNumber && <p className="error-text">{formErrors.contactNumber}</p>}
                                    </div>
                                </fieldset>

                                {/* Organizational Assignment */}
                                <fieldset className="space-y-4">
                                    <legend className="text-base font-semibold text-gray-900 dark:text-gray-100">Organizational Assignment</legend>
                                    <div>
                                        <label htmlFor="function" className="label-style">Designation</label>
                                        <select name="function" id="function" value={formData.function} onChange={handleInputChange} required className={`input-style w-full ${formErrors.function ? 'input-error' : ''}`}>
                                            {DESIGNATIONS.map(d => <option key={d} value={d}>{d}</option>)}
                                        </select>
                                        {formErrors.function && <p className="error-text">{formErrors.function}</p>}
                                    </div>
                                    <div>
                                        <label htmlFor="branchName" className="label-style">Primary Branch Name</label>
                                        <select 
                                            name="branchName" 
                                            id="branchName" 
                                            value={formData.branchName} 
                                            onChange={handleInputChange} 
                                            required 
                                            disabled={isBranchAndLocationFieldsDisabledForManager && !editingStaff} // Managers cannot change their staff's primary branch when adding
                                            className={`input-style w-full ${formErrors.branchName ? 'input-error' : ''} ${isBranchAndLocationFieldsDisabledForManager && !editingStaff ? 'disabled:bg-gray-200 dark:disabled:bg-gray-700 cursor-not-allowed' : ''}`}
                                        >
                                            <option value="">-- Select Branch --</option>
                                            {allBranches.map(b => <option key={b.id} value={b.branchName}>{b.branchName}</option>)}
                                        </select>
                                        {formErrors.branchName && <p className="error-text">{formErrors.branchName}</p>}
                                    </div>
                                    <div>
                                        <label htmlFor="districtName" className="label-style">District Name</label>
                                        <input 
                                            type="text" 
                                            name="districtName" 
                                            id="districtName" 
                                            value={formData.districtName} 
                                            readOnly 
                                            disabled={true} // Always derived and read-only
                                            className={`input-style w-full disabled:bg-gray-200 dark:disabled:bg-gray-700 cursor-not-allowed ${formErrors.districtName ? 'input-error' : ''}`}
                                            aria-label="District Name (derived from branch)"
                                        />
                                        {formErrors.districtName && <p className="error-text">{formErrors.districtName}</p>}
                                    </div>
                                    <div>
                                        <label htmlFor="zone" className="label-style">Zone</label>
                                        <input 
                                            type="text" 
                                            name="zone" 
                                            id="zone" 
                                            value={formData.zone} 
                                            readOnly 
                                            disabled={true} // Always derived and read-only
                                            className={`input-style w-full disabled:bg-gray-200 dark:disabled:bg-gray-700 cursor-not-allowed ${formErrors.zone ? 'input-error' : ''}`}
                                            aria-label="Zone (derived from branch)"
                                        />
                                        {formErrors.zone && <p className="error-text">{formErrors.zone}</p>}
                                    </div>
                                    <div>
                                        <label htmlFor="region" className="label-style">Region</label>
                                        <input 
                                            type="text" 
                                            name="region" 
                                            id="region" 
                                            value={formData.region} 
                                            readOnly 
                                            disabled={true} // Always derived and read-only
                                            className={`input-style w-full disabled:bg-gray-200 dark:disabled:bg-gray-700 cursor-not-allowed ${formErrors.region ? 'input-error' : ''}`}
                                            aria-label="Region (derived from branch)"
                                        />
                                        {formErrors.region && <p className="error-text">{formErrors.region}</p>}
                                    </div>
                                </fieldset>

                                {/* Reports To (Now editable) */}
                                <fieldset className="space-y-4">
                                    <legend className="text-base font-semibold text-gray-900 dark:text-gray-100">Reporting Structure</legend>
                                    <div>
                                        <label htmlFor="reportsToEmployeeCode" className="label-style">Reports To (Manager's Employee Code)</label>
                                        <select
                                            name="reportsToEmployeeCode"
                                            id="reportsToEmployeeCode"
                                            value={formData.reportsToEmployeeCode || ""} // Bind to empty string if undefined
                                            onChange={handleInputChange}
                                            className={`mt-1 block w-full input-style ${formErrors.reportsToEmployeeCode ? 'input-error' : ''}`}
                                            disabled={editingStaff?.employeeCode === manager.employeeCode && manager.role === 'manager'} // A manager cannot set their own reportsTo from here
                                        >
                                            <option value="">-- No Manager --</option> {/* Value is empty string */}
                                            {allPossibleManagers
                                                .filter(possibleManager => 
                                                    possibleManager.employeeCode !== formData.employeeCode && // Cannot report to self
                                                    possibleManager.employeeCode !== 'ADMIN' // Cannot report to admin hardcoded user
                                                )
                                                .map(manager => (
                                                    <option key={manager.id} value={manager.employeeCode}>
                                                        {manager.employeeName} ({manager.employeeCode}) - {manager.function}
                                                    </option>
                                                ))}
                                        </select>
                                        {formErrors.reportsToEmployeeCode && <p className="error-text">{formErrors.reportsToEmployeeCode}</p>}
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Select the employee code of this staff member's direct manager.</p>
                                    </div>
                                    {/* Managed Units for specific roles (always informational in this modal) */}
                                    {(formData.function.toUpperCase() === 'ZONAL MANAGER' || formData.function.toUpperCase().includes('HEAD') || formData.function.toUpperCase().startsWith('TL-')) && (
                                        <div className="bg-gray-100 dark:bg-gray-700/50 p-3 rounded-md text-sm text-gray-700 dark:text-gray-300">
                                            <p className="font-semibold mb-1">Managed Units (View Only):</p>
                                            {formData.function.toUpperCase() === 'ZONAL MANAGER' && (
                                                <p>Zones: {formData.managedZones && formData.managedZones.length > 0 ? formData.managedZones.join(', ') : 'N/A'}</p>
                                            )}
                                            {(formData.function.toUpperCase().includes('HEAD') || formData.function.toUpperCase().startsWith('TL-')) && (
                                                <p>Branches: {formData.managedBranches && formData.managedBranches.length > 0 ? formData.managedBranches.join(', ') : 'N/A'}</p>
                                            )}
                                            <p className="text-xs mt-2 italic">To change managed units, please go to 'Mapping &gt; Manager Assignments' (Admin role only).</p>
                                        </div>
                                    )}
                                </fieldset>
                            </div>
                            <div className="flex justify-end items-center gap-3 p-4 bg-gray-50 dark:bg-gray-800/50 border-t dark:border-gray-700 flex-shrink-0">
                                <button type="button" onClick={closeModal} className="btn-secondary">Cancel</button>
                                <button type="submit" disabled={isSubmitting || Object.keys(formErrors).length > 0} className="btn-primary flex items-center gap-2">
                                    {isSubmitting && <LoaderIcon className="w-4 h-4" />}
                                    {isSubmitting ? 'Saving...' : 'Save Changes'}
                                </button>
                            </div>
                        </form>
                    </div>
                 </div>
            )}
        </div>
    );
};