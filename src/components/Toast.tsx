import React from 'react';
import { useData } from '../context/DataContext';

export const Toast: React.FC = () => {
  const { activeToast } = useData() as any;

  if (!activeToast) return null;

  return (
    <div
      role="status"
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl bg-[var(--tipbg)] border border-[var(--cy)] text-[var(--tx)] text-xs font-semibold shadow-2xl backdrop-blur-md transition-all animate-bounce"
    >
      {activeToast}
    </div>
  );
};
