import { useState, useEffect, useRef } from 'react';
import { auth, googleProvider, db } from './firebase';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  getDoc,
  setDoc,
  query,
  orderBy,
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  DragOverlay,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { SortableHabitItem } from './SortableHabitItem';
import './App.css';

function App() {
  // ===== 状態管理 =====
  const [user, setUser] = useState(null);
  const [habits, setHabits] = useState([]);
  const [newHabitName, setNewHabitName] = useState('');
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [dayStartHour, setDayStartHour] = useState(4);

  // 習慣管理画面
  const [showHabitManager, setShowHabitManager] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');

  // スナックバー用の状態
  // スナックバー用の状態
  const [snackbar, setSnackbar] = useState(null);
  const snackbarTimeoutRef = useRef(null);

  // ドラッグ中のアイテム
  const [activeId, setActiveId] = useState(null);

  // ===== Dnd Sensors =====
  const sensors = useSensors(
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250, // 250ms長押しでドラッグ開始
        tolerance: 5, // 5pxまでの移動は許容
      },
    }),
    useSensor(MouseSensor, { // PCなどでマウス操作する場合
      activationConstraint: {
        distance: 10, // 10px動くまでドラッグ開始しない
      }
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // ===== 認証状態の監視 =====
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // ===== ユーザーが変わったら習慣と設定を読み込む =====
  useEffect(() => {
    if (user) {
      loadHabits();
      loadSettings();
    } else {
      setHabits([]);
      setDayStartHour(4);
    }
  }, [user]);

  // ===== スナックバーのクリーンアップ =====
  useEffect(() => {
    return () => {
      if (snackbarTimeoutRef.current) {
        clearTimeout(snackbarTimeoutRef.current);
      }
    };
  }, []);

  // ===== スナックバーを表示 =====
  const showSnackbar = (message, habitId, habitName) => {
    if (snackbarTimeoutRef.current) {
      clearTimeout(snackbarTimeoutRef.current);
    }

    setSnackbar({ message, habitId, habitName });

    snackbarTimeoutRef.current = setTimeout(() => {
      setSnackbar(null);
    }, 5000);
  };

  // ===== スナックバーを閉じる =====
  const hideSnackbar = () => {
    if (snackbarTimeoutRef.current) {
      clearTimeout(snackbarTimeoutRef.current);
    }
    setSnackbar(null);
  };

  // ===== 設定を読み込む =====
  const loadSettings = async () => {
    try {
      const settingsRef = doc(db, 'users', user.uid, 'settings', 'general');
      const settingsDoc = await getDoc(settingsRef);
      if (settingsDoc.exists()) {
        const data = settingsDoc.data();
        if (data.dayStartHour !== undefined) {
          setDayStartHour(data.dayStartHour);
        }
      }
    } catch (error) {
      console.error('設定の読み込みエラー:', error);
    }
  };

  // ===== 設定を保存する =====
  const saveSettings = async (newDayStartHour) => {
    const confirmed = confirm(
      '日付切り替え時刻を変更すると、「今日」として表示される記録が変わる可能性があります。\n\n本当に変更しますか？'
    );
    if (!confirmed) return;

    try {
      const settingsRef = doc(db, 'users', user.uid, 'settings', 'general');
      await setDoc(settingsRef, {
        dayStartHour: newDayStartHour
      }, { merge: true });
      setDayStartHour(newDayStartHour);
    } catch (error) {
      console.error('設定の保存エラー:', error);
      alert('設定の保存に失敗しました');
    }
  };

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
      setShowSettings(false);
    } catch (error) {
      console.error('ログアウトエラー:', error);
    }
  };

  // ===== 習慣を読み込む =====
  const loadHabits = async () => {
    try {
      const habitsRef = collection(db, 'users', user.uid, 'habits');
      // orderでソートするため、一括取得後にメモリ上でソートする方式を採用
      // (データ量が少ないためこれで十分かつ、既存データにorderがない場合も安全)
      const q = query(habitsRef);
      const snapshot = await getDocs(q);

      const habitsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // メモリ上でソート
      habitsData.sort((a, b) => {
        // orderがある場合はそれを優先
        if (a.order !== undefined && b.order !== undefined) {
          return a.order - b.order;
        }
        // orderがない場合は作成日順（新しい順）
        const timeA = a.createdAt?.seconds || 0;
        const timeB = b.createdAt?.seconds || 0;
        return timeB - timeA;
      });

      setHabits(habitsData);
    } catch (error) {
      console.error('習慣の読み込みエラー:', error);
    }
  };

  // ===== 習慣を追加する =====
  const handleAddHabit = async (e) => {
    e.preventDefault();
    if (!newHabitName.trim()) return;

    // 現在の最大orderを取得して、その次に追加する
    const nextOrder = habits.length > 0
      ? Math.max(...habits.map(h => (h.order !== undefined ? h.order : -1))) + 1
      : 0;

    try {
      const habitsRef = collection(db, 'users', user.uid, 'habits');
      await addDoc(habitsRef, {
        name: newHabitName.trim(),
        createdAt: serverTimestamp(),
        order: nextOrder
      });
      setNewHabitName('');
      loadHabits();
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
  const handleDeleteHabit = async (habitId, habitName) => {
    if (!confirm(`「${habitName}」を削除しますか？\n※過去の記録もすべて削除されます`)) return;

    try {
      const habitRef = doc(db, 'users', user.uid, 'habits', habitId);
      await deleteDoc(habitRef);
      loadHabits();
    } catch (error) {
      console.error('習慣の削除エラー:', error);
      alert('習慣の削除に失敗しました');
    }
  };

  // ===== ドラッグ開始 =====
  const handleDragStart = (event) => {
    setActiveId(event.active.id);
  };

  // ===== ドラッグキャンセル =====
  const handleDragCancel = () => {
    setActiveId(null);
  };

  // ===== ドラッグ終了時の処理（並び替え保存） =====
  const handleDragEnd = async (event) => {
    const { active, over } = event;

    // ドラッグ終了時にIDをリセット
    setActiveId(null);

    // ドロップ先がない、または同じ場所なら終了
    if (!over || active.id === over.id) {
      return;
    }

    if (active.id !== over.id) {
      // 古いインデックスと新しいインデックスを取得
      const oldIndex = habits.findIndex((habit) => habit.id === active.id);
      const newIndex = habits.findIndex((habit) => habit.id === over.id);

      // 配列を並び替え
      const newHabits = arrayMove(habits, oldIndex, newIndex);

      // order値を更新（0から振り直す）
      const updatedHabits = newHabits.map((habit, index) => ({
        ...habit,
        order: index
      }));

      // 画面を即時更新
      setHabits(updatedHabits);

      // Firebaseに保存（バッチ更新）
      try {
        const batch = writeBatch(db);
        updatedHabits.forEach((habit) => {
          const habitRef = doc(db, 'users', user.uid, 'habits', habit.id);
          batch.update(habitRef, { order: habit.order });
        });
        await batch.commit();
      } catch (error) {
        console.error('並び替え保存エラー:', error);
        // エラー時は必要なら元の順序に戻す処理を入れる
      }
    }
  };

  // ===== 今日の日付を取得（dayStartHourを考慮）=====
  const getTodayString = () => {
    const now = new Date();
    if (now.getHours() < dayStartHour) {
      now.setDate(now.getDate() - 1);
    }
    return now.toISOString().split('T')[0];
  };

  // ===== 過去7日間の日付を取得（dayStartHourを考慮）=====
  const getPast7Days = () => {
    const days = [];
    const now = new Date();
    if (now.getHours() < dayStartHour) {
      now.setDate(now.getDate() - 1);
    }
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      days.push(date.toISOString().split('T')[0]);
    }
    return days;
  };

  // ===== 達成を記録する =====
  const markAsDone = async (habit) => {
    const todayStr = getTodayString();

    try {
      const habitRef = doc(db, 'users', user.uid, 'habits', habit.id);
      await updateDoc(habitRef, {
        [`logs.${todayStr}`]: {
          done: true,
          completedAt: new Date().toISOString()
        }
      });
      loadHabits();
      showSnackbar(`✓ ${habit.name} を達成しました！`, habit.id, habit.name);
    } catch (error) {
      console.error('記録の更新エラー:', error);
      alert('記録の更新に失敗しました');
    }
  };

  // ===== 達成を取り消す =====
  const undoComplete = async (habitId) => {
    const todayStr = getTodayString();

    try {
      const habitRef = doc(db, 'users', user.uid, 'habits', habitId);
      await updateDoc(habitRef, {
        [`logs.${todayStr}`]: {
          done: false,
          completedAt: null
        }
      });
      loadHabits();
      hideSnackbar();
    } catch (error) {
      console.error('記録の更新エラー:', error);
      alert('記録の更新に失敗しました');
    }
  };

  // ===== ボタンクリック時の処理 =====
  const handleToggleToday = async (habit) => {
    const todayStr = getTodayString();
    const currentLogs = habit.logs || {};
    const isDone = currentLogs[todayStr]?.done;

    if (isDone) {
      const confirmed = confirm(`「${habit.name}」の本日の記録を取り消しますか？`);
      if (confirmed) {
        await undoComplete(habit.id);
      }
    } else {
      await markAsDone(habit);
    }
  };

  // ===== スナックバーから取り消し =====
  const handleSnackbarUndo = () => {
    if (snackbar?.habitId) {
      undoComplete(snackbar.habitId);
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
  const past7Days = getPast7Days();

  return (
    <div className="app">
      {/* スナックバー */}
      {snackbar && (
        <div className="snackbar">
          <span className="snackbar-message">{snackbar.message}</span>
          <button className="snackbar-undo" onClick={handleSnackbarUndo}>
            取り消す
          </button>
        </div>
      )}

      <header>
        <h1>習慣トラッカー</h1>
        <button
          className="settings-button"
          onClick={() => setShowSettings(true)}
        >
          ⚙
        </button>
      </header>

      {/* 設定メニュー */}
      {showSettings && (
        <div className="settings-overlay" onClick={() => setShowSettings(false)}>
          <div className="settings-menu" onClick={(e) => e.stopPropagation()}>
            <div className="settings-header">
              <h2>設定</h2>
              <button onClick={() => setShowSettings(false)}>✕</button>
            </div>

            <div className="settings-content">
              {/* 習慣の管理 */}
              <div className="setting-item">
                <label>習慣の管理</label>
                <button
                  className="setting-link-button"
                  onClick={() => {
                    setShowSettings(false);
                    setShowHabitManager(true);
                  }}
                >
                  習慣を編集・削除する →
                </button>
              </div>

              {/* 日付切り替え時刻 */}
              <div className="setting-item">
                <label>1日の開始時刻</label>
                <p className="setting-description">
                  この時刻を過ぎると「翌日」として扱われます
                </p>
                <select
                  value={dayStartHour}
                  onChange={(e) => saveSettings(Number(e.target.value))}
                >
                  {[...Array(24)].map((_, hour) => (
                    <option key={hour} value={hour}>
                      {hour}:00
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="settings-footer">
              <div className="user-info-settings">
                <span>{user.displayName}</span>
                <span className="user-email">{user.email}</span>
              </div>
              <button onClick={handleLogout} className="logout-button">
                ログアウト
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 習慣管理画面 */}
      {showHabitManager && (
        <div className="settings-overlay" onClick={() => setShowHabitManager(false)}>
          <div className="settings-menu habit-manager" onClick={(e) => e.stopPropagation()}>
            <div className="settings-header">
              <h2>習慣の管理</h2>
              <button onClick={() => {
                setShowHabitManager(false);
                setEditingId(null);
                setEditingName('');
              }}>✕</button>
            </div>

            <div className="settings-content">
              {habits.length === 0 ? (
                <p className="empty-message">習慣がまだありません</p>
              ) : (
                <div className="habit-manager-list">
                  {habits.map((habit) => (
                    <div key={habit.id} className="habit-manager-item">
                      {editingId === habit.id ? (
                        // 編集モード
                        <div className="habit-manager-edit">
                          <input
                            type="text"
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            autoFocus
                          />
                          <div className="habit-manager-edit-actions">
                            <button onClick={() => handleUpdateHabit(habit.id)}>保存</button>
                            <button onClick={() => {
                              setEditingId(null);
                              setEditingName('');
                            }}>キャンセル</button>
                          </div>
                        </div>
                      ) : (
                        // 通常モード
                        <>
                          <span className="habit-manager-name">{habit.name}</span>
                          <div className="habit-manager-actions">
                            <button
                              onClick={() => {
                                setEditingId(habit.id);
                                setEditingName(habit.name);
                              }}
                            >
                              編集
                            </button>
                            <button
                              className="delete-button"
                              onClick={() => handleDeleteHabit(habit.id, habit.name)}
                            >
                              削除
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

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

      {/* 習慣一覧（並び替え可能） */}
      <div className="habits-list">
        {habits.length === 0 ? (
          <p className="empty-message">習慣がまだありません。上のフォームから追加してください。</p>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
            modifiers={[restrictToVerticalAxis]}
          >
            <SortableContext
              items={habits.map(h => h.id)}
              strategy={verticalListSortingStrategy}
            >
              {habits.map((habit) => (
                <SortableHabitItem
                  key={habit.id}
                  habit={habit}
                  todayStr={todayStr}
                  toggleHabit={handleToggleToday}
                />
              ))}
            </SortableContext>

            <DragOverlay>
              {activeId ? (
                <SortableHabitItem
                  habit={habits.find(h => h.id === activeId)}
                  todayStr={todayStr}
                  toggleHabit={() => { }}
                  isOverlay
                />
              ) : null}
            </DragOverlay>
          </DndContext>
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
                  {past7Days.map((dateStr) => {
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
