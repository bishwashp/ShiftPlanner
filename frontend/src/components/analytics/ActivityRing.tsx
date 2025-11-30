import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { Info } from '@phosphor-icons/react';

interface ActivityRingProps {
    value: number; // 0-1
    color: string; // Tailwind gradient classes
    label: string;
    subtitle: string;
    size?: number;
    onClick?: () => void;
    isActive?: boolean;
    isFaded?: boolean;
    infoTooltip?: string;
}

export const ActivityRing: React.FC<ActivityRingProps> = ({
    value,
    color,
    label,
    subtitle,
    size = 180,
    onClick,
    isActive = false,
    isFaded = false,
    infoTooltip
}) => {
    const [displayValue, setDisplayValue] = useState(0);

    useEffect(() => {
        const timeout = setTimeout(() => setDisplayValue(value), 100);
        return () => clearTimeout(timeout);
    }, [value]);

    const radius = size / 2 - 20;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (displayValue * circumference);

    // Extract start and end colors from the gradient string for SVG stops
    // Expected format: "from-green-400 to-emerald-600"
    const getGradientColors = (colorString: string) => {
        const parts = colorString.split(' ');
        const fromColor = parts.find(p => p.startsWith('from-'))?.replace('from-', 'text-') || 'text-green-500';
        const toColor = parts.find(p => p.startsWith('to-'))?.replace('to-', 'text-') || 'text-emerald-600';
        return { fromColor, toColor };
    };

    const { fromColor, toColor } = getGradientColors(color);

    return (
        <div
            className={`w-full h-full flex flex-col items-center justify-center group cursor-pointer transition-all duration-300 ${isFaded ? 'opacity-30' :
                isActive ? 'scale-105 opacity-100' :
                    'hover:scale-105 opacity-70 hover:opacity-100'
                }`}
            onClick={onClick}
        >
            <div className="relative" style={{ width: size, height: size }}>
                <svg className="transform -rotate-90" width={size} height={size}>
                    <defs>
                        {/* 
              Note: Tailwind classes in SVG defs might not work as expected for stop-color 
              if using JIT without safelist, but 'text-' classes usually work if used elsewhere.
              Ideally we'd map these to hex codes, but for now we rely on Tailwind's currentColor behavior 
              or use a workaround. Here we use a unique ID for each ring instance.
            */}
                        <linearGradient id={`gradient-${label.replace(/\s+/g, '-')}`} x1="0%" y1="0%" x2="100%" y2="100%">
                            {/* We use currentColor and apply the class to the stop element */}
                            <stop offset="0%" className={fromColor} stopOpacity="1" style={{ stopColor: 'currentColor' }} />
                            <stop offset="100%" className={toColor} stopOpacity="1" style={{ stopColor: 'currentColor' }} />
                        </linearGradient>
                    </defs>

                    {/* Background ring */}
                    <circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        stroke="currentColor"
                        strokeWidth="16"
                        fill="none"
                        className="text-gray-200 dark:text-gray-800 opacity-50"
                    />

                    {/* Progress ring */}
                    <motion.circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        stroke={`url(#gradient-${label.replace(/\s+/g, '-')})`}
                        strokeWidth="16"
                        fill="none"
                        strokeLinecap="round"
                        strokeDasharray={circumference}
                        initial={{ strokeDashoffset: circumference }}
                        animate={{ strokeDashoffset }}
                        transition={{ duration: 1.5, ease: "easeOut", delay: 0.2 }}
                    />
                </svg>

                {/* Center percentage */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <motion.div
                        className="text-3xl font-bold text-gray-900 dark:text-white"
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.5, duration: 0.5 }}
                    >
                        {Math.round(displayValue * 100)}%
                    </motion.div>

                </div>
            </div>

            <div className="mt-4 text-center relative">
                <div className={`font-semibold text-lg transition-colors flex items-center justify-center gap-2 ${isActive ? 'text-gray-900 dark:text-white' : 'text-gray-500'}`}>
                    {label}
                    {infoTooltip && (
                        <div className="group/tooltip relative">
                            <Info className="h-4 w-4 text-gray-400 hover:text-blue-500 transition-colors" />
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-gray-900 text-white text-xs rounded shadow-lg opacity-0 group-hover/tooltip:opacity-100 transition-opacity pointer-events-none z-50">
                                {infoTooltip}
                            </div>
                        </div>
                    )}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">{subtitle}</div>
            </div>
        </div>
    );
};
