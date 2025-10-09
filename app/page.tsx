"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { User, onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import Link from "next/link";

export default function HomePage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        // User is logged in, check if they have completed the new setup
        const userDocRef = doc(db, "users", currentUser.uid);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
          // The user document exists, meaning they have a voiceprint. Show the dashboard.
          setUser(currentUser);
        } else {
          // The user document does NOT exist. Redirect to the new voiceprint setup page.
          router.push("/setup");
          return; 
        }
      } else {
        // User is not logged in
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router]);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      router.push("/login");
    } catch (error) {
      console.error("Failed to sign out:", error);
    }
  };
  
  if (loading) {
    return (
      <div className="auth-container">
        <h1 className="text-xl">Loading...</h1>
      </div>
    );
  }

  if (user) {
    return (
      <div className="dashboard-container">
        <div className="auth-card text-center">
            <h1 className="auth-card-title">Welcome to the Dashboard!</h1>
            <p className="auth-card-description">You are logged in as {user.email}.</p>
            <button onClick={handleSignOut} className="btn-secondary w-full mt-4">Sign Out</button>
        </div>
      </div>
    );
  }

  // Fallback for non-logged in users (though they should be redirected by the effect)
  return (
    <div className="auth-container">
         <div className="auth-card text-center">
            <h1 className="auth-card-title">Welcome to LazyDevs MVP</h1>
            <div className="flex gap-4 mt-6">
                <Link href="/login" className="btn-primary w-full text-center">Login</Link>
                <Link href="/signup" className="btn-secondary w-full text-center">Sign Up</Link>
            </div>
      </div>
    </div>
  );
}

