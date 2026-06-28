import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { auth as firebaseAuth } from "./firebase";

export const auth = firebaseAuth;

export const getCurrentUser = () => auth.currentUser;

// Signup
export const signup = async (email, password) => {
  return await createUserWithEmailAndPassword(auth, email, password);
};

// Login
export const login = async (email, password) => {
  return await signInWithEmailAndPassword(auth, email, password);
};