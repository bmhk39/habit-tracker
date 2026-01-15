import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { db } from './firebase';
import { doc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { formatTotalDuration } from './TimerButton';

export default function HabitDetailPage({ user }) {
    const { id } = useParams();
    const navigate = useNavigate();

    const [habit, setHabit] = useState(null);
    const [loading, setLoading] = useState(true);
    const [historyData, setHistoryData] = useState([]);
    const [editingName, setEditingName] = useState('');
    const [isEditingName, setIsEditingName] = useState(false);
    const [dayStartHour, setDayStartHour] = useState(4);

    // 編集用モーダル
    const [editLogState, setEditLogState] = useState({
        isOpen: false,
        dateStr: '',
        done: false,
        duration: 0,
        memo: ''
    });

    useEffect(() => {
        if (user && id) {
            loadHabit();
            loadSettings();
        }
    }, [user, id]);

    const loadSettings = async () => {
        try {
            const settingsRef = doc(db, 'users', user.uid, 'settings', 'general');
            const settingsDoc = await getDoc(settingsRef);
            if (settingsDoc.exists()) {
                setDayStartHour(settingsDoc.data().dayStartHour ?? 4);
            }
        } catch (error) {
            console.error('設定読み込みエラー', error);
        }
    };

    const loadHabit = async () => {
        try {
            const docRef = doc(db, 'users', user.uid, 'habits', id);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                setHabit({ id: docSnap.id, ...data });
                setEditingName(data.name);
                generateHistory(data);
            } else {
                alert('習慣が見つかりません');
                navigate('/');
            }
        } catch (error) {
            console.error('習慣読み込みエラー', error);
        } finally {
            setLoading(false);
        }
    };

    // 過去30日分の履歴データを生成（ただし作成日以前は除く）
    const generateHistory = (habitData) => {
        const logs = habitData.logs || {};
        const history = [];
        const now = new Date();

        // Firestore Timestamp等の変換ヘルパー
        const getMillis = (ts) => {
            if (!ts) return 0;
            if (typeof ts.toMillis === 'function') return ts.toMillis();
            if (ts instanceof Date) return ts.getTime();
            return new Date(ts).getTime();
        };

        const createdAt = getMillis(habitData.createdAt);

        // 今日の日付補正
        if (now.getHours() < dayStartHour) {
            now.setDate(now.getDate() - 1);
        }

        for (let i = 0; i < 30; i++) {
            const d = new Date(now);
            d.setDate(d.getDate() - i);

            // 作成日より前ならスキップ
            const checkTime = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime();
            if (createdAt && checkTime < createdAt) continue;

            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            const dateStr = `${y}-${m}-${day}`;

            const log = logs[dateStr];
            history.push({
                dateStr,
                displayDate: `${m}/${day}`,
                done: log?.done || false,
                duration: log?.duration || 0,
                memo: log?.memo || '',
                isToday: i === 0
            });
        }
        setHistoryData(history);
    };

    const handleUpdateName = async () => {
        if (!editingName.trim()) return;
        try {
            await updateDoc(doc(db, 'users', user.uid, 'habits', id), {
                name: editingName.trim()
            });
            setHabit(prev => ({ ...prev, name: editingName.trim() }));
            setIsEditingName(false);
        } catch (error) {
            console.error('更新エラー', error);
        }
    };

    const handleToggleSetting = async (field, value) => {
        try {
            await updateDoc(doc(db, 'users', user.uid, 'habits', id), {
                [field]: value
            });
            setHabit(prev => ({ ...prev, [field]: value }));
        } catch (error) {
            console.error('設定更新エラー', error);
        }
    };

    const handleDelete = async () => {
        if (!confirm('本当に削除しますか？履修データも全て消えます。')) return;
        try {
            await deleteDoc(doc(db, 'users', user.uid, 'habits', id));
            navigate('/');
        } catch (error) {
            console.error('削除エラー', error);
        }
    };

    // ログ編集モーダルを開く
    const openEditLog = (item) => {
        setEditLogState({
            isOpen: true,
            dateStr: item.dateStr,
            done: item.done,
            duration: item.duration,
            memo: item.memo
        });
    };

    // ログ保存
    const saveLog = async () => {
        const { dateStr, done, duration, memo } = editLogState;
        try {
            await updateDoc(doc(db, 'users', user.uid, 'habits', id), {
                [`logs.${dateStr}`]: {
                    done,
                    duration: Number(duration),
                    memo,
                    completedAt: done ? new Date().toISOString() : null
                }
            });

            // ローカルstate更新
            const newLogs = { ...habit.logs, [dateStr]: { done, duration: Number(duration), memo } };
            const updatedHabit = { ...habit, logs: newLogs };
            setHabit(updatedHabit);
            generateHistory(updatedHabit);
            setEditLogState({ ...editLogState, isOpen: false });

        } catch (error) {
            console.error('ログ更新エラー', error);
            alert('保存に失敗しました');
        }
    };

    if (loading) return <div className="app">読み込み中...</div>;
    if (!habit) return null;

    return (
        <div className="app detail-page">
            <header className="detail-header">
                <Link to="/" className="back-link">← 戻る</Link>
                <div className="detail-total">
                    累計: {formatTotalDuration(habit.totalDuration || 0)}
                </div>
            </header>

            <div className="detail-content">
                {/* 名前編集エリア */}
                <div className="detail-name-section">
                    {isEditingName ? (
                        <div className="name-edit-box">
                            <input
                                type="text"
                                value={editingName}
                                onChange={(e) => setEditingName(e.target.value)}
                                autoFocus
                            />
                            <button onClick={handleUpdateName}>保存</button>
                        </div>
                    ) : (
                        <h1 onClick={() => setIsEditingName(true)}>{habit.name} <span className="edit-icon">✎</span></h1>
                    )}
                </div>

                {/* 設定トグル */}
                <div className="detail-settings">
                    <label className="toggle-row">
                        <span>⏱ 時間計測</span>
                        <input
                            type="checkbox"
                            checked={habit.isTimerEnabled || false}
                            onChange={(e) => handleToggleSetting('isTimerEnabled', e.target.checked)}
                        />
                    </label>
                    <label className="toggle-row">
                        <span>📝 メモ機能</span>
                        <input
                            type="checkbox"
                            checked={habit.isMemoEnabled || false}
                            onChange={(e) => handleToggleSetting('isMemoEnabled', e.target.checked)}
                        />
                    </label>
                </div>

                {/* 履歴リスト */}
                <div className="history-section">
                    <h2>履歴 (直近30日)</h2>
                    <div className="history-list">
                        {historyData.map(item => (
                            <div
                                key={item.dateStr}
                                className={`history-item ${item.done ? 'done' : 'missed'} ${item.isToday ? 'today' : ''}`}
                                onClick={() => openEditLog(item)}
                            >
                                <div className="history-date">
                                    {item.displayDate}
                                    {item.isToday && <span className="today-badge">Today</span>}
                                </div>
                                <div className="history-status">
                                    {item.done ? <span className="check-mark">✓</span> : <span className="miss-mark">-</span>}
                                </div>
                                <div className="history-info">
                                    {item.duration > 0 && <span className="history-duration">{formatTotalDuration(item.duration)}</span>}
                                    {item.memo && <span className="history-memo">{item.memo}</span>}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <button className="delete-habit-btn" onClick={handleDelete}>この習慣を削除</button>
            </div>

            {/* ログ編集モーダル */}
            {editLogState.isOpen && (
                <div className="modal-overlay" onClick={() => setEditLogState({ ...editLogState, isOpen: false })}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <h3>{editLogState.dateStr} の記録</h3>

                        <div className="modal-form-group">
                            <label>
                                <input
                                    type="checkbox"
                                    checked={editLogState.done}
                                    onChange={e => setEditLogState({ ...editLogState, done: e.target.checked })}
                                />
                                達成済みにする
                            </label>
                        </div>

                        {editLogState.done && (
                            <>
                                <div className="modal-form-group">
                                    <label>時間 (秒)</label>
                                    <input
                                        type="number"
                                        value={editLogState.duration}
                                        onChange={e => setEditLogState({ ...editLogState, duration: e.target.value })}
                                    />
                                    <p className="hint">例: 3600 = 1時間</p>
                                </div>
                                <div className="modal-form-group">
                                    <label>メモ</label>
                                    <textarea
                                        value={editLogState.memo}
                                        onChange={e => setEditLogState({ ...editLogState, memo: e.target.value })}
                                    />
                                </div>
                            </>
                        )}

                        <div className="modal-actions">
                            <button onClick={() => setEditLogState({ ...editLogState, isOpen: false })}>キャンセル</button>
                            <button className="primary" onClick={saveLog}>保存</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
