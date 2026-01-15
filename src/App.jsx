import { useState, useEffect } from 'react';
import { auth, googleProvider } from './firebase';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import HomePage from './HomePage';
import HabitDetailPage from './HabitDetailPage';
import './App.css';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // ===== 認証状態の監視 =====
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // ===== Googleでログイン =====
  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error('ログインエラー:', error);
      alert('ログインに失敗しました');
    }
  };

  // ===== ログアウト =====
  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('ログアウトエラー:', error);
    }
  };

  // ===== ローディング中 =====
  if (loading) {
    return <div className="app">読み込み中...</div>;
  }

  // ===== ログインしていない場合 =====
  if (!user) {
    return (
      <div className="app">
        <h1>習慣トラッカー</h1>
        <p>毎日の習慣を記録して、自分を変えよう</p>
        <button onClick={handleLogin} className="login-button">
          Googleでログイン
        </button>
      </div>
    );
  }

  // ===== ログイン済みの場合（ルーティング） =====
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={<HomePage user={user} handleLogout={handleLogout} />}
        />
        <Route
          path="/habits/:id"
          element={<HabitDetailPage user={user} />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
