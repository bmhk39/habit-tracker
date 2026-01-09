import { useState, useEffect } from 'react';
import { auth, googleProvider, db } from './firebase';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  serverTimestamp
} from 'firebase/firestore';
import './App.css';

function App() {
  // ===== 状態管理 =====
  // user: ログイン中のユーザー情報（nullならログアウト状態）
  const [user, setUser] = useState(null);
  // habits: 習慣の一覧
  const [habits, setHabits] = useState([]);
  // newHabitName: 新しい習慣の入力値
  const [newHabitName, setNewHabitName] = useState('');
  // editingId: 編集中の習慣ID（nullなら編集モードではない）
  const [editingId, setEditingId] = useState(null);
  // editingName: 編集中の習慣名
  const [editingName, setEditingName] = useState('');
  // loading: データ読み込み中かどうか
  const [loading, setLoading] = useState(true);

  // ===== 認証状態の監視 =====
  // ページを開いた時、ログイン状態を確認する
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    // クリーンアップ（コンポーネントが消える時に監視を解除）
    return () => unsubscribe();
  }, []);

  // ===== ユーザーが変わったら習慣を読み込む =====
  useEffect(() => {
    if (user) {
      loadHabits();
    } else {
      setHabits([]);
    }
  }, [user]);

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

  // ===== 習慣を読み込む =====
  const loadHabits = async () => {
    try {
      const habitsRef = collection(db, 'users', user.uid, 'habits');
      const q = query(habitsRef, orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const habitsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setHabits(habitsData);
    } catch (error) {
      console.error('習慣の読み込みエラー:', error);
    }
  };

  // ===== 習慣を追加する =====
  const handleAddHabit = async (e) => {
    e.preventDefault();
    if (!newHabitName.trim()) return;

    try {
      const habitsRef = collection(db, 'users', user.uid, 'habits');
      await addDoc(habitsRef, {
        name: newHabitName.trim(),
        createdAt: serverTimestamp()
      });
      setNewHabitName('');
      loadHabits(); // 一覧を再読み込み
    } catch (error) {
      console.error('習慣の追加エラー:', error);
      alert('習慣の追加に失敗しました');
    }
  };

  // ===== 習慣を編集する =====
  const handleUpdateHabit = async (habitId) => {
    if (!editingName.trim()) return;

    try {
      const habitRef = doc(db, 'users', user.uid, 'habits', habitId);
      await updateDoc(habitRef, {
        name: editingName.trim()
      });
      setEditingId(null);
      setEditingName('');
      loadHabits();
    } catch (error) {
      console.error('習慣の更新エラー:', error);
      alert('習慣の更新に失敗しました');
    }
  };

  // ===== 習慣を削除する =====
  const handleDeleteHabit = async (habitId) => {
    if (!confirm('この習慣を削除しますか？')) return;

    try {
      const habitRef = doc(db, 'users', user.uid, 'habits', habitId);
      await deleteDoc(habitRef);
      loadHabits();
    } catch (error) {
      console.error('習慣の削除エラー:', error);
      alert('習慣の削除に失敗しました');
    }
  };

  // ===== 今日の日付を取得 =====
  const getTodayString = () => {
    const today = new Date();
    return today.toISOString().split('T')[0]; // "2026-01-10" 形式
  };

  // ===== 今日の記録を切り替える =====
  const handleToggleToday = async (habit) => {
    const todayStr = getTodayString();
    const currentLogs = habit.logs || {};
    const newDone = !currentLogs[todayStr]?.done;

    try {
      const habitRef = doc(db, 'users', user.uid, 'habits', habit.id);
      await updateDoc(habitRef, {
        [`logs.${todayStr}`]: { done: newDone }
      });
      loadHabits();
    } catch (error) {
      console.error('記録の更新エラー:', error);
      alert('記録の更新に失敗しました');
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

  // ===== ログイン済みの場合 =====
  const todayStr = getTodayString();

  return (
    <div className="app">
      <header>
        <h1>習慣トラッカー</h1>
        <div className="user-info">
          <span>{user.displayName}</span>
          <button onClick={handleLogout} className="logout-button">
            ログアウト
          </button>
        </div>
      </header>

      {/* 習慣追加フォーム */}
      <form onSubmit={handleAddHabit} className="add-form">
        <input
          type="text"
          value={newHabitName}
          onChange={(e) => setNewHabitName(e.target.value)}
          placeholder="新しい習慣を入力..."
        />
        <button type="submit">追加</button>
      </form>

      {/* 習慣一覧 */}
      <div className="habits-list">
        {habits.length === 0 ? (
          <p className="empty-message">習慣がまだありません。上のフォームから追加してください。</p>
        ) : (
          habits.map((habit) => (
            <div key={habit.id} className="habit-item">
              {editingId === habit.id ? (
                // 編集モード
                <div className="edit-mode">
                  <input
                    type="text"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                  />
                  <button onClick={() => handleUpdateHabit(habit.id)}>保存</button>
                  <button onClick={() => setEditingId(null)}>キャンセル</button>
                </div>
              ) : (
                // 通常モード
                <>
                  <div className="habit-main">
                    <button
                      className={`toggle-button ${habit.logs?.[todayStr]?.done ? 'done' : ''}`}
                      onClick={() => handleToggleToday(habit)}
                    >
                      {habit.logs?.[todayStr]?.done ? '✓' : '○'}
                    </button>
                    <span className="habit-name">{habit.name}</span>
                  </div>
                  <div className="habit-actions">
                    <button
                      onClick={() => {
                        setEditingId(habit.id);
                        setEditingName(habit.name);
                      }}
                    >
                      編集
                    </button>
                    <button onClick={() => handleDeleteHabit(habit.id)}>削除</button>
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </div>

      {/* 過去の記録 */}
      {habits.length > 0 && (
        <div className="logs-section">
          <h2>過去7日間の記録</h2>
          <div className="logs-grid">
            {habits.map((habit) => (
              <div key={habit.id} className="log-row">
                <span className="log-habit-name">{habit.name}</span>
                <div className="log-days">
                  {[...Array(7)].map((_, i) => {
                    const date = new Date();
                    date.setDate(date.getDate() - (6 - i));
                    const dateStr = date.toISOString().split('T')[0];
                    const done = habit.logs?.[dateStr]?.done;
                    return (
                      <span
                        key={dateStr}
                        className={`log-day ${done ? 'done' : ''}`}
                        title={dateStr}
                      >
                        {done ? '✓' : '·'}
                      </span>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
