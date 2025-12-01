import React, { useState, useMemo } from 'react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    ReferenceLine
} from 'recharts';
import { Schedule, Analyst } from '../../services/api';
import { Period } from '../../context/PeriodContext';
import moment from 'moment-timezone';
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/solid';

interface WorkloadTrendChartProps {
    schedules: Schedule[];
    analysts: Analyst[];
    period: Period;
    dateOffset: number;
}

export const WorkloadTrendChart: React.FC<WorkloadTrendChartProps> = ({
    schedules,
    analysts,
    period,
    dateOffset
}) => {
    const [selectedAnalyst, setSelectedAnalyst] = useState<string>('ALL');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);

    // Process Data based on Selection
    const { chartData, avgShifts, avgScreener, avgWeekend } = useMemo(() => {
        let processedData: any[] = [];
        let totalShifts = 0;
        let totalScreener = 0;
        let totalWeekend = 0;
        let count = 0;

        if (selectedAnalyst === 'ALL') {
            // View: Workload Distribution per Analyst (Existing Logic)
            const analystStats: Record<string, { name: string, regular: number, screener: number, weekend: number, total: number }> = {};

            // Initialize
            analysts.forEach(a => {
                analystStats[a.id] = { name: a.name, regular: 0, screener: 0, weekend: 0, total: 0 };
            });

            schedules.forEach(s => {
                if (!analystStats[s.analystId]) {
                    const analyst = analysts.find(a => a.id === s.analystId);
                    analystStats[s.analystId] = { name: analyst?.name || 'Unknown', regular: 0, screener: 0, weekend: 0, total: 0 };
                }

                const m = moment.utc(s.date);
                const isWeekend = m.day() === 0 || m.day() === 6;

                if (isWeekend) {
                    analystStats[s.analystId].weekend++;
                } else if (s.isScreener) {
                    analystStats[s.analystId].screener++;
                } else {
                    analystStats[s.analystId].regular++;
                }
                analystStats[s.analystId].total++;
            });

            processedData = Object.values(analystStats).sort((a, b) => b.total - a.total);

            // Averages for ALL view (Average per analyst)
            count = analysts.length;
            processedData.forEach(d => {
                totalShifts += d.total;
                totalScreener += d.screener;
                totalWeekend += d.weekend;
            });

        } else {
            // View: Time Distribution for Specific Analyst
            const analystSchedules = schedules.filter(s => s.analystId === selectedAnalyst);

            // Define Time Units based on Period
            let dateFormat = 'YYYY-MM-DD';
            let displayFormat = 'D'; // Default day
            let unit: moment.unitOfTime.StartOf = 'day';

            if (period === 'WEEKLY' || period === 'MONTHLY') {
                unit = 'day';
                displayFormat = 'D';
            } else if (period === 'QUARTERLY') {
                unit = 'week';
                displayFormat = '[W]w';
            } else if (period === 'YEARLY') {
                unit = 'month';
                displayFormat = 'MMM';
            }

            // Group by Time Unit
            const timeStats: Record<string, { name: string, regular: number, screener: number, weekend: number, total: number }> = {};

            // Fill gaps logic
            // Calculate base date with offset (use local time to match Analytics.tsx)
            const baseDate = moment().add(dateOffset, period === 'WEEKLY' ? 'weeks' : period === 'MONTHLY' ? 'months' : period === 'QUARTERLY' ? 'quarters' : 'years');

            let start = baseDate.clone();
            let end = baseDate.clone();

            if (period === 'WEEKLY') { start = baseDate.clone().startOf('week'); end = baseDate.clone().endOf('week'); }
            else if (period === 'MONTHLY') { start = baseDate.clone().startOf('month'); end = baseDate.clone().endOf('month'); }
            else if (period === 'QUARTERLY') { start = baseDate.clone().startOf('quarter'); end = baseDate.clone().endOf('quarter'); }
            else if (period === 'YEARLY') { start = baseDate.clone().startOf('year'); end = baseDate.clone().endOf('year'); }

            // Iterate through time range
            for (let m = start.clone(); m.isSameOrBefore(end); m.add(1, unit)) {
                const key = m.format(period === 'YEARLY' ? 'YYYY-MM' : (period === 'QUARTERLY' ? 'YYYY-w' : 'YYYY-MM-DD'));
                timeStats[key] = {
                    name: m.format(displayFormat),
                    regular: 0,
                    screener: 0,
                    weekend: 0,
                    total: 0
                };
            }

            analystSchedules.forEach(s => {
                // Use UTC to prevent timezone shifts (e.g. Dec 1st becoming Nov 30th)
                const m = moment.utc(s.date);
                const key = m.format(period === 'YEARLY' ? 'YYYY-MM' : (period === 'QUARTERLY' ? 'YYYY-w' : 'YYYY-MM-DD'));

                if (timeStats[key]) {
                    const dayOfWeek = m.day();
                    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

                    if (isWeekend) {
                        timeStats[key].weekend++;
                    } else if (s.isScreener) {
                        timeStats[key].screener++;
                    } else {
                        timeStats[key].regular++;
                    }
                    timeStats[key].total++;
                }
            });

            processedData = Object.values(timeStats);

            processedData.forEach(d => {
                totalShifts += d.total;
                totalScreener += d.screener;
                totalWeekend += d.weekend;
            });
            count = 1; // Just to keep the math simple if we want total
        }

        return {
            chartData: processedData,
            avgShifts: count > 0 ? totalShifts / count : 0,
            avgScreener: count > 0 ? totalScreener / count : 0,
            avgWeekend: count > 0 ? totalWeekend / count : 0
        };
    }, [schedules, analysts, period, selectedAnalyst, dateOffset]);

    // Dynamic Subtitle
    const subtitle = useMemo(() => {
        const now = moment().add(dateOffset, period === 'WEEKLY' ? 'weeks' : period === 'MONTHLY' ? 'months' : period === 'QUARTERLY' ? 'quarters' : 'years');
        if (period === 'WEEKLY') return `Week ${now.format('w, YYYY')}`;
        if (period === 'MONTHLY') return now.format('MMMM YYYY');
        if (period === 'QUARTERLY') return `Q${now.quarter()} ${now.format('YYYY')}`;
        return now.format('YYYY');
    }, [period, dateOffset]);

    return (
        <div className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col relative overflow-visible">
            <div className="flex justify-between items-start mb-6">
                <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Assignments Over Time</h3>
                    <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mt-1">{subtitle}</p>

                    <div className="flex gap-8 mt-4">
                        <div>
                            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                {selectedAnalyst === 'ALL' ? 'AVG SHIFTS' : 'TOTAL SHIFTS'}
                            </span>
                            <div className="text-2xl font-bold text-blue-500 dark:text-blue-400">{avgShifts.toFixed(1)}</div>
                        </div>
                        <div>
                            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                {selectedAnalyst === 'ALL' ? 'AVG SCREENING' : 'TOTAL SCREENING'}
                            </span>
                            <div className="text-2xl font-bold text-yellow-500 dark:text-yellow-400">{avgScreener.toFixed(1)}</div>
                        </div>
                        <div>
                            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                {selectedAnalyst === 'ALL' ? 'AVG WEEKEND' : 'TOTAL WEEKEND'}
                            </span>
                            <div className="text-2xl font-bold text-red-500 dark:text-red-400">{avgWeekend.toFixed(1)}</div>
                        </div>
                    </div>
                </div>

                {/* Analyst Dropdown */}
                <div className="relative z-20">
                    <button
                        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                        className="flex items-center gap-2 text-sm font-bold text-gray-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                    >
                        {selectedAnalyst === 'ALL' ? 'ALL' : analysts.find(a => a.id === selectedAnalyst)?.name || 'Unknown'}
                        {isDropdownOpen ? <ChevronUpIcon className="h-4 w-4" /> : <ChevronDownIcon className="h-4 w-4" />}
                    </button>

                    {isDropdownOpen && (
                        <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 max-h-60 overflow-y-auto z-50">
                            <button
                                onClick={() => { setSelectedAnalyst('ALL'); setIsDropdownOpen(false); }}
                                className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${selectedAnalyst === 'ALL' ? 'text-blue-600 font-bold' : 'text-gray-700 dark:text-gray-200'}`}
                            >
                                ALL
                            </button>
                            {analysts.map(a => (
                                <button
                                    key={a.id}
                                    onClick={() => { setSelectedAnalyst(a.id); setIsDropdownOpen(false); }}
                                    className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${selectedAnalyst === a.id ? 'text-blue-600 font-bold' : 'text-gray-700 dark:text-gray-200'}`}
                                >
                                    {a.name}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" opacity={0.5} />
                        <XAxis
                            dataKey="name"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: '#6B7280', fontSize: 10 }}
                            dy={10}
                            interval={0}
                        />
                        <YAxis
                            hide
                            domain={[0, 'auto']}
                        />
                        <Tooltip
                            cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                            contentStyle={{
                                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                                borderRadius: '12px',
                                border: 'none',
                                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                                fontSize: '12px'
                            }}
                        />

                        {/* Stacked Bars */}
                        <Bar dataKey="regular" stackId="a" fill="#3B82F6" radius={[0, 0, 4, 4]} name="Regular" />
                        <Bar dataKey="screener" stackId="a" fill="#F59E0B" radius={[0, 0, 0, 0]} name="Screener" />
                        <Bar dataKey="weekend" stackId="a" fill="#EF4444" radius={[4, 4, 0, 0]} name="Weekend" />

                        {/* Average Line */}
                        {selectedAnalyst === 'ALL' && (
                            <ReferenceLine y={avgShifts} stroke="#3B82F6" strokeDasharray="3 3" label={{ position: 'right', value: 'Avg', fill: '#3B82F6', fontSize: 10 }} />
                        )}
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};
