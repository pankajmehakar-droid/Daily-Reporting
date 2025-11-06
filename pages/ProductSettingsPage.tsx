import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ProductMetric, User } from '../types';
import { getProductMetrics, addProductMetric, updateProductMetric, removeProductMetric } from '../services/dataService';
import { LoaderIcon, AlertTriangleIcon, EditIcon, XIcon, PlusIcon, TrashIcon, CheckCircleIcon } from '../components/icons';

interface ProductSettingsPageProps {
    currentUser: User; // FIX: Added currentUser prop
    onClose?: () => void; // Optional prop for modal context
    onMetricsUpdated?: () => void; // Optional prop to trigger refresh in parent
}

const ProductSettingsPage: React.FC<ProductSettingsPageProps> = ({ onClose, onMetricsUpdated, currentUser }) => {
    // RBAC: Restrict this page to admin users only
    if (currentUser.role !== 'admin') {
        return (
            <div className="space-y-6">
                <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100 mb-6">{onClose ? '' : 'Product Metric'}</h2>
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 text-center">
                    <p className="text-red-500 dark:text-red-400 font-semibold">
                        You do not have permission to view Product Settings.
                    </p>
                    <p className="text-gray-500 dark:text-gray-400 mt-2">
                        This page is accessible only to Administrators.
                    </p>
                </div>
            </div>
        );
    }

    const [metrics, setMetrics] = useState<ProductMetric[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false); // This modal is for add/edit within the page
    const [editingMetric, setEditingMetric] = useState<ProductMetric | null>(null);
    const [formData, setFormData] = useState<Omit<ProductMetric, 'id'>>({ name: '', category: '', type: 'Other', unitOfMeasure: '', contributesToOverallGoals: false });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    const isMounted = useRef(false);

    useEffect(() => {
        isMounted.current = true;
        return () => {
            isMounted.current = false;
        };
    }, []);

    const fetchMetrics = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await getProductMetrics();
            if (isMounted.current) {
                setMetrics(data);
            }
        } catch (err) {
            if (isMounted.current) {
                setError(err instanceof Error ? err.message : 'Failed to fetch product metrics.');
            }
        } finally {
            if (isMounted.current) {
                setLoading(false);
            }
        }
    }, [isMounted]);

    useEffect(() => {
        fetchMetrics();
    }, [fetchMetrics]);

    const openModal = (metric: ProductMetric | null = null) => {
        setError(null);
        setNotification(null);
        if (metric) {
            setEditingMetric(metric);
            setFormData({ name: metric.name, category: metric.category, type: metric.type, unitOfMeasure: metric.unitOfMeasure, contributesToOverallGoals: metric.contributesToOverallGoals });
        } else {
            setEditingMetric(null);
            setFormData({ name: '', category: '', type: 'Other', unitOfMeasure: '', contributesToOverallGoals: false });
        }
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingMetric(null);
        setFormData({ name: '', category: '', type: 'Other', unitOfMeasure: '', contributesToOverallGoals: false });
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type, checked } = e.target as HTMLInputElement;
        setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError(null);
        setNotification(null);

        try {
            if (editingMetric) {
                await updateProductMetric(editingMetric.id, formData);
                if (!isMounted.current) return;
                setNotification({ message: `Product metric "${formData.name}" updated successfully.`, type: 'success' });
            } else {
                await addProductMetric(formData);
                if (!isMounted.current) return;
                setNotification({ message: `Product metric "${formData.name}" added successfully.`, type: 'success' });
            }
            if (isMounted.current) {
                closeModal();
                await fetchMetrics();
                onMetricsUpdated?.(); // Notify parent of update
            }
        } catch (err) {
            if (isMounted.current) {
                setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
            }
        } finally {
            if (isMounted.current) {
                setIsSubmitting(false);
            }
        }
    };

    const handleDelete = async (metric: ProductMetric) => {
        if (window.confirm(`Are you sure you want to delete the product metric "${metric.name}"? This action cannot be undone.`)) {
            try {
                setLoading(true); // Indicate loading while deleting
                setNotification(null);
                await removeProductMetric(metric.id);
                if (!isMounted.current) return;
                setNotification({ message: `Product metric "${metric.name}" deleted successfully.`, type: 'success' });
                await fetchMetrics();
                onMetricsUpdated?.(); // Notify parent of update
            } catch (err) {
                if (isMounted.current) {
                    setNotification({ message: err instanceof Error ? err.message : 'Failed to delete product metric.', type: 'error' });
                    setLoading(false); // Stop loading if error
                }
            }
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100">{onClose ? '' : 'Product Metric'}</h2> {/* Title hidden if in modal, parent handles title */}
                <button onClick={() => openModal()} className="btn btn-indigo flex items-center gap-2">
                    <PlusIcon className="w-5 h-5" /> Add New Metric
                </button>
            </div>

            {notification && (
                <div className={`p-4 rounded-md flex items-start space-x-3 border-l-4 ${notification.type === 'success' ? 'bg-green-100 dark:bg-green-900/30 border-green-500 text-green-700 dark:text-green-300' : 'bg-red-100 dark:bg-red-900/30 border-red-500 text-red-700 dark:text-red-300'}`} role="alert">
                    {notification.type === 'success' ? <CheckCircleIcon className="w-6 h-6 flex-shrink-0" /> : <AlertTriangleIcon className="w-6 h-6 flex-shrink-0" />}
                    <div><p className="font-bold">{notification.type === 'success' ? 'Success' : 'Error'}</p><p>{notification.message}</p></div>
                </div>
            )}
            {error && !notification && (
                <div className="bg-red-100 dark:bg-red-900/30 border-l-4 border-red-500 text-red-700 dark:text-red-300 p-4 rounded-md flex items-start space-x-3" role="alert">
                    <AlertTriangleIcon className="w-6 h-6 flex-shrink-0" />
                    <div><p className="font-bold">Error</p><p>{error}</p></div>
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
                                    <th className="th-style">Metric Name</th>
                                    <th className="th-style">Category</th>
                                    <th className="th-style">Type</th>
                                    <th className="th-style">Unit of Measure</th>
                                    <th className="th-style">Contributes to Goals</th>
                                    <th className="th-style">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                {metrics.length > 0 ? (
                                    metrics.map(metric => (
                                        <tr key={metric.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                            <td className="td-style font-medium">{metric.name}</td>
                                            <td className="td-style">{metric.category}</td>
                                            <td className="td-style">{metric.type}</td>
                                            <td className="td-style">{metric.unitOfMeasure || 'N/A'}</td>
                                            <td className="td-style">{metric.contributesToOverallGoals ? 'Yes' : 'No'}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                                <div className="flex items-center space-x-3">
                                                    <button onClick={() => openModal(metric)} className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300" aria-label={`Edit ${metric.name}`}><EditIcon className="w-5 h-5" /></button>
                                                    <button onClick={() => handleDelete(metric)} className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300" aria-label={`Delete ${metric.name}`}><TrashIcon className="w-5 h-5" /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={6} className="text-center py-10 text-gray-500 dark:text-gray-400">
                                            No product metrics defined.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {isModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-40 flex items-center justify-center p-4" aria-modal="true" role="dialog">
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg">
                        <div className="flex justify-between items-center p-4 border-b dark:border-gray-700">
                            <h3 className="text-lg font-semibold dark:text-gray-100">{editingMetric ? 'Edit Product Metric' : 'Add New Product Metric'}</h3>
                            <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" aria-label="Close modal"><XIcon className="w-6 h-6" /></button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="p-6 space-y-4">
                                {error && <div className="p-3 bg-red-100 text-red-700 rounded-md text-sm" role="alert">{error}</div>}
                                <div>
                                    <label htmlFor="name" className="label-style">Metric Name</label>
                                    <input type="text" name="name" id="name" value={formData.name} onChange={handleInputChange} required className="input-style w-full" />
                                </div>
                                <div>
                                    <label htmlFor="category" className="label-style">Category (e.g., DDS, FD)</label>
                                    <input type="text" name="category" id="category" value={formData.category} onChange={handleInputChange} required className="input-style w-full" />
                                </div>
                                <div>
                                    <label htmlFor="type" className="label-style">Type</label>
                                    <select name="type" id="type" value={formData.type} onChange={handleInputChange} className="input-style w-full" required>
                                        <option value="Amount">Amount</option>
                                        <option value="Account">Account</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </div>
                                <div>
                                    <label htmlFor="unitOfMeasure" className="label-style">Unit of Measure (e.g., INR, Units, %)</label>
                                    <input type="text" name="unitOfMeasure" id="unitOfMeasure" value={formData.unitOfMeasure} onChange={handleInputChange} className="input-style w-full" />
                                </div>
                                <div className="flex items-center">
                                    <input
                                        id="contributesToOverallGoals"
                                        name="contributesToOverallGoals"
                                        type="checkbox"
                                        checked={formData.contributesToOverallGoals}
                                        onChange={handleInputChange}
                                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded dark:bg-gray-700 dark:border-gray-600"
                                    />
                                    <label htmlFor="contributesToOverallGoals" className="ml-2 block text-sm text-gray-900 dark:text-gray-100">
                                        Contributes to Overall Goals
                                    </label>
                                </div>
                            </div>
                            <div className="flex justify-end gap-3 p-4 bg-gray-50 dark:bg-gray-800/50 border-t dark:border-gray-700">
                                <button type="button" onClick={closeModal} className="btn-secondary">Cancel</button>
                                <button type="submit" disabled={isSubmitting} className="btn-primary flex items-center gap-2">
                                    {isSubmitting && <LoaderIcon className="w-4 h-4" />}
                                    {isSubmitting ? 'Saving...' : 'Save'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProductSettingsPage;