import { initializeApp } from "firebase/app";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getAuth, GoogleAuthProvider, connectAuthEmulator } from "firebase/auth";

const firebaseConfig = {
    apiKey: "AIzaSyAutfAhbu5vvGkMyI51gtHPy_wmdF_IEEE",
    authDomain: "skilled-bonus-478612-q2.firebaseapp.com",
    projectId: "skilled-bonus-478612-q2",
    storageBucket: "skilled-bonus-478612-q2.firebasestorage.app",
    messagingSenderId: "382650047660",
    appId: "1:382650047660:web:5b7aca4ab502ad90d95309",
    measurementId: "G-C2X7JPVMWR"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

if (process.env.NODE_ENV === 'development') {
    connectFirestoreEmulator(db, 'localhost', 8080);
    connectAuthEmulator(auth, 'http://localhost:9099');
}


