import React, { useState, useEffect, useCallback } from 'react';
import { apiService, Schedule, Analyst } from '../services/api';
import moment from 'moment-timezone';
import Checkbox from './ui/Checkbox';

interface CalendarExportProps {
  onError?: (error: string) => void;
  onSuccess?: (message: string) => void;
  isLoading?: (loading: boolean) => void;
}

interface ExportFormat {
  id: string;
  name: string;
  description: string;
  icon: string;
  extension: string;
}

interface ExternalCalendar {
  id: string;
  name: string;
  description: string;
  icon: string;
  url: string;
}

const CalendarExport: React.FC<CalendarExportProps> = ({
  onError,
  onSuccess,
  isLoading
}) => {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [analysts, setAnalysts] = useState<Analyst[]>([]);
  const [selectedAnalysts, setSelectedAnalysts] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState({
    start: moment().startOf('month').format('YYYY-MM-DD'),
    end: moment().endOf('month').format('YYYY-MM-DD')
  });
  const [exportFormat, setExportFormat] = useState<string>('ical');
  const [isExporting, setIsExporting] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookEnabled, setWebhookEnabled] = useState(false);

  const exportFormats: ExportFormat[] = [
    {
      id: 'ical',
      name: 'iCal (.ics)',
      description: 'Standard calendar format compatible with most calendar applications',
      icon: '📅',
      extension: '.ics'
    },
    {
      id: 'csv',
      name: 'CSV',
      description: 'Spreadsheet format for data analysis',
      icon: '📊',
      extension: '.csv'
    },
    {
      id: 'json',
      name: 'JSON',
      description: 'Machine-readable format for API integration',
      icon: '🔧',
      extension: '.json'
    },
    {
      id: 'xml',
      name: 'XML',
      description: 'Structured format for enterprise systems',
      icon: '📋',
      extension: '.xml'
    }
  ];

  const externalCalendars: ExternalCalendar[] = [
    {
      id: 'google',
      name: 'Google Calendar',
      description: 'Export directly to Google Calendar',
      icon: '📱',
      url: 'https://calendar.google.com'
    },
    {
      id: 'outlook',
      name: 'Microsoft Outlook',
      description: 'Export to Outlook calendar',
      icon: '💼',
      url: 'https://outlook.live.com'
    },
    {
      id: 'apple',
      name: 'Apple Calendar',
      description: 'Export to Apple Calendar',
      icon: '🍎',
      url: 'https://www.icloud.com'
    }
  ];

  const fetchData = useCallback(async () => {
    try {
      if (isLoading) isLoading(true);
      
      const [schedulesData, analystsData] = await Promise.all([
        apiService.getSchedules(dateRange.start, dateRange.end),
        apiService.getAnalysts()
      ]);
      
      setSchedules(schedulesData);
      setAnalysts(analystsData.filter(a => a.isActive));
      setSelectedAnalysts(analystsData.filter(a => a.isActive).map(a => a.id));
      
    } catch (err) {
      console.error('Error fetching data:', err);
      if (onError) onError('Failed to load data for export');
    } finally {
      if (isLoading) isLoading(false);
    }
  }, [dateRange.start, dateRange.end, isLoading, onError]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleExport = async () => {
    try {
      setIsExporting(true);
      if (isLoading) isLoading(true);

      const filteredSchedules = schedules.filter(schedule => 
        selectedAnalysts.includes(schedule.analystId)
      );

      const format = exportFormats.find(f => f.id === exportFormat);
      if (!format) throw new Error('Invalid export format');

      // Call the backend export API
      const response = await apiService.exportCalendar({
        schedules: filteredSchedules,
        format: exportFormat,
        dateRange,
        analysts: analysts.filter(a => selectedAnalysts.includes(a.id))
      });

      // Create and download the file
      const blob = new Blob([response.data], { 
        type: format.id === 'ical' ? 'text/calendar' : 'application/json' 
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `shiftplanner-export-${moment().format('YYYY-MM-DD')}${format.extension}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      if (onSuccess) onSuccess(`Calendar exported successfully as ${format.name}`);
      
    } catch (err) {
      console.error('Export error:', err);
      if (onError) onError('Failed to export calendar');
    } finally {
      setIsExporting(false);
      if (isLoading) isLoading(false);
    }
  };

  const handleExternalCalendarExport = async (calendar: ExternalCalendar) => {
    try {
      if (isLoading) isLoading(true);

      // For now, we'll open the external calendar in a new tab
      // In a real implementation, you'd use the specific API for each calendar
      window.open(calendar.url, '_blank');
      
      if (onSuccess) onSuccess(`Opening ${calendar.name} for manual import`);
      
    } catch (err) {
      console.error('External calendar export error:', err);
      if (onError) onError(`Failed to export to ${calendar.name}`);
    } finally {
      if (isLoading) isLoading(false);
    }
  };

  const handleWebhookSetup = async () => {
    try {
      if (!webhookUrl) {
        if (onError) onError('Please enter a webhook URL');
        return;
      }

      if (isLoading) isLoading(true);

      // Register webhook with backend
      await apiService.setupWebhook({
        url: webhookUrl,
        events: ['schedule.created', 'schedule.updated', 'schedule.deleted'],
        enabled: webhookEnabled
      });

      if (onSuccess) onSuccess('Webhook configured successfully');
      
    } catch (err) {
      console.error('Webhook setup error:', err);
      if (onError) onError('Failed to configure webhook');
    } finally {
      if (isLoading) isLoading(false);
    }
  };

  const handleSelectAllAnalysts = () => {
    setSelectedAnalysts(analysts.map(a => a.id));
  };

  const handleDeselectAllAnalysts = () => {
    setSelectedAnalysts([]);
  };

  return (
    <div className="space-y-6 p-6 bg-background text-foreground">
      {/* Header */}
      <div className="border-b border-border pb-4">
        <h2 className="text-2xl font-bold text-foreground">Calendar Export & Integration</h2>
        <p className="text-muted-foreground mt-2">
          Export schedules to various formats and integrate with external calendar systems
        </p>
      </div>

      {/* Date Range Selection */}
      <div className="bg-card border border-border rounded-lg p-4">
        <h3 className="text-lg font-semibold mb-4">Date Range</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Start Date</label>
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">End Date</label>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Analyst Selection */}
      <div className="bg-card border border-border rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Analysts</h3>
          <div className="space-x-2">
            <button
              onClick={handleSelectAllAnalysts}
              className="px-3 py-1 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
            >
              Select All
            </button>
            <button
              onClick={handleDeselectAllAnalysts}
              className="px-3 py-1 text-sm bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/90 transition-colors"
            >
              Deselect All
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {analysts.map(analyst => (
            <div key={analyst.id} className="flex items-center space-x-2 cursor-pointer">
              <Checkbox
                checked={selectedAnalysts.includes(analyst.id)}
                onChange={(checked) => {
                  if (checked) {
                    setSelectedAnalysts(prev => [...prev, analyst.id]);
                  } else {
                    setSelectedAnalysts(prev => prev.filter(id => id !== analyst.id));
                  }
                }}
              />
              <span className="text-sm text-foreground">{analyst.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Export Format Selection */}
      <div className="bg-card border border-border rounded-lg p-4">
        <h3 className="text-lg font-semibold mb-4">Export Format</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {exportFormats.map(format => (
            <label
              key={format.id}
              className={`relative cursor-pointer border-2 rounded-lg p-4 transition-all ${
                exportFormat === format.id
                  ? 'border-primary bg-primary/10 dark:bg-primary/20'
                  : 'border-border hover:border-primary/50 hover:bg-muted/50'
              }`}
            >
              <input
                type="radio"
                name="exportFormat"
                value={format.id}
                checked={exportFormat === format.id}
                onChange={(e) => setExportFormat(e.target.value)}
                className="sr-only"
              />
              <div className="text-center">
                <div className="text-2xl mb-2">{format.icon}</div>
                <div className="font-medium">{format.name}</div>
                <div className="text-xs text-muted-foreground mt-1">{format.description}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Export Button */}
      <div className="bg-card border border-border rounded-lg p-4">
        <button
          onClick={handleExport}
          disabled={isExporting || selectedAnalysts.length === 0}
          className="w-full py-3 px-4 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
        >
          {isExporting ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground"></div>
              <span>Exporting...</span>
            </>
          ) : (
            <>
              <span>📤</span>
              <span>Export Calendar</span>
            </>
          )}
        </button>
      </div>

      {/* External Calendar Integration */}
      <div className="bg-card border border-border rounded-lg p-4">
        <h3 className="text-lg font-semibold mb-4">External Calendar Integration</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {externalCalendars.map(calendar => (
            <button
              key={calendar.id}
              onClick={() => handleExternalCalendarExport(calendar)}
              className="flex items-center space-x-3 p-4 border border-border rounded-lg hover:border-primary/50 hover:bg-primary/5 dark:hover:bg-primary/10 transition-all"
            >
              <span className="text-2xl">{calendar.icon}</span>
              <div className="text-left">
                <div className="font-medium">{calendar.name}</div>
                <div className="text-xs text-muted-foreground">{calendar.description}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Webhook Configuration */}
      <div className="bg-card border border-border rounded-lg p-4">
        <h3 className="text-lg font-semibold mb-4">Webhook Integration</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Webhook URL</label>
            <input
              type="url"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://your-app.com/webhook"
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              checked={webhookEnabled}
              onChange={(checked) => setWebhookEnabled(checked)}
            />
            <span className="text-sm text-foreground">
              Enable webhook notifications for schedule changes
            </span>
          </div>
          <button
            onClick={handleWebhookSetup}
            className="px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/90 transition-colors"
          >
            Configure Webhook
          </button>
        </div>
      </div>
    </div>
  );
};

export default CalendarExport; 