import React, { useState, useEffect } from 'react';
import { Edit, Trash2, UserCheck, UserX, Users } from 'lucide-react';
import { apiService, Analyst } from '../services/api';

interface AnalystFormData {
  name: string;
  email: string;
  shiftType: 'MORNING' | 'EVENING';
  employeeType: 'EMPLOYEE' | 'CONTRACTOR';
  customAttributes: string; // Stored as a JSON string
  skills: string; // Stored as a comma-separated string
}

const AnalystManagement: React.FC = () => {
  const [analysts, setAnalysts] = useState<Analyst[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingAnalyst, setEditingAnalyst] = useState<Analyst | null>(null);
  const [formData, setFormData] = useState<AnalystFormData>({
    name: '',
    email: '',
    shiftType: 'MORNING',
    employeeType: 'EMPLOYEE',
    customAttributes: '{}',
    skills: ''
  });
  const [submitting, setSubmitting] = useState(false);

  const fetchAnalysts = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiService.getAnalysts();
      setAnalysts(data);
    } catch (err) {
      console.error('Error fetching analysts:', err);
      setError('Failed to load analysts. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalysts();
  }, []);

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
      await apiService.createAnalyst({ ...formData, customAttributes: parsedAttributes, skills: skillsArray });
      setFormData({ name: '', email: '', shiftType: 'MORNING', employeeType: 'EMPLOYEE', customAttributes: '{}', skills: '' });
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
      await apiService.updateAnalyst(editingAnalyst.id, { ...formData, customAttributes: parsedAttributes, skills: skillsArray });
      setFormData({ name: '', email: '', shiftType: 'MORNING', employeeType: 'EMPLOYEE', customAttributes: '{}', skills: '' });
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
      shiftType: analyst.shiftType,
      employeeType: analyst.employeeType,
      customAttributes: JSON.stringify(analyst.customAttributes || {}, null, 2),
      skills: analyst.skills?.join(', ') || ''
    });
  };

  const handleCancelEdit = () => {
    setEditingAnalyst(null);
    setFormData({ name: '', email: '', shiftType: 'MORNING', employeeType: 'EMPLOYEE', customAttributes: '{}', skills: '' });
  };

  const handleToggleActive = async (analyst: Analyst) => {
    try {
      await apiService.updateAnalyst(analyst.id, { isActive: !analyst.isActive });
      fetchAnalysts(); // Refresh the list
    } catch (err: any) {
      console.error('Error updating analyst status:', err);
      setError(err.response?.data?.error || 'Failed to update analyst status. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-muted-foreground">Loading analysts...</div>
      </div>
    );
    }

  return (
    <div className="bg-background text-foreground p-6">
      <div className="max-w-6xl mx-auto">
        {error && (
          <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 text-destructive rounded-lg">
            {error}
          </div>
        )}
        <div className="flex items-center justify-end mb-8">
          <button
            onClick={() => setShowAddForm(true)}
            className="px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          >
            Add New Analyst
          </button>
        </div>

        {/* Add/Edit Form */}
        {(showAddForm || editingAnalyst) && (
          <div className="bg-card text-card-foreground rounded-2xl p-6 shadow-sm border border-border mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">
              {editingAnalyst ? 'Edit Analyst' : 'Add New Analyst'}
            </h2>
            <form onSubmit={editingAnalyst ? handleUpdateAnalyst : handleAddAnalyst}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">
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
                  <label className="block text-sm font-medium text-muted-foreground mb-2">
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
                  <label className="block text-sm font-medium text-muted-foreground mb-2">
                    Shift Type
                  </label>
                  <select
                    value={formData.shiftType}
                    onChange={(e) => setFormData({ ...formData, shiftType: e.target.value as 'MORNING' | 'EVENING' })}
                    className="w-full px-4 py-2 border border-border rounded-lg bg-input focus:ring-2 focus:ring-ring focus:border-transparent"
                  >
                    <option value="MORNING">Morning Shift (AM)</option>
                    <option value="EVENING">Evening Shift (PM)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">
                    Employee Type
                  </label>
                  <select
                    value={formData.employeeType}
                    onChange={(e) => setFormData({ ...formData, employeeType: e.target.value as 'EMPLOYEE' | 'CONTRACTOR' })}
                    className="w-full px-4 py-2 border border-border rounded-lg bg-input focus:ring-2 focus:ring-ring focus:border-transparent"
                    required
                  >
                    <option value="EMPLOYEE">Employee</option>
                    <option value="CONTRACTOR">Contractor</option>
                  </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-2">
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
                    <label className="block text-sm font-medium text-muted-foreground mb-2">
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
              <div className="flex items-center space-x-4 mt-6">
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Saving...' : (editingAnalyst ? 'Update' : 'Add')}
                </button>
        <button
                  type="button"
                  onClick={editingAnalyst ? handleCancelEdit : () => setShowAddForm(false)}
                  className="px-6 py-2 bg-muted text-muted-foreground rounded-lg hover:bg-muted/80"
        >
                  Cancel
        </button>
      </div>
            </form>
          </div>
        )}

        {/* Analysts List */}
        <div className="bg-card text-card-foreground rounded-2xl shadow-sm border border-border overflow-hidden">
          <div className="px-6 py-4 border-b border-border">
            <h2 className="text-lg font-semibold text-foreground">Analysts ({analysts.length})</h2>
          </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Shift Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Employee Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Skills
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Custom Attributes
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-card divide-y divide-border">
              {analysts.map((analyst) => (
                <tr key={analyst.id} className="hover:bg-muted/50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-foreground">{analyst.name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-muted-foreground">{analyst.email}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        analyst.shiftType === 'EVENING' 
                        ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300' 
                        : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                    }`}>
                        {analyst.shiftType === 'MORNING' ? 'Morning (AM)' : 'Evening (PM)'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        analyst.employeeType === 'CONTRACTOR' 
                        ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300' 
                        : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                    }`}>
                        {analyst.employeeType}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      analyst.isActive 
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' 
                        : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                    }`}>
                      {analyst.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                    {analyst.skills?.join(', ')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                    <pre className="text-xs bg-muted/50 p-2 rounded">
                        {JSON.stringify(analyst.customAttributes, null, 2)}
                    </pre>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center space-x-2">
                    <button
                          onClick={() => handleEditClick(analyst)}
                          className="text-primary hover:text-primary/80 transition-colors"
                          title="Edit analyst"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                          onClick={() => handleToggleActive(analyst)}
                          className={`transition-colors ${
                            analyst.isActive 
                              ? 'text-orange-600 hover:text-orange-800' 
                              : 'text-green-600 hover:text-green-800'
                          }`}
                          title={analyst.isActive ? 'Deactivate analyst' : 'Activate analyst'}
                        >
                          {analyst.isActive ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                        </button>
                        <button
                          onClick={() => handleDeleteAnalyst(analyst.id)}
                      className="text-destructive hover:text-destructive/80 transition-colors"
                      title="Delete analyst"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                      </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
            {analysts.length === 0 && (
              <div className="px-6 py-12 text-center text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No analysts found</p>
                <p className="text-sm">Click "Add New Analyst" to create your first analyst record</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalystManagement; 