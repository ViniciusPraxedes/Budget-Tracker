// Import initializeApp, getApps, and getApp functions from Firebase app module
import { initializeApp, getApps, getApp } from "firebase/app";
// Import Firestore database utilities from Firebase firestore module
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
// Import Authentication utilities from Firebase auth module
import { getAuth, GoogleAuthProvider, connectAuthEmulator } from "firebase/auth";

// Define Firebase configuration object using environment variables with build fallbacks
const firebaseConfig = {
    // Read Firebase API key from environment variables or fallback for static build evaluation
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyDummyApiKeyForStaticBuild12345",
    // Read Firebase Auth domain from environment variables or fallback for static build evaluation
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "demo-project.firebaseapp.com",
    // Read Firebase Project ID from environment variables or fallback for static build evaluation
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "demo-project",
    // Read Firebase Storage bucket from environment variables or fallback for static build evaluation
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "demo-project.appspot.com",
    // Read Firebase Messaging Sender ID from environment variables or fallback for static build evaluation
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "123456789012",
    // Read Firebase App ID from environment variables or fallback for static build evaluation
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:123456789012:web:1234567890123456789012",
    // Read Firebase Measurement ID from environment variables or fallback for static build evaluation
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-1234567890"
};

// Initialize Firebase app instance safely checking existing app instances
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
// Export Firestore database instance
export const db = getFirestore(app);
// Export Firebase Auth instance
export const auth = getAuth(app);
// Export Google Auth provider instance
export const googleProvider = new GoogleAuthProvider();

// Check if emulator flag is set to true in environment variables
const useEmulator = process.env.NEXT_PUBLIC_USE_EMULATOR === 'true';
// Evaluate condition to check if local emulators should be used
if (useEmulator) {
    // Connect Firestore to local emulator instance
    connectFirestoreEmulator(db, 'localhost', 8080);
    // Connect Auth to local emulator instance
    connectAuthEmulator(auth, 'http://localhost:9099');
}


