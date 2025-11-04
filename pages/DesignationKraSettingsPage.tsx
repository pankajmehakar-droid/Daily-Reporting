import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { User, Designation, ProductMetric, DesignationKRA, DESIGNATIONS } from '../types';
import { getDesignationKras, saveDesignationKra, updateDesignationKra, removeDesignationKra, getProductMetrics } from '../services/dataService';
import { LoaderIcon, AlertTriangleIcon, EditIcon, XIcon, PlusIcon, TrashIcon, CheckCircleIcon, UsersIcon } from '../components/icons';

interface DesignationKraSettingsPageProps {
  currentUser: User;
}

const DesignationKraSettingsPage: React.FC<DesignationKraSettingsPageProps> = ({ currentUser }) => {
  // RBAC: Restrict this page to admin users only
  if (currentUser.role !== 'admin') {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100 mb-6">Designation KRA Setup</h2>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 text-center">
          <p className="text-red-500 dark:text-red-400 font-semibold">
            You do not have permission to view Designation KRA Setup.
          </p>
          <p className="text-gray-500 dark:text-gray-400 mt-2">
            This page is accessible only to Administrators.
          </p>
        </div>
      </div>
    );
  }

  const [designationKras, setDesignationKras] = useState<DesignationKRA[]>([]);
  const [productMetrics, setProductMetrics] = useState<ProductMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDesignationKra, setEditingDesignationKra] = useState<DesignationKRA | null>(null);
  const [formData, setFormData] = useState<{ designation: Designation | ''; selectedMetricIds: string[] }>({
    designation: '',
    selectedMetricIds: [],
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isMounted = useRef(false);

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
      const [dkras, metrics] = await Promise.all([
        getDesignationKras(),
        getProductMetrics(),
      ]);
      if (isMounted.current) {
        setDesignationKras(dkras);
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

  const openModal = (dkra: DesignationKRA | null = null) => {
    setError(null);
    setNotification(null);
    if (dkra) {
      setEditingDesignationKra(dkra);
      setFormData({
        designation: dkra.designation,
        selectedMetricIds: [...dkra.metricIds],
      });
    } else {
      setEditingDesignationKra(null);
      setFormData({
        designation: (DESIGNATIONS.find(d => !designationKras.some(dk => dk.designation === d)) || '') as Designation, // Pre-select first available designation
        selectedMetricIds: [],
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingDesignationKra(null);
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
      const payload: Omit<DesignationKRA, 'id'> = {
        designation: formData.designation,
        metricIds: formData.selectedMetricIds,
      };

      if (editingDesignationKra) {
        await updateDesignationKra(editingDesignationKra.id, payload);
        if (!isMounted.current) return;
        setNotification({ message: `KRA mapping for "${formData.designation}" updated successfully.`, type: 'success' });
      } else {
        await saveDesignationKra(payload);
        if (!isMounted.current) return;
        setNotification({ message: `KRA mapping for "${formData.designation}" created successfully.`, type: 'success' });
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

  const handleDelete = async (dkra: DesignationKRA) => {
    if (window.confirm(`Are you sure you want to delete the KRA mapping for "${dkra.designation}"? This action cannot be undone.`)) {
      try {
        setLoading(true); // Indicate loading while deleting
        setNotification(null);
        await removeDesignationKra(dkra.id);
        if (!isMounted.current) return;
        setNotification({ message: `KRA mapping for "${dkra.designation}" deleted successfully.`, type: 'success' });
        await fetchInitialData(); // Refresh data
      } catch (err) {
        if (isMounted.current) {
          setNotification({ message: err instanceof Error ? err.message : 'Failed to delete KRA mapping.', type: 'error' });
          setLoading(false); // Stop loading if error
        }
      }
    }
  };

  const getMetricNames = (metricIds: string[]) => {
    return metricIds.map(id => productMetrics.find(pm => pm.id === id)?.name || id).join(', ');
  };

  // Filter out designations that already have a KRA mapping
  const availableDesignations = useMemo(() => {
    const existingDesignations = new Set(designationKras.map(dkra => dkra.designation));
    return DESIGNATIONS.filter(d => !existingDesignations.has(d) || (editingDesignationKra && editingDesignationKra.designation === d));
  }, [designationKras, editingDesignationKra]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100">Designation KRA Setup</h2>
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
                  <th className="th-style">Applicable KRA Metrics</th>
                  <th className="th-style">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {designationKras.length > 0 ? (
                  designationKras.map(dkra => (
                    <tr key={dkra.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="td-style font-medium">{dkra.designation}</td>
                      <td className="td-style text-wrap max-w-lg">{getMetricNames(dkra.metricIds)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-center space-x-3">
                          <button onClick={() => openModal(dkra)} className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300" aria-label={`Edit KRA mapping for ${dkra.designation}`}><EditIcon className="w-5 h-5" /></button>
                          <button onClick={() => handleDelete(dkra)} className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300" aria-label={`Delete KRA mapping for ${dkra.designation}`}><TrashIcon className="w-5 h-5" /></button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="text-center py-10 text-gray-500 dark:text-gray-400">
                      No Designation KRA mappings defined.
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
              <h3 className="text-lg font-semibold dark:text-gray-100">{editingDesignationKra ? 'Edit Designation KRA Mapping' : 'Add New Designation KRA Mapping'}</h3>
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
                    disabled={!!editingDesignationKra} // Disable if editing an existing mapping
                  >
                    <option value="" disabled>-- Select a Designation --</option>
                    {availableDesignations.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
                <h4 className="text-md font-semibold text-gray-800 dark:text-gray-100 mt-6">Applicable KRA Metrics</h4>
                <div className="space-y-2 max-h-60 overflow-y-auto p-2 border border-gray-200 dark:border-gray-600 rounded-md">
                  {productMetrics.length > 0 ? (
                    productMetrics.map(metric => (
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

export default DesignationKraSettingsPage;