import { useState, useEffect, useRef, useMemo } from 'react';
import { db } from './firebase';
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
  serverTimestamp,
  writeBatch,
  increment
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
import { MemoModal } from './MemoModal';
import { useNavigate } from 'react-router-dom';

export default function HomePage({ user, handleLogout }) {
  const navigate = useNavigate();

  // ===== 今日の日付を取得（dayStartHourを考慮）=====
  const getTodayString = (startHour = 4) => {
    const now = new Date();
    if (now.getHours() < startHour) {
      now.setDate(now.getDate() - 1);
    }
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // ===== 状態管理 =====
  const [habits, setHabits] = useState([]);
  const [newHabitName, setNewHabitName] = useState('');
  const [newHabitTimerEnabled, setNewHabitTimerEnabled] = useState(false);
  const [newHabitMemoEnabled, setNewHabitMemoEnabled] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [dayStartHour, setDayStartHour] = useState(4);
  const [todayStr, setTodayStr] = useState(() => getTodayString(4));

  // 習慣管理画面
  const [showHabitManager, setShowHabitManager] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');

  // スナックバー用の状態
  const [snackbar, setSnackbar] = useState(null);
  const snackbarTimeoutRef = useRef(null);

  // ドラッグ中のアイテム
  const [activeId, setActiveId] = useState(null);

  // メモモーダル用の状態
  const [memoModalState, setMemoModalState] = useState({
    isOpen: false,
    habitId: null,
    habitName: '',
    pendingAction: null,
    elapsedSeconds: 0
  });

  // ===== Dnd Sensors =====
  const sensors = useSensors(
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    }),
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 10,
      }
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // ===== 初期ロードとVisibility監視 =====
  useEffect(() => {
    if (user) {
      loadHabits();
      loadSettings();
    }
  }, [user]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        setTodayStr(getTodayString(dayStartHour));
        if (user) {
          loadHabits();
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [user, dayStartHour]);

  // ===== スナックバー処理 =====
  useEffect(() => {
    return () => {
      if (snackbarTimeoutRef.current) clearTimeout(snackbarTimeoutRef.current);
    };
  }, []);

  const showSnackbar = (message, habitId, habitName) => {
    if (snackbarTimeoutRef.current) clearTimeout(snackbarTimeoutRef.current);
    setSnackbar({ message, habitId, habitName });
    snackbarTimeoutRef.current = setTimeout(() => setSnackbar(null), 5000);
  };

  const hideSnackbar = () => {
    if (snackbarTimeoutRef.current) clearTimeout(snackbarTimeoutRef.current);
    setSnackbar(null);
  };

  const handleSnackbarUndo = () => {
    if (snackbar?.habitId) {
      undoComplete(snackbar.habitId);
    }
  };

  // ===== データ操作関数 =====
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

  const saveSettings = async (newDayStartHour) => {
    if (!confirm('日付切り替え時刻を変更すると、「今日」として表示される記録が変わる可能性があります。\n\n本当に変更しますか？')) return;
    try {
      const settingsRef = doc(db, 'users', user.uid, 'settings', 'general');
      await setDoc(settingsRef, { dayStartHour: newDayStartHour }, { merge: true });
      setDayStartHour(newDayStartHour);
    } catch (error) {
      console.error('設定の保存エラー:', error);
      alert('設定の保存に失敗しました');
    }
  };

  const loadHabits = async () => {
    try {
      const habitsRef = collection(db, 'users', user.uid, 'habits');
      const q = query(habitsRef);
      const snapshot = await getDocs(q);
      const habitsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      habitsData.sort((a, b) => {
        if (a.order !== undefined && b.order !== undefined) return a.order - b.order;
        const timeA = a.createdAt?.seconds || 0;
        const timeB = b.createdAt?.seconds || 0;
        return timeB - timeA;
      });
      setHabits(habitsData);
    } catch (error) {
      console.error('習慣の読み込みエラー:', error);
    }
  };

  const handleAddHabit = async (e) => {
    e.preventDefault();
    if (!newHabitName.trim()) return;

    const nextOrder = habits.length > 0
      ? Math.max(...habits.map(h => (h.order !== undefined ? h.order : -1))) + 1
      : 0;

    try {
      const habitsRef = collection(db, 'users', user.uid, 'habits');
      await addDoc(habitsRef, {
        name: newHabitName.trim(),
        createdAt: serverTimestamp(),
        order: nextOrder,
        isTimerEnabled: newHabitTimerEnabled,
        isMemoEnabled: newHabitMemoEnabled,
        totalDuration: 0,
        currentSession: null
      });
      setNewHabitName('');
      setNewHabitTimerEnabled(false);
      setNewHabitMemoEnabled(false);
      loadHabits();
    } catch (error) {
      console.error('習慣の追加エラー:', error);
      alert('習慣の追加に失敗しました');
    }
  };

  const handleUpdateHabit = async (habitId) => {
    if (!editingName.trim()) return;
    try {
      const habitRef = doc(db, 'users', user.uid, 'habits', habitId);
      await updateDoc(habitRef, { name: editingName.trim() });
      setEditingId(null);
      setEditingName('');
      loadHabits();
    } catch (error) {
      console.error('習慣の更新エラー:', error);
      alert('習慣の更新に失敗しました');
    }
  };

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

  // ===== ドラッグ＆ドロップ =====
  const handleDragStart = (event) => setActiveId(event.active.id);
  const handleDragCancel = () => setActiveId(null);

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over || active.id === over.id) return;

    const activeHabit = habits.find(h => h.id === active.id);
    const overHabit = habits.find(h => h.id === over.id);
    if (!activeHabit || !overHabit) return;

    const activeIsDone = activeHabit.logs?.[todayStr]?.done;
    const overIsDone = overHabit.logs?.[todayStr]?.done;

    if (activeIsDone !== overIsDone) {
      const incomplete = habits.filter(h => !h.logs?.[todayStr]?.done);
      const complete = habits.filter(h => h.logs?.[todayStr]?.done);
      let newHabits;
      if (activeIsDone) {
        newHabits = [...incomplete, activeHabit, ...complete.filter(h => h.id !== active.id)];
      } else {
        newHabits = [...incomplete.filter(h => h.id !== active.id), activeHabit, ...complete];
      }
      const updatedHabits = newHabits.map((habit, index) => ({ ...habit, order: index }));
      setHabits(updatedHabits);
      saveOrder(updatedHabits);
      return;
    }

    const oldIndex = habits.findIndex((h) => h.id === active.id);
    const newIndex = habits.findIndex((h) => h.id === over.id);
    const newHabits = arrayMove(habits, oldIndex, newIndex);
    const updatedHabits = newHabits.map((habit, index) => ({ ...habit, order: index }));
    setHabits(updatedHabits);
    saveOrder(updatedHabits);
  };

  const saveOrder = async (updatedHabits) => {
    try {
      const batch = writeBatch(db);
      updatedHabits.forEach((habit) => {
        const habitRef = doc(db, 'users', user.uid, 'habits', habit.id);
        batch.update(habitRef, { order: habit.order });
      });
      await batch.commit();
    } catch (error) {
      console.error('並び替え保存エラー:', error);
    }
  };

  // ===== 達成・タイマー・メモ =====
  const displayHabits = useMemo(() => {
    const incomplete = habits.filter(h => !h.logs?.[todayStr]?.done);
    const complete = habits.filter(h => h.logs?.[todayStr]?.done);
    return [...incomplete, ...complete];
  }, [habits, todayStr]);

  const calculateStreak = (habit) => {
    const logs = habit.logs || {};
    let streak = 0;
    const now = new Date();
    if (now.getHours() < dayStartHour) now.setDate(now.getDate() - 1);

    // 今日の日付文字列
    const getYMD = (date) => {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    };
    const todayYMD = getYMD(now);

    // 今日達成していなければ昨日からチェック開始
    let startOffset = 0;
    if (!logs[todayYMD]?.done) {
      startOffset = 1;
    }

    for (let i = startOffset; i < 365; i++) {
      const checkDate = new Date(now);
      checkDate.setDate(checkDate.getDate() - i);
      const dateStr = getYMD(checkDate);

      if (logs[dateStr]?.done) streak++;
      else break;
    }
    return streak;
  };

  const handleStartTimer = async (habit) => {
    const startTime = new Date().toISOString();
    // すでにセッション情報があればその日付を使う（再開時など）、なければ今日
    const targetDate = habit.currentSession?.targetDate || todayStr;

    try {
      const habitRef = doc(db, 'users', user.uid, 'habits', habit.id);
      await updateDoc(habitRef, {
        currentSession: { startTime, elapsed: 0, targetDate },
        [`logs.${targetDate}`]: {
          done: true,
          completedAt: startTime,
          duration: habit.logs?.[targetDate]?.duration || 0,
          memo: habit.logs?.[targetDate]?.memo || ''
        }
      });
      loadHabits();
      showSnackbar(`▶ ${habit.name} を開始`, habit.id, habit.name);
    } catch (error) {
      console.error('タイマー開始エラー:', error);
      alert('タイマーの開始に失敗しました');
    }
  };

  const handlePauseTimer = async (habit) => {
    if (!habit.currentSession?.startTime) return;
    const startTime = new Date(habit.currentSession.startTime).getTime();
    const runningSeconds = Math.floor((Date.now() - startTime) / 1000);
    const newElapsed = (habit.currentSession.elapsed || 0) + runningSeconds;
    const targetDate = habit.currentSession.targetDate || todayStr;

    try {
      const habitRef = doc(db, 'users', user.uid, 'habits', habit.id);
      await updateDoc(habitRef, {
        currentSession: { startTime: null, elapsed: newElapsed, targetDate }
      });
      loadHabits();
      showSnackbar(`⏸ 一時停止`, habit.id, habit.name);
    } catch (error) {
      console.error('一時停止エラー:', error);
    }
  };

  const handleResumeTimer = async (habit) => {
    const startTime = new Date().toISOString();
    // targetDateは既存のものを維持
    const targetDate = habit.currentSession?.targetDate || todayStr;

    try {
      const habitRef = doc(db, 'users', user.uid, 'habits', habit.id);
      await updateDoc(habitRef, {
        'currentSession.startTime': startTime,
        'currentSession.targetDate': targetDate
      });
      loadHabits();
      showSnackbar(`▶ 再開`, habit.id, habit.name);
    } catch (error) {
      console.error('再開エラー:', error);
    }
  };

  const handleStopTimer = async (habit) => {
    // 現在の経過時間を計算
    let totalElapsed = habit.currentSession?.elapsed || 0;
    if (habit.currentSession?.startTime) {
      const startTime = new Date(habit.currentSession.startTime).getTime();
      totalElapsed += Math.floor((Date.now() - startTime) / 1000);
    }

    // 記録すべき日付（開始日）
    const targetDate = habit.currentSession?.targetDate || todayStr;

    if (habit.isMemoEnabled) {
      setMemoModalState({
        isOpen: true,
        habitId: habit.id,
        habitName: habit.name,
        pendingAction: 'stopTimer',
        elapsedSeconds: totalElapsed,
        targetDate: targetDate // モーダル経由で保存するため日付を渡す
      });
    } else {
      await saveTimerStop(habit.id, targetDate, totalElapsed, '');
    }
  };

  const saveTimerStop = async (habitId, dateStr, elapsedSeconds, memo) => {
    try {
      const habit = habits.find(h => h.id === habitId);
      const currentDuration = habit?.logs?.[dateStr]?.duration || 0;
      const newDuration = currentDuration + elapsedSeconds;

      const habitRef = doc(db, 'users', user.uid, 'habits', habitId);
      await updateDoc(habitRef, {
        currentSession: null,
        totalDuration: increment(elapsedSeconds),
        [`logs.${dateStr}.duration`]: newDuration,
        [`logs.${dateStr}.memo`]: memo
      });
      loadHabits();
      const mins = Math.floor(elapsedSeconds / 60);
      showSnackbar(`⏹ 終了 (+${mins}分)`, habitId, habit?.name);
    } catch (error) {
      console.error('タイマー停止エラー:', error);
      alert('タイマーの停止に失敗しました');
    }
  };

  const markAsDone = async (habit) => {
    if (habit.isMemoEnabled) {
      setMemoModalState({
        isOpen: true,
        habitId: habit.id,
        habitName: habit.name,
        pendingAction: 'complete',
        elapsedSeconds: 0
      });
    } else {
      await saveComplete(habit.id, todayStr, '');
    }
  };

  const saveComplete = async (habitId, dateStr, memo) => {
    try {
      const habit = habits.find(h => h.id === habitId);
      const habitRef = doc(db, 'users', user.uid, 'habits', habitId);
      await updateDoc(habitRef, {
        [`logs.${dateStr}`]: {
          done: true,
          completedAt: new Date().toISOString(),
          duration: habit?.logs?.[dateStr]?.duration || 0,
          memo: memo
        }
      });
      loadHabits();
      showSnackbar(`✓ ${habit?.name} を達成しました！`, habitId, habit?.name);
    } catch (error) {
      console.error('記録の更新エラー:', error);
      alert('記録の更新に失敗しました');
    }
  };

  const undoComplete = async (habitId) => {
    try {
      const habitRef = doc(db, 'users', user.uid, 'habits', habitId);
      await updateDoc(habitRef, {
        [`logs.${todayStr}`]: { done: false, completedAt: null, duration: 0, memo: '' }
      });
      loadHabits();
      hideSnackbar();
    } catch (error) {
      console.error('記録の更新エラー:', error);
      alert('記録の更新に失敗しました');
    }
  };

  const handleToggleToday = async (habit) => {
    if (habit.logs?.[todayStr]?.done) {
      if (confirm(`「${habit.name}」の本日の記録を取り消しますか？`)) {
        await undoComplete(habit.id);
      }
    } else {
      await markAsDone(habit);
    }
  };

  const handleMemoSubmit = async (memo) => {
    const { habitId, pendingAction, elapsedSeconds, targetDate } = memoModalState;
    if (pendingAction === 'stopTimer') {
      await saveTimerStop(habitId, targetDate || todayStr, elapsedSeconds, memo);
    } else if (pendingAction === 'complete') {
      await saveComplete(habitId, todayStr, memo);
    }
    setMemoModalState({ isOpen: false, habitId: null, habitName: '', pendingAction: null, elapsedSeconds: 0 });
  };

  // ===== ナビゲーション処理 =====
  const handleHabitClick = (habitId) => {
    // 習慣の詳細ページへ遷移
    navigate(`/habits/${habitId}`);
  };

  return (
    <div className="app">
      <MemoModal
        isOpen={memoModalState.isOpen}
        habitName={memoModalState.habitName}
        onSubmit={handleMemoSubmit}
        onClose={() => setMemoModalState({ ...memoModalState, isOpen: false })}
      />

      {snackbar && (
        <div className="snackbar">
          <span className="snackbar-message">{snackbar.message}</span>
          <button className="snackbar-undo" onClick={handleSnackbarUndo}>取り消す</button>
        </div>
      )}

      <header>
        <h1>習慣トラッカー</h1>
        <button className="settings-button" onClick={() => setShowSettings(true)}>⚙</button>
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

              <div className="setting-item">
                <label>1日の開始時刻</label>
                <p className="setting-description">この時刻を過ぎると「翌日」として扱われます</p>
                <select value={dayStartHour} onChange={(e) => saveSettings(Number(e.target.value))}>
                  {[...Array(24)].map((_, hour) => <option key={hour} value={hour}>{hour}:00</option>)}
                </select>
              </div>
            </div>
            <div className="settings-footer">
              <div className="user-info-settings">
                <span>{user.displayName}</span>
                <span className="user-email">{user.email}</span>
              </div>
              <button onClick={handleLogout} className="logout-button">ログアウト</button>
            </div>
          </div>
        </div>
      )}



      {/* 習慣追加フォーム */}
      <form onSubmit={handleAddHabit} className="add-form">
        <input type="text" value={newHabitName} onChange={(e) => setNewHabitName(e.target.value)} placeholder="新しい習慣を入力..." />
        <button type="submit">追加</button>
      </form>
      <div className="add-form-options">
        <label className="add-form-option">
          <input type="checkbox" checked={newHabitTimerEnabled} onChange={(e) => setNewHabitTimerEnabled(e.target.checked)} />
          時間計測
        </label>
        <label className="add-form-option">
          <input type="checkbox" checked={newHabitMemoEnabled} onChange={(e) => setNewHabitMemoEnabled(e.target.checked)} />
          メモ機能
        </label>
      </div>

      {/* 習慣リスト */}
      <div className="habits-list">
        {habits.length === 0 ? <p className="empty-message">習慣を追加してください</p> : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
            modifiers={[restrictToVerticalAxis]}
          >
            <SortableContext items={displayHabits.map(h => h.id)} strategy={verticalListSortingStrategy}>
              {displayHabits.map((habit) => (
                <div key={habit.id} onClick={() => handleHabitClick(habit.id)}>
                  <SortableHabitItem
                    habit={habit}
                    todayStr={todayStr}
                    toggleHabit={handleToggleToday}
                    streak={calculateStreak(habit)}
                    onStartTimer={() => handleStartTimer(habit)}
                    onPauseTimer={() => handlePauseTimer(habit)}
                    onResumeTimer={() => handleResumeTimer(habit)}
                    onStopTimer={() => handleStopTimer(habit)}
                  />
                </div>
              ))}
            </SortableContext>
            <DragOverlay>
              {activeId ? <SortableHabitItem habit={habits.find(h => h.id === activeId)} todayStr={todayStr} toggleHabit={() => { }} isOverlay streak={calculateStreak(habits.find(h => h.id === activeId))} /> : null}
            </DragOverlay>
          </DndContext>
        )}
      </div>
    </div>
  );
}
