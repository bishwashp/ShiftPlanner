import { motion } from 'framer-motion';

interface AnalystComparisonProps {
    analysts: Array<{
        name: string;
        value: number;
        fairnessScore: number;
        percentile: number;
    }>;
    metric: string;
    title: string;
    showPercentiles?: boolean;
}

export const AnalystComparison: React.FC<AnalystComparisonProps> = ({
    analysts,
    metric,
    title,
    showPercentiles = true
}) => {
    // Safety check: filter out any analysts without required properties
    const validAnalysts = analysts.filter(a => a && typeof a.value === 'number');

    if (validAnalysts.length === 0) {
        return (
            <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                No data available
            </div>
        );
    }

    const maxValue = Math.max(...validAnalysts.map(a => a.value));
    const sortedAnalysts = [...validAnalysts].sort((a, b) => b.value - a.value);

    const getBarColor = (percentile: number) => {
        // User requested gradient #A5CE41 to #86C9B0
        // We'll use a custom class or style for this specific gradient, or approximate with Tailwind if close matches exist.
        // #A5CE41 is a lime green. #86C9B0 is a soft teal/green.
        // Let's use an arbitrary value gradient since we can.
        return 'from-[#A5CE41] to-[#86C9B0]';
    };

    const getPercentileLabel = (percentile: number) => {
        if (percentile >= 90) return 'Top 10%';
        if (percentile >= 75) return 'Top 25%';
        if (percentile >= 50) return 'Above Avg';
        if (percentile >= 25) return 'Below Avg';
        return 'Bottom 25%';
    };

    const getFairnessColor = (score: number) => {
        if (score >= 0.9) return 'text-green-600 dark:text-green-400';
        if (score >= 0.7) return 'text-yellow-600 dark:text-yellow-400';
        return 'text-red-600 dark:text-red-400';
    };

    const averageValue = Math.round(analysts.reduce((sum, a) => sum + a.value, 0) / analysts.length);

    // Find the index where the average line should be inserted (before the first item <= average)
    // Since list is sorted descending, we look for the first item <= average.
    // This ensures items > average are above the line.
    let averageInsertIndex = sortedAnalysts.findIndex(a => a.value <= averageValue);
    if (averageInsertIndex === -1) averageInsertIndex = sortedAnalysts.length;

    return (
        <div className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{title}</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-6">
                <span className="font-medium">Bar length:</span> Number of {metric} days. <span className="font-medium ml-2">Badge:</span> Ranking percentile (Top 10% = highest workload). <span className="font-medium ml-2">Fairness:</span> Individual equity score (100% = perfectly balanced).
            </p>

            <div className="space-y-4">
                {sortedAnalysts.map((analyst, index) => (
                    <div key={analyst.name}>
                        {/* Dynamic Team Average Line */}
                        {index === averageInsertIndex && (
                            <div className="flex items-center gap-4 my-4 opacity-70">
                                <div className="w-32 text-right text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                                    Team Average
                                </div>
                                <div className="flex-1 flex items-center gap-2">
                                    <div className="h-px flex-1 bg-blue-200 dark:bg-blue-800 border-t border-dashed border-blue-500/50" />
                                    <span className="text-xs font-bold text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-900/30">
                                        {averageValue}
                                    </span>
                                    <div className="h-px w-16 bg-blue-200 dark:bg-blue-800 border-t border-dashed border-blue-500/50" />
                                </div>
                            </div>
                        )}

                        <motion.div
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className="group relative"
                        >
                            <div className="flex items-center gap-4 mb-2">
                                <div className="w-32 text-sm font-medium text-gray-900 dark:text-white truncate text-right">
                                    {analyst.name}
                                </div>

                                {showPercentiles && (
                                    <div className="text-xs px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 w-20 text-center">
                                        {getPercentileLabel(analyst.percentile)}
                                    </div>
                                )}

                                <div className="flex-1 h-4 bg-gray-50 dark:bg-gray-800/50 rounded-full relative overflow-hidden border border-gray-100 dark:border-gray-700">
                                    {/* Background bar */}
                                    <motion.div
                                        className={`h-full bg-gradient-to-r ${getBarColor(analyst.percentile)} rounded-full opacity-90`}
                                        initial={{ width: 0 }}
                                        animate={{ width: `${(analyst.value / maxValue) * 100}%` }}
                                        transition={{
                                            duration: 1,
                                            delay: index * 0.05 + 0.3,
                                            ease: [0.16, 1, 0.3, 1]
                                        }}
                                    />

                                    {/* Value label inside bar */}
                                    <div className="absolute inset-0 flex items-center justify-end pr-4 pointer-events-none">
                                        <motion.span
                                            className="text-sm font-bold text-white drop-shadow-md"
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            transition={{ delay: index * 0.05 + 0.8 }}
                                        >
                                            {analyst.value}
                                        </motion.span>
                                    </div>
                                </div>

                                <div className="w-16 text-right">
                                    <div className={`text-sm font-bold ${getFairnessColor(analyst.fairnessScore)}`}>
                                        {(analyst.fairnessScore * 100).toFixed(0)}%
                                    </div>
                                    <div className="text-[10px] text-gray-400 uppercase tracking-wide">fairness</div>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                ))}

                {/* If average is at the very bottom */}
                {averageInsertIndex === sortedAnalysts.length && (
                    <div className="flex items-center gap-4 my-4 opacity-70">
                        <div className="w-32 text-right text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                            Team Average
                        </div>
                        <div className="flex-1 flex items-center gap-2">
                            <div className="h-px flex-1 bg-blue-200 dark:bg-blue-800 border-t border-dashed border-blue-500/50" />
                            <span className="text-xs font-bold text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-900/30">
                                {averageValue}
                            </span>
                            <div className="h-px w-16 bg-blue-200 dark:bg-blue-800 border-t border-dashed border-blue-500/50" />
                        </div>
                    </div>
                )}
            </div>

            {/* Summary stats */}
            <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700 grid grid-cols-3 gap-4 text-center">
                <div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">
                        {sortedAnalysts[0].value}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Highest</div>
                </div>
                <div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">
                        {Math.round(sortedAnalysts.reduce((sum, a) => sum + a.value, 0) / sortedAnalysts.length)}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Average</div>
                </div>
                <div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">
                        {sortedAnalysts[sortedAnalysts.length - 1].value}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Lowest</div>
                </div>
            </div>
        </div>
    );
};
