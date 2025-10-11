"use client";
import { ChatInput } from "../../components/dashboard/ChatInput";
import { MeetingsPane } from "../../components/dashboard/MeetingsPane";

export default function DashboardPage() {
  return (
    // This parent div creates the two-column layout for the page content
    <div className="h-full flex p-6 gap-6">
      {/* Main Content Area (Chatbot) */}
      <div className="flex-1 flex flex-col bg-white rounded-xl border border-gray-200 shadow-sm">
        <header className="p-6 border-b border-gray-200">
           <h1 className="text-2xl font-bold text-gray-800">Chatbot</h1>
        </header>

        {/* This is where chat messages will eventually go. It's empty for now. */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {/* Chat history will be rendered here */}
        </div>

        <div className="border-t border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800 sm:p-6 rounded-b-xl">
          <ChatInput />
        </div>
      </div>

      {/* Right Meetings Pane */}
      <MeetingsPane />
   
    </div>
  );
}

