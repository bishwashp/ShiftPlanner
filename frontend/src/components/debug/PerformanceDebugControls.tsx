import React, { useState } from 'react';
import { usePerformance } from '../../contexts/PerformanceContext';
import { Bug, CaretUp, CaretDown, Check, X } from '@phosphor-icons/react';

export const PerformanceDebugControls: React.FC = () => {
    const { flags, toggleFlag, resetFlags } = usePerformance();
    const [isOpen, setIsOpen] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);

    // Only show in development or if specifically enabled via URL param ?debug=true
    // For now, we'll just show it always since the user requested it specifically
    // const showDebug = window.location.search.includes('debug=true') || process.env.NODE_ENV === 'development';

    // Actually, user wants to test it, so show it always for now.

    if (isMinimized) {
        return (
            <button
                onClick={() => setIsMinimized(false)}
                className="fixed bottom-4 right-4 z-[9999] bg-gray-900 text-white p-3 rounded-full shadow-xl hover:bg-gray-800 transition-all border border-gray-700"
                title="Performance Debug Tools"
            >
                <Bug weight="fill" className="w-6 h-6" />
            </button>
        );
    }

    return (
        <div className="fixed bottom-4 right-4 z-[9999] w-80 bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden font-sans text-sm">
            {/* Header */}
            <div className="bg-gray-100 dark:bg-gray-800 p-3 flex items-center justify-between border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center space-x-2 font-bold text-gray-700 dark:text-gray-200">
                    <Bug weight="duotone" className="w-5 h-5 text-amber-500" />
                    <span>Chrome Perf Debug</span>
                </div>
                <div className="flex items-center space-x-1">
                    <button
                        onClick={() => setIsMinimized(true)}
                        className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-gray-500"
                    >
                        <CaretDown className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => setIsOpen(!isOpen)}
                        className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-gray-500"
                    >
                        {isOpen ? <CaretDown className="w-4 h-4" /> : <CaretUp className="w-4 h-4" />}
                    </button>
                </div>
            </div>

            {/* Controls */}
            <div className="p-4 space-y-4 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm">
                <div className="space-y-3">
                    <Toggle
                        label="Disable Liquid Background"
                        active={flags.disableLiquidBackground}
                        onChange={() => toggleFlag('disableLiquidBackground')}
                        description="Hides animated blobs to isolate GPU usage"
                    />
                    <Toggle
                        label="Disable Glass Effects"
                        active={flags.disableGlassEffects}
                        onChange={() => toggleFlag('disableGlassEffects')}
                        description="Removes backdrop-filter from grid cells"
                    />
                    <Toggle
                        label="Force Solid Surfaces"
                        active={flags.useSolidSurfaces}
                        onChange={() => toggleFlag('useSolidSurfaces')}
                        description="Replaces transparency with solid colors"
                    />
                    <Toggle
                        label="Simplify Calendar"
                        active={flags.simplifyCalendar}
                        onChange={() => toggleFlag('simplifyCalendar')}
                        description="Reduces DOM complexity in cells"
                    />
                </div>

                <div className="pt-3 border-t border-gray-100 dark:border-gray-800 flex justify-between">
                    <button
                        onClick={resetFlags}
                        className="px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 bg-gray-100 dark:bg-gray-800 rounded hover:bg-gray-200"
                    >
                        Reset All
                    </button>
                    <div className="text-xs text-gray-400 flex items-center">
                        Active: {Object.values(flags).filter(Boolean).length}
                    </div>
                </div>
            </div>
        </div>
    );
};

const Toggle = ({ label, active, onChange, description }: { label: string, active: boolean, onChange: () => void, description: string }) => (
    <div className="flex items-start justify-between group cursor-pointer" onClick={onChange}>
        <div className="flex-1 pr-4">
            <div className="font-medium text-gray-900 dark:text-gray-100 flex items-center">
                {label}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">{description}</div>
        </div>
        <div className={`
            w-10 h-6 flex items-center rounded-full p-1 transition-colors duration-200 flex-shrink-0
            ${active ? 'bg-amber-500' : 'bg-gray-300 dark:bg-gray-600'}
        `}>
            <div className={`
                bg-white w-4 h-4 rounded-full shadow-md transform duration-200 ease-in-out
                ${active ? 'translate-x-4' : 'translate-x-0'}
            `} />
        </div>
    </div>
);
