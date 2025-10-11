"use client";

import { UploadModalProvider } from "@/contexts/UploadModalProvider"; // Using relative path
import { ReactNode } from "react";

// This component's only job is to wrap children with all the necessary client-side providers.
export function Providers({ children }: { children: ReactNode }) {
  return (
    <UploadModalProvider>
      {children}
    </UploadModalProvider>
  );
}

