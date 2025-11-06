

import React, { useState, useRef, useEffect } from 'react';
import { User } from '../types';
import { MOCK_PASSWORDS, reinitializeAuth } from '../services/authService';
import { removeAllStaff, removeAllBranches, resetAppData } from '../services/dataService'; // Import resetAppData
import { LoaderIcon, CheckCircleIcon, AlertTriangleIcon, LockIcon, TrashIcon } from '../components/icons';
import CollapsibleSection from '../components/CollapsibleSection';

interface SettingsPageProps {
    user: User;
    onLogout: () => void; // New prop
}

const ADMIN_USER_ID = 'admin-user-0'; // Hardcoded admin ID as it's internal to authService for preservation

const SettingsPage: React.FC<SettingsPageProps> = ({ user, onLogout }) => {
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    // State for data deletion modals
    const [isDeleteUsersModalOpen, setIsDeleteUsersModalOpen] = useState(false);
    const [isDeleteBranchesModalOpen, setIsDeleteBranchesModalOpen] = useState(false);
    const [isDeletingData, setIsDeletingData] = useState(false);
    const [dataDeletionNotification, setDataDeletionNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    // State for Reset App Data
    const [isResetDataModalOpen, setIsResetDataModalOpen] = useState(false);
    const [isResettingData, setIsResettingData] = useState(false);
    const [resetDataNotification, setResetDataNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);


    const isMounted = useRef(false);

    useEffect(() => {
      isMounted.current = true;
      return () => {
        isMounted.current = false;
      };
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccessMessage(null);

        if (newPassword !== confirmPassword) {
            setError("New passwords do not match.");
            return;
        }

        if (newPassword.length < 6) {
            setError("New password must be at least 6 characters long.");
            return;
        }

        setIsLoading(true);

        // Simulate API call to change password
        await new Promise(resolve => setTimeout(resolve, 1000));

        if (!isMounted.current) return; // Prevent state update if component unmounted

        // Mock password check
        if (MOCK_PASSWORDS[user.username] !== currentPassword) {
            setError("The current password you entered is incorrect.");
            setIsLoading(false);
            return;
        }
        
        // In a real app, you would make an API call here.
        // For this demo, we'll just show success.
        console.log(`Password for user ${user.username} changed to ${newPassword}`);
        
        // This is where you would update the mock password if you wanted persistence during the session
        // MOCK_PASSWORDS[user.username] = newPassword;

        setIsLoading(false);
        setSuccessMessage("Your password has been updated successfully!");
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');

        setTimeout(() => {
            if (isMounted.current) {
                setSuccessMessage(null);
            }
        }, 5000);
    };

    const handleDeleteAllUsers = async () => {
        setIsDeletingData(true);
        setDataDeletionNotification(null);
        try {
            await removeAllStaff(ADMIN_USER_ID);
            if (!isMounted.current) return;
            // reinitializeAuth(); // reinitializeAuth is now handled within removeAllStaff
            setDataDeletionNotification({ message: 'All user data (except admin) has been deleted successfully.', type: 'success' });
            // For immediate effect on the UI, force a logout or refresh if the current user was deleted.
            // Since admin is preserved, the current user remains valid.
        } catch (err) {
            if (!isMounted.current) return;
            setDataDeletionNotification({ message: err instanceof Error ? err.message : 'Failed to delete all user data.', type: 'error' });
        } finally {
            if (isMounted.current) {
                setIsDeletingData(false);
                setIsDeleteUsersModalOpen(false);
                setTimeout(() => setDataDeletionNotification(null), 5000); // Clear notification after 5 seconds
            }
        }
    };

    const handleDeleteAllBranches = async () => {
        setIsDeletingData(true);
        setDataDeletionNotification(null);
        try {
            await removeAllBranches();
            if (!isMounted.current) return;
            // reinitializeAuth(); // reinitializeAuth is now handled within removeAllBranches
            setDataDeletionNotification({ message: 'All branch data has been deleted successfully.', type: 'success' });
        } catch (err) {
            if (!isMounted.current) return;
            setDataDeletionNotification({ message: err instanceof Error ? err.message : 'Failed to delete all branch data. Ensure all staff are reassigned or deleted first.', type: 'error' });
        } finally {
            if (isMounted.current) {
                setIsDeletingData(false);
                setIsDeleteBranchesModalOpen(false);
                setTimeout(() => setDataDeletionNotification(null), 5000); // Clear notification after 5 seconds
            }
        }
    };

    const handleResetAppData = async () => {
        setIsResettingData(true);
        setResetDataNotification(null); // Clear previous notifications
        try {
            await resetAppData(ADMIN_USER_ID);
            if (!isMounted.current) return;
            setResetDataNotification({ message: 'All app data has been reset successfully. You will be logged out to refresh.', type: 'success' });
            // Log out after a short delay to allow notification to be seen
            setTimeout(() => {
                if (isMounted.current) onLogout();
            }, 2000);
        } catch (err) {
            if (!isMounted.current) return;
            setResetDataNotification({ message: err instanceof Error ? err.message : 'Failed to reset app data.', type: 'error' });
        } finally {
            if (isMounted.current) {
                setIsResettingData(false);
                setIsResetDataModalOpen(false);
                setTimeout(() => setResetDataNotification(null), 5000); // Clear notification after 5 seconds
            }
        }
    };

    const renderInputField = (
        id: string,
        label: string,
        value: string,
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
    ) => (
        <div>
            <label htmlFor={id} className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                {label}
            </label>
            <input
                type="password"
                id={id}
                name={id}
                value={value}
                onChange={onChange}
                required
                className="mt-1 block w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            />
        </div>
    );

    return (
        <div className="max-w-2xl mx-auto">
            <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100 mb-6">Settings</h2>

            <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 p-6 sm:p-8 rounded-lg shadow-md space-y-6 mb-6">
                <div className="flex items-center space-x-3">
                    <LockIcon className="w-6 h-6 text-gray-500 dark:text-gray-400" />
                    <h3 className="text-lg font-medium leading-6 text-gray-900 dark:text-gray-100">Change Password</h3>
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
                
                <div className="space-y-4">
                    {renderInputField("currentPassword", "Current Password", currentPassword, (e) => setCurrentPassword(e.target.value))}
                    {renderInputField("newPassword", "New Password", newPassword, (e) => setNewPassword(e.target.value))}
                    {renderInputField("confirmPassword", "Confirm New Password", confirmPassword, (e) => setConfirmPassword(e.target.value))}
                </div>
                
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
                                'Update Password'
                            )}
                        </button>
                    </div>
                </div>
            </form>

            {user.role === 'admin' && (
                <>
                    <CollapsibleSection title="Data Management" icon={TrashIcon}>
                         {dataDeletionNotification && (
                            <div className={`p-4 rounded-md flex items-start space-x-3 border-l-4 mb-4 ${dataDeletionNotification.type === 'success' ? 'bg-green-100 dark:bg-green-900/30 border-green-500 text-green-700 dark:text-green-300' : 'bg-red-100 dark:bg-red-900/30 border-red-500 text-red-700 dark:text-red-300'}`} role="alert">
                                {dataDeletionNotification.type === 'success' ? <CheckCircleIcon className="w-6 h-6 flex-shrink-0" /> : <AlertTriangleIcon className="w-6 h-6 flex-shrink-0" />}
                                <div><p className="font-bold">{dataDeletionNotification.type === 'success' ? 'Success' : 'Error'}</p><p>{dataDeletionNotification.message}</p></div>
                            </div>
                        )}
                        <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
                            These actions will permanently delete all data related to users or branches. Proceed with caution.
                        </p>
                        <div className="space-y-4">
                            <button 
                                onClick={() => setIsDeleteUsersModalOpen(true)} 
                                disabled={isDeletingData}
                                className="w-full btn-danger flex items-center justify-center gap-2"
                            >
                                <TrashIcon className="w-5 h-5" />
                                Delete All User Data
                            </button>
                            <button 
                                onClick={() => setIsDeleteBranchesModalOpen(true)} 
                                disabled={isDeletingData}
                                className="w-full btn-danger flex items-center justify-center gap-2"
                            >
                                <TrashIcon className="w-5 h-5" />
                                Delete All Branch Data
                            </button>
                        </div>
                    </CollapsibleSection>

                    {/* New: App Data Management section for Reset */}
                    <CollapsibleSection title="App Data Management" icon={TrashIcon}>
                        {resetDataNotification && (
                            <div className={`p-4 rounded-md flex items-start space-x-3 border-l-4 mb-4 ${resetDataNotification.type === 'success' ? 'bg-green-100 dark:bg-green-900/30 border-green-500 text-green-700 dark:text-green-300' : 'bg-red-100 dark:bg-red-900/30 border-red-500 text-red-700 dark:text-red-300'}`} role="alert">
                                {resetDataNotification.type === 'success' ? <CheckCircleIcon className="w-6 h-6 flex-shrink-0" /> : <AlertTriangleIcon className="w-6 h-6 flex-shrink-0" />}
                                <div><p className="font-bold">{resetDataNotification.type === 'success' ? 'Success' : 'Error'}</p><p>{resetDataNotification.message}</p></div>
                            </div>
                        )}
                        <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
                            This action will permanently delete ALL user, branch, and product mapping data from the application, resetting it to a clean state while preserving your admin account.
                        </p>
                        <button
                            onClick={() => setIsResetDataModalOpen(true)}
                            disabled={isResettingData}
                            className="w-full btn-danger flex items-center justify-center gap-2"
                        >
                            <TrashIcon className="w-5 h-5" />
                            Reset App Data
                        </button>
                    </CollapsibleSection>
                </>
            )}

            {isDeleteUsersModalOpen && (
                 <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" aria-modal="true" role="dialog">
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md">
                        <div className="p-6 text-center">
                            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/30">
                                <AlertTriangleIcon className="h-6 w-6 text-red-600 dark:text-red-400" aria-hidden="true" />
                            </div>
                            <h3 className="mt-5 text-lg font-medium text-gray-900 dark:text-gray-100">Delete All User Data</h3>
                            <div className="mt-2">
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    Are you sure you want to delete <strong>ALL</strong> user data? This will remove all staff records, except your own admin account. This action is irreversible.
                                </p>
                            </div>
                        </div>
                        <div className="flex justify-center items-center gap-3 p-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-700">
                            <button type="button" onClick={() => setIsDeleteUsersModalOpen(false)} className="btn btn-secondary" disabled={isDeletingData}>
                                Cancel
                            </button>
                            <button type="button" onClick={handleDeleteAllUsers} className="btn btn-danger flex items-center gap-2" disabled={isDeletingData}>
                                {isDeletingData && <LoaderIcon className="w-4 h-4" />}Delete All
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isDeleteBranchesModalOpen && (
                 <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" aria-modal="true" role="dialog">
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md">
                        <div className="p-6 text-center">
                            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/30">
                                <AlertTriangleIcon className="h-6 w-6 text-red-600 dark:text-red-400" aria-hidden="true" />
                            </div>
                            <h3 className="mt-5 text-lg font-medium text-gray-900 dark:text-gray-100">Delete All Branch Data</h3>
                            <div className="mt-2">
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    Are you sure you want to delete <strong>ALL</strong> branch data? This action is irreversible. Ensure all staff are reassigned or deleted first.
                                </p>
                            </div>
                        </div>
                        <div className="flex justify-center items-center gap-3 p-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-700">
                            <button type="button" onClick={() => setIsDeleteBranchesModalOpen(false)} className="btn btn-secondary" disabled={isDeletingData}>
                                Cancel
                            </button>
                            <button type="button" onClick={handleDeleteAllBranches} className="btn btn-danger flex items-center gap-2" disabled={isDeletingData}>
                                {isDeletingData && <LoaderIcon className="w-4 h-4" />}Delete All
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* New: Reset App Data Confirmation Modal */}
            {isResetDataModalOpen && (
                 <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" aria-modal="true" role="dialog">
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md">
                        <div className="p-6 text-center">
                            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/30">
                                <AlertTriangleIcon className="h-6 w-6 text-red-600 dark:text-red-400" aria-hidden="true" />
                            </div>
                            <h3 className="mt-5 text-lg font-medium text-gray-900 dark:text-gray-100">Reset All App Data</h3>
                            <div className="mt-2">
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    Are you absolutely sure you want to reset <strong>ALL</strong> application data? This will delete all staff (except your admin account), all branches, and all product mappings. This action is irreversible.
                                </p>
                            </div>
                        </div>
                        <div className="flex justify-center items-center gap-3 p-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-700">
                            <button type="button" onClick={() => setIsResetDataModalOpen(false)} className="btn btn-secondary" disabled={isResettingData}>
                                Cancel
                            </button>
                            <button type="button" onClick={handleResetAppData} className="btn btn-danger flex items-center gap-2" disabled={isResettingData}>
                                {isResettingData && <LoaderIcon className="w-4 h-4" />}Reset All
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SettingsPage;