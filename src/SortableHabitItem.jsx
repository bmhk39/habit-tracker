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
        opacity: isDragging ? 0.5 : 1,
        touchAction: 'none', // ドラッグ操作のためにタッチアクションを制御
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
