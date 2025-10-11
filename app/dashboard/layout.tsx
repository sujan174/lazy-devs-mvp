"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { Header } from "@/components/dashboard/Header";
import { Loader2 } from "lucide-react";
import { UploadModalProvider, useUploadModal } from "@/contexts/UploadModalContext";
import { UploadMeetingModal } from "@/components/dashboard/UploadMeetingModel";


// Helper component to render the modal and fetch necessary data
// This keeps the main layout component cleaner
function DashboardModalController({ user }: { user: User }) {
    const { isUploadModalOpen, closeUploadModal } = useUploadModal();
    const [teamId, setTeamId] = useState<string | null>(null);

    useEffect(() => {
        if (user) {
            const fetchTeamId = async () => {
                const userDocRef = doc(db, "users", user.uid);
                const userDoc = await getDoc(userDocRef);
                if (userDoc.exists()) {
                    setTeamId(userDoc.data().teamId);
                }
            };
            fetchTeamId();
        }
    }, [user]);

    // Don't render the modal if we don't have a teamId yet
    if (!teamId) return null;

    return (
        <UploadMeetingModal
            isOpen={isUploadModalOpen}
            onClose={closeUploadModal}
            teamId={teamId}
        />
    )
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
    // We wrap the entire dashboard in our new Provider
    <UploadModalProvider>
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
        {/* This helper component will manage rendering the modal */}
        <DashboardModalController user={user} />
      </div>
    </UploadModalProvider>
  );
}

