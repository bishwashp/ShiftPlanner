import React from 'react';
import { motion } from 'framer-motion';

interface SegmentedControlProps {
    options: {
        value: string;
        label: string | React.ReactNode;
        icon?: React.ReactNode;
    }[];
    value: string;
    onChange: (value: string) => void;
    className?: string;
}

const SegmentedControl: React.FC<SegmentedControlProps> = ({ options, value, onChange, className = '' }) => {
    return (
        <div className={`p-1 bg-gray-100/50 dark:bg-gray-800/50 backdrop-blur-sm rounded-lg flex relative ${className}`}>
            {/* The sliding background */}
            {options.map((option) => {
                const isActive = value === option.value;
                return (
                    isActive && (
                        <motion.div
                            layoutId="segmented-control-bg"
                            key="bg"
                            className="absolute inset-y-1 bg-white dark:bg-gray-700 shadow-sm rounded-[6px]"
                            // Calculate width and left position style dynamically if needed, 
                            // but simpler to use layoutId if items are equal width or we render this 'under' the items.
                            // Actually, to make it work perfectly with variable widths, we render it *behind* the active item.
                            // But since we are mapping, we can't easily place it "behind" a specific one without knowing geometry.
                            // Better approach: Render the background as a sibling to buttons, but controlled by layoutId.
                            // However, we need to know WHICH one is active to position a single motion div.
                            // The motion div needs to be inside the container.
                            // Let's rely on Framer Motion's layout prop on the buttons + a shared layoutId.

                            // Let's refine the structure:
                            // The container holds all buttons.
                            // The Active Button contains the Motion Div as a child with layoutId, absolutely positioned to fill it.
                            initial={false}
                            transition={{ type: "spring", stiffness: 400, damping: 30 }}
                        // We need to match the button's dimensions.
                        // A common trick is to render this conditionally INSIDE the active button, with z-index -1.
                        />
                    )
                );
            })}

            <div className="flex w-full relative z-10">
                {options.map((option) => {
                    const isActive = value === option.value;
                    return (
                        <button
                            key={option.value}
                            onClick={() => onChange(option.value)}
                            className={`
                                relative flex-1 flex items-center justify-center gap-2 px-4 py-1.5 text-sm font-medium rounded-md transition-colors duration-200
                                ${isActive ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}
                            `}
                        >
                            {isActive && (
                                <motion.div
                                    layoutId="segmented-control-active"
                                    className="absolute inset-0 bg-white dark:bg-gray-700 shadow-sm rounded-md -z-10"
                                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                />
                            )}
                            <span className="relative z-10 flex items-center gap-2">
                                {option.icon && <span className="w-4 h-4">{option.icon}</span>}
                                <span>{option.label}</span>
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default SegmentedControl;
