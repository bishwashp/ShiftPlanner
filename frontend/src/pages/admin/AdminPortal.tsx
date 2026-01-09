import React, { useState } from 'react';
import RegionManagement from './RegionManagement';
import ShiftManagement from './ShiftManagement';
import HandoverManagement from './HandoverManagement';
import { Globe, Clock, ArrowsLeftRight } from '@phosphor-icons/react';
import SegmentedControl from '../../components/ui/SegmentedControl';
import HeaderActionPortal from '../../components/layout/HeaderActionPortal';

const AdminPortal: React.FC = () => {
    const [activeTab, setActiveTab] = useState('regions');

    const tabOptions = [
        { value: 'regions', label: 'Regions', icon: <Globe className="w-4 h-4" /> },
        { value: 'shifts', label: 'Shifts', icon: <Clock className="w-4 h-4" /> },
        { value: 'handovers', label: 'Handovers', icon: <ArrowsLeftRight className="w-4 h-4" /> },
    ];

    return (
        <div className="min-h-screen p-6 relative z-10">
            <div className="max-w-6xl mx-auto space-y-6">

                {/* Tab Navigation Portal to Header */}
                <HeaderActionPortal targetId="app-header-right-actions">
                    <SegmentedControl
                        value={activeTab}
                        onChange={setActiveTab}
                        options={tabOptions}
                        className="shadow-sm border border-gray-200/50 dark:border-white/10"
                    />
                </HeaderActionPortal>

                {/* Content Area */}
                <div className="animate-in fade-in duration-300">
                    {activeTab === 'regions' && <RegionManagement />}
                    {activeTab === 'shifts' && <ShiftManagement />}
                    {activeTab === 'handovers' && <HandoverManagement />}
                </div>
            </div>
        </div>
    );
};

export default AdminPortal;
