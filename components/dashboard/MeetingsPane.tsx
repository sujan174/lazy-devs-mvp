"use client";

import { Clock, Plus } from "lucide-react";
import { useUploadModal } from "@/contexts/UploadModalContext"; // Using relative path

export function MeetingsPane() {
  const { openUploadModal } = useUploadModal();

  // Mock data for now
  const meetings = [
    { id: 1, title: "Q3 Project Sync", date: "Oct 11, 2025", duration: "45min" },
    { id: 2, title: "Client Kickoff - Acme Inc.", date: "Oct 10, 2025", duration: "1h 15min" },
    { id: 3, title: "Weekly Standup", date: "Oct 9, 2025", duration: "15min" },
  ];

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
      <div className="flex-1 p-4 space-y-3 overflow-y-auto">
        {meetings.map((meeting) => (
          <div key={meeting.id} className="p-4 rounded-lg bg-gray-50 hover:bg-gray-100 cursor-pointer transition-colors">
            <p className="font-semibold text-gray-800 truncate">{meeting.title}</p>
            <div className="flex items-center text-sm text-gray-500 mt-1.5">
              <Clock className="w-4 h-4 mr-2 flex-shrink-0" />
              <span>{meeting.date} &middot; {meeting.duration}</span>
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}

