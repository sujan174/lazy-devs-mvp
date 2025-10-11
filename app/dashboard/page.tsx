"use client";

import { MeetingsPane } from "../../components/dashboard/MeetingsPane";
import { ChatInput } from "../../components/dashboard/ChatInput";

export default function DashboardPage() {
  return (
    <div className="h-full flex p-6 gap-6">
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col bg-white rounded-xl border border-gray-200 shadow-sm">
        <header className="p-6 border-b border-gray-200">
           <h1 className="text-2xl font-bold text-gray-800">Chatbot</h1>
        </header>

        {/* This is where chat messages will eventually go. It's empty for now. */}
        <div className="flex-1 p-6">
          {/* Empty state or chat history will be rendered here */}
        </div>

        <ChatInput />
      </div>

      {/* Right Meetings Pane */}
      <MeetingsPane />
    </div>
  );
}

