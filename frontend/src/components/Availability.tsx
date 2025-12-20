import React from 'react';
import { useLocation } from 'react-router-dom';
import HolidayManagement from './HolidayManagement';
import AbsenceManagement from './AbsenceManagement';

interface AvailabilityProps {
  timezone?: string;
  activeTab: 'holidays' | 'absences';
  onTabChange: (tab: 'holidays' | 'absences') => void;
}



const Availability: React.FC<AvailabilityProps> = ({ timezone = 'America/New_York', activeTab, onTabChange }) => {
  const location = useLocation();

  const renderView = () => {
    switch (activeTab) {
      case 'holidays':
        return <HolidayManagement timezone={timezone} />;
      case 'absences':
        // Force remount when query params change to ensure deep linking works reliably
        return <AbsenceManagement key={location.search} />;
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
