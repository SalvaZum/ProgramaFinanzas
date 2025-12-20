import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBKUqO_XmedCCHqFxtJDVNF9Z0CkaAnVrs",
  authDomain: "gestorfinanzas-4c55a.firebaseapp.com",
  projectId: "gestorfinanzas-4c55a",
  storageBucket: "gestorfinanzas-4c55a.firebasestorage.app",
  messagingSenderId: "765379251588",
  appId: "1:765379251588:web:8928ceab2635a10bab61d1",
  measurementId: "G-B7YPD8K552"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();
export const db = getFirestore(app);