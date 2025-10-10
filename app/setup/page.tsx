"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { User, onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase"; // Using path alias
import { VoiceSetupStep } from "@/components/setup/VoiceSetup";
import { TeamSetupStep } from "@/components/setup/TeamSetup";
import { Loader2 } from "lucide-react";

// Define the steps for the setup wizard
type SetupStep = "voice" | "team";

export default function SetupPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [setupStep, setSetupStep] = useState<SetupStep>("voice");
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
      } else {
        // If no user is logged in, redirect to login page
        router.push("/login");
      }
      setLoading(false);
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, [router]);

  const handleVoiceProfileComplete = () => {
    setSetupStep("team");
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-100 flex items-center justify-center p-4">
        <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-100 flex items-center justify-center p-4 transition-opacity duration-500 ease-in-out">
      {setupStep === "voice" && (
        <VoiceSetupStep user={user} onComplete={handleVoiceProfileComplete} />
      )}
      {setupStep === "team" && <TeamSetupStep user={user} />}
    </div>
  );
}

