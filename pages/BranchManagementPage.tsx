import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Branch, BRANCH_NAMES, StaffMember, User, Zone, Region, District, Designation } from '../types'; // Import Zone, Region, District types
import { getBranches, addBranch, updateBranch, removeBranch, addMultipleBranches, BranchDeletionError, updateStaff, removeAllBranches, getZones, getRegions, getDistricts, getAllStaff, getStaffByBranch } from '../services/dataService'; // Import new org unit getters, getAllStaff, getStaffByBranch
import { reinitializeAuth } from '../services/authService';
import { LoaderIcon, AlertTriangleIcon, PlusIcon, EditIcon, TrashIcon, XIcon, ChevronUpIcon, ChevronDownIcon, FileDownIcon, UploadIcon, CheckCircleIcon, EyeIcon } from '../components/icons'; // Added EyeIcon
import BranchStaffDetailModal from '../components/BranchStaffDetailModal'; // New Import

// Declare XLSX from the script tag in index.html
declare const XLSX: any;

const emptyFormData: Omit<Branch, 'id' | 'branchManagerName' | 'branchManagerCode' | 'mobileNumber'> & { districtName: string } = {
    zone: 'N/A', // Default to 'N/A'
    region: 'N/A', // Default to 'N/A'
    branchName: 'N/A', // Default to 'N/A'
    districtName: 'N/A', // Added districtName to form data
};

// --- Validation ---
const validateForm = (
    data: typeof emptyFormData,
    manualBranchName: string,
    isOtherBranch: boolean,
    manualDistrictName: string, // Added manualDistrictName
    isOtherDistrict: boolean, // Added isOtherDistrict
    allZones: Zone[], // Pass allZones for validation
    allRegions: Region[], // Pass allRegions for validation
    allDistricts: District[] // Pass allDistricts for validation
): Record<string, string> => {
    const errors: Record<string, string> = {};

    // Branch Name
    const branchNameToValidate = isOtherBranch ? manualBranchName.trim() : data.branchName.trim();
    if (!branchNameToValidate || branchNameToValidate === 'N/A') { // Added 'N/A' check
        errors.branchName = 'Branch name is required.';
    } else if (branchNameToValidate.length < 3) {
        errors.branchName = 'Branch name must be at least 3 characters long.';
    }

    // District Name
    const districtNameToValidate = isOtherDistrict ? manualDistrictName.trim() : data.districtName.trim();
    if (!districtNameToValidate || districtNameToValidate === 'N/A') { // Added 'N/A' check
        errors.districtName = 'District name is required.';
    } else if (districtNameToValidate.length < 3) {
        errors.districtName = 'District name must be at least 3 characters long.';
    } else if (!isOtherDistrict && !allDistricts.some(d => d.name === districtNameToValidate)) {
        errors.districtName = 'Selected District does not exist in master data.';
    } else if (isOtherDistrict && !manualDistrictName.trim()) {
         errors.districtName = 'Custom District name is required.';
    }


    // Zone and Region
    if (!data.zone.trim() || data.zone === 'N/A') { // Added 'N/A' check
        errors.zone = 'Zone is required.';
    } else if (!allZones.some(z => z.name === data.zone)) {
        errors.zone = 'Selected Zone does not exist in master data.';
    }

    if (!data.region.trim() || data.region === 'N/A') { // Added 'N/A' check
        errors.region = 'Region is required.';
    } else if (!allRegions.some(r => r.name === data.region)) {
        errors.region = 'Selected Region does not exist in master data.';
    }
    
    return errors;
};


