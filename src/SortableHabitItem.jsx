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
    const isTimerRunning = !!habit.currentSession?.startTime;
    const todayDuration = habit.logs?.[todayStr]?.duration || 0;
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
                            isRunning={isTimerRunning}
                            startTime={habit.currentSession?.startTime}
                            todayDuration={todayDuration}
                            onStart={() => { }}
                            onStop={() => { }}
                        />
                    ) : (
                        <button className={`toggle-button ${isDone ? 'done' : ''}`}>
                            {isDone ? '✓' : '○'}
                        </button>
                    )}
                    <span className="habit-name">{habit.name}</span>
                    {totalDuration > 0 && (
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
        touchAction: 'none',
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
                        isRunning={isTimerRunning}
                        startTime={habit.currentSession?.startTime}
                        todayDuration={todayDuration}
                        onStart={onStartTimer}
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
                {totalDuration > 0 && (
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
