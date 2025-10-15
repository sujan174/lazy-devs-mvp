"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth, db } from "@/lib/firebase"; 
import { doc, getDoc, collection, query, where, onSnapshot, orderBy, Timestamp } from "firebase/firestore";
import { Clock, Plus, Loader2, FileText, AlertCircle } from "lucide-react";
import { useUploadModal } from "@/contexts/UploadModalProvider"; 
import { format } from 'date-fns';

interface Meeting {
  id: string;
  title: string;
  createdAt: Timestamp;
  durationMs: number;
}

export function MeetingsPane() {
  const { openUploadModal } = useUploadModal();
  const [user, setUser] = useState<User | null>(null);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser) {
        setMeetings([]);
        setLoading(false);
      }
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!user) return;

    let unsubscribeSnapshot: (() => void) | undefined;

    const fetchTeamAndMeetings = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const userDocRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userDocRef);

        if (!userDoc.exists()) {
          console.warn("User document not found");
          setMeetings([]);
          setLoading(false);
          return;
        }

        const teamId = userDoc.data()?.teamId;
        
        if (!teamId) {
          console.warn("User has no teamId assigned");
          setMeetings([]);
          setLoading(false);
          return;
        }

        console.log("Fetching meetings for teamId:", teamId);
        
        const meetingsRef = collection(db, "meetings");
        const q = query(
          meetingsRef, 
          where("teamId", "==", teamId), 
          orderBy("createdAt", "desc")
        );
        
        unsubscribeSnapshot = onSnapshot(
          q, 
          (querySnapshot) => {
            console.log(`Found ${querySnapshot.docs.length} meetings for team`);
            
            const meetingsData = querySnapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            })) as Meeting[];
            
            setMeetings(meetingsData);
            setLoading(false);
          }, 
          (err) => {
            console.error("Error fetching meetings:", err);
            
            // Check if it's an index error
            if (err.message.includes("index")) {
              setError("Database index required. Check console for setup link.");
              console.error(
                "🔥 FIRESTORE INDEX REQUIRED 🔥\n" +
                "You need to create a composite index in Firestore.\n" +
                "The error message above should contain a link to create it automatically.\n" +
                "Or manually create an index for collection 'meetings':\n" +
                "- Field: teamId (Ascending)\n" +
                "- Field: createdAt (Descending)"
              );
            } else {
              setError("Failed to load meetings. Please try again.");
            }
            
            setLoading(false);
          }
        );
      } catch (err) {
        console.error("Error in fetchTeamAndMeetings:", err);
        setError("Failed to initialize meetings");
        setLoading(false);
      }
    };

    fetchTeamAndMeetings();

    return () => {
      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
      }
    };
  }, [user]);

  const formatDuration = (ms: number) => {
    if (!ms || ms < 0) return '0min';
    const minutes = Math.floor(ms / 60000);
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    
    if (hours > 0) {
      return `${hours}h ${remainingMinutes}min`;
    }
    return `${minutes}min`;
  };

  return (
    <aside className="w-80 flex-shrink-0 bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col">
      <header className="p-6 border-b border-gray-200 flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-800">Meetings</h2>
        <button 
          onClick={openUploadModal} 
          className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500 transition-colors"
          aria-label="Upload a new meeting"
        >
          <Plus className="w-5 h-5" />
        </button>
      </header>
      
      <div className="flex-1 p-4 overflow-y-auto">
        {loading ? (
          <div className="flex justify-center items-center h-full">
            <Loader2 className="w-6 h-6 animate-spin text-gray-500" />
          </div>
        ) : error ? (
          <div className="text-center py-10 px-4">
            <AlertCircle className="mx-auto h-12 w-12 text-red-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">Error loading meetings</h3>
            <p className="mt-1 text-sm text-gray-500">{error}</p>
            <button 
              onClick={() => window.location.reload()} 
              className="mt-4 text-sm text-indigo-600 hover:text-indigo-800"
            >
              Try again
            </button>
          </div>
        ) : meetings.length === 0 ? (
          <div className="text-center py-10 px-4">
            <FileText className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No meetings yet</h3>
            <p className="mt-1 text-sm text-gray-500">Click the '+' to upload your first recording.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {meetings.map((meeting) => (
              <Link href={`/dashboard/meetings/${meeting.id}`} key={meeting.id}>
                <div className="group p-4 mb-3 rounded-xl bg-white border border-gray-200 hover:border-indigo-300 hover:shadow-md cursor-pointer transition-all duration-200">
                  <p className="font-semibold text-gray-900 truncate mb-2 group-hover:text-indigo-600 transition-colors">
                    {meeting.title}
                  </p>
                  <div className="flex items-center text-xs text-gray-500">
                    <Clock className="w-3.5 h-3.5 mr-1.5 flex-shrink-0" />
                    <span>
                      {meeting.createdAt ? format(meeting.createdAt.toDate(), 'MMM d, yyyy') : 'Date unknown'} 
                      {' · '}
                      {formatDuration(meeting.durationMs)}
                    </span>
                  </div>
                </div>
              </Link>
              
            ))}
            
          </div>
        )}
      </div>
    </aside>
  );
}