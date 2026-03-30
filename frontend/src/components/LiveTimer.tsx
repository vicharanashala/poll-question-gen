import React, { useState, useEffect, useMemo } from 'react';

interface LiveTimerProps {
  /** The starting timestamp (ISO string, Date object, or unix ms) */
  createdAt: string | number | Date | undefined | null;
  /** Optional custom styling classes */
  className?: string;
  /** Optional: Show hours? Default is true */
  showHours?: boolean;
}

const LiveTimer: React.FC<LiveTimerProps> = ({ 
  createdAt, 
  className = "", 
  showHours = true 
}) => {
  const [elapsed, setElapsed] = useState<number>(0);

  useEffect(() => {
    if (!createdAt) {
      setElapsed(0);
      return;
    }

    const startTime = new Date(createdAt).getTime();

    // 1. Initial calculation to prevent 1s delay
    const updateTimer = () => {
      const now = Date.now();
      const diff = now - startTime;
      setElapsed(Math.max(0, diff)); 
    };

    updateTimer();

    // 2. Setup interval
    const intervalId = setInterval(updateTimer, 1000);

    // 3. Cleanup
    return () => clearInterval(intervalId);
  }, [createdAt]);

  const formattedTime = useMemo(() => {
  const totalSeconds = Math.floor(elapsed / 1000);

  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  // ✅ After 24 hours → show days + hours only
  if (days > 0) {
    return `${days}d ${hours}h`;
  }

  // ✅ Normal format below 24h
  const parts = [minutes, seconds];
  if (showHours || hours > 0) {
    parts.unshift(hours);
  }

  return parts
    .map((v) => String(v).padStart(2, '0'))
    .join(':');
}, [elapsed, showHours]);

  // If no date is provided yet, you might want to show a placeholder or nothing
  if (!createdAt) return <span className={className}>--:--:--</span>;

  return (
    <span className={`tabular-nums font-mono ${className}`}>
      {formattedTime}
    </span>
  );
};

export default LiveTimer;