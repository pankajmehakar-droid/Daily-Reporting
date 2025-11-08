// NOTE: This file contains the ProductMappingPage component.
// It is used for mapping product metrics to designations.

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { User, Designation, ProductMetric, DesignationTarget, DESIGNATIONS } from '../types';
import { getDesignationTargets, saveDesignationTarget, updateDesignationTarget, removeDesignationTarget, getProductMetrics } from '../services/dataService';
import { LoaderIcon, AlertTriangleIcon, EditIcon, XIcon, PlusIcon, TrashIcon, CheckCircleIcon, UsersIcon } from '../components/icons';

interface ProductMappingPageProps {
  currentUser: User;
}

const ProductMappingPage: React.FC<ProductMappingPageProps> = ({ currentUser }) => {
  // RBAC: Restrict this page to admin users only
  if (currentUser.role !== 'admin') {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100 mb-6">Product Mapping</h2>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 text-center">
          <p className="text-red-500 dark:text-red-400 font-semibold">
            You do not have permission to view Product Mapping.
          </p>
          <p className="text-gray-500 dark:text-gray-400 mt-2">
            This page is accessible only to Administrators.
          </p>
        </div>
      </div>
    );
  }

  const [designationTargets, setDesignationTargets] = useState<DesignationTarget[]>([]);
  const [productMetrics, setProductMetrics] = useState<ProductMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDesignationTarget, setEditingDesignationTarget] = useState<DesignationTarget | null>(null);
  const [formData, setFormData] = useState<{ designation: Designation | ''; selectedMetricIds: string[] }>({
    designation: '',
    selectedMetricIds: [],
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isMounted = useRef(false);
  const selectAllCheckboxRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const fetchInitialData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [dtargets, metrics] = await Promise.all([
        getDesignationTargets(),
        getProductMetrics(),
      ]);
      if (isMounted.current) {
        setDesignationTargets(dtargets);
        setProductMetrics(metrics);
      }
    } catch (err) {
      if (isMounted.current) {
        setError(err instanceof Error ? err.message : 'Failed to fetch data.');
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  }, [isMounted]);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  const openModal = (dtarget: DesignationTarget | null = null) => {
    setError(null);
    setNotification(null);
    if (dtarget) {
      setEditingDesignationTarget(dtarget);
      setFormData({
        designation: dtarget.designation,
        selectedMetricIds: [...dtarget.metricIds],
      });
    } else {
      setEditingDesignationTarget(null);
      setFormData({
        designation: DESIGNATIONS[0], // Pre-select the first designation by default
        selectedMetricIds: [],
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingDesignationTarget(null);
    setFormData({ designation: '', selectedMetricIds: [] });
  };

  const handleDesignationChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFormData(prev => ({ ...prev, designation: e.target.value as Designation }));
  };

  const handleMetricToggle = (metricId: string) => {
    setFormData(prev => {
      const newMetricIds = prev.selectedMetricIds.includes(metricId)
        ? prev.selectedMetricIds.filter(id => id !== metricId)
        : [...prev.selectedMetricIds, metricId];
      return { ...prev, selectedMetricIds: newMetricIds };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setNotification(null);
    setError(null);

    if (!formData.designation) {
      setError('Please select a designation.');
      setIsSubmitting(false);
      return;
    }

    try {
      const payload: Omit<DesignationTarget, 'id'> = {
        designation: formData.designation,
        metricIds: formData.selectedMetricIds,
      };

      if (editingDesignationTarget) {
        await updateDesignationTarget(editingDesignationTarget.id, payload);
        if (!isMounted.current) return;
        setNotification({ message: `Product mapping for "${formData.designation}" updated successfully.`, type: 'success' });
      } else {
        await saveDesignationTarget(payload);
        if (!isMounted.current) return;
        setNotification({ message: `Product mapping for "${formData.designation}" created successfully.`, type: 'success' });
      }
      if (isMounted.current) {
        closeModal();
        await fetchInitialData(); // Refresh data
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

  const handleDelete = async (dtarget: DesignationTarget) => {
    if (window.confirm(`Are you sure you want to delete the product mapping for "${dtarget.designation}"? This action cannot be undone.`)) {
      try {
        setLoading(true); // Indicate loading while deleting
        setNotification(null);
        await removeDesignationTarget(dtarget.id);
        if (!isMounted.current) return;
        setNotification({ message: `Product mapping for "${dtarget.designation}" deleted successfully.`, type: 'success' });
        await fetchInitialData(); // Refresh data
      } catch (err) {
        if (isMounted.current) {
          setNotification({ message: err instanceof Error ? err.message : 'Failed to delete product mapping.', type: 'error' });
          setLoading(false); // Stop loading if error
        }
      }
    }
  };

  const getMetricNames = (metricIds: string[]) => {
    return metricIds.map(id => productMetrics.find(pm => pm.id === id)?.name || id).join(', ');
  };

  // Modified: Display all designations in the dropdown. Rely on backend validation for uniqueness.
  const allDesignations = useMemo(() => {
    return DESIGNATIONS;
  }, []);

  // Filtered metrics for display in the modal (excluding 'DDS Target')
  const filteredMetricsForModal = useMemo(() => {
    return productMetrics.filter(metric => metric.name !== 'DDS Target');
  }, [productMetrics]);

  // Logic for "Select All" checkbox
  const allVisibleMetricIds = useMemo(() => filteredMetricsForModal.map(metric => metric.id), [filteredMetricsForModal]);
  const isAllSelected = useMemo(() => {
      if (allVisibleMetricIds.length === 0) return false;
      return allVisibleMetricIds.every(id => formData.selectedMetricIds.includes(id));
  }, [allVisibleMetricIds, formData.selectedMetricIds]);

  const isIndeterminate = useMemo(() => {
      if (allVisibleMetricIds.length === 0) return false;
      const selectedCount = formData.selectedMetricIds.filter(id => allVisibleMetricIds.includes(id)).length;
      return selectedCount > 0 && selectedCount < allVisibleMetricIds.length;
  }, [allVisibleMetricIds, formData.selectedMetricIds]);

  const handleSelectAllMetrics = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.checked) {
          // Add all visible metrics to selectedMetricIds, preserving existing selections if any
          setFormData(prev => ({
              ...prev,
              selectedMetricIds: Array.from(new Set([...prev.selectedMetricIds, ...allVisibleMetricIds])),
          }));
      } else {
          // Remove all visible metrics from selectedMetricIds
          setFormData(prev => ({
              ...prev,
              selectedMetricIds: prev.selectedMetricIds.filter(id => !allVisibleMetricIds.includes(id)),
          }));
      }
  };

  // Set indeterminate state on the actual checkbox element
  useEffect(() => {
      if (selectAllCheckboxRef.current) {
          selectAllCheckboxRef.current.indeterminate = isIndeterminate;
      }
  }, [isIndeterminate]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100">Product Mapping</h2>
        <button onClick={() => openModal()} className="btn btn-indigo flex items-center gap-2">
          <PlusIcon className="w-5 h-5" /> Add New Mapping
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
                  <th className="th-style">Designation</th>
                  <th className="th-style">Applicable Product Metrics</th>
                  <th className="th-style">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {designationTargets.length > 0 ? (
                  designationTargets.map(dtarget => (
                    <tr key={dtarget.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="td-style font-medium">{dtarget.designation}</td>
                      <td className="td-style text-wrap max-w-lg">{getMetricNames(dtarget.metricIds)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-center space-x-3">
                          <button onClick={() => openModal(dtarget)} className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300" aria-label={`Edit product mapping for ${dtarget.designation}`}><EditIcon className="w-5 h-5" /></button>
                          <button onClick={() => handleDelete(dtarget)} className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300" aria-label={`Delete product mapping for ${dtarget.designation}`}><TrashIcon className="w-5 h-5" /></button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="text-center py-10 text-gray-500 dark:text-gray-400">
                      No product mappings defined.
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
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center p-4 border-b dark:border-gray-700">
              <h3 className="text-lg font-semibold dark:text-gray-100">{editingDesignationTarget ? 'Edit Product Mapping' : 'Add New Product Mapping'}</h3>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" aria-label="Close modal"><XIcon className="w-6 h-6" /></button>
            </div>
            <form onSubmit={handleSubmit} className="flex-grow flex flex-col overflow-hidden">
              <div className="p-6 space-y-4 overflow-y-auto">
                {error && <div className="p-3 bg-red-100 text-red-700 rounded-md text-sm" role="alert">{error}</div>}
                <div>
                  <label htmlFor="designation" className="label-style">Designation</label>
                  <select
                    id="designation"
                    name="designation"
                    value={formData.designation}
                    onChange={handleDesignationChange}
                    required
                    className="input-style w-full"
                    disabled={!!editingDesignationTarget} // Disable if editing an existing mapping
                  >
                    <option value="" disabled>-- Select a Designation --</option>
                    {allDesignations.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
                <h4 className="text-md font-semibold text-gray-800 dark:text-gray-100 mt-6">Applicable Product Metrics</h4>
                <div className="space-y-2 max-h-60 overflow-y-auto p-2 border border-gray-200 dark:border-gray-600 rounded-md">
                  {/* Select All Checkbox */}
                  {filteredMetricsForModal.length > 0 && (
                      <div className="flex items-center pb-2 border-b border-gray-200 dark:border-gray-600 mb-2">
                          <input
                              type="checkbox"
                              id="select-all-metrics"
                              checked={isAllSelected}
                              onChange={handleSelectAllMetrics}
                              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded dark:bg-gray-700 dark:border-gray-600"
                              ref={selectAllCheckboxRef}
                          />
                          <label htmlFor="select-all-metrics" className="ml-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
                              Select All
                          </label>
                      </div>
                  )}

                  {filteredMetricsForModal.length > 0 ? (
                    filteredMetricsForModal.map(metric => (
                      <div key={metric.id} className="flex items-center">
                        <input
                          type="checkbox"
                          id={`metric-${metric.id}`}
                          checked={formData.selectedMetricIds.includes(metric.id)}
                          onChange={() => handleMetricToggle(metric.id)}
                          className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded dark:bg-gray-700 dark:border-gray-600"
                        />
                        <label htmlFor={`metric-${metric.id}`} className="ml-2 text-sm text-gray-900 dark:text-gray-100">
                          {metric.name} ({metric.category}, {metric.type})
                        </label>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400">No product metrics defined. Please add them in "Product Settings".</p>
                  )}
                </div>
              </div>
              <div className="flex justify-end gap-3 p-4 bg-gray-50 dark:bg-gray-800/50 border-t dark:border-gray-700 flex-shrink-0">
                <button type="button" onClick={closeModal} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={isSubmitting || !formData.designation} className="btn-primary flex items-center gap-2">
                  {isSubmitting && <LoaderIcon className="w-4 h-4" />}
                  {isSubmitting ? 'Saving...' : 'Save Mapping'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductMappingPage;