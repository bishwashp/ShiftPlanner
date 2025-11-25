import React from 'react';
import { XMarkIcon, ExclamationTriangleIcon, InformationCircleIcon, ClockIcon } from '@heroicons/react/24/outline';
import Button from './ui/Button';

export type ActionPromptType = 'critical' | 'important' | 'optional';
export type ActionPromptStatus = 'pending' | 'in-progress' | 'completed' | 'dismissed';

export interface ActionPromptAction {
  label: string;
  variant?: 'primary' | 'secondary' | 'destructive';
  onClick: () => void;
  loading?: boolean;
}

export interface ActionPrompt {
  id: string;
  type: ActionPromptType;
  status: ActionPromptStatus;
  title: string;
  message: string;
  actions: ActionPromptAction[];
  metadata?: {
    relatedView?: string;
    analystId?: string;
    scheduleId?: string;
    conflictId?: string;
  };
  timeout?: number; // Auto-dismiss after this many milliseconds
  createdAt: Date;
  dismissedAt?: Date;
}

interface ActionPromptProps {
  prompt: ActionPrompt;
  onDismiss: (id: string) => void;
  onAction: (id: string, actionIndex: number) => void;
}

const ActionPromptComponent: React.FC<ActionPromptProps> = ({ prompt, onDismiss, onAction }) => {
  const getIcon = () => {
    switch (prompt.type) {
      case 'critical':
        return <ExclamationTriangleIcon className="w-6 h-6 text-red-500" />;
      case 'important':
        return <ClockIcon className="w-6 h-6 text-yellow-500" />;
      case 'optional':
        return <InformationCircleIcon className="w-6 h-6 text-blue-500" />;
      default:
        return <InformationCircleIcon className="w-6 h-6 text-gray-500" />;
    }
  };

  const getBorderColor = () => {
    switch (prompt.type) {
      case 'critical':
        return 'border-red-500';
      case 'important':
        return 'border-yellow-500';
      case 'optional':
        return 'border-blue-500';
      default:
        return 'border-gray-500';
    }
  };

  const getBackgroundColor = () => {
    switch (prompt.type) {
      case 'critical':
        return 'bg-red-50 dark:bg-red-900/20';
      case 'important':
        return 'bg-yellow-50 dark:bg-yellow-900/20';
      case 'optional':
        return 'bg-blue-50 dark:bg-blue-900/20';
      default:
        return 'bg-gray-50 dark:bg-gray-900/20';
    }
  };

  return (
    <div className={`fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4`}>
      <div className={`bg-background border-2 ${getBorderColor()} ${getBackgroundColor()} rounded-xl shadow-2xl max-w-md w-full p-6`}>
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            {getIcon()}
            <div>
              <h3 className="text-lg font-semibold text-foreground">{prompt.title}</h3>
              <p className="text-sm text-gray-700 dark:text-gray-200">
                {prompt.type === 'critical' && 'Requires immediate attention'}
                {prompt.type === 'important' && 'Should be addressed soon'}
                {prompt.type === 'optional' && 'Nice to have'}
              </p>
            </div>
          </div>
          <Button
            onClick={() => onDismiss(prompt.id)}
            variant="ghost"
            size="icon"
            className="text-gray-700 dark:text-gray-200 hover:text-foreground"
            title={prompt.type === 'critical' ? 'Dismiss (conflicts will still be visible in Conflict Management)' : 'Dismiss'}
          >
            <XMarkIcon className="w-5 h-5" />
          </Button>
        </div>

        {/* Message */}
        <div className="mb-6">
          <p className="text-foreground">{prompt.message}</p>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3">
          {prompt.actions.map((action, index) => (
            <Button
              key={index}
              onClick={() => onAction(prompt.id, index)}
              disabled={action.loading}
              isLoading={action.loading}
              variant={action.variant === 'destructive' ? 'danger' : action.variant === 'secondary' ? 'secondary' : 'primary'}
            >
              {action.label}
            </Button>
          ))}
        </div>

        {/* Timeout indicator for non-critical prompts */}
        {prompt.type !== 'critical' && prompt.timeout && (
          <div className="mt-4 text-xs text-gray-700 dark:text-gray-200 text-center">
            This prompt will auto-dismiss in {Math.ceil(prompt.timeout / 1000)}s
          </div>
        )}
      </div>
    </div>
  );
};

export default ActionPromptComponent;
