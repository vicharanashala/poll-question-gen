import React, { createContext, useState } from 'react';
import { useAuthStore } from '@/lib/store/auth-store';
import { logout, loginWithGoogle, loginWithEmail } from '@/lib/api/auth';

type Role = 'teacher' | 'student' | 'admin' | null;

interface AuthContextType {
  role: Role;
  isAuthenticated: boolean;
  login: (selectedRole: Role, uid: string, email: string, name?: string) => void;
  loginWithGoogle: () => Promise<any>;
  loginWithEmail: (email: string, password: string) => Promise<any>;
  logout: () => void;
}

// Create a context with default values
export const AuthContext = createContext<AuthContextType>({
  role: null,
  isAuthenticated: false,
  login: () => {},
  loginWithGoogle: async () => {},
  loginWithEmail: async () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Use the Zustand store
  const { user, isAuthenticated, setUser, clearUser } = useAuthStore();
  const [loading] = useState(false);

  // Login function that sets the user in the store
  const login = (selectedRole: Role, uid: string, email: string, name?: string) => {
    if (selectedRole) {
      setUser({
        uid,
        email,
        name,
        role: selectedRole,
      });
      localStorage.setItem('user-role', selectedRole); // Persist role
    }
  };
  
  // Logout function that clears the user from the store
  const handleLogout = () => {
    logout();
    clearUser();
    localStorage.removeItem('auth-token');
    localStorage.removeItem('user-role');
  };

  if (loading) return (
    <div className="flex items-center justify-center h-screen bg-gray-900">
      <div className="flex flex-col items-center space-y-6">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-gray-600 rounded-full"></div>
          <div className="w-16 h-16 border-4 border-blue-400 border-t-transparent rounded-full animate-spin absolute top-0 left-0"></div>
        </div>
        <div className="flex space-x-1">
          <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"></div>
          <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
          <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
        </div>
        <p className="text-xl font-medium text-gray-200">Authenticating...</p>
      </div>
    </div>
  );

  return (
    <AuthContext.Provider value={{ 
      role: (user?.role as Role) || null,
      isAuthenticated,
      login, 
      loginWithGoogle,
      loginWithEmail,
      logout: handleLogout
    }}>
      {children}
    </AuthContext.Provider>
  );
}
