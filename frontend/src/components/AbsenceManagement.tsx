import React, { useState, useEffect } from 'react';
import { Plus, Users, Trash, PencilSimple, Warning, CheckCircle, XCircle, Clock, User } from '@phosphor-icons/react';
import { useLocation } from 'react-router-dom';
import { apiService, Analyst } from '../services/api';
import { dateUtils } from '../utils/dateUtils';
import Checkbox from './ui/Checkbox';
import HeaderActionPortal from './layout/HeaderActionPortal';
import HeaderActionButton from './layout/HeaderActionButton';
import Button from './ui/Button';
import { AbsenceApprovalDashboard } from './AbsenceApprovalDashboard';
import { useAuth } from '../contexts/AuthContext';
import CreateAbsenceModal from './modals/CreateAbsenceModal';
import SpringDropdown from './ui/SpringDropdown';

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
  denialReason?: string;
  status?: string;
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
  const { isManager, user } = useAuth();
  const location = useLocation();
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [analysts, setAnalysts] = useState<Analyst[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showAbsenceModal, setShowAbsenceModal] = useState(false);
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
  const [activeTab, setActiveTab] = useState<'manage' | 'approval'>(() => {
    const params = new URLSearchParams(location.search);
    return params.get('tab') === 'approval' ? 'approval' : 'manage';
  });
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

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

      // Filter absences for non-managers to show only their own
      const filteredData = isManager ? data : data.filter(absence => absence.analystId === user?.analystId);
      setAbsences(filteredData);
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
    // Refresh when filters change OR when URL query params change (e.g. navigation from notification)
  }, [filters, location.search]);

  // Handle deep-linking via URL query params
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get('tab');
    const highlight = params.get('highlight');

    if (tab === 'approval' && isManager) {
      setActiveTab('approval');
    } else if (tab === 'manage') {
      setActiveTab('manage');
    }

    if (highlight) {
      setHighlightedId(highlight);
      // Clear highlight after animation
      const timer = setTimeout(() => {
        setHighlightedId(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [location.search, isManager]);

  // Effect to scroll to highlighted item
  useEffect(() => {
    if (highlightedId) {
      const timer = setTimeout(() => {
        const element = document.getElementById(`absence-${highlightedId}`);
        if (element) {
          console.log(`[AbsenceManagement] Scrolling to absence-${highlightedId}`);
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
          console.warn(`[AbsenceManagement] Could not find element absence-${highlightedId}`);
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [highlightedId, absences]);

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

  const startResubmit = (absence: Absence) => {
    setEditingAbsence(absence);
    setFormData({
      analystId: absence.analystId,
      startDate: dateUtils.toInputDate(absence.startDate),
      endDate: dateUtils.toInputDate(absence.endDate),
      type: absence.type,
      reason: absence.reason || '', // Keep original reason
      isApproved: false, // Reset to pending
      isPlanned: absence.isPlanned
    });
    // We treat resubmit as an edit but with status reset
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
    <>
      <div className="p-6">
        <HeaderActionPortal>
          <div className="flex space-x-2">
            {isManager && (
              <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1 mr-4">
                <button
                  onClick={() => setActiveTab('manage')}
                  className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${activeTab === 'manage'
                    ? 'bg-white dark:bg-gray-700 text-primary shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                    }`}
                >
                  Manage Absences
                </button>
                <button
                  onClick={() => setActiveTab('approval')}
                  className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${activeTab === 'approval'
                    ? 'bg-white dark:bg-gray-700 text-primary shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                    }`}
                >
                  Approval Dashboard
                </button>
              </div>
            )}
            <HeaderActionButton
              onClick={() => setShowAbsenceModal(true)}
              label={isManager ? "Add New" : "Request Absence"}
              icon={Plus}
            />
          </div>
        </HeaderActionPortal>

        {activeTab === 'approval' ? (
          <AbsenceApprovalDashboard onUpdate={fetchAbsences} />
        ) : (
          <>
            {/* Filters */}
            <div className="mb-6 bg-white/40 dark:bg-gray-800/40 p-3 rounded-xl backdrop-blur-sm border border-gray-200/50 dark:border-white/10 relative z-20">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-3">
                  <SpringDropdown
                    value={filters.analystId}
                    onChange={(val) => setFilters({ ...filters, analystId: val })}
                    options={[
                      { value: "", label: "All Analysts" },
                      ...analysts.map(a => ({ value: a.id, label: a.name }))
                    ]}
                  />
                </div>

                <div className="h-4 w-px bg-gray-300 dark:bg-gray-700 hidden md:block" />

                <div className="flex items-center gap-3">
                  <label className="text-sm font-medium text-foreground whitespace-nowrap">Type:</label>
                  <SpringDropdown
                    value={filters.type}
                    onChange={(val) => setFilters({ ...filters, type: val })}
                    options={[
                      { value: "", label: "All Types" },
                      ...absenceTypes
                    ]}
                  />
                </div>

                <div className="h-4 w-px bg-gray-300 dark:bg-gray-700 hidden md:block" />

                <div className="flex items-center gap-3">
                  <label className="text-sm font-medium text-foreground whitespace-nowrap">Status:</label>
                  <SpringDropdown
                    value={filters.isApproved}
                    onChange={(val) => setFilters({ ...filters, isApproved: val })}
                    options={[
                      { value: "", label: "All" },
                      { value: "true", label: "Approved" },
                      { value: "false", label: "Pending" }
                    ]}
                  />
                </div>

                <div className="h-4 w-px bg-gray-300 dark:bg-gray-700 hidden md:block" />

                <div className="flex items-center gap-3">
                  <label className="text-sm font-medium text-foreground whitespace-nowrap">Plan:</label>
                  <SpringDropdown
                    value={filters.isPlanned}
                    onChange={(val) => setFilters({ ...filters, isPlanned: val })}
                    options={[
                      { value: "", label: "All" },
                      { value: "true", label: "Planned" },
                      { value: "false", label: "Unplanned" }
                    ]}
                  />
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
                  {editingAbsence ? (editingAbsence.status === 'REJECTED' ? 'Resubmit Absence' : 'Edit Absence') : 'Add New Absence'}
                </h3>
                <form onSubmit={editingAbsence ? handleEditAbsence : handleAddAbsence} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">
                        Analyst *
                      </label>
                      <SpringDropdown
                        required
                        value={formData.analystId}
                        onChange={(val) => setFormData({ ...formData, analystId: val })}
                        options={analysts.map(analyst => ({
                          value: analyst.id,
                          label: `${analyst.name} (${analyst.shiftType})`
                        }))}
                        placeholder="Select Analyst"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">
                        Type *
                      </label>
                      <SpringDropdown
                        required
                        value={formData.type}
                        onChange={(val) => setFormData({ ...formData, type: val })}
                        options={absenceTypes}
                      />
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
                      {submitting ? 'Saving...' : (editingAbsence ? (editingAbsence.status === 'REJECTED' ? 'Resubmit' : 'Update Absence') : 'Add Absence')}
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
                      {isManager && (
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-200 uppercase tracking-wider">
                          Actions
                        </th>
                      )}
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
                          <tr
                            key={absence.id}
                            id={`absence-${absence.id}`}
                            className={`hover:bg-muted/50 transition-all ${highlightedId === absence.id ? 'highlight-glow' : ''}`}
                          >
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
                                <span className={`inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full ${absence.status === 'APPROVED' || (absence.isApproved && !absence.status)
                                  ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                                  : absence.status === 'REJECTED'
                                    ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                                    : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                                  } `}>
                                  {absence.status === 'APPROVED' || (absence.isApproved && !absence.status) ? (
                                    <>
                                      <CheckCircle className="h-3 w-3 mr-1" />
                                      Approved
                                    </>
                                  ) : absence.status === 'REJECTED' ? (
                                    <>
                                      <XCircle className="h-3 w-3 mr-1" />
                                      Denied
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
                                {absence.status === 'REJECTED' && absence.denialReason && (
                                  <div className="text-xs text-red-600 dark:text-red-400 mt-1 max-w-xs truncate" title={absence.denialReason}>
                                    Reason: {absence.denialReason}
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                              <div className="flex items-center space-x-2">
                                {isManager ? (
                                  <>
                                    <Button
                                      onClick={() => startEdit(absence)}
                                      variant="ghost"
                                      size="sm"
                                      className="text-primary hover:text-primary/80"
                                      title="Edit absence"
                                    >
                                      <PencilSimple className="h-4 w-4" />
                                    </Button>
                                    {!absence.isApproved && absence.status !== 'REJECTED' && (
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
                                  </>
                                ) : (
                                  <>
                                    {absence.status === 'REJECTED' && (
                                      <Button
                                        onClick={() => startResubmit(absence)}
                                        variant="primary"
                                        size="sm"
                                        className="text-xs"
                                      >
                                        Resubmit
                                      </Button>
                                    )}
                                    <Button
                                      onClick={() => startEdit(absence)}
                                      variant="ghost"
                                      size="sm"
                                      className="text-primary hover:text-primary/80"
                                      title="Edit absence"
                                    >
                                      <PencilSimple className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      onClick={() => handleDeleteAbsence(absence.id)}
                                      variant="ghost"
                                      size="sm"
                                      className="text-destructive hover:text-destructive/80"
                                      title="Delete absence"
                                    >
                                      <Trash className="h-4 w-4" />
                                    </Button>
                                  </>
                                )}
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
      </div >


      {/* Absence Request Modal */}
      < CreateAbsenceModal
        isOpen={showAbsenceModal}
        onClose={() => setShowAbsenceModal(false)}
        onSuccess={() => {
          setShowAbsenceModal(false);
          fetchAbsences();
        }}
        analysts={analysts}
      />
    </>
  );
};

export default AbsenceManagement;
