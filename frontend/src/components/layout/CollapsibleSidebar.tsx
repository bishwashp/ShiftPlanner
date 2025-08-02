import React from 'react';
import {
  CalendarDays,
  LayoutDashboard,
  Users,
  AlertTriangle,
  BarChart2,
  ListTodo,
  Cpu,
  Download
} from 'lucide-react';

export type View = 'schedule' | 'dashboard' | 'analysts' | 'conflicts' | 'analytics' | 'constraints' | 'algorithms' | 'export';

interface CollapsibleSidebarProps {
  isOpen: boolean;
  onViewChange: (view: View) => void;
  activeView: View;
}

const CollapsibleSidebar: React.FC<CollapsibleSidebarProps> = ({ isOpen, onViewChange, activeView }) => {
  if (!isOpen) return null;

  const navItems = [
    { view: 'schedule', label: 'Schedule', icon: CalendarDays },
    { view: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { view: 'analysts', label: 'Analysts', icon: Users },
    { view: 'conflicts', label: 'Conflicts', icon: AlertTriangle },
    { view: 'analytics', label: 'Analytics', icon: BarChart2 },
    { view: 'constraints', label: 'Constraints', icon: ListTodo },
    { view: 'algorithms', label: 'Algorithms', icon: Cpu },
    { view: 'export', label: 'Export & Integration', icon: Download },
  ];

  return (
    <aside className="w-64 bg-card text-card-foreground p-4 border-r border-border flex flex-col space-y-4">
      <div className="flex items-center space-x-2">
        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold">SP</div>
        <h1 className="text-lg font-bold">ShiftPlanner</h1>
      </div>
      <nav>
        <ul className="space-y-1">
          {navItems.map(item => (
            <li key={item.view}>
              <button 
                onClick={() => onViewChange(item.view as View)} 
                className={`w-full flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeView === item.view 
                    ? 'bg-primary/10 text-primary' 
                    : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                }`}
              >
                <item.icon className="h-5 w-5" />
                <span>{item.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
};

export default CollapsibleSidebar; 