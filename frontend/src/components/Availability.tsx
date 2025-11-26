import React from 'react';
import HolidayManagement from './HolidayManagement';
import AbsenceManagement from './AbsenceManagement';

interface AvailabilityProps {
  timezone?: string;
  activeTab: 'holidays' | 'absences';
  onTabChange: (tab: 'holidays' | 'absences') => void;
}

const Availability: React.FC<AvailabilityProps> = ({ timezone = 'America/New_York', activeTab, onTabChange }) => {

  const renderView = () => {
    switch (activeTab) {
      case 'holidays':
        return <HolidayManagement timezone={timezone} />;
      case 'absences':
        return <AbsenceManagement />;
      default:
        return <HolidayManagement timezone={timezone} />;
    }
  };

  return (
    <div className="min-h-screen relative z-10">
      <div className="container mx-auto px-4 py-6">
        {/* Content */}
        {renderView()}
      </div>
    </div>
  );
};

export default Availability;
