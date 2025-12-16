import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// TODO: استبدل هذه القيم بقيم Firebase الخاصة بك
const firebaseConfig = {
  apiKey: 'AIzaSyD1x1E3dfHvqYtlBcZEl8GC5g6rRQwuAV8',
  authDomain: 'njik.sa',
  projectId: 'njik-app',
  storageBucket: 'njik-app.appspot.com',
  messagingSenderId: '731458785436',
  appId: '1:731458785436:web:8e015a514202067b7e9d59',
  measurementId: 'G-R1FXBEC64G',
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Auth
const auth = getAuth(app);

// Initialize Firestore
const db = getFirestore(app);

// Initialize Storage
const storage = getStorage(app);

export { auth, db, storage };
export default app;

