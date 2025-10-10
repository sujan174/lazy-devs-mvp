"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { User } from "firebase/auth";
import {
  doc,
  addDoc,
  getDoc,
  updateDoc,
  collection,
  arrayUnion,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase"; 

// Importing icons - Added Copy, Download, and ArrowRight
import { Loader2, Users, UserPlus, XCircle, Copy, Download, ArrowRight } from "lucide-react";

interface TeamSetupStepProps {
  user: User;
}

export function TeamSetupStep({ user }: TeamSetupStepProps) {
  const [teamName, setTeamName] = useState("");
  const [joinTeamId, setJoinTeamId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // New state for the success modal
  const [newlyCreatedTeamId, setNewlyCreatedTeamId] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !teamName.trim()) return;
    setError(null);
    setIsSubmitting(true);
    try {
      const teamCollectionRef = collection(db, "teams");
      const newTeamDoc = await addDoc(teamCollectionRef, {
        name: teamName,
        creatorId: user.uid,
        members: [user.uid],
        createdAt: serverTimestamp(),
      });
      const userDocRef = doc(db, "users", user.uid);
      await updateDoc(userDocRef, { teamId: newTeamDoc.id });
      
      // Instead of redirecting, show the success modal
      setNewlyCreatedTeamId(newTeamDoc.id);

    } catch (err) {
      console.error(err);
      setError("Failed to create team. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleJoinTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !joinTeamId.trim()) return;
    setError(null);
    setIsSubmitting(true);
    const teamDocRef = doc(db, "teams", joinTeamId.trim());
    try {
      const teamDoc = await getDoc(teamDocRef);
      if (!teamDoc.exists()) throw new Error("Team ID not found.");
      await updateDoc(teamDocRef, { members: arrayUnion(user.uid) });
      const userDocRef = doc(db, "users", user.uid);
      await updateDoc(userDocRef, { teamId: teamDoc.id });
      router.push("/");
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to join team.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyToClipboard = () => {
    if (newlyCreatedTeamId) {
      navigator.clipboard.writeText(newlyCreatedTeamId);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000); // Reset after 2 seconds
    }
  };

  const handleDownloadTxt = () => {
    if (!newlyCreatedTeamId) return;
    const fileContent = `Welcome to your new team!\n\nTeam Name: ${teamName}\nYour Team ID is: ${newlyCreatedTeamId}\n\nShare this ID with your colleagues to let them join.`;
    const blob = new Blob([fileContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${teamName.replace(/\s+/g, '-')}-team-id.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  
  // If a team was just created, render the success modal
  if (newlyCreatedTeamId) {
    return (
      <div className="bg-white shadow-2xl rounded-2xl p-8 w-full max-w-lg border border-gray-100">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Team Created Successfully!</h1>
          <p className="text-gray-500 mt-2">Share this ID with your team members to let them join.</p>
          
          <div className="my-6 p-4 bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg">
            <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Your Team ID</p>
            <p className="text-3xl font-mono font-bold text-indigo-600 mt-2 break-all">{newlyCreatedTeamId}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
             <button onClick={handleCopyToClipboard} className="inline-flex items-center justify-center w-full px-4 py-3 border border-transparent text-sm font-medium rounded-md shadow-sm text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors">
                <Copy className="w-5 h-5 mr-2" />
                {isCopied ? "Copied!" : "Copy ID"}
            </button>
             <button onClick={handleDownloadTxt} className="inline-flex items-center justify-center w-full px-4 py-3 border border-transparent text-sm font-medium rounded-md shadow-sm text-gray-700 bg-gray-100 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors">
                <Download className="w-5 h-5 mr-2" />
                Download as .txt
            </button>
          </div>

          <div className="mt-8">
            <button onClick={() => router.push('/')} className="w-full btn-primary inline-flex items-center justify-center group">
                Continue to Dashboard
                <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Otherwise, show the original create/join form
  return (
    <div className="bg-white shadow-2xl rounded-2xl p-8 w-full max-w-lg border border-gray-100 transition-all duration-300 ease-in-out">
      {/* Wizard Header */}
      <div className="text-center mb-8">
        <p className="text-sm font-semibold text-indigo-600">STEP 2 OF 2</p>
        <h1 className="text-3xl font-extrabold text-gray-900 mt-1">
          Join or Create a Team
        </h1>
        <p className="text-gray-500 mt-2">
          Create a new team to get an ID, or join with an existing ID.
        </p>
      </div>

      {/* Create Team Form */}
      <form onSubmit={handleCreateTeam} className="space-y-4 mb-6">
        <h2 className="text-lg font-semibold text-gray-800 flex items-center">
          <Users className="w-5 h-5 mr-3 text-indigo-600" />
          Create a New Team
        </h2>
        <div className="space-y-2">
          <label htmlFor="team-name" className="text-sm font-medium text-gray-700 block pl-1">
            Team Name
          </label>
          <input
            id="team-name"
            type="text"
            className="input-field"
            placeholder="e.g., The A-Team"
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            required
            disabled={isSubmitting}
          />
        </div>
        <button type="submit" className="w-full btn-primary inline-flex items-center justify-center disabled:opacity-50" disabled={isSubmitting || !teamName.trim()}>
          {isSubmitting ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Creating...</> : "Create Team"}
        </button>
      </form>

      {/* Divider */}
      <div className="relative flex py-2 items-center">
        <div className="flex-grow border-t border-gray-200"></div>
        <span className="flex-shrink mx-4 text-xs font-semibold text-gray-400 uppercase">OR</span>
        <div className="flex-grow border-t border-gray-200"></div>
      </div>

      {/* Join Team Form */}
      <form onSubmit={handleJoinTeam} className="space-y-4 mt-6">
        <h2 className="text-lg font-semibold text-gray-800 flex items-center">
          <UserPlus className="w-5 h-5 mr-3 text-indigo-600" />
          Join an Existing Team
        </h2>
        <div className="space-y-2">
          <label htmlFor="team-id" className="text-sm font-medium text-gray-700 block pl-1">
            Team ID
          </label>
          <input
            id="team-id"
            type="text"
            className="input-field"
            placeholder="Enter Team ID from your admin"
            value={joinTeamId}
            onChange={(e) => setJoinTeamId(e.target.value)}
            required
            disabled={isSubmitting}
          />
        </div>
        <button type="submit" className="w-full btn-primary inline-flex items-center justify-center disabled:opacity-50" disabled={isSubmitting || !joinTeamId.trim()}>
          {isSubmitting ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Joining...</> : "Join Team"}
        </button>
      </form>

      {/* Error Display */}
       {error && (
            <p className="text-red-600 text-sm text-center mt-6 flex items-center justify-center">
              <XCircle className="w-4 h-4 mr-1.5" /> {error}
            </p>
        )}
    </div>
  );
}

