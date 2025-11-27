import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { 
  User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { UserProfile } from '../types';
import * as SecureStore from 'expo-secure-store';

const AUTH_CREDENTIALS_KEY = 'auth_credentials';

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, displayName?: string) => Promise<void>;
  logout: () => Promise<void>;
  updateDailyGoal: (goal: number) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Try to restore session on app start
  useEffect(() => {
    const restoreSession = async () => {
      try {
        const credentials = await SecureStore.getItemAsync(AUTH_CREDENTIALS_KEY);
        if (credentials) {
          const { email, password } = JSON.parse(credentials);
          await signInWithEmailAndPassword(auth, email, password);
        }
      } catch (error) {
        // Failed to restore session, user will need to login
        console.log('No saved session or failed to restore');
      }
      setLoading(false);
    };

    // Listen for auth state changes
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        try {
          const profileDoc = await getDoc(doc(db, 'users', user.uid));
          if (profileDoc.exists()) {
            setUserProfile(profileDoc.data() as UserProfile);
          }
        } catch (error) {
          console.error('Error fetching profile:', error);
        }
      } else {
        setUserProfile(null);
      }
    });

    restoreSession();

    return unsubscribe;
  }, []);

  const login = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
    // Save credentials for session restore
    await SecureStore.setItemAsync(
      AUTH_CREDENTIALS_KEY,
      JSON.stringify({ email, password })
    );
  };

  const signup = async (email: string, password: string, displayName?: string) => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const profile: UserProfile = {
      uid: userCredential.user.uid,
      email: email,
      displayName: displayName,
      dailyGoal: 2000,
      createdAt: new Date(),
    };
    await setDoc(doc(db, 'users', userCredential.user.uid), profile);
    setUserProfile(profile);
    // Save credentials for session restore
    await SecureStore.setItemAsync(
      AUTH_CREDENTIALS_KEY,
      JSON.stringify({ email, password })
    );
  };

  const logout = async () => {
    await signOut(auth);
    await SecureStore.deleteItemAsync(AUTH_CREDENTIALS_KEY);
    setUserProfile(null);
  };

  const updateDailyGoal = async (goal: number) => {
    if (!user) return;
    await setDoc(doc(db, 'users', user.uid), { dailyGoal: goal }, { merge: true });
    setUserProfile(prev => prev ? { ...prev, dailyGoal: goal } : null);
  };

  return (
    <AuthContext.Provider value={{ user, userProfile, loading, login, signup, logout, updateDailyGoal }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
