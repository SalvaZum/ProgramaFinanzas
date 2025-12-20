import { auth, provider } from "./firebase.js";
import { signInWithPopup, onAuthStateChanged }from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const loginBtn = document.getElementById("loginBtn");

loginBtn.onclick = async () => {
  await signInWithPopup(auth, provider);
};

// SI YA ESTÁ LOGUEADO → REDIRIGE
onAuthStateChanged(auth, user => {
  if (user) {
    window.location.href = "app.html";
  }
});
