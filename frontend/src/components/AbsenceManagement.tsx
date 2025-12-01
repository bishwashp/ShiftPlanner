import React, { useState, useEffect } from 'react';
import { Plus, Users, Trash, PencilSimple, Warning, CheckCircle, XCircle, Clock, User } from '@phosphor-icons/react';
import { apiService } from '../services/api';
import { dateUtils } from '../utils/dateUtils';
import Checkbox from './ui/Checkbox';
import HeaderActionPortal from './layout/HeaderActionPortal';
import HeaderActionButton from './layout/HeaderActionButton';
import Button from './ui/Button';
import { AbsenceApprovalDashboard } from './AbsenceApprovalDashboard';

interface Absence {
  id: string;
  analystId: string;
  startDate: string;
  endDate: string;
  type: string;
  reason?: string;
  isApproved: boolean;
  isPlanned: boolean;
  createdAt: string;
  updatedAt: string;
  analyst: {
    id: string;
    name: string;
    email: string;
  };
}

interface Analyst {
  id: string;
  name: string;
  email: string;
  shiftType: string;
  isActive: boolean;
}

interface AbsenceFormData {
  analystId: string;
  startDate: string;
  endDate: string;
  type: string;
  reason: string;
  isApproved: boolean;
  isPlanned: boolean;
}

