"use client";

import { useState, useEffect, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase"; 
import { Sidebar } from "../../components/dashboard/Sidebar"; 
import { Header } from "../../components/dashboard/Header"; 
import { Loader2 } from "lucide-react";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSidebarCollapsed, setSidebarCollapsed] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        setLoading(false);
      } else {
        router.push("/login");
      }
    });
    return () => unsubscribe();
  }, [router]);

  if (loading || !user) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-indigo-600" />
          <p className="text-lg font-medium text-gray-600">Loading your space...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900">
      <Sidebar isCollapsed={isSidebarCollapsed} />
      <div
        className={`flex-1 flex flex-col transition-all duration-300 ease-in-out ${
          isSidebarCollapsed ? "ml-20" : "ml-64"
        }`}
      >
        <Header
          user={user}
          toggleSidebar={() => setSidebarCollapsed(!isSidebarCollapsed)}
        />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

