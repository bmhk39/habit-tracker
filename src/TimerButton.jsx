import React, { useState, useEffect, useRef } from 'react';

/**
 * タイマーボタンコンポーネント
 * - 開始/一時停止/停止の3状態対応
 * - 秒単位のリアルタイム表示
 * - 開始時刻ベースでバックグラウンド耐久性を実現
 * 
 * currentSession の構造:
 *   { startTime: "ISO" | null, elapsed: number }
 *   - startTime が値あり → 計測中
 *   - startTime が null かつ elapsed > 0 → 一時停止中
 *   - currentSession 自体が null → 未開始
 */
export function TimerButton({
  currentSession,   // { startTime, elapsed } | null
  onStart,
  onPause,
  onResume,
  onStop
}) {
  const [displaySeconds, setDisplaySeconds] = useState(0);
  const intervalRef = useRef(null);

  // 状態判定
  const isRunning = currentSession?.startTime != null;
  const isPaused = currentSession != null && currentSession.startTime == null;
  const elapsed = currentSession?.elapsed || 0;
  const startTime = currentSession?.startTime;

  // 経過時間を計算して表示を更新
  useEffect(() => {
    const updateDisplay = () => {
      if (isRunning && startTime) {
        const start = new Date(startTime).getTime();
        const now = Date.now();
        const runningSeconds = Math.floor((now - start) / 1000);
        setDisplaySeconds(elapsed + runningSeconds);
      } else {
        setDisplaySeconds(elapsed);
      }
    };

    // 初回即時更新
    updateDisplay();

    // 計測中なら1秒ごとに更新
    if (isRunning) {
      intervalRef.current = setInterval(updateDisplay, 1000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isRunning, startTime, elapsed]);

  // 秒を hh:mm:ss 形式にフォーマット
  const formatTime = (totalSeconds) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  };

  const handlePlayClick = (e) => {
    e.stopPropagation();
    if (isPaused) {
      onResume();
    } else {
      onStart();
    }
  };

  const handlePauseClick = (e) => {
    e.stopPropagation();
    onPause();
  };

  const handleStopClick = (e) => {
    e.stopPropagation();
    onStop();
  };

  // 未開始または一時停止中 → ▶ボタン
  // 計測中 → ⏸⏹ボタン
  // 一時停止中 → ▶⏹ボタン

  return (
    <div className="timer-button-container">
      {isRunning ? (
        <>
          <button
            className="timer-button pause"
            onClick={handlePauseClick}
            title="一時停止"
          >
            ⏸
          </button>
          <button
            className="timer-button stop"
            onClick={handleStopClick}
            title="停止（終了）"
          >
            ⏹
          </button>
        </>
      ) : isPaused ? (
        <>
          <button
            className="timer-button resume"
            onClick={handlePlayClick}
            title="再開"
          >
            ▶
          </button>
          <button
            className="timer-button stop"
            onClick={handleStopClick}
            title="停止（終了）"
          >
            ⏹
          </button>
        </>
      ) : (
        <button
          className="timer-button"
          onClick={handlePlayClick}
          title="開始"
        >
          ▶
        </button>
      )}
      <span className={`timer-display ${isPaused ? 'paused' : ''}`}>
        {formatTime(displaySeconds)}
      </span>
    </div>
  );
}

/**
 * 累計時間を「X時間Y分」形式でフォーマット
 */
export function formatTotalDuration(totalSeconds) {
  if (!totalSeconds || totalSeconds <= 0) return '0時間0分';

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  return `${hours}時間${minutes}分`;
}
