import { createContext, ReactNode, useContext, useState } from 'react';

interface ThreadPanelContextType {
  isThreadPanelOpen: boolean;
  setIsThreadPanelOpen: (isOpen: boolean) => void;
}

const ThreadPanelContext = createContext<ThreadPanelContextType | undefined>(undefined);

export function ThreadPanelProvider({ children }: { children: ReactNode }) {
  const [isThreadPanelOpen, setIsThreadPanelOpen] = useState(false);

  return (
    <ThreadPanelContext.Provider value={{ isThreadPanelOpen, setIsThreadPanelOpen }}>
      {children}
    </ThreadPanelContext.Provider>
  );
}

export function useThreadPanel() {
  const context = useContext(ThreadPanelContext);
  if (context === undefined) {
    throw new Error('useThreadPanel must be used within a ThreadPanelProvider');
  }
  return context;
} 