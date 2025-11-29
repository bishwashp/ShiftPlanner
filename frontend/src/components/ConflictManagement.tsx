import React, { useEffect, useState } from 'react';
import apiService from '../services/api';
import AutoFixPreview, { AssignmentProposal } from './AutoFixPreview';
import { formatDateTime } from '../utils/formatDateTime';
import moment from 'moment-timezone';

interface ConflictManagementProps {
  activeTab: 'critical' | 'recommended';
  onTabChange: (tab: 'critical' | 'recommended') => void;
}

const ConflictManagement: React.FC<ConflictManagementProps> = ({ activeTab, onTabChange }) => {
  const [conflicts, setConflicts] = useState<{ critical: any[]; recommended: any[] }>({ critical: [], recommended: [] });
  const [loading, setLoading] = useState(true);
  const [autoFixing, setAutoFixing] = useState(false);
  const [autoFixMsg, setAutoFixMsg] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [proposals, setProposals] = useState<AssignmentProposal[]>([]);
  const [analysts, setAnalysts] = useState<any[]>([]);
  const [showManualAssignment, setShowManualAssignment] = useState<string | null>(null);

  const fetchConflicts = async () => {
    setLoading(true);
    try {
      // Get conflicts for the next 30 days (matching SystemHealth logic)
      const startDate = moment().format('YYYY-MM-DD');
      const endDate = moment().add(30, 'days').format('YYYY-MM-DD');

      const data = await apiService.getAllConflicts(startDate, endDate);
      setConflicts(data);
    } catch (error) {
      console.error("Failed to fetch conflicts:", error);
      setConflicts({ critical: [], recommended: [] });
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalysts = async () => {
    try {
      const data = await apiService.getAnalysts();
      setAnalysts(data);
    } catch (error) {
      console.error("Failed to fetch analysts:", error);
    }
  };

  useEffect(() => {
    fetchConflicts();
    fetchAnalysts();
  }, []);

  const currentConflicts = (conflicts[activeTab] || []).filter(c =>
    c.type !== 'NO_SCHEDULE_EXISTS' && c.type !== 'INCOMPLETE_SCHEDULES'
  );

  const handleAutoFixAll = async () => {
    setAutoFixing(true);
    setAutoFixMsg(null);
    try {
      const startDate = moment().format('YYYY-MM-DD');
      const endDate = moment().add(30, 'days').format('YYYY-MM-DD');
      const result = await apiService.autoFixConflicts({ startDate, endDate });

      if (!result.proposals || result.proposals.length === 0) {
        setAutoFixMsg('Auto-fix complete! No proposals were generated.');
        setAutoFixing(false);
        return;
      }

      setProposals(result.proposals);
      setIsPreviewOpen(true);
    } catch (err: any) {
      setAutoFixMsg('Failed to generate auto-fix plan: ' + (err?.message || 'Unknown error'));
    } finally {
      setAutoFixing(false);
    }
  };

  const handleConfirmAutoFix = async () => {
    setAutoFixing(true);
    setIsPreviewOpen(false);
    try {
      const applyResult = await apiService.applyAutoFix({ assignments: proposals });
      setAutoFixMsg(`Auto-fix complete! ${applyResult.createdSchedules.length} changes applied.`);
      setProposals([]);
      await fetchConflicts(); // Refresh conflict list
    } catch (err: any) {
      setAutoFixMsg('Auto-fix failed to apply: ' + (err?.message || 'Unknown error'));
    } finally {
      setAutoFixing(false);
    }
  };

  const handleAutoFixSingle = async (conflict: any) => {
    setAutoFixing(true);
    setAutoFixMsg(null);
    try {
      // Call the backend to generate proposals for this single conflict
      const result = await apiService.autoFixConflicts({
        startDate: conflict.date,
        endDate: conflict.date
      });

      if (!result.suggestedAssignments || result.suggestedAssignments.length === 0) {
        setAutoFixMsg(`No auto-fix available for ${formatDateTime(conflict.date, moment.tz.guess(), 'MMM D, YYYY')}. No suitable analysts found.`);
        setAutoFixing(false);
        return;
      }

      setProposals(result.suggestedAssignments);
      setIsPreviewOpen(true);
    } catch (err: any) {
      setAutoFixMsg('Failed to generate auto-fix for this conflict: ' + (err?.message || 'Unknown error'));
    } finally {
      setAutoFixing(false);
    }
  };

  const handleManualAssignment = async (conflict: any, analystId: string, shiftType: string) => {
    setAutoFixing(true);
    try {
      // Create a manual assignment
      const manualAssignment = {
        date: conflict.date,
        analystId: analystId,
        shiftType: shiftType.toUpperCase(),
        isScreener: false
      };

      const result = await apiService.applyAutoFix({ assignments: [manualAssignment] });
      setAutoFixMsg(`Manual assignment complete! ${result.createdSchedules.length} schedule(s) created.`);
      setShowManualAssignment(null);
      await fetchConflicts(); // Refresh conflict list
    } catch (err: any) {
      setAutoFixMsg('Manual assignment failed: ' + (err?.message || 'Unknown error'));
    } finally {
      setAutoFixing(false);
    }
  };

  return (
    <div className="text-foreground max-w-4xl mx-auto p-6 relative z-10">
      {loading ? (
        <div className="text-center text-gray-700 dark:text-gray-200">Loading conflicts...</div>
      ) : currentConflicts.length === 0 ? (
        <div className="text-center text-gray-700 dark:text-gray-200">No {activeTab} conflicts detected in the next 30 days.</div>
      ) : (
        <>
          <div className="mb-4 flex justify-end">
            <button
              className="px-5 py-2 bg-primary text-primary-foreground rounded font-semibold hover:bg-primary/90 disabled:opacity-60"
              onClick={handleAutoFixAll}
              disabled={autoFixing}
            >
              {autoFixing ? 'Auto-Fixing...' : 'Auto-Fix All'}
            </button>
          </div>
          {autoFixMsg && (
            <div className="mb-4 p-3 bg-muted rounded text-center text-primary font-medium">{autoFixMsg}</div>
          )}
          <div className="space-y-4">
            {currentConflicts.map((conflict, idx) => (
              <div key={idx}>
                <div className="p-4 glass-static text-card-foreground flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-foreground">
                      <span className="text-primary font-bold">
                        {formatDateTime(conflict.date, moment.tz.guess(), 'MMM D, YYYY')}
                      </span>
                      {conflict.shiftType && <span className="ml-2 text-xs bg-muted text-gray-700 dark:text-gray-200 px-2 py-1 rounded">{conflict.shiftType}</span>}
                    </div>
                    <div className="text-gray-700 dark:text-gray-200 mt-1">{conflict.message}</div>
                  </div>
                  {/* Auto-fix/recommendation actions */}
                  <div className="flex gap-2">
                    <button
                      className="px-3 py-1 bg-primary text-primary-foreground rounded hover:bg-primary/90 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                      onClick={() => handleAutoFixSingle(conflict)}
                      disabled={autoFixing}
                    >
                      {autoFixing ? 'Fixing...' : 'Auto-Fix'}
                    </button>
                    <button
                      className="px-3 py-1 bg-muted text-gray-700 dark:text-gray-200 rounded hover:bg-muted/80 font-medium"
                      onClick={() => setShowManualAssignment(showManualAssignment === conflict.date ? null : conflict.date)}
                    >
                      Manual
                    </button>
                  </div>
                </div>

                {/* Manual Assignment Interface */}
                {showManualAssignment === conflict.date && (
                  <div className="mt-2 p-4 bg-muted/20 rounded-lg border border-border">
                    <h4 className="text-sm font-semibold text-foreground mb-3">
                      Manual Assignment for <span className="text-primary font-bold">{formatDateTime(conflict.date, moment.tz.guess(), 'MMM D, YYYY')}</span>
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {['Morning', 'Evening'].map((shiftType) => (
                        <div key={shiftType} className="space-y-2">
                          <label className="text-sm font-medium text-foreground">{shiftType} Shift</label>
                          <div className="flex gap-2">
                            <select
                              className="flex-1 px-3 py-1 bg-background border border-border rounded text-foreground"
                              onChange={(e) => {
                                if (e.target.value) {
                                  handleManualAssignment(conflict, e.target.value, shiftType);
                                }
                              }}
                              disabled={autoFixing}
                            >
                              <option value="">Select Analyst</option>
                              {analysts.map((analyst) => (
                                <option key={analyst.id} value={analyst.id}>
                                  {analyst.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
      <AutoFixPreview
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        onConfirm={handleConfirmAutoFix}
        proposals={proposals}
        isApplying={autoFixing}
      />
    </div>
  );
};

export default ConflictManagement; 