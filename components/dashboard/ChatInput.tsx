"use client";

import { Send, Paperclip } from "lucide-react";

export function ChatInput() {
  return (
    <div className="p-6 border-t border-gray-200 bg-gray-50 rounded-b-xl">
      <form>
        <div className="relative">
          <input
            type="text"
            placeholder="Type your message..."
            className="w-full pl-12 pr-24 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow"
          />
          <div className="absolute left-4 top-1/2 -translate-y-1/2">
             <button type="button" className="p-1 rounded-full text-gray-400 hover:text-gray-600">
                 <Paperclip className="w-5 h-5"/>
            </button>
          </div>
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 flex items-center"
            >
              <Send className="w-4 h-4 mr-2" />
              Send
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
