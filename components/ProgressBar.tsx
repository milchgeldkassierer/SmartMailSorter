import React from 'react';

interface ProgressBarProps {
  progress: number;
  label?: string;
  className?: string;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ progress, label, className = '' }) => {
  return (
    <div className={`bg-slate-50 px-6 py-2 border-b border-slate-200 flex items-center justify-between ${className}`}>
      {label && <span className="text-xs text-blue-600 font-medium">{label}</span>}
      <div className="w-48 bg-slate-200 rounded-full h-1.5">
        <div
          className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
          style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
        />
      </div>
    </div>
  );
};

export default ProgressBar;
