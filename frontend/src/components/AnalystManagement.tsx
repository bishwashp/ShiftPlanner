import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { PencilSimple, Trash, UserPlus, UserMinus, Plus, Users, ArrowsClockwise } from '@phosphor-icons/react';
import SpringDropdown from './ui/SpringDropdown';
import SegmentedControl from './ui/SegmentedControl';
import { apiService, Analyst } from '../services/api';
import HeaderActionPortal from './layout/HeaderActionPortal';
import HeaderActionButton from './layout/HeaderActionButton';
import Button from './ui/Button';
import { useAuth } from '../contexts/AuthContext';
import { useRegion } from '../contexts/RegionContext';
import SwapInbox from './availability/SwapInbox';

interface ShiftDefinition {
  id: string;
  name: string;
  startResult: string;
  endResult: string;
}

interface AnalystFormData {
  name: string;
  email: string;
  shiftType: string;
  shiftDefinitionId?: string;
  employeeType: 'EMPLOYEE' | 'CONTRACTOR';
  customAttributes: string;
  skills: string;
}

const AnalystManagement: React.FC = () => {
  const { isManager } = useAuth();
  const { selectedRegionId } = useRegion();
  const [analysts, setAnalysts] = useState<Analyst[]>([]);
  const [shiftDefinitions, setShiftDefinitions] = useState<ShiftDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingAnalyst, setEditingAnalyst] = useState<Analyst | null>(null);
  const [formData, setFormData] = useState<AnalystFormData>({
    name: '',
    email: '',
    shiftType: '',
    employeeType: 'EMPLOYEE',
    customAttributes: '{}',
    skills: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'analysts' | 'swaps'>('analysts');

  const tabOptions = [
    { value: 'analysts', label: 'Analysts', icon: <Users className="w-4 h-4" /> },
    { value: 'swaps', label: 'Swaps', icon: <ArrowsClockwise className="w-4 h-4" /> },
  ];

  // Handle URL query param for deep-linking (e.g., /analysts?tab=swaps)
  const [searchParams] = useSearchParams();
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'swaps') {
      setActiveTab('swaps');
    }
  }, [searchParams]);

  const fetchAnalysts = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiService.getAnalysts();
      setAnalysts(data);
    } catch (err: any) {
      console.error('Error fetching analysts:', err);
      setError('Failed to load analysts. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalysts();
  }, []);

  useEffect(() => {
    const fetchShiftDefinitions = async () => {
      try {
        if (selectedRegionId) {
          const defs = await apiService.getShiftDefinitions(selectedRegionId);
          setShiftDefinitions(defs);
          // Set default shift type if available and form is reset
          if (defs.length > 0 && !formData.shiftType) {
            setFormData(prev => ({ ...prev, shiftType: defs[0].id }));
          }
        }
      } catch (err) {
        console.error('Error fetching shift definitions:', err);
      }
    };
    fetchShiftDefinitions();
  }, [selectedRegionId]);

  const handleAddAnalyst = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let parsedAttributes;
      try {
        parsedAttributes = JSON.parse(formData.customAttributes || '{}');
      } catch (error) {
        setError('Custom attributes must be valid JSON.');
        return;
      }

      setSubmitting(true);
      const skillsArray = formData.skills.split(',').map(s => s.trim()).filter(Boolean);

      // Map selected ID to name if possible, or use ID as type for now
      // The backend createAnalyst expects shiftType string
      // If we are using shift definitions, we should ideally pass shiftDefinitionId
      // But the current createAnalyst might just take shiftType.
      // Let's pass the selected value as shiftDefinitionId AND look up the name for shiftType

      const selectedDef = shiftDefinitions.find(d => d.id === formData.shiftType);
      const payload: any = {
        ...formData,
        customAttributes: parsedAttributes,
        skills: skillsArray,
        shiftType: selectedDef ? selectedDef.name : formData.shiftType,
        shiftDefinitionId: selectedDef ? selectedDef.id : undefined
      };

      // If no def matches (e.g. loading or error), we just send what we have

      await apiService.createAnalyst(payload);
      setFormData({ name: '', email: '', shiftType: shiftDefinitions[0]?.id || '', employeeType: 'EMPLOYEE', customAttributes: '{}', skills: '' });
      setShowAddForm(false);
      fetchAnalysts(); // Refresh the list
    } catch (err: any) {
      console.error('Error creating analyst:', err);
      setError(err.response?.data?.error || 'Failed to create analyst. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateAnalyst = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAnalyst) return;

    try {
      let parsedAttributes;
      try {
        parsedAttributes = JSON.parse(formData.customAttributes || '{}');
      } catch (error) {
        setError('Custom attributes must be valid JSON.');
        return;
      }
      setSubmitting(true);
      const skillsArray = formData.skills.split(',').map(s => s.trim()).filter(Boolean);

      const selectedDef = shiftDefinitions.find(d => d.id === formData.shiftType);
      const payload: any = {
        ...formData,
        customAttributes: parsedAttributes,
        skills: skillsArray,
        shiftType: selectedDef ? selectedDef.name : formData.shiftType,
        shiftDefinitionId: selectedDef ? selectedDef.id : undefined
      };

      await apiService.updateAnalyst(editingAnalyst.id, payload);
      setFormData({ name: '', email: '', shiftType: shiftDefinitions[0]?.id || '', employeeType: 'EMPLOYEE', customAttributes: '{}', skills: '' });
      setEditingAnalyst(null);
      fetchAnalysts(); // Refresh the list
    } catch (err: any) {
      console.error('Error updating analyst:', err);
      setError(err.response?.data?.error || 'Failed to update analyst. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteAnalyst = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this analyst?')) return;

    try {
      await apiService.deleteAnalyst(id);
      fetchAnalysts(); // Refresh the list
    } catch (err: any) {
      console.error('Error deleting analyst:', err);
      setError(err.response?.data?.error || 'Failed to delete analyst. Please try again.');
    }
  };

  const handleEditClick = (analyst: Analyst) => {
    setEditingAnalyst(analyst);
    setFormData({
      name: analyst.name,
      email: analyst.email,
      // If analyst has a definition ID, use it. Else check if shiftType name matches a definition name.
      shiftType: analyst.shiftDefinitionId || shiftDefinitions.find(d => d.name === analyst.shiftType)?.id || analyst.shiftType,
      employeeType: analyst.employeeType,
      customAttributes: JSON.stringify(analyst.customAttributes || {}, null, 2),
      skills: analyst.skills?.join(', ') || ''
    });
  };

  const handleCancelEdit = () => {
    setEditingAnalyst(null);
    setFormData({ name: '', email: '', shiftType: shiftDefinitions[0]?.id || '', employeeType: 'EMPLOYEE', customAttributes: '{}', skills: '' });
  };

  const handleStatusChange = async (analyst: Analyst, isActive: boolean) => {
    try {
      await apiService.updateAnalyst(analyst.id, { isActive });
      fetchAnalysts(); // Refresh the list
    } catch (err: any) {
      console.error('Error updating analyst status:', err);
      setError(err.response?.data?.error || 'Failed to update analyst status. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col h-full relative z-10">Loading analysts...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 relative z-10">
      <div className="max-w-6xl mx-auto">
        {error && (
          <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 text-destructive rounded-lg">
            {error}
          </div>
        )}
        {/* Tab Navigation Portal to Header */}
        <HeaderActionPortal targetId="app-header-right-actions">
          <SegmentedControl
            value={activeTab}
            onChange={(val) => setActiveTab(val as 'analysts' | 'swaps')}
            options={tabOptions}
            className="shadow-sm border border-gray-200/50 dark:border-white/10"
          />
        </HeaderActionPortal>

        {/* Shift Swaps Tab */}
        {activeTab === 'swaps' && (
          <div className="animate-in fade-in duration-300">
            <SwapInbox />
          </div>
        )}

        {/* Analysts Tab */}
        {activeTab === 'analysts' && (
          <>

            {/* Info Row */}
            <div className="mb-6 flex items-center justify-between bg-white/40 dark:bg-gray-800/40 p-3 rounded-xl backdrop-blur-sm border border-gray-200/50 dark:border-white/10">
              <div className="flex items-center space-x-4">
                <div className="text-sm text-gray-700 dark:text-gray-200">
                  <span className="font-medium">{analysts.length}</span>
                  <span className="opacity-70"> Analysts in record</span>
                </div>
                <div className="h-4 w-px bg-gray-300 dark:bg-gray-700" />
                <div className="text-sm text-gray-700 dark:text-gray-200">
                  <span className="opacity-70">GEO: </span>
                  <span className="font-medium">AMR</span>
                </div>
              </div>
              {isManager && (
                <Button
                  onClick={() => setShowAddForm(true)}
                  variant="primary"
                  size="sm"
                >
                  <UserPlus className="w-4 h-4 mr-1" />
                  Add Analyst
                </Button>
              )}
            </div>

            {/* Analysts List */}
            {(showAddForm || editingAnalyst) && ReactDOM.createPortal(
              <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                <div className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                  <div className="p-6">
                    <h2 className="text-xl font-semibold text-foreground mb-6">
                      {editingAnalyst ? 'Edit Analyst' : 'Add New Analyst'}
                    </h2>
                    <form onSubmit={editingAnalyst ? handleUpdateAnalyst : handleAddAnalyst}>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                            Name
                          </label>
                          <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full px-4 py-2 border border-border rounded-lg bg-input focus:ring-2 focus:ring-ring focus:border-transparent"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                            Email
                          </label>
                          <input
                            type="email"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            className="w-full px-4 py-2 border border-border rounded-lg bg-input focus:ring-2 focus:ring-ring focus:border-transparent"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                            Shift Type
                          </label>
                          <SpringDropdown
                            value={formData.shiftType}
                            onChange={(val) => setFormData({ ...formData, shiftType: val })}
                            options={shiftDefinitions.length > 0
                              ? shiftDefinitions.map(def => ({ value: def.id, label: def.name }))
                              : [
                                { value: "AM", label: "AM Shift" },
                                { value: "PM", label: "PM Shift" }
                              ]
                            }
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                            Employee Type
                          </label>
                          <SpringDropdown
                            required
                            value={formData.employeeType}
                            onChange={(val) => setFormData({ ...formData, employeeType: val as 'EMPLOYEE' | 'CONTRACTOR' })}
                            options={[
                              { value: "EMPLOYEE", label: "Employee" },
                              { value: "CONTRACTOR", label: "Contractor" }
                            ]}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                            Skills (comma-separated)
                          </label>
                          <input
                            type="text"
                            value={formData.skills}
                            onChange={(e) => setFormData({ ...formData, skills: e.target.value })}
                            className="w-full px-4 py-2 border border-border rounded-lg bg-input"
                            placeholder="e.g. advanced, screener-training"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                            Custom Attributes (JSON)
                          </label>
                          <textarea
                            value={formData.customAttributes}
                            onChange={(e) => setFormData({ ...formData, customAttributes: e.target.value })}
                            className="w-full px-4 py-2 border border-border rounded-lg bg-input focus:ring-2 focus:ring-ring focus:border-transparent font-mono"
                            rows={4}
                            placeholder='{ "skill": "advanced" }'
                          />
                        </div>
                      </div>
                      <div className="flex items-center justify-end space-x-4 mt-8 pt-6 border-t border-border">
                        <Button
                          type="button"
                          onClick={editingAnalyst ? handleCancelEdit : () => setShowAddForm(false)}
                          variant="secondary"
                        >
                          Cancel
                        </Button>
                        <Button
                          type="submit"
                          disabled={submitting}
                          variant="primary"
                        >
                          {submitting ? 'Saving...' : (editingAnalyst ? 'Update Analyst' : 'Add Analyst')}
                        </Button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>,
              document.body
            )}

            {/* Analysts List */}
            <div className="relative overflow-hidden rounded-xl border bg-white/40 dark:bg-gray-800/50 border-gray-300/50 dark:border-white/10 backdrop-blur-xl shadow-xl shadow-black/5 dark:shadow-black/20">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-white/10 dark:bg-black/10">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-200 uppercase tracking-wider w-auto">
                        Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-200 uppercase tracking-wider w-auto">
                        Email
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-200 uppercase tracking-wider w-auto">
                        Shift Type
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-200 uppercase tracking-wider w-auto">
                        Analyst Type
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-200 uppercase tracking-wider w-auto">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-200 uppercase tracking-wider w-auto">
                        Skills
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-200 uppercase tracking-wider w-auto">
                        Custom Attributes
                      </th>
                      {isManager && (
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-200 uppercase tracking-wider w-auto">
                          Actions
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {analysts.map((analyst) => (
                      <tr key={analyst.id} className="hover:bg-muted/50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-foreground">{analyst.name}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-700 dark:text-gray-200">{analyst.email}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${(analyst.shiftType === 'EVENING' || analyst.shiftType === 'PM')
                            ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
                            : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                            }`}>
                            {/* Phase 1: Display shiftDefinition.name if available, otherwise use shiftType */}
                            {analyst.shiftDefinition?.name || analyst.shiftType}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${analyst.employeeType === 'CONTRACTOR'
                            ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300'
                            : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                            }`}>
                            {analyst.employeeType}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {isManager ? (
                            <div className="w-32">
                              <SpringDropdown
                                value={analyst.isActive ? 'active' : 'inactive'}
                                onChange={(val) => handleStatusChange(analyst, val === 'active')}
                                options={[
                                  { value: "active", label: "Active" },
                                  { value: "inactive", label: "Inactive" }
                                ]}
                                className="w-full"
                              />
                            </div>
                          ) : (
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${analyst.isActive
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                              : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                              }`}>
                              {analyst.isActive ? 'Active' : 'Inactive'}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-200">
                          {analyst.skills?.join(', ')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-200">
                          <pre className="text-xs bg-muted/50 p-2 rounded">
                            {JSON.stringify(analyst.customAttributes, null, 2)}
                          </pre>
                        </td>
                        {isManager && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <div className="flex items-center space-x-2">
                              <Button
                                onClick={() => handleEditClick(analyst)}
                                variant="ghost"
                                size="sm"
                                className="mr-2"
                              >
                                Edit
                              </Button>
                              <Button
                                onClick={() => handleDeleteAnalyst(analyst.id)}
                                variant="danger"
                                size="sm"
                              >
                                Delete
                              </Button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {analysts.length === 0 && (
                  <div className="px-6 py-12 text-center text-gray-700 dark:text-gray-200">
                    <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No analysts found</p>
                    <p className="text-sm">Click "Add New Analyst" to create your first analyst record</p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AnalystManagement;