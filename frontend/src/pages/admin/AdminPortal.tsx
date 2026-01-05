
import React, { useState } from 'react';
import RegionManagement from './RegionManagement';
import ShiftDefinitionManagement from './ShiftDefinitionManagement';
import { Globe, Clock } from '@phosphor-icons/react';

const AdminPortal: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'regions' | 'shifts'>('regions');

    return (
        <div className="min-h-screen p-6 relative z-10">
            <div className="max-w-6xl mx-auto space-y-6">

                {/* Tab Navigation */}
                <div className="flex space-x-1 bg-white/40 dark:bg-gray-800/40 p-1 rounded-xl backdrop-blur-sm border border-gray-200/50 dark:border-white/10 w-fit">
                    <button
                        onClick={() => setActiveTab('regions')}
                        className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'regions'
                            ? 'bg-white dark:bg-gray-700 shadow text-blue-600 dark:text-blue-400'
                            : 'text-gray-600 dark:text-gray-400 hover:bg-white/50 dark:hover:bg-gray-700/50'
                            }`}
                    >
                        <Globe className="w-4 h-4" />
                        <span>Regions</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('shifts')}
                        className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'shifts'
                            ? 'bg-white dark:bg-gray-700 shadow text-purple-600 dark:text-purple-400'
                            : 'text-gray-600 dark:text-gray-400 hover:bg-white/50 dark:hover:bg-gray-700/50'
                            }`}
                    >
                        <Clock className="w-4 h-4" />
                        <span>Shifts & Handovers</span>
                    </button>
                </div>

                {/* Content Area */}
                <div className="animate-in fade-in duration-300">
                    {activeTab === 'regions' ? <RegionManagement /> : <ShiftDefinitionManagement />}
                </div>
            </div>
        </div>
    );
};

export default AdminPortal;
