// context/AuthContext.js
import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { auth } from '../services/firebaseConfig';
import { onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Create Auth Context
const AuthContext = createContext();

// Auth Reducer
const authReducer = (state, action) => {
  switch (action.type) {
    case 'SET_USER':
      return { ...state, user: action.payload, loading: false };
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SIGN_OUT':
      return { ...state, user: null, loading: false };
    default:
      return state;
  }
};

// Auth Provider Component
export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, {
    user: null,
    loading: true,
  });

  useEffect(() => {
    // Listen to Firebase auth state changes
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // User is signed in
        const userData = {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          photoURL: firebaseUser.photoURL,
        };
        
        // Save to AsyncStorage for persistence
        await AsyncStorage.setItem('user', JSON.stringify(userData));
        
        dispatch({ type: 'SET_USER', payload: userData });
      } else {
        // User is signed out
        await AsyncStorage.removeItem('user');
        dispatch({ type: 'SIGN_OUT' });
      }
    });

    // Cleanup subscription
    return () => unsubscribe();
  }, []);

  // Sign Out Function
  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
      await AsyncStorage.removeItem('user');
      dispatch({ type: 'SIGN_OUT' });
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  };

  const value = {
    state,
    signOut,
    dispatch,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Custom hook to use Auth Context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};