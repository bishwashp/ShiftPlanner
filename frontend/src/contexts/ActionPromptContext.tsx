import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import ActionPromptComponent, { ActionPrompt, ActionPromptStatus, ActionPromptAction } from '../components/ActionPrompt';

interface ActionPromptContextType {
  // Show action prompts
  showCriticalPrompt: (title: string, message: string, actions: ActionPromptAction[], metadata?: any) => string;
  showImportantPrompt: (title: string, message: string, actions: ActionPromptAction[], metadata?: any) => string;
  showOptionalPrompt: (title: string, message: string, actions: ActionPromptAction[], timeout?: number, metadata?: any) => string;
  
  // Manage prompts
  dismissPrompt: (id: string) => void;
  updatePromptStatus: (id: string, status: ActionPromptStatus) => void;
  
  // Get current prompts
  getActivePrompts: () => ActionPrompt[];
  hasActivePrompts: () => boolean;
}

const ActionPromptContext = createContext<ActionPromptContextType | undefined>(undefined);

export const useActionPrompts = () => {
  const context = useContext(ActionPromptContext);
  if (!context) {
    throw new Error('useActionPrompts must be used within an ActionPromptProvider');
  }
  return context;
};

interface ActionPromptProviderProps {
  children: React.ReactNode;
}

export const ActionPromptProvider: React.FC<ActionPromptProviderProps> = ({ children }) => {
  const [prompts, setPrompts] = useState<ActionPrompt[]>([]);

  // Generate unique ID
  const generateId = useCallback(() => {
    return `action-prompt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  // Show critical action prompt (blocking, no auto-dismiss)
  const showCriticalPrompt = useCallback((
    title: string, 
    message: string, 
    actions: ActionPromptAction[], 
    metadata?: any
  ): string => {
    const id = generateId();
    const newPrompt: ActionPrompt = {
      id,
      type: 'critical',
      status: 'pending',
      title,
      message,
      actions,
      metadata,
      createdAt: new Date(),
    };

    setPrompts(prev => [...prev, newPrompt]);
    return id;
  }, [generateId]);

  // Show important action prompt (dismissible, no auto-dismiss)
  const showImportantPrompt = useCallback((
    title: string, 
    message: string, 
    actions: ActionPromptAction[], 
    metadata?: any
  ): string => {
    const id = generateId();
    const newPrompt: ActionPrompt = {
      id,
      type: 'important',
      status: 'pending',
      title,
      message,
      actions,
      metadata,
      createdAt: new Date(),
    };

    setPrompts(prev => [...prev, newPrompt]);
    return id;
  }, [generateId]);

  // Show optional action prompt (dismissible, with optional timeout)
  const showOptionalPrompt = useCallback((
    title: string, 
    message: string, 
    actions: ActionPromptAction[], 
    timeout?: number,
    metadata?: any
  ): string => {
    const id = generateId();
    const newPrompt: ActionPrompt = {
      id,
      type: 'optional',
      status: 'pending',
      title,
      message,
      actions,
      timeout,
      metadata,
      createdAt: new Date(),
    };

    setPrompts(prev => [...prev, newPrompt]);
    return id;
  }, [generateId]);

  // Dismiss a prompt
  const dismissPrompt = useCallback((id: string) => {
    setPrompts(prev => prev.filter(prompt => prompt.id !== id));
  }, []);

  // Update prompt status
  const updatePromptStatus = useCallback((id: string, status: ActionPromptStatus) => {
    setPrompts(prev => prev.map(prompt => 
      prompt.id === id 
        ? { ...prompt, status, dismissedAt: status === 'dismissed' ? new Date() : undefined }
        : prompt
    ));
  }, []);

  // Get active prompts (pending or in-progress)
  const getActivePrompts = useCallback(() => {
    return prompts.filter(prompt => 
      prompt.status === 'pending' || prompt.status === 'in-progress'
    );
  }, [prompts]);

  // Check if there are any active prompts
  const hasActivePrompts = useCallback(() => {
    return getActivePrompts().length > 0;
  }, [getActivePrompts]);

  // Handle prompt actions
  const handleAction = useCallback((promptId: string, actionIndex: number) => {
    const prompt = prompts.find(p => p.id === promptId);
    if (!prompt) return;

    const action = prompt.actions[actionIndex];
    if (!action) return;

    // Update status to in-progress
    updatePromptStatus(promptId, 'in-progress');

    // Execute action
    try {
      action.onClick();
      
      // If it's a critical prompt, don't auto-dismiss
      // For others, mark as completed and dismiss after a delay
      if (prompt.type === 'critical') {
        updatePromptStatus(promptId, 'completed');
        // Keep critical prompts visible for a moment to show completion
        setTimeout(() => dismissPrompt(promptId), 2000);
      } else {
        updatePromptStatus(promptId, 'completed');
        setTimeout(() => dismissPrompt(promptId), 1500);
      }
    } catch (error) {
      console.error('Action prompt action failed:', error);
      updatePromptStatus(promptId, 'pending');
    }
  }, [prompts, updatePromptStatus, dismissPrompt]);

  // Handle timeout for optional prompts
  useEffect(() => {
    const timeouts: NodeJS.Timeout[] = [];

    prompts.forEach(prompt => {
      if (prompt.timeout && prompt.status === 'pending') {
        const timeout = setTimeout(() => {
          dismissPrompt(prompt.id);
        }, prompt.timeout);
        timeouts.push(timeout);
      }
    });

    return () => {
      timeouts.forEach(clearTimeout);
    };
  }, [prompts, dismissPrompt]);

  const contextValue: ActionPromptContextType = {
    showCriticalPrompt,
    showImportantPrompt,
    showOptionalPrompt,
    dismissPrompt,
    updatePromptStatus,
    getActivePrompts,
    hasActivePrompts,
  };

  return (
    <ActionPromptContext.Provider value={contextValue}>
      {children}
      
      {/* Render active prompts */}
      {getActivePrompts().map(prompt => (
        <ActionPromptComponent
          key={prompt.id}
          prompt={prompt}
          onDismiss={dismissPrompt}
          onAction={handleAction}
        />
      ))}
    </ActionPromptContext.Provider>
  );
};

export default ActionPromptProvider;
