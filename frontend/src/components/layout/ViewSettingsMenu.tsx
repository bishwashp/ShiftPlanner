import React, { useState, useRef, useEffect } from 'react';
import { Settings, Moon, Sun, HelpCircle } from 'lucide-react';
import { useTheme } from 'react18-themes';
import TimezoneSelector from '../TimezoneSelector';

interface ViewSettingsMenuProps {
    timezone: string;
    onTimezoneChange: (tz: string) => void;
    showLegend?: boolean;
}

const ViewSettingsMenu: React.FC<ViewSettingsMenuProps> = ({
    timezone,
    onTimezoneChange,
    showLegend = true
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
            <span className="text-sm text-muted-foreground">{label}</span>
        </div>
    );

    return (
        <div className="relative" ref={menuRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`p-2 rounded-md transition-colors ${isOpen ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
                title="View Settings"
            >
                <Settings size={20} />
            </button>

            {isOpen && (
                <div className="absolute top-full right-0 mt-2 w-72 bg-card text-card-foreground p-4 rounded-lg shadow-lg border border-border z-50 animate-in fade-in zoom-in-95 duration-200">
                    <h3 className="font-semibold mb-4 text-foreground border-b border-border pb-2">View Settings</h3>

                    <div className="space-y-4">
                        {/* Theme Switcher */}
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">Theme</span>
                            <div className="flex bg-muted rounded-md p-1">
                                <button
                                    onClick={() => setTheme('light')}
                                    className={`p-1.5 rounded-sm transition-all ${theme === 'light' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'}`}
                                    title="Light Mode"
                                >
                                    <Sun size={16} />
                                </button>
                                <button
                                    onClick={() => setTheme('dark')}
                                    className={`p-1.5 rounded-sm transition-all ${theme === 'dark' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'}`}
                                    title="Dark Mode"
                                >
                                    <Moon size={16} />
                                </button>
                            </div>
                        </div>

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
                                    <HelpCircle size={14} />
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
