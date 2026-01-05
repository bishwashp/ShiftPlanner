import React, { useState, useEffect } from 'react';
import moment from 'moment-timezone';
import { Timer, CaretRight, Warning } from '@phosphor-icons/react';
import { apiService } from '../../../services/api';

// Rolling digit component - uses a vertical strip of 0-9
// tabular-nums ensures monospaced behavior to prevent horizontal jitter
const RollingDigit: React.FC<{ digit: string }> = ({ digit }) => {
    const num = parseInt(digit, 10) || 0;

    return (
        <div className="relative inline-block h-[1.1em] overflow-hidden leading-none align-middle" style={{ width: '0.65em' }}>
            <div
                className="transition-transform duration-500 cubic-bezier(0.45, 0, 0.55, 1)"
                style={{ transform: `translateY(-${num * 10}%)` }}
            >
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                    <div key={n} className="h-[1.1em] flex items-center justify-center">
                        {n}
                    </div>
                ))}
            </div>
        </div>
    );
};

// Component to display time with rolling animation
const RollingTime: React.FC<{ value: string }> = ({ value }) => {
    return (
        <div className="flex items-center" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {value.split('').map((char, index) => (
                char === ':' ? (
                    <span key={index} className="mx-0.5 opacity-40 font-display flex items-center justify-center" style={{ width: '0.3em', fontSize: '0.8em' }}>:</span>
                ) : (
                    <RollingDigit key={index} digit={char} />
                )
            ))}
        </div>
    );
};

const HandoverCountdown: React.FC = () => {
    const [timeLeft, setTimeLeft] = useState({ hours: '00', minutes: '00', seconds: '00' });
    const [handoverInfo, setHandoverInfo] = useState<{ current: string; next: string } | null>(null);
    const [targetTime, setTargetTime] = useState<moment.Moment | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStatus = async () => {
            try {
                // Use global status for region-agnostic view
                const status = await apiService.getGlobalDashboardStatus();
                if (status.nextHandover) {
                    const target = moment(status.nextHandover.timestamp);
                    setTargetTime(target);
                    // Show source region + shift → target region + shift
                    // Avoid duplication like "LDN LDN" - if shift name equals region name, just show region
                    const formatShift = (region: string, shift: string) =>
                        region === shift ? region : `${region} ${shift}`;

                    setHandoverInfo({
                        current: formatShift(status.nextHandover.sourceRegion, status.nextHandover.sourceShift),
                        next: formatShift(status.nextHandover.targetRegion, status.nextHandover.targetShift)
                    });
                } else {
                    setHandoverInfo(null);
                }
            } catch (err) {
                console.error('Failed to fetch global dashboard status', err);
            } finally {
                setLoading(false);
            }
        };

        fetchStatus();
        const interval = setInterval(fetchStatus, 60000); // Poll every minute for updates
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (!targetTime) return;

        const updateTimer = () => {
            const now = moment();
            const diff = targetTime.diff(now);

            if (diff <= 0) {
                // Handover passed, maybe refresh?
                setTimeLeft({ hours: '00', minutes: '00', seconds: '00' });
                return;
            }

            const duration = moment.duration(diff);
            setTimeLeft({
                hours: Math.floor(duration.asHours()).toString().padStart(2, '0'),
                minutes: duration.minutes().toString().padStart(2, '0'),
                seconds: duration.seconds().toString().padStart(2, '0')
            });
        };

        updateTimer();
        const timer = setInterval(updateTimer, 1000);
        return () => clearInterval(timer);
    }, [targetTime]);


    if (loading) return <div className="h-full flex items-center justify-center text-xs text-gray-400">Loading...</div>;

    if (!handoverInfo) {
        return (
            <div className="flex flex-col h-full px-3 py-2 justify-center text-gray-400">
                <div className="flex items-center gap-2 mb-1">
                    <Warning className="w-4 h-4" />
                    <span className="text-xs font-medium uppercase tracking-wider">No Handover</span>
                </div>
                <div className="text-xs">No upcoming handovers configured.</div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full px-3 py-2">
            {/* Title */}
            <div className="flex items-center gap-2 mb-2">
                <Timer className="w-4 h-4 text-gray-400" />
                <span className="text-xs font-medium uppercase tracking-wider text-gray-400">Next Handover</span>
            </div>

            {/* Main Content: Timer (left) + Phases (right) */}
            <div className="flex items-center justify-between flex-1">
                {/* Large Timer with Odometer Style Animation */}
                <div
                    className="text-4xl font-display font-bold text-gray-900 dark:text-white flex items-center leading-none"
                    style={{ fontVariationSettings: '"wdth" 85' }}
                >
                    <RollingTime value={timeLeft.hours} />
                    <span className="mx-0.5 opacity-40 flex items-center justify-center" style={{ width: '0.3em', fontSize: '0.8em', transform: 'translateY(-0.05em)' }}>:</span>
                    <RollingTime value={timeLeft.minutes} />
                    <span className="mx-0.5 opacity-40 flex items-center justify-center" style={{ width: '0.3em', fontSize: '0.8em' }}>:</span>
                    <RollingTime value={timeLeft.seconds} />
                </div>

                {/* Phase Transition (stacked on right) */}
                <div className="flex flex-col items-end gap-0.5 ml-2 min-w-0 text-right">
                    <span className="text-xs font-bold text-blue-500 truncate max-w-[120px]">
                        {handoverInfo.current}
                    </span>
                    <div className="flex items-center gap-1 justify-end">
                        <CaretRight className="w-3 h-3 text-purple-500 flex-shrink-0" weight="bold" />
                        <span className="text-xs font-bold text-purple-500 truncate max-w-[120px]">
                            {handoverInfo.next}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default HandoverCountdown;