const AbsenceManagement: React.FC = () => {
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [analysts, setAnalysts] = useState<Analyst[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingAbsence, setEditingAbsence] = useState<Absence | null>(null);
  const [formData, setFormData] = useState<AbsenceFormData>({
    analystId: '',
    startDate: '',
    endDate: '',
    type: 'VACATION',
    reason: '',
    isApproved: true,
    isPlanned: true
  });
  const [submitting, setSubmitting] = useState(false);
  const [filters, setFilters] = useState({
    analystId: '',
    type: '',
    isApproved: '',
    isPlanned: ''
  });
  const [activeTab, setActiveTab] = useState<'manage' | 'approval'>('manage');

  const absenceTypes = [
    { value: 'VACATION', label: 'Vacation' },
    { value: 'SICK_LEAVE', label: 'Sick Leave' },
    { value: 'PERSONAL', label: 'Personal' },
    { value: 'EMERGENCY', label: 'Emergency' },
    { value: 'TRAINING', label: 'Training' },
    { value: 'CONFERENCE', label: 'Conference' }
  ];

  const fetchAbsences = async () => {
    try {
      setLoading(true);
      setError(null);
      const params: any = {};
      if (filters.analystId) params.analystId = filters.analystId;
      if (filters.type) params.type = filters.type;
      if (filters.isApproved !== '') params.isApproved = filters.isApproved === 'true';
      if (filters.isPlanned !== '') params.isPlanned = filters.isPlanned === 'true';

      const data = await apiService.getAbsences(
        params.analystId,
        params.type,
        params.isApproved,
        params.isPlanned
      );
      setAbsences(data);
    } catch (err) {
      console.error('Error fetching absences:', err);
      setError('Failed to load absences. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalysts = async () => {
    try {
      const data = await apiService.getAnalysts();
      setAnalysts(data.filter(analyst => analyst.isActive));
    } catch (err) {
      console.error('Error fetching analysts:', err);
    }
  };

  useEffect(() => {
    fetchAbsences();
    fetchAnalysts();
  }, [filters]);

  const handleAddAbsence = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      // Ensure dates are formatted correctly for API (YYYY-MM-DD)
      const submissionData = {
        ...formData,
        startDate: dateUtils.toApiDate(formData.startDate),
        endDate: dateUtils.toApiDate(formData.endDate)
      };

      const response = await apiService.createAbsence(submissionData);

      // Check for conflicts
      if (response.conflicts && response.conflicts.length > 0) {
        const conflictMessages = response.conflicts.map((conflict: any) =>
          `${conflict.type}: ${conflict.description} `
        ).join('\n');

        const proceed = window.confirm(
          `Scheduling conflicts detected: \n\n${conflictMessages} \n\nDo you want to proceed anyway ? `
        );

        if (!proceed) {
          setSubmitting(false);
          return;
        }
      }

      setFormData({
        analystId: '',
        startDate: '',
        endDate: '',
        type: 'VACATION',
        reason: '',
        isApproved: true,
        isPlanned: true
      });
      setShowAddForm(false);
      fetchAbsences();
    } catch (err: any) {
      console.error('Error creating absence:', err);
      setError(err.response?.data?.error || 'Failed to create absence. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditAbsence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAbsence) return;

    try {
      setSubmitting(true);
      // Ensure dates are formatted correctly for API
      const submissionData = {
        ...formData,
        startDate: dateUtils.toApiDate(formData.startDate),
        endDate: dateUtils.toApiDate(formData.endDate)
      };

      const response = await apiService.updateAbsence(editingAbsence.id, submissionData);

      // Check for conflicts
      if (response.conflicts && response.conflicts.length > 0) {
        const conflictMessages = response.conflicts.map((conflict: any) =>
          `${conflict.type}: ${conflict.description} `
        ).join('\n');

        const proceed = window.confirm(
          `Scheduling conflicts detected: \n\n${conflictMessages} \n\nDo you want to proceed anyway ? `
        );

        if (!proceed) {
          setSubmitting(false);
          return;
        }
      }

      setEditingAbsence(null);
      setFormData({
        analystId: '',
        startDate: '',
        endDate: '',
        type: 'VACATION',
        reason: '',
        isApproved: true,
        isPlanned: true
      });
      fetchAbsences();
    } catch (err: any) {
      console.error('Error updating absence:', err);
      setError(err.response?.data?.error || 'Failed to update absence. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteAbsence = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this absence?')) return;

    try {
      await apiService.deleteAbsence(id);
      fetchAbsences();
    } catch (err: any) {
      console.error('Error deleting absence:', err);
      setError(err.response?.data?.error || 'Failed to delete absence. Please try again.');
    }
  };

  const handleApproveAbsence = async (id: string, isApproved: boolean) => {
    try {
      await apiService.approveAbsence(id, isApproved);
      fetchAbsences();
    } catch (err: any) {
      console.error('Error updating absence approval:', err);
      setError(err.response?.data?.error || 'Failed to update absence approval. Please try again.');
    }
  };

  const startEdit = (absence: Absence) => {
    setEditingAbsence(absence);
    setFormData({
      analystId: absence.analystId,
      startDate: dateUtils.toInputDate(absence.startDate),
      endDate: dateUtils.toInputDate(absence.endDate),
      type: absence.type,
      reason: absence.reason || '',
      isApproved: absence.isApproved,
      isPlanned: absence.isPlanned
    });
    setShowAddForm(true);
  };

  const cancelEdit = () => {
    setEditingAbsence(null);
    setShowAddForm(false);
    setFormData({
      analystId: '',
      startDate: '',
      endDate: '',
      type: 'VACATION',
      reason: '',
      isApproved: true,
      isPlanned: true
    });
  };

  const getAbsenceTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      VACATION: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
      SICK_LEAVE: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
      PERSONAL: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
      EMERGENCY: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
      TRAINING: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
      CONFERENCE: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
    };
    return colors[type] || 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
  };

  const getAbsenceTypeLabel = (type: string) => {
    const typeObj = absenceTypes.find(t => t.value === type);
    return typeObj ? typeObj.label : type;
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
      <HeaderActionPortal>
        <div className="flex space-x-2">
          <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1 mr-4">
            <button
              onClick={() => setActiveTab('manage')}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${activeTab === 'manage'
                ? 'bg-white dark:bg-gray-700 text-primary shadow-sm'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                } `}
            >
              Manage Absences
            </button>
            <button
              onClick={() => setActiveTab('approval')}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${activeTab === 'approval'
                ? 'bg-white dark:bg-gray-700 text-primary shadow-sm'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                } `}
            >
              Approval Dashboard
            </button>
          </div>
          {activeTab === 'manage' && (
            <HeaderActionButton
              icon={Plus}
              label="Add New"
              onClick={() => setShowAddForm(true)}
            />
          )}
        </div>
      </HeaderActionPortal>

      {activeTab === 'approval' ? (
        <AbsenceApprovalDashboard onUpdate={fetchAbsences} />
      ) : (
        <>
          {/* Filters */}
          <div className="mb-6 bg-white/40 dark:bg-gray-800/40 p-3 rounded-xl backdrop-blur-sm border border-gray-200/50 dark:border-white/10">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center space-x-2">
                <label className="text-sm font-medium text-foreground whitespace-nowrap">Analyst:</label>
                <select
                  value={filters.analystId}
                  onChange={(e) => setFilters({ ...filters, analystId: e.target.value })}
                  className="px-2 py-1 text-sm border border-border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-primary max-w-[150px]"
                >
                  <option value="">All Analysts</option>
                  {analysts.map(analyst => (
                    <option key={analyst.id} value={analyst.id}>
                      {analyst.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="h-4 w-px bg-gray-300 dark:bg-gray-700 hidden md:block" />

              <div className="flex items-center space-x-2">
                <label className="text-sm font-medium text-foreground whitespace-nowrap">Type:</label>
                <select
                  value={filters.type}
                  onChange={(e) => setFilters({ ...filters, type: e.target.value })}
                  className="px-2 py-1 text-sm border border-border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-primary"
                >
                  <option value="">All Types</option>
                  {absenceTypes.map(type => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="h-4 w-px bg-gray-300 dark:bg-gray-700 hidden md:block" />

              <div className="flex items-center space-x-2">
                <label className="text-sm font-medium text-foreground whitespace-nowrap">Status:</label>
                <select
                  value={filters.isApproved}
                  onChange={(e) => setFilters({ ...filters, isApproved: e.target.value })}
                  className="px-2 py-1 text-sm border border-border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-primary"
                >
                  <option value="">All</option>
                  <option value="true">Approved</option>
                  <option value="false">Pending</option>
                </select>
              </div>

              <div className="h-4 w-px bg-gray-300 dark:bg-gray-700 hidden md:block" />

              <div className="flex items-center space-x-2">
                <label className="text-sm font-medium text-foreground whitespace-nowrap">Plan:</label>
                <select
                  value={filters.isPlanned}
                  onChange={(e) => setFilters({ ...filters, isPlanned: e.target.value })}
                  className="px-2 py-1 text-sm border border-border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-primary"
                >
                  <option value="">All</option>
                  <option value="true">Planned</option>
                  <option value="false">Unplanned</option>
                </select>
              </div>
            </div>
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

          {/* Add/Edit Form */}
          {showAddForm && (
            <div className="mb-6 p-4 glass-static">
              <h3 className="text-lg font-semibold mb-4">
                {editingAbsence ? 'Edit Absence' : 'Add New Absence'}
              </h3>
              <form onSubmit={editingAbsence ? handleEditAbsence : handleAddAbsence} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">
                      Analyst *
                    </label>
                    <select
                      value={formData.analystId}
                      onChange={(e) => setFormData({ ...formData, analystId: e.target.value })}
                      className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground"
                      required
                    >
                      <option value="">Select Analyst</option>
                      {analysts.map(analyst => (
                        <option key={analyst.id} value={analyst.id}>
                          {analyst.name} ({analyst.shiftType})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">
                      Type *
                    </label>
                    <select
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                      className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground"
                      required
                    >
                      {absenceTypes.map(type => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">
                      Start Date *
                    </label>
                    <input
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                      className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">
                      End Date *
                    </label>
                    <input
                      type="date"
                      value={formData.endDate}
                      onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                      className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Reason
                  </label>
                  <textarea
                    value={formData.reason}
                    onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground"
                    rows={3}
                    placeholder="Optional reason for absence..."
                  />
                </div>
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      checked={formData.isApproved}
                      onChange={(checked) => setFormData({ ...formData, isApproved: checked })}
                    />
                    <span className="text-sm text-foreground">Approved</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      checked={formData.isPlanned}
                      onChange={(checked) => setFormData({ ...formData, isPlanned: checked })}
                    />
                    <span className="text-sm text-foreground">Planned absence</span>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <Button
                    type="submit"
                    disabled={submitting}
                    variant="primary"
                  >
                    {submitting ? 'Saving...' : (editingAbsence ? 'Update Absence' : 'Add Absence')}
                  </Button>
                  <Button
                    type="button"
                    onClick={editingAbsence ? cancelEdit : () => setShowAddForm(false)}
                    variant="secondary"
                    className="ml-3"
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </div>
          )}

          {/* Absences List */}
          <div className="relative overflow-hidden rounded-xl border bg-white/40 dark:bg-gray-800/50 border-gray-300/50 dark:border-white/10 backdrop-blur-xl shadow-xl shadow-black/5 dark:shadow-black/20">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-white/10 dark:bg-black/10">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-200 uppercase tracking-wider">
                      Analyst
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-200 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-200 uppercase tracking-wider">
                      Date Range
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-200 uppercase tracking-wider">
                      Duration
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-200 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-200 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {absences.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-gray-700 dark:text-gray-200">
                        <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No absences found</p>
                        <p className="text-sm">There are no Leave records for any analysts</p>
                      </td>
                    </tr>
                  ) : (
                    absences.map((absence) => {
                      const duration = dateUtils.getDurationInDays(absence.startDate, absence.endDate);

                      return (
                        <tr key={absence.id} className="hover:bg-muted/50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="p-2 bg-primary/10 rounded-full mr-3">
                                <User className="h-4 w-4 text-primary" />
                              </div>
                              <div>
                                <div className="text-sm font-medium text-foreground">{absence.analyst.name}</div>
                                <div className="text-sm text-gray-700 dark:text-gray-200">{absence.analyst.email}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getAbsenceTypeColor(absence.type)} `}>
                              {getAbsenceTypeLabel(absence.type)}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-foreground">
                              {dateUtils.formatDisplayDate(absence.startDate, 'MMM DD')} - {dateUtils.formatDisplayDate(absence.endDate, 'MMM DD, YYYY')}
                            </div>
                            {absence.reason && (
                              <div className="text-sm text-gray-700 dark:text-gray-200 truncate max-w-xs" title={absence.reason}>
                                {absence.reason}
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center text-sm text-foreground">
                              <Clock className="h-4 w-4 mr-1" />
                              {duration} day{duration !== 1 ? 's' : ''}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="space-y-1">
                              <span className={`inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full ${absence.isApproved
                                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                                : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                                } `}>
                                {absence.isApproved ? (
                                  <>
                                    <CheckCircle className="h-3 w-3 mr-1" />
                                    Approved
                                  </>
                                ) : (
                                  <>
                                    <Clock className="h-3 w-3 mr-1" />
                                    Pending
                                  </>
                                )}
                              </span>
                              <div className={`inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full ${absence.isPlanned
                                ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                                : 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300'
                                } `}>
                                {absence.isPlanned ? 'Planned' : 'Unplanned'}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <div className="flex items-center space-x-2">
                              <Button
                                onClick={() => startEdit(absence)}
                                variant="ghost"
                                size="sm"
                                className="text-primary hover:text-primary/80"
                                title="Edit absence"
                              >
                                <PencilSimple className="h-4 w-4" />
                              </Button>
                              {!absence.isApproved && (
                                <Button
                                  onClick={() => handleApproveAbsence(absence.id, true)}
                                  variant="ghost"
                                  size="sm"
                                  className="text-green-600 hover:text-green-800"
                                  title="Approve absence"
                                >
                                  <CheckCircle className="h-4 w-4" />
                                </Button>
                              )}
                              {absence.isApproved && (
                                <Button
                                  onClick={() => handleApproveAbsence(absence.id, false)}
                                  variant="ghost"
                                  size="sm"
                                  className="text-yellow-600 hover:text-yellow-800"
                                  title="Revoke approval"
                                >
                                  <XCircle className="h-4 w-4" />
                                </Button>
                              )}
                              <Button
                                onClick={() => handleDeleteAbsence(absence.id)}
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive/80"
                                title="Delete absence"
                              >
                                <Trash className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AbsenceManagement;
