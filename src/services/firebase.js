import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// TODO: استبدل هذه القيم بقيم Firebase الخاصة بك
const firebaseConfig = {
  apiKey: "AIzaSyBLzVh55r-BaJ5cfUwm4q-c0XZKvOkyGOI",
  authDomain: "fazaproject-c5059.firebaseapp.com",
  databaseURL: "https://fazaproject-c5059-default-rtdb.firebaseio.com",
  projectId: "fazaproject-c5059",
  storageBucket: "fazaproject-c5059.firebasestorage.app",
  messagingSenderId: "939604805877",
  appId: "1:939604805877:web:63efb92f1a5f450c6a9dbc",
  measurementId: "G-229FL5SZVW",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Auth
const auth = getAuth(app);

// Initialize Firestore
const db = getFirestore(app);

// Initialize Storage
const storage = getStorage(app);

// Secondary App for creating users without logging out
const secondaryApp = initializeApp(firebaseConfig, "Secondary");
const secondaryAuth = getAuth(secondaryApp);

export { auth, db, storage, secondaryAuth };
export default app;

