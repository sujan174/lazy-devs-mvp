"use client";

import { useState, useEffect } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth, db } from "../../lib/firebase"; // Using relative path
import { doc, getDoc, collection, query, where, onSnapshot, orderBy } from "firebase/firestore";
import { Clock, Plus, Loader2, FileText } from "lucide-react";
import { useUploadModal } from "@/contexts/UploadModalProvider"; // Using relative path
import { format } from 'date-fns';

// Define a type for our meeting data for better type safety
interface Meeting {
  id: string;
  title: string;
  createdAt: {
    seconds: number;
    nanoseconds: number;
  };
  durationMs: number;
}

export function MeetingsPane() {
  const { openUploadModal } = useUploadModal();
  const [user, setUser] = useState<User | null>(null);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Listen for auth changes to get the current user
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!user) return;

    let unsubscribeSnapshot: () => void;

    const fetchTeamAndMeetings = async () => {
      const userDocRef = doc(db, "users", user.uid);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        const teamId = userDoc.data().teamId;
        if (teamId) {
          // We have the teamId, now set up a real-time listener for meetings
          const meetingsRef = collection(db, "meetings");
          const q = query(
            meetingsRef, 
            where("teamId", "==", teamId), 
            orderBy("createdAt", "desc")
          );
          
          unsubscribeSnapshot = onSnapshot(q, (querySnapshot) => {
            const meetingsData = querySnapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            })) as Meeting[];
            setMeetings(meetingsData);
            setLoading(false);
          }, (error) => {
            console.error("Error fetching meetings in real-time:", error);
            setLoading(false);
          });
        } else {
            setLoading(false); // No teamId found
        }
      } else {
        setLoading(false); // No user document found
      }
    };

    fetchTeamAndMeetings();

    // Cleanup the Firestore listener when the component unmounts
    return () => {
      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
      }
    };
  }, [user]);

  const formatDuration = (ms: number) => {
    if (!ms || ms < 0) return '0min';
    const minutes = Math.floor(ms / 60000);
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
        ) : meetings.length === 0 ? (
          <div className="text-center py-10 px-4">
            <FileText className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No meetings yet</h3>
            <p className="mt-1 text-sm text-gray-500">Click the '+' to upload your first recording.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {meetings.map((meeting) => (
              <div key={meeting.id} className="p-4 rounded-lg bg-gray-50 hover:bg-gray-100 cursor-pointer transition-colors">
                <p className="font-semibold text-gray-800 truncate">{meeting.title}</p>
                <div className="flex items-center text-sm text-gray-500 mt-1.5">
                  <Clock className="w-4 h-4 mr-2 flex-shrink-0" />
                  <span>
                    {meeting.createdAt?.seconds ? format(new Date(meeting.createdAt.seconds * 1000), 'MMM d, yyyy') : 'Date unknown'} 
                    &middot; 
                    {formatDuration(meeting.durationMs)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}

