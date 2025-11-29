import React, { useState, useEffect } from 'react';
import moment from 'moment-timezone';

const WorldClock: React.FC = () => {
    const [times, setTimes] = useState<Array<{ city: string, code: string, time: string, isPM: boolean, tz: string }>>([]);

    useEffect(() => {
        const updateTimes = () => {
            const zones = [
                { city: 'Singapore', code: 'SGT', tz: 'Asia/Singapore' },
                { city: 'India', code: 'IST', tz: 'Asia/Kolkata' },
                { city: 'London', code: 'LON', tz: 'Europe/London' },
                { city: 'Austin', code: 'CST', tz: 'America/Chicago' },
                { city: 'San Francisco', code: 'PST', tz: 'America/Los_Angeles' }
            ];

            const newTimes = zones.map(z => {
                const m = moment().tz(z.tz);
                return {
                    ...z,
                    time: m.format('h'),
                    minutes: m.format('mm'),
                    period: m.format('a'),
                    isPM: m.format('A') === 'PM'
                };
            });

            setTimes(newTimes as any);
        };

        updateTimes();
        const timer = setInterval(updateTimes, 60000);

        return () => clearInterval(timer);
    }, []);

    return (
        <div className="h-full w-full">
            <div className="flex w-full h-full rounded-xl overflow-hidden">
                {times.map((t: any, index) => (
                    <div
                        key={t.code}
                        className={`flex-1 flex flex-col justify-between py-2 px-1 ${t.isPM
                                ? 'bg-gray-900 dark:bg-gray-800'
                                : 'bg-white dark:bg-gray-100'
                            }`}
                    >
                        <div className="flex items-start justify-between w-full">
                            <span className={`text-[11px] font-bold uppercase tracking-wider ${t.isPM ? 'text-gray-400' : 'text-gray-500'
                                }`}>
                                {t.code}
                            </span>
                            {/* Location Arrow/Icon could go here if needed */}
                        </div>

                        <div className="flex items-end">
                            <span className={`text-[2.5rem] font-bold leading-none [font-stretch:condensed] ${t.isPM ? 'text-white' : 'text-gray-900'
                                }`} style={{ fontStretch: 'condensed' }}>
                                {t.time}
                            </span>
                            <div className="flex flex-col justify-between ml-0.5 pb-0.5">
                                <span className={`text-[0.875rem] font-bold leading-none [font-stretch:condensed] ${t.isPM ? 'text-white' : 'text-gray-900'
                                    }`} style={{ fontStretch: 'condensed' }}>
                                    {t.minutes}
                                </span>
                                <span className={`text-[0.625rem] font-medium uppercase leading-none [font-stretch:condensed] ${t.isPM ? 'text-gray-400' : 'text-gray-500'
                                    }`} style={{ fontStretch: 'condensed' }}>
                                    {t.period}
                                </span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default WorldClock;
