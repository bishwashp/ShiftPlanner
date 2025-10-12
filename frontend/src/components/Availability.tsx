import React from 'react';
import HolidayManagement from './HolidayManagement';
import AbsenceManagement from './AbsenceManagement';
import CompOffManagement from './CompOffManagement';

interface AvailabilityProps {
  timezone?: string;
  activeTab: 'holidays' | 'absences' | 'compoff';
  onTabChange: (tab: 'holidays' | 'absences' | 'compoff') => void;
}

const Availability: React.FC<AvailabilityProps> = ({ timezone = 'America/New_York', activeTab, onTabChange }) => {

  const renderView = () => {
    switch (activeTab) {
      case 'holidays':
        return <HolidayManagement timezone={timezone} />;
      case 'absences':
        return <AbsenceManagement />;
      case 'compoff':
        return <CompOffManagement />;
      default:
        return <HolidayManagement timezone={timezone} />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6">
        {/* Content */}
        <div className="bg-card rounded-lg border border-border shadow-sm">
          {renderView()}
        </div>
      </div>
    </div>
  );
};

export default Availability;
