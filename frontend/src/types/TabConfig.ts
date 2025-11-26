import { CalendarIcon, UsersIcon, ExclamationTriangleIcon, CheckCircleIcon } from '@heroicons/react/24/outline';

export interface TabConfig {
  key: string;
  label: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  mobileLabel?: string; // Optional shorter label for mobile
}

export interface PageTabConfig {
  [pageKey: string]: {
    tabs: TabConfig[];
    defaultTab: string;
  };
}

// Centralized tab configuration for all pages
export const PAGE_TAB_CONFIGS: PageTabConfig = {
  availability: {
    tabs: [
      { key: 'holidays', label: 'Holidays', icon: CalendarIcon },
      { key: 'absences', label: 'Absences', icon: UsersIcon }
    ],
    defaultTab: 'holidays'
  },
  conflicts: {
    tabs: [
      { key: 'critical', label: 'Critical', icon: ExclamationTriangleIcon },
      { key: 'recommended', label: 'Recommended', icon: CheckCircleIcon }
    ],
    defaultTab: 'critical'
  }
  // Future pages can be added here easily
  // analytics: {
  //   tabs: [
  //     { key: 'overview', label: 'Overview', icon: BarChart3 },
  //     { key: 'performance', label: 'Performance', icon: TrendingUp }
  //   ],
  //   defaultTab: 'overview'
  // }
};
