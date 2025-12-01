import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import { AbsenceImpactReport } from './AbsenceImpactReport';
import Button from './ui/Button';
import { CheckCircle, XCircle, Warning, Spinner } from '@phosphor-icons/react';
import moment from 'moment';
import { dateUtils } from '../utils/dateUtils';

interface Absence {
    id: string;
    analystId: string;
    startDate: string;
    endDate: string;
    type: string;
    reason?: string;
    analyst: {
        name: string;
        email: string;
    };
}

interface AbsenceApprovalDashboardProps {
    onUpdate?: () => void;
}

export const AbsenceApprovalDashboard: React.FC<AbsenceApprovalDashboardProps> = ({ onUpdate }) => {
    const [pendingAbsences, setPendingAbsences] = useState<Absence[]>([]);
    const [selectedAbsence, setSelectedAbsence] = useState<Absence | null>(null);
    const [impactReport, setImpactReport] = useState<any | null>(null);
    const [loading, setLoading] = useState(false);
    const [analyzing, setAnalyzing] = useState(false);

    useEffect(() => {
        fetchPendingAbsences();
    }, []);

    const fetchPendingAbsences = async () => {
        setLoading(true);
        try {
            // Fetch pending absences (isApproved=false)
            // Note: The API signature is getAbsences(analystId, type, isApproved, isPlanned)
            // We pass undefined for analystId and type, and 'false' for isApproved
            const data = await apiService.getAbsences(undefined, undefined, false);
            setPendingAbsences(data);
        } catch (error) {
            console.error('Error fetching pending absences:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSelectAbsence = async (absence: Absence) => {
        setSelectedAbsence(absence);
        setAnalyzing(true);
        try {
            const report = await apiService.analyzeAbsenceImpact({
                analystId: absence.analystId,
                startDate: absence.startDate,
                endDate: absence.endDate,
                type: absence.type
            });
            setImpactReport(report);
        } catch (error) {
            console.error('Error analyzing impact:', error);
        } finally {
            setAnalyzing(false);
        }
    };

    const handleApprove = async () => {
        if (!selectedAbsence) return;
        try {
            await apiService.approveAbsence(selectedAbsence.id, true);
            setSelectedAbsence(null);
            setImpactReport(null);
            fetchPendingAbsences();
            if (onUpdate) onUpdate();
        } catch (error) {
            console.error('Error approving absence:', error);
        }
    };

    const handleDeny = async () => {
        if (!selectedAbsence) return;
        if (!window.confirm('Are you sure you want to deny this request?')) return;
        try {
            // Deny by setting isApproved=false (which it already is, but maybe we want to delete or mark as rejected status?)
            // For now, let's assume we just leave it as pending or maybe delete?
            // The requirement says "automated recommendation for approving, rescheduling, or denying".
            // Usually denying means rejecting. If we just set isApproved=false it stays pending.
            // Let's assume we delete it for now as "Rejection".
            await apiService.deleteAbsence(selectedAbsence.id);
            setSelectedAbsence(null);
            setImpactReport(null);
            fetchPendingAbsences();
            if (onUpdate) onUpdate();
        } catch (error) {
            console.error('Error denying absence:', error);
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[600px]">
            {/* List of Pending Requests */}
            <div className="lg:col-span-1 bg-white/5 rounded-xl border border-white/10 overflow-hidden flex flex-col">
                <div className="p-4 border-b border-white/10 bg-white/5">
                    <h3 className="font-semibold text-lg">Pending Requests</h3>
                    <span className="text-xs text-gray-400">{pendingAbsences.length} requests waiting</span>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                    {loading ? (
                        <div className="flex justify-center p-4"><Spinner className="animate-spin" /></div>
                    ) : pendingAbsences.length === 0 ? (
                        <div className="text-center p-8 text-gray-500">No pending requests</div>
                    ) : (
                        pendingAbsences.map(absence => (
                            <div
                                key={absence.id}
                                onClick={() => handleSelectAbsence(absence)}
                                className={`p-3 rounded-lg cursor-pointer transition-colors ${selectedAbsence?.id === absence.id
                                    ? 'bg-blue-500/20 border-blue-500/50 border'
                                    : 'bg-white/5 hover:bg-white/10 border border-transparent'
                                    }`}
                            >
                                <div className="flex justify-between items-start mb-1">
                                    <span className="font-medium text-sm">{absence.analyst.name}</span>
                                    <span className="text-xs px-1.5 py-0.5 rounded bg-gray-700 text-gray-300">
                                        {absence.type}
                                    </span>
                                </div>
                                <div className="text-xs text-gray-400">
                                    {dateUtils.formatDisplayDate(absence.startDate, 'MMM D')} - {dateUtils.formatDisplayDate(absence.endDate, 'MMM D')}
                                </div>
                                <div className="text-xs text-gray-500 mt-1 truncate">
                                    {absence.reason || 'No reason provided'}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Impact Analysis Panel */}
            <div className="lg:col-span-2 bg-white/5 rounded-xl border border-white/10 overflow-hidden flex flex-col">
                {selectedAbsence ? (
                    <>
                        <div className="p-4 border-b border-white/10 bg-white/5 flex justify-between items-center">
                            <div>
                                <h3 className="font-semibold text-lg">Impact Analysis</h3>
                                <p className="text-xs text-gray-400">
                                    Analyzing request for {selectedAbsence.analyst.name}
                                </p>
                            </div>
                            <div className="flex space-x-2">
                                <Button variant="danger" size="sm" onClick={handleDeny}>
                                    <XCircle className="mr-1" /> Deny
                                </Button>
                                <Button variant="primary" size="sm" onClick={handleApprove}>
                                    <CheckCircle className="mr-1" /> Approve
                                </Button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6">
                            {analyzing ? (
                                <div className="flex flex-col items-center justify-center h-full text-gray-400">
                                    <Spinner className="animate-spin h-8 w-8 mb-2" />
                                    <p>Analyzing schedule impact...</p>
                                </div>
                            ) : impactReport ? (
                                <AbsenceImpactReport report={impactReport} />
                            ) : (
                                <div className="text-center text-gray-500 mt-10">
                                    Failed to load report
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-gray-500">
                        <Warning className="h-12 w-12 mb-4 opacity-20" />
                        <p>Select a request to analyze its impact</p>
                    </div>
                )}
            </div>
        </div>
    );
};
