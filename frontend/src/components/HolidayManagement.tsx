import React, { useState, useEffect } from 'react';
import { Plus, Calendar, Trash2, Edit, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { apiService } from '../services/api';
import moment from 'moment-timezone';
import Checkbox from './ui/Checkbox';

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

interface HolidayFormData {
  name: string;
  date: string;
  timezone: string;
  isRecurring: boolean;
  year?: number;
  description: string;
  isActive: boolean;
}

interface HolidayManagementProps {
  timezone?: string;
}

const HolidayManagement: React.FC<HolidayManagementProps> = ({ timezone = 'America/New_York' }) => {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<Holiday | null>(null);
  const [formData, setFormData] = useState<HolidayFormData>({
    name: '',
    date: '',
    timezone: timezone,
    isRecurring: false,
    year: new Date().getFullYear(),
    description: '',
    isActive: true
  });
  const [submitting, setSubmitting] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

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

  const handleAddHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      const holidayData = {
        ...formData,
        year: formData.isRecurring ? undefined : formData.year
      };
      
      await apiService.createHoliday(holidayData);
      setFormData({
        name: '',
        date: '',
        timezone: timezone,
        isRecurring: false,
        year: new Date().getFullYear(),
        description: '',
        isActive: true
      });
      setShowAddForm(false);
      fetchHolidays();
    } catch (err: any) {
      console.error('Error creating holiday:', err);
      setError(err.response?.data?.error || 'Failed to create holiday. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingHoliday) return;

    try {
      setSubmitting(true);
      const holidayData = {
        ...formData,
        year: formData.isRecurring ? undefined : formData.year
      };
      
      await apiService.updateHoliday(editingHoliday.id, holidayData);
      setEditingHoliday(null);
      setFormData({
        name: '',
        date: '',
        timezone: timezone,
        isRecurring: false,
        year: new Date().getFullYear(),
        description: '',
        isActive: true
      });
      fetchHolidays();
    } catch (err: any) {
      console.error('Error updating holiday:', err);
      setError(err.response?.data?.error || 'Failed to update holiday. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

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

  const startEdit = (holiday: Holiday) => {
    setEditingHoliday(holiday);
    setFormData({
      name: holiday.name,
      date: moment(holiday.date).format('YYYY-MM-DD'),
      timezone: holiday.timezone,
      isRecurring: holiday.isRecurring,
      year: holiday.year || new Date().getFullYear(),
      description: holiday.description || '',
      isActive: holiday.isActive
    });
    setShowAddForm(true);
  };

  const cancelEdit = () => {
    setEditingHoliday(null);
    setShowAddForm(false);
    setFormData({
      name: '',
      date: '',
      timezone: 'America/New_York',
      isRecurring: false,
      year: new Date().getFullYear(),
      description: '',
      isActive: true
    });
  };

  const initializeDefaultHolidays = async () => {
    if (!window.confirm(`This will create default US holidays for ${selectedYear}. Continue?`)) return;

    try {
      setLoading(true);
      setError(null);
      
      const response = await apiService.initializeDefaultHolidays(selectedYear, timezone);
      
      // Show success message
      alert(`Successfully initialized ${response.count} default holidays for ${selectedYear}`);
      
      // Refresh the holidays list
      fetchHolidays();
    } catch (err: any) {
      console.error('Error initializing holidays:', err);
      
      // Check if holidays already exist (400 error)
      if (err.response?.status === 400 && err.response?.data?.error?.includes('already exist')) {
        const existingCount = err.response?.data?.existingCount || 0;
        alert(`Holidays already exist for ${selectedYear} (${existingCount} holidays found). Refreshing the list.`);
        // Still refresh the holidays list to show existing ones
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
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Holiday Management</h2>
          <p className="text-muted-foreground">
            Manage company holidays that affect scheduling
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={initializeDefaultHolidays}
            className="px-4 py-2 text-sm bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/90 transition-colors"
          >
            Initialize Default Holidays
          </button>
          <button
            onClick={() => setShowAddForm(true)}
            className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors flex items-center space-x-2"
          >
            <Plus className="h-4 w-4" />
            <span>Add Holiday</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 flex items-center space-x-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Year</label>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="px-3 py-2 border border-border rounded-md bg-background text-foreground"
          >
            {Array.from({ length: 5 }, (_, i) => {
              const year = new Date().getFullYear() + i;
              return (
                <option key={year} value={year}>
                  {year}
                </option>
              );
            })}
          </select>
        </div>
        <div className="text-sm text-muted-foreground">
          <span>Timezone: </span>
          <span className="font-medium">{timezone}</span>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-4 bg-destructive/10 border border-destructive/20 rounded-md">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <span className="text-destructive">{error}</span>
          </div>
        </div>
      )}

      {/* Add/Edit Form */}
      {showAddForm && (
        <div className="mb-6 p-4 bg-muted/50 rounded-lg border border-border">
          <h3 className="text-lg font-semibold mb-4">
            {editingHoliday ? 'Edit Holiday' : 'Add New Holiday'}
          </h3>
          <form onSubmit={editingHoliday ? handleEditHoliday : handleAddHoliday} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Holiday Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Date *
                </label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Timezone
                </label>
                <div className="w-full px-3 py-2 border border-border rounded-md bg-muted text-muted-foreground">
                  {timezone}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Year (for non-recurring holidays)
                </label>
                <input
                  type="number"
                  value={formData.year}
                  onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) })}
                  disabled={formData.isRecurring}
                  className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground disabled:opacity-50"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground"
                rows={3}
              />
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  checked={formData.isRecurring}
                  onChange={(checked) => setFormData({ ...formData, isRecurring: checked })}
                />
                <span className="text-sm text-foreground">Recurring annually</span>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  checked={formData.isActive}
                  onChange={(checked) => setFormData({ ...formData, isActive: checked })}
                />
                <span className="text-sm text-foreground">Active (affects scheduling)</span>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {submitting ? 'Saving...' : (editingHoliday ? 'Update Holiday' : 'Add Holiday')}
              </button>
              <button
                type="button"
                onClick={cancelEdit}
                className="px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/90 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Holidays List */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Holiday
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Timezone
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-card divide-y divide-border">
              {holidays.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                    <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No holidays found for {selectedYear}</p>
                    <p className="text-sm">Click "Add Holiday" to create your first holiday</p>
                  </td>
                </tr>
              ) : (
                holidays.map((holiday) => (
                  <tr key={holiday.id} className="hover:bg-muted/50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-foreground">{holiday.name}</div>
                        {holiday.description && (
                          <div className="text-sm text-muted-foreground">{holiday.description}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-foreground">
                        {moment(holiday.date).format('MMM DD, YYYY')}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-muted-foreground">{holiday.timezone}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        holiday.isRecurring
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
                      }`}>
                        {holiday.isRecurring ? 'Recurring' : 'One-time'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full ${
                        holiday.isActive
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
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => startEdit(holiday)}
                          className="text-primary hover:text-primary/80 transition-colors"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteHoliday(holiday.id)}
                          className="text-destructive hover:text-destructive/80 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default HolidayManagement;
