import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { CaretDown, Check } from '@phosphor-icons/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface Option {
    value: string;
    label: string;
}

interface SpringDropdownProps {
    value: string;
    onChange: (value: string) => void;
    options?: Option[];
    groupedOptions?: { label: string; options: Option[] }[];
    placeholder?: string;
    className?: string;
    label?: string;
    disabled?: boolean;
    name?: string;
    required?: boolean;
    size?: 'sm' | 'md' | 'lg';
    variant?: 'default' | 'outline' | 'ghost';
}

// Helper to merge tailwind classes
function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

const SpringDropdown: React.FC<SpringDropdownProps> = ({
    value,
    onChange,
    options = [],
    groupedOptions,
    placeholder = 'Select...',
    className,
    label,
    disabled = false,
    name,
    required = false,
    size = 'md',
    variant = 'default'
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Size controls ONLY font-size. Padding uses em for proportional scaling.
    const fontSizeClasses = {
        sm: 'text-sm',
        md: 'text-sm',
        lg: 'text-xl' // Large for GeoSelector to match "Sine" title
    };

    // Variant styles (no padding here - all handled by button base styles)
    const variantClasses = {
        default: 'bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 shadow-sm hover:border-gray-400 dark:hover:border-gray-500',
        outline: 'bg-transparent border border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500',
        ghost: 'bg-transparent border-none shadow-none hover:bg-black/5 dark:hover:bg-white/10'
    };

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Spring animation configuration
    const menuVariants: Variants = {
        hidden: {
            opacity: 0,
            scale: 0.95,
            y: -8,
            transition: { type: 'spring', stiffness: 400, damping: 25 }
        },
        visible: {
            opacity: 1,
            scale: 1,
            y: 0,
            transition: { type: 'spring', stiffness: 400, damping: 20 }
        },
        exit: {
            opacity: 0,
            scale: 0.95,
            y: -8,
            transition: { duration: 0.12 }
        }
    };

    const itemVariants: Variants = {
        hidden: { opacity: 0, x: -8 },
        visible: (i: number) => ({
            opacity: 1,
            x: 0,
            transition: { delay: i * 0.02, duration: 0.15 }
        })
    };

    const selectedLabel = (
        options.find(o => o.value === value) ||
        groupedOptions?.flatMap(g => g.options).find(o => o.value === value)
    )?.label || placeholder;

    const renderItem = (option: Option, index: number) => (
        <motion.div
            key={option.value}
            custom={index}
            variants={itemVariants}
            initial="hidden"
            animate="visible"
            onClick={() => {
                onChange(option.value);
                setIsOpen(false);
            }}
            className={cn(
                'relative cursor-pointer select-none py-2 px-3 pr-8 text-sm transition-colors whitespace-nowrap',
                value === option.value
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-medium'
                    : 'text-gray-900 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50'
            )}
        >
            {option.label}
            {value === option.value && (
                <span className="absolute inset-y-0 right-0 flex items-center pr-2 text-blue-600 dark:text-blue-400">
                    <Check className="h-4 w-4" />
                </span>
            )}
        </motion.div>
    );

    return (
        <div className={cn('relative inline-flex', className)} ref={containerRef}>
            {label && (
                <label className="block text-sm font-medium text-foreground mb-1">
                    {label}
                </label>
            )}

            <motion.button
                onClick={() => !disabled && setIsOpen(!isOpen)}
                type="button"
                className={cn(
                    // Base: inline-flex with gap, no absolute positioning needed
                    'inline-flex items-center justify-between gap-2 rounded-lg font-medium transition-colors duration-150',
                    // Thin padding using em (scales with font size)
                    'py-[0.25em] px-[0.5em]',
                    fontSizeClasses[size],
                    variantClasses[variant],
                    disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer text-foreground',
                    isOpen && !disabled && variant !== 'ghost' && 'border-primary ring-2 ring-primary/20',
                    isOpen && !disabled && variant === 'ghost' && 'bg-black/5 dark:bg-white/10'
                )}
            >
                <span className="whitespace-nowrap">{selectedLabel}</span>
                <motion.span
                    className="flex-shrink-0 flex items-center justify-center"
                    animate={{ rotate: isOpen ? 180 : 0 }}
                    transition={{ duration: 0.15, ease: 'easeInOut' }}
                    style={{ width: 16, height: 16 }}
                >
                    <CaretDown className={cn('w-4 h-4', disabled ? 'text-gray-300' : 'text-gray-400')} />
                </motion.span>
            </motion.button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        variants={menuVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        className="absolute top-full left-0 z-[100] mt-1 min-w-full w-max rounded-lg bg-white dark:bg-gray-800 shadow-xl ring-1 ring-black/5 border border-gray-100 dark:border-gray-700 overflow-hidden"
                    >
                        <div className="max-h-60 overflow-auto py-1 custom-scrollbar">
                            {groupedOptions ? (
                                groupedOptions.map((group, gi) => (
                                    <div key={group.label}>
                                        <div className="px-3 py-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50/50 dark:bg-gray-900/20">
                                            {group.label}
                                        </div>
                                        {group.options.map((opt, i) => renderItem(opt, gi * 10 + i))}
                                    </div>
                                ))
                            ) : (
                                options.map((opt, i) => renderItem(opt, i))
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <input type="hidden" name={name} value={value} required={required} readOnly />
        </div>
    );
};

export default SpringDropdown;
