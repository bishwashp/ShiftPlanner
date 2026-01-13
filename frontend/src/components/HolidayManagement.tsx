import React, { useState, useEffect } from 'react';
import { LoadingSpinner } from './ui/LoadingSpinner';
import { Plus, CalendarBlank, Warning, CheckCircle, XCircle } from '@phosphor-icons/react';
import { apiService } from '../services/api';
import moment from 'moment-timezone';
import HeaderActionPortal from './layout/HeaderActionPortal';
import HeaderActionButton from './layout/HeaderActionButton';
import Button from './ui/Button';
import SpringDropdown from './ui/SpringDropdown';
import { useAuth } from '../contexts/AuthContext';
import { useRegion } from '../contexts/RegionContext';
import CreateHolidayModal from './modals/CreateHolidayModal';

interface Holiday {
  id: string;
  name: string;
  date: string;
  timezone: string;
  isRecurring: boolean;
  year?: number;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface HolidayManagementProps {
  timezone?: string;
}

const HolidayManagement: React.FC<HolidayManagementProps> = ({ timezone = 'America/New_York' }) => {
  const { isManager } = useAuth();
  const { selectedRegionId } = useRegion();
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<Holiday | null>(null);

  const fetchHolidays = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiService.getHolidays(selectedYear, timezone, true);
      setHolidays(data);
    } catch (err) {
      console.error('Error fetching holidays:', err);
      setError('Failed to load holidays. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHolidays();
  }, [selectedYear, timezone]);

  const handleDeleteHoliday = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this holiday?')) return;

    try {
      await apiService.deleteHoliday(id);
      fetchHolidays();
    } catch (err: any) {
      console.error('Error deleting holiday:', err);
      setError(err.response?.data?.error || 'Failed to delete holiday. Please try again.');
    }
  };

  const handleOpenAddModal = () => {
    setEditingHoliday(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (holiday: Holiday) => {
    setEditingHoliday(holiday);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingHoliday(null);
  };

  const handleModalSuccess = () => {
    fetchHolidays();
  };

  const initializeDefaultHolidays = async () => {
    if (!window.confirm(`This will create default holidays for ${selectedYear} in the selected region. Continue?`)) return;

    try {
      setLoading(true);
      setError(null);

      const response = await apiService.initializeDefaultHolidays(selectedYear, timezone, selectedRegionId);
      alert(`Successfully initialized ${response.count} default holidays for ${selectedYear}`);
      fetchHolidays();
    } catch (err: any) {
      console.error('Error initializing holidays:', err);

      if (err.response?.status === 400 && err.response?.data?.error?.includes('already exist')) {
        const existingCount = err.response?.data?.existingCount || 0;
        alert(`Holidays already exist for ${selectedYear} in this region (${existingCount} holidays found). Refreshing the list.`);
        fetchHolidays();
      } else {
        setError(err.response?.data?.error || 'Failed to initialize default holidays.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex justify-center items-center h-64">
          <LoadingSpinner size="large" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Filters with Add/Initialize */}
      <div className="mb-6 flex items-center justify-between bg-white/40 dark:bg-gray-800/40 p-3 rounded-xl backdrop-blur-sm border border-gray-200/50 dark:border-white/10 relative z-20">
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-foreground">Year:</label>
          <SpringDropdown
            value={selectedYear.toString()}
            onChange={(val) => setSelectedYear(parseInt(val))}
            options={Array.from({ length: 5 }, (_, i) => {
              const year = new Date().getFullYear() + i;
              return { value: year.toString(), label: year.toString() };
            })}
          />
        </div>
        {isManager && (
          <div className="flex items-center space-x-2">
            <Button
              onClick={handleOpenAddModal}
              variant="primary"
              size="sm"
            >
              <Plus className="w-4 h-4 mr-1" />
              Add Holiday
            </Button>
            <Button
              onClick={initializeDefaultHolidays}
              variant="secondary"
              size="sm"
            >
              Initialize Defaults
            </Button>
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-4 bg-destructive/10 border border-destructive/20 rounded-md">
          <div className="flex items-center space-x-2">
            <Warning className="h-5 w-5 text-destructive" />
            <span className="text-destructive">{error}</span>
          </div>
        </div>
      )}

      {/* Holidays List */}
      <div className="relative overflow-hidden rounded-xl border bg-white/40 dark:bg-gray-800/50 border-gray-300/50 dark:border-white/10 backdrop-blur-xl shadow-xl shadow-black/5 dark:shadow-black/20">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-white/10 dark:bg-black/10">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-200 uppercase tracking-wider">
                  Holiday
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-200 uppercase tracking-wider">
                  Date
                </th>

                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-200 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-200 uppercase tracking-wider">
                  Status
                </th>
                {isManager && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-200 uppercase tracking-wider">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {holidays.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-700 dark:text-gray-200">
                    <CalendarBlank className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No holidays found for {selectedYear}</p>
                    <p className="text-sm">Click "Add New" or "Initialize Defaults" to get started</p>
                  </td>
                </tr>
              ) : (
                holidays.map((holiday) => (
                  <tr key={holiday.id} className="hover:bg-muted/50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-foreground">{holiday.name}</div>
                        {holiday.description && holiday.description !== holiday.name && (
                          <div className="text-sm text-gray-700 dark:text-gray-200">{holiday.description}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-foreground">
                        {moment(holiday.date).format('MMM DD, YYYY')}
                      </div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${holiday.isRecurring
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                        : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
                        }`}>
                        {holiday.isRecurring ? 'Recurring' : 'One-time'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full ${holiday.isActive
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                        : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                        }`}>
                        {holiday.isActive ? (
                          <>
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Active
                          </>
                        ) : (
                          <>
                            <XCircle className="h-3 w-3 mr-1" />
                            Inactive
                          </>
                        )}
                      </span>
                    </td>
                    {isManager && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-center space-x-2">
                          <Button
                            onClick={() => handleOpenEditModal(holiday)}
                            variant="ghost"
                            size="sm"
                            className="mr-2"
                          >
                            Edit
                          </Button>
                          <Button
                            onClick={() => handleDeleteHoliday(holiday.id)}
                            variant="danger"
                            size="sm"
                          >
                            Delete
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Holiday Modal */}
      <CreateHolidayModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSuccess={handleModalSuccess}
        timezone={timezone}
        editingHoliday={editingHoliday}
      />
    </div>
  );
};

export default HolidayManagement;
