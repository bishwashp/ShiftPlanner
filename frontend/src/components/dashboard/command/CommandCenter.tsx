import React from 'react';
import GlassCard from '../../common/GlassCard';
import CurrentScreener from './CurrentScreener';
import HandoverCountdown from './HandoverCountdown';
import WorldClock from './WorldClock';
import CoverageStatus from './CoverageStatus';
import UpcomingOOO from './UpcomingOOO';
import UpcomingHolidays from './UpcomingHolidays';
import SystemHealth from './SystemHealth';
import ScheduleHighlights from './ScheduleHighlights';
import StaffingChart from './StaffingChart';

const CommandCenter: React.FC<{ onResolve?: () => void }> = ({ onResolve }) => {
    return (
        <div className="space-y-4 mb-8">
            {/* Hero Row: Command & Control */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-24">
                <GlassCard className="p-3 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-2 opacity-10">
                        <div className="w-24 h-24 rounded-full bg-indigo-500 blur-2xl" />
                    </div>
                    <CurrentScreener />
                </GlassCard>

                <GlassCard className="p-3 relative overflow-hidden bg-gray-900/5 dark:bg-black/20">
                    <HandoverCountdown />
                </GlassCard>

                <WorldClock />
            </div>

            {/* Row 1: Staffing Status (2/3) + OOO (1/3) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-52">
                <div className="lg:col-span-2 h-full">
                    <GlassCard className="h-full p-4">
                        <CoverageStatus />
                    </GlassCard>
                </div>

                <div className="h-full">
                    <GlassCard className="h-full p-4">
                        <UpcomingOOO />
                    </GlassCard>
                </div>
            </div>

            {/* Row 2: Schedule Highlights + Staffing Chart + Holidays */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-36">
                <GlassCard className="p-4">
                    <ScheduleHighlights />
                </GlassCard>

                <GlassCard className="p-4">
                    <StaffingChart />
                </GlassCard>

                <GlassCard className="p-4">
                    <UpcomingHolidays />
                </GlassCard>
            </div>
        </div>
    );
};

export default CommandCenter;
