import React from 'react';
import { useLocation } from 'react-router-dom';
import { CalendarX, CheckSquare, TreePalm } from '@phosphor-icons/react';
import HolidayManagement from './HolidayManagement';
import AbsenceManagement from './AbsenceManagement';
import { AbsenceApprovalDashboard } from './AbsenceApprovalDashboard';
import CompOffManagement from './CompOffManagement';
import SegmentedControl from './ui/SegmentedControl';
import HeaderActionPortal from './layout/HeaderActionPortal';
import { useAuth } from '../contexts/AuthContext';

interface AvailabilityProps {
  timezone?: string;
  activeTab: 'absences' | 'approval' | 'holidays' | 'compoff';
  onTabChange: (tab: 'absences' | 'approval' | 'holidays' | 'compoff') => void;
}

const Availability: React.FC<AvailabilityProps> = ({ timezone = 'America/New_York', activeTab, onTabChange }) => {
  const location = useLocation();
  const { isManager } = useAuth();

  // Role-based tab options
  // Manager: Absences | Approval | Holidays
  // Analyst: Absences | Holidays
  const tabOptions = isManager
    ? [
      { value: 'absences', label: 'Absences', icon: <CalendarX className="w-4 h-4" /> },
      { value: 'approval', label: 'Approval', icon: <CheckSquare className="w-4 h-4" /> },
      { value: 'holidays', label: 'Holidays', icon: <TreePalm className="w-4 h-4" /> },
    ]
    : [
      { value: 'absences', label: 'Absences', icon: <CalendarX className="w-4 h-4" /> },
      { value: 'holidays', label: 'Holidays', icon: <TreePalm className="w-4 h-4" /> },
    ];

  const renderView = () => {
    switch (activeTab) {
      case 'holidays':
        return <HolidayManagement timezone={timezone} />;
      case 'absences':
        // Force remount when query params change to ensure deep linking works reliably
        return <AbsenceManagement key={location.search} />;
      case 'approval':
        return <AbsenceApprovalDashboard onUpdate={() => { }} />;
      case 'compoff':
        return <CompOffManagement />;
      default:
        return <AbsenceManagement />;
    }
  };

  return (
    <div className="min-h-screen relative z-10">
      <div className="container mx-auto px-4 py-6">
        {/* Tab Navigation Portal to Header - only show when not in compoff view */}
        {activeTab !== 'compoff' && (
          <HeaderActionPortal targetId="app-header-right-actions">
            <SegmentedControl
              value={activeTab}
              onChange={(val) => onTabChange(val as 'absences' | 'approval' | 'holidays')}
              options={tabOptions}
              className="shadow-sm border border-gray-200/50 dark:border-white/10"
            />
          </HeaderActionPortal>
        )}

        {/* Content */}
        {renderView()}
      </div>
    </div>
  );
};

export default Availability;
