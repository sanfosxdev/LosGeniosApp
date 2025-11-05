// Fix: Changed 'firebase/app' to '@firebase/app' to resolve module export errors that can occur with certain bundler configurations.
import { initializeApp, getApp, getApps } from '@firebase/app';
// Fix: Changed 'firebase/firestore' to '@firebase/firestore' for consistency.
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
} from '@firebase/firestore';

// Your web app's Firebase configuration should be in environment variables
// (e.g., a .env file if you are using a bundler like Vite)
// Example: VITE_FIREBASE_API_KEY="AIza..."
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  
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
