import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { db } from './firebase';
import {
    collection,
    addDoc,
    getDocs,
    updateDoc,
    deleteDoc,
    doc,
    query,
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
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';

// 並び替え可能な習慣アイテム
function SortableManageItem({ habit, onNavigate, onMenuToggle, activeMenuId }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: habit.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    const handleRowClick = (e) => {
        // メニューボタン以外をクリックした場合のみ遷移
        if (!e.target.closest('.menu-button')) {
            onNavigate(habit.id);
        }
    };

    const handleMenuClick = (e) => {
        e.stopPropagation();
        onMenuToggle(habit.id);
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className="manage-item"
            onClick={handleRowClick}
        >
            <div className="manage-item-drag" {...attributes} {...listeners}>
                ≡
            </div>
            <span className="manage-item-name">{habit.name}</span>
            <div className="manage-item-actions">
                <button className="menu-button" onClick={handleMenuClick}>︙</button>
            </div>
            {activeMenuId === habit.id && (
                <div className="manage-item-menu">
                    <button onClick={(e) => { e.stopPropagation(); onMenuToggle(null, 'edit', habit); }}>
                        名前を変更
                    </button>
                    <button className="delete" onClick={(e) => { e.stopPropagation(); onMenuToggle(null, 'delete', habit); }}>
                        削除
                    </button>
                </div>
            )}
        </div>
    );
}

export default function ManageHabitsPage({ user }) {
    const navigate = useNavigate();
    const [habits, setHabits] = useState([]);
    const [newHabitName, setNewHabitName] = useState('');
    const [newHabitTimerEnabled, setNewHabitTimerEnabled] = useState(false);
    const [newHabitMemoEnabled, setNewHabitMemoEnabled] = useState(false);
    const [activeMenuId, setActiveMenuId] = useState(null);
    const [activeId, setActiveId] = useState(null);

    // 編集モーダル
    const [editModal, setEditModal] = useState({ isOpen: false, habitId: null, name: '' });

    // ===== Dnd Sensors =====
    const sensors = useSensors(
        useSensor(TouchSensor, {
            activationConstraint: { delay: 250, tolerance: 5 },
        }),
        useSensor(MouseSensor, {
            activationConstraint: { distance: 10 },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        }),
    );

    useEffect(() => {
        if (user) loadHabits();
    }, [user]);

    // オーバーレイクリックでメニューを閉じる
    useEffect(() => {
        const handleClickOutside = () => setActiveMenuId(null);
        if (activeMenuId) {
            document.addEventListener('click', handleClickOutside);
            return () => document.removeEventListener('click', handleClickOutside);
        }
    }, [activeMenuId]);

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

    const handleMenuToggle = (habitId, action = null, habit = null) => {
        if (action === 'edit' && habit) {
            setEditModal({ isOpen: true, habitId: habit.id, name: habit.name });
            setActiveMenuId(null);
        } else if (action === 'delete' && habit) {
            handleDeleteHabit(habit.id, habit.name);
            setActiveMenuId(null);
        } else {
            setActiveMenuId(activeMenuId === habitId ? null : habitId);
        }
    };

    const handleUpdateName = async () => {
        if (!editModal.name.trim()) return;
        try {
            const habitRef = doc(db, 'users', user.uid, 'habits', editModal.habitId);
            await updateDoc(habitRef, { name: editModal.name.trim() });
            setEditModal({ isOpen: false, habitId: null, name: '' });
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

    const handleNavigate = (habitId) => {
        navigate(`/habits/${habitId}`);
    };

    return (
        <div className="app manage-page">
            <header className="manage-header">
                <Link to="/" className="back-link">← 戻る</Link>
                <h1>習慣の管理</h1>
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
            <div className="add-form-options">
                <label className="add-form-option">
                    <input
                        type="checkbox"
                        checked={newHabitTimerEnabled}
                        onChange={(e) => setNewHabitTimerEnabled(e.target.checked)}
                    />
                    時間計測
                </label>
                <label className="add-form-option">
                    <input
                        type="checkbox"
                        checked={newHabitMemoEnabled}
                        onChange={(e) => setNewHabitMemoEnabled(e.target.checked)}
                    />
                    メモ機能
                </label>
            </div>

            {/* 習慣一覧 */}
            <div className="manage-list">
                {habits.length === 0 ? (
                    <p className="empty-message">習慣を追加してください</p>
                ) : (
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                        onDragCancel={handleDragCancel}
                        modifiers={[restrictToVerticalAxis]}
                    >
                        <SortableContext items={habits.map(h => h.id)} strategy={verticalListSortingStrategy}>
                            {habits.map((habit) => (
                                <SortableManageItem
                                    key={habit.id}
                                    habit={habit}
                                    onNavigate={handleNavigate}
                                    onMenuToggle={handleMenuToggle}
                                    activeMenuId={activeMenuId}
                                />
                            ))}
                        </SortableContext>
                        <DragOverlay>
                            {activeId ? (
                                <div className="manage-item overlay">
                                    <div className="manage-item-drag">≡</div>
                                    <span className="manage-item-name">
                                        {habits.find(h => h.id === activeId)?.name}
                                    </span>
                                </div>
                            ) : null}
                        </DragOverlay>
                    </DndContext>
                )}
            </div>

            {/* 名前編集モーダル */}
            {editModal.isOpen && (
                <div className="modal-overlay" onClick={() => setEditModal({ isOpen: false, habitId: null, name: '' })}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <h3>習慣名を変更</h3>
                        <input
                            type="text"
                            value={editModal.name}
                            onChange={e => setEditModal({ ...editModal, name: e.target.value })}
                            autoFocus
                        />
                        <div className="modal-actions">
                            <button onClick={() => setEditModal({ isOpen: false, habitId: null, name: '' })}>キャンセル</button>
                            <button className="primary" onClick={handleUpdateName}>保存</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
