import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export function SortableHabitItem({ habit, todayStr, toggleHabit, isOverlay, streak }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: habit.id });

    // Overlay（ドラッグ中の浮いている要素）のスタイル
    if (isOverlay) {
        return (
            <div
                className="habit-item"
                style={{
                    transform: 'scale(1.05)',
                    boxShadow: '0 10px 20px rgba(0,0,0,0.25)',
                    cursor: 'grabbing',
                    backgroundColor: '#fff',
                    zIndex: 999,
                    WebkitTouchCallout: 'none',
                    WebkitUserSelect: 'none',
                    userSelect: 'none',
                    touchAction: 'none',
                }}
            >
                <div className="habit-main">
                    {/* Overlay中はボタン操作無効なので見た目だけ */}
                    <button
                        className={`toggle-button ${habit.logs?.[todayStr]?.done ? 'done' : ''}`}
                    >
                        {habit.logs?.[todayStr]?.done ? '✓' : '○'}
                    </button>
                    <span className="habit-name">{habit.name}</span>
                </div>
                {streak > 0 && (
                    <span className="habit-streak">🔥{streak}日</span>
                )}
            </div>
        );
    }

    // 通常のリストアイテム（ドラッグ中はプレースホルダーになる）
    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.3 : 1, // ドラッグ元の場所は薄く表示
        touchAction: 'none', // スクロール干渉防止
        WebkitTouchCallout: 'none', // iOS長押しメニュー防止
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            className="habit-item"
        >
            <div className="habit-main">
                <button
                    className={`toggle-button ${habit.logs?.[todayStr]?.done ? 'done' : ''}`}
                    onClick={(e) => {
                        e.stopPropagation();
                        toggleHabit(habit);
                    }}
                >
                    {habit.logs?.[todayStr]?.done ? '✓' : '○'}
                </button>
                <span className="habit-name">{habit.name}</span>
            </div>
            {streak > 0 && (
                <span className="habit-streak">🔥{streak}日</span>
            )}
        </div>
    );
}
