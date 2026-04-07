//import { useEffect } from 'react';
import { RouterProvider } from '@tanstack/react-router';
import { router } from '@/routes/router';
import { initAuth } from '@/lib/api/auth';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/api/client';
import { AuthProvider } from '@/context/auth';
import { ThemeProvider } from 'next-themes';
import { Toaster } from '@/components/ui/sonner';
export function App() {
  // Initialize Firebase auth listener
  // useEffect(() => {
  //   const unsubscribe = initAuth();
  //   return () => unsubscribe();
  // }, []);
  if (localStorage.getItem('isAuth') !== 'true' || !localStorage.getItem('isAuth')) {
      initAuth();
  }
   

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <RouterProvider router={router} />
          <Toaster position="bottom-right" expand={false} />
        </ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
