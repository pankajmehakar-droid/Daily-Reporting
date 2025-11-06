
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { User, StaffMember, DESIGNATIONS } from '../types';
import { getStaffById, updateStaff, ADMIN_USER_ID, getAllStaff } from '../services/dataService'; // Import ADMIN_USER_ID and getAllStaff
import { LoaderIcon, CheckCircleIcon, AlertTriangleIcon, EditIcon } from '../components/icons';

interface ProfileSettingsPageProps {
    currentUser: User;
    refreshCurrentUser: () => void;
}

const ProfileSettingsPage: React.FC<ProfileSettingsPageProps> = ({ currentUser, refreshCurrentUser }) => {
    const [formData, setFormData] = useState({
        employeeName: currentUser.staffName,
        designation: currentUser.designation,
        contactNumber: currentUser.contactNumber,
        employeeCode: currentUser.employeeCode || '',
    });
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [allStaff, setAllStaff] = useState<StaffMember[]>([]);
    const [managerName, setManagerName] = useState<string>('N/A');

    const isMounted = useRef(false);

    useEffect(() => {
        isMounted.current = true;
        const fetchAllStaffData = async () => {
            try {
                const staffList = await getAllStaff();
                if (isMounted.current) {
                    setAllStaff(staffList);
                }
            } catch (err) {
                console.error("Failed to fetch staff data for manager lookup.");
            }
        };
        fetchAllStaffData();
        return () => {
            isMounted.current = false;
        };
    }, []);

    // Update form data if currentUser prop changes
    useEffect(() => {
        setFormData({
            employeeName: currentUser.staffName,
            designation: currentUser.designation,
            contactNumber: currentUser.contactNumber,
            employeeCode: currentUser.employeeCode || '',
        });
    }, [currentUser]);

    // Find manager name when staff list or current user changes
    useEffect(() => {
        if (currentUser.reportsToEmployeeCode && allStaff.length > 0) {
            const manager = allStaff.find(s => s.employeeCode === currentUser.reportsToEmployeeCode);
            setManagerName(manager ? `${manager.employeeName} (${manager.employeeCode})` : 'N/A');
        } else {
            setManagerName('N/A');
        }
    }, [currentUser.reportsToEmployeeCode, allStaff]);


    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccessMessage(null);
        setIsLoading(true);

        try {
            if (!currentUser.id) {
                throw new Error("User ID is missing. Cannot update profile.");
            }
            if (!/^\d{10}$/.test(formData.contactNumber)) {
                throw new Error("Please enter a valid 10-digit contact number.");
            }

            // The updateStaff expects `function` not `designation`
            // StaffName and Designation are not mutable here, only ContactNumber
            await updateStaff(currentUser.id, {
                contactNumber: formData.contactNumber,
            });

            if (!isMounted.current) return;

            await refreshCurrentUser(); // Refresh the currentUser in DashboardPage state

            if (!isMounted.current) return;
            setSuccessMessage("Your profile has been updated successfully!");

            setTimeout(() => {
                if (isMounted.current) {
                    setSuccessMessage(null);
                }
            }, 5000);

        } catch (err) {
            if (isMounted.current) {
                setError(err instanceof Error ? err.message : 'An unexpected error occurred during profile update.');
            }
        } finally {
            if (isMounted.current) {
                setIsLoading(false);
            }
        }
    };

    const renderInputField = (
        id: string,
        label: string,
        value: string,
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => void,
        readOnly?: boolean,
        type: string = 'text',
        disabled?: boolean,
        pattern?: string,
        maxLength?: number
    ) => (
        <div>
            <label htmlFor={id} className="label-style">
                {label}
            </label>
            <input
                type={type}
                id={id}
                name={id}
                value={value}
                onChange={onChange}
                readOnly={readOnly}
                disabled={disabled}
                required={!readOnly}
                className={`mt-1 block w-full input-style ${readOnly || disabled ? 'disabled:bg-gray-200 dark:disabled:bg-gray-700 cursor-not-allowed' : ''}`}
                pattern={pattern}
                maxLength={maxLength}
            />
        </div>
    );
    
    const renderReadOnlyField = (label: string, value: string | undefined | null) => (
        <div>
            <label className="label-style">{label}</label>
            <p className="mt-1 block w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm sm:text-sm text-gray-700 dark:text-gray-300">
                {value || 'N/A'}
            </p>
        </div>
    );
    
    const renderReadOnlyListField = (label: string, items: string[] | undefined) => (
         <div>
            <label className="label-style">{label}</label>
            <div className="mt-1 block w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm sm:text-sm text-gray-700 dark:text-gray-300 min-h-[42px]">
                {items && items.length > 0 ? items.join(', ') : 'N/A'}
            </div>
        </div>
    );

    return (
        <div className="max-w-2xl mx-auto">
            <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100 mb-6">Profile Settings</h2>

            <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 p-6 sm:p-8 rounded-lg shadow-md space-y-6">
                <div className="flex items-center space-x-3">
                    <EditIcon className="w-6 h-6 text-indigo-500" />
                    <h3 className="text-lg font-medium leading-6 text-gray-900 dark:text-gray-100">Your Profile Information</h3>
                </div>

                {successMessage && (
                    <div className="bg-green-100 dark:bg-green-900/30 border-l-4 border-green-500 text-green-700 dark:text-green-300 p-4 rounded-md flex items-start space-x-3" role="alert">
                        <CheckCircleIcon className="w-6 h-6 flex-shrink-0" />
                        <div>
                            <p className="font-bold">Success</p>
                            <p>{successMessage}</p>
                        </div>
                    </div>
                )}

                {error && (
                    <div className="bg-red-100 dark:bg-red-900/30 border-l-4 border-red-500 text-red-700 dark:text-red-300 p-4 rounded-md flex items-start space-x-3" role="alert">
                        <AlertTriangleIcon className="w-6 h-6 flex-shrink-0" />
                        <div>
                            <p className="font-bold">Error</p>
                            <p>{error}</p>
                        </div>
                    </div>
                )}

                <fieldset className="space-y-4 pt-4">
                    <legend className="text-base font-semibold text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-gray-700 pb-2 mb-2">Basic Information</legend>
                    {renderInputField("employeeName", "Staff Name", formData.employeeName, handleInputChange, true)}
                    {renderInputField("employeeCode", "Employee Code", formData.employeeCode, handleInputChange, true)}
                    {renderInputField("contactNumber", "Contact Number", formData.contactNumber, handleInputChange, false, 'tel', false, "\\d{10}", 10)}
                </fieldset>

                <fieldset className="space-y-4 pt-4">
                    <legend className="text-base font-semibold text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-gray-700 pb-2 mb-2">Organizational Assignment</legend>
                    {renderReadOnlyField("Designation", formData.designation)}
                    {renderReadOnlyField("Branch", currentUser.branchName)}
                    {renderReadOnlyField("District", currentUser.districtName)}
                    {renderReadOnlyField("Region", currentUser.region)}
                    {renderReadOnlyField("Zone", currentUser.zone)}
                </fieldset>

                <fieldset className="space-y-4 pt-4">
                    <legend className="text-base font-semibold text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-gray-700 pb-2 mb-2">Management & Reporting</legend>
                    {renderReadOnlyListField("Managed Zones", currentUser.managedZones)}
                    {renderReadOnlyListField("Managed Branches", currentUser.managedBranches)}
                    {renderReadOnlyField("Reports To", managerName)}
                </fieldset>

                <div className="pt-5 border-t border-gray-200 dark:border-gray-700">
                    <div className="flex justify-end">
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full sm:w-auto flex justify-center items-center gap-2 py-2 px-6 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-400 disabled:cursor-not-allowed"
                        >
                            {isLoading ? (
                                <>
                                    <LoaderIcon className="w-5 h-5" />
                                    Updating...
                                </>
                            ) : (
                                'Update Profile'
                            )}
                        </button>
                    </div>
                </div>
            </form>
        </div>
    );
};

export default ProfileSettingsPage;
