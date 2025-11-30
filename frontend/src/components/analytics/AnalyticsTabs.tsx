import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface TabItem {
    id: string;
    label: string;
    content: React.ReactNode;
}

interface AnalyticsTabsProps {
    tabs: TabItem[];
    defaultTab?: string;
}

export const AnalyticsTabs: React.FC<AnalyticsTabsProps> = ({ tabs, defaultTab }) => {
    const [activeTab, setActiveTab] = useState(defaultTab || tabs[0].id);

    return (
        <div className="w-full">
            {/* Tab List */}
            <div className="flex space-x-1 rounded-xl bg-gray-100 dark:bg-gray-800 p-1 mb-6">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`
              relative w-full rounded-lg py-2.5 text-sm font-medium leading-5
              transition-colors duration-200 focus:outline-none focus:ring-2 ring-offset-2 ring-offset-blue-400 ring-white ring-opacity-60
              ${activeTab === tab.id
                                ? 'text-gray-900 dark:text-white'
                                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                            }
            `}
                    >
                        {activeTab === tab.id && (
                            <motion.div
                                layoutId="activeTab"
                                className="absolute inset-0 bg-white dark:bg-gray-700 rounded-lg shadow-sm"
                                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                            />
                        )}
                        <span className="relative z-10">{tab.label}</span>
                    </button>
                ))}
            </div>

            {/* Tab Panels */}
            <div className="relative min-h-[400px]">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeTab}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                        className="w-full"
                    >
                        {tabs.find(t => t.id === activeTab)?.content}
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    );
};
