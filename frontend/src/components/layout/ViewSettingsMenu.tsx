import React, { useState, useRef, useEffect } from 'react';
import { Cog6ToothIcon, MoonIcon, SunIcon, QuestionMarkCircleIcon, FunnelIcon } from '@heroicons/react/24/outline';
import { useTheme } from 'react18-themes';
import TimezoneSelector from '../TimezoneSelector';

interface ViewSettingsMenuProps {
    timezone: string;
    onTimezoneChange: (tz: string) => void;
    showLegend?: boolean;
    filterHook?: any;
}

const ViewSettingsMenu: React.FC<ViewSettingsMenuProps> = ({
    timezone,
    onTimezoneChange,
    showLegend = true,
    filterHook
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const { theme, setTheme } = useTheme();
    const menuRef = useRef<HTMLDivElement>(null);

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    // Sync theme with data-theme attribute
    useEffect(() => {
        if (theme) {
            document.documentElement.setAttribute('data-theme', theme);
        }
    }, [theme]);

    const LegendItem: React.FC<{ color: string, label: string }> = ({ color, label }) => (
        <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${color}`}></div>
            <span className="text-sm text-gray-700 dark:text-gray-200">{label}</span>
        </div>
    );

    return (
        <div className="relative" ref={menuRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`p-2 rounded-md transition-colors ${isOpen ? 'bg-muted text-foreground' : 'text-gray-700 dark:text-gray-200 hover:bg-muted hover:text-foreground'}`}
                title="View Settings"
            >
                <Cog6ToothIcon className="h-5 w-5" />
            </button>

            {isOpen && (
                <div className="absolute top-full right-0 mt-2 w-72 bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl p-4 z-50 animate-in fade-in zoom-in-95 duration-200">
                    <h3 className="font-semibold mb-4 text-foreground border-b border-border pb-2">View Settings</h3>

                    <div className="space-y-4">
                        {/* Theme Switcher */}
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">Theme</span>
                            <div className="flex bg-muted rounded-md p-1">
                                <button
                                    onClick={() => setTheme('light')}
                                    className={`p-1.5 rounded-sm transition-all ${theme === 'light' ? 'bg-background shadow-sm text-foreground' : 'text-gray-700 dark:text-gray-200'}`}
                                    title="Light Mode"
                                >
                                    <SunIcon className="h-4 w-4" />
                                </button>
                                <button
                                    onClick={() => setTheme('dark')}
                                    className={`p-1.5 rounded-sm transition-all ${theme === 'dark' ? 'bg-background shadow-sm text-foreground' : 'text-gray-700 dark:text-gray-200'}`}
                                    title="Dark Mode"
                                >
                                    <MoonIcon className="h-4 w-4" />
                                </button>
                            </div>
                        </div>

                        {/* Filter Toggle */}
                        {filterHook && (
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium">Filters</span>
                                <button
                                    onClick={() => {
                                        filterHook.toggleSidebar();
                                        setIsOpen(false);
                                    }}
                                    className={`p-1.5 rounded-sm transition-all ${filterHook.filters.isOpen ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-muted text-gray-700 dark:text-gray-200'}`}
                                    title="Toggle Filters"
                                >
                                    <FunnelIcon className="h-4 w-4" />
                                </button>
                            </div>
                        )}

                        {/* Timezone Selector */}
                        <div className="space-y-2">
                            <span className="text-sm font-medium block">Timezone</span>
                            <div className="w-full">
                                <TimezoneSelector timezone={timezone} onTimezoneChange={onTimezoneChange} />
                            </div>
                        </div>

                        {/* Legend */}
                        {showLegend && (
                            <div className="space-y-2 pt-2 border-t border-border">
                                <div className="flex items-center space-x-2 text-sm font-medium">
                                    <QuestionMarkCircleIcon className="h-3.5 w-3.5" />
                                    <span>Legend</span>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <LegendItem color="bg-blue-500" label="Morning" />
                                    <LegendItem color="bg-purple-500" label="Evening" />
                                    <LegendItem color="bg-green-500" label="Weekend" />
                                    <LegendItem color="bg-amber-500" label="Screener" />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ViewSettingsMenu;
