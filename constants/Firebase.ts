import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

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

// Note: For proper persistence in React Native apps, 
// you should configure AsyncStorage, but we'll use the default
// memory persistence for simplicity in this demo.

export { auth }; 