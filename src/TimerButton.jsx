import React, { useState, useEffect, useRef } from 'react';

/**
 * タイマーボタンコンポーネント
 * - 再生/停止の切り替え
 * - 秒単位のリアルタイム表示
 * - 開始時刻ベースでバックグラウンド耐久性を実現
 */
export function TimerButton({ 
  isRunning, 
  startTime,        // ISOString（開始時刻）
  todayDuration,    // 今日すでに記録済みの秒数
  onStart, 
  onStop 
}) {
  const [displaySeconds, setDisplaySeconds] = useState(0);
  const intervalRef = useRef(null);

  // 経過時間を計算して表示を更新
  useEffect(() => {
    const updateDisplay = () => {
      if (isRunning && startTime) {
        const start = new Date(startTime).getTime();
        const now = Date.now();
        const elapsedSeconds = Math.floor((now - start) / 1000);
        setDisplaySeconds((todayDuration || 0) + elapsedSeconds);
      } else {
        setDisplaySeconds(todayDuration || 0);
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
  }, [isRunning, startTime, todayDuration]);

  // 秒を hh:mm:ss 形式にフォーマット
  const formatTime = (totalSeconds) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  };

  const handleClick = (e) => {
    e.stopPropagation();
    if (isRunning) {
      onStop();
    } else {
      onStart();
    }
  };

  return (
    <div className="timer-button-container">
      <button 
        className={`timer-button ${isRunning ? 'running' : ''}`}
        onClick={handleClick}
      >
        {isRunning ? '⏹' : '▶'}
      </button>
      <span className="timer-display">{formatTime(displaySeconds)}</span>
    </div>
  );
}

/**
 * 累計時間を "XXh XXm" 形式でフォーマット
 */
export function formatTotalDuration(totalSeconds) {
  if (!totalSeconds || totalSeconds <= 0) return '';
  
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}
