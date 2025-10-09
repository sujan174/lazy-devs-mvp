"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { User, onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function HomePage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        const userDocRef = doc(db, "users", currentUser.uid);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists() && userDoc.data().teamId) {
          setUser(currentUser);
        } else {
          router.push("/setup");
          return;
        }
      } else {
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
      <main className="auth-container">
        <p className="text-muted-foreground">Loading...</p>
      </main>
    );
  }

  if (user) {
    return (
      <main className="auth-container">
        <div className="text-center">
          <h1 className="h1">Welcome to the Dashboard!</h1>
          <p className="p mt-4">You are logged in as {user.email}.</p>
          <Button onClick={handleSignOut} className="mt-6">Sign Out</Button>
        </div>
      </main>
    );
  }

  return (
    <main className="auth-container">
        <div className="auth-card text-center">
            <div className="auth-card-header">
                <h1 className="auth-card-title">Welcome to LazyDevs MVP</h1>
                <p className="auth-card-description pt-2">Please sign in or create an account to continue.</p>
            </div>
            <div className="auth-card-content flex gap-4 justify-center">
                <Link href="/login">
                    <Button>Login</Button>
                </Link>
                <Link href="/signup">
                    <Button variant="outline">Sign Up</Button>
                </Link>
            </div>
        </div>
    </main>
  );
}

