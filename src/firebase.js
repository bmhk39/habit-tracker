// Firebase の設定と初期化
// このファイルは Firebase との接続を管理します

import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Firebase プロジェクトの設定情報
// Firebase Console から取得したもの
const firebaseConfig = {
    apiKey: "AIzaSyBA6fWHxXmEQ-SGhtq35y-o3dTCrRRHRgQ",
    authDomain: "habit-tracker-2560c.firebaseapp.com",
    projectId: "habit-tracker-2560c",
    storageBucket: "habit-tracker-2560c.firebasestorage.app",
    messagingSenderId: "846820679848",
    appId: "1:846820679848:web:c25f6ec345cfed0f5a629d"
};

// Firebase アプリを初期化
const app = initializeApp(firebaseConfig);

// 認証機能を取得（Googleログインに使う）
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// データベースを取得（習慣データの保存に使う）
export const db = getFirestore(app);
