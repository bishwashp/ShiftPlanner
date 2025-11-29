import React, { useState, useEffect } from 'react';
import { ChartBar } from '@phosphor-icons/react';
import { apiService } from '../../../services/api';
import moment from 'moment';

const StaffingChart: React.FC = () => {
    const [chartData, setChartData] = useState<Array<{ date: string, count: number }>>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStaffingData = async () => {
            try {
                const startDate = moment().subtract(30, 'days').format('YYYY-MM-DD');
                const endDate = moment().format('YYYY-MM-DD');
                const schedules = await apiService.getSchedules(startDate, endDate);

                // Group by date and count unique analysts
                const grouped = schedules.reduce((acc: any, s: any) => {
                    if (!acc[s.date]) {
                        acc[s.date] = new Set();
                    }
                    acc[s.date].add(s.analystId);
                    return acc;
                }, {});

                const data = Object.entries(grouped).map(([date, analysts]: [string, any]) => ({
                    date,
                    count: analysts.size
                })).sort((a, b) => moment(a.date).diff(moment(b.date)));

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

    return (
        <div className="h-full flex flex-col">
            <div className="flex items-center gap-2 mb-2 text-gray-500 dark:text-gray-400">
                <ChartBar className="w-4 h-4" />
                <span className="text-xs font-medium uppercase tracking-wider">Staffing Trend (30d)</span>
            </div>

            <div className="flex-1 flex items-end gap-0.5">
                {chartData.slice(-30).map((d, i) => (
                    <div
                        key={i}
                        className="flex-1 bg-indigo-500/20 hover:bg-indigo-500/30 rounded-t transition-colors relative group"
                        style={{ height: `${(d.count / maxCount) * 100}%` }}
                        title={`${moment(d.date).format('MMM D')}: ${d.count} analysts`}
                    >
                        <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:block bg-gray-900 dark:bg-gray-700 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap">
                            {moment(d.date).format('MMM D')}: {d.count}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default StaffingChart;
