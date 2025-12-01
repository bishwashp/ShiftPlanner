import React, { useState, useEffect } from 'react';
import { ChartBar } from '@phosphor-icons/react';
import { apiService } from '../../../services/api';
import { dateUtils } from '../../../utils/dateUtils';
import moment from 'moment';

const StaffingChart: React.FC = () => {
    const [chartData, setChartData] = useState<Array<{ date: string, count: number }>>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStaffingData = async () => {
            try {
                // Simple date formatting
                const startDate = moment().format('YYYY-MM-DD');
                const endDate = moment().add(30, 'days').format('YYYY-MM-DD');

                console.log('Fetching staffing data:', { startDate, endDate });
                const schedules = await apiService.getSchedules(startDate, endDate);
                console.log('Staffing schedules found:', schedules.length);

                if (schedules.length === 0) {
                    console.warn('No schedules found for staffing chart');
                    setChartData([]);
                    setLoading(false);
                    return;
                }

                // Group by date and count unique analysts
                const grouped = schedules.reduce((acc: any, s: any) => {
                    // Use UTC to prevent date shifting (e.g., 2025-12-05T00:00:00Z staying as Dec 5, not shifting to Dec 4 in CST)
                    const dateKey = moment.utc(s.date).format('YYYY-MM-DD');
                    if (!acc[dateKey]) {
                        acc[dateKey] = new Set();
                    }
                    acc[dateKey].add(s.analystId);
                    return acc;
                }, {});

                const data = Object.entries(grouped).map(([date, analysts]: [string, any]) => ({
                    date,
                    count: analysts.size
                })).sort((a, b) => moment(a.date).diff(moment(b.date)));

                console.log('Staffing chart data:', data.length, 'days');
                setChartData(data);
            } catch (error) {
                console.error('Failed to fetch staffing data', error);
            } finally {
                setLoading(false);
            }
        };

        fetchStaffingData();
    }, []);

    if (loading) return <div className="animate-pulse h-full bg-gray-100 dark:bg-white/5 rounded-lg" />;

    const maxCount = Math.max(...chartData.map(d => d.count), 1);
    const CHART_HEIGHT = 80; // 80px for the chart area

    return (
        <div className="h-full flex flex-col">
            <div className="flex items-center gap-2 mb-2 text-gray-500 dark:text-gray-400">
                <ChartBar className="w-4 h-4" />
                <span className="text-xs font-medium uppercase tracking-wider">Staffing Trend (30d)</span>
            </div>

            <div className="flex-1 flex items-end gap-0.5" style={{ height: `${CHART_HEIGHT}px` }}>
                {chartData.length > 0 ? (
                    chartData.slice(-30).map((d, i) => {
                        const barHeight = Math.max((d.count / maxCount) * CHART_HEIGHT, 8);
                        return (
                            <div
                                key={i}
                                className="flex-1 bg-indigo-500/20 hover:bg-indigo-500/30 rounded-t transition-colors relative group min-w-[2px]"
                                style={{ height: `${barHeight}px` }}
                                title={`${moment(d.date).format('MMM D')}: ${d.count} analysts`}
                            >
                                <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:block bg-gray-900 dark:bg-gray-700 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap z-10">
                                    {moment(d.date).format('MMM D')}: {d.count}
                                </div>
                            </div>
                        );
                    })
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">
                        No data
                    </div>
                )}
            </div>
        </div>
    );
};

export default StaffingChart;
