import React, { useState, useEffect, useCallback, useRef } from 'react';
import { User, Zone, Region, District } from '../types';
import { 
  getZones, addZone, updateZone, removeZone,
  getRegions, addRegion, updateRegion, removeRegion,
  getDistricts, addDistrict, updateDistrict, removeDistrict 
} from '../services/dataService';
import { OfficeBuildingIcon, LoaderIcon, AlertTriangleIcon, EditIcon, XIcon, PlusIcon, TrashIcon, CheckCircleIcon } from '../components/icons';

const OrganizationManagementPage: React.FC<{ currentUser: User }> = ({ currentUser }) => {
  const [activeTab, setActiveTab] = useState<'zones' | 'regions' | 'districts'>('zones');
  
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);

  // --- Zones State ---
  const [zones, setZones] = useState<Zone[]>([]);
  const [zonesLoading, setZonesLoading] = useState(true);
  const [isZoneModalOpen, setIsZoneModalOpen] = useState(false);
  const [editingZone, setEditingZone] = useState<Zone | null>(null);
  const [zoneFormData, setZoneFormData] = useState<{ name: string }>({ name: '' });
  const [zoneToDelete, setZoneToDelete] = useState<Zone | null>(null);

  // --- Regions State ---
  const [regions, setRegions] = useState<Region[]>([]);
  const [regionsLoading, setRegionsLoading] = useState(true);
  const [isRegionModalOpen, setIsRegionModalOpen] = useState(false);
  const [editingRegion, setEditingRegion] = useState<Region | null>(null);
  const [regionFormData, setRegionFormData] = useState<{ name: string; zoneId: string }>({ name: '', zoneId: '' });
  const [regionToDelete, setRegionToDelete] = useState<Region | null>(null);

  // --- Districts State ---
  const [districts, setDistricts] = useState<District[]>([]);
  const [districtsLoading, setDistrictsLoading] = useState(true);
  const [isDistrictModalOpen, setIsDistrictModalOpen] = useState(false);
  const [editingDistrict, setEditingDistrict] = useState<District | null>(null);
  const [districtFormData, setDistrictFormData] = useState<{ name: string; regionId: string }>({ name: '', regionId: '' });
  const [districtToDelete, setDistrictToDelete] = useState<District | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const isMounted = useRef(false);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  const fetchAllData = useCallback(async () => {
    setZonesLoading(true);
    setRegionsLoading(true);
    setDistrictsLoading(true);
    try {
      const [zonesData, regionsData, districtsData] = await Promise.all([getZones(), getRegions(), getDistricts()]);
      if (isMounted.current) {
        setZones(zonesData);
        setRegions(regionsData);
        setDistricts(districtsData);
      }
    } catch (err) {
      if (isMounted.current) {
        setNotification({ message: 'Failed to fetch organization data.', type: 'error' });
      }
    } finally {
      if (isMounted.current) {
        setZonesLoading(false);
        setRegionsLoading(false);
        setDistrictsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // --- Handlers for Zones ---
  const openZoneModal = (zone: Zone | null = null) => {
    setModalError(null);
    setEditingZone(zone);
    setZoneFormData(zone ? { name: zone.name } : { name: '' });
    setIsZoneModalOpen(true);
  };
  const handleZoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!zoneFormData.name.trim()) { setModalError('Zone name is required.'); return; }
    setIsSubmitting(true); setNotification(null); setModalError(null);
    try {
      if (editingZone) {
        await updateZone(editingZone.id, zoneFormData);
        setNotification({ message: `Zone "${zoneFormData.name}" updated.`, type: 'success' });
      } else {
        await addZone(zoneFormData);
        setNotification({ message: `Zone "${zoneFormData.name}" added.`, type: 'success' });
      }
      setIsZoneModalOpen(false);
      await fetchAllData();
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'An error occurred.');
    } finally {
      if (isMounted.current) setIsSubmitting(false);
    }
  };
  const handleZoneDelete = async () => {
    if (!zoneToDelete) return;
    setIsSubmitting(true); setNotification(null);
    try {
      await removeZone(zoneToDelete.id);
      setNotification({ message: `Zone "${zoneToDelete.name}" deleted.`, type: 'success' });
      await fetchAllData();
    } catch (err) {
      setNotification({ message: err instanceof Error ? err.message : 'Failed to delete.', type: 'error' });
    } finally {
      if (isMounted.current) {
        setIsSubmitting(false);
        setZoneToDelete(null);
      }
    }
  };

  // --- Handlers for Regions ---
  const openRegionModal = (region: Region | null = null) => {
    setModalError(null);
    setEditingRegion(region);
    setRegionFormData(region ? { name: region.name, zoneId: region.zoneId || '' } : { name: '', zoneId: zones[0]?.id || '' });
    setIsRegionModalOpen(true);
  };
  const handleRegionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regionFormData.name.trim()) { setModalError('Region name is required.'); return; }
    if (!regionFormData.zoneId) { setModalError('Zone must be selected.'); return; }
    setIsSubmitting(true); setNotification(null); setModalError(null);
    try {
      if (editingRegion) {
        await updateRegion(editingRegion.id, regionFormData);
        setNotification({ message: `Region "${regionFormData.name}" updated.`, type: 'success' });
      } else {
        await addRegion(regionFormData);
        setNotification({ message: `Region "${regionFormData.name}" added.`, type: 'success' });
      }
      setIsRegionModalOpen(false);
      await fetchAllData();
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'An error occurred.');
    } finally {
        if (isMounted.current) setIsSubmitting(false);
    }
  };
  const handleRegionDelete = async () => {
    if (!regionToDelete) return;
    setIsSubmitting(true); setNotification(null);
    try {
      await removeRegion(regionToDelete.id);
      setNotification({ message: `Region "${regionToDelete.name}" deleted.`, type: 'success' });
      await fetchAllData();
    } catch (err) {
      setNotification({ message: err instanceof Error ? err.message : 'Failed to delete.', type: 'error' });
    } finally {
      if (isMounted.current) {
        setIsSubmitting(false);
        setRegionToDelete(null);
      }
    }
  };

  // --- Handlers for Districts ---
  const openDistrictModal = (district: District | null = null) => {
    setModalError(null);
    setEditingDistrict(district);
    setDistrictFormData(district ? { name: district.name, regionId: district.regionId || '' } : { name: '', regionId: regions[0]?.id || '' });
    setIsDistrictModalOpen(true);
  };
  const handleDistrictSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!districtFormData.name.trim()) { setModalError('District name is required.'); return; }
    if (!districtFormData.regionId) { setModalError('Region must be selected.'); return; }
    setIsSubmitting(true); setNotification(null); setModalError(null);
    try {
      if (editingDistrict) {
        await updateDistrict(editingDistrict.id, districtFormData);
        setNotification({ message: `District "${districtFormData.name}" updated.`, type: 'success' });
      } else {
        await addDistrict(districtFormData);
        setNotification({ message: `District "${districtFormData.name}" added.`, type: 'success' });
      }
      setIsDistrictModalOpen(false);
      await fetchAllData();
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'An error occurred.');
    } finally {
      if (isMounted.current) setIsSubmitting(false);
    }
  };
  const handleDistrictDelete = async () => {
    if (!districtToDelete) return;
    setIsSubmitting(true); setNotification(null);
    try {
      await removeDistrict(districtToDelete.id);
      setNotification({ message: `District "${districtToDelete.name}" deleted.`, type: 'success' });
      await fetchAllData();
    } catch (err) {
      setNotification({ message: err instanceof Error ? err.message : 'Failed to delete.', type: 'error' });
    } finally {
      if (isMounted.current) {
        setIsSubmitting(false);
        setDistrictToDelete(null);
      }
    }
  };

  const isAdmin = currentUser.role === 'admin';

  const renderContent = () => {
    // Helper to get parent names
    const getZoneName = (zoneId: string | undefined) => zones.find(z => z.id === zoneId)?.name || 'N/A';
    const getRegionName = (regionId: string | undefined) => regions.find(r => r.id === regionId)?.name || 'N/A';
    
    switch (activeTab) {
      case 'zones':
        return (
          <div>
            <div className="flex justify-end mb-4">
              <button onClick={() => openZoneModal()} className="btn btn-indigo flex items-center gap-2">
                <PlusIcon className="w-5 h-5" /> Add New Zone
              </button>
            </div>
            {zonesLoading ? <div className="flex justify-center py-10"><LoaderIcon /></div> : (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th className="th-style">Zone Name</th>
                        <th className="th-style">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {zones.length > 0 ? zones.map(zone => (
                        <tr key={zone.id}>
                          <td className="td-style font-medium">{zone.name}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <div className="flex items-center space-x-3">
                              <button onClick={() => openZoneModal(zone)} className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300" aria-label={`Edit ${zone.name}`}><EditIcon className="w-5 h-5" /></button>
                              <button onClick={() => setZoneToDelete(zone)} className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300" aria-label={`Delete ${zone.name}`}><TrashIcon className="w-5 h-5" /></button>
                            </div>
                          </td>
                        </tr>
                      )) : (
                        <tr><td colSpan={2} className="text-center py-10 text-gray-500 dark:text-gray-400">No zones found.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        );
      case 'regions':
        return (
          <div>
            <div className="flex justify-end mb-4">
              <button onClick={() => openRegionModal()} className="btn btn-indigo flex items-center gap-2" disabled={zones.length === 0}>
                <PlusIcon className="w-5 h-5" /> Add New Region
              </button>
            </div>
            {regionsLoading ? <div className="flex justify-center py-10"><LoaderIcon /></div> : (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th className="th-style">Region Name</th>
                        <th className="th-style">Assigned Zone</th>
                        <th className="th-style">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {regions.length > 0 ? regions.map(region => (
                        <tr key={region.id}>
                          <td className="td-style font-medium">{region.name}</td>
                          <td className="td-style">{getZoneName(region.zoneId)}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <div className="flex items-center space-x-3">
                              <button onClick={() => openRegionModal(region)} className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300"><EditIcon className="w-5 h-5" /></button>
                              <button onClick={() => setRegionToDelete(region)} className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"><TrashIcon className="w-5 h-5" /></button>
                            </div>
                          </td>
                        </tr>
                      )) : (
                        <tr><td colSpan={3} className="text-center py-10 text-gray-500 dark:text-gray-400">No regions found.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        );
      case 'districts':
        return (
          <div>
            <div className="flex justify-end mb-4">
              <button onClick={() => openDistrictModal()} className="btn btn-indigo flex items-center gap-2" disabled={regions.length === 0}>
                <PlusIcon className="w-5 h-5" /> Add New District
              </button>
            </div>
            {districtsLoading ? <div className="flex justify-center py-10"><LoaderIcon /></div> : (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th className="th-style">District Name</th>
                        <th className="th-style">Assigned Region</th>
                        <th className="th-style">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {districts.length > 0 ? districts.map(district => (
                        <tr key={district.id}>
                          <td className="td-style font-medium">{district.name}</td>
                          <td className="td-style">{getRegionName(district.regionId)}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <div className="flex items-center space-x-3">
                              <button onClick={() => openDistrictModal(district)} className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300"><EditIcon className="w-5 h-5" /></button>
                              <button onClick={() => setDistrictToDelete(district)} className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"><TrashIcon className="w-5 h-5" /></button>
                            </div>
                          </td>
                        </tr>
                      )) : (
                        <tr><td colSpan={3} className="text-center py-10 text-gray-500 dark:text-gray-400">No districts found.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100">Organization Management</h2>

      {notification && (
        <div className={`p-4 rounded-md flex items-start space-x-3 border-l-4 ${notification.type === 'success' ? 'bg-green-100 dark:bg-green-900/30 border-green-500 text-green-700 dark:text-green-300' : 'bg-red-100 dark:bg-red-900/30 border-red-500 text-red-700 dark:text-red-300'}`} role="alert">
          {notification.type === 'success' ? <CheckCircleIcon className="w-6 h-6 flex-shrink-0" /> : <AlertTriangleIcon className="w-6 h-6 flex-shrink-0" />}
          <div><p className="font-bold">{notification.type === 'success' ? 'Success' : 'Error'}</p><p>{notification.message}</p></div>
        </div>
      )}
      
      {/* Tab Navigation */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          <button
            onClick={() => setActiveTab('zones')}
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'zones' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:border-gray-600'}`}
          >
            Zones
          </button>
          <button
            onClick={() => setActiveTab('regions')}
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'regions' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:border-gray-600'}`}
          >
            Regions
          </button>
          <button
            onClick={() => setActiveTab('districts')}
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'districts' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:border-gray-600'}`}
          >
            Districts
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {renderContent()}
      </div>

      {/* Zone Modal */}
      {isZoneModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg">
            <div className="flex justify-between items-center p-4 border-b dark:border-gray-700">
              <h3 className="text-lg font-semibold dark:text-gray-100">{editingZone ? 'Edit Zone' : 'Add New Zone'}</h3>
              <button onClick={() => setIsZoneModalOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"><XIcon className="w-6 h-6" /></button>
            </div>
            <form onSubmit={handleZoneSubmit}>
              <div className="p-6 space-y-4">
                {modalError && <div className="p-3 bg-red-100 text-red-700 rounded-md text-sm" role="alert">{modalError}</div>}
                <div>
                  <label htmlFor="name" className="label-style">Zone Name</label>
                  <input type="text" name="name" id="name" value={zoneFormData.name} onChange={(e) => setZoneFormData({name: e.target.value})} required className="input-style w-full" />
                </div>
              </div>
              <div className="flex justify-end gap-3 p-4 bg-gray-50 dark:bg-gray-800/50 border-t dark:border-gray-700">
                <button type="button" onClick={() => setIsZoneModalOpen(false)} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="btn-primary flex items-center gap-2">
                  {isSubmitting && <LoaderIcon className="w-4 h-4" />} {isSubmitting ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* Region Modal */}
      {isRegionModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg">
            <div className="flex justify-between items-center p-4 border-b dark:border-gray-700">
              <h3 className="text-lg font-semibold dark:text-gray-100">{editingRegion ? 'Edit Region' : 'Add New Region'}</h3>
              <button onClick={() => setIsRegionModalOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"><XIcon className="w-6 h-6" /></button>
            </div>
            <form onSubmit={handleRegionSubmit}>
              <div className="p-6 space-y-4">
                {modalError && <div className="p-3 bg-red-100 text-red-700 rounded-md text-sm" role="alert">{modalError}</div>}
                <div>
                  <label htmlFor="name" className="label-style">Region Name</label>
                  <input type="text" name="name" id="name" value={regionFormData.name} onChange={(e) => setRegionFormData(prev => ({ ...prev, name: e.target.value}))} required className="input-style w-full" />
                </div>
                <div>
                  <label htmlFor="zoneId" className="label-style">Assign to Zone</label>
                  <select name="zoneId" id="zoneId" value={regionFormData.zoneId} onChange={(e) => setRegionFormData(prev => ({ ...prev, zoneId: e.target.value}))} required className="input-style w-full">
                    <option value="" disabled>-- Select a Zone --</option>
                    {zones.map(zone => <option key={zone.id} value={zone.id}>{zone.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-3 p-4 bg-gray-50 dark:bg-gray-800/50 border-t dark:border-gray-700">
                <button type="button" onClick={() => setIsRegionModalOpen(false)} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="btn-primary flex items-center gap-2">
                  {isSubmitting && <LoaderIcon className="w-4 h-4" />} {isSubmitting ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* District Modal */}
      {isDistrictModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg">
            <div className="flex justify-between items-center p-4 border-b dark:border-gray-700">
              <h3 className="text-lg font-semibold dark:text-gray-100">{editingDistrict ? 'Edit District' : 'Add New District'}</h3>
              <button onClick={() => setIsDistrictModalOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"><XIcon className="w-6 h-6" /></button>
            </div>
            <form onSubmit={handleDistrictSubmit}>
              <div className="p-6 space-y-4">
                {modalError && <div className="p-3 bg-red-100 text-red-700 rounded-md text-sm" role="alert">{modalError}</div>}
                <div>
                  <label htmlFor="name" className="label-style">District Name</label>
                  <input type="text" name="name" id="name" value={districtFormData.name} onChange={(e) => setDistrictFormData(prev => ({...prev, name: e.target.value}))} required className="input-style w-full" />
                </div>
                <div>
                  <label htmlFor="regionId" className="label-style">Assign to Region</label>
                  <select name="regionId" id="regionId" value={districtFormData.regionId} onChange={(e) => setDistrictFormData(prev => ({...prev, regionId: e.target.value}))} required className="input-style w-full">
                    <option value="" disabled>-- Select a Region --</option>
                    {regions.map(region => <option key={region.id} value={region.id}>{region.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-3 p-4 bg-gray-50 dark:bg-gray-800/50 border-t dark:border-gray-700">
                <button type="button" onClick={() => setIsDistrictModalOpen(false)} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="btn-primary flex items-center gap-2">
                  {isSubmitting && <LoaderIcon className="w-4 h-4" />} {isSubmitting ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Deletion Modals */}
      {(zoneToDelete || regionToDelete || districtToDelete) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md">
            <div className="p-6 text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/30">
                <AlertTriangleIcon className="h-6 w-6 text-red-600 dark:text-red-400" aria-hidden="true" />
              </div>
              <h3 className="mt-5 text-lg font-medium text-gray-900 dark:text-gray-100">
                Delete {zoneToDelete ? 'Zone' : regionToDelete ? 'Region' : 'District'}
              </h3>
              <div className="mt-2">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Are you sure you want to delete <strong>{zoneToDelete?.name || regionToDelete?.name || districtToDelete?.name}</strong>? This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex justify-center items-center gap-3 p-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-700">
              <button type="button" onClick={() => { setZoneToDelete(null); setRegionToDelete(null); setDistrictToDelete(null); }} className="btn-secondary" disabled={isSubmitting}>Cancel</button>
              <button type="button" onClick={zoneToDelete ? handleZoneDelete : regionToDelete ? handleRegionDelete : handleDistrictDelete} className="btn-danger flex items-center gap-2" disabled={isSubmitting}>
                {isSubmitting && <LoaderIcon className="w-4 h-4" />}Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrganizationManagementPage;