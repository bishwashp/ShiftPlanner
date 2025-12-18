import React, { useState } from 'react';
import {
    Radar,
    RadarChart,
    PolarGrid,
    PolarAngleAxis,
    PolarRadiusAxis,
    ResponsiveContainer,
    Legend
} from 'recharts';
import { MonthlyTally } from '../../services/api';

interface TeamRadarProps {
    data: MonthlyTally[];
}

// Vibrant colors for analysts
const COLORS = [
    '#3B82F6', // Blue
    '#EF4444', // Red
    '#10B981', // Emerald
    '#F59E0B', // Amber
    '#8B5CF6', // Violet
    '#EC4899', // Pink
    '#06B6D4', // Cyan
    '#F97316', // Orange
    '#6366F1', // Indigo
    '#84CC16', // Lime
];

export const TeamRadar: React.FC<TeamRadarProps> = ({ data }) => {
    const [highlightedAnalyst, setHighlightedAnalyst] = useState<string | null>(null);

    if (!data || data.length === 0) return null;

    // 1. Calculate Max Values for Normalization
    const maxWorkload = Math.max(...data.map(d => d.totalWorkDays)) || 1;
    const maxScreener = Math.max(...data.map(d => d.screenerDays)) || 1;
    const maxWeekend = Math.max(...data.map(d => d.weekendDays)) || 1;

    // 2. Transform Data for Recharts
    // Recharts Radar expects: [{ subject: 'Math', A: 120, B: 110 }, { subject: 'Chinese', A: 98, B: 130 }]
    const chartData = [
        {
            subject: 'Workload',
            fullMark: 100,
            ...data.reduce((acc, curr) => ({
                ...acc,
                [curr.analystName]: (curr.totalWorkDays / maxWorkload) * 100
            }), {})
        },
        {
            subject: 'Screener',
            fullMark: 100,
            ...data.reduce((acc, curr) => ({
                ...acc,
                [curr.analystName]: (curr.screenerDays / maxScreener) * 100
            }), {})
        },
        {
            subject: 'Weekend',
            fullMark: 100,
            ...data.reduce((acc, curr) => ({
                ...acc,
                [curr.analystName]: (curr.weekendDays / maxWeekend) * 100
            }), {})
        }
    ];

    return (
        <div className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm h-[500px] flex flex-col">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Team Distribution</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                        Normalized comparison (100% = highest in team). Click legend to isolate.
                    </p>
                </div>
                {highlightedAnalyst && (
                    <button
                        onClick={() => setHighlightedAnalyst(null)}
                        className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                    >
                        Reset View
                    </button>
                )}
            </div>

            <div className="flex-1 min-h-0" onClick={(e) => {
                // Reset if clicking empty space (though Recharts captures most clicks)
                if (e.target === e.currentTarget) setHighlightedAnalyst(null);
            }}>
                <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="80%" data={chartData}>
                        <PolarGrid stroke="#e5e7eb" strokeDasharray="3 3" />
                        {/* @ts-ignore */}
                        <PolarAngleAxis
                            dataKey="subject"
                            tick={{ fill: '#6B7280', fontSize: 12, fontWeight: 600 }}
                        />
                        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />

                        {data.map((analyst, index) => {
                            const isHighlighted = highlightedAnalyst === analyst.analystName;
                            const isDimmed = highlightedAnalyst !== null && !isHighlighted;
                            const color = COLORS[index % COLORS.length];

                            return (
                                <Radar
                                    key={analyst.analystId}
                                    name={analyst.analystName}
                                    dataKey={analyst.analystName}
                                    stroke={color}
                                    strokeWidth={isHighlighted ? 3 : 2}
                                    fill={color}
                                    fillOpacity={isHighlighted ? 0.5 : isDimmed ? 0.05 : 0.2}
                                    strokeOpacity={isDimmed ? 0.1 : 1}
                                    isAnimationActive={false} // Disable animation for smoother interaction
                                    style={{ pointerEvents: 'none' }} // Let clicks pass through to container? No, we need legend.
                                />
                            );
                        })}
                    </RadarChart>
                </ResponsiveContainer>
            </div>

            {/* Custom Interactive Legend */}
            <div className="mt-4 flex flex-wrap gap-2 justify-center">
                {data.map((analyst, index) => {
                    const isHighlighted = highlightedAnalyst === analyst.analystName;
                    const isDimmed = highlightedAnalyst !== null && !isHighlighted;
                    const color = COLORS[index % COLORS.length];

                    return (
                        <button
                            key={analyst.analystId}
                            onClick={() => setHighlightedAnalyst(isHighlighted ? null : analyst.analystName)}
                            className={`
                    flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium transition-all duration-200 border
                    ${isHighlighted
                                    ? 'bg-gray-100 dark:bg-gray-800 scale-105 shadow-sm'
                                    : isDimmed
                                        ? 'opacity-40 grayscale border-transparent'
                                        : 'hover:bg-gray-50 dark:hover:bg-gray-800/50 border-transparent'
                                }
                `}
                            style={{ borderColor: isHighlighted ? color : 'transparent' }}
                        >
                            <div
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: color }}
                            />
                            <span className="text-gray-700 dark:text-gray-300">
                                {analyst.analystName.split(' ')[0]}
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};
