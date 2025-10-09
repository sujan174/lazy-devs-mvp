"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { User, onAuthStateChanged } from "firebase/auth";
import {
  doc,
  setDoc,
  addDoc,
  getDoc,
  updateDoc,
  collection,
  arrayUnion,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function SetupPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [teamName, setTeamName] = useState("");
  const [joinTeamId, setJoinTeamId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [newlyCreatedTeamId, setNewlyCreatedTeamId] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
      } else {
        router.push("/login");
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  const updateUserProfile = async (userId: string, teamId: string) => {
    const userDocRef = doc(db, "users", userId);
    if (user && user.email) {
      await setDoc(
        userDocRef,
        { uid: userId, email: user.email, teamId: teamId },
        { merge: true }
      );
    }
  };

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !teamName.trim()) return;

    setError(null);
    try {
      const teamCollectionRef = collection(db, "teams");
      const newTeamDoc = await addDoc(teamCollectionRef, {
        name: teamName,
        creatorId: user.uid,
        members: [user.uid],
        createdAt: serverTimestamp(),
      });

      await updateUserProfile(user.uid, newTeamDoc.id);
      
      // Instead of redirecting, show the success screen with the new ID
      setNewlyCreatedTeamId(newTeamDoc.id);

    } catch (err) {
      console.error(err);
      setError("Failed to create team. Please try again.");
    }
  };

  const handleJoinTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !joinTeamId.trim()) return;
    
    setError(null);
    const teamDocRef = doc(db, "teams", joinTeamId.trim());

    try {
      const teamDoc = await getDoc(teamDocRef);
      if (!teamDoc.exists()) {
        setError("Team ID not found. Please check the ID and try again.");
        return;
      }

      await updateDoc(teamDocRef, {
        members: arrayUnion(user.uid),
      });

      await updateUserProfile(user.uid, teamDoc.id);

      router.push("/");
    } catch (err) {
      console.error(err);
      setError("Failed to join team. Please try again.");
    }
  };

  const handleCopyToClipboard = () => {
    if (newlyCreatedTeamId) {
      navigator.clipboard.writeText(newlyCreatedTeamId);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000); // Reset after 2 seconds
    }
  };
  
  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  // If a team was just created, show the success card
  if (newlyCreatedTeamId) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Team Created Successfully!</CardTitle>
            <CardDescription>Share this ID with your team members to let them join.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-md text-center font-mono text-lg tracking-widest">
              {newlyCreatedTeamId}
            </div>
            <Button onClick={handleCopyToClipboard} className="w-full">
              {isCopied ? "Copied!" : "Copy ID"}
            </Button>
          </CardContent>
          <CardFooter>
             <Button variant="outline" className="w-full" onClick={() => router.push('/')}>
                Go to Dashboard
             </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // Otherwise, show the create/join tabs
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900">
      <Tabs defaultValue="create" className="w-full max-w-md">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="create">Create Team</TabsTrigger>
          <TabsTrigger value="join">Join Team</TabsTrigger>
        </TabsList>
        <TabsContent value="create">
          <Card>
            <CardHeader>
              <CardTitle>Create a new team</CardTitle>
              <CardDescription>
                Give your team a name to get started. You'll get an ID to share.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateTeam}>
                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="team-name">Team Name</Label>
                    <Input
                      id="team-name"
                      placeholder="The A-Team"
                      required
                      value={teamName}
                      onChange={(e) => setTeamName(e.target.value)}
                    />
                  </div>
                  <Button type="submit" className="w-full">Create Team</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="join">
          <Card>
            <CardHeader>
              <CardTitle>Join an existing team</CardTitle>
              <CardDescription>
                Enter the Team ID you received from your team creator.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleJoinTeam}>
                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="team-id">Team ID</Label>
                    <Input
                      id="team-id"
                      placeholder="Enter Team ID"
                      required
                      value={joinTeamId}
                      onChange={(e) => setJoinTeamId(e.target.value)}
                    />
                  </div>
                   {error && <p className="text-sm text-red-500">{error}</p>}
                  <Button type="submit" className="w-full">Join Team</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

