import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, collection, query, where, orderBy, limit } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAl52zPCkdcKr6I2KfWvVP5gr8yKrjv_3Y",
  authDomain: "lytecal-b49db.firebaseapp.com",
  projectId: "lytecal-b49db",
  storageBucket: "lytecal-b49db.firebasestorage.app",
  messagingSenderId: "295956274711",
  appId: "1:295956274711:web:c2b160a12d8b1b023c4652"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Note: For proper persistence in React Native apps, 
// you should configure AsyncStorage, but we'll use the default
// memory persistence for simplicity in this demo.

// Create references to commonly used collections
const messagesRef = collection(db, 'messages');

// Helper function to get a user's message history
const getUserMessages = (userId: string, messageLimit = 20) => {
  return query(
    messagesRef,
    where("userId", "==", userId),
    orderBy("timestamp", "desc"),
    limit(messageLimit)
  );
};

export { auth, db, messagesRef, getUserMessages }; 