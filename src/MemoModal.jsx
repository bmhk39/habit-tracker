import React, { useState } from 'react';

/**
 * メモ入力モーダル
 * - タイマー停止時 or 達成記録時に表示
 * - 任意入力（スキップ可能）
 */
export function MemoModal({ isOpen, onSubmit, onClose, habitName }) {
    const [memo, setMemo] = useState('');

    if (!isOpen) return null;

    const handleSubmit = () => {
        onSubmit(memo);
        setMemo('');
    };

    const handleSkip = () => {
        onSubmit('');
        setMemo('');
    };

    const handleOverlayClick = (e) => {
        if (e.target === e.currentTarget) {
            handleSkip();
        }
    };

    return (
        <div className="memo-modal-overlay" onClick={handleOverlayClick}>
            <div className="memo-modal">
                <h3>{habitName}</h3>
                <p className="memo-modal-label">今日のメモ（任意）</p>
                <textarea
                    value={memo}
                    onChange={(e) => setMemo(e.target.value)}
                    placeholder="例: 集中できた、疲れ気味だった..."
                    rows={3}
                    autoFocus
                />
                <div className="memo-modal-actions">
                    <button className="memo-skip-button" onClick={handleSkip}>
                        スキップ
                    </button>
                    <button className="memo-submit-button" onClick={handleSubmit}>
                        保存
                    </button>
                </div>
            </div>
        </div>
    );
}
