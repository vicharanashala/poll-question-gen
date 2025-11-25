import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithRedirect,
  getRedirectResult,
  signInWithEmailAndPassword,
  signOut,
  createUserWithEmailAndPassword,
  updateProfile,
  User
} from "firebase/auth";
import { IUser, useAuthStore } from "./store/auth-store";
import { mapFirebaseUserToAppUser } from "./api/auth";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8080/api";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();

// Function to update user role in MongoDB via your backend API
export const updateUserRole = async (firebaseUID: string, role: string) => {
  try {
    const user = auth.currentUser;
    if (!user) {
      throw new Error("No authenticated user found");
    }
    const token = await user.getIdToken();
    const response = await fetch(`${API_URL}/users/firebase/${firebaseUID}/role`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ role })
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to update user role: ${errorText}`);
    }
    const updatedUser = await response.json();
    console.log("User role updated successfully:", updatedUser);
    return { success: true, user: updatedUser };
  } catch (error) {
    console.error("Error updating user role:", error);
    throw error;
  }
};

// -------------------- AUTH FUNCTIONS -------------------- //

export const loginWithGoogle = async () => {
  // Redirect to Google sign-in
  await signInWithRedirect(auth, provider);
  // User will be redirected away, then back to your app
  // The result will be handled by handleRedirectResult()
};

// Call this function when your app loads to handle the redirect result
export const handleRedirectResult = async () => {
  try {
    const result = await getRedirectResult(auth);
    if (result) {
      const firebaseUser = result.user;
      const idToken = await firebaseUser.getIdToken();

      const backendUser = await createBackendUser(firebaseUser);

      const setAuthState = useAuthStore.getState();
      setAuthState.setToken(idToken);
      setAuthState.setUserRole?.(backendUser?.role);

      return { result, role: backendUser?.role };
    }
    return null;
  } catch (error) {
    console.error("Error handling redirect result:", error);
    throw error;
  }
};

export const loginWithEmail = async (
  email: string,
  password: string,
) => {
  const result = await signInWithEmailAndPassword(auth, email, password);
  const idToken = await result.user.getIdToken();
  const firebaseUser = result.user;

  const backendUser = await mapFirebaseUserToAppUser(firebaseUser);

  // Store token and role in Zustand
  const setAuthState = useAuthStore.getState();
  setAuthState.setToken(idToken);
  setAuthState.setUserRole?.(backendUser?.role);

  return { result, role: backendUser?.role };
};

export const createUserWithEmail = async (
  email: string,
  password: string,
  displayName?: string,
) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const firebaseUser = userCredential.user;

    if (displayName && firebaseUser) {
      await updateProfile(firebaseUser, { displayName });
    }
    const token = await firebaseUser.getIdToken(true);

    const backendUser = await createBackendUser(firebaseUser);

    const setAuthState = useAuthStore.getState();
    setAuthState.setToken(token);
    setAuthState.setUser({
      uid: firebaseUser.uid,
      email: firebaseUser.email,
      name: `${backendUser.firstName} ${backendUser.lastName}`,
      role: backendUser.role || null,
      avatar: backendUser.avatar || null,
      ...backendUser,
    });

    console.log("User created successfully in Firebase + Backend:", backendUser);

    return { result: userCredential, role: backendUser.role };
  } catch (error) {
    console.error("createUserWithEmail failed:", error);
    throw error;
  }
};

export const logout = () => {
  signOut(auth);
  useAuthStore.getState().clearUser?.();
};

export const createBackendUser = async (firebaseUser: User) => {
  const token = await firebaseUser.getIdToken(true);
  try {
    const newUser = {
      firebaseUID: firebaseUser.uid,
      firstName: firebaseUser.displayName?.split(' ')[0] || '',
      lastName: firebaseUser.displayName?.split(' ').slice(1).join(' ') || '',
      email: firebaseUser.email || '',
      avatar: firebaseUser.photoURL || null,
      role: "",

      phoneNumber: null,
      bio: null,
      institution: null,
      designation: null,
      address: null,
      emergencyContact: null,
      dateOfBirth: null,

      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const createRes = await fetch(`${API_URL}/users/firebase/${firebaseUser.uid}/profile`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(newUser),
    });

    if (!createRes.ok) {
      const errorText = await createRes.text();
      throw new Error(`Failed to create backend user: ${errorText}`);
    }

    const backendUser = await createRes.json();
    return backendUser;
  } catch (error) {
    console.error("Error creating backend user:", error);
    throw error;
  }
};

export const analytics = getAnalytics(app);