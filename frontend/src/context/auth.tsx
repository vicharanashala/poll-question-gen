import React, { createContext, useEffect, useState } from 'react';
import { useAuthStore } from '@/lib/store/auth-store';
import { logout, loginWithGoogle, loginWithEmail } from '@/lib/api/auth';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import api from '@/lib/api/api';

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
  const [loading, setLoading] = useState(true);

  // Restore auth state on reload
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (firebaseUser) {
          const token = await firebaseUser.getIdToken();
          localStorage.setItem('auth-token', token);

          // 👇 You can customize this part (e.g., get role from DB)
          const { uid, email, displayName } = firebaseUser;
          const storedRole = localStorage.getItem('user-role') as Role;
          if (storedRole) {
            let userAvatar;
            let userName = displayName || '';
            try {
              const profileRes = await api.get(`/users/firebase/${uid}/profile?t=${new Date().getTime()}`);
              if (profileRes.data) {
                userAvatar = profileRes.data.avatar;
                const backendName = `${profileRes.data.firstName || ''} ${profileRes.data.lastName || ''}`.trim();
                if (backendName) userName = backendName;
              }
            } catch(e) {
              console.error("Failed to hydrate profile on startup", e);
            }

            try {
              setUser({
                uid,
                email: email || '',
                name: userName,
                role: storedRole,
                avatar: userAvatar,
              });
            } catch (err) {
              console.error("Storage crash during user sync", err);
            }
          }
        } else {
          localStorage.removeItem('auth-token');
          localStorage.removeItem('user-role');
          clearUser();
        }
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Login function that sets the user in the store
  const login = async (selectedRole: Role, uid: string, email: string, name?: string) => {
    if (selectedRole) {
      let userAvatar;
      let userName = name || '';
      try {
        const profileRes = await api.get(`/users/firebase/${uid}/profile?t=${new Date().getTime()}`);
        if (profileRes.data) {
          userAvatar = profileRes.data.avatar;
          const backendName = `${profileRes.data.firstName || ''} ${profileRes.data.lastName || ''}`.trim();
          if (backendName) userName = backendName;
        }
      } catch(e) {
        console.error("Failed to hydrate profile on login", e);
      }

      try {
        setUser({
          uid,
          email,
          name: userName,
          role: selectedRole,
          avatar: userAvatar,
        });
      } catch (err) {
        console.error("Storage crash during login user sync", err);
      }
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
