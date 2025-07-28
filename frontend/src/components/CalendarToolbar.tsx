import React from 'react';
import { Navigate, View, ToolbarProps } from 'react-big-calendar';
import moment from 'moment';

const CalendarToolbar = <TEvent extends object>({ onNavigate, onView, date, view, views }: ToolbarProps<TEvent>) => {
  const navigate = (action: 'PREV' | 'NEXT' | 'TODAY' | 'DATE', newDate?: Date) => {
    switch (action) {
      case 'PREV':
        onNavigate(Navigate.PREVIOUS);
        break;
      case 'NEXT':
        onNavigate(Navigate.NEXT);
        break;
      case 'TODAY':
        onNavigate(Navigate.TODAY);
        break;
      case 'DATE':
        if (newDate) onNavigate(Navigate.DATE, newDate);
        break;
      default:
        break;
    }
  };

  const generateTitle = () => {
    switch (view) {
      case 'day':
        return moment(date).format('MMMM D, YYYY');
      case 'week':
        const weekStart = moment(date).startOf('week').format('MMM D');
        const weekEnd = moment(date).endOf('week').format('MMM D');
        return `Week ${moment(date).format('W')}: ${weekStart} - ${weekEnd}`;
      case 'month':
      default:
        return moment(date).format('MMMM YYYY');
    }
  };

  const viewNames = Array.isArray(views) ? views : (Object.keys(views) as View[]);

  return (
    <div className="flex items-center justify-between p-4 bg-white rounded-t-2xl border-b">
      <div className="flex items-center space-x-2">
        <button
          type="button"
          className="px-4 py-2 text-sm font-medium text-red-600 bg-white border border-gray-300 rounded-md hover:bg-red-50"
          onClick={() => navigate('TODAY')}
        >
          Today
        </button>
        <button type="button" className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50" onClick={() => navigate('PREV')}>
          Back
        </button>
        <button type="button" className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50" onClick={() => navigate('NEXT')}>
          Next
        </button>
      </div>
      <div className="text-lg font-semibold text-gray-800">
        {generateTitle()}
      </div>
      <div>
        <div className="inline-flex rounded-md shadow-sm">
          {viewNames.map((viewName) => (
            <button
              key={viewName}
              type="button"
              className={`px-4 py-2 text-sm font-medium border ${
                view === viewName ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              } first:rounded-l-md last:rounded-r-md`}
              onClick={() => onView(viewName)}
            >
              {viewName.charAt(0).toUpperCase() + viewName.slice(1)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CalendarToolbar; 