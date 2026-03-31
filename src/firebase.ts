import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, updateDoc, collection, query, where, onSnapshot, addDoc, serverTimestamp, orderBy, limit } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

export const googleProvider = new GoogleAuthProvider();

export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    
    // Create or update user profile
    const userRef = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) {
      await setDoc(userRef, {
        uid: user.uid,
        displayName: user.displayName,
        email: user.email,
        photoURL: user.photoURL,
        isOnline: true,
        lastSeen: serverTimestamp(),
        themeColor: '#10b981', // Default emerald
        backgroundUrl: ''
      });
    } else {
      await updateDoc(userRef, {
        isOnline: true,
        lastSeen: serverTimestamp(),
        photoURL: user.photoURL // Update photo in case it changed
      });
    }
    return user;
  } catch (error) {
    console.error("Error signing in with Google", error);
    throw error;
  }
};

export const logOut = async () => {
  if (auth.currentUser) {
    const userRef = doc(db, 'users', auth.currentUser.uid);
    await updateDoc(userRef, {
      isOnline: false,
      lastSeen: serverTimestamp()
    });
  }
  return signOut(auth);
};
