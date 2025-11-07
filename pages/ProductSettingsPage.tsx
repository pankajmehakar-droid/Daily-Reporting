

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { ProductMetric, User } from '../types';
import { getProductMetrics, addProductMetric, updateProductMetric, removeProductMetric } from '../services/dataService';
import { LoaderIcon, AlertTriangleIcon, EditIcon, XIcon, PlusIcon, TrashIcon, CheckCircleIcon, SearchIcon, ChevronUpIcon, ChevronDownIcon } from '../components/icons';

interface ProductSettingsPageProps {
    currentUser: User; // FIX: Added currentUser prop
    onClose?: () => void; // Optional prop for modal context
    onMetricsUpdated?: () => void; // Optional prop to trigger refresh in parent
}

// Validation function for the form data
const validateMetricForm = (formData: Omit<ProductMetric, 'id'>, existingMetrics: ProductMetric[], editingMetricId: string | null) => {
    const errors: Record<string, string> = {};

    if (!formData.name.trim()) {
        errors.name = 'Metric Name is required.';
    } else if (formData.name.trim().length < 3) {
        errors.name = 'Metric Name must be at least 3 characters.';
    } else if (existingMetrics.some(m => m.name.toLowerCase() === formData.name.trim().toLowerCase() && m.id !== editingMetricId)) {
        errors.name = 'Metric Name must be unique.';
    }

    if (!formData.category.trim()) {
        errors.category = 'Category is required.';
    } else if (formData.category.trim().length < 2) {
        errors.category = 'Category must be at least 2 characters.';
    }

    if (!formData.type) {
        errors.type = 'Type is required.';
    }

    if (!formData.unitOfMeasure.trim()) {
      errors.unitOfMeasure = 'Unit of Measure is required.';
    } else if (formData.unitOfMeasure.trim().length < 1) {
      errors.unitOfMeasure = 'Unit of Measure must be at least 1 character.';
    }


    return errors;
};

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
    const [formErrors, setFormErrors] = useState<Record<string, string>>({}); // New: granular form errors

    // Table sorting and search states
    const [sortConfig, setSortConfig] = useState<{ key: keyof ProductMetric; direction: 'asc' | 'desc' } | null>({ key: 'name', direction: 'asc' });
    const [searchTerm, setSearchTerm] = useState('');


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
        setFormErrors({}); // Clear form errors on modal open
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
        setFormErrors({}); // Clear form errors on modal close
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type, checked } = e.target as HTMLInputElement;
        const newValue = type === 'checkbox' ? checked : value;

        setFormData(prev => {
            const updatedFormData = { ...prev, [name]: newValue };
            // Validate on change to provide immediate feedback
            const errors = validateMetricForm(updatedFormData, metrics, editingMetric?.id || null);
            setFormErrors(errors); // Update form errors
            return updatedFormData;
        });
        setNotification(null); // Clear notification on input change
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setNotification(null);
        setError(null);

        const errors = validateMetricForm(formData, metrics, editingMetric?.id || null);
        setFormErrors(errors);

        if (Object.keys(errors).length > 0) {
            setIsSubmitting(false);
            return;
        }

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

    const sortedAndFilteredMetrics = useMemo(() => {
        let sortableItems = [...metrics];

        // Apply search filter first
        if (searchTerm.trim()) {
          const lowercasedTerm = searchTerm.toLowerCase();
          sortableItems = sortableItems.filter(metric =>
            metric.name.toLowerCase().includes(lowercasedTerm) ||
            metric.category.toLowerCase().includes(lowercasedTerm) ||
            metric.type.toLowerCase().includes(lowercasedTerm) ||
            metric.unitOfMeasure.toLowerCase().includes(lowercasedTerm)
          );
        }

        // Then apply sorting
        if (sortConfig !== null) {
            sortableItems.sort((a, b) => {
                const aValue = a[sortConfig.key]?.toString() || '';
                const bValue = b[sortConfig.key]?.toString() || '';

                if (aValue < bValue) {
                    return sortConfig.direction === 'asc' ? -1 : 1;
                }
                if (aValue > bValue) {
                    return sortConfig.direction === 'asc' ? 1 : -1;
                }
                return 0;
            });
        }
        return sortableItems;
    }, [metrics, sortConfig, searchTerm]);

    const requestSort = (key: keyof ProductMetric) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const SortableHeader: React.FC<{ columnKey: keyof ProductMetric; title: string }> = ({ columnKey, title }) => (
        <th 
            scope="col" 
            className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer" 
            onClick={() => requestSort(columnKey)}
            aria-sort={sortConfig?.key === columnKey ? (sortConfig.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
        >
            <div className="flex items-center space-x-1">
                <span>{title}</span>
                {sortConfig?.key === columnKey && (
                    sortConfig.direction === 'asc' ? <ChevronUpIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />
                )}
            </div>
        </th>
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100">{onClose ? '' : 'Product Metric'}</h2>
                <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                    <div className="relative w-full sm:w-auto">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                            <SearchIcon className="w-5 h-5 text-gray-400" />
                        </span>
                        <input
                            type="text"
                            placeholder="Search metrics..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full sm:w-56 pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                            aria-label="Search product metrics"
                        />
                    </div>
                    <button onClick={() => openModal()} className="btn btn-indigo flex items-center justify-center gap-2">
                        <PlusIcon className="w-5 h-5" /> Add New Metric
                    </button>
                </div>
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
                                    <SortableHeader columnKey="name" title="Metric Name" />
                                    <SortableHeader columnKey="category" title="Category" />
                                    <SortableHeader columnKey="type" title="Type" />
                                    <SortableHeader columnKey="unitOfMeasure" title="Unit of Measure" />
                                    <th className="th-style">Contributes to Goals</th>
                                    <th className="th-style">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                {sortedAndFilteredMetrics.length > 0 ? (
                                    sortedAndFilteredMetrics.map(metric => (
                                        <tr key={metric.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                            <td className="td-style font-medium">{metric.name}</td>
                                            <td className="td-style">{metric.category}</td>
                                            <td className="td-style">{metric.type}</td>
                                            <td className="td-style">{metric.unitOfMeasure || 'N/A'}</td>
                                            <td className="td-style">
                                                {metric.contributesToOverallGoals ? (
                                                    <CheckCircleIcon className="w-5 h-5 text-green-500" aria-label="Contributes to overall goals: Yes" />
                                                ) : (
                                                    <XIcon className="w-5 h-5 text-red-500" aria-label="Contributes to overall goals: No" />
                                                )}
                                            </td>
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
                                            {searchTerm ? `No matching metrics found for "${searchTerm}".` : 'No product metrics defined. Click "Add New Metric" to get started.'}
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
                                    <input 
                                        type="text" 
                                        name="name" 
                                        id="name" 
                                        value={formData.name} 
                                        onChange={handleInputChange} 
                                        required 
                                        className={`input-style w-full ${formErrors.name ? 'input-error' : ''}`} 
                                        aria-invalid={!!formErrors.name} 
                                        aria-describedby="name-error"
                                    />
                                    {formErrors.name && <p id="name-error" className="error-text">{formErrors.name}</p>}
                                </div>
                                <div>
                                    <label htmlFor="category" className="label-style">Category (e.g., DDS, FD)</label>
                                    <input 
                                        type="text" 
                                        name="category" 
                                        id="category" 
                                        value={formData.category} 
                                        onChange={handleInputChange} 
                                        required 
                                        className={`input-style w-full ${formErrors.category ? 'input-error' : ''}`} 
                                        aria-invalid={!!formErrors.category} 
                                        aria-describedby="category-error"
                                    />
                                    {formErrors.category && <p id="category-error" className="error-text">{formErrors.category}</p>}
                                </div>
                                <div>
                                    <label htmlFor="type" className="label-style">Type</label>
                                    <select 
                                        name="type" 
                                        id="type" 
                                        value={formData.type} 
                                        onChange={handleInputChange} 
                                        className={`input-style w-full ${formErrors.type ? 'input-error' : ''}`} 
                                        required 
                                        aria-invalid={!!formErrors.type} 
                                        aria-describedby="type-error"
                                    >
                                        <option value="Amount">Amount</option>
                                        <option value="Account">Account</option>
                                        <option value="Other">Other</option>
                                    </select>
                                    {formErrors.type && <p id="type-error" className="error-text">{formErrors.type}</p>}
                                </div>
                                <div>
                                    <label htmlFor="unitOfMeasure" className="label-style">Unit of Measure (e.g., INR, Units, %)</label>
                                    <input 
                                        type="text" 
                                        name="unitOfMeasure" 
                                        id="unitOfMeasure" 
                                        value={formData.unitOfMeasure} 
                                        onChange={handleInputChange} 
                                        className={`input-style w-full ${formErrors.unitOfMeasure ? 'input-error' : ''}`} 
                                        aria-invalid={!!formErrors.unitOfMeasure} 
                                        aria-describedby="unitOfMeasure-error"
                                    />
                                    {formErrors.unitOfMeasure && <p id="unitOfMeasure-error" className="error-text">{formErrors.unitOfMeasure}</p>}
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
                                <button type="submit" disabled={isSubmitting || Object.keys(formErrors).length > 0} className="btn-primary flex items-center gap-2">
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