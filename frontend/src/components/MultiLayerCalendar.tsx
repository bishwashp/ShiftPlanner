import React, { useState, useEffect } from 'react';
import { CalendarLayer, CalendarEvent, Conflict, DateRange } from '../types/calendar';
import apiService from '../services/api';

interface MultiLayerCalendarProps {
  dateRange: DateRange;
  layers: CalendarLayer[];
  onLayerToggle: (layerId: string, enabled: boolean) => void;
  onEventClick: (event: CalendarEvent) => void;
  viewType: 'day' | 'week' | 'month';
}

const MultiLayerCalendar: React.FC<MultiLayerCalendarProps> = ({
  dateRange,
  layers,
  onLayerToggle,
  onEventClick,
  viewType
}) => {
  const [layerData, setLayerData] = useState<Record<string, CalendarEvent[]>>({});
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  // Load layer data when layers or date range changes
  useEffect(() => {
    const loadLayerData = async () => {
      setLoading(true);
      try {
        const enabledLayers = layers.filter(layer => layer.enabled);
        const newLayerData: Record<string, CalendarEvent[]> = {};
        
        // Load data for each enabled layer
        for (const layer of enabledLayers) {
          try {
            const data = await apiService.getLayerData(
              layer.id,
              dateRange.startDate,
              dateRange.endDate
            );
            newLayerData[layer.id] = data.events || [];
          } catch (error) {
            console.error(`Error loading data for layer ${layer.id}:`, error);
            newLayerData[layer.id] = [];
          }
        }
        
        setLayerData(newLayerData);
        
        // Load conflicts
        try {
          const conflictsData = await apiService.getLayerConflicts(
            dateRange.startDate,
            dateRange.endDate
          );
          setConflicts(conflictsData.conflicts || []);
        } catch (error) {
          console.error('Error loading conflicts:', error);
          setConflicts([]);
        }
      } catch (error) {
        console.error('Error loading calendar data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadLayerData();
  }, [layers, dateRange]);

  const handleEventClick = (event: CalendarEvent) => {
    setSelectedEvent(event);
    onEventClick(event);
  };

  const getEventStyle = (event: CalendarEvent, layer: CalendarLayer) => {
    const baseStyle = {
      backgroundColor: layer.color,
      opacity: layer.opacity,
      border: '1px solid rgba(0, 0, 0, 0.1)',
      borderRadius: '4px',
      padding: '4px 8px',
      margin: '2px 0',
      cursor: 'pointer',
      fontSize: '12px',
      color: '#fff',
      textShadow: '0 1px 2px rgba(0, 0, 0, 0.3)',
      transition: 'all 0.2s ease',
    };

    // Add conflict styling
    const hasConflict = conflicts.some(conflict => 
      conflict.scheduleId === event.id || 
      conflict.constraintId === event.id ||
      new Date(conflict.date).toDateString() === new Date(event.startDate).toDateString()
    );

    if (hasConflict) {
      return {
        ...baseStyle,
        border: '2px solid #ef4444',
        boxShadow: '0 0 0 2px rgba(239, 68, 68, 0.3)',
      };
    }

    return baseStyle;
  };

  const renderDayView = () => {
    const startDate = new Date(dateRange.startDate);
    const events = Object.values(layerData).flat();
    
    return (
      <div className="min-h-[600px] p-4">
        <div className="mb-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {startDate.toLocaleDateString('en-US', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </h2>
        </div>
        
        <div className="space-y-2">
          {events.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              {loading ? 'Loading events...' : 'No events for this day'}
            </div>
          ) : (
            events.map((event) => {
              const layer = layers.find(l => l.id === event.layer);
              if (!layer) return null;
              
              return (
                <div
                  key={event.id}
                  style={getEventStyle(event, layer)}
                  onClick={() => handleEventClick(event)}
                  className="hover:opacity-80"
                >
                  <div className="font-medium">{event.title}</div>
                  <div className="text-xs opacity-90">
                    {new Date(event.startDate).toLocaleTimeString([], { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  };

  const renderWeekView = () => {
    const startDate = new Date(dateRange.startDate);
    const endDate = new Date(dateRange.endDate);
    const days = [];
    
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      days.push(new Date(d));
    }

    return (
      <div className="min-h-[400px] p-4">
        <div className="grid grid-cols-7 gap-2">
          {days.map((day) => {
            const dayEvents = Object.values(layerData)
              .flat()
              .filter(event => {
                const eventDate = new Date(event.startDate);
                return eventDate.toDateString() === day.toDateString();
              });

            return (
              <div key={day.toISOString()} className="border border-gray-200 dark:border-gray-700 rounded-lg p-2 min-h-[120px]">
                <div className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                  {day.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' })}
                </div>
                <div className="space-y-1">
                  {dayEvents.slice(0, 3).map((event) => {
                    const layer = layers.find(l => l.id === event.layer);
                    if (!layer) return null;
                    
                    return (
                      <div
                        key={event.id}
                        style={getEventStyle(event, layer)}
                        onClick={() => handleEventClick(event)}
                        className="text-xs hover:opacity-80"
                      >
                        {event.title}
                      </div>
                    );
                  })}
                  {dayEvents.length > 3 && (
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      +{dayEvents.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderMonthView = () => {
    const startDate = new Date(dateRange.startDate);
    const endDate = new Date(dateRange.endDate);
    const days = [];
    
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      days.push(new Date(d));
    }

    return (
      <div className="min-h-[500px] p-4">
        <div className="grid grid-cols-7 gap-1">
          {/* Day headers */}
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="text-center text-sm font-medium text-gray-700 dark:text-gray-300 py-2">
              {day}
            </div>
          ))}
          
          {/* Calendar days */}
          {days.map((day) => {
            const dayEvents = Object.values(layerData)
              .flat()
              .filter(event => {
                const eventDate = new Date(event.startDate);
                return eventDate.toDateString() === day.toDateString();
              });

            const hasConflict = conflicts.some(conflict => 
              new Date(conflict.date).toDateString() === day.toDateString()
            );

            return (
              <div 
                key={day.toISOString()} 
                className={`border border-gray-200 dark:border-gray-700 p-1 min-h-[80px] ${
                  hasConflict ? 'bg-red-50 dark:bg-red-900/20' : ''
                }`}
              >
                <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                  {day.getDate()}
                </div>
                <div className="space-y-1">
                  {dayEvents.slice(0, 2).map((event) => {
                    const layer = layers.find(l => l.id === event.layer);
                    if (!layer) return null;
                    
                    return (
                      <div
                        key={event.id}
                        style={{
                          ...getEventStyle(event, layer),
                          fontSize: '10px',
                          padding: '2px 4px',
                          margin: '1px 0'
                        }}
                        onClick={() => handleEventClick(event)}
                        className="hover:opacity-80 truncate"
                        title={event.title}
                      >
                        {event.title}
                      </div>
                    );
                  })}
                  {dayEvents.length > 2 && (
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      +{dayEvents.length - 2}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderView = () => {
    switch (viewType) {
      case 'day':
        return renderDayView();
      case 'week':
        return renderWeekView();
      case 'month':
        return renderMonthView();
      default:
        return renderDayView();
    }
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg shadow-md">
      {loading && (
        <div className="flex items-center justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-gray-600 dark:text-gray-400">Loading calendar...</span>
        </div>
      )}
      
      {!loading && renderView()}
      
      {/* Event Details Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Event Details
            </h3>
            <div className="space-y-2">
              <p><strong>Title:</strong> {selectedEvent.title}</p>
              <p><strong>Type:</strong> {selectedEvent.type}</p>
              <p><strong>Start:</strong> {new Date(selectedEvent.startDate).toLocaleString()}</p>
              <p><strong>End:</strong> {new Date(selectedEvent.endDate).toLocaleString()}</p>
              {selectedEvent.description && (
                <p><strong>Description:</strong> {selectedEvent.description}</p>
              )}
            </div>
            <div className="mt-6 flex justify-end space-x-2">
              <button
                onClick={() => setSelectedEvent(null)}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-md transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MultiLayerCalendar; 