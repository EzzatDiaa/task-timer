"use client";

import React, { ReactNode, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface AppLayoutProps {
  children: ReactNode;
}

const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const { user, logout, isLoading } = useAuth();
  const router = useRouter();

  // Redirect to login if user is not authenticated
  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
    }
  }, [user, isLoading, router]);

  // Show loading indicator while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Return null if user is not authenticated (to prevent flash of content)
  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Top Navigation Bar */}
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link href="/tasks" className="text-xl font-bold text-gray-800">
                Task Timer
              </Link>
            </div>

            <div className="flex items-center">
              <div className="mr-4">
                <span className="text-gray-700">
                  Welcome, {user.firstName} {user.lastName}
                </span>
              </div>

              <button
                onClick={logout}
                className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-md text-sm"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content Area with Sidebar */}
      <div className="flex max-w-7xl mx-auto mt-6 px-4">
        {/* Sidebar */}
        <div className="w-64 pr-8">
          <div className="bg-white rounded-lg shadow-sm p-4">
            <h3 className="font-medium text-gray-700 mb-4">Navigation</h3>
            <ul>
              <li className="mb-2">
                <Link
                  href="/tasks"
                  className="block p-2 rounded-md hover:bg-gray-100 text-gray-700"
                >
                  All Tasks
                </Link>
              </li>
              <li className="mb-2">
                <Link
                  href="/tasks/create"
                  className="block p-2 rounded-md hover:bg-gray-100 text-gray-700"
                >
                  Create Task
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1">
          <div className="bg-white rounded-lg shadow-sm p-6">{children}</div>
        </div>
      </div>
    </div>
  );
};

export default AppLayout;
