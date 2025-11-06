// FIX: Changed 'firebase/app' to '@firebase/app' to resolve module export errors.
import { initializeApp, getApp, getApps } from '@firebase/app';
import { 
    getFirestore, 
    collection, 
    getDocs, 
    doc, 
    setDoc, 
    addDoc, 
    deleteDoc, 
    writeBatch, 
    onSnapshot, 
    query, 
    where, 
    getDoc, 
    updateDoc,
    orderBy,
    limit,
    serverTimestamp,
    Timestamp,
} from 'firebase/firestore';

// Your web app's Firebase configuration should be in environment variables
// (e.g., a .env file if you are using a bundler like Vite)
// Example: VITE_FIREBASE_API_KEY="AIza..."
// FIX: Use process.env instead of import.meta.env to access environment variables.
// This resolves the TypeScript error `Property 'env' does not exist on type 'ImportMeta'`
// and aligns with the environment variable access pattern used in other parts of the application.
const firebaseConfig = {
 apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

// Initialize Firebase using v9 modular style, ensuring it's only done once.
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);

export { 
    db, 
    collection, 
    getDocs, 
    doc, 
    setDoc, 
    addDoc, 
    deleteDoc, 
    writeBatch, 
    onSnapshot, 
    query, 
    where, 
    getDoc, 
    updateDoc,
    orderBy,
    limit,
    serverTimestamp,
    Timestamp,
};