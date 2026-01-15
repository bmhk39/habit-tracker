import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { TimerButton, formatTotalDuration } from './TimerButton';

export function SortableHabitItem({
    habit,
    todayStr,
    toggleHabit,
    isOverlay,
    streak,
    onStartTimer,
    onPauseTimer,
    onResumeTimer,
    onStopTimer
}) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: habit.id });

    const isDone = habit.logs?.[todayStr]?.done;
    const isTimerEnabled = habit.isTimerEnabled;
    const totalDuration = habit.totalDuration || 0;

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
                    {isTimerEnabled ? (
                        <TimerButton
                            currentSession={habit.currentSession}
                            onStart={() => { }}
                            onPause={() => { }}
                            onResume={() => { }}
                            onStop={() => { }}
                        />
                    ) : (
                        <button className={`toggle-button ${isDone ? 'done' : ''}`}>
                            {isDone ? '✓' : '○'}
                        </button>
                    )}
                    <span className="habit-name">{habit.name}</span>
                    {isTimerEnabled && (
                        <span className="habit-total-duration">
                            {formatTotalDuration(totalDuration)}
                        </span>
                    )}
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
        opacity: isDragging ? 0.3 : 1,
        touchAction: 'pan-y',
        WebkitTouchCallout: 'none',
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
                {isTimerEnabled ? (
                    <TimerButton
                        currentSession={habit.currentSession}
                        onStart={onStartTimer}
                        onPause={onPauseTimer}
                        onResume={onResumeTimer}
                        onStop={onStopTimer}
                    />
                ) : (
                    <button
                        className={`toggle-button ${isDone ? 'done' : ''}`}
                        onClick={(e) => {
                            e.stopPropagation();
                            toggleHabit(habit);
                        }}
                    >
                        {isDone ? '✓' : '○'}
                    </button>
                )}
                <span className="habit-name">{habit.name}</span>
                {isTimerEnabled && (
                    <span className="habit-total-duration">
                        {formatTotalDuration(totalDuration)}
                    </span>
                )}
            </div>
            {streak > 0 && (
                <span className="habit-streak">🔥{streak}日</span>
            )}
        </div>
    );
}
