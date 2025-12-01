import React, { useState, useEffect } from 'react';
import moment from 'moment-timezone';

const WorldClock: React.FC = () => {
    const [times, setTimes] = useState<Array<{ city: string, code: string, time: string, isPM: boolean, tz: string, isDaytime: boolean }>>([]);

    useEffect(() => {
        const updateTimes = () => {
            const zones = [
                { city: 'Singapore', code: 'SGT', tz: 'Asia/Singapore', lat: 1.3521, lng: 103.8198 },
                { city: 'India', code: 'IST', tz: 'Asia/Kolkata', lat: 28.6139, lng: 77.2090 }, // New Delhi
                { city: 'London', code: 'LON', tz: 'Europe/London', lat: 51.5074, lng: -0.1278 },
                { city: 'Austin', code: 'CST', tz: 'America/Chicago', lat: 30.2672, lng: -97.7431 },
                { city: 'San Francisco', code: 'PST', tz: 'America/Los_Angeles', lat: 37.7749, lng: -122.4194 }
            ];

            const now = new Date();

            const newTimes = zones.map(z => {
                const m = moment().tz(z.tz);

                // Simple Day/Night Logic: 6 AM to 8 PM is Day
                const hour = m.hour();
                const isDaytime = hour >= 6 && hour < 20;

                return {
                    ...z,
                    time: m.format('h'),
                    minutes: m.format('mm'),
                    period: m.format('a'),
                    isPM: m.format('A') === 'PM',
                    isDaytime
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
                        className={`flex-1 flex flex-col justify-between py-2 px-1 ${!t.isDaytime
                            ? 'bg-gray-900 dark:bg-gray-800'
                            : 'bg-white dark:bg-gray-100'
                            }`}
                    >
                        <div className="flex items-start justify-center w-full">
                            <span className={`text-[11px] font-bold uppercase tracking-wider ${!t.isDaytime ? 'text-gray-400' : 'text-gray-500'
                                }`}>
                                {t.code}
                            </span>
                            {/* Location Arrow/Icon could go here if needed */}
                        </div>

                        <div className="flex items-end justify-center">
                            <span className={`text-[2.5rem] font-display font-bold leading-none [font-stretch:condensed] ${!t.isDaytime ? 'text-white' : 'text-gray-900'
                                }`} style={{ fontVariationSettings: '"wdth" 70' }}>
                                {t.time}
                            </span>
                            <div className="flex flex-col justify-between ml-0.5 pb-0.5">
                                <span className={`text-[0.875rem] font-display font-bold leading-none [font-stretch:condensed] ${!t.isDaytime ? 'text-white' : 'text-gray-900'
                                    }`} style={{ fontVariationSettings: '"wdth" 70' }}>
                                    {t.minutes}
                                </span>
                                <span className={`text-[0.625rem] font-display font-medium uppercase leading-none [font-stretch:condensed] ${!t.isDaytime ? 'text-gray-400' : 'text-gray-500'
                                    }`} style={{ fontVariationSettings: '"wdth" 70' }}>
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