export const BranchManagementPage: React.FC<{ currentUser: User }> = ({ currentUser }) => {
    // RBAC: Restrict this page to admin users only
    if (currentUser.role !== 'admin') {
        return (
            <div className="space-y-6">
                <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100">Branch Management</h2>
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 text-center">
                    <p className="text-red-500 dark:text-red-400 font-semibold">
                        You do not have permission to view Branch Management.
                    </p>
                    <p className="text-gray-500 dark:text-gray-400 mt-2">
                        This page is accessible only to Administrators.
                    </p>
                </div>
            </div>
        );
    }

    const [branches, setBranches] = useState<Branch[]>([]);
    const [allZones, setAllZones] = useState<Zone[]>([]);
    const [allRegions, setAllRegions] = useState<Region[]>([]);
    const [allDistricts, setAllDistricts] = useState<District[]>([]);
    const [allStaff, setAllStaff] = useState<StaffMember[]>([]); // To get manager designations

    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    
    // State for modals and forms
    const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
    const [formData, setFormData] = useState(emptyFormData);
    const [branchToDelete, setBranchToDelete] = useState<Branch | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [isDeleteAllModalOpen, setIsDeleteAllModalOpen] = useState(false);
    const [branchToViewStaff, setBranchToViewStaff] = useState<string | null>(null); // State for viewing staff
    const [isViewStaffModalOpen, setIsViewStaffModalOpen] = useState(false); // State for staff view modal


    // Error and notification states
    const [modalError, setModalError] = useState<string | null>(null);
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});
    const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [deletionError, setDeletionError] = useState<{ branch: Branch; staff: StaffMember[] } | null>(null);
    const [reassignments, setReassignments] = useState<Record<string, string>>({});
    const [isReassigning, setIsReassigning] = useState(false);
    const [defaultReassignBranch, setDefaultReassignBranch] = useState<string>(''); // For bulk reassignment


    // Sorting and file handling
    const [sortConfig, setSortConfig] = useState<{ key: keyof Branch; direction: 'asc' | 'desc' }>({ key: 'branchName', direction: 'asc' });
    const importFileInputRef = React.useRef<HTMLInputElement>(null);
    
    // State for "Other" branch name input
    const [isOtherBranch, setIsOtherBranch] = useState(false);
    const [manualBranchName, setManualBranchName] = useState('');

    // State for "Other" district name input
    const [isOtherDistrict, setIsOtherDistrict] = useState(false);
    const [manualDistrictName, setManualDistrictName] = useState('');

    const isMounted = useRef(false);

    useEffect(() => {
      isMounted.current = true;
      return () => {
        isMounted.current = false;
      };
    }, []);


    const fetchBranchesAndStaff = useCallback(async () => {
        try {
            setLoading(true);
            const [branchList, staffList] = await Promise.all([
                getBranches(),
                getAllStaff(),
            ]);
            if (!isMounted.current) return;
            setBranches(branchList);
            setAllStaff(staffList); // Store all staff for lookup
        } catch (err) {
            if (isMounted.current) {
                setNotification({ message: err instanceof Error ? err.message : 'Failed to fetch branches and staff.', type: 'error' });
            }
        } finally {
            if (isMounted.current) {
                setLoading(false);
            }
        }
    }, [isMounted]);

    const fetchOrgUnits = useCallback(async () => {
        try {
            const [zones, regions, districts] = await Promise.all([
                getZones(),
                getRegions(),
                getDistricts(),
            ]);
            if (isMounted.current) {
                setAllZones(zones);
                setAllRegions(regions);
                setAllDistricts(districts);
            }
        } catch (err) {
            if (isMounted.current) {
                setNotification({ message: err instanceof Error ? err.message : 'Failed to fetch organizational units.', type: 'error' });
            }
        }
    }, [isMounted]);


    useEffect(() => {
        fetchBranchesAndStaff();
        fetchOrgUnits();
    }, [fetchBranchesAndStaff, fetchOrgUnits]);
    
    useEffect(() => {
      // When the deletion error modal opens, reset the reassignments and default bulk selection
      if (deletionError) {
        setReassignments({});
        setDefaultReassignBranch('');
      }
    }, [deletionError]);


    const sortedBranches = useMemo(() => {
        let sortableBranches = [...branches];
        if (sortConfig !== null) {
            sortableBranches.sort((a, b) => {
                const valA = a[sortConfig.key] || '';
                const valB = b[sortConfig.key] || '';
                if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
                if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return sortableBranches;
    }, [branches, sortConfig]);

    const requestSort = (key: keyof Branch) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const openModalForEdit = (branch: Branch) => {
        setModalError(null);
        setFormErrors({});
        setEditingBranch(branch);
        setFormData({
            zone: branch.zone,
            region: branch.region,
            branchName: branch.branchName,
            districtName: branch.districtName, // Set districtName for editing
        });
        
        // Determine if branchName is an "Other" custom entry
        const isBranchNameInMaster = (BRANCH_NAMES as readonly string[]).includes(branch.branchName);
        setIsOtherBranch(!isBranchNameInMaster);
        if (!isBranchNameInMaster) {
            setManualBranchName(branch.branchName.toUpperCase());
            setFormData(prev => ({ ...prev, branchName: 'Other' })); // Reflect 'Other' in dropdown
        } else {
            setManualBranchName('');
        }

        // Handle District Name for editing
        const isDistrictNameInMaster = allDistricts.some(d => d.name === branch.districtName);
        setIsOtherDistrict(!isDistrictNameInMaster);
        if (!isDistrictNameInMaster) {
            setManualDistrictName(branch.districtName.toUpperCase());
            setFormData(prev => ({ ...prev, districtName: 'Other' })); // Reflect 'Other' in dropdown
        } else {
            setManualDistrictName('');
        }

        setIsModalOpen(true);
    };

    const openModalForAdd = () => {
        setModalError(null);
        setFormErrors({});
        setEditingBranch(null);
        // Default to first available org unit and branch
        const defaultZone = allZones[0]?.name || 'N/A';
        const defaultRegion = allRegions.find(r => r.zoneId === allZones[0]?.id)?.name || 'N/A';
        const defaultDistrict = allDistricts.find(d => d.regionId === allRegions.find(r => r.zoneId === allZones[0]?.id)?.id)?.name || 'N/A';

        setFormData({
            ...emptyFormData,
            zone: defaultZone,
            region: defaultRegion,
            districtName: defaultDistrict,
            branchName: BRANCH_NAMES[0] || 'N/A',
        });
        setIsOtherBranch(false);
        setManualBranchName('');
        setIsOtherDistrict(false);
        setManualDistrictName('');
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingBranch(null);
        setFormData(emptyFormData);
        setModalError(null);
        setFormErrors({});
        setIsOtherBranch(false);
        setManualBranchName('');
        setIsOtherDistrict(false);
        setManualDistrictName('');
    };

    // New: Functions to handle staff view modal
    const openViewStaffModal = (branchName: string) => {
        setBranchToViewStaff(branchName);
        setIsViewStaffModalOpen(true);
    };

    const closeViewStaffModal = () => {
        setBranchToViewStaff(null);
        setIsViewStaffModalOpen(false);
    };


    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        let { name, value } = e.target;
        // manualBranchName and manualDistrictName handled by dedicated handlers for validation feedback

        if (name === 'branchName') {
            setIsOtherBranch(value === 'Other');
            setFormData(prev => ({ ...prev, branchName: value }));
            // If 'Other' is selected for branch, reset district to default dropdown, not 'Other' manual
            if (value === 'Other') {
                setIsOtherDistrict(false);
                setManualDistrictName('');
                setFormData(prev => ({ ...prev, districtName: allDistricts[0]?.name || 'N/A' })); // Default to first district
            }
        } else if (name === 'districtName') {
            setIsOtherDistrict(value === 'Other');
            setFormData(prev => ({ ...prev, districtName: value }));
        }
        else if (name === 'zone') {
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
        else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
        
        // Clear specific error message if input is being changed
        if (formErrors[name]) {
            setFormErrors(prev => {
                const newErrors = {...prev};
                delete newErrors[name];
                return newErrors;
            })
        }
    };
    
    const handleManualBranchNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setManualBranchName(e.target.value.toUpperCase()); // Ensure uppercase
        if (formErrors.branchName) {
            setFormErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors.branchName;
                return newErrors;
            });
        }
    }
    const handleManualDistrictNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setManualDistrictName(e.target.value.toUpperCase()); // Ensure uppercase
        if (formErrors.districtName) {
            setFormErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors.districtName;
                return newErrors;
            });
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setModalError(null);
        
        const errors = validateForm(formData, manualBranchName, isOtherBranch, manualDistrictName, isOtherDistrict, allZones, allRegions, allDistricts);
        if (Object.keys(errors).length > 0) {
            setFormErrors(errors);
            return;
        }

        setIsSubmitting(true);
        setNotification(null);

        const finalBranchName = isOtherBranch ? manualBranchName.trim() : formData.branchName;
        const finalDistrictName = isOtherDistrict ? manualDistrictName.trim() : formData.districtName;

        const payload = { 
            ...formData, 
            branchName: finalBranchName,
            districtName: finalDistrictName,
        };

        try {
            if (editingBranch) {
                // Ensure branchManagerName, branchManagerCode, mobileNumber are explicitly kept from old branch 
                // or default to N/A, as these are now derived from staff data and not set via this form.
                await updateBranch(editingBranch.id, {
                    ...payload,
                    branchManagerName: editingBranch.branchManagerName || 'N/A',
                    branchManagerCode: editingBranch.branchManagerCode || 'N/A',
                    mobileNumber: editingBranch.mobileNumber || 'N/A',
                });
                if (!isMounted.current) return;
                setNotification({ message: `Branch "${finalBranchName}" updated successfully.`, type: 'success'});
            } else {
                await addBranch({
                    ...payload,
                    branchManagerName: 'N/A', // Default to N/A for new branches
                    branchManagerCode: 'N/A',
                    mobileNumber: 'N/A',
                });
                if (!isMounted.current) return;
                setNotification({ message: `Branch "${finalBranchName}" added successfully.`, type: 'success'});
            }
            if (isMounted.current) {
                closeModal();
                fetchBranchesAndStaff(); // Re-fetch branches and staff
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
    
    const confirmDelete = async () => {
        if (!branchToDelete) return;

        setDeletingId(branchToDelete.id);
        setNotification(null);
        const branchToDeleteRef = branchToDelete; // Keep a reference
        setBranchToDelete(null); // Close confirmation modal

        try {
            await removeBranch(branchToDeleteRef.id);
            if (!isMounted.current) return;
            setNotification({ message: `Branch "${branchToDeleteRef.branchName}" deleted successfully.`, type: 'success' });
            fetchBranchesAndStaff(); // Re-fetch branches and staff
        } catch (err) {
            if (!isMounted.current) return;
            if (err instanceof BranchDeletionError) {
                setDeletionError({ branch: branchToDeleteRef, staff: err.staff });
            } else {
                setNotification({ message: err instanceof Error ? err.message : `Failed to delete ${branchToDeleteRef.branchName}.`, type: 'error' });
            }
        } finally {
            if (isMounted.current) {
                setDeletingId(null);
            }
        }
    }
    
    const handleDeleteAllBranches = async () => {
        setIsSubmitting(true);
        setNotification(null);
        try {
            await removeAllBranches();
            if (!isMounted.current) return;
            setNotification({ message: 'All branches have been successfully deleted.', type: 'success' });
            fetchBranchesAndStaff(); // This will now fetch an empty list
        } catch (err) {
            if (isMounted.current) {
                setNotification({ message: err instanceof Error ? err.message : 'An error occurred while deleting branches.', type: 'error' });
            }
        } finally {
            if (isMounted.current) {
                setIsSubmitting(false);
                setIsDeleteAllModalOpen(false);
            }
        }
    };


    const handleReassignmentChange = (staffId: string, newBranchName: string) => {
        setReassignments(prev => ({ ...prev, [staffId]: newBranchName }));
    };

    const handleBulkReassignChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newDefaultBranch = e.target.value;
        setDefaultReassignBranch(newDefaultBranch);
        if (deletionError) {
            const updatedReassignments: Record<string, string> = {};
            deletionError.staff.forEach(staff => {
                // Only update if not individually overridden by user selecting an option other than current value
                if (!(reassignments[staff.id] && reassignments[staff.id] !== staff.branchName)) {
                    updatedReassignments[staff.id] = newDefaultBranch;
                }
            });
            setReassignments(prev => ({...prev, ...updatedReassignments})); // Merge to preserve individual overrides
        }
    };

    const handleReassignAndDelete = async () => {
        if (!deletionError) return;

        setIsReassigning(true);
        setNotification(null);

        try {
            const staffToUpdate = deletionError.staff;
            const updatePromises = staffToUpdate.map(staff => {
                const newBranchName = reassignments[staff.id];
                if (!newBranchName || newBranchName === 'N/A') {
                    throw new Error(`New branch not selected for ${staff.employeeName}`);
                }
                const targetBranch = branches.find(b => b.branchName === newBranchName);
                if (!targetBranch) {
                    throw new Error(`Target branch "${newBranchName}" not found.`);
                }
                return updateStaff(staff.id, { 
                    branchName: newBranchName,
                    zone: targetBranch.zone,
                    region: targetBranch.region,
                    districtName: targetBranch.districtName,
                });
            });

            await Promise.all(updatePromises);
            if (!isMounted.current) return;

            const branchToDeleteNow = deletionError.branch;
            await removeBranch(branchToDeleteNow.id);
            if (!isMounted.current) return;

            setNotification({
                message: `Successfully reassigned ${staffToUpdate.length} staff and deleted branch "${branchToDeleteNow.branchName}".`,
                type: 'success'
            });

            setDeletionError(null);
            fetchBranchesAndStaff(); // Refresh the branch list
        } catch (err) {
            if (isMounted.current) {
                setNotification({
                    message: err instanceof Error ? err.message : 'An error occurred during the operation.',
                    type: 'error'
                });
            }
        } finally {
            if (isMounted.current) {
                setIsReassigning(false);
            }
        }
    };


    const handleExportBranches = () => {
        if (sortedBranches.length === 0) {
            setNotification({ message: "No data to export.", type: 'error' });
            return;
        }
        const dataToExport = sortedBranches.map(branch => {
            // Primary manager details are now derived, ensure they are present for export.
            const primaryManager = allStaff.find(s => s.employeeCode === branch.branchManagerCode);
            return {
                'ID': branch.id,
                'Zone': branch.zone,
                'Region': branch.region,
                'Branch Name': branch.branchName,
                'District Name': branch.districtName,
                'Primary Branch Manager Name': branch.branchManagerName || 'N/A', // Explicitly handle N/A
                'Primary Branch Manager Emp ID': branch.branchManagerCode || 'N/A', // Explicitly handle N/A
                'Primary Branch Manager Designation': primaryManager?.function || 'N/A', 
                'Mobile Number': branch.mobileNumber || 'N/A', // Mobile number from branch, explicitly handle N/A
            };
        });
        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        // FIX: Update header row
        XLSX.utils.sheet_add_aoa(worksheet, [['ID', 'Zone', 'Region', 'Branch Name', 'District Name', 'Primary Branch Manager Name', 'Primary Branch Manager Emp ID', 'Primary Branch Manager Designation', 'Mobile Number']], { origin: 'A1' });
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Branches");
        XLSX.writeFile(workbook, "branches_export.xlsx");
    };
    
    const handleImportClick = () => {
        setNotification(null);
        importFileInputRef.current?.click();
    };

    const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setLoading(true);
        setNotification(null);

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = e.target?.result;
                const workbook = XLSX.read(data, { type: 'array' });
                const json: any[] = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]); // Infer headers from first row
                const branchesToImport = json.map(row => ({
                    zone: String(row.Zone || 'N/A').trim(),
                    region: String(row.Region || 'N/A').trim(),
                    branchName: String(row['Branch Name'] || '').trim(),
                    districtName: String(row['District Name'] || 'N/A').trim(), // Import districtName
                    // Manager and mobile info is no longer set via this form, it's defaulted to N/A
                    branchManagerName: String(row['Primary Branch Manager Name'] || 'N/A').toUpperCase(), 
                    branchManagerCode: String(row['Primary Branch Manager Emp ID'] || 'N/A').trim(), 
                    mobileNumber: String(row['Mobile Number'] || 'N/A').trim(), // Import mobile number, will be saved but not directly tied to manager here
                })).filter(branch => branch.branchName); 

                if (branchesToImport.length === 0) throw new Error("No valid branch data found in the file.");

                // Validate imported data against existing master data
                for (const branch of branchesToImport) {
                    if (!allZones.some(z => z.name === branch.zone) && branch.zone !== 'N/A') {
                        throw new Error(`Invalid Zone "${branch.zone}" found in import file. Zone not in master data.`);
                    }
                    if (!allRegions.some(r => r.name === branch.region) && branch.region !== 'N/A') {
                        throw new Error(`Invalid Region "${branch.region}" found in import file. Region not in master data.`);
                    }
                    if (!allDistricts.some(d => d.name === branch.districtName) && branch.districtName !== 'N/A') {
                        throw new Error(`Invalid District "${branch.districtName}" found in import file. District not in master data.`);
                    }
                }

                const { added, skipped } = await addMultipleBranches(branchesToImport);
                if (!isMounted.current) return;
                setNotification({ message: `Import complete. Added: ${added} new branches. Skipped: ${skipped} duplicates.`, type: 'success'});
                fetchBranchesAndStaff(); // Re-fetch branches and staff
            } catch (err) {
                if (isMounted.current) {
                    setNotification({ message: err instanceof Error ? err.message : 'Failed to process file.', type: 'error' });
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
        event.target.value = ''; // Reset input
    };

    const SortableHeader: React.FC<{ columnKey: keyof Branch; title: string }> = ({ columnKey, title }) => (
        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer" onClick={() => requestSort(columnKey)} aria-sort={sortConfig?.key === columnKey ? (sortConfig.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
            <div className="flex items-center">{title}{sortConfig?.key === columnKey && (sortConfig.direction === 'asc' ? <ChevronUpIcon className="w-4 h-4 ml-1" /> : <ChevronDownIcon className="w-4 h-4 ml-1" />)}</div>
        </th>
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100">Branch Management</h2>
                <div className="flex items-center gap-3 flex-wrap">
                    {/* RBAC: Only Admin can import */}
                    <button onClick={handleImportClick} className="btn btn-blue"><UploadIcon className="w-5 h-5" />Import</button>
                    <input type="file" ref={importFileInputRef} onChange={handleFileImport} className="hidden" accept=".xlsx, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" />
                    {/* RBAC: Only Admin can export */}
                    <button onClick={handleExportBranches} className="btn btn-green"><FileDownIcon className="w-5 h-5" />Export</button>
                    {/* RBAC: Only Admin can add branch */}
                    <button onClick={openModalForAdd} className="btn btn-indigo"><PlusIcon className="w-5 h-5" />Add Branch</button>
                    {/* RBAC: Only Admin can delete all branches */}
                    <button onClick={() => setIsDeleteAllModalOpen(true)} className="btn btn-danger"><TrashIcon className="w-5 h-5" />Delete All</button>
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
                                    <SortableHeader columnKey="branchName" title="Branch Name" />
                                    <SortableHeader columnKey="districtName" title="District Name" />
                                    <SortableHeader columnKey="zone" title="Zone" />
                                    <SortableHeader columnKey="region" title="Region" />
                                    {/* Removed Primary Branch Manager Name, Emp Id, Designation */}
                                    <th scope="col" className="th-style">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                {sortedBranches.map(branch => {
                                    return (
                                        <tr key={branch.id} className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-opacity ${deletingId === branch.id ? 'opacity-50' : 'opacity-100'}`}>
                                            <td className="td-style font-medium">{branch.branchName}</td>
                                            <td className="td-style">{branch.districtName}</td> {/* Display District Name */}
                                            <td className="td-style">{branch.zone}</td>
                                            <td className="td-style">{branch.region}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                                <div className="flex items-center space-x-3">
                                                    <button onClick={() => openViewStaffModal(branch.branchName)} className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-300" aria-label={`View staff for ${branch.branchName}`}><EyeIcon className="w-5 h-5"/></button>
                                                    {deletingId === branch.id ? <LoaderIcon className="w-5 h-5"/> : <><button onClick={() => openModalForEdit(branch)} className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300" aria-label={`Edit ${branch.branchName}`}><EditIcon className="w-5 h-5"/></button><button onClick={() => setBranchToDelete(branch)} className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300" aria-label={`Delete ${branch.branchName}`}><TrashIcon className="w-5 h-5"/></button></>}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
            
            {isModalOpen && (
                 <div className="fixed inset-0 bg-black bg-opacity-50 z-40 flex items-center justify-center p-4" aria-modal="true" role="dialog">
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
                         <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700"><h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{editingBranch ? 'Edit Branch' : 'Add New Branch'}</h3><button onClick={closeModal} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"><XIcon className="w-6 h-6"/></button></div>
                         <form onSubmit={handleSubmit} className="overflow-y-auto" noValidate><div className="p-6 space-y-4">{modalError && <div className="bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-600 text-red-700 dark:text-red-300 p-3 rounded-md flex items-start space-x-2 text-sm" role="alert"><AlertTriangleIcon className="w-5 h-5 flex-shrink-0" /><span>{modalError}</span></div>}<div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><div><label htmlFor="zone" className="label-style">Zone</label><select name="zone" id="zone" value={formData.zone} onChange={handleInputChange} required className={`mt-1 block w-full input-style ${formErrors.zone ? 'input-error' : ''}`}><option value="N/A">-- Select Zone --</option>{allZones.map(z => <option key={z.id} value={z.name}>{z.name}</option>)}</select>{formErrors.zone && <p className="error-text">{formErrors.zone}</p>}</div><div><label htmlFor="region" className="label-style">Region</label><select name="region" id="region" value={formData.region} onChange={handleInputChange} required className={`mt-1 block w-full input-style ${formErrors.region ? 'input-error' : ''}`}><option value="N/A">-- Select Region --</option>{allRegions.filter(r => allZones.find(z => z.name === formData.zone)?.id === r.zoneId).map(r => <option key={r.id} value={r.name}>{r.name}</option>)}</select>{formErrors.region && <p className="error-text">{formErrors.region}</p>}</div><div className="sm:col-span-2"><label htmlFor="branchName" className="label-style">Branch Name</label><select name="branchName" id="branchName" value={isOtherBranch ? 'Other' : formData.branchName} onChange={handleInputChange} required className={`mt-1 block w-full input-style ${formErrors.branchName && !isOtherBranch ? 'input-error' : ''}`}><option value="N/A">-- Select Branch --</option>{BRANCH_NAMES.map(b => <option key={b} value={b}>{b}</option>)}<option value="Other">Other...</option></select></div>{isOtherBranch && <div className="sm:col-span-2"><label htmlFor="manualBranchName" className="label-style">Enter Branch Name</label><input type="text" name="manualBranchName" id="manualBranchName" value={manualBranchName} onChange={handleManualBranchNameChange} required className={`mt-1 block w-full input-style ${formErrors.branchName ? 'input-error' : ''}`}/>{formErrors.branchName && <p className="error-text">{formErrors.branchName}</p>}</div>}<div><label htmlFor="districtName" className="label-style">District Name</label><select name="districtName" id="districtName" value={isOtherDistrict ? 'Other' : formData.districtName} onChange={handleInputChange} required className={`mt-1 block w-full input-style ${formErrors.districtName && !isOtherDistrict ? 'input-error' : ''}`}><option value="N/A">-- Select District --</option>{allDistricts.filter(d => allRegions.find(r => r.name === formData.region)?.id === d.regionId).map(d => <option key={d.id} value={d.name}>{d.name}</option>)}<option value="Other">Other...</option></select>{formErrors.districtName && !isOtherDistrict && <p className="error-text">{formErrors.districtName}</p>}</div>{isOtherDistrict && <div><label htmlFor="manualDistrictName" className="label-style">Enter District Name</label><input type="text" name="manualDistrictName" id="manualDistrictName" value={manualDistrictName} onChange={handleManualDistrictNameChange} required className={`mt-1 block w-full input-style ${formErrors.districtName ? 'input-error' : ''}`}/>{formErrors.districtName && <p className="error-text">{formErrors.districtName}</p>}</div>}</div></div><div className="flex justify-end items-center gap-3 p-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-700"><button type="button" onClick={closeModal} className="btn btn-secondary">Cancel</button><button type="submit" disabled={isSubmitting || Object.keys(validateForm(formData, manualBranchName, isOtherBranch, manualDistrictName, isOtherDistrict, allZones, allRegions, allDistricts)).length > 0} className="btn btn-indigo flex items-center gap-2">{isSubmitting && <LoaderIcon className="w-4 h-4" />}{isSubmitting ? 'Saving...' : 'Save Changes'}</button></div></form>
                    </div>
                 </div>
            )}
            {branchToDelete && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" aria-modal="true" role="dialog">
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md">
                        <div className="p-6 text-center"><div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/30"><AlertTriangleIcon className="h-6 w-6 text-red-600 dark:text-red-400" aria-hidden="true" /></div><h3 className="mt-5 text-lg font-medium text-gray-900 dark:text-gray-100">Delete Branch</h3><div className="mt-2"><p className="text-sm text-gray-500 dark:text-gray-400">Are you sure you want to delete <strong>{branchToDelete.branchName}</strong>? This action cannot be undone.</p></div></div>
                        <div className="flex justify-center items-center gap-3 p-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-700"><button type="button" onClick={() => setBranchToDelete(null)} className="btn btn-secondary">Cancel</button><button type="button" onClick={confirmDelete} className="btn btn-danger">Delete</button></div>
                    </div>
                </div>
            )}
            {deletionError && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" aria-modal="true" role="dialog">
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
                        <div className="flex justify-between items-center p-4 border-b dark:border-gray-700">
                            <h3 className="text-lg font-semibold text-red-600 dark:text-red-400 flex items-center gap-2">
                                <AlertTriangleIcon className="w-6 h-6" />Cannot Delete Branch
                            </h3>
                            <button onClick={() => setDeletionError(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                                <XIcon className="w-6 h-6"/>
                            </button>
                        </div>
                        <div className="p-6 overflow-y-auto space-y-4">
                             <p className="text-gray-700 dark:text-gray-300">
                                Cannot delete branch <strong>"{deletionError.branch.branchName}"</strong> as it has <strong>{deletionError.staff.length} staff member(s)</strong> assigned.
                            </p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                To proceed, please reassign each staff member to a new branch below. Once all staff are reassigned, you can delete the branch.
                            </p>
                            <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-md border border-gray-200 dark:border-gray-600">
                                {/* Bulk Reassignment Dropdown */}
                                <div className="mb-4">
                                    <label htmlFor="bulk-reassign" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Reassign all to:
                                    </label>
                                    <select
                                        id="bulk-reassign"
                                        value={defaultReassignBranch}
                                        onChange={handleBulkReassignChange}
                                        className="w-full input-style"
                                    >
                                        <option value="" disabled>-- Select a default branch --</option>
                                        {branches.filter(b => b.id !== deletionError.branch.id).map(b => (
                                            <option key={b.id} value={b.branchName}>{b.branchName}</option>
                                        ))}
                                    </select>
                                </div>

                                <ul className="space-y-3 max-h-64 overflow-y-auto">
                                    {deletionError.staff.map(staff => (
                                        <li key={staff.id} className="grid grid-cols-1 md:grid-cols-2 items-center gap-x-4 gap-y-2">
                                            <div className="text-sm">
                                                <p className="font-medium text-gray-800 dark:text-gray-200">{staff.employeeName}</p>
                                                <p className="text-xs text-gray-500 dark:text-gray-400">ID: {staff.employeeCode}</p>
                                            </div>
                                            <select
                                                value={reassignments[staff.id] || ''}
                                                onChange={(e) => handleReassignmentChange(staff.id, e.target.value)}
                                                className="w-full input-style"
                                                aria-label={`New branch for ${staff.employeeName}`}
                                            >
                                                <option value="" disabled>-- Select New Branch --</option>
                                                {branches.filter(b => b.id !== deletionError.branch.id).map(b => (
                                                    <option key={b.id} value={b.branchName}>{b.branchName}</option>
                                                ))}
                                            </select>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                        <div className="flex justify-end items-center gap-3 p-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-700">
                            <button type="button" onClick={() => setDeletionError(null)} className="btn btn-secondary" disabled={isReassigning}>
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleReassignAndDelete}
                                className="btn btn-indigo flex items-center gap-2"
                                disabled={isReassigning || Object.keys(reassignments).length !== deletionError.staff.length || Object.values(reassignments).some(val => !val || val === 'N/A')} // Added N/A check
                            >
                                {isReassigning && <LoaderIcon className="w-4 h-4" />}
                                Reassign & Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {isDeleteAllModalOpen && (
                 <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" aria-modal="true" role="dialog">
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md">
                        <div className="p-6 text-center"><div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/30"><AlertTriangleIcon className="h-6 w-6 text-red-600 dark:text-red-400" aria-hidden="true" /></div><h3 className="mt-5 text-lg font-medium text-gray-900 dark:text-gray-100">Delete All Branches</h3><div className="mt-2"><p className="text-sm text-gray-500 dark:text-gray-400">Are you sure you want to delete <strong>ALL</strong> branches? This action is irreversible. Ensure all staff are reassigned or deleted first.</p></div></div>
                        <div className="flex justify-center items-center gap-3 p-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-700"><button type="button" onClick={() => setIsDeleteAllModalOpen(false)} className="btn btn-secondary" disabled={isSubmitting}>Cancel</button><button type="button" onClick={handleDeleteAllBranches} className="btn btn-danger flex items-center gap-2" disabled={isSubmitting}>{isSubmitting && <LoaderIcon className="w-4 h-4" />}Delete All</button></div>
                    </div>
                </div>
            )}
            {isViewStaffModalOpen && branchToViewStaff && (
                <BranchStaffDetailModal 
                    branchName={branchToViewStaff} 
                    onClose={closeViewStaffModal} 
                />
            )}
        </div>
    );
};