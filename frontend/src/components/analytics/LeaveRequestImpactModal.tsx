import React, { useState, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { apiService, LeaveRequestImpact as ApiLeaveRequestImpact } from '../../services/api';

interface LeaveRequest {
  id: string;
  analystId: string;
  startDate: Date;
  endDate: Date;
  reason?: string;
}

interface LeaveRequestImpactModalProps {
  isOpen: boolean;
  onClose: () => void;
  request: LeaveRequest | null;
  onApprove: () => void;
  onReject: () => void;
  onModify: (dates: Date[]) => void;
}

const LeaveRequestImpactModal: React.FC<LeaveRequestImpactModalProps> = ({
  isOpen,
  onClose,
  request,
  onApprove,
  onReject,
  onModify
}) => {
  const [impact, setImpact] = useState<ApiLeaveRequestImpact | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && request) {
      calculateImpact();
    }
  }, [isOpen, request]);

  const calculateImpact = async () => {
    if (!request) return;

    try {
      setLoading(true);
      setError(null);

          const response = await apiService.calculateLeaveRequestImpact({
      analystId: request.analystId,
      startDate: new Date(request.startDate).toISOString(),
      endDate: new Date(request.endDate).toISOString(),
      reason: request.reason
    });

      setImpact(response);
    } catch (err) {
      console.error('Error calculating leave request impact:', err);
      setError('Failed to calculate impact');
    } finally {
      setLoading(false);
    }
  };

  const getRiskLevelColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'HIGH': return 'text-red-600 bg-red-100';
      case 'MEDIUM': return 'text-yellow-600 bg-yellow-100';
      case 'LOW': return 'text-green-600 bg-green-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getRiskLevelIcon = (riskLevel: string) => {
    switch (riskLevel) {
      case 'HIGH': return '🔴';
      case 'MEDIUM': return '🟡';
      case 'LOW': return '🟢';
      default: return '⚪';
    }
  };

  const formatPercentage = (value: number | undefined) => {
    if (value === undefined) return '0.0%';
    return `${(value * 100).toFixed(1)}%`;
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatDateRange = (startDate: Date, endDate: Date) => {
    return `${formatDate(startDate)} - ${formatDate(endDate)}`;
  };

  if (!isOpen || !request) {
    return null;
  }

  // Prepare chart data
  const fairnessData = impact ? [
    { name: 'Before', value: impact.fairnessImpact.beforeScore },
    { name: 'After', value: impact.fairnessImpact.afterScore }
  ] : [];

  const impactData = impact ? [
    { name: 'Fairness Impact', value: Math.abs(impact.fairnessImpact.change) }
  ] : [];

  const COLORS = ['#10B981', '#EF4444', '#3B82F6'];

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-4xl shadow-lg rounded-md bg-white">
        <div className="mt-3">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-lg font-medium text-gray-900">Leave Request Impact Analysis</h3>
              <p className="text-sm text-gray-600">
                {formatDateRange(request.startDate, request.endDate)}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {loading && (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-2 text-gray-600">Calculating impact...</span>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <div className="flex">
                <div className="text-red-600">
                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">Error</h3>
                  <p className="text-sm text-red-700 mt-1">{error}</p>
                </div>
              </div>
            </div>
          )}

          {impact && !loading && (
            <>
              {/* Impact Summary */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Before Leave</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {formatPercentage(impact.fairnessImpact.beforeScore)}
                      </p>
                    </div>
                    <div className="text-green-600">
                      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">After Leave</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {formatPercentage(impact.fairnessImpact.afterScore)}
                      </p>
                    </div>
                    <div className="text-blue-600">
                      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Risk Level</p>
                      <div className="flex items-center mt-1">
                        <span className="text-lg mr-2">{getRiskLevelIcon(impact.fairnessImpact.riskLevel)}</span>
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getRiskLevelColor(impact.fairnessImpact.riskLevel)}`}>
                          {impact.fairnessImpact.riskLevel}
                        </span>
                      </div>
                    </div>
                    <div className="text-orange-600">
                      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>

              {/* Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                {/* Fairness Comparison Chart */}
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4">Fairness Score Comparison</h4>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={fairnessData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip formatter={(value) => formatPercentage(value as number)} />
                      <Bar dataKey="value" fill="#3B82F6" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Impact Visualization */}
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4">Impact Assessment</h4>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={impactData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, value }) => `${name}: ${formatPercentage(value)}`}
                        outerRadius={60}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {impactData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => formatPercentage(value as number)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Recommendations */}
              <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
                <h4 className="text-lg font-semibold text-gray-900 mb-4">Recommendations</h4>
                {impact.recommendations.length > 0 ? (
                  <ul className="space-y-3">
                    {impact.recommendations.map((recommendation, index) => (
                      <li key={index} className="flex items-start">
                        <div className="flex-shrink-0">
                          <svg className="h-5 w-5 text-blue-600" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <p className="ml-3 text-sm text-gray-700">{recommendation}</p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-500">No specific recommendations available</p>
                )}
              </div>

              {/* Alternative Dates */}
              {impact.alternativeDates && impact.alternativeDates.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4">Alternative Date Suggestions</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {impact.alternativeDates.map((date, index) => (
                      <button
                        key={index}
                        onClick={() => onModify([new Date(date)])}
                        className="px-4 py-2 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {formatDate(new Date(date))}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end space-x-4">
                <button
                  onClick={onClose}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  Cancel
                </button>
                <button
                  onClick={onReject}
                  className="px-4 py-2 border border-red-300 rounded-md text-sm font-medium text-red-700 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  Reject Request
                </button>
                <button
                  onClick={onApprove}
                  className={`px-4 py-2 rounded-md text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    impact.fairnessImpact.riskLevel === 'HIGH'
                      ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
                      : impact.fairnessImpact.riskLevel === 'MEDIUM'
                      ? 'bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-500'
                      : 'bg-green-600 hover:bg-green-700 focus:ring-green-500'
                  }`}
                >
                  Approve Request
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default LeaveRequestImpactModal; 