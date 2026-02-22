// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAtEMMEEfzdQJWFDdc85arGoqoZVoyphZ0",
  authDomain: "animal-city-monster-hunters.firebaseapp.com",
  projectId: "animal-city-monster-hunters",
  storageBucket: "animal-city-monster-hunters.firebasestorage.app",
  messagingSenderId: "914508915157",
  appId: "1:914508915157:web:a88d81cdde9bc54ab05d5c",
  measurementId: "G-FZ4FFV80CC"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
