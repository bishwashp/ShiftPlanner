import React from 'react';

// Defines the structure of a single assignment proposal
export interface AssignmentProposal {
  date: string;
  shiftType: 'MORNING' | 'EVENING';
  analystId: string;
  analystName: string;
  action: 'add' | 'remove' | 'swap' | 'move' | 'regenerate';
  reason: string;
  scheduleIdToRemove?: string;
}

// Defines the props for the AutoFixPreview component
interface AutoFixPreviewProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  proposals: AssignmentProposal[];
  isApplying: boolean;
}

// Maps action types to human-readable labels and colors
const actionDisplay: { [key in AssignmentProposal['action']]: { label: string; color: string } } = {
  add: { label: 'Add', color: 'bg-green-100 text-green-800' },
  remove: { label: 'Remove', color: 'bg-red-100 text-red-800' },
  swap: { label: 'Swap', color: 'bg-yellow-100 text-yellow-800' },
  move: { label: 'Move', color: 'bg-blue-100 text-blue-800' },
  regenerate: { label: 'Regenerate', color: 'bg-purple-100 text-purple-800' },
};

const AutoFixPreview: React.FC<AutoFixPreviewProps> = ({ isOpen, onClose, onConfirm, proposals, isApplying }) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl">
        <h2 className="text-xl font-bold mb-4">Confirm Auto-Fix Assignments</h2>
        <p className="text-sm text-gray-600 mb-4">
          The following {proposals.length} assignment(s) are proposed to resolve the conflicts. Review the changes and confirm to apply them.
        </p>

        <div className="max-h-96 overflow-y-auto border rounded-md">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Shift</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Analyst</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reason</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {proposals.map((p, index) => {
                const display = actionDisplay[p.action] || { label: 'N/A', color: 'bg-gray-100 text-gray-800' };
                return (
                  <tr key={index}>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${display.color}`}>
                        {display.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-800">{p.date}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-800">{p.shiftType}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-800">{p.analystName}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{p.reason}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-6 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 disabled:opacity-50"
            disabled={isApplying}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            disabled={isApplying}
          >
            {isApplying ? 'Applying...' : 'Confirm & Apply'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AutoFixPreview; 