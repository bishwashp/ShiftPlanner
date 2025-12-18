import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { motion } from 'framer-motion';

interface ShiftRadarProps {
    data: Array<{
        subject: string;
        A: number; // Analyst value
        B: number; // Team Average
        fullMark: number;
    }>;
    analystName: string;
}

export const ShiftRadar: React.FC<ShiftRadarProps> = ({ data, analystName }) => {
    return (
        <motion.div
            className="h-[320px] w-full bg-white/50 dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-800 p-4"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
        >
            <div className="flex items-center justify-between mb-2 px-2">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white truncate">{analystName}</h4>
                <div className="flex gap-3 text-[10px] uppercase tracking-wider font-medium">
                    <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-blue-500 opacity-60" />
                        <span className="text-gray-500">Them</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-gray-400 opacity-30" />
                        <span className="text-gray-500">Avg</span>
                    </div>
                </div>
            </div>

            <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
                    <PolarGrid stroke="#e5e7eb" strokeOpacity={0.5} />
                    {/* @ts-ignore */}
                    <PolarAngleAxis
                        dataKey="subject"
                        tick={{ fill: '#6b7280', fontSize: 11, fontWeight: 500 }}
                    />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />

                    <Radar
                        name={analystName}
                        dataKey="A"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        fill="#3b82f6"
                        fillOpacity={0.4}
                    />
                    <Radar
                        name="Team Avg"
                        dataKey="B"
                        stroke="#9ca3af"
                        strokeWidth={1}
                        fill="#9ca3af"
                        fillOpacity={0.1}
                    />
                    <Tooltip
                        contentStyle={{
                            backgroundColor: 'rgba(255, 255, 255, 0.9)',
                            borderRadius: '8px',
                            border: 'none',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                        }}
                        itemStyle={{ fontSize: '12px' }}
                    />
                </RadarChart>
            </ResponsiveContainer>
        </motion.div>
    );
};
