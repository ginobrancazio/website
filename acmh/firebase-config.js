// Firebase Configuration (Compat Mode for v9)
const firebaseConfig = {
  apiKey: "AIzaSyAtEMMEEfzdQJWFDdc85arGoqoZVoyphZ0",
  authDomain: "animal-city-monster-hunters.firebaseapp.com",
  projectId: "animal-city-monster-hunters",
  storageBucket: "animal-city-monster-hunters.firebasestorage.app",
  messagingSenderId: "914508915157",
  appId: "1:914508915157:web:a88d81cdde9bc54ab05d5c",
  measurementId: "G-FZ4FFV80CC",
};

// Initialize Firebase (using compat mode)
firebase.initializeApp(firebaseConfig);

// Initialize services
const db = firebase.firestore();
const auth = firebase.auth();
const storage = firebase.storage();

// Optional: Initialize Analytics
// const analytics = firebase.analytics();

console.log("Firebase initialized successfully");
