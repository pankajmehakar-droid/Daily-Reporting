import React, { useState, useEffect, useCallback, useRef } from 'react';
import { User, District, Region, Zone } from '../types';
import { getDistricts, getRegions, getZones, addDistrict, updateDistrict, removeDistrict } from '../services/dataService';
import { OfficeBuildingIcon, LoaderIcon, AlertTriangleIcon, EditIcon, XIcon, PlusIcon, TrashIcon, CheckCircleIcon } from '../components/icons';

interface DistrictManagementPageProps {
  currentUser: User;
}

const DistrictManagementPage: React.FC<DistrictManagementPageProps> = ({ currentUser }) => {
  const [districts, setDistricts] = useState<District[]>([]);
  const [allRegions, setAllRegions] = useState<Region[]>([]);
  const [allZones, setAllZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDistrict, setEditingDistrict] = useState<District | null>(null);
  const [formData, setFormData] = useState<{ name: string; regionId: string }>({ name: '', regionId: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [districtToDelete, setDistrictToDelete] = useState<District | null>(null);

  const isMounted = useRef(false);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const fetchInitialData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [districtsData, regionsData, zonesData] = await Promise.all([getDistricts(), getRegions(), getZones()]);
      if (isMounted.current) {
        setDistricts(districtsData);
        setAllRegions(regionsData);
        setAllZones(zonesData);
      }
    } catch (err) {
      if (isMounted.current) {
        setError(err instanceof Error ? err.message : 'Failed to fetch initial data.');
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

  const openModal = (district: District | null = null) => {
    setError(null);
    setNotification(null);
    if (district) {
      setEditingDistrict(district);
      setFormData({ name: district.name, regionId: district.regionId || '' });
    } else {
      setEditingDistrict(null);
      setFormData({ name: '', regionId: allRegions[0]?.id || '' });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingDistrict(null);
    setFormData({ name: '', regionId: '' });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setNotification(null);
    setError(null);

    if (!formData.name.trim()) {
      setError('District name is required.');
      setIsSubmitting(false);
      return;
    }
    if (!formData.regionId) {
      setError('A region must be selected.');
      setIsSubmitting(false);
      return;
    }

    try {
      if (editingDistrict) {
        await updateDistrict(editingDistrict.id, formData);
        if (!isMounted.current) return;
        setNotification({ message: `District "${formData.name}" updated successfully.`, type: 'success' });
      } else {
        await addDistrict(formData);
        if (!isMounted.current) return;
        setNotification({ message: `District "${formData.name}" added successfully.`, type: 'success' });
      }
      if (isMounted.current) {
        closeModal();
        await fetchInitialData();
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
    if (!districtToDelete) return;
    setIsSubmitting(true);
    setNotification(null);
    try {
      await removeDistrict(districtToDelete.id);
      if (!isMounted.current) return;
      setNotification({ message: `District "${districtToDelete.name}" deleted successfully.`, type: 'success' });
      await fetchInitialData();
    } catch (err) {
      if (isMounted.current) {
        setNotification({ message: err instanceof Error ? err.message : 'Failed to delete district.', type: 'error' });
      }
    } finally {
      if (isMounted.current) {
        setIsSubmitting(false);
        setDistrictToDelete(null);
      }
    }
  };

  const isAdmin = currentUser.role === 'admin';
  const getRegionInfo = (regionId: string | undefined) => {
      const region = allRegions.find(r => r.id === regionId);
      if (!region) return { regionName: 'N/A', zoneName: 'N/A' };
      const zone = allZones.find(z => z.id === region.zoneId);
      return {
          regionName: region.name,
          zoneName: zone?.name || 'N/A'
      };
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
          <OfficeBuildingIcon className="w-7 h-7" /> District Management
        </h2>
        {isAdmin && (
          <button onClick={() => openModal()} className="btn btn-indigo flex items-center gap-2" disabled={allRegions.length === 0}>
            <PlusIcon className="w-5 h-5" /> Add New District
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
      {allRegions.length === 0 && isAdmin && (
         <div className="bg-yellow-100 dark:bg-yellow-900/30 border-l-4 border-yellow-500 text-yellow-700 dark:text-yellow-300 p-4 rounded-md" role="alert">
          <p>You must add at least one Region before you can add a District.</p>
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
                  <th className="th-style">District Name</th>
                  <th className="th-style">Assigned Region</th>
                  <th className="th-style">Assigned Zone</th>
                  {isAdmin && <th className="th-style">Actions</th>}
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {districts.length > 0 ? districts.map(district => {
                    const { regionName, zoneName } = getRegionInfo(district.regionId);
                    return (
                        <tr key={district.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                            <td className="td-style font-medium">{district.name}</td>
                            <td className="td-style">{regionName}</td>
                            <td className="td-style">{zoneName}</td>
                            {isAdmin && (
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                <div className="flex items-center space-x-3">
                                <button onClick={() => openModal(district)} className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300" aria-label={`Edit ${district.name}`}><EditIcon className="w-5 h-5" /></button>
                                <button onClick={() => setDistrictToDelete(district)} className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300" aria-label={`Delete ${district.name}`}><TrashIcon className="w-5 h-5" /></button>
                                </div>
                            </td>
                            )}
                        </tr>
                    );
                }) : (
                  <tr>
                    <td colSpan={isAdmin ? 4 : 3} className="text-center py-10 text-gray-500 dark:text-gray-400">
                      No districts found.
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
              <h3 className="text-lg font-semibold dark:text-gray-100">{editingDistrict ? 'Edit District' : 'Add New District'}</h3>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" aria-label="Close modal"><XIcon className="w-6 h-6" /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="p-6 space-y-4">
                {error && <div className="p-3 bg-red-100 text-red-700 rounded-md text-sm" role="alert">{error}</div>}
                <div>
                  <label htmlFor="name" className="label-style">District Name</label>
                  <input type="text" name="name" id="name" value={formData.name} onChange={handleInputChange} required className="input-style w-full" />
                </div>
                <div>
                  <label htmlFor="regionId" className="label-style">Assign to Region</label>
                  <select name="regionId" id="regionId" value={formData.regionId} onChange={handleInputChange} required className="input-style w-full">
                    <option value="" disabled>-- Select a Region --</option>
                    {allRegions.map(region => {
                        const zoneName = getRegionInfo(region.id).zoneName;
                        return (
                            <option key={region.id} value={region.id}>{region.name} ({zoneName})</option>
                        );
                    })}
                  </select>
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

      {districtToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" aria-modal="true" role="dialog">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md">
                <div className="p-6 text-center">
                    <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/30">
                        <AlertTriangleIcon className="h-6 w-6 text-red-600 dark:text-red-400" aria-hidden="true" />
                    </div>
                    <h3 className="mt-5 text-lg font-medium text-gray-900 dark:text-gray-100">Delete District</h3>
                    <div className="mt-2">
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Are you sure you want to delete <strong>{districtToDelete.name}</strong>? This action cannot be undone.
                        </p>
                    </div>
                </div>
                <div className="flex justify-center items-center gap-3 p-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-700">
                    <button type="button" onClick={() => setDistrictToDelete(null)} className="btn btn-secondary" disabled={isSubmitting}>Cancel</button>
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

export default DistrictManagementPage;