// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { initializeAuth, getReactNativePersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDPzihnBV-UXXh9ep59FRw7d_5k0v5fPMI",
  authDomain: "mediwear-b72a1.firebaseapp.com",
  projectId: "mediwear-b72a1",
  storageBucket: "mediwear-b72a1.firebasestorage.app",
  messagingSenderId: "621173284064",
  appId: "1:621173284064:web:1de54a7c211d23ab6c8485"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsyncStorage)
});

const db = getFirestore(app);
console.log('Firebase initialized successfully with persistence');

export { auth, db };