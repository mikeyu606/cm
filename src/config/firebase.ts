import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  initializeAuth,
  inMemoryPersistence,
  signInWithEmailAndPassword,
  getAuth,
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Your Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCneEwdFt3XiO4rmWKiTlnijwPZR9c0X_c",
  authDomain: "caloriemonster-c8371.firebaseapp.com",
  projectId: "caloriemonster-c8371",
  storageBucket: "caloriemonster-c8371.firebasestorage.app",
  messagingSenderId: "679911553103",
  appId: "1:679911553103:web:a2631e7bbf05f08c73123a",
  measurementId: "G-JNR6G0YS8N"
};

// Initialize Firebase only once
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Auth with in-memory persistence
// We'll handle persistence manually in AuthContext
let auth;
try {
  auth = getAuth(app);
} catch {
  auth = initializeAuth(app, {
    persistence: inMemoryPersistence
  });
}

// Initialize other services
const db = getFirestore(app);
const storage = getStorage(app);

export { auth, db, storage };
export default app;
