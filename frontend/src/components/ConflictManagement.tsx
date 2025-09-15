import React, { useEffect, useState } from 'react';
import apiService from '../services/api';
import AutoFixPreview, { AssignmentProposal } from './AutoFixPreview';
import { formatDateTime } from '../utils/formatDateTime';
import moment from 'moment-timezone';

const tabs = [
  { key: 'critical', label: 'Critical' },
  { key: 'recommended', label: 'Recommended' },
];

const ConflictManagement: React.FC = () => {
  const [conflicts, setConflicts] = useState<{ critical: any[]; recommended: any[] }>({ critical: [], recommended: [] });
  const [selectedTab, setSelectedTab] = useState<'critical' | 'recommended'>('critical');
  const [loading, setLoading] = useState(true);
  const [autoFixing, setAutoFixing] = useState(false);
  const [autoFixMsg, setAutoFixMsg] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [proposals, setProposals] = useState<AssignmentProposal[]>([]);

  const fetchConflicts = async () => {
    setLoading(true);
    try {
      // Get conflicts for the next 30 days
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(startDate.getDate() + 30);

      const data = await apiService.getAllConflicts(
        startDate.toISOString().split('T')[0],
        endDate.toISOString().split('T')[0]
      );
      setConflicts(data);
    } catch (error) {
      console.error("Failed to fetch conflicts:", error);
      setConflicts({ critical: [], recommended: [] });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConflicts();
  }, []);

  const currentConflicts = conflicts[selectedTab] || [];

  const handleAutoFixAll = async () => {
    setAutoFixing(true);
    setAutoFixMsg(null);
    try {
      const startDate = new Date().toISOString().split('T')[0];
      const endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
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

  return (
    <div className="bg-background text-foreground max-w-4xl mx-auto p-6">
      <div className="flex space-x-2 mb-6">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setSelectedTab(tab.key as 'critical' | 'recommended')}
            className={`px-4 py-2 rounded-full font-semibold transition-all ${selectedTab === tab.key ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {loading ? (
        <div className="text-center text-muted-foreground">Loading conflicts...</div>
      ) : currentConflicts.length === 0 ? (
        <div className="text-center text-muted-foreground">No {selectedTab} conflicts detected in the next 30 days.</div>
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
              <div key={idx} className="p-4 bg-card text-card-foreground rounded-lg shadow border border-border flex items-center justify-between">
                <div>
                  <div className="font-semibold text-foreground">{formatDateTime(conflict.date, moment.tz.guess(), 'MMM D, YYYY')} {conflict.shiftType && <span className="ml-2 text-xs bg-muted px-2 py-1 rounded">{conflict.shiftType}</span>}</div>
                  <div className="text-muted-foreground mt-1">{conflict.message}</div>
                </div>
                {/* Placeholder for auto-fix/recommendation actions */}
                <div>
                  <button className="px-3 py-1 bg-primary text-primary-foreground rounded hover:bg-primary/90 font-medium">Auto-Fix</button>
                </div>
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