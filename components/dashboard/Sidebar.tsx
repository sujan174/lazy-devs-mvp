"use client";

import { LogOut, Settings, LayoutDashboard, User, DoorOpen, Upload } from "lucide-react";
import Link from "next/link";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";

interface SidebarProps {
  isCollapsed: boolean;
}

export function Sidebar({ isCollapsed }: SidebarProps) {
    const router = useRouter();
    const handleSignOut = async () => {
        try {
            await signOut(auth);
            router.push("/login");
        } catch (error) {
            console.error("Failed to sign out:", error);
        }
    };
    
  const navItems = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Team", href: "#", icon: User },
    { name: "Settings", href: "/dashboard/settings", icon: Settings },
  ];

  return (
    <aside
      className={`fixed top-0 left-0 h-full bg-slate-800 text-slate-200 flex flex-col transition-all duration-300 ease-in-out z-30 ${
        isCollapsed ? "w-20" : "w-64"
      }`}
    >
      <div className="h-20 flex items-center justify-center border-b border-slate-700">
        <div className={`text-2xl font-bold text-white transition-opacity duration-300 ${isCollapsed ? 'opacity-0' : 'opacity-100'}`}>
          LazyDevs
        </div>
         <div className={`absolute left-1/2 -translate-x-1/2 text-3xl font-bold text-white transition-opacity duration-300 ${isCollapsed ? 'opacity-100' : 'opacity-0'}`}>
          LD
        </div>
      </div>

      <nav className="flex-1 px-4 py-6 space-y-2">
        {navItems.map((item) => (
          <Link
            key={item.name}
            href={item.href}
            className="flex items-center p-3 text-slate-300 hover:bg-slate-700 hover:text-white rounded-lg transition-colors group"
          >
            <item.icon className="w-6 h-6 flex-shrink-0" />
            <span
              className={`ml-4 font-medium transition-all duration-200 ${
                isCollapsed ? "opacity-0 -translate-x-3 w-0" : "opacity-100 translate-x-0 w-auto"
              }`}
            >
              {item.name}
            </span>
          </Link>
        ))}
      </nav>

      <div className="px-4 py-4 border-t border-slate-700 space-y-2">
        <Link
            href="#" // Future link to /account
            className="w-full flex items-center p-3 text-slate-300 hover:bg-slate-700 hover:text-white rounded-lg transition-colors"
        >
          <User className="w-6 h-6" />
          <span className={`ml-4 font-medium transition-all duration-200 ${isCollapsed ? 'opacity-0' : 'opacity-100'}`}>
            Account
          </span>
        </Link>
        <button
          // onClick handler for leaving a team would be added here
          className="w-full flex items-center p-3 text-slate-300 hover:bg-yellow-500/20 hover:text-yellow-400 rounded-lg transition-colors"
        >
          <DoorOpen className="w-6 h-6" />
          <span className={`ml-4 font-medium transition-all duration-200 ${isCollapsed ? 'opacity-0' : 'opacity-100'}`}>
            Leave Team
          </span>
        </button>
        <button
          onClick={handleSignOut}
          className="w-full flex items-center p-3 text-slate-300 hover:bg-red-500/20 hover:text-red-400 rounded-lg transition-colors"
        >
          <LogOut className="w-6 h-6" />
          <span className={`ml-4 font-medium transition-all duration-200 ${isCollapsed ? 'opacity-0' : 'opacity-100'}`}>
            Sign Out
          </span>
        </button>
      </div>
    </aside>
  );
}

