"use client";

import { createContext, useState, useContext, ReactNode, useCallback, useEffect } from 'react';

interface UploadModalContextType {
  isUploadModalOpen: boolean;
  openUploadModal: () => void;
  closeUploadModal: () => void;
}

const UploadModalContext = createContext<UploadModalContextType | undefined>(undefined);

export function useUploadModal() {
  const context = useContext(UploadModalContext);
  if (context === undefined) {
    throw new Error('useUploadModal must be used within a UploadModalProvider');
  }
  return context;
}

export function UploadModalProvider({ children }: { children: ReactNode }) {
  const [isUploadModalOpen, setUploadModalOpen] = useState(false);

  const openUploadModal = useCallback(() => {
    setUploadModalOpen(true);
  }, []);

  const closeUploadModal = useCallback(() => {
    setUploadModalOpen(false);
  }, []);

  // Keyboard event handling for ESC key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isUploadModalOpen) {
        closeUploadModal();
      }
    };

    if (isUploadModalOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => document.removeEventListener('keydown', handleEscape);
  }, [isUploadModalOpen, closeUploadModal]);

  const value = { 
    isUploadModalOpen, 
    openUploadModal, 
    closeUploadModal
  };

  return (
    <UploadModalContext.Provider value={value}>
      {children}
    </UploadModalContext.Provider>
  );
}
