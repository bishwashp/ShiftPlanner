import { LucideIcon, Calendar, Users, AlertTriangle, CheckCircle } from 'lucide-react';

export interface TabConfig {
  key: string;
  label: string;
  icon: LucideIcon;
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
      { key: 'holidays', label: 'Holidays', icon: Calendar },
      { key: 'absences', label: 'Absences', icon: Users }
    ],
    defaultTab: 'holidays'
  },
  conflicts: {
    tabs: [
      { key: 'critical', label: 'Critical', icon: AlertTriangle },
      { key: 'recommended', label: 'Recommended', icon: CheckCircle }
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
