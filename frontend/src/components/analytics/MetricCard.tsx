import { motion, useMotionTemplate, useMotionValue } from 'framer-motion';
import { ArrowTrendingUpIcon, ArrowTrendingDownIcon, ArrowRightIcon } from '@heroicons/react/24/solid';
import { MouseEvent, useState } from 'react';
import React from 'react';

interface MetricCardProps {
    icon: React.ReactNode;
    value: string | number;
    label: string;
    subtitle?: string;
    trend?: {
        direction: 'up' | 'down' | 'stable';
        value: string;
    };
    color: 'green' | 'blue' | 'purple' | 'yellow' | 'red';
    backContent?: React.ReactNode;
}

export const MetricCard: React.FC<MetricCardProps> = ({
    icon,
    value,
    label,
    subtitle,
    trend,
    color,
    backContent
}) => {
    const [isFlipped, setIsFlipped] = useState(false);
    const mouseX = useMotionValue(0);
    const mouseY = useMotionValue(0);

    function handleMouseMove({ currentTarget, clientX, clientY }: MouseEvent) {
        const { left, top } = currentTarget.getBoundingClientRect();
        mouseX.set(clientX - left);
        mouseY.set(clientY - top);
    }

    const colorClasses = {
        green: 'from-green-500/10 to-emerald-500/10 border-green-500/20',
        blue: 'from-blue-500/10 to-cyan-500/10 border-blue-500/20',
        purple: 'from-purple-500/10 to-pink-500/10 border-purple-500/20',
        yellow: 'from-yellow-500/10 to-orange-500/10 border-yellow-500/20',
        red: 'from-red-500/10 to-rose-500/10 border-red-500/20',
    };

    const iconColors = {
        green: 'text-green-600 dark:text-green-400',
        blue: 'text-blue-600 dark:text-blue-400',
        purple: 'text-purple-600 dark:text-purple-400',
        yellow: 'text-yellow-600 dark:text-yellow-400',
        red: 'text-red-600 dark:text-red-400',
    };

    return (
        <div className="perspective-1000 h-full">
            <motion.div
                className="relative h-full"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0, rotateY: isFlipped ? 180 : 0 }}
                transition={{ duration: 0.6, type: "spring", stiffness: 260, damping: 20 }}
                style={{ transformStyle: "preserve-3d" }}
                onMouseMove={handleMouseMove}
                onClick={() => backContent && setIsFlipped(!isFlipped)}
            >
                {/* Front Face */}
                <div
                    className={`
                        relative overflow-hidden rounded-2xl
                        bg-white/70 dark:bg-gray-900/60 
                        backdrop-blur-[20px] dark:backdrop-blur-xl
                        border border-white/40 dark:border-white/10
                        shadow-[0_8px_32px_rgba(0,0,0,0.1)]
                        hover:shadow-lg transition-shadow duration-300
                        group cursor-pointer h-full
                        p-6 flex flex-col
                    `}
                    style={{ backfaceVisibility: 'hidden' }}
                >
                    {/* Flashlight effect overlay */}
                    <motion.div
                        className="pointer-events-none absolute -inset-px rounded-2xl opacity-0 transition duration-300 group-hover:opacity-100 z-20 [--flashlight:rgba(0,0,0,0.05)] dark:[--flashlight:rgba(255,255,255,0.15)]"
                        style={{
                            background: useMotionTemplate`
                                radial-gradient(
                                  650px circle at ${mouseX}px ${mouseY}px,
                                  var(--flashlight),
                                  transparent 80%
                                )
                              `
                        }}
                    />

                    {/* Watermark Icon - Large, Right Side, 15% Opacity */}
                    <div className={`absolute right-4 top-1/2 -translate-y-1/2 opacity-15 z-0 ${iconColors[color]}`} style={{ transform: 'translateY(-50%) scale(6.5)' }}>
                        {icon}
                    </div>

                    {/* Value */}
                    <motion.div
                        className="text-5xl font-display font-bold text-gray-900 dark:text-white mb-2 relative z-10 tracking-tight"
                        style={{ fontVariationSettings: "'wdth' 100" }}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.2 }}
                    >
                        {value}
                    </motion.div>

                    {/* Label */}
                    <div className="text-sm font-medium text-gray-500 dark:text-gray-400 relative z-10 mb-auto">
                        {label}
                    </div>

                    {/* Subtitle */}
                    {subtitle && (
                        <div className="text-xs text-gray-400 dark:text-gray-500 mt-1 relative z-10">{subtitle}</div>
                    )}

                    {/* Trend */}
                    {trend && (
                        <div className="flex items-center gap-1 mt-3 text-xs font-medium relative z-10">
                            {trend.direction === 'up' && <ArrowTrendingUpIcon className="h-3 w-3 text-green-600" />}
                            {trend.direction === 'down' && <ArrowTrendingDownIcon className="h-3 w-3 text-red-600" />}
                            {trend.direction === 'stable' && <ArrowRightIcon className="h-3 w-3 text-gray-600" />}
                            <span className="text-gray-600 dark:text-gray-300">{trend.value}</span>
                        </div>
                    )}

                    {/* Subtle gradient overlay */}
                    <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
                </div>

                {/* Back Face */}
                {backContent && (
                    <div
                        className="absolute inset-0 p-6 h-full w-full overflow-y-auto bg-white/80 dark:bg-gray-900/80 backdrop-blur-2xl rounded-2xl border border-white/40 dark:border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.1)]"
                        style={{
                            backfaceVisibility: 'hidden',
                            transform: 'rotateY(180deg)'
                        }}
                    >
                        {backContent}
                    </div>
                )}
            </motion.div>
        </div>
    );
};
