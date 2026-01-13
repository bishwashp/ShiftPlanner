import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import { AbsenceImpactReport } from './AbsenceImpactReport';
import Button from './ui/Button';
import { CheckCircle, XCircle, Warning, Spinner } from '@phosphor-icons/react';
import { LoadingSpinner } from './ui/LoadingSpinner';
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

    // Denial Modal State
    const [showDenialModal, setShowDenialModal] = useState(false);
    const [denialReason, setDenialReason] = useState('');
    const [denying, setDenying] = useState(false);

    useEffect(() => {
        fetchPendingAbsences();
    }, []);

    const fetchPendingAbsences = async () => {
        setLoading(true);
        try {
            // Fetch pending absences (status='PENDING')
            // Note: The API signature is getAbsences(analystId, type, isApproved, isPlanned, startDate, endDate, status)
            // We pass undefined for most, and 'PENDING' for status
            const data = await apiService.getAbsences(undefined, undefined, undefined, undefined, undefined, undefined, 'PENDING');
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

    const handleDenyClick = () => {
        if (!selectedAbsence) return;
        setDenialReason('');
        setShowDenialModal(true);
    };

    const handleConfirmDeny = async () => {
        if (!selectedAbsence) return;
        setDenying(true);
        try {
            // Call API to deny with reason
            // We use updateAbsence or a specific deny endpoint. 
            // Since apiService.approveAbsence takes a boolean, we might need to update it or use updateAbsence directly.
            // Let's assume we updated apiService.approveAbsence to take a reason or use updateAbsence.
            // Based on previous steps, we updated updateVacation but maybe not approveAbsence in apiService?
            // Let's check apiService.approveAbsence signature.
            // It seems we didn't update approveAbsence in apiService.ts in the previous step, only updateVacation.
            // But wait, the backend AbsenceService.approveAbsence WAS updated.
            // We should use updateVacation (which maps to PUT /vacations/:id) or updateAbsence if it exists.
            // In apiService.ts, there is updateVacation. Let's use that.

            await apiService.updateVacation(selectedAbsence.id, {
                isApproved: false,
                denialReason: denialReason,
                status: 'REJECTED'
            });

            setShowDenialModal(false);
            setSelectedAbsence(null);
            setImpactReport(null);
            fetchPendingAbsences();
            if (onUpdate) onUpdate();
        } catch (error) {
            console.error('Error denying absence:', error);
            alert('Failed to deny request. Please try again.');
        } finally {
            setDenying(false);
        }
    };

    return (
        <>
            <div className="flex h-full flex-col">
                <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 p-4">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Absence Approval</h2>
                    <div className="flex items-center space-x-2">
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                            {pendingAbsences.length} pending request{pendingAbsences.length !== 1 ? 's' : ''}
                        </span>
                        <Button variant="ghost" size="sm" onClick={fetchPendingAbsences} disabled={loading}>
                            Refresh
                        </Button>
                    </div>
                </div>

                <div className="flex flex-1 overflow-hidden">
                    {/* List of pending requests */}
                    <div className="w-1/3 border-r border-gray-200 dark:border-gray-700 overflow-y-auto">
                        {loading ? (
                            <div className="flex justify-center p-8">
                                <LoadingSpinner size="medium" />
                            </div>
                        ) : pendingAbsences.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                                <CheckCircle className="h-12 w-12 mb-4 text-green-500 opacity-20" />
                                <p>No pending requests</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-200 dark:divide-gray-700">
                                {pendingAbsences.map((absence) => (
                                    <div
                                        key={absence.id}
                                        className={`p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${selectedAbsence?.id === absence.id ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-primary' : ''
                                            }`}
                                        onClick={() => handleSelectAbsence(absence)}
                                    >
                                        <div className="flex justify-between items-start mb-1">
                                            <span className="font-medium text-gray-900 dark:text-white">
                                                {absence.analyst.name}
                                            </span>
                                            <span className={`text-xs px-2 py-0.5 rounded-full ${absence.type === 'VACATION' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                                                }`}>
                                                {absence.type}
                                            </span>
                                        </div>
                                        <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                                            {dateUtils.formatDisplayDate(absence.startDate)} - {dateUtils.formatDisplayDate(absence.endDate)}
                                        </div>
                                        <div className="text-xs text-gray-400">
                                            {dateUtils.getDurationInDays(absence.startDate, absence.endDate)} days
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Detail View */}
                    <div className="flex-1 flex flex-col bg-gray-50 dark:bg-gray-900/50">
                        {selectedAbsence ? (
                            <>
                                <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                                                {selectedAbsence.analyst.name}
                                            </h3>
                                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                                {selectedAbsence.analyst.email}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                                                {dateUtils.formatDisplayDate(selectedAbsence.startDate)} - {dateUtils.formatDisplayDate(selectedAbsence.endDate)}
                                            </div>
                                            <div className="text-sm text-gray-500">
                                                {dateUtils.getDurationInDays(selectedAbsence.startDate, selectedAbsence.endDate)} days ({selectedAbsence.type})
                                            </div>
                                        </div>
                                    </div>

                                    {selectedAbsence.reason ? (
                                        <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg text-sm text-gray-700 dark:text-gray-300">
                                            <span className="font-semibold">Reason:</span> {selectedAbsence.reason}
                                        </div>
                                    ) : null}

                                    <div className="mt-6 flex space-x-3">
                                        <Button variant="danger" size="sm" onClick={handleDenyClick}>
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
                                            <LoadingSpinner size="medium" text="Analyzing schedule impact..." />
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
            </div>

            {/* Denial Reason Modal */}
            {showDenialModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md p-6 border border-gray-200 dark:border-gray-700">
                        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Deny Request</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                            Please provide a reason for denying this request. This will be sent to the analyst.
                        </p>
                        <textarea
                            className="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none resize-none h-32"
                            placeholder="Enter denial reason..."
                            value={denialReason}
                            onChange={(e) => setDenialReason(e.target.value)}
                        />
                        <div className="flex justify-end space-x-3 mt-6">
                            <Button
                                variant="secondary"
                                onClick={() => setShowDenialModal(false)}
                                disabled={denying}
                            >
                                Cancel
                            </Button>
                            <Button
                                variant="danger"
                                onClick={handleConfirmDeny}
                                disabled={denying || !denialReason.trim()}
                            >
                                {denying ? <Spinner className="animate-spin mr-2" /> : null}
                                Confirm Denial
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};
