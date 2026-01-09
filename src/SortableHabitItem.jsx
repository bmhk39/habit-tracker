import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export function SortableHabitItem({ habit, todayStr, toggleHabit }) {
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
        // ドラッグ中のスタイル強化: ふわっと持ち上がる演出
        zIndex: isDragging ? 999 : 'auto',
        scale: isDragging ? '1.05' : '1',
        boxShadow: isDragging ? '0 10px 20px rgba(0,0,0,0.25)' : '0 1px 3px rgba(0,0,0,0.1)',
        opacity: isDragging ? 0.95 : 1,
        cursor: isDragging ? 'grabbing' : 'grab',
        backgroundColor: '#fff', // 透過しないように背景色指定

        // iOS長押し対策: 拡大鏡やメニューを出さない
        WebkitTouchCallout: 'none',
        WebkitUserSelect: 'none',
        userSelect: 'none',
        touchAction: 'none',
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
                        // ドラッグ用のイベントと競合しないように
                        e.stopPropagation();
                        toggleHabit(habit);
                    }}
                // ボタン部分はドラッグのハンドルにならないようにする（dnd-kitはデフォルトで要素全体がハンドルになるため、
                // 本当はハンドル専用アイコンを作ると良いが、今回は「長押し」で全体をドラッグ可能にする方針なのでこのままでもOK。
                // ただし、ボタンタップがドラッグ開始と誤認されないよう、e.stopPropagation() は必須ではないが、
                // ActivationConstraint (delay) を設定すればタップはタップとして認識される。
                >
                    {habit.logs?.[todayStr]?.done ? '✓' : '○'}
                </button>
                <span className="habit-name">{habit.name}</span>
            </div>
        </div>
    );
}
