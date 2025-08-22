import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';

interface MonthlyTally {
  analystId: string;
  analystName: string;
  workDays: number;
}

const Analytics: React.FC = () => {
  const [tallyData, setTallyData] = useState<MonthlyTally[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTally = async () => {
        try {
            setLoading(true);
            const data = await apiService.getWorkDayTally(selectedMonth, selectedYear);
            setTallyData(data);
        } catch (error) {
            console.error('Failed to fetch tally data', error);
        } finally {
            setLoading(false);
        }
    };
    fetchTally();
  }, [selectedMonth, selectedYear]);

  return (
    <div className="space-y-6 bg-background text-foreground p-6">
      <div className="flex items-center justify-end">
        <div className="flex space-x-3">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="px-3 py-2 border border-border rounded-lg bg-input focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                {new Date(2024, i).toLocaleDateString('en-US', { month: 'long' })}
              </option>
            ))}
          </select>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="px-3 py-2 border border-border rounded-lg bg-input focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {Array.from({ length: 5 }, (_, i) => (
              <option key={2024 - i} value={2024 - i}>
                {2024 - i}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-card text-card-foreground rounded-xl shadow-sm border border-border p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">Monthly Work Day Tally</h3>
        {loading ? <p className="text-muted-foreground">Loading data...</p> : (
          <div className="text-muted-foreground">
            The analytics chart is temporarily disabled. The data is being fetched correctly.
            <pre className="mt-4 p-4 bg-muted rounded text-sm text-muted-foreground">
              {JSON.stringify(tallyData, null, 2)}
            </pre>
          </div>
        )}
      </div>
      
    </div>
  );
};

export default Analytics; 