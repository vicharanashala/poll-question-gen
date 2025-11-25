import { auth, provider } from '../firebase';
import {
  signInWithRedirect,
  getRedirectResult,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';
import { useAuthStore } from '../store/auth-store';
import { queryClient } from './client';

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8080/api";

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const mapFirebaseUserToAppUser = async (firebaseUser: FirebaseUser | null) => {
  if (!firebaseUser) return null;
  try {
    // Get token for backend API calls
    const token = await firebaseUser.getIdToken(true);
    useAuthStore.getState().setToken(token);

    // Fetch backend user info directly using fetch
    let backendUser = null;
    let attempts = 0;
    const maxAttempts = 2;

    while (attempts < maxAttempts && !backendUser) {
      attempts++;
      const res = await fetch(`${API_URL}/users/firebase/${firebaseUser.uid}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
      });

      if (res.ok) {
        backendUser = await res.json();
        console.log(`Fetched backend user on attempt ${attempts}:`, backendUser);
      } else if (res.status === 404 && attempts < maxAttempts) {
        console.warn(`User not found (attempt ${attempts}). Waiting 5 seconds before retry...`);
        await delay(5000);
      } else {
        const errorText = await res.text();
        console.error('Failed to fetch backend user:', errorText);
        throw new Error(`Failed to fetch user: ${errorText}`);
      }
    }

    console.log('Backend user data:', backendUser?.role);
    // Map user with backend data - ensure all fields are properly mapped
    const mappedUser = {
      uid: firebaseUser.uid,
      email: firebaseUser.email || backendUser?.email || '',
      name: firebaseUser.displayName ||
        (backendUser ? `${backendUser.firstName} ${backendUser.lastName}`.trim() : ''),
      role: backendUser?.role || null,
      avatar: firebaseUser.photoURL || backendUser?.avatar || '',
      // from mongoDB
      userId: backendUser?._id,
      firstName: backendUser?.firstName || firebaseUser.displayName?.split(' ')[0] || '',
      lastName: backendUser?.lastName || firebaseUser.displayName?.split(' ').slice(1).join(' ') || '',
      // Additional fields from IUser
      dateOfBirth: backendUser?.dateOfBirth || '',
      address: backendUser?.address || '',
      emergencyContact: backendUser?.emergencyContact || '',
      phoneNumber: backendUser?.phoneNumber || '',
      institution: backendUser?.institution || '',
      designation: backendUser?.designation || '',
      bio: backendUser?.bio || '',
      isVerified: backendUser?.isVerified || false,
      createdAt: backendUser?.createdAt,
      updatedAt: backendUser?.updatedAt
    };

    console.log('Mapped user data:', mappedUser);
    return mappedUser;
  } catch (error) {
    console.error('Error mapping Firebase user:', error);
    return null;
  }
};

// Updated login function - stores intent and redirects
export const loginWithGoogle = async () => {
  try {
    // Store that we're attempting Google login
    sessionStorage.setItem('auth-attempt', 'google');
    // Initiate redirect to Google (no return value - user will be redirected)
    await signInWithRedirect(auth, provider);
    // User will be redirected away from your app
    // When they return, initAuth() will handle the result via getRedirectResult()
  } catch (error) {
    console.error('Google login error:', error);
    sessionStorage.removeItem('auth-attempt');
    throw error;
  }
};

// Email login remains unchanged
export const loginWithEmail = async (email: string, password: string) => {
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    const user = await mapFirebaseUserToAppUser(result.user);
    if (user) {
      useAuthStore.getState().setUser(user);
      console.log('Email login successful:', user);
    }
    return result;
  } catch (error) {
    console.error('Email login error:', error);
    throw error;
  }
};

// Updated auth state listener to handle redirect results
export const initAuth = () => {
  const { setUser, clearUser } = useAuthStore.getState();
  
  // Check for redirect result when app initializes
  // This handles users returning from Google sign-in
  getRedirectResult(auth)
    .then(async (result) => {
      if (result) {
        // User just came back from Google sign-in
        console.log('Redirect result found:', result.user.email);
        const user = await mapFirebaseUserToAppUser(result.user);
        if (user) {
          console.log('User authenticated after redirect:', user);
          localStorage.setItem('isAuth', 'true');
          setUser(user);
          
          // Clear the auth attempt flag
          sessionStorage.removeItem('auth-attempt');
          
          // Navigate based on role after redirect completes
          const role = user.role;
          if (role === "student" || role === "teacher") {
            window.location.href = `/${role}/home`;
          } else {
            window.location.href = '/select-role';
          }
        } else {
          console.error('Failed to map user after redirect');
          clearUser();
        }
      }
    })
    .catch((error) => {
      console.error('Error handling redirect result:', error);
      sessionStorage.removeItem('auth-attempt');
      // Show error to user if needed
    });

  // Listen for auth state changes (for persistence and logout)
  return onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
    if (firebaseUser) {
      // Skip if we just handled a redirect result
      const isRedirectAttempt = sessionStorage.getItem('auth-attempt') === 'google';
      if (isRedirectAttempt) {
        return; // Let getRedirectResult handle it
      }
      
      try {
        const user = await mapFirebaseUserToAppUser(firebaseUser);
        if (user) {
          console.log('User authenticated and stored:', user);
          localStorage.setItem('isAuth', 'true');
          setUser(user);
        } else {
          console.error('Failed to map Firebase user to app user');
          clearUser();
        }
      } catch (error) {
        console.error('Error during auth state change:', error);
        clearUser();
      }
    } else {
      console.log('User signed out');
      clearUser();
    }
  });
};

// Enhanced logout function
export function logout() {
  try {
    // Clear localStorage
    localStorage.removeItem('isAuth');
    localStorage.removeItem('firebase-auth-token');

    // Sign out from Firebase
    firebaseSignOut(auth).catch(err => console.error('Firebase logout error:', err));

    // Clear user from store
    useAuthStore.getState().clearUser();

    // Reset query client
    queryClient.clear();

    console.log('User logged out successfully');
  } catch (error) {
    console.error('Logout error:', error);
  }
}

// Check if user is authenticated
export function checkAuth() {
  const token = localStorage.getItem('firebase-auth-token');
  const firebaseUser = auth.currentUser;
  const isAuth = localStorage.getItem('isAuth') === 'true';
  return !!token && !!firebaseUser && isAuth;
}

// Get current user profile
export async function getCurrentUserProfile() {
  const user = useAuthStore.getState().user;
  if (!user || !user.uid) return null;

  try {
    const token = await auth.currentUser?.getIdToken(true);
    if (!token) return null;

    const res = await fetch(`${API_URL}/users/firebase/${user.uid}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
    });

    if (res.ok) {
      const backendUser = await res.json();
      return backendUser;
    } else {
      console.error('Failed to fetch user profile');
      return null;
    }
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return null;
  }
}

// Update user profile
export async function updateUserProfile(profileData: {
  firstName?: string;
  lastName?: string;
  avatar?: string;
  role?: string;
}) {
  const user = useAuthStore.getState().user;
  if (!user) throw new Error('No authenticated user');

  try {
    const token = await auth.currentUser?.getIdToken(true);
    if (!token) throw new Error('No authentication token');

    const res = await fetch(`${API_URL}/users/firebase/${user.uid}/profile`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ...profileData,
        updatedAt: new Date().toISOString()
      }),
    });

    if (res.ok) {
      const updatedUser = await res.json();
      // Update the store with new user data
      const mappedUser = await mapFirebaseUserToAppUser(auth.currentUser);
      if (mappedUser) {
        useAuthStore.getState().setUser(mappedUser);
      }
      return updatedUser;
    } else {
      const errorText = await res.text();
      throw new Error(`Failed to update profile: ${errorText}`);
    }
  } catch (error) {
    console.error('Error updating user profile:', error);
    throw error;
  }
}

// API-specific functions
export { useLogin, useUserByFirebaseUID } from './hooks';