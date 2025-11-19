import { ThemeToggle } from "@/components/theme-toggle";
import { TourGuide } from "@/components/tour-guide";
import { Outlet } from "@tanstack/react-router";
import { TeacherSidebar } from "@/components/teacher-sidebar";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";

// import React from "react";

/*const AuroraText = ({
  children,
  colors = ["#2563eb", "#1d4ed8", "#1e40af"],
}: {
  children: React.ReactNode;
  colors?: string[];
}) => (
  <span className="bg-gradient-to-r from-blue-600 via-blue-700 to-blue-800 bg-clip-text text-transparent dark:from-blue-400 dark:via-blue-500 dark:to-blue-600">
    {children}
  </span>
);*/

export default function TeacherLayout() {
  return (
    <SidebarProvider>
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-blue-200/20 to-blue-300/20 rounded-full blur-3xl dark:from-blue-800/10 dark:to-blue-900/10"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-br from-blue-100/20 to-indigo-200/20 rounded-full blur-3xl dark:from-blue-800/10 dark:to-indigo-900/10"></div>
      </div>

      <TeacherSidebar />
      <SidebarInset className="bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-slate-900 dark:to-gray-950">
        <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-xl border-b border-slate-200 shadow-sm dark:bg-gray-900/95 dark:border-gray-800">
          <div className="flex h-16 items-center gap-4 px-4">
            <SidebarTrigger className="hover:bg-blue-50 dark:hover:bg-blue-900/20" data-tour="sidebar-trigger" />

            <div className="flex flex-1 items-center justify-between">
              <div className="flex items-center gap-4">
                <h1 className="text-lg font-semibold text-gray-900 dark:text-white" data-tour="dashboard-header">
                  Teacher Dashboard
                </h1>
              </div>
              
              <div className="flex items-center gap-2">
                <TourGuide />
                <ThemeToggle data-tour="theme-toggle" />
              </div>
            </div>
          </div>
        </header>

        <main className="relative flex-1 p-4 sm:p-6">
          <div className="relative z-10 max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}