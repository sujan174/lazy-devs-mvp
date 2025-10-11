"use client";

import { User } from "firebase/auth";
import { Menu } from "lucide-react";

interface HeaderProps {
  user: User;
  toggleSidebar: () => void;
}

export function Header({ user, toggleSidebar }: HeaderProps) {
  return (
    <header className="h-20 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-8 flex-shrink-0">
      <div>
        <button
          onClick={toggleSidebar}
          className="p-2 rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <Menu className="w-6 h-6" />
        </button>
      </div>
    </header>
  );
}
