import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';

export interface FirebaseConfigType {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

// Config mặc định dựa trên thông tin Firebase Project: smart-vas (smart-vas-f312e / 525164210378)
export const defaultFirebaseConfig: FirebaseConfigType = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || "AIzaSy_SMART_VAS_PLACEHOLDER_KEY",
  authDomain: "smart-vas-f312e.firebaseapp.com",
  projectId: "smart-vas-f312e",
  storageBucket: "smart-vas-f312e.firebasestorage.app",
  messagingSenderId: "525164210378",
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || "1:525164210378:web:smartvaswebclient",
};

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let initError: string | null = null;

try {
  if (getApps().length === 0) {
    app = initializeApp(defaultFirebaseConfig);
  } else {
    app = getApp();
  }
  db = getFirestore(app);
} catch (error: any) {
  console.warn("Lỗi khởi tạo Firebase ban đầu (sẽ dùng offline fallback):", error?.message);
  initError = error?.message || "Unknown init error";
}

export { app, db, initError };

export function reinitializeFirebase(customConfig: Partial<FirebaseConfigType>) {
  try {
    const updatedConfig = { ...defaultFirebaseConfig, ...customConfig };
    if (getApps().length > 0) {
      // Re-use or initialize with updated config
      app = getApp();
    } else {
      app = initializeApp(updatedConfig);
    }
    db = getFirestore(app);
    initError = null;
    return { success: true, db };
  } catch (err: any) {
    initError = err?.message;
    return { success: false, error: err?.message };
  }
}
