import React, { useState, useEffect, useCallback, useRef } from 'react';
import { User, Zone } from '../types';
import { getZones, addZone, updateZone, removeZone } from '../services/dataService';
import { OfficeBuildingIcon, LoaderIcon, AlertTriangleIcon, EditIcon, XIcon, PlusIcon, TrashIcon, CheckCircleIcon } from '../components/icons';

interface ZoneManagementPageProps {
  currentUser: User;
}

const ZoneManagementPage: React.FC<ZoneManagementPageProps> = ({ currentUser }) => {
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingZone, setEditingZone] = useState<Zone | null>(null);
  const [formData, setFormData] = useState<{ name: string }>({ name: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [zoneToDelete, setZoneToDelete] = useState<Zone | null>(null);

  const isMounted = useRef(false);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const fetchZones = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getZones();
      if (isMounted.current) {
        setZones(data);
      }
    } catch (err) {
      if (isMounted.current) {
        setError(err instanceof Error ? err.message : 'Failed to fetch zones.');
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  }, [isMounted]);

  useEffect(() => {
    fetchZones();
  }, [fetchZones]);

  const openModal = (zone: Zone | null = null) => {
    setError(null);
    setNotification(null);
    if (zone) {
      setEditingZone(zone);
      setFormData({ name: zone.name });
    } else {
      setEditingZone(null);
      setFormData({ name: '' });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingZone(null);
    setFormData({ name: '' });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ name: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setNotification(null);
    setError(null);

    if (!formData.name.trim()) {
      setError('Zone name is required.');
      setIsSubmitting(false);
      return;
    }

    try {
      if (editingZone) {
        await updateZone(editingZone.id, formData);
        if (!isMounted.current) return;
        setNotification({ message: `Zone "${formData.name}" updated successfully.`, type: 'success' });
      } else {
        await addZone(formData);
        if (!isMounted.current) return;
        setNotification({ message: `Zone "${formData.name}" added successfully.`, type: 'success' });
      }
      if (isMounted.current) {
        closeModal();
        await fetchZones();
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

  const handleDelete = async () => {
    if (!zoneToDelete) return;
    setIsSubmitting(true);
    setNotification(null);
    try {
      await removeZone(zoneToDelete.id);
      if (!isMounted.current) return;
      setNotification({ message: `Zone "${zoneToDelete.name}" deleted successfully.`, type: 'success' });
      await fetchZones();
    } catch (err) {
      if (isMounted.current) {
        setNotification({ message: err instanceof Error ? err.message : 'Failed to delete zone.', type: 'error' });
      }
    } finally {
      if (isMounted.current) {
        setIsSubmitting(false);
        setZoneToDelete(null);
      }
    }
  };

  const isAdmin = currentUser.role === 'admin';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
          <OfficeBuildingIcon className="w-7 h-7" /> Zone Management
        </h2>
        {isAdmin && (
          <button onClick={() => openModal()} className="btn btn-indigo flex items-center gap-2">
            <PlusIcon className="w-5 h-5" /> Add New Zone
          </button>
        )}
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
        <div className="flex justify-center items-center py-20"><LoaderIcon className="w-8 h-8 text-indigo-500" /></div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="th-style">Zone Name</th>
                  {isAdmin && <th className="th-style">Actions</th>}
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {zones.length > 0 ? zones.map(zone => (
                  <tr key={zone.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="td-style font-medium">{zone.name}</td>
                    {isAdmin && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-center space-x-3">
                          <button onClick={() => openModal(zone)} className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300" aria-label={`Edit ${zone.name}`}><EditIcon className="w-5 h-5" /></button>
                          <button onClick={() => setZoneToDelete(zone)} className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300" aria-label={`Delete ${zone.name}`}><TrashIcon className="w-5 h-5" /></button>
                        </div>
                      </td>
                    )}
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={isAdmin ? 2 : 1} className="text-center py-10 text-gray-500 dark:text-gray-400">
                      No zones found.
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
              <h3 className="text-lg font-semibold dark:text-gray-100">{editingZone ? 'Edit Zone' : 'Add New Zone'}</h3>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" aria-label="Close modal"><XIcon className="w-6 h-6" /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="p-6 space-y-4">
                {error && <div className="p-3 bg-red-100 text-red-700 rounded-md text-sm" role="alert">{error}</div>}
                <div>
                  <label htmlFor="name" className="label-style">Zone Name</label>
                  <input type="text" name="name" id="name" value={formData.name} onChange={handleInputChange} required className="input-style w-full" />
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

      {zoneToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" aria-modal="true" role="dialog">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md">
                <div className="p-6 text-center">
                    <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/30">
                        <AlertTriangleIcon className="h-6 w-6 text-red-600 dark:text-red-400" aria-hidden="true" />
                    </div>
                    <h3 className="mt-5 text-lg font-medium text-gray-900 dark:text-gray-100">Delete Zone</h3>
                    <div className="mt-2">
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Are you sure you want to delete <strong>{zoneToDelete.name}</strong>? This action cannot be undone.
                        </p>
                    </div>
                </div>
                <div className="flex justify-center items-center gap-3 p-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-700">
                    <button type="button" onClick={() => setZoneToDelete(null)} className="btn btn-secondary" disabled={isSubmitting}>Cancel</button>
                    <button type="button" onClick={handleDelete} className="btn btn-danger flex items-center gap-2" disabled={isSubmitting}>
                        {isSubmitting && <LoaderIcon className="w-4 h-4" />}Delete
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default ZoneManagementPage;