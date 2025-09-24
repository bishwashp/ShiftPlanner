import React from 'react';
import { View as AppView } from './layout/CollapsibleSidebar';

// Use simplified calendar as the primary implementation
import SimplifiedScheduleView from './calendar/simplified/SimplifiedScheduleView';

// Simplified interface - no more legacy complexity
interface ScheduleViewProps {
  onViewChange: (view: AppView) => void;
  date: Date;
  setDate: (date: Date) => void;
  view: 'month' | 'week' | 'day';
  setView: (view: 'month' | 'week' | 'day') => void;
  timezone: string;
  onError?: (error: string) => void;
  onSuccess?: (message: string) => void;
  isLoading?: (loading: boolean) => void;
}

const ScheduleView: React.FC<ScheduleViewProps> = (props) => {
  // Direct passthrough to simplified calendar - no legacy system
  return (
    <SimplifiedScheduleView
      {...props}
    />
  );
};

export default ScheduleView;