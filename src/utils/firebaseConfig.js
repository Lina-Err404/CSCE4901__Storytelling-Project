// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBHE5ckBWKUCOFn97F28Tsb5XK2yrHzPLU",
  authDomain: "collab-storytelling-379cb.firebaseapp.com",
  projectId: "collab-storytelling-379cb",
  storageBucket: "collab-storytelling-379cb.firebasestorage.app",
  messagingSenderId: "443950151613",
  appId: "1:443950151613:web:b02c8c6ad4693a27ae04d4",
  measurementId: "G-L94RKGMXTL"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

export default app;