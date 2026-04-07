import { StrictMode } from "react";
import TeacherDashboard from "@/pages/teacher/TeacherDashboard";
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/api/client';
import { ThemeProvider } from 'next-themes';
import { Toaster } from '@/components/ui/sonner';

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <TeacherDashboard />
        <Toaster />
      </ThemeProvider>
    </QueryClientProvider>
  );
}