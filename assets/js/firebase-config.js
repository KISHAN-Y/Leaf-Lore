import { initializeApp } from "https://www.gstatic.com/firebasejs/10.1.0/firebase-app.js";
import { 
    getFirestore,
    collection,
    getDocs,
    addDoc,
    doc,
    updateDoc,
    deleteDoc,
    setDoc
} from "https://www.gstatic.com/firebasejs/10.1.0/firebase-firestore.js";

// Your web app's Firebase configuration
// REPLACE WITH YOUR FIREBASE CONFIG
const firebaseConfig = {
    apiKey: "AIzaSyASVgYJYiP7B0E1P29prTSbsTiSJvLmPXU",
    authDomain: "leaf-and-lore.firebaseapp.com",
    projectId: "leaf-and-lore",
    storageBucket: "leaf-and-lore.firebasestorage.app",
    messagingSenderId: "506279406729",
    appId: "1:506279406729:web:c7373ad5bf18caf53cea58"
  };

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { 
    db, 
    collection, 
    getDocs, 
    addDoc, 
    doc, 
    updateDoc, 
    deleteDoc,
    setDoc 
};
