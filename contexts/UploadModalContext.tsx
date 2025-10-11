"use client";

import { createContext, useState, useContext, ReactNode } from 'react';

// Define the shape (the "interface") for our context data
interface UploadModalContextType {
  isUploadModalOpen: boolean;
  openUploadModal: () => void;
  closeUploadModal: () => void;
}

// Create the context with an initial undefined value
const UploadModalContext = createContext<UploadModalContextType | undefined>(undefined);

// Create a custom hook for easy, typed access to the context
export function useUploadModal() {
  const context = useContext(UploadModalContext);
  if (context === undefined) {
    // This error is thrown if you try to use the hook outside of the provider's scope
    throw new Error('useUploadModal must be used within a UploadModalProvider');
  }
  return context;
}

// Create the Provider component. This is the component that will wrap parts of our app.
export function UploadModalProvider({ children }: { children: ReactNode }) {
  const [isUploadModalOpen, setUploadModalOpen] = useState(false);

  const openUploadModal = () => setUploadModalOpen(true);
  const closeUploadModal = () => setUploadModalOpen(false);

  // The value prop provides the state and functions to all children
  const value = { isUploadModalOpen, openUploadModal, closeUploadModal };

  return (
    <UploadModalContext.Provider value={value}>
      {children}
    </UploadModalContext.Provider>
  );
}

