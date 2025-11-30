import { ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area } from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { InformationCircleIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';

interface TrendChartProps {
    data: Array<{
        name: string;
        fairness: number;
        avgWeightedScore: number;
    }>;
    title: string;
    subtitle: string;
}

export const TrendChart: React.FC<TrendChartProps> = ({ data, title, subtitle }) => {
    const [showInfo, setShowInfo] = useState(false);

    return (
        <motion.div
            className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm relative overflow-visible"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
        >
            <div className="flex justify-between items-start mb-6">
                <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>
                </div>
                <div className="relative">
                    <button
                        onMouseEnter={() => setShowInfo(true)}
                        onMouseLeave={() => setShowInfo(false)}
                        className="text-gray-400 hover:text-blue-500 transition-colors"
                    >
                        <InformationCircleIcon className="w-6 h-6" />
                    </button>
                    <AnimatePresence>
                        {showInfo && (
                            <motion.div
                                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                className="absolute right-0 top-8 w-72 bg-white dark:bg-gray-800 p-4 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 z-50 text-left"
                            >
                                <h4 className="font-semibold text-gray-900 dark:text-white mb-2 text-sm">How to read this chart</h4>
                                <ul className="space-y-2 text-xs text-gray-600 dark:text-gray-300">
                                    <li className="flex gap-2">
                                        <div className="w-1 h-full bg-blue-500 rounded-full shrink-0" />
                                        <span>
                                            <strong className="text-blue-600 dark:text-blue-400">Bars (Effort):</strong> Show total burden. Weekend/Screener shifts count double (2.0x).
                                        </span>
                                    </li>
                                    <li className="flex gap-2">
                                        <div className="w-1 h-full bg-green-500 rounded-full shrink-0" />
                                        <span>
                                            <strong className="text-green-600 dark:text-green-400">Line (Fairness):</strong> Shows how fair this load is compared to the team average.
                                        </span>
                                    </li>
                                    <li className="pt-1 border-t border-gray-100 dark:border-gray-700 mt-1">
                                        <strong>Action Needed:</strong> If a bar spikes high and the line drops low, that analyst is carrying too much of the "hard" work.
                                    </li>
                                </ul>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                        <defs>
                            <linearGradient id="colorWorkload" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.3} />
                            </linearGradient>
                        </defs>

                        <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="currentColor"
                            className="text-gray-200 dark:text-gray-700"
                            opacity={0.3}
                            vertical={false}
                        />

                        <XAxis
                            dataKey="name"
                            stroke="currentColor"
                            className="text-gray-400 text-xs"
                            tick={{ fontSize: 11, angle: -45, textAnchor: 'end' } as any}
                            tickLine={false}
                            axisLine={false}
                            dy={10}
                            interval={0}
                            height={60}
                        />

                        {/* Left Axis: Weighted Score */}
                        <YAxis
                            yAxisId="left"
                            stroke="currentColor"
                            className="text-gray-400 text-xs"
                            tick={{ fontSize: 12 }}
                            tickLine={false}
                            axisLine={false}
                            dx={-10}
                            label={{ value: 'Effort Score', angle: -90, position: 'insideLeft', style: { fill: '#9ca3af', fontSize: 10 } }}
                        />

                        {/* Right Axis: Fairness % */}
                        <YAxis
                            yAxisId="right"
                            orientation="right"
                            stroke="currentColor"
                            className="text-gray-400 text-xs"
                            tick={{ fontSize: 12 }}
                            domain={[0, 1]}
                            tickFormatter={(value) => `${(value * 100).toFixed(0)}%`}
                            tickLine={false}
                            axisLine={false}
                            dx={10}
                            label={{ value: 'Fairness Score', angle: 90, position: 'insideRight', style: { fill: '#9ca3af', fontSize: 10 } }}
                        />

                        <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#9ca3af', strokeWidth: 1, strokeDasharray: '4 4' }} />

                        {/* Weighted Score as Bars */}
                        <Bar
                            yAxisId="left"
                            dataKey="avgWeightedScore"
                            fill="url(#colorWorkload)"
                            barSize={30}
                            radius={[4, 4, 0, 0]}
                            animationDuration={1500}
                        />

                        {/* Fairness as Line */}
                        <Line
                            yAxisId="right"
                            type="monotone"
                            dataKey="fairness"
                            stroke="#10b981"
                            strokeWidth={3}
                            dot={{ fill: '#10b981', strokeWidth: 2, r: 4, stroke: '#fff' }}
                            activeDot={{ r: 6, strokeWidth: 0 }}
                            animationDuration={1500}
                        />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>

            <div className="flex items-center justify-center gap-6 mt-6">
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                    <span className="text-sm text-gray-500 dark:text-gray-400">Fairness Score</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-sm bg-blue-500" />
                    <span className="text-sm text-gray-500 dark:text-gray-400">Weighted Effort</span>
                </div>
            </div>
        </motion.div>
    );
};

const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || payload.length === 0) return null;

    return (
        <motion.div
            className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
        >
            <p className="text-sm font-semibold text-gray-900 dark:text-white mb-2">{label}</p>
            {payload.map((entry: any, index: number) => (
                <div key={index} className="flex items-center justify-between gap-4 mb-1 last:mb-0">
                    <span className="text-sm text-gray-500 dark:text-gray-400 capitalize">
                        {entry.dataKey === 'avgWeightedScore' ? 'Effort Score' : 'Fairness'}:
                    </span>
                    <span className="text-sm font-medium" style={{ color: entry.color }}>
                        {entry.dataKey === 'fairness'
                            ? `${(entry.value * 100).toFixed(1)}%`
                            : entry.value.toFixed(1)
                        }
                    </span>
                </div>
            ))}
        </motion.div>
    );
};
